import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMathExercises, generatePrepMath, generateTopicMath } from './exercises/mathGenerator.js';
import { generateHebrewExercises } from './exercises/hebrewGenerator.js';
import { generateEnglishExercises, ABC_TYPES } from './exercises/englishGenerator.js';
import { fitSessionToCount, planIsActive } from './exercises/curriculum.js';
import { getWorkbook } from './exercises/workbooks.js';
import { computeInsights } from './exercises/insights.js';
import { pickLessonForSession, experiencedFamilies } from './exercises/lessons.js';
import {
  saveSession, computeWeakness, getStats, readHistory, readConfig, writeConfig,
  popReviewQueue, addWrongToReviewQueue,
  readChildren, getChild, addChild, updateChild, deleteChild,
  getProgress, applySessionProgress,
  getMistakes, updateMistakes,
  countTodayExercises, getPlanStatus,
  maybeAwardSticker, getRewards,
  getSeenLessons, markLessonSeen,
  activeSubjects,
  magicBoxState, unlockMagicBox, recordMagicBoxOpen, awardBonusSticker,
} from './storage.js';
import {
  registerUser, loginUser, userForToken, logoutToken, userCount,
  rememberDevice, forgetDevice, deviceLogin, externalLogin,
  ssoVerify, deviceEmail, createSsoCode, exchangeSsoCode, listAccounts,
} from './auth.js';
import {
  startGoogleFlow, finishGoogleFlow, setGoogleResult, takeGoogleResult,
  GOOGLE_CALLBACK_PATH,
} from './supabaseAuth.js';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Crash safety net ────────────────────────────────────────────────────────
// The server is the kids' whole app: it must never die mid-session. Any
// uncaught error (incl. a rejected async route — Express 4 doesn't catch
// those) is appended to server-crash.log in the data dir and the process
// KEEPS RUNNING. The log names the culprit if something still misbehaves.
const CRASH_LOG = path.join(
  process.env.KIDSLEARN_DATA_DIR || path.join(__dirname, 'data'),
  'server-crash.log',
);
function logCrash(kind, err) {
  const line = `[${new Date().toISOString()}] ${kind}: ${err?.stack || err}\n`;
  console.error(line.trim());
  import('fs').then(({ appendFileSync, mkdirSync }) => {
    try { mkdirSync(path.dirname(CRASH_LOG), { recursive: true }); } catch {}
    try { appendFileSync(CRASH_LOG, line); } catch {}
  }).catch(() => {});
}
process.on('uncaughtException', err => logCrash('uncaughtException', err));
process.on('unhandledRejection', err => logCrash('unhandledRejection', err));

const app = express();
app.use(cors());
// Allow larger bodies so child photos (base64 data URLs) fit comfortably
app.use(express.json({ limit: '8mb' }));

// ── Accounts (local register / login) ─────────────────────────────────────
// Passwords are hashed server-side; the client keeps only an opaque token.
const bearerToken = (req) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return (req.query && req.query.token) || (req.body && req.body.token) || '';
};

