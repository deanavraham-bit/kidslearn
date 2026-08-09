function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build an arithmetic-progression sequence of 5 terms with one interior term
// blanked out. `step` may be negative for descending sequences. Numbers are
// shown LTR (a comma-separated number list reverses visually under RTL).
function buildSequence(type, start, step, opts = {}) {
  const len = 5;
  const seq = Array.from({ length: len }, (_, i) => start + i * step);
  const missingIdx = randInt(1, len - 2); // never blank the first/last term
  const display = seq.map((n, i) => (i === missingIdx ? '?' : n));
  return {
    type,
    difficulty: opts.difficulty || 2,
    dir: 'ltr',
    question: display.join(', '),
    answer: seq[missingIdx],
    hint: opts.hint,
  };
}

const WORD_PROBLEMS_ADD = [
  (a, b) => `לדני ${a} בלונים, קיבל עוד ${b}. כמה בלונים יש לו עכשיו?`,
  (a, b) => `בכיתה יש ${a} ילדים, הגיעו עוד ${b}. כמה ילדים יש עכשיו?`,
  (a, b) => `לשרה ${a} ספרים, קנתה עוד ${b}. כמה ספרים יש לה?`,
  (a, b) => `בסל יש ${a} תפוחים, הוסיפו עוד ${b}. כמה תפוחים יש בסל?`,
  (a, b) => `טום אסף ${a} קונכיות, חברו הוסיף ${b}. כמה קונכיות יש ביחד?`,
  (a, b) => `היו ${a} מכוניות צעצוע, וקנו עוד ${b}. כמה מכוניות יש עכשיו?`,
];

const WORD_PROBLEMS_SUB = [
  (a, b) => `לרותי ${a} סוכריות, נתנה ${b} לאחיה. כמה סוכריות נשארו?`,
  (a, b) => `היו ${a} ציפורים על הגג, ${b} עפו. כמה נשארו?`,
  (a, b) => `לאמא ${a} ביצים, השתמשה ב-${b}. כמה נשארו?`,
  (a, b) => `בחנות היו ${a} עוגיות, נמכרו ${b}. כמה נשארו?`,
  (a, b) => `יוסי קנה ${a} מדבקות, נתן ${b} לחברים. כמה נשאר לו?`,
  (a, b) => `היו ${a} פרחים באגרטל, ולקחו ${b}. כמה פרחים נשארו?`,
];

// difficulty: 1=easy, 2=medium, 3=hard
const GENERATORS = {
  // Easy (kept for review/back-compat; not part of the default daily mix)
  addition_10: () => {
    const a = randInt(1, 9);
    const b = randInt(0, 10 - a);
    return { type: 'addition_10', difficulty: 1, dir: 'ltr', question: `${a} + ${b} = ?`, answer: a + b, hint: `נסה לספור על האצבעות` };
  },
  subtraction_10: () => {
    const a = randInt(2, 10);
    const b = randInt(0, a);
    return { type: 'subtraction_10', difficulty: 1, dir: 'ltr', question: `${a} - ${b} = ?`, answer: a - b, hint: `נסה לספור אחורה` };
  },
  sequence: () => {
    const start = randInt(1, 16);
    const seq = [start, start + 1, start + 2, start + 3, start + 4];
    const missingIdx = randInt(1, 3);
    const display = seq.map((n, i) => i === missingIdx ? '?' : n);
    return { type: 'sequence', difficulty: 1, dir: 'ltr', question: display.join(', '), answer: seq[missingIdx], hint: `המספרים עולים ב-1` };
  },
  compare: () => {
    const a = randInt(1, 20);
    const b = randInt(1, 20);
    const symbol = a > b ? '>' : a < b ? '<' : '=';
    return { type: 'compare', difficulty: 1, dir: 'ltr', question: `${a} ___ ${b}`, answer: symbol, options: ['>', '<', '='], hint: `האם ${a} גדול, קטן או שווה ל-${b}?` };
  },

  // Medium
  addition_20: () => {
    const result = randInt(11, 20);
    const a = randInt(2, result - 2);
    const b = result - a;
    return { type: 'addition_20', difficulty: 2, dir: 'ltr', question: `${a} + ${b} = ?`, answer: result, hint: `${a} + ${b}` };
  },
  subtraction_20: () => {
    const a = randInt(11, 20);
    const b = randInt(1, a - 1);
    return { type: 'subtraction_20', difficulty: 2, dir: 'ltr', question: `${a} - ${b} = ?`, answer: a - b, hint: `${a} - ${b}` };
  },
  complete_10: () => {
    const a = randInt(1, 9);
    return { type: 'complete_10', difficulty: 2, dir: 'ltr', question: `${a} + ? = 10`, answer: 10 - a, hint: `כמה צריך להוסיף ל-${a} כדי להגיע ל-10?` };
  },
  complete_20: () => {
    const a = randInt(11, 19);
    return { type: 'complete_20', difficulty: 2, dir: 'ltr', question: `${a} + ? = 20`, answer: 20 - a, hint: `כמה צריך להוסיף ל-${a} כדי להגיע ל-20?` };
  },

  // Medium-Hard – up to 30
  addition_30: () => {
    const result = randInt(21, 30);
    const a = randInt(2, result - 2);
    const b = result - a;
    return { type: 'addition_30', difficulty: 3, dir: 'ltr', question: `${a} + ${b} = ?`, answer: result, hint: `${a} + ${b}` };
  },
  subtraction_30: () => {
    const a = randInt(21, 30);
    const b = randInt(1, a - 1);
    return { type: 'subtraction_30', difficulty: 3, dir: 'ltr', question: `${a} - ${b} = ?`, answer: a - b, hint: `${a} - ${b}` };
  },

  // Hard
  word_add: () => {
    const a = randInt(2, 10);
    const b = randInt(1, 20 - a);
    const tpl = pick(WORD_PROBLEMS_ADD);
    return { type: 'word_add', difficulty: 3, dir: 'rtl', question: tpl(a, b), answer: a + b, hint: `${a} + ${b}` };
  },
  word_sub: () => {
    const a = randInt(5, 20);
    const b = randInt(1, a - 1);
    const tpl = pick(WORD_PROBLEMS_SUB);
    return { type: 'word_sub', difficulty: 3, dir: 'rtl', question: tpl(a, b), answer: a - b, hint: `${a} - ${b}` };
  },

  // ── Place value – tens & ones (תחום ה-100, סוף כיתה א') ──────────────────
  tens_in_number: () => {
    const n = randInt(11, 99);
    return {
      type: 'tens_in_number', difficulty: 2, dir: 'rtl',
      question: `כמה עשרות יש במספר ${n}?`,
      answer: Math.floor(n / 10),
      hint: `הספרה השמאלית במספר ${n} היא ספרת העשרות`,
    };
  },
  ones_in_number: () => {
    const n = randInt(11, 99);
    return {
      type: 'ones_in_number', difficulty: 2, dir: 'rtl',
      question: `כמה אחדות יש במספר ${n}?`,
      answer: n % 10,
      hint: `הספרה הימנית במספר ${n} היא ספרת האחדות`,
    };
  },
  build_tens_ones: () => {
    const t = randInt(1, 9);
    const o = randInt(0, 9);
    return {
      type: 'build_tens_ones', difficulty: 2, dir: 'rtl',
      question: `${t} עשרות ו-${o} אחדות. איזה מספר זה?`,
      answer: t * 10 + o,
      hint: `${t} עשרות = ${t * 10}, ואז מוסיפים ${o} אחדות`,
    };
  },
  expanded_form: () => {
    const t = randInt(1, 9);
    const o = randInt(1, 9);
    const n = t * 10 + o;
    if (pick([true, false])) {
      return {
        type: 'expanded_form', difficulty: 2, dir: 'ltr',
        question: `${n} = ${t * 10} + ?`,
        answer: o,
        hint: `${n} זה ${t} עשרות (${t * 10}) ו-${o} אחדות`,
      };
    }
    return {
      type: 'expanded_form', difficulty: 2, dir: 'ltr',
      question: `${n} = ? + ${o}`,
      answer: t * 10,
      hint: `${n} זה ${t} עשרות (${t * 10}) ו-${o} אחדות`,
    };
  },

  // ── Place value – hundreds (תחום ה-1000, התחלת כיתה ב') ──────────────────
  hundreds_in_number: () => {
    const n = randInt(100, 999);
    return {
      type: 'hundreds_in_number', difficulty: 3, dir: 'rtl',
      question: `כמה מאות יש במספר ${n}?`,
      answer: Math.floor(n / 100),
      hint: `הספרה השמאלית במספר ${n} היא ספרת המאות`,
    };
  },
  build_hundreds: () => {
    const h = randInt(1, 9);
    const t = randInt(0, 9);
    const o = randInt(0, 9);
    return {
      type: 'build_hundreds', difficulty: 3, dir: 'rtl',
      question: `${h} מאות, ${t} עשרות ו-${o} אחדות. איזה מספר זה?`,
      answer: h * 100 + t * 10 + o,
      hint: `${h * 100} ועוד ${t * 10} ועוד ${o}`,
    };
  },
  expanded_form_3: () => {
    const h = randInt(1, 9);
    const t = randInt(1, 9);
    const o = randInt(1, 9);
    const n = h * 100 + t * 10 + o;
    const which = pick(['h', 't', 'o']);
    if (which === 'h') {
      return {
        type: 'expanded_form_3', difficulty: 3, dir: 'ltr',
        question: `${n} = ? + ${t * 10} + ${o}`,
        answer: h * 100,
        hint: `ספרת המאות היא ${h}, כלומר ${h * 100}`,
      };
    }
    if (which === 't') {
      return {
        type: 'expanded_form_3', difficulty: 3, dir: 'ltr',
        question: `${n} = ${h * 100} + ? + ${o}`,
        answer: t * 10,
        hint: `ספרת העשרות היא ${t}, כלומר ${t * 10}`,
      };
    }
    return {
      type: 'expanded_form_3', difficulty: 3, dir: 'ltr',
      question: `${n} = ${h * 100} + ${t * 10} + ?`,
      answer: o,
      hint: `ספרת האחדות היא ${o}`,
    };
  },

  // ── Sequences / skip counting (סדרות ודילוגים) ───────────────────────────
  skip_count: () => {
    const step = pick([2, 5, 10]);
    const maxStartMult = Math.floor((100 - 4 * step) / step);
    const start = step * randInt(1, maxStartMult);
    return buildSequence('skip_count', start, step, {
      difficulty: 2, hint: `כל פעם מוסיפים ${step}`,
    });
  },
  skip_count_back: () => {
    const step = pick([2, 5, 10]);
    const start = step * randInt(4, Math.floor(100 / step));
    return buildSequence('skip_count_back', start, -step, {
      difficulty: 2, hint: `כל פעם מורידים ${step}`,
    });
  },
  skip_count_100: () => {
    if (pick([true, false])) {
      const start = 100 * randInt(1, 6); // up to 600 → last term ≤ 1000
      return buildSequence('skip_count_100', start, 100, {
        difficulty: 3, hint: `קופצים ב-100 כל פעם`,
      });
    }
    const start = 100 * randInt(5, 10); // down from up to 1000 → last term ≥ 100
    return buildSequence('skip_count_100', start, -100, {
      difficulty: 3, hint: `יורדים ב-100 כל פעם`,
    });
  },

  // Geometry – Grade 2 level
  geo_sides: () => {
    const shapes = [
      { name: 'משולש', emoji: '🔺', sides: 3 },
      { name: 'מרובע', emoji: '⬛', sides: 4 },
      { name: 'מחומש', emoji: '⬟', sides: 5 },
      { name: 'משושה', emoji: '⬢', sides: 6 },
    ];
    const s = pick(shapes);
    return {
      type: 'geo_sides', difficulty: 2, dir: 'rtl',
      question: `כמה צלעות יש ל${s.name}?`,
      displayShape: s.emoji,
      answer: s.sides,
      hint: `ספור את הקווים הישרים ב${s.name}`,
    };
  },
  geo_corners: () => {
    const shapes = [
      { name: 'משולש', emoji: '🔺', corners: 3 },
      { name: 'מרובע', emoji: '⬛', corners: 4 },
      { name: 'מחומש', emoji: '⬟', corners: 5 },
      { name: 'משושה', emoji: '⬢', corners: 6 },
    ];
    const s = pick(shapes);
    return {
      type: 'geo_corners', difficulty: 2, dir: 'rtl',
      question: `כמה פינות יש ל${s.name}?`,
      displayShape: s.emoji,
      answer: s.corners,
      hint: `כל פינה היא נקודה שבה שני קווים נפגשים`,
    };
  },
  geo_identify: () => {
    const shapes = [
      { name: 'משולש', emoji: '🔺' },
      { name: 'ריבוע', emoji: '⬛' },
      { name: 'עיגול', emoji: '⚫' },
      { name: 'מלבן', emoji: '▬' },
      { name: 'מחומש', emoji: '⬟' },
      { name: 'משושה', emoji: '⬢' },
    ];
    const correct = pick(shapes);
    const wrong = shuffle(shapes.filter(s => s.name !== correct.name)).slice(0, 3);
    return {
      type: 'geo_identify', difficulty: 1, dir: 'rtl',
      question: `איזו צורה זו?`,
      displayShape: correct.emoji,
      answer: correct.name,
      options: shuffle([correct, ...wrong]).map(s => s.name),
      hint: `הסתכל על הצורה והתבונן בצלעות שלה`,
      dedupKey: `geo|id|${correct.name}`,
    };
  },
  geo_count_sides_compare: () => {
    const shapes = [
      { name: 'משולש', sides: 3 },
      { name: 'ריבוע', sides: 4 },
      { name: 'מחומש', sides: 5 },
      { name: 'משושה', sides: 6 },
    ];
    const a = pick(shapes);
    const b = pick(shapes.filter(s => s.sides !== a.sides));
    const more = a.sides > b.sides ? a : b;
    return {
      type: 'geo_count_sides_compare', difficulty: 3, dir: 'rtl',
      question: `לאיזו צורה יש יותר צלעות?`,
      answer: more.name,
      options: shuffle([a.name, b.name]),
      hint: `${a.name} = ${a.sides} צלעות, ${b.name} = ${b.sides} צלעות`,
      dedupKey: `geo|cmp|${[a.name, b.name].sort().join('|')}`,
    };
  },
};

