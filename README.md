# KidsLearn 🌟

אפליקציית לימוד יומית לילדים — חיבור, חיסור, גאומטריה ועברית. כוללת דוחות מייל יומיים להורים, מערכת חזרה אוטומטית על שאלות שטועים בהן, ו-TTS עברי מובנה.

## ⬇️ הורדה והתקנה (למשתמשים)

הורידו את הגרסה למערכת ההפעלה שלכם מ-[**דף ההורדות (Releases)**](https://github.com/deanavraham-bit/kidslearn/releases/latest):

| מערכת הפעלה | קובץ להורדה | התקנה |
|---|---|---|
| 🪟 **Windows** | `KidsLearn.Setup.x.x.x.exe` | כפול קליק → Next → Install |
| 🍎 **macOS** | `KidsLearn-x.x.x.dmg` | פתחו → גררו ל-Applications |
| 🐧 **Linux** | `KidsLearn-x.x.x.AppImage` | `chmod +x` → כפול קליק |

### התקנה בפקודה אחת — `kidslearn`

מתקינים פעם אחת את הפקודה, ומאז מספיק להקליד `kidslearn` בטרמינל: נפתח תפריט
לבחירת מערכת ההפעלה, והקובץ הנכון מתוך הגרסה האחרונה יורד ומותקן.

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/deanavraham-bit/kidslearn/main/cli/install-command.ps1 | iex
```

**macOS / Linux (Terminal):**
```bash
curl -fsSL https://raw.githubusercontent.com/deanavraham-bit/kidslearn/main/cli/install-command.sh | bash
```

לאחר מכן, בטרמינל חדש:

```
kidslearn
```

```
  איזו מערכת הפעלה יש לך?

    [1] Windows  (10 / 11)
    [2] macOS - Apple Silicon (M1/M2/M3/M4)
    [3] macOS - Intel
    [4] Linux  (AppImage - כל הפצה)
    [5] Linux  (Debian / Ubuntu .deb)
    [6] Android  (APK - טלפון/טאבלט)
    [0] יציאה
```

אפשר גם לדלג על התפריט:
`kidslearn -Os win` (Windows) או `kidslearn mac-arm` (macOS/Linux) —
ערכים אפשריים: `win`, `mac-arm`, `mac-intel`, `linux`, `deb`, `android`.

> התקנה ישירה בלי הפקודה (הורדה + הפעלה מיידית):
> `irm .../install.ps1 | iex` ב-Windows, `curl -fsSL .../install.sh | bash` ב-Mac/Linux.

> כל ההגדרות (כולל סיסמת המייל) נשמרות מקומית בכל מחשב — אין סודות בקבצי ההתקנה.

---

## דרישות מערכת (לפיתוח / הרצה מהמקור)

- **Windows 10 / 11**
- **Node.js 20+** — להוריד מ-<https://nodejs.org/>
- **Git** — להוריד מ-<https://git-scm.com/>
- **Microsoft Edge** (קיים כברירת מחדל ב-Windows) או Chrome

## התקנה במחשב חדש

```powershell
# 1. שכפל את הריפו
git clone https://github.com/<USERNAME>/kidslearn.git
cd kidslearn

# 2. התקן תלויות (קליינט + שרת + שורש)
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 3. בנה את הקליינט
npm run build:client

# 4. צור קונפיג ראשוני (העתק את הדוגמה)
copy server\data\config.sample.json server\data\config.json
```

## הפעלה

### אופציה א — קליק על הקיצור (מומלץ)
לחיצה כפולה על **`launch.vbs`** — השרת מתחיל, ו-Edge נפתח ב-app mode (חלון נקי ללא טאבים).

### אופציה ב — בנייה כאפליקציה (EXE)
```powershell
npm run dist
```
נוצר `dist-electron\KidsLearn Setup <version>.exe` — התקנה רגילה של Windows שיוצרת קיצור בשולחן העבודה.

### אופציה ג — מצב פיתוח
```powershell
npm run dev
```

## הגדרת מייל (אופציונלי)

האפליקציה שולחת דוח אוטומטי להורים אחרי כל מפגש. כדי להפעיל:

1. צור **App Password** של Gmail:
   - <https://myaccount.google.com/apppasswords> (דרוש אימות דו-שלבי פעיל)
   - שם: `KidsLearn`
   - העתק את 16 האותיות שגוגל יוצרת
2. פתח את האפליקציה → **הורים** → **📧 הגדרות מייל**:
   - **כתובת מייל שולחת**: ה-Gmail שלך
   - **סיסמת אפליקציה**: 16 האותיות מ-Google
   - **נמענים**: כתובות ההורים, מופרדים בפסיק
   - **מתג** למעלה: פעיל
3. לחיצה על **📤 שלח מייל בדיקה** לוודא שזה עובד.

## מבנה הפרויקט

```
.
├── client/              # React + Vite
├── server/              # Node + Express + nodemailer
│   ├── exercises/       # מחוללי תרגילים (חשבון / עברית)
│   └── data/            # נתונים מקומיים (gitignored)
├── electron/            # עטיפת Electron ל-EXE
├── launch.vbs           # מפעיל מהיר ב-Edge app mode
└── package.json
```

## נתונים פרטיים

הקבצים האלה לא ניכנסים ל-git:
- `server/data/config.json` — סיסמת SMTP וכתובות מייל
- `server/data/history.json` — היסטוריית תרגילים של הילדים
- `server/data/review.json` — תור חזרה לשגיאות

הם נשארים רק במחשב המקומי שלך.