app.get('/api/auth/status', (req, res) => {
  res.json({ hasUsers: userCount() > 0 });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  const r = registerUser({ email, password, name });
  if (r.error) return res.status(400).json({ error: r.error });
  rememberDevice(r.user.email);   // this machine won't ask again
  res.json({ ok: true, token: r.token, user: r.user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const r = loginUser({ email, password });
  if (r.error) return res.status(401).json({ error: r.error });
  rememberDevice(r.user.email);   // this machine won't ask again
  res.json({ ok: true, token: r.token, user: r.user });
});

// Silent sign-in on a trusted (family) machine — no login screen.
app.get('/api/auth/device', (req, res) => {
  const r = deviceLogin();
  if (!r) return res.status(401).json({ error: 'המחשב הזה עוד לא מחובר לחשבון' });
  res.json({ ok: true, token: r.token, user: r.user });
});

// ── "Sign in with KidsLearn" for the family's other apps ──────────────────
// OAuth-style device-code flow with a PARENT GATE:
//   1. The other app opens GET /sso/authorize?app=Tavixo — a KidsLearn-branded
//      approval page on this machine.
//   2. The parent clicks אישור and answers two adult-level questions (so a
//      child can't connect apps alone), and the page shows a one-time code.
//   3. The app exchanges it: POST /api/sso/exchange {code, app} → identity +
//      token, re-checked each launch via GET /api/sso/verify?token=…
// Passwords never leave KidsLearn.

// Parent survey sessions: gateId → app (10-minute TTL, in-memory). Instead of
// arithmetic, the parent answers a short questionnaire — and connecting
// unlocks the Magic Box gift.
const ssoGates = new Map();
const GATE_TTL_MS = 10 * 60 * 1000;
function newGate(app) {
  for (const [id, g] of ssoGates) if (g.exp < Date.now()) ssoGates.delete(id);
  const id = globalThis.crypto.randomUUID();
  ssoGates.set(id, { app, exp: Date.now() + GATE_TTL_MS });
  return { id };
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The branded approval page the parent sees.
app.get('/sso/authorize', (req, res) => {
  const app_ = escapeHtml(String(req.query.app || '').trim().slice(0, 40) || 'אפליקציה');
  const withGoogle = String(req.query.provider || '') === 'google';
  const email = deviceEmail();
  if (!email) {
    return res.status(401).send(googlePage(false, 'KidsLearn לא מחובר',
      'פתחו את KidsLearn במחשב הזה, התחברו פעם אחת, ונסו שוב'));
  }
  const gate = newGate(app_);
  const accounts = listAccounts();
  const accountCards = accounts.map((a, i) => `
      <label style="display:flex;align-items:center;gap:10px;border:2px solid ${a.email === email ? '#5c6bc0' : '#e0e0e0'};border-radius:14px;padding:10px 14px;margin:6px 0;cursor:pointer;text-align:right">
        <input type="radio" name="acct" value="${escapeHtml(a.email)}" ${a.email === email ? 'checked' : ''} style="width:18px;height:18px;accent-color:#5c6bc0">
        <span style="flex:1"><b>${escapeHtml(a.name || a.email.split('@')[0])}</b><br><span dir="ltr" style="color:#888;font-size:.85rem">${escapeHtml(a.email)}</span></span>
      </label>`).join('');
  res.send(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>KidsLearn — אישור חיבור</title></head>
<body style="font-family:Arial,sans-serif;background:linear-gradient(135deg,#6a5acd,#5c6bc0);min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box">
<div style="background:#fff;border-radius:24px;padding:40px 44px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);max-width:440px;width:100%">
  <div style="font-size:56px;line-height:1">⭐</div>
  <h1 style="margin:8px 0 2px;background:linear-gradient(135deg,#f6b73c,#f9a825);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:2px">KidsLearn</h1>

  <div id="step1">
    <p style="font-size:1.1rem;color:#333;line-height:1.6">האפליקציה <b>${app_}</b> מבקשת להתחבר עם חשבון KidsLearn.<br>היא תקבל רק את השם והאימייל — אף פעם לא סיסמאות.</p>
    ${withGoogle ? `
    <div id="gBanner" style="background:#e8f0fe;border:1px solid #aecbfa;border-radius:12px;padding:10px 14px;margin:12px 0;color:#1a73e8;font-weight:700">
      🔴 מאמתים אתכם מול Google... נפתח חלון דפדפן — התחברו שם וחזרו לכאן.
    </div>` : ''}
    <p style="font-weight:800;color:#5c6bc0;margin:16px 0 4px">מי מתחבר?</p>
    ${accountCards}
    <button onclick="document.getElementById('step1').style.display='none';document.getElementById('step2').style.display='block'"
      style="background:linear-gradient(135deg,#66bb6a,#43a047);color:#fff;border:none;border-radius:14px;padding:14px 38px;font-size:1.15rem;font-weight:800;cursor:pointer;margin-top:12px">✓ אישור (Authorize)</button>
  </div>

  <div id="step2" style="display:none">
    <p style="font-weight:800;color:#5c6bc0;margin-bottom:10px">📋 שאלון קצר להורים</p>
    <div style="text-align:right">
      <p style="margin:6px 0 6px;color:#333;font-weight:700">1. האם ליצור קיצור דרך להתחברות מהירה עם Google?</p>
      <label style="margin-left:18px;color:#333"><input type="radio" name="qg" value="yes"> כן</label>
      <label style="color:#333"><input type="radio" name="qg" value="no" checked> לא</label>

      <p style="margin:18px 0 6px;color:#333;font-weight:700">2. האם לחבר את KidsLearn ל-${app_}?</p>
      <label style="margin-left:18px;color:#333"><input type="radio" name="qt" value="yes" checked> כן, לחבר (מומלץ! 🎁)</label>
      <label style="color:#333"><input type="radio" name="qt" value="no"> לא עכשיו</label>

      <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:12px 14px;margin-top:14px;color:#795548;line-height:1.5">
        🎁 <b>מתנה להורים שמחברים:</b> נפתחת <b>קופסת הקסמים</b> באזור ההורים של KidsLearn —
        הפתעה חדשה כל יום, הכול בחינם: מדבקות בונוס לילדים, קופונים משפחתיים, חידות והפתעות!
      </div>
    </div>
    <div id="gateErr" style="color:#c62828;font-weight:700;min-height:22px;margin-top:8px"></div>
    <button onclick="submitGate()" style="background:linear-gradient(135deg,#66bb6a,#43a047);color:#fff;border:none;border-radius:14px;padding:12px 34px;font-size:1.05rem;font-weight:800;cursor:pointer">המשך ←</button>
  </div>

  <div id="step3" style="display:none">
    <p style="color:#333;font-size:1.05rem">מעולה! זה קוד החיבור שלכם:</p>
    <div id="codeBox" style="font-family:Consolas,monospace;font-size:2.2rem;letter-spacing:8px;background:#f5f7ff;border:2px dashed #5c6bc0;border-radius:14px;padding:14px 10px;margin:10px 0;color:#3f51b5;user-select:all" dir="ltr"></div>
    <button onclick="copyCode()" id="copyBtn" style="background:#5c6bc0;color:#fff;border:none;border-radius:12px;padding:10px 26px;font-size:1rem;font-weight:700;cursor:pointer">📋 העתק קוד</button>
    <p style="color:#666;margin-top:16px">חזרו ל-<b>${app_}</b>, הדביקו את הקוד ואשרו.<br>הקוד תקף ל-10 דקות ולשימוש חד-פעמי.</p>
    <div id="declinedMsg" style="display:none;color:#333;font-size:1.05rem;line-height:1.6">
      בסדר גמור — בחרתם לא לחבר הפעם. 🙂<br>אפשר תמיד לחזור ולחבר מאוחר יותר (וקופסת הקסמים תחכה!).
    </div>
  </div>
</div>
<script>
async function submitGate() {
  const err = document.getElementById('gateErr');
  err.textContent = '';
  try {
    const r = await fetch('/api/sso/gate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateId: '${gate.id}', app: '${app_}',
        accountEmail: window.__googleEmail || (document.querySelector('input[name=acct]:checked') || {}).value,
        googleShortcut: (document.querySelector('input[name=qg]:checked') || {}).value === 'yes',
        connectApp: (document.querySelector('input[name=qt]:checked') || {}).value === 'yes' }),
    });
    const j = await r.json();
    if (!r.ok) { err.textContent = j.error || 'שגיאה'; if (j.reload) setTimeout(() => location.reload(), 1200); return; }
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
    if (j.declined) {
      document.getElementById('codeBox').style.display = 'none';
      document.getElementById('copyBtn').style.display = 'none';
      document.querySelectorAll('#step3 p').forEach(p => p.style.display = 'none');
      document.getElementById('declinedMsg').style.display = 'block';
      return;
    }
    document.getElementById('codeBox').textContent = j.code;
  } catch { err.textContent = 'שגיאת תקשורת — נסו שוב'; }
}
function copyCode() {
  const code = document.getElementById('codeBox').textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(
    () => { document.getElementById('copyBtn').textContent = '✓ הועתק!'; },
    () => { const r = document.createRange(); r.selectNode(document.getElementById('codeBox')); getSelection().removeAllRanges(); getSelection().addRange(r); }
  );
}
${withGoogle ? `
// Google-verified connect: start KidsLearn's Google flow, poll for the result,
// then lock the verified identity in (overrides the account picker).
(async function googleVerify() {
  const banner = document.getElementById('gBanner');
  try {
    await fetch('/api/auth/google/start');
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch('/api/auth/google/result');
      const j = await res.json();
      if (j.ok && j.user) {
        window.__googleEmail = j.user.email;
        banner.style.background = '#e6f4ea';
        banner.style.borderColor = '#a8dab5';
        banner.style.color = '#137333';
        banner.textContent = '✓ אומתתם עם Google: ' + j.user.email;
        document.querySelectorAll('input[name=acct]').forEach(x => { x.disabled = true; });
        return;
      }
    }
    banner.textContent = 'האימות עם Google לא הושלם — אפשר לבחור חשבון ידנית למטה.';
  } catch (e) {
    banner.textContent = 'שגיאה באימות Google — אפשר לבחור חשבון ידנית למטה.';
  }
})();` : ''}
</script></body></html>`);
});

// Parent survey → issues the one-time connection code (when they choose to
// connect) and unlocks the Magic Box gift.
app.post('/api/sso/gate', (req, res) => {
  const { gateId, app: appName, googleShortcut, connectApp } = req.body || {};
  const gate = ssoGates.get(String(gateId || ''));
  if (!gate || gate.exp < Date.now()) {
    ssoGates.delete(String(gateId || ''));
    return res.status(410).json({ error: 'פג תוקף הדף — טוען מחדש...', reload: true });
  }
  ssoGates.delete(String(gateId || ''));
  // Remember the parents' answers.
  const cfg = readConfig();
  cfg.ssoSurvey = {
    googleShortcut: !!googleShortcut,
    connectApp: !!connectApp,
    app: String(appName || gate.app || ''),
    date: new Date().toISOString().slice(0, 10),
  };
  writeConfig(cfg);
  if (!connectApp) {
    return res.json({ ok: true, declined: true });
  }
  const r = createSsoCode(appName || gate.app, req.body?.accountEmail);
  if (!r) return res.status(401).json({ error: 'KidsLearn לא מחובר במחשב הזה' });
  unlockMagicBox();   // 🎁 the parents' gift for connecting
  res.json({ ok: true, code: r.code });
});

// ── Magic Box (קופסת הקסמים) — a free daily surprise for the parents ──────
const MAGIC_SURPRISES = [
  { type: 'stickers', icon: '🌟', title: 'מדבקת בונוס לכל ילד!', text: 'כל ילד קיבל מדבקה נוספת לאלבום — במתנה מקופסת הקסמים.' },
  { type: 'coupon', icon: '🎬', title: 'קופון ערב סרט משפחתי', text: 'הילדים בוחרים את הסרט הערב — עם פופקורן! הקופון בתוקף תמיד.' },
  { type: 'coupon', icon: '🍕', title: 'קופון בחירת ארוחת ערב', text: 'הפעם הילדים מחליטים מה אוכלים לארוחת ערב.' },
  { type: 'riddle', icon: '🧩', title: 'חידה משפחתית', text: 'מה הולך ומחזיק את הבית? ... (תשובה: המפתח! 🔑) — מי בבית פותר ראשון?' },
  { type: 'joke', icon: '😂', title: 'בדיחת היום', text: 'למה המחשב הלך לרופא? כי היה לו וירוס! 🤒💻' },
  { type: 'activity', icon: '🎨', title: 'אתגר ציור משפחתי', text: '5 דקות: כל אחד מצייר את המשפחה — ומשווים תוצאות. צחוקים מובטחים!' },
  { type: 'activity', icon: '🎲', title: 'משחק 10 דקות', text: 'משחק "ארץ עיר" מהיר סביב השולחן — הנושא הראשון: חיות!' },
  { type: 'riddle', icon: '🤔', title: 'חידת חשבון להורים', text: 'אם דין פתר 30 תרגילים וליה 20 — כמה ביחד? (רמז: הילדים יודעים 😉)' },
  { type: 'coupon', icon: '🏖️', title: 'קופון טיול הפתעה', text: 'הילדים בוחרים לאן יוצאים בסוף השבוע — פארק, ים או גלידה.' },
  { type: 'activity', icon: '📖', title: 'סיפור לפני שינה כפול', text: 'הערב — שני סיפורים לפני השינה במקום אחד. הילדים בוחרים!' },
];

app.get('/api/magicbox', (req, res) => {
  const state = magicBoxState();
  const today = new Date().toISOString().slice(0, 10);
  const openedToday = state.opens.find(o => o.date === today) || null;
  res.json({ unlocked: state.unlocked, openedToday, totalOpens: state.opens.length });
});

app.post('/api/magicbox/open', (req, res) => {
  const state = magicBoxState();
  if (!state.unlocked) return res.status(403).json({ error: 'קופסת הקסמים נפתחת אחרי חיבור ל-Tavixo' });
  const today = new Date().toISOString().slice(0, 10);
  const already = state.opens.find(o => o.date === today);
  if (already) return res.json({ ok: true, surprise: already, repeat: true });
  const recent = new Set(state.opens.slice(-3).map(o => o.title));
  const pool = MAGIC_SURPRISES.filter(s => !recent.has(s.title));
  const pick_ = pool[Math.floor(Math.random() * pool.length)];
  const surprise = { ...pick_, date: today };
  if (surprise.type === 'stickers') {
    surprise.awarded = readChildren().map(c => ({ name: c.name, emoji: awardBonusSticker(c.id, today) }));
  }
  recordMagicBoxOpen(surprise);
  res.json({ ok: true, surprise });
});

// The other app trades the pasted code for identity + token (single use).
app.post('/api/sso/exchange', (req, res) => {
  const { code, app: appName } = req.body || {};
  const r = exchangeSsoCode(code, appName);
  if (!r) return res.status(404).json({ error: 'קוד לא נכון או שפג תוקפו' });
  if (r.app === 'Tavixo') unlockMagicBox();   // the connection is real now
  res.json(r);
});

app.get('/api/sso/verify', (req, res) => {
  const r = ssoVerify(String(req.query.token || ''));
  if (!r) return res.status(401).json({ error: 'אסימון לא מוכר' });
  res.json(r);
});

// ── NASHER 🦅 — auto-add "Sign in with KidsLearn" to any HTML app ──────────
// Internal tool: upload an app's HTML file, click one button, and NASHER
// injects a self-contained KidsLearn sign-in button (floating, with the full
// code flow: authorize page → paste code → exchange → identity saved in
// localStorage, exposed as window.kidslearnUser + a 'kidslearn-login' event).
// Re-uploading an already-injected file replaces the block (idempotent).

const NASHER_START = '<!-- KidsLearn Sign-In (added by NASHER) START -->';
const NASHER_END = '<!-- KidsLearn Sign-In (added by NASHER) END -->';

// Providers NASHER can wire TODAY. Google rides on KidsLearn's existing
// Google sign-in (Supabase) — the app's button opens the authorize page with
// provider=google, which verifies the person with Google before the code.
// Microsoft/Apple need developer-console registration (Apple is paid) and are
// shown in NASHER as "coming soon".
const NASHER_PROVIDERS = ['kidslearn', 'google'];

function nasherSnippet(appName, providers = ['kidslearn']) {
  const app = JSON.stringify(String(appName || 'App').slice(0, 40));
  const wanted = (Array.isArray(providers) ? providers : ['kidslearn'])
    .filter(p => NASHER_PROVIDERS.includes(p));
  const list = JSON.stringify(wanted.length ? wanted : ['kidslearn']);
  return `${NASHER_START}
<script>
(function () {
  var KIDSLEARN_URL = 'http://localhost:3001';   // כתובת KidsLearn (שנו ל-IP של המחשב אם צריך)
  var APP = ${app};
  var PROVIDERS = ${list};
  var KEY = 'kidslearn:sso:' + APP;
  function setUser(u) {
    window.kidslearnUser = u;
    document.dispatchEvent(new CustomEvent('kidslearn-login', { detail: u }));
    var btns = document.querySelectorAll('.kidslearn-signin-btn');
    for (var i = 0; i < btns.length; i++) {
      if (i === 0) btns[i].textContent = '⭐ ' + (u.name || u.email);
      else btns[i].style.display = 'none';
    }
  }
  function verifyStored() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s || !s.token) return;
      fetch(KIDSLEARN_URL + '/api/sso/verify?token=' + s.token)
        .then(function (r) { if (r.ok) setUser(s.user); else localStorage.removeItem(KEY); })
        .catch(function () {});
    } catch (e) {}
  }
  function connect(provider) {
    var extra = provider === 'google' ? '&provider=google' : '';
    window.open(KIDSLEARN_URL + '/sso/authorize?app=' + encodeURIComponent(APP) + extra, '_blank');
    setTimeout(function () {
      var code = prompt('הדביקו כאן את הקוד מ-KidsLearn:');
      if (!code) return;
      fetch(KIDSLEARN_URL + '/api/sso/exchange', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), app: APP }),
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || 'קוד לא נכון');
          localStorage.setItem(KEY, JSON.stringify({ token: j.token, user: j.user }));
          setUser(j.user);
          alert('שלום ' + (j.user.name || j.user.email) + '! החיבור הצליח 🎉');
        });
      }).catch(function (e) { alert(e.message); });
    }, 400);
  }
  var STYLES = {
    kidslearn: { label: '⭐ Sign in with KidsLearn', css: 'background:linear-gradient(135deg,#6a5acd,#5c6bc0);color:#fff' },
    google: { label: 'Continue with Google', css: 'background:#fff;color:#3c4043;border:1px solid #dadce0 !important' },
  };
  function makeBtns() {
    if (document.querySelector('.kidslearn-signin-btn')) return;
    for (var i = 0; i < PROVIDERS.length; i++) {
      (function (p, idx) {
        var s = STYLES[p];
        if (!s) return;
        var b = document.createElement('button');
        b.className = 'kidslearn-signin-btn';
        if (p === 'google') {
          b.innerHTML = '<b style="color:#4285F4">G</b><b style="color:#EA4335">o</b><b style="color:#FBBC05">o</b><b style="color:#4285F4">g</b><b style="color:#34A853">l</b><b style="color:#EA4335">e</b> — ' + 'Continue with Google';
        } else {
          b.textContent = s.label;
        }
        b.style.cssText = 'position:fixed;bottom:' + (18 + idx * 52) + 'px;left:18px;z-index:99999;border:none;border-radius:24px;padding:11px 20px;font-size:15px;font-weight:bold;font-family:Arial,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);' + s.css;
        b.onclick = function () { connect(p); };
        document.body.appendChild(b);
      })(PROVIDERS[i], i);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { makeBtns(); verifyStored(); });
  } else { makeBtns(); verifyStored(); }
})();
</script>
${NASHER_END}`;
}

app.post('/api/nasher/inject', (req, res) => {
  const { html, appName, providers } = req.body || {};
  if (typeof html !== 'string' || !html.trim()) {
    return res.status(400).json({ error: 'לא התקבל קובץ HTML' });
  }
  if (html.length > 6 * 1024 * 1024) {
    return res.status(413).json({ error: 'הקובץ גדול מדי (עד 6MB)' });
  }
  let out = html;
  // Idempotent: strip a previous NASHER block before injecting the fresh one.
  const s = out.indexOf(NASHER_START);
  const e = out.indexOf(NASHER_END);
  if (s !== -1 && e !== -1 && e > s) {
    out = out.slice(0, s) + out.slice(e + NASHER_END.length);
  }
  const snippet = '\n' + nasherSnippet(appName, providers) + '\n';
  const bodyClose = out.search(/<\/body\s*>/i);
  out = bodyClose !== -1
    ? out.slice(0, bodyClose) + snippet + out.slice(bodyClose)
    : out + snippet;
  res.json({ ok: true, html: out, replaced: s !== -1 });
});

app.get('/nasher', (req, res) => {
  res.send(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>NASHER — מוסיפים Sign in with KidsLearn לכל אפליקציה</title></head>
<body style="font-family:Arial,sans-serif;background:linear-gradient(135deg,#263238,#37474f);min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box">
<div style="background:#fff;border-radius:24px;padding:38px 42px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4);max-width:480px;width:100%">
  <div style="font-size:56px;line-height:1">🦅</div>
  <h1 style="margin:6px 0 2px;color:#263238;letter-spacing:3px">NASHER</h1>
  <p style="color:#666;margin:2px 0 20px">מעלים אפליקציה — ומקבלים אותה עם <b>⭐ Sign in with KidsLearn</b> מובנה. פחות מדקה.</p>

  <div id="drop" style="border:2px dashed #90a4ae;border-radius:16px;padding:26px;cursor:pointer;color:#607d8b;font-size:1.05rem" onclick="document.getElementById('file').click()">
    📄 לחצו לבחירת קובץ האפליקציה (HTML)<br><span id="fname" style="color:#263238;font-weight:700"></span>
  </div>
  <input type="file" id="file" accept=".html,.htm" style="display:none" onchange="picked(this)">

  <label style="display:block;text-align:right;margin:14px 4px 4px;color:#333;font-weight:700">שם האפליקציה:</label>
  <input id="appname" type="text" placeholder="למשל: המשחק של דין" style="width:100%;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:10px;font-size:1rem;text-align:right">

  <label style="display:block;text-align:right;margin:14px 4px 4px;color:#333;font-weight:700">אילו כפתורי התחברות להוסיף?</label>
  <div style="text-align:right;border:2px solid #cfd8dc;border-radius:10px;padding:10px 12px">
    <label style="display:block;padding:4px 0;color:#333"><input type="checkbox" id="p-kidslearn" checked> ⭐ Continue with KidsLearn</label>
    <label style="display:block;padding:4px 0;color:#333"><input type="checkbox" id="p-google" checked> 🔴 Continue with Google</label>
  </div>

  <button id="go" onclick="start()" disabled style="margin-top:18px;background:linear-gradient(135deg,#6a5acd,#5c6bc0);color:#fff;border:none;border-radius:14px;padding:14px 30px;font-size:1.1rem;font-weight:800;cursor:pointer;opacity:.5;width:100%">🚀 התחל — צרו את הכפתורים</button>

  <div id="progress" style="display:none;margin-top:18px;text-align:right">
    <div id="steps" style="color:#455a64;line-height:2"></div>
    <div style="background:#eceff1;border-radius:8px;height:10px;overflow:hidden;margin-top:6px"><div id="bar" style="background:linear-gradient(90deg,#6a5acd,#5c6bc0);height:100%;width:0%;transition:width .5s"></div></div>
  </div>

  <div id="done" style="display:none;margin-top:18px">
    <p style="color:#2e7d32;font-weight:800;font-size:1.1rem">✓ הכפתור נוצר והוטמע!</p>
    <button onclick="download()" style="background:linear-gradient(135deg,#66bb6a,#43a047);color:#fff;border:none;border-radius:14px;padding:12px 28px;font-size:1.05rem;font-weight:800;cursor:pointer">⬇️ הורידו את האפליקציה המחוברת</button>
    <p style="color:#777;font-size:.85rem;margin-top:10px">באפליקציה יופיע כפתור צף ⭐. הזהות זמינה לקוד שלכם ב-<code>window.kidslearnUser</code> ובאירוע <code>kidslearn-login</code>.</p>
  </div>
  <div id="err" style="color:#c62828;font-weight:700;margin-top:12px"></div>
</div>
<script>
var fileText = null, fileName = null, resultHtml = null;
function picked(inp) {
  var f = inp.files[0];
  if (!f) return;
  fileName = f.name;
  document.getElementById('fname').textContent = f.name;
  var appEl = document.getElementById('appname');
  if (!appEl.value) appEl.value = f.name.replace(/\\.html?$/i, '');
  var r = new FileReader();
  r.onload = function () { fileText = r.result; var g = document.getElementById('go'); g.disabled = false; g.style.opacity = 1; };
  r.readAsText(f);
}
var STEPS = ['🔍 מנתח את מבנה האפליקציה...', '🎨 מעצב את הכפתור בסגנון KidsLearn...', '🔗 מחבר לזרימת האישור וקוד ההורים...', '🧪 בודק שהכול עובד...'];
function start() {
  document.getElementById('err').textContent = '';
  document.getElementById('done').style.display = 'none';
  document.getElementById('progress').style.display = 'block';
  var st = document.getElementById('steps'); st.innerHTML = '';
  var i = 0;
  var iv = setInterval(function () {
    if (i < STEPS.length) {
      st.innerHTML += STEPS[i] + '<br>';
      document.getElementById('bar').style.width = ((i + 1) * 80 / STEPS.length) + '%';
      i++;
    } else {
      clearInterval(iv);
      var provs = [];
      if (document.getElementById('p-kidslearn').checked) provs.push('kidslearn');
      if (document.getElementById('p-google').checked) provs.push('google');
      fetch('/api/nasher/inject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fileText, appName: document.getElementById('appname').value || 'App', providers: provs }),
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'שגיאה'); return j; }); })
        .then(function (j) {
          resultHtml = j.html;
          document.getElementById('bar').style.width = '100%';
          st.innerHTML += '✅ מוכן!<br>';
          document.getElementById('done').style.display = 'block';
        })
        .catch(function (e) { document.getElementById('err').textContent = e.message; });
    }
  }, 900);
}
function download() {
  var blob = new Blob([resultHtml], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (fileName || 'app.html').replace(/\\.html?$/i, '') + '-kidslearn.html';
  a.click();
}
</script></body></html>`);
});