// Daily session is composed from these categories with fixed quotas, so the
// new "strengthening" topics (place value + sequences) are guaranteed to show
// up every day rather than competing in a flat random lottery.
const CATEGORIES = {
  arithmetic: ['addition_20', 'subtraction_20', 'addition_30', 'subtraction_30', 'complete_10', 'complete_20'],
  word: ['word_add', 'word_sub'],
  compare: ['compare'],
  tens_ones: ['tens_in_number', 'ones_in_number', 'build_tens_ones', 'expanded_form'],
  sequences: ['sequence', 'skip_count', 'skip_count_back'],
  geometry: ['geo_sides', 'geo_corners', 'geo_identify', 'geo_count_sides_compare'],
  // NOTE: focus is tens & ones up to 100 for now. The hundreds generators
  // (hundreds_in_number, build_hundreds, expanded_form_3) and skip_count_100
  // still exist but are intentionally left out of the daily mix until the kid
  // is ready — add a `hundreds` category back here to re-enable them.
};

// How many questions of each category in a 20-question session (sums to 20).
const CATEGORY_QUOTA = {
  arithmetic: 7,
  word: 2,
  compare: 1,
  tens_ones: 5,
  sequences: 3,
  geometry: 2,
};

// Categories whose slots are given up first to make room for review questions.
const REVIEW_DONOR_ORDER = ['arithmetic', 'geometry', 'word'];

const ALL_TYPES = Object.values(CATEGORIES).flat();
const MAX_PER_TYPE = 2;

// When the child chose to focus on a single operation, restrict the arithmetic
// & word-problem pools accordingly. The number-sense categories (compare /
// tens_ones / sequences / geometry) are operation-neutral and stay as they are.
function operationCategories(operation) {
  if (operation === 'add') {
    return { ...CATEGORIES, arithmetic: ['addition_20', 'addition_30', 'complete_10', 'complete_20'], word: ['word_add'] };
  }
  if (operation === 'sub') {
    return { ...CATEGORIES, arithmetic: ['subtraction_20', 'subtraction_30'], word: ['word_sub'] };
  }
  return CATEGORIES;
}

// In the mixed curriculum the subtrahend stays single-digit: "חיסור דו ספרתי"
// (27 - 14) is still too hard, so we only ask 27 - 5. Addition and subtraction
// stay within 30. These overrides apply to the mixed session only — leveled
// sessions and the prep tracks keep the shared GENERATORS untouched.
const MIXED_SUB_MAX = 9;

const MIXED_GENERATORS = {
  ...GENERATORS,
  subtraction_20: () => {
    const a = randInt(11, 20);
    const b = randInt(1, Math.min(MIXED_SUB_MAX, a - 1));
    return { type: 'subtraction_20', difficulty: 2, dir: 'ltr', question: `${a} - ${b} = ?`, answer: a - b, hint: `${a} - ${b}` };
  },
  subtraction_30: () => {
    const a = randInt(21, 30);
    const b = randInt(1, MIXED_SUB_MAX);
    return { type: 'subtraction_30', difficulty: 3, dir: 'ltr', question: `${a} - ${b} = ?`, answer: a - b, hint: `${a} - ${b}` };
  },
  word_sub: () => {
    const a = randInt(5, 20);
    const b = randInt(1, Math.min(MIXED_SUB_MAX, a - 1));
    const tpl = pick(WORD_PROBLEMS_SUB);
    return { type: 'word_sub', difficulty: 3, dir: 'rtl', question: tpl(a, b), answer: a - b, hint: `${a} - ${b}` };
  },
};

// The original "mixed" curriculum (end-1st / start-2nd grade): arithmetic up
// to 30 + place value to 100 + sequences + geometry. Used when a child has no
// explicit mathLevel (e.g. the built-in son profile). `operation` ('add' |
// 'sub' | 'mix') focuses the arithmetic portion when requested.
function generateMixedMath(weakness = {}, reviewExercises = [], operation = 'mix') {
  const cats = operationCategories(operation);
  const reviewCount = Math.min(reviewExercises.length, 3);

  // Identify weakest types so we can prefer them within their own category.
  const weakTypes = Object.entries(weakness)
    .filter(([t, rate]) => rate > 0.3 && ALL_TYPES.includes(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);

  // Reduce category quotas to free up `reviewCount` slots (review replaces
  // filler categories, never the place-value/sequence strengthening ones).
  const quota = { ...CATEGORY_QUOTA };
  let toFree = reviewCount;
  for (const cat of REVIEW_DONOR_ORDER) {
    while (toFree > 0 && quota[cat] > 0) { quota[cat]--; toFree--; }
    if (!toFree) break;
  }

  // Expand the quota map into a flat list of category slots.
  const catSlots = [];
  for (const [cat, n] of Object.entries(quota)) {
    for (let i = 0; i < n; i++) catSlots.push(cat);
  }

  const exercises = [];
  const seen = new Set();
  const typeCount = {};

  // Review questions first (resurfaced exactly as they were answered wrong).
  for (const r of reviewExercises.slice(0, reviewCount)) {
    exercises.push({ ...r, isReview: true });
    seen.add(`${r.type}|${r.question}`);
    typeCount[r.type] = (typeCount[r.type] || 0) + 1;
  }

  function pickTypeForCategory(cat) {
    const types = cats[cat];
    let pool = types.filter(t => (typeCount[t] || 0) < MAX_PER_TYPE);
    if (!pool.length) pool = types;
    const weakInPool = pool.filter(t => weakTypes.includes(t));
    return pick(weakInPool.length ? weakInPool : pool);
  }

  for (const cat of catSlots) {
    let type = pickTypeForCategory(cat);
    let ex = MIXED_GENERATORS[type]();
    let key = `${ex.type}|${ex.question}`;
    let attempts = 0;
    // Retry on duplicate question; re-pick the type after a few misses.
    while (seen.has(key) && attempts < 25) {
      if (attempts > 6) type = pickTypeForCategory(cat);
      ex = MIXED_GENERATORS[type]();
      key = `${ex.type}|${ex.question}`;
      attempts++;
    }
    seen.add(key);
    typeCount[ex.type] = (typeCount[ex.type] || 0) + 1;
    exercises.push(ex);
  }

  // Shuffle so categories are interleaved, then assign display ids.
  return shuffle(exercises).map((ex, i) => ({ ...ex, id: i + 1 }));
}

// ── Level-aware arithmetic ("חיבור וחיסור עד N") ───────────────────────────
// When a child has an explicit mathLevel, the whole session is focused on
// addition & subtraction up to that ceiling, with light, in-range support
// (compare / sequence / complete, plus word problems from level 20 up). A
// beginner at level 10 therefore only ever sees numbers within 0–10.
// Types stay generic ('addition' / 'subtraction' / 'complete') so a child's
// history isn't fragmented when the level changes.
export const MATH_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function levelDifficulty(max) {
  return max <= 10 ? 1 : max <= 30 ? 2 : 3;
}

function makeAddition(max) {
  const result = randInt(2, max);
  // Both addends ≥ 1 so a beginner never gets a wall of trivial "+ 0" problems.
  let a = randInt(1, result - 1);
  let b = result - a;
  if (pick([true, false])) { const t = a; a = b; b = t; }   // vary the display order
  // Canonical key so "3 + 4" and "4 + 3" count as the SAME within a session.
  const dedupKey = `addition|${Math.min(a, b)}+${Math.max(a, b)}`;
  return { type: 'addition', difficulty: levelDifficulty(max), dir: 'ltr', question: `${a} + ${b} = ?`, answer: result, hint: `${a} + ${b}`, dedupKey };
}

function makeSubtraction(max) {
  const a = randInt(2, max);
  const b = randInt(1, a);      // b ≥ 1 so we skip trivial "- 0" problems
  return { type: 'subtraction', difficulty: levelDifficulty(max), dir: 'ltr', question: `${a} - ${b} = ?`, answer: a - b, hint: `${a} - ${b}` };
}

function makeComplete(max) {
  // Complete to a "round" target that fits the level (10, 20, … up to max).
  const targets = [];
  for (let r = 10; r <= max; r += 10) targets.push(r);
  const target = targets.length ? pick(targets) : max;
  const a = randInt(1, target - 1);
  return { type: 'complete', difficulty: 2, dir: 'ltr', question: `${a} + ? = ${target}`, answer: target - a, hint: `כמה צריך להוסיף ל-${a} כדי להגיע ל-${target}?` };
}

function makeCompareLeveled(max) {
  const a = randInt(0, max);
  const b = randInt(0, max);
  const symbol = a > b ? '>' : a < b ? '<' : '=';
  return { type: 'compare', difficulty: 1, dir: 'ltr', question: `${a} ___ ${b}`, answer: symbol, options: ['>', '<', '='], hint: `האם ${a} גדול, קטן או שווה ל-${b}?` };
}

function makeSequenceLeveled(max) {
  const step = max <= 10 ? 1 : pick([1, 1, 2]);
  const ascending = pick([true, false]);
  const span = 4 * step;
  // Keep every one of the 5 terms within [0, max].
  const start = ascending
    ? randInt(0, Math.max(0, max - span))
    : randInt(span, max);
  return buildSequence('sequence', start, ascending ? step : -step, {
    difficulty: 1,
    hint: ascending ? `המספרים עולים ב-${step}` : `המספרים יורדים ב-${step}`,
  });
}

function makeWordAddLeveled(max) {
  const a = randInt(2, Math.max(2, max - 1));
  const b = randInt(1, Math.max(1, max - a));
  const tpl = pick(WORD_PROBLEMS_ADD);
  return { type: 'word_add', difficulty: 3, dir: 'rtl', question: tpl(a, b), answer: a + b, hint: `${a} + ${b}` };
}

function makeWordSubLeveled(max) {
  const a = randInt(Math.min(5, max), max);
  const b = randInt(1, Math.max(1, a - 1));
  const tpl = pick(WORD_PROBLEMS_SUB);
  return { type: 'word_sub', difficulty: 3, dir: 'rtl', question: tpl(a, b), answer: a - b, hint: `${a} - ${b}` };
}

function generateLeveledMath(level, reviewExercises = [], operation = 'mix') {
  const L = MATH_LEVELS.includes(level) ? level : 30;
  const reviewCount = Math.min(reviewExercises.length, 3);

  // Build a 20-slot plan. Addition/subtraction are the bulk; the rest is light,
  // in-range support (2 compare + 2 sequence). Word problems join from level 20
  // up. `operation` focuses the bulk on addition only, subtraction only, or a
  // balanced mix.
  const plan = [];
  const push = (gen, n) => { for (let i = 0; i < n; i++) plan.push(gen); };

  const SUPPORT = 4;                 // 2 compare + 2 sequence (operation-neutral)
  const withWord = L >= 20;
  const wordN = withWord ? 2 : 0;
  const arithTotal = 20 - SUPPORT - wordN; // addition / subtraction / complete

  if (operation === 'add') {
    push(() => makeAddition(L), arithTotal - 2);
    push(() => makeComplete(L), 2);          // "complete to a round number" is addition
    if (withWord) push(() => makeWordAddLeveled(L), 2);
  } else if (operation === 'sub') {
    push(() => makeSubtraction(L), arithTotal); // a subtraction-only session has no "complete"
    if (withWord) push(() => makeWordSubLeveled(L), 2);
  } else {
    const half = (arithTotal - 2) / 2;
    push(() => makeAddition(L), half);
    push(() => makeSubtraction(L), half);
    push(() => makeComplete(L), 2);
    if (withWord) { push(() => makeWordAddLeveled(L), 1); push(() => makeWordSubLeveled(L), 1); }
  }
  push(() => makeCompareLeveled(L), 2);
  push(() => makeSequenceLeveled(L), 2);

  // Free slots for resurfaced review questions by dropping leading arithmetic.
  for (let i = 0; i < reviewCount && plan.length; i++) plan.shift();

  return assembleSession(plan, reviewExercises, reviewCount);
}

// Turn a plan (array of generator thunks) + resurfaced review questions into
// a shuffled, de-duplicated session with display ids.
function assembleSession(plan, reviewExercises, reviewCount) {
  const exercises = [];
  const seen = new Set();
  const keyOf = (ex) => ex.dedupKey || `${ex.type}|${ex.question}`;
  for (const r of reviewExercises.slice(0, reviewCount)) {
    exercises.push({ ...r, isReview: true });
    seen.add(keyOf(r));
  }
  for (const gen of plan) {
    let ex = gen();
    let key = keyOf(ex);
    let attempts = 0;
    while (seen.has(key) && attempts < 25) { ex = gen(); key = keyOf(ex); attempts++; }
    seen.add(key);
    exercises.push(ex);
  }
  return shuffle(exercises).map((ex, i) => ({ ...ex, id: i + 1 }));
}

// ═══ Preparation tracks (מסלולי הכנה) ═══════════════════════════════════════
// Question types for the two Ministry-of-Education-aligned prep tracks:
// gan_to_a (עולה מגן חובה לכיתה א׳) and a_to_b (עולה מכיתה א׳ לכיתה ב׳).
// See server/exercises/curriculum.js and docs/curriculum-map.md for the map.

const COUNT_ITEMS = [
  { e: '🍎', name: 'תפוחים' },
  { e: '⭐', name: 'כוכבים' },
  { e: '🎈', name: 'בלונים' },
  { e: '🌸', name: 'פרחים' },
  { e: '🐟', name: 'דגים' },
  { e: '🚗', name: 'מכוניות' },
  { e: '🍓', name: 'תותים' },
  { e: '🦋', name: 'פרפרים' },
  { e: '🐤', name: 'אפרוחים' },
];

const emojiRow = (e, n) => Array(n).fill(e).join(' ');

// ── Kindergarten → 1st grade (counting, quantities, visual arithmetic) ──────
function makeCountObjects(max) {
  const item = pick(COUNT_ITEMS);
  const n = randInt(2, max);
  return {
    type: 'count_objects', difficulty: 1, dir: 'rtl',
    question: `כמה ${item.name} יש כאן?`,
    displayShape: emojiRow(item.e, n),
    answer: n,
    hint: `הצבע על כל ${item.e} וספור בקול`,
  };
}

function makeCompareQuantities() {
  const [a, b] = shuffle(COUNT_ITEMS).slice(0, 2);
  const na = randInt(1, 6);
  let nb = randInt(1, 6);
  while (nb === na) nb = randInt(1, 6);
  const more = na > nb ? a : b;
  return {
    type: 'compare_quantities', difficulty: 1, dir: 'rtl',
    question: `ממה יש יותר?`,
    displayShape: `${emojiRow(a.e, na)}\n${emojiRow(b.e, nb)}`,
    answer: more.name,
    options: shuffle([a.name, b.name]),
    hint: `ספור כל שורה בנפרד והשווה`,
    dedupKey: `cmpq|${a.e}${na}|${b.e}${nb}`,
  };
}

function makeNumberAfter(max) {
  const n = randInt(0, max - 1);
  return {
    type: 'number_after', difficulty: 1, dir: 'rtl',
    question: `איזה מספר בא אחרי ${n}?`,
    answer: n + 1,
    hint: `ספור: ${n}, ואז...`,
  };
}

function makeNumberBefore(max) {
  const n = randInt(1, max);
  return {
    type: 'number_before', difficulty: 1, dir: 'rtl',
    question: `איזה מספר בא לפני ${n}?`,
    answer: n - 1,
    hint: `המספר שקטן מ-${n} באחד`,
  };
}

function makeVisualAdd(max) {
  const item = pick(COUNT_ITEMS);
  const result = randInt(2, max);
  const a = randInt(1, result - 1);
  const b = result - a;
  return {
    type: 'visual_add', difficulty: 1, dir: 'ltr',
    question: `${a} + ${b} = ?`,
    displayShape: `${emojiRow(item.e, a)}  +  ${emojiRow(item.e, b)}`,
    answer: result,
    hint: `ספור את כל ה${item.name} ביחד`,
  };
}

function makeVisualSub(max) {
  const item = pick(COUNT_ITEMS);
  const a = randInt(2, max);
  const b = randInt(1, a - 1);
  return {
    type: 'visual_sub', difficulty: 1, dir: 'ltr',
    question: `${a} - ${b} = ?`,
    displayShape: emojiRow(item.e, a),
    answer: a - b,
    hint: `יש ${a} ${item.name}. כסה ${b} וספור כמה נשארו`,
  };
}

function makePattern() {
  const emojis = shuffle(['🔴', '🔵', '🟡', '🟢', '⭐', '❤️', '🔺', '🟪']).slice(0, 3);
  const kind = pick(['AB', 'AABB', 'ABC']);
  let unit;
  if (kind === 'AB') unit = [emojis[0], emojis[1]];
  else if (kind === 'AABB') unit = [emojis[0], emojis[0], emojis[1], emojis[1]];
  else unit = [emojis[0], emojis[1], emojis[2]];
  const seq = Array(unit.length > 3 ? 2 : 3).fill(unit).flat();
  const answer = seq[seq.length - 1];
  const display = [...seq.slice(0, -1), '❓'];
  const usedSet = [...new Set(unit)];
  const distractor = emojis.find(e => !usedSet.includes(e));
  const options = shuffle(distractor ? [...usedSet, distractor] : usedSet);
  return {
    type: 'pattern', difficulty: 1, dir: 'ltr',
    question: `מה בא במקום סימן השאלה?`,
    displayShape: display.join(' '),
    answer,
    options,
    hint: `יש כאן חוקיות שחוזרת על עצמה — אמור אותה בקול`,
    dedupKey: `pattern|${display.join('')}`,
  };
}

function makeBiggestNumber(max) {
  const nums = shuffle(Array.from({ length: max + 1 }, (_, i) => i)).slice(0, 3);
  return {
    type: 'biggest_number', difficulty: 1, dir: 'rtl',
    question: `איזה מספר הכי גדול?`,
    answer: Math.max(...nums),
    options: nums,
    hint: `איזה מספר בא אחרון כשסופרים?`,
    dedupKey: `biggest|${[...nums].sort((a, b) => a - b).join(',')}`,
  };
}

function makeSmallestNumber(max) {
  const nums = shuffle(Array.from({ length: max + 1 }, (_, i) => i)).slice(0, 3);
  return {
    type: 'smallest_number', difficulty: 1, dir: 'rtl',
    question: `איזה מספר הכי קטן?`,
    answer: Math.min(...nums),
    options: nums,
    hint: `איזה מספר בא ראשון כשסופרים?`,
    dedupKey: `smallest|${[...nums].sort((a, b) => a - b).join(',')}`,
  };
}

function makeGeoCount() {
  const shapes = [
    { e: '🔺', name: 'משולשים' },
    { e: '⬛', name: 'ריבועים' },
    { e: '⚫', name: 'עיגולים' },
  ];
  const s = pick(shapes);
  const n = randInt(3, 7);
  return {
    type: 'geo_count', difficulty: 1, dir: 'rtl',
    question: `כמה ${s.name} יש?`,
    displayShape: emojiRow(s.e, n),
    answer: n,
    hint: `הצבע על כל צורה וספור`,
    dedupKey: `geocount|${s.e}|${n}`,
  };
}

// ── 1st grade → 2nd grade (two-digit arithmetic, pre-multiplication) ────────
function makeRoundTensAdd() {
  const a = 10 * randInt(1, 8);
  const b = 10 * randInt(1, (100 - a) / 10);
  return {
    type: 'round_tens_add', difficulty: 2, dir: 'ltr',
    question: `${a} + ${b} = ?`,
    answer: a + b,
    hint: `${a / 10} עשרות ועוד ${b / 10} עשרות`,
  };
}

function makeRoundTensSub() {
  const a = 10 * randInt(2, 10);
  const b = 10 * randInt(1, a / 10 - 1);
  return {
    type: 'round_tens_sub', difficulty: 2, dir: 'ltr',
    question: `${a} - ${b} = ?`,
    answer: a - b,
    hint: `${a / 10} עשרות פחות ${b / 10} עשרות`,
  };
}

// Two-digit ± ones/tens WITHOUT regrouping (בלי המרה) – the grade-2 opener.
function makeTwoDigitAdd() {
  if (pick([true, false])) {
    const t = randInt(1, 9);
    const o = randInt(1, 8);
    const b = randInt(1, 9 - o);
    const a = t * 10 + o;
    return {
      type: 'two_digit_add', difficulty: 3, dir: 'ltr',
      question: `${a} + ${b} = ?`, answer: a + b,
      hint: `רק ספרת האחדות משתנה: ${o} + ${b}`,
    };
  }
  const a = randInt(11, 89);
  const b = 10 * randInt(1, Math.floor((99 - a) / 10));
  return {
    type: 'two_digit_add', difficulty: 3, dir: 'ltr',
    question: `${a} + ${b} = ?`, answer: a + b,
    hint: `רק ספרת העשרות משתנה: מוסיפים ${b / 10} עשרות`,
  };
}

function makeTwoDigitSub() {
  if (pick([true, false])) {
    const t = randInt(1, 9);
    const o = randInt(2, 9);
    const b = randInt(1, o);
    const a = t * 10 + o;
    return {
      type: 'two_digit_sub', difficulty: 3, dir: 'ltr',
      question: `${a} - ${b} = ?`, answer: a - b,
      hint: `רק ספרת האחדות משתנה: ${o} - ${b}`,
    };
  }
  const a = randInt(31, 99);
  const b = 10 * randInt(1, Math.floor(a / 10) - 1);
  return {
    type: 'two_digit_sub', difficulty: 3, dir: 'ltr',
    question: `${a} - ${b} = ?`, answer: a - b,
    hint: `רק ספרת העשרות משתנה: מורידים ${b / 10} עשרות`,
  };
}

function makeMissingAdd(max) {
  const c = randInt(3, max);
  const known = randInt(1, c - 1);
  const missing = c - known;
  if (pick([true, false])) {
    return {
      type: 'missing_number', difficulty: 2, dir: 'ltr',
      question: `? + ${known} = ${c}`, answer: missing,
      hint: `כמה צריך להוסיף ל-${known} כדי להגיע ל-${c}?`,
    };
  }
  return {
    type: 'missing_number', difficulty: 2, dir: 'ltr',
    question: `${known} + ? = ${c}`, answer: missing,
    hint: `כמה צריך להוסיף ל-${known} כדי להגיע ל-${c}?`,
  };
}

function makeMissingSub(max) {
  const a = randInt(3, max);
  const b = randInt(1, a - 1);
  const c = a - b;
  if (pick([true, false])) {
    return {
      type: 'missing_number', difficulty: 2, dir: 'ltr',
      question: `${a} - ? = ${c}`, answer: b,
      hint: `כמה צריך להוריד מ-${a} כדי להגיע ל-${c}?`,
    };
  }
  return {
    type: 'missing_number', difficulty: 2, dir: 'ltr',
    question: `? - ${b} = ${c}`, answer: a,
    hint: `איזה מספר, פחות ${b}, נותן ${c}?`,
  };
}

function makeEvenOdd(max) {
  const n = randInt(1, max);
  return {
    type: 'even_odd', difficulty: 2, dir: 'rtl',
    question: `המספר ${n} — זוגי או אי-זוגי?`,
    answer: n % 2 === 0 ? 'זוגי' : 'אי-זוגי',
    options: ['זוגי', 'אי-זוגי'],
    hint: `מספר זוגי אפשר לחלק לזוגות בלי שנשאר אחד לבד`,
  };
}

// Repeated addition – the doorway to multiplication in grade 2.
function makeRepeatedAdd() {
  const times = randInt(2, 4);
  const v = randInt(2, 5);
  return {
    type: 'repeated_add', difficulty: 3, dir: 'ltr',
    question: `${Array(times).fill(v).join(' + ')} = ?`,
    answer: times * v,
    hint: `${times} פעמים ${v} — לקראת לוח הכפל!`,
    dedupKey: `repeated_add|${times}x${v}`,
  };
}

const geoGan = () => GENERATORS[pick(['geo_identify', 'geo_sides', 'geo_corners'])]();
const geoGrade2 = () => GENERATORS[pick(['geo_identify', 'geo_sides', 'geo_corners', 'geo_count_sides_compare'])]();
const tensOnes = () => GENERATORS[pick(['tens_in_number', 'ones_in_number', 'build_tens_ones', 'expanded_form'])]();
const skipCount = () => GENERATORS[pick(['skip_count', 'skip_count_back'])]();

// ═══ Curriculum topics added after MoE-curriculum research (2026-07) ════════
// Sources: תכנית הליבה במתמטיקה לקדם-יסודי; תכנית הלימודים החדשה לכיתות א-ב
// (2023). Every type below maps to an explicit curriculum goal.

// ── Ordinal numbers (מספרים סודרים — יעד מפורש בגן: עד שישי, הרחבה לעשירי) ──
const ORDINAL_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני', 'תשיעי', 'עשירי'];
const ORDINAL_ITEMS = [
  { e: '🐶', name: 'הכלב' }, { e: '🐱', name: 'החתול' }, { e: '🐭', name: 'העכבר' },
  { e: '🐰', name: 'הארנב' }, { e: '🦊', name: 'השועל' }, { e: '🐮', name: 'הפרה' },
  { e: '🐸', name: 'הצפרדע' }, { e: '🐔', name: 'התרנגולת' }, { e: '🐢', name: 'הצב' }, { e: '🦁', name: 'האריה' },
];

// The 🚩 anchor defines where the queue starts — string order lays out
// right-to-left in the RTL page, matching how a Hebrew-reading child scans.
function makeOrdinalPosition(maxOrdinal = 6) {
  const n = randInt(4, Math.min(6, maxOrdinal));
  const row = shuffle(ORDINAL_ITEMS).slice(0, n);
  const line = ['🚩', ...row.map(i => i.e)].join(' ');
  const idx = randInt(0, Math.min(n, maxOrdinal) - 1);
  if (pick([true, false])) {
    const correct = row[idx];
    const wrong = shuffle(row.filter((_, i) => i !== idx)).slice(0, 3);
    return {
      type: 'ordinal_position', difficulty: 2, dir: 'rtl',
      question: `מי עומד ${ORDINAL_NAMES[idx]} בתור? מתחילים לספור מהדגל!`,
      displayShape: line,
      answer: correct.e,
      options: shuffle([correct, ...wrong]).map(i => i.e),
      hint: `מצביעים על הדגל 🚩 וסופרים: ראשון, שני, שלישי...`,
    };
  }
  const target = row[idx];
  const optIdx = new Set([idx]);
  while (optIdx.size < Math.min(4, n)) optIdx.add(randInt(0, n - 1));
  return {
    type: 'ordinal_position', difficulty: 2, dir: 'rtl',
    question: `באיזה מקום בתור עומד ${target.name}? מתחילים מהדגל!`,
    displayShape: line,
    answer: ORDINAL_NAMES[idx],
    options: shuffle([...optIdx]).map(i => ORDINAL_NAMES[i]),
    hint: `סופרים מהדגל 🚩: ראשון, שני, שלישי...`,
  };
}

// ── Counting with distractors (עקרון ההפשטה + נתונים מיותרים בכיתה א) ───────
const CATEGORY_POOLS = [
  { name: 'פירות', items: [{ e: '🍎', n: 'תפוחים' }, { e: '🍌', n: 'בננות' }, { e: '🍓', n: 'תותים' }, { e: '🍇', n: 'ענבים' }] },
  { name: 'חיות', items: [{ e: '🐶', n: 'כלבים' }, { e: '🐱', n: 'חתולים' }, { e: '🐰', n: 'ארנבים' }] },
  { name: 'כלי רכב', items: [{ e: '🚗', n: 'מכוניות' }, { e: '🚌', n: 'אוטובוסים' }, { e: '🚲', n: 'זוגות אופניים' }] },
  { name: 'צעצועים', items: [{ e: '⚽', n: 'כדורים' }, { e: '🧸', n: 'דובים' }, { e: '🎈', n: 'בלונים' }] },
];

function twoLines(arr) {
  const mid = Math.ceil(arr.length / 2);
  return arr.slice(0, mid).join(' ') + '\n' + arr.slice(mid).join(' ');
}

function makeCountCategory(hard = false) {
  const [catA, catB] = shuffle(CATEGORY_POOLS).slice(0, 2);
  if (!hard) {
    // Count one item type among cross-category distractors.
    const target = pick(catA.items);
    const t = randInt(2, 6);
    const distractors = Array.from({ length: randInt(2, 5) }, () => pick(catB.items).e);
    return {
      type: 'count_category', difficulty: 2, dir: 'rtl',
      question: `כמה ${target.n} יש בתמונה?`,
      displayShape: twoLines(shuffle([...Array(t).fill(target.e), ...distractors])),
      answer: t,
      hint: `סופרים רק ${target.e} ומתעלמים מכל השאר`,
    };
  }
  // Harder: count a CATEGORY (union of two members) among another category.
  const members = shuffle(catA.items).slice(0, 2);
  const counts = members.map(() => randInt(1, 3));
  const total = counts[0] + counts[1];
  const noise = Array.from({ length: randInt(2, 4) }, () => pick(catB.items).e);
  const all = shuffle([...Array(counts[0]).fill(members[0].e), ...Array(counts[1]).fill(members[1].e), ...noise]);
  return {
    type: 'count_category', difficulty: 2, dir: 'rtl',
    question: `כמה ${catA.name} יש בתמונה?`,
    displayShape: twoLines(all),
    answer: total,
    hint: `${catA.name} זה גם ${members[0].e} וגם ${members[1].e}`,
  };
}

// ── Days of the week (מושגי זמן מחזוריים — תכנית הגן) ────────────────────────
const WEEK_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dayName = (i) => `יום ${WEEK_DAYS[(i + 7) % 7]}`;

function makeDaysOfWeek() {
  const optionsAround = (correct) => {
    const set = new Set([correct]);
    while (set.size < 4) set.add(randInt(0, 6));
    return shuffle([...set]).map(dayName);
  };
  const variant = pick(['after', 'before', 'tomorrow', 'ordinal', 'rest']);
  if (variant === 'rest') {
    return {
      type: 'days_of_week', difficulty: 1, dir: 'rtl',
      question: 'איזה יום הוא יום המנוחה בשבוע?',
      answer: 'יום שבת',
      options: shuffle(['יום שבת', 'יום ראשון', 'יום שלישי', 'יום שישי']),
      hint: 'היום שבו נחים ולא הולכים לגן',
    };
  }
  if (variant === 'ordinal') {
    const i = randInt(0, 6);
    return {
      type: 'days_of_week', difficulty: 2, dir: 'rtl',
      question: `מה היום ה${ORDINAL_NAMES[i]} בשבוע?`,
      answer: dayName(i),
      options: optionsAround(i),
      hint: 'מתחילים לספור מיום ראשון',
    };
  }
  const i = randInt(0, 6);
  if (variant === 'before') {
    return {
      type: 'days_of_week', difficulty: 1, dir: 'rtl',
      question: `איזה יום בא לפני ${dayName(i)}?`,
      answer: dayName(i - 1),
      options: optionsAround((i + 6) % 7),
      hint: 'לפני יום ראשון בא שבת',
    };
  }
  return {
    type: 'days_of_week', difficulty: 1, dir: 'rtl',
    question: variant === 'after'
      ? `איזה יום בא אחרי ${dayName(i)}?`
      : `אם היום ${dayName(i)}, איזה יום יהיה מחר?`,
    answer: dayName(i + 1),
    options: optionsAround((i + 1) % 7),
    hint: 'אחרי שבת מתחילים שוב מיום ראשון',
  };
}

// ── Clock reading (שעון — כיתה א: שעות שלמות; כיתה ב: גם חצאים ומשך) ────────
const CLOCK_WHOLE = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];
const CLOCK_HALF = ['🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'];
const clockEmoji = (h, half) => (half ? CLOCK_HALF : CLOCK_WHOLE)[h - 1];