app.get('/api/auth/me', (req, res) => {
  const user = userForToken(bearerToken(req));
  if (!user) return res.status(401).json({ error: 'לא מחובר' });
  res.json({ ok: true, user });
});

app.post('/api/auth/logout', (req, res) => {
  logoutToken(bearerToken(req));
  forgetDevice();   // explicit logout = this machine asks for login again
  res.json({ ok: true });
});

// ── "Sign in with Google" (via the KIDS LEARN Supabase project) ────────────
// Google refuses to show its sign-in page inside app windows, so we open the
// system browser and it lands back on /auth/callback below.
function openInBrowser(url) {
  try {
    if (process.platform === 'win32') {
      // rundll32 passes the URL verbatim — no cmd.exe mangling of & characters.
      spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
    return true;
  } catch {
    return false;
  }
}

const googlePage = (ok, title, sub) => `<!doctype html><html dir="rtl" lang="he"><head>
<meta charset="utf-8"><title>KidsLearn</title></head>
<body style="font-family:Arial,sans-serif;background:linear-gradient(135deg,#6a5acd,#5c6bc0);color:#fff;height:100vh;margin:0;display:flex;align-items:center;justify-content:center">
<div style="background:#fff;color:#333;border-radius:24px;padding:44px 52px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
<div style="font-size:64px;line-height:1">${ok ? '🎉' : '😕'}</div>
<h1 style="color:#5c6bc0;margin:14px 0 6px">${title}</h1>
<p style="color:#666;margin:0">${sub}</p>
</div></body></html>`;

app.get('/api/auth/google/start', (req, res) => {
  const url = startGoogleFlow(PORT);
  const opened = openInBrowser(url);
  res.json({ ok: true, url, opened });
});

app.get(GOOGLE_CALLBACK_PATH, async (req, res) => {
  const { code, error, error_description: errDesc } = req.query || {};
  try {
    if (error || !code) throw new Error(String(errDesc || 'ההתחברות בוטלה'));
    const identity = await finishGoogleFlow(code);
    const r = externalLogin(identity);
    if (r.error) throw new Error(r.error);
    rememberDevice(r.user.email);   // family machine stays signed in
    setGoogleResult({ token: r.token, user: r.user });
    res.send(googlePage(true, 'ההתחברות הצליחה!', 'אפשר לסגור את החלון הזה ולחזור ל-KidsLearn'));
  } catch (e) {
    res.status(400).send(googlePage(false, 'ההתחברות לא הושלמה', e.message));
  }
});

app.get('/api/auth/google/result', (req, res) => {
  const r = takeGoogleResult();
  if (!r) return res.json({ pending: true });
  res.json({ ok: true, token: r.token, user: r.user });
});

// Serve the built React app from client/dist when running as a packaged app
const distPath = path.resolve(__dirname, '..', 'client', 'dist');
import('fs').then(({ existsSync }) => {
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log('[server] serving static files from', distPath);
  }
});