// Clock questions carry `displayClock: {h, m}` — the client draws a real
// analog clock (numbers 1-12 + hands). `displayShape` keeps the emoji as a
// fallback so old snapshots in the review/mistakes stores still render.
function makeClockReading({ halves = false, duration = false } = {}) {
  if (duration && pick([true, false])) {
    const start = randInt(1, 9);
    const len = randInt(1, 3);
    const lenText = len === 1 ? 'שעה אחת' : len === 2 ? 'שעתיים' : `${len} שעות`;
    return {
      type: 'clock_reading', difficulty: 3, dir: 'rtl',
      question: `החוג התחיל בשעה ${start}:00 ונמשך ${lenText}. באיזו שעה הוא הסתיים?`,
      displayClock: { h: start, m: 0 },
      displayShape: clockEmoji(start, false),
      answer: start + len,
      hint: `מתקדמים ${len} שעות קדימה מ-${start}`,
    };
  }
  const h = randInt(1, 12);
  const half = halves && pick([true, false]);
  const label = (hh, hf) => `${hh}:${hf ? '30' : '00'}`;
  if (pick([true, false])) {
    const correct = label(h, half);
    const wrong = new Set();
    while (wrong.size < 3) {
      const w = pick([
        label((h % 12) + 1, half),
        label(h === 1 ? 12 : h - 1, half),
        label(h, !half),
        label(randInt(1, 12), pick([true, false])),
      ]);
      if (w !== correct) wrong.add(w);
    }
    return {
      type: 'clock_reading', difficulty: 2, dir: 'rtl',
      question: 'מה השעה בשעון?',
      displayClock: { h, m: half ? 30 : 0 },
      displayShape: clockEmoji(h, half),
      answer: correct,
      options: shuffle([correct, ...wrong]),
      hint: half ? 'כשהמחוג הארוך למטה — זה "וחצי"' : 'כשהמחוג הארוך למעלה — שעה עגולה',
      dedupKey: `clock|read|${correct}`,
    };
  }
  // "Which clock shows H?": every option is DRAWN as a clock (optionClocks);
  // the option values are the time labels so answers stay plain strings.
  const hourSet = new Set([h]);
  while (hourSet.size < 4) hourSet.add(randInt(1, 12));
  const optionClocks = {};
  for (const x of hourSet) optionClocks[label(x, half)] = { h: x, m: half ? 30 : 0 };
  return {
    type: 'clock_reading', difficulty: 2, dir: 'rtl',
    question: `איזה שעון מראה את השעה ${h}${half ? ' וחצי' : ':00'}?`,
    answer: label(h, half),
    options: shuffle([...hourSet]).map(x => label(x, half)),
    optionClocks,
    hint: 'המחוג הקצר מראה את השעה',
  };
}

// ── Money (כסף — קישוריות חינוך פיננסי בתכנית א-ב; שקלים שלמים בלבד) ────────
const MONEY_DENOMS = [
  { v: 1, e: '🪙' }, { v: 2, e: '🪙' }, { v: 5, e: '🪙' }, { v: 10, e: '🪙' },
  { v: 20, e: '💵' }, { v: 50, e: '💵' }, { v: 100, e: '💵' },
];

function makeMoneyCount({ gan = false } = {}) {
  const variant = gan ? pick(['count', 'missing']) : pick(['count', 'missing', 'change', 'compare']);
  if (variant === 'count') {
    const pool = MONEY_DENOMS.filter(d => d.v <= (gan ? 10 : 100));
    const maxSum = gan ? 20 : 110;
    const items = [];
    let sum = 0;
    for (let i = 0, n = randInt(2, gan ? 3 : 5); i < n; i++) {
      const fits = pool.filter(x => sum + x.v <= maxSum);
      if (!fits.length) break;
      const d = pick(fits);
      items.push(d);
      sum += d.v;
    }
    const display = items.map(d => `${d.e} ${d.v} ש״ח`).join('\n');
    return {
      type: 'money_count', difficulty: 2, dir: 'rtl',
      question: 'כמה כסף יש בארנק?',
      displayShape: display,
      answer: sum,
      hint: 'מחברים את כל המטבעות והשטרות',
      dedupKey: `money|count|${display}`,
    };
  }
  if (variant === 'missing') {
    const price = gan ? randInt(5, 20) : randInt(20, 100);
    const have = randInt(1, price - 1);
    return {
      type: 'money_count', difficulty: 2, dir: 'rtl',
      question: `צעצוע עולה ${price} שקלים ויש לך ${have} שקלים. כמה שקלים חסרים לך?`,
      displayShape: '🧸',
      answer: price - have,
      hint: `${price} פחות ${have}`,
    };
  }
  if (variant === 'change') {
    const bill = pick([20, 50, 100]);
    const price = randInt(bill - 18, bill - 1);
    return {
      type: 'money_count', difficulty: 3, dir: 'rtl',
      question: `קנית גלידה ב-${price} שקלים ושילמת בשטר של ${bill} שקלים. כמה עודף תקבל?`,
      displayShape: '🍦',
      answer: bill - price,
      hint: `${bill} פחות ${price}`,
    };
  }
  // compare: more coins is not always more money (explicit curriculum note)
  let na, va, nb, vb;
  do {
    na = randInt(2, 5); va = pick([2, 5, 10]);
    nb = randInt(2, 5); vb = pick([1, 2, 5]);
  } while (na * va === nb * vb);
  const optA = `${na} מטבעות של ${va} שקלים`;
  const optB = `${nb} מטבעות של ${vb} שקלים`;
  return {
    type: 'money_count', difficulty: 3, dir: 'rtl',
    question: 'למי יש יותר כסף?',
    displayShape: '🪙',
    answer: na * va > nb * vb ? optA : optB,
    options: shuffle([optA, optB]),
    hint: 'הרבה מטבעות זה לא תמיד הרבה כסף — כופלים ובודקים',
    dedupKey: `money|compare|${optA}|${optB}`,
  };
}