const TYPE_LABELS = {
  addition: 'חיבור',
  subtraction: 'חיסור',
  complete: 'השלמה למספר עגול',
  addition_10: 'חיבור עד 10',
  addition_20: 'חיבור עד 20',
  subtraction_10: 'חיסור עד 10',
  subtraction_20: 'חיסור עד 20',
  addition_30: 'חיבור עד 30',
  subtraction_30: 'חיסור עד 30',
  complete_10: 'השלמה ל-10',
  complete_20: 'השלמה ל-20',
  compare: 'השוואת מספרים',
  sequence: 'רצף מספרים',
  tens_in_number: 'כמה עשרות',
  ones_in_number: 'כמה אחדות',
  build_tens_ones: 'בניית מספר – עשרות ואחדות',
  expanded_form: 'פירוק לעשרות ואחדות',
  hundreds_in_number: 'כמה מאות',
  build_hundreds: 'בניית מספר תלת-ספרתי',
  expanded_form_3: 'פירוק מאות, עשרות ואחדות',
  skip_count: 'דילוגים – עולה',
  skip_count_back: 'דילוגים – יורד',
  skip_count_100: 'דילוגים ב-100',
  word_add: 'בעיה מילולית – חיבור',
  word_sub: 'בעיה מילולית – חיסור',
  geo_sides: 'גאומטריה – צלעות',
  geo_corners: 'גאומטריה – פינות',
  geo_identify: 'גאומטריה – זיהוי צורה',
  geo_count_sides_compare: 'גאומטריה – השוואת צורות',
  geo_count: 'גאומטריה – ספירת צורות',
  count_objects: 'ספירת חפצים',
  compare_quantities: 'השוואת כמויות',
  number_after: 'המספר שאחרי',
  number_before: 'המספר שלפני',
  visual_add: 'חיבור עם ציורים',
  visual_sub: 'חיסור עם ציורים',
  pattern: 'חוקיות (דגם חוזר)',
  biggest_number: 'המספר הגדול ביותר',
  smallest_number: 'המספר הקטן ביותר',
  round_tens_add: 'חיבור עשרות שלמות',
  round_tens_sub: 'חיסור עשרות שלמות',
  two_digit_add: 'חיבור דו-ספרתי',
  two_digit_sub: 'חיסור דו-ספרתי',
  missing_number: 'מספר חסר בתרגיל',
  even_odd: 'זוגי או אי-זוגי',
  repeated_add: 'חיבור חוזר (לקראת כפל)',
  name_letter: 'שם האות',
  word_starts_with: 'מילה שמתחילה ב-',
  fill_letter: 'השלמת אות במילה',
  fill_letter_choice: 'בחירת אות חסרה',
  find_letter: 'מציאת אות',
  match_letter: 'התאמת אות למילה',
  type_letter: 'כתיבת אות',
  count_letter: 'ספירת אותיות',
  first_letter_of_word: 'אות ראשונה',
  odd_one_out: 'מה שונה',
read_word: 'קריאת מילה',
  ordinal_position: 'מספרים סודרים — מי בתור',
  count_category: 'ספירה חכמה (עם מסיחים)',
  days_of_week: 'ימי השבוע',
  clock_reading: 'קריאת שעון',
  money_count: 'כסף וקניות',
  pictogram_read: 'קריאת גרף תמונות',
  mul_div_facts: 'כפל וחילוק',
  he_rhyme: 'חרוזים',
  he_syllable_count: 'ספירת הברות',
  he_word_blend: 'הרכבת מילה מצלילים',
  he_listen_story: 'הבנת הנשמע',
  en_rhyme: 'חרוזים באנגלית',
  en_sound_start: 'צליל פותח באנגלית',
  en_sentence_pic: 'משפט ותמונה',
  last_letter: 'אות אחרונה',
  en_letter_name: 'אנגלית – שם האות',
  en_letter_find: 'אנגלית – מציאת אות',
  en_first_letter: 'אנגלית – אות פותחת',
  en_word_to_pic: 'אנגלית – מילה לתמונה',
  en_pic_to_word: 'אנגלית – תמונה למילה',
  en_listen_pick: 'אנגלית – הבנת הנשמע',
  en_translate_to_he: 'אנגלית – תרגום לעברית',
  en_translate_to_en: 'אנגלית – תרגום לאנגלית',
  en_missing_letter: 'אנגלית – אות חסרה',
  en_spell: 'אנגלית – כתיבת מילה',
};