// ── Pictogram reading (חקר נתונים — נושא מלא בתכנית כיתה ב) ─────────────────
const PICTO_ITEMS = [
  { e: '🍎', n: 'תפוח' }, { e: '🍌', n: 'בננה' }, { e: '🍓', n: 'תות' },
  { e: '⚽', n: 'כדורגל' }, { e: '🍦', n: 'גלידה' }, { e: '🐶', n: 'כלב' },
];

function makePictogram({ gan = false } = {}) {
  const cats = shuffle(PICTO_ITEMS).slice(0, gan ? 2 : 3);
  const max = gan ? 5 : 7;
  let counts;
  do { counts = cats.map(() => randInt(1, max)); } while (new Set(counts).size !== counts.length);
  const rows = cats.map((c, i) => `${c.n}: ${Array(counts[i]).fill(c.e).join('')}`).join('\n');
  const base = {
    type: 'pictogram_read', difficulty: 2, dir: 'rtl',
    displayShape: rows,
  };
  const variant = gan ? pick(['value', 'max']) : pick(['value', 'max', 'diff', 'total']);
  if (variant === 'value') {
    const i = randInt(0, cats.length - 1);
    return { ...base, question: `ילדים בחרו את מה שהם הכי אוהבים. כמה ילדים בחרו ${cats[i].n}?`, answer: counts[i], hint: `סופרים את השורה של ${cats[i].n}` };
  }
  if (variant === 'max') {
    const maxIdx = counts.indexOf(Math.max(...counts));
    return {
      ...base,
      question: 'מה הכי אהוב על הילדים בגרף?',
      answer: cats[maxIdx].e,
      options: shuffle(cats.map(c => c.e)),
      hint: 'מחפשים את השורה הארוכה ביותר',
      dedupKey: `picto|max|${rows}`,
    };
  }
  if (variant === 'diff') {
    const [i, j] = counts[0] >= counts[1] ? [0, 1] : [1, 0];
    return { ...base, question: `בכמה ילדים ${cats[i].n} מנצח את ${cats[j].n}?`, answer: counts[i] - counts[j], hint: 'מחסרים את הקצר מהארוך' };
  }
  return { ...base, question: 'כמה ילדים ענו בסך הכול?', answer: counts.reduce((a, b) => a + b, 0), hint: 'מחברים את כל השורות', difficulty: 3, dedupKey: `picto|total|${rows}` };
}

// ── Multiplication & division facts (לוחות 2, 4, 5, 10 — יעד סוף כיתה ב) ────
function makeMulDiv() {
  const a = pick([2, 4, 5, 10]);
  const b = randInt(1, 10);
  const variant = pick(['array', 'fact', 'div', 'share', 'missing', 'half']);
  if (variant === 'array') {
    const r = pick([2, 4, 5]);
    const c = randInt(2, 6);
    const item = pick(COUNT_ITEMS);
    return {
      type: 'mul_div_facts', difficulty: 3, dir: 'rtl',
      question: `יש ${r} שורות של ${c} ${item.name}. כמה ${item.name} יש בסך הכול?`,
      displayShape: Array(r).fill(Array(c).fill(item.e).join(' ')).join('\n'),
      answer: r * c,
      hint: `${Array(r).fill(c).join(' ועוד ')}`,
    };
  }
  if (variant === 'fact') {
    return {
      type: 'mul_div_facts', difficulty: 3, dir: 'ltr',
      question: `${a} × ${b} = ?`, answer: a * b,
      hint: `${a} כפול ${b} זה כמו ${b} ועוד ${b}, ${a} פעמים`,
      dedupKey: `mul|${a}x${b}`,
    };
  }
  if (variant === 'div') {
    const bb = Math.max(1, b);
    return {
      type: 'mul_div_facts', difficulty: 3, dir: 'ltr',
      question: `${a * bb} : ${a} = ?`, answer: bb,
      hint: `כמה פעמים ${a} נכנס ב-${a * bb}?`,
      dedupKey: `div|${a * bb}:${a}`,
    };
  }
  if (variant === 'share') {
    const kids = pick([2, 4, 5]);
    const each = randInt(1, 6);
    return {
      type: 'mul_div_facts', difficulty: 3, dir: 'rtl',
      question: `${kids * each} בלונים 🎈 מחלקים שווה בשווה בין ${kids} ילדים. כמה בלונים יקבל כל ילד?`,
      answer: each,
      hint: `מחלקים ${kids * each} ל-${kids} קבוצות שוות`,
    };
  }
  if (variant === 'missing') {
    const bb = Math.max(1, b);
    return {
      type: 'mul_div_facts', difficulty: 3, dir: 'ltr',
      question: `${a} × ? = ${a * bb}`, answer: bb,
      hint: `כמה פעמים ${a} כדי להגיע ל-${a * bb}?`,
      dedupKey: `mulmiss|${a}x${bb}`,
    };
  }
  const n = 2 * randInt(1, 10);
  return {
    type: 'mul_div_facts', difficulty: 3, dir: 'rtl',
    question: `כמה זה חצי מ-${n}?`,
    answer: n / 2,
    hint: `חצי זה לחלק ל-2 חלקים שווים`,
    dedupKey: `half|${n}`,
  };
}

// Stage plans. Each entry receives the operation focus ('add'|'sub'|'mix')
// and returns an array of generator thunks (one per question in the session).
// gan_to_a sessions have 12 questions; a_to_b sessions have 20.
const PREP_PLANS = {
  gan_to_a: [
    // Stage 1 – מנייה, כמויות וצורות
    () => [
      () => makeCountObjects(6), () => makeCountObjects(6), () => makeCountObjects(6),
      makeCompareQuantities, makeCompareQuantities,
      makePattern, makePattern,
      () => GENERATORS.geo_identify(), () => GENERATORS.geo_identify(),
      () => makeBiggestNumber(6), () => makeSmallestNumber(6),
      makeGeoCount,
    ],
    // Stage 2 – מספרים עד 10
    (op) => [
      () => makeCountObjects(10), () => makeCountObjects(10),
      () => makeNumberAfter(10), () => makeNumberBefore(10),
      () => makeCompareLeveled(10), () => makeCompareLeveled(10),
      ...(op === 'sub'
        ? [() => makeVisualSub(5), () => makeVisualSub(5)]
        : op === 'add'
          ? [() => makeVisualAdd(5), () => makeVisualAdd(5)]
          : [() => makeVisualAdd(5), () => makeVisualSub(5)]),
      makePattern,
      () => GENERATORS.geo_sides(),
      () => makeBiggestNumber(10),
      () => makeOrdinalPosition(6),
      () => makeCountCategory(false),
      makeDaysOfWeek,
    ],
    // Stage 3 – חיבור וחיסור עם ציורים עד 10
    (op) => [
      ...(op === 'add'
        ? Array(6).fill(() => makeVisualAdd(10))
        : op === 'sub'
          ? Array(6).fill(() => makeVisualSub(10))
          : [() => makeVisualAdd(10), () => makeVisualAdd(10), () => makeVisualAdd(10),
             () => makeVisualSub(10), () => makeVisualSub(10), () => makeVisualSub(10)]),
      // "complete to 10" is addition – swap it out of subtraction-only sessions
      () => (op === 'sub' ? makeVisualSub(10) : makeComplete(10)),
      () => (pick([true, false]) ? makeNumberAfter(10) : makeNumberBefore(10)),
      () => makeCompareLeveled(10),
      () => makeSequenceLeveled(10),
      () => GENERATORS.geo_corners(),
      () => makeOrdinalPosition(10),
      () => makeCountCategory(true),
      makeDaysOfWeek,
      () => makePictogram({ gan: true }),
    ],
    // Stage 4 – מוכנות לכיתה א׳ (ספרות בלבד עד 10)
    (op) => [
      ...(op === 'add'
        ? Array(6).fill(() => makeAddition(10))
        : op === 'sub'
          ? Array(6).fill(() => makeSubtraction(10))
          : [() => makeAddition(10), () => makeAddition(10), () => makeAddition(10),
             () => makeSubtraction(10), () => makeSubtraction(10), () => makeSubtraction(10)]),
      () => (op === 'sub' ? makeSubtraction(10) : makeComplete(10)),
      () => makeSequenceLeveled(20),
      () => makeCompareLeveled(20),
      () => (op === 'sub' ? makeWordSubLeveled(10) : makeWordAddLeveled(10)),
      geoGan,
      () => makeClockReading(),                 // שעות שלמות — מוכנות לכיתה א
      () => makeMoneyCount({ gan: true }),      // סכומים קטנים עד 20 ש"ח
      () => makePictogram({ gan: true }),
      makeDaysOfWeek,
    ],
  ],
  a_to_b: [
    // Stage 1 – ביסוס כיתה א׳ (חיבור/חיסור עד 20, מבנה עשרוני)
    (op) => [
      ...(op === 'add'
        ? [GENERATORS.addition_20, GENERATORS.addition_20, GENERATORS.addition_20,
           GENERATORS.addition_20, GENERATORS.addition_20, GENERATORS.addition_20]
        : op === 'sub'
          ? [GENERATORS.subtraction_20, GENERATORS.subtraction_20, GENERATORS.subtraction_20,
             GENERATORS.subtraction_20, GENERATORS.subtraction_20, GENERATORS.subtraction_20]
          : [GENERATORS.addition_20, GENERATORS.addition_20, GENERATORS.addition_20,
             GENERATORS.subtraction_20, GENERATORS.subtraction_20, GENERATORS.subtraction_20]),
      ...(op === 'sub'
        ? [GENERATORS.subtraction_20, GENERATORS.subtraction_30]
        : [GENERATORS.complete_10, GENERATORS.complete_20]),
      tensOnes, tensOnes, tensOnes,
      () => makeCompareLeveled(100),
      skipCount, skipCount, () => makeSequenceLeveled(50),
      () => (op === 'sub' ? makeWordSubLeveled(20) : makeWordAddLeveled(20)),
      () => (op === 'add' ? makeWordAddLeveled(20) : makeWordSubLeveled(20)),
      geoGrade2, geoGrade2,
      () => makeOrdinalPosition(10),
      makeDaysOfWeek,
    ],
    // Stage 2 – עשרות שלמות ושכנים בתחום ה-100
    (op) => [
      ...(op === 'add'
        ? [makeRoundTensAdd, makeRoundTensAdd, makeRoundTensAdd, makeRoundTensAdd]
        : op === 'sub'
          ? [makeRoundTensSub, makeRoundTensSub, makeRoundTensSub, makeRoundTensSub]
          : [makeRoundTensAdd, makeRoundTensAdd, makeRoundTensSub, makeRoundTensSub]),
      ...(op === 'add'
        ? [GENERATORS.addition_20, GENERATORS.addition_20]
        : op === 'sub'
          ? [GENERATORS.subtraction_20, GENERATORS.subtraction_20]
          : [GENERATORS.addition_20, GENERATORS.subtraction_20]),
      () => (op === 'sub' ? makeMissingSub(20) : op === 'add' ? makeMissingAdd(20) : pick([makeMissingAdd, makeMissingSub])(20)),
      () => (op === 'add' ? makeMissingAdd(20) : op === 'sub' ? makeMissingSub(20) : pick([makeMissingAdd, makeMissingSub])(20)),
      () => makeNumberAfter(100), () => makeNumberBefore(100),
      tensOnes, tensOnes,
      skipCount,
      () => makeCompareLeveled(100),
      () => (op === 'sub' ? makeWordSubLeveled(30) : makeWordAddLeveled(30)),
      () => (op === 'add' ? makeWordAddLeveled(30) : makeWordSubLeveled(30)),
      geoGrade2, geoGrade2,
      () => makeClockReading(),                 // שעות שלמות
      () => makeMoneyCount(),
      () => makePictogram(),
    ],
    // Stage 3 – חיבור וחיסור דו-ספרתי ללא המרה
    (op) => [
      ...(op === 'add'
        ? [makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd]
        : op === 'sub'
          ? [makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub]
          : [makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub]),
      () => (op === 'sub' ? makeMissingSub(30) : op === 'add' ? makeMissingAdd(30) : pick([makeMissingAdd, makeMissingSub])(30)),
      () => (op === 'add' ? makeMissingAdd(30) : op === 'sub' ? makeMissingSub(30) : pick([makeMissingAdd, makeMissingSub])(30)),
      () => makeEvenOdd(20),
      tensOnes,
      skipCount,
      () => (op === 'sub' ? makeWordSubLeveled(30) : makeWordAddLeveled(30)),
      () => (op === 'add' ? makeWordAddLeveled(30) : makeWordSubLeveled(30)),
      geoGrade2,
      () => makeClockReading({ halves: true }), // חצאי שעות — כיתה ב
      () => makeMoneyCount(),
      () => makePictogram(),
      makeMulDiv, makeMulDiv,                   // לוחות 2, 4, 5, 10
    ],
    // Stage 4 – לקראת כיתה ב׳ (חיבור חוזר, היכרות עם מאות)
    (op) => [
      ...(op === 'add'
        ? [makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitAdd]
        : op === 'sub'
          ? [makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub, makeTwoDigitSub]
          : [makeTwoDigitAdd, makeTwoDigitAdd, makeTwoDigitSub, makeTwoDigitSub]),
      makeRepeatedAdd,
      GENERATORS.hundreds_in_number, GENERATORS.build_hundreds, GENERATORS.skip_count_100,
      () => (op === 'sub' ? makeMissingSub(50) : op === 'add' ? makeMissingAdd(50) : pick([makeMissingAdd, makeMissingSub])(50)),
      () => (op === 'add' ? makeMissingAdd(50) : op === 'sub' ? makeMissingSub(50) : pick([makeMissingAdd, makeMissingSub])(50)),
      () => (op === 'sub' ? makeWordSubLeveled(50) : makeWordAddLeveled(50)),
      () => (op === 'add' ? makeWordAddLeveled(50) : makeWordSubLeveled(50)),
      GENERATORS.expanded_form,
      () => makeSequenceLeveled(100),
      geoGrade2,
      makeMulDiv, makeMulDiv, makeMulDiv,       // כפל וחילוק — יעד כיתה ב
      () => makeClockReading({ halves: true, duration: true }),
      () => makeMoneyCount(),
      () => makePictogram(),
    ],
  ],
};