// Review questions resurface per child AND per subject, so a kid who learns
// both math and Hebrew never gets a letter question inside a math session.
const reviewKey = (child, subject) => `${child}:${subject || 'math'}`;

app.get('/api/exercises/:child', (req, res) => {
  const { child } = req.params;
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const profile = getChild(child);
  if (!profile) return res.status(404).json({ error: 'Unknown child' });

  // A child can have more than one subject; honour the requested one if enabled.
  const requested = String(req.query.subject || '');
  const enabled = activeSubjects(profile);
  const subject = enabled.includes(requested) ? requested : enabled[0];

  // Optional operation focus for math sessions ('add' | 'sub' | 'mix'),
  // a focused topic session ('topic:clock', ...) or an interactive workbook
  // ('book:clock', ...) that teaches the topic before the practice.
  const op = String(req.query.op || 'mix');
  const topicId = op.startsWith('topic:') ? op.slice(6) : null;
  const bookId = op.startsWith('book:') ? op.slice(5) : null;
  const focusId = topicId || bookId;

  const weakness = computeWeakness(child);
  // Topic/workbook sessions are extra, focused practice — they don't consume
  // the review queue (those resurface in the regular daily session).
  let reviewExercises = focusId ? [] : popReviewQueue(reviewKey(child, subject), 3);
  // A hidden topic must not sneak back in through resurfaced review questions.
  if (subject === 'english' && profile.hideEnglishLetters)
    reviewExercises = reviewExercises.filter(r => !ABC_TYPES.includes(r.type));
  // Prep-track children (עולה לכיתה א׳/ב׳) get curriculum-stage sessions that
  // climb automatically; everyone else keeps the level/mixed behaviour.
  const progress = getProgress(child, subject);
  // Every ladder starts at the parent-chosen level and climbs from there.
  const effectiveStage = subject === 'english'
    ? Math.max(progress.stage, profile.englishLevel || 1)
    : subject === 'hebrew'
      ? Math.max(progress.stage, profile.hebrewLevel || 1)
      : Math.max(progress.stage, profile.mathStage || 1);
  const topicCtx = { track: profile.grade, stage: effectiveStage, level: profile.mathLevel, allowMulDiv: profile.allowMulDiv };
  const makeSession = () => subject === 'english'
    ? generateEnglishExercises(effectiveStage, reviewExercises, profile.grade, profile.hideEnglishLetters)
    : subject === 'hebrew'
      ? generateHebrewExercises(weakness, reviewExercises, effectiveStage, profile.grade)
      : bookId
        ? generateTopicMath(bookId, topicCtx, [], { workbook: true })
        : topicId
          ? generateTopicMath(topicId, topicCtx)
          : profile.grade
            ? generatePrepMath(profile.grade, effectiveStage, reviewExercises, op, profile.allowMulDiv)
            : generateMathExercises(weakness, reviewExercises, profile.mathLevel, op);

  // Daily summer plan: size the session to exactly what's left of today's
  // quota, so one session (or a short top-up) completes the subject. Once the
  // day is complete (sticker awarded) it stays complete — extra sessions are
  // regular ones, and a raised quota only kicks in tomorrow. Topic sessions
  // keep their short focused size (they still count toward the quota).
  const planNow = getPlanStatus(profile, date);
  let exercises;
  if (!focusId && planNow && !planNow.complete) {
    const target = profile.dailyPlan[subject];
    const remaining = target ? target - countTodayExercises(child, subject, date) : 0;
    exercises = remaining > 0 ? fitSessionToCount(makeSession, remaining) : makeSession();
  } else {
    exercises = makeSession();
  }

  // Learning path: first encounter with a topic family opens with a
  // mini-lesson (teaching screen) before the exercises. Workbook sessions
  // skip it — the workbook IS the teaching.
  const lesson = bookId ? null : pickLessonForSession(exercises, {
    seenKeys: getSeenLessons(child),
    experiencedKeys: experiencedFamilies(readHistory()[child]),
    sessions: readHistory()[child],
    date,
  });
  if (lesson) markLessonSeen(child, lesson.markKey || lesson.key);

  const workbook = bookId ? getWorkbook(bookId) : null;

  return res.json({ child, subject, date, exercises, weakness, track: profile.grade || null, stage: effectiveStage, lesson, workbook });
});