/**
 * A prep-track session (מסלול הכנה): `track` is 'gan_to_a' or 'a_to_b',
 * `stage` is 1-based and climbs automatically as the child succeeds on
 * consecutive days. Falls back to the closest existing stage when out of
 * range so stale data can never crash a session.
 */
export function generatePrepMath(track, stage, reviewExercises = [], operation = 'mix', allowMulDiv = false) {
  const stages = PREP_PLANS[track] || PREP_PLANS.a_to_b;
  const idx = Math.min(Math.max(1, Number(stage) || 1), stages.length) - 1;
  const op = MATH_OPERATIONS.includes(operation) ? operation : 'mix';
  let plan = stages[idx](op);
  // Multiplication & division (and the "repeated addition → times tables"
  // primer) stay hidden until the parent flips the "already learned mul/div"
  // switch. Their slots become two-digit add/sub the child can already do, so
  // the session keeps its full length.
  if (!allowMulDiv) {
    const sub = () => (op === 'add' ? makeTwoDigitAdd()
      : op === 'sub' ? makeTwoDigitSub()
      : pick([makeTwoDigitAdd, makeTwoDigitSub])());
    plan = plan.map(g => (g === makeMulDiv || g === makeRepeatedAdd) ? sub : g);
  }
  const reviewCount = Math.min(reviewExercises.length, 3);
  // Give up leading plan slots to make room for resurfaced review questions.
  for (let i = 0; i < reviewCount && plan.length; i++) plan.shift();
  return assembleSession(plan, reviewExercises, reviewCount);
}

// ═══ Topic practice (תרגול נושא) ════════════════════════════════════════════
// The pre-session picker offers, next to חיבור/חיסור/מעורב, every sub-topic
// of the child's curriculum (שעון, שקלים, צורות...). Picking one produces a
// short focused session on just that topic.

export const MATH_TOPICS = {
  place_value: { label: 'עשרות ואחדות', icon: '🧱' },
  sequences:   { label: 'סדרות ודילוגים', icon: '🐰' },
  compare:     { label: 'השוואת מספרים', icon: '⚖️' },
  missing:     { label: 'מספר חסר', icon: '❓' },
  geometry:    { label: 'צורות', icon: '🔺' },
  clock:       { label: 'שעון', icon: '🕒' },
  money:       { label: 'שקלים', icon: '💰' },
  data:        { label: 'גרף תמונות', icon: '📊' },
  week_days:   { label: 'ימי השבוע', icon: '📅' },
  muldiv:      { label: 'כפל וחילוק', icon: '✖️' },
};

const TOPIC_SESSION_SIZE = 12;

/**
 * Which topics fit a child. ctx: {track, stage, level, allowMulDiv}.
 * Prep-track kids get the full curriculum list; level-based kids get the
 * number-work topics that respect their ceiling; mixed kids get the families
 * of the mixed curriculum.
 */
export function topicsForChild(ctx = {}) {
  if (ctx.track) {
    const t = ['place_value', 'sequences', 'compare', 'missing', 'geometry', 'clock', 'money', 'data', 'week_days'];
    if (ctx.allowMulDiv) t.push('muldiv');
    return t;
  }
  if (ctx.level) return ['compare', 'sequences', 'missing'];
  return ['place_value', 'sequences', 'compare', 'geometry'];
}

// A pool of generator thunks for one topic, tuned to the child's range.
function topicPool(topic, ctx = {}) {
  const gan = ctx.track === 'gan_to_a';
  const hard = ctx.track === 'a_to_b';
  const stage = ctx.stage || 1;
  const L = ctx.level || null;

  switch (topic) {
    case 'place_value': {
      const pool = [GENERATORS.tens_in_number, GENERATORS.ones_in_number, GENERATORS.build_tens_ones, GENERATORS.expanded_form];
      if (hard && stage >= 4) pool.push(GENERATORS.hundreds_in_number, GENERATORS.build_hundreds);
      return pool;
    }
    case 'sequences': {
      if (L) return [() => makeSequenceLeveled(L)];
      if (gan) return [() => makeSequenceLeveled(20), makePattern];
      return [() => makeSequenceLeveled(100), GENERATORS.skip_count, GENERATORS.skip_count_back];
    }
    case 'compare': {
      if (L) return [() => makeCompareLeveled(L), () => makeNumberAfter(L), () => makeNumberBefore(L)];
      if (gan) return [makeCompareQuantities, () => makeCompareLeveled(20), () => makeBiggestNumber(20), () => makeSmallestNumber(20), () => makeNumberAfter(20), () => makeNumberBefore(20)];
      return [() => makeCompareLeveled(100), () => makeBiggestNumber(100), () => makeSmallestNumber(100), () => makeNumberAfter(100), () => makeNumberBefore(100), () => makeEvenOdd(20)];
    }
    case 'missing': {
      const max = L ? Math.max(10, L) : gan ? 10 : 30;
      return [() => makeMissingAdd(max), () => makeMissingSub(max)];
    }
    case 'geometry':
      if (gan) return [makeGeoCount, GENERATORS.geo_identify];
      return [GENERATORS.geo_identify, GENERATORS.geo_sides, GENERATORS.geo_corners, GENERATORS.geo_count_sides_compare];
    case 'clock':
      return [() => makeClockReading(hard ? { halves: stage >= 3, duration: stage >= 4 } : {})];
    case 'money':
      return [() => makeMoneyCount({ gan: !hard })];
    case 'data':
      return [() => makePictogram({ gan: !hard })];
    case 'week_days':
      return [makeDaysOfWeek];
    case 'muldiv':
      return ctx.allowMulDiv ? [makeMulDiv, makeMulDiv, makeRepeatedAdd] : null;
    default:
      return null;
  }
}

/**
 * A short session focused on one topic (12 questions). Unknown topics fall
 * back to the child's regular session so a stale client can never crash.
 *
 * `opts.workbook` builds the practice part of an interactive workbook:
 * 10 questions ordered easy→hard, with the first 3 marked `guided` (the
 * client shows their hint from the start — תרגול מודרך before independent).
 */
export function generateTopicMath(topic, ctx = {}, reviewExercises = [], opts = {}) {
  const pool = topicPool(topic, ctx);
  if (!pool || !pool.length) {
    return ctx.track
      ? generatePrepMath(ctx.track, ctx.stage || 1, reviewExercises, 'mix', ctx.allowMulDiv)
      : generateMathExercises({}, reviewExercises, ctx.level || null, 'mix');
  }
  // Round-robin over the pool (not random picks) so every question type in
  // the topic appears evenly — small-domain types don't run out of variants.
  const size = opts.workbook ? 10 : TOPIC_SESSION_SIZE;
  const plan = shuffle(Array.from({ length: size }, (_, i) => pool[i % pool.length]));
  const session = assembleSession(plan, [], 0);
  if (!opts.workbook) return session;
  // Workbook progression: easy first, hard last; guided openers.
  return session
    .slice()
    .sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2))
    .map((ex, i) => ({ ...ex, id: i + 1, guided: i < 3 }));
}

/**
 * Public entry point. `level` (10..100) produces a focused
 * addition/subtraction session up to that ceiling; null/undefined keeps the
 * original mixed grade-1-2 curriculum. `operation` ('add' | 'sub' | 'mix')
 * lets the child pick whether to practise addition, subtraction, or both.
 */
export const MATH_OPERATIONS = ['mix', 'add', 'sub'];

export function generateMathExercises(weakness = {}, reviewExercises = [], level = null, operation = 'mix') {
  const op = MATH_OPERATIONS.includes(operation) ? operation : 'mix';
  if (level && MATH_LEVELS.includes(level)) {
    return generateLeveledMath(level, reviewExercises, op);
  }
  return generateMixedMath(weakness, reviewExercises, op);
}