// ── Mistakes collection (תרגול טעויות) ─────────────────────────────────────
// Everything each child got wrong on first attempt, per subject, kept until
// the child solves that exact question correctly on the first try.
app.get('/api/mistakes/:child', (req, res) => {
  const { child } = req.params;
  const profile = getChild(child);
  if (!profile) return res.status(404).json({ error: 'Unknown child' });
  const mistakes = {};
  for (const s of activeSubjects(profile)) {
    mistakes[s] = getMistakes(child, s);
    // ABC drills are paused for this child — hide them from practice too
    // (kept on disk; they return if the parent re-enables letters).
    if (s === 'english' && profile.hideEnglishLetters)
      mistakes[s] = mistakes[s].filter(m => !ABC_TYPES.includes(m.exercise?.type));
  }
  res.json({ child, mistakes });
});

// ── Children (profiles) ───────────────────────────────────────────────────
app.get('/api/children', (req, res) => {
  // Attach today's daily-plan progress so the home screen can show it.
  const today = new Date().toISOString().slice(0, 10);
  const children = readChildren().map(c => ({ ...c, todayPlan: getPlanStatus(c, today) }));
  res.json({ children });
});

app.post('/api/children', (req, res) => {
  const { name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'חסר שם' });
  // Reject oversized photos (defensive – client already downscales)
  if (photo && photo.length > 6_000_000) return res.status(413).json({ error: 'התמונה גדולה מדי' });
  const child = addChild({ name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo });
  res.json({ ok: true, child });
});

app.put('/api/children/:id', (req, res) => {
  const { name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo } = req.body || {};
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'חסר שם' });
  if (photo && photo.length > 6_000_000) return res.status(413).json({ error: 'התמונה גדולה מדי' });
  const child = updateChild(req.params.id, { name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo });
  if (!child) return res.status(404).json({ error: 'הילד לא נמצא' });
  res.json({ ok: true, child });
});

app.delete('/api/children/:id', (req, res) => {
  const ok = deleteChild(req.params.id);
  if (!ok) return res.status(400).json({ error: 'לא ניתן למחוק את הילד הזה' });
  res.json({ ok: true });
});

app.post('/api/save-session', async (req, res) => {
  // A kid's finished session must never be lost to an exception: everything
  // here is wrapped so a failure returns 500 (client can retry) instead of
  // hanging the request or killing the process (async throws in Express 4
  // become unhandled rejections).
  try {
    const { child, childName, date, results, subject, practice } = req.body;
    if (!child || !results) return res.status(400).json({ error: 'Missing data' });

    // The mistakes collection always updates: new mistakes join it, questions
    // solved correctly on the first attempt leave it. Runs BEFORE the session
    // is written to history — the first call lazily backfills from history, and
    // saving first would make it count this session's results twice.
    updateMistakes(child, subject || 'math', results);

    const session = { child, childName, date, results, subject, practice: !!practice };
    saveSession(child, session);

    const profile = getChild(child);
    let progress = null;
    if (!practice) {
      // Resurface wrong exercises into review queue for next session (per subject)
      addWrongToReviewQueue(reviewKey(child, subject), results);
      // Adaptive difficulty: consecutive successful days climb the child's
      // prep-track stage / math level automatically. Practice sessions are
      // remedial by nature and never touch the streak.
      progress = profile
        ? applySessionProgress(profile, subject, date || new Date().toISOString().slice(0, 10), results)
        : null;
    }

    // Send email report (non-blocking)
    sendEmailReport(session, child).catch(err => console.error('Email failed:', err.message));

    // Daily-plan status after this session (for the "day complete" celebration),
    // and today's sticker when the day's learning was earned.
    const day = date || new Date().toISOString().slice(0, 10);
    const planStatus = profile ? getPlanStatus(profile, day) : null;
    const sticker = profile ? maybeAwardSticker(profile, day, planStatus) : null;

    res.json({ ok: true, progress, planStatus, sticker });
  } catch (err) {
    console.error('[save-session] failed:', err?.stack || err);
    if (!res.headersSent) res.status(500).json({ error: 'שמירת המפגש נכשלה — נסו שוב' });
  }
});

// ── Rewards: stars, streak, sticker album, achievements ───────────────────
app.get('/api/rewards/:child', (req, res) => {
  const profile = getChild(req.params.child);
  if (!profile) return res.status(404).json({ error: 'Unknown child' });
  res.json({ child: profile.id, ...getRewards(profile.id) });
});

// ── Learning analysis for parents: topic mastery + recommendations ────────
app.get('/api/insights/:child', (req, res) => {
  const profile = getChild(req.params.child);
  if (!profile) return res.status(404).json({ error: 'Unknown child' });
  const sessions = readHistory()[profile.id] || [];
  // Effective stage per subject (progress floor-ed by the parent-chosen level)
  const stages = {};
  for (const s of activeSubjects(profile)) {
    const p = getProgress(profile.id, s);
    stages[s] = s === 'english'
      ? Math.max(p.stage, profile.englishLevel || 1)
      : s === 'hebrew'
        ? Math.max(p.stage, profile.hebrewLevel || 1)
        : Math.max(p.stage, profile.mathStage || 1);
  }
  res.json({ child: profile.id, insights: computeInsights({ profile, sessions, stages }) });
});

app.get('/api/history/:child', (req, res) => {
  const { child } = req.params;
  res.json({ sessions: readHistory()[child] || [] });
});

app.get('/api/stats/:child', (req, res) => {
  const child = req.params.child;
  res.json({
    ...getStats(child),
    progress: {
      math: getProgress(child, 'math'),
      hebrew: getProgress(child, 'hebrew'),
      english: getProgress(child, 'english'),
    },
  });
});

// ── Hebrew TTS proxy (Google Translate, free, no API key) ─────────────────
// Caches MP3 buffers in-memory keyed by text to avoid re-fetching.
const ttsCache = new Map();
const TTS_CACHE_LIMIT = 200;

// In-flight TTS fetches by cache key: many cards request the same phrase in a
// burst (question + replay button) — fetch Google once, answer everyone.
const ttsInflight = new Map();
const TTS_UPSTREAM_TIMEOUT = 6000;   // Google sometimes hangs this endpoint —
                                     // without a timeout, sockets pile up forever

function fetchTts(url) {
  return new Promise((resolve, reject) => {
    const reqUp = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://translate.google.com/',
      },
      timeout: TTS_UPSTREAM_TIMEOUT,
    }, (upstream) => {
      if (upstream.statusCode !== 200) {
        upstream.resume();
        return reject(new Error(`upstream status ${upstream.statusCode}`));
      }
      const chunks = [];
      let size = 0;
      upstream.on('data', c => {
        size += c.length;
        if (size > 5_000_000) { reqUp.destroy(new Error('tts too large')); return; }
        chunks.push(c);
      });
      upstream.on('end', () => resolve(Buffer.concat(chunks)));
      upstream.on('error', reject);
    });
    reqUp.on('timeout', () => reqUp.destroy(new Error('tts upstream timeout')));
    reqUp.on('error', reject);
  });
}

app.get('/api/tts', (req, res) => {
  const text = String(req.query.text || '').slice(0, 200);
  if (!text) return res.status(400).send('Missing text');
  // Hebrew by default; English voice for the English exercises.
  const lang = req.query.lang === 'en' ? 'en' : 'iw';

  const cacheKey = `${lang}|${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.end(cached);
  }

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  let job = ttsInflight.get(cacheKey);
  if (!job) {
    job = fetchTts(url).finally(() => ttsInflight.delete(cacheKey));
    ttsInflight.set(cacheKey, job);
  }

  job.then(buf => {
    if (ttsCache.size >= TTS_CACHE_LIMIT) {
      const firstKey = ttsCache.keys().next().value;
      ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, buf);
    // The kid may have moved on before the audio arrived — don't write then.
    if (res.writableEnded || res.destroyed) return;
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.end(buf);
  }).catch(err => {
    console.error('[TTS] proxy error:', err.message);
    if (res.writableEnded || res.destroyed || res.headersSent) return;
    res.status(504).send('TTS error');
  });
});

// Email config
app.get('/api/config/email', (req, res) => {
  const cfg = readConfig().email;
  res.json({
    enabled: cfg.enabled,
    smtpHost: cfg.smtpHost,
    smtpPort: cfg.smtpPort,
    smtpUser: cfg.smtpUser,
    recipients: cfg.recipients,
    hasPassword: !!cfg.smtpPass,
    passLength: (cfg.smtpPass || '').length,
  });
});

app.post('/api/config/email', (req, res) => {
  const { enabled, smtpHost, smtpPort, smtpUser, smtpPass, recipients } = req.body;
  const config = readConfig();
  const passProvided = smtpPass !== undefined && smtpPass !== '';
  const newPass = passProvided
    // Strip ALL whitespace (Google sometimes displays App Passwords with spaces)
    ? String(smtpPass).replace(/\s+/g, '')
    : config.email.smtpPass;
  config.email = {
    enabled: !!enabled,
    smtpHost: smtpHost || 'smtp.gmail.com',
    smtpPort: parseInt(smtpPort) || 587,
    smtpUser: smtpUser || '',
    smtpPass: newPass,
    recipients: recipients || '',
  };
  writeConfig(config);
  console.log('[config saved]', {
    smtpUser: config.email.smtpUser,
    passLength: config.email.smtpPass.length,
    passChanged: passProvided,
    recipients: config.email.recipients,
  });
  res.json({ ok: true, passLength: config.email.smtpPass.length, passChanged: passProvided });
});

app.post('/api/config/email/test', async (req, res) => {
  const cfg = readConfig().email;
  if (!cfg.smtpUser || !cfg.smtpPass) return res.status(400).json({ ok: false, error: 'חסרים פרטי SMTP' });
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpPort === 465,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    });
    await transporter.sendMail({
      from: `"KidsLearn 🌟" <${cfg.smtpUser}>`,
      to: cfg.recipients || cfg.smtpUser,
      subject: 'KidsLearn – מייל בדיקה',
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px">
        <h2 style="color:#5c6bc0">✅ הגדרות המייל פועלות!</h2>
        <p>מעכשיו תקבלו דוח אוטומטי בכל פעם שהילדים יסיימו את התרגילים היומיים שלהם.</p>
      </div>`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Background-removal config + proxy (remove.bg) ─────────────────────────
// The API key is stored locally and never echoed back to the client.
app.get('/api/config/removebg', (req, res) => {
  const cfg = readConfig().removeBg || {};
  res.json({ hasKey: !!cfg.apiKey, keyLength: (cfg.apiKey || '').length });
});

app.post('/api/config/removebg', (req, res) => {
  const { apiKey } = req.body || {};
  const config = readConfig();
  const provided = apiKey !== undefined && apiKey !== '';
  config.removeBg = {
    apiKey: provided ? String(apiKey).trim() : (config.removeBg?.apiKey || ''),
  };
  writeConfig(config);
  res.json({ ok: true, hasKey: !!config.removeBg.apiKey, keyLength: config.removeBg.apiKey.length });
});

// Remove the background from an uploaded photo. Returns a transparent PNG.
app.post('/api/remove-bg', async (req, res) => {
  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'חסרה תמונה' });
  const apiKey = (readConfig().removeBg?.apiKey || '').trim();
  if (!apiKey) return res.status(400).json({ error: 'לא הוגדר מפתח API להסרת רקע' });

  const b64 = String(image).replace(/^data:image\/\w+;base64,/, '');
  try {
    const body = new URLSearchParams();
    body.set('image_file_b64', b64);
    body.set('size', 'auto');
    const r = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body,
    });
    if (!r.ok) {
      let msg = `remove.bg החזיר שגיאה (${r.status})`;
      if (r.status === 403) msg = 'מפתח ה-API שגוי או שנגמרו הקרדיטים';
      else {
        try { const e = await r.json(); if (e?.errors?.[0]?.title) msg = e.errors[0].title; } catch {}
      }
      console.error('[remove-bg]', r.status, msg);
      return res.status(502).json({ error: msg });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return res.json({ ok: true, image: `data:image/png;base64,${buf.toString('base64')}` });
  } catch (e) {
    console.error('[remove-bg] proxy error:', e.message);
    return res.status(502).json({ error: 'הסרת הרקע נכשלה: ' + e.message });
  }
});

async function sendEmailReport({ childName, date, results, practice }, child) {
  const total = results.length;
  // "Mistake" = first attempt was wrong (even if eventually corrected)
  const noMistake = results.filter(r => r.firstAttemptCorrect !== false && r.correct).length;
  const finallyCorrect = results.filter(r => r.correct).length;

  const rows = results.map(r => {
    const hadMistake = r.firstAttemptCorrect === false;
    const finallyOk = r.correct;
    const bg = !hadMistake ? '#e8f5e9' : finallyOk ? '#fff3e0' : '#fce4ec';
    const status = !hadMistake ? '✅ ללא טעות' : finallyOk ? '⚠️ תוקן אחרי טעות' : '❌ לא נפתר';
    // Comparison symbols are bidi-mirrored in an RTL email — isolate them LTR.
    const answerHtml = /^[<>=]$/.test(String(r.answer))
      ? `<span dir="ltr">${String(r.answer).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
      : r.answer;
    return `<tr style="background:${bg}">
      <td style="padding:6px 12px;border:1px solid #ddd">${r.id}</td>
      <td style="padding:6px 12px;border:1px solid #ddd" dir="${r.dir || 'rtl'}">${r.question.replace(/\n/g, '<br>')}</td>
      <td style="padding:6px 12px;border:1px solid #ddd">${answerHtml}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:center">${status}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:center">${r.attempts}</td>
    </tr>`;
  }).join('');

  // Topics to strengthen – based on cumulative weakness
  const weakness = computeWeakness(child);
  const weakTopics = Object.entries(weakness)
    .filter(([_, rate]) => rate > 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const weakSection = weakTopics.length ? `
    <div style="background:#fff3e0;border-right:4px solid #fb8c00;border-radius:8px;padding:14px;margin-top:20px">
      <h3 style="margin:0 0 10px 0;color:#e65100">🎯 נושאים לחיזוק</h3>
      <ul style="margin:6px 16px;padding:0">
        ${weakTopics.map(([t, rate]) => `<li><strong>${TYPE_LABELS[t] || t}</strong> – שיעור טעויות ${Math.round(rate * 100)}%</li>`).join('')}
      </ul>
      <p style="margin:10px 0 0 0;font-size:0.9em;color:#5d4037">💡 התרגילים האלה יוצגו יותר במפגשים הבאים, וגם תרגילים שנכשלו יחזרו אוטומטית.</p>
    </div>` : '';

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
      <h2 style="color:#5c6bc0">דוח למידה יומי – ${childName} 🎉</h2>
      <p><strong>תאריך:</strong> ${date}</p>
      <div style="display:flex;gap:12px;margin:14px 0">
        <div style="flex:1;background:#e8f5e9;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:1.4em;font-weight:bold;color:#2e7d32">${noMistake}/${total}</div>
          <div style="font-size:0.85em;color:#555">ללא טעות מהפעם הראשונה</div>
        </div>
        <div style="flex:1;background:#fff3e0;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:1.4em;font-weight:bold;color:#e65100">${finallyCorrect - noMistake}</div>
          <div style="font-size:0.85em;color:#555">תוקן אחרי טעות</div>
        </div>
        <div style="flex:1;background:#ffebee;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:1.4em;font-weight:bold;color:#b71c1c">${total - finallyCorrect}</div>
          <div style="font-size:0.85em;color:#555">לא נפתר</div>
        </div>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:0.9em">
        <thead>
          <tr style="background:#5c6bc0;color:#fff">
            <th style="padding:8px 12px;border:1px solid #ddd">#</th>
            <th style="padding:8px 12px;border:1px solid #ddd">שאלה</th>
            <th style="padding:8px 12px;border:1px solid #ddd">תשובה נכונה</th>
            <th style="padding:8px 12px;border:1px solid #ddd">סטטוס</th>
            <th style="padding:8px 12px;border:1px solid #ddd">ניסיונות</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${weakSection}
      <p style="margin-top:20px;color:#777;font-size:12px">נשלח מ-KidsLearn 🌟</p>
    </div>`;

  const cfg = readConfig().email;
  if (!cfg.smtpUser || !cfg.smtpPass) {
    console.log('[email skipped – no SMTP credentials configured]');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
  });

  await transporter.sendMail({
    from: `"KidsLearn 🌟" <${cfg.smtpUser}>`,
    to: cfg.recipients || cfg.smtpUser,
    subject: `${practice ? 'תרגול טעויות' : 'דוח למידה'} – ${childName} – ${date}`,
    html,
  });
  console.log(`[email sent to ${cfg.recipients || cfg.smtpUser}]`);
}

// NOTE: The old "you haven't done exercises today" daily reminder was removed.
// In the installed desktop app the server only runs while the app is open, so
// the reminder fired right when you opened KidsLearn in the evening *to do*
// the exercises — sending a false "didn't do exercises" email before you'd
// even started. The learning-report email (sent when a session is completed)
// is unaffected and still works.

// SPA fallback – serve index.html for any non-API route
import('fs').then(({ existsSync }) => {
  const indexPath = path.join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(indexPath));
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`KidsLearn server running on http://localhost:${PORT}`));
