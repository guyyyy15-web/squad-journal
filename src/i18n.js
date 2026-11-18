// UI strings. English is the default; Hebrew is a switch (cookie sj_lang). Award and moment titles are
// English in both languages (they read like military commendations); their descriptions are translated.

export const LANGS = ['en', 'he'];
export const langOf = (req) => {
  const m = /(?:^|;\s*)sj_lang=(en|he)/.exec(req.headers.get('Cookie') || '');
  return m ? m[1] : 'en';
};

const km = (m) => (m / 1000).toFixed(1);

export const AWARD_TITLES = {
  mvp: 'Carried the Squad', killer: 'Body Count', gravedigger: 'First Casualty', angel: 'Field Medic', sniper: 'Marksman',
  pacifist: 'Pacifist', knocker: 'Takedown Specialist', assist: 'Wingman', headshot: 'Headhunter',
  pharmacy: 'Walking Pharmacy', marathon: 'Long March', taxi: 'Transport Corps', roadkill: 'Roadkill',
  oops: 'Friendly Fire', tourist: 'Sightseer',
};

const AWARD_TEXT = {
  en: {
    killer: (v) => `${v} kills`, gravedigger: (v) => `first of the squad to die, ${v} times`, angel: (v) => `${v} revives`,
    sniper: (v) => `a kill from ${v} m`, pacifist: (v) => `${v} damage and zero kills`, knocker: (v) => `${v} knocks`,
    assist: (v) => `${v} assists`, headshot: (v) => `${v} headshot kills`, pharmacy: (v) => `${v} heals and boosts`,
    marathon: (v) => `${km(v)} km on foot`, taxi: (v) => `${km(v)} km behind the wheel`, roadkill: (v) => `${v} run over`,
    oops: (v) => `took out a teammate ${v === 1 ? 'once' : `${v} times`}`,
    tourist: (v) => `avg ${Math.round(-v)} damage a game. Came for the view`,
  },
  he: {
    killer: (v) => `${v} הריגות`, gravedigger: (v) => `מת ראשון בצוות ${v} פעמים`, angel: (v) => `${v} החייאות`,
    sniper: (v) => `הריגה ממרחק ${v} מ׳`, pacifist: (v) => `${v} נזק ואפס הריגות`, knocker: (v) => `${v} נוקים`,
    assist: (v) => `${v} אסיסטים`, headshot: (v) => `${v} הריגות בראש`, pharmacy: (v) => `${v} תחבושות, משככים ואנרגיות`,
    marathon: (v) => `${km(v)} ק״מ ברגל`, taxi: (v) => `${km(v)} ק״מ ברכב`, roadkill: (v) => `${v} דריסות`,
    oops: (v) => `הרג חבר צוות ${v === 1 ? 'פעם אחת' : `${v} פעמים`}`,
    tourist: (v) => `ממוצע ${Math.round(-v)} נזק למשחק. בא לראות נוף`,
  },
};
export const awardText = (lang, a) => (AWARD_TEXT[lang][a.id] || (() => ''))(a.value);

/** Strings used by the server pages and (a subset, see CLIENT_KEYS) by the browser. */
export const S = {
  en: {
    navStats: 'Stats', stTitle: 'Combat intel', stSub: 'Counted from every shot, hit and step in the telemetry of {n} matches.',
    stFirst: 'Who shoots first', stFirstUs: 'we opened fire', stFirstThem: 'they opened fire', stWon: 'clean wins in {p}% of {n} fights', stFights: '{n} firefights · {d} dealt vs {t} taken per fight',
    stTrend: 'Trends by session', stPlace: 'Average place', stKills: 'Kills per game', stDmg: 'Damage per game', stTop10: 'Top 10 rate', stLower: 'lower is better',
    stWeapons: 'Accuracy & weapons', stAcc: 'Accuracy', stHead: 'Headshots', stDist: 'Avg fight distance', stLong: 'Longest hit', stFav: 'Favourite gun', stShots: '{h} hits out of {s} shots',
    stArsenal: 'What everyone fires (share of damage)', stProfile: 'Combat profile', stKd: 'Knocks per time downed', stTtk: 'Time to knock', stTrade: 'Damage dealt per damage taken', stDealt: 'Dealt per game', stTaken: 'Taken per game', stRev: 'Revives given', stRevd: 'Revived by mates', stSurv: 'Survival per game',
    stMove: 'Landing & movement', stHot: 'Enemies around the landing', stFirstFight: 'Landing → first fight', stVeh: 'Minutes in vehicles', stZone: 'Minutes outside the zone',
    stPairs: 'Squad chemistry (average place together)', stGames: '{n} games', stEnemy: 'How we die', stDeathBy: 'Killed by', stDeathDist: 'Median distance of our deaths', stDeathTeam: 'Size of the squad that got us', stKillers: 'Most wanted', stNone: 'Not enough data yet',
    lookNav: 'Look up', lookTitle: 'Replay any PUBG match', lookIntro: 'Type a PUBG (Steam) name and watch their last matches as a cinematic replay: the drop, every fight, every shot, in retro pixels.', lookPh: 'PUBG name (exact)', lookGo: 'Find', lookBusy: 'Too many look-ups right now. Try again in a minute.', lookNone: 'No Steam player with that name (names are case-sensitive).', lookName: 'That does not look like a PUBG name.', lookNoMatches: 'No matches in the last 14 days.', lookRecent: 'Last matches of {n}', lookWatch: 'Watch replay', lookPrivacy: 'Public data from the official PUBG API. The replay is analysed in your browser; nothing about this player is stored.', lookOther: 'Look up another player', lookLoading: 'Loading…',
    dir: 'ltr', brand: 'Squad Journal', allSessions: 'All sessions', otherLang: 'עברית', footer: 'Squad Journal · built on the PUBG API · not affiliated with KRAFTON', season: 'SEASON', sessions: 'Sessions', matches: 'Matches', chickens: 'Chicken dinners', kills: 'Kills', damage: 'Damage',
    updated: (a) => `synced ${a}`, games: (n) => `${n} games`, best: 'Best', bestPlace: 'Best place', carriedTheNight: 'Carried the night:',
    noSessions: 'No sessions yet 🪂', noSessionsText: 'A session opens when at least two of us play on the same team. It will show up here by itself.',
    recent: 'Recent matches', avgPlace: (p) => `avg place #${p}`, streak: (n) => `${n} games in a row in the top 10 🔥`,
    bestPlays: 'Best plays',
    hotFight: 'Fight of the night', hotKills: (n) => (n === 1 ? '1 kill' : `${n} kills`), hotKnocks: (n) => (n === 1 ? '1 knock' : `${n} knocks`), watchNow: 'Watch the fight',
    replays: 'Replays', debrief: 'Full debrief: MVP, medals, squad logs', playReplay: 'Play replay',
    whoCarried: 'Who carried', carriedSquad: 'Carried the squad on his back', medals: 'Medals', engagements: 'Engagements',
    highlights: 'Highlights', matchN: (n) => `Match ${n}`, min: (n) => `${n} min`, winner: 'WINNER WINNER CHICKEN DINNER',
    legend: ['Landing', 'Death', 'Our kill', 'Final circle', 'Flight path'],
    share: 'Share with the squad', copied: 'Link copied', notFound: 'This session does not exist 🤷', back: 'Back to all sessions',
    kd: (k, d, kn, r) => `${k} kills · ${d} damage · ${kn} knocks · ${r} revives`,
    sessionDesc: (t, mvp) => `${t.wins ? `🍗 ${t.wins > 1 ? `${t.wins} chicken dinners` : 'Chicken dinner'}` : `Best finish #${t.best_place}`} · ${t.kills} kills in ${t.games} games${mvp ? ` · ${mvp} carried the squad` : ''}`,
    siteDesc: 'Our PUBG squad journal: every session, medal and record',
    live: 'LIVE', liveText: (a) => `The squad is in the field. Last match ended ${a}. Checking PUBG every few minutes.`,
    duos: 'Best duos', duosSub: 'win rate together, 3+ games', rivals: 'Rivalries', rivalsSub: 'who out-killed whom in games together', together: (g, w) => `${g} games · ${w}% wins`, bestPartner: 'Best partner', rival: 'Main rival', h2h: (a, b) => `${a}–${b} in head-to-head kills`,
    narrator: 'War correspondent', narratorWait: 'The correspondent is filing his report…',
    navMaps: 'Maps', mapsTitle: 'Drop zones & graveyards', drops: 'Drops', deaths: 'Deaths', everyone: 'Everyone', onMap: (n) => `${n} games on this map`, noPoints: 'No analysed games on this map yet. Open a session and the maps fill in.',
    navSessions: 'Sessions', navHall: 'Hall', hallTitle: 'Hall of Fame', chain: 'Chain of command', records: 'Records',
    serviceRecord: 'Service record', medalCabinet: 'Medal cabinet', recordsHeld: 'Records held', recentSessions: 'Recent sessions',
    xpTo: (x, n, r) => `${x} / ${n} XP to ${r}`, xpMax: (x) => `${x} XP · top of the chain`, watch: 'Watch', noMedals: 'No medals yet. Soon.',
    st: { games: 'Games', sessions: 'Nights', wins: 'Chicken dinners', winRate: 'Win rate', kills: 'Kills', kd: 'K/D', avgDmg: 'Avg damage', knocks: 'Knocks', revives: 'Revives', mvps: 'MVP nights' },
    squadLogs: 'Squad logs', medicLog: 'Medic log', medicSub: 'who revived whom', setupLog: 'Set-ups', setupSub: 'who assisted whose kill',
    reviver: 'reviver ↓ / revived →', assister: 'assist ↓ / killer →',
    // join
    joinTitle: 'Enlist in the squad journal', welcome: 'Welcome to the squad 🪂', noPassword: 'No password, no sign-up. Just your in-game name.',
    ignQ: 'What is your PUBG name?', ignHint: 'Exactly as in the game, including capital letters.', search: 'Search',
    isThisYou: 'Is this you?', yes: "Yes, that's me", no: 'No', callsign: 'Callsign', color: 'Colour', insignia: 'Insignia',
    imIn: "I'm in", pulling: 'Pulling your history…', pullingN: (d, t) => `Pulling your history ${d}/${t}`, ready: 'Ready! 🍗',
    moreInBg: 'A few more matches will download in the background. ', toJournal: 'To the squad journal →',
    lastMatch: 'Last match: ', noRecent: 'No matches in the last two weeks (that is fine).', checkCaps: 'Check capital letters and 0 vs O.',
    tryAgain: 'Something went wrong, try again', linkExpired: 'This invite link has expired 😬', askGuy: 'Ask Guy for a new one.',
    // lookup errors (server)
    errToken: 'This invite link has expired, ask Guy for a new one', errName: 'That does not look like a PUBG name',
    errRate: 'Too many tries, wait a minute and try again', errNotFound: (n) => `Could not find "${n}". Check capital letters and 0 vs O.`,
    errSlow: 'Took too long, search for your name again', errNick: 'Pick a callsign', errServer: 'Something broke on our side, try again in a moment',
    agoNow: 'just now', agoMin: (m) => `${m} min ago`, agoHour: (h) => (h === 1 ? '1 hour ago' : `${h} hours ago`), agoDay: (d) => (d === 1 ? 'yesterday' : `${d} days ago`),
  },
  he: {
    navStats: 'סטטיסטיקה', stTitle: 'מודיעין קרבי', stSub: 'נספר מכל ירייה, פגיעה וצעד בטלמטריה של {n} משחקים.',
    stFirst: 'מי יורה ראשון', stFirstUs: 'אנחנו פתחנו באש', stFirstThem: 'הם פתחו באש', stWon: 'ניצחון נקי ב-{p}% מ-{n} קרבות', stFights: '{n} קרבות · {d} נזק שנתנו מול {t} שספגנו בממוצע לקרב',
    stTrend: 'מגמות לפי ערב', stPlace: 'מקום ממוצע', stKills: 'הריגות למשחק', stDmg: 'נזק למשחק', stTop10: 'אחוז טופ 10', stLower: 'נמוך יותר = טוב יותר',
    stWeapons: 'דיוק ונשקים', stAcc: 'דיוק', stHead: 'פגיעות ראש', stDist: 'מרחק קרב ממוצע', stLong: 'הפגיעה הכי רחוקה', stFav: 'הנשק המועדף', stShots: '{h} פגיעות מתוך {s} יריות',
    stArsenal: 'במה כל אחד יורה (חלק מהנזק)', stProfile: 'פרופיל קרבי', stKd: 'נוקים לכל נפילה', stTtk: 'זמן עד נוק', stTrade: 'נזק שנתן לכל נזק שספג', stDealt: 'נזק למשחק', stTaken: 'ספג למשחק', stRev: 'החייאות שנתן', stRevd: 'הוקם ע״י חברים', stSurv: 'הישרדות למשחק',
    stMove: 'נחיתה ותנועה', stHot: 'אויבים סביב הנחיתה', stFirstFight: 'מנחיתה לקרב הראשון', stVeh: 'דקות ברכבים', stZone: 'דקות מחוץ לאזור',
    stPairs: 'כימיה בסקוואד (מקום ממוצע ביחד)', stGames: '{n} משחקים', stEnemy: 'איך אנחנו מתים', stDeathBy: 'נהרגנו מ…', stDeathDist: 'מרחק חציוני של המוות שלנו', stDeathTeam: 'גודל הסקוואד שהוריד אותנו', stKillers: 'המבוקשים', stNone: 'עוד אין מספיק נתונים',
    lookNav: 'חיפוש', lookTitle: 'ריפליי לכל משחק PUBG', lookIntro: 'מקלידים שם PUBG (Steam) וצופים במשחקים האחרונים שלו כריפליי קולנועי: הצניחה, כל קרב, כל ירייה, בפיקסלים רטרו.', lookPh: 'שם ב-PUBG (מדויק)', lookGo: 'חיפוש', lookBusy: 'יותר מדי חיפושים כרגע. נסו שוב בעוד דקה.', lookNone: 'אין שחקן Steam בשם הזה (יש הבדל בין אותיות גדולות לקטנות).', lookName: 'זה לא נראה כמו שם ב-PUBG.', lookNoMatches: 'אין משחקים ב-14 הימים האחרונים.', lookRecent: 'המשחקים האחרונים של {n}', lookWatch: 'לצפייה בריפליי', lookPrivacy: 'מידע ציבורי מה-API הרשמי של PUBG. הריפליי מנותח בדפדפן שלכם; שום דבר על השחקן לא נשמר.', lookOther: 'לחפש שחקן אחר', lookLoading: 'טוען…',
    dir: 'rtl', brand: 'יומן הסקוואד', allSessions: 'כל הסשנים', otherLang: 'English', footer: 'יומן הסקוואד · נבנה מנתוני PUBG API · לא קשור ל־KRAFTON', season: 'SEASON', sessions: 'סשנים', matches: 'משחקים', chickens: 'צ׳יקנים', kills: 'הריגות', damage: 'נזק',
    updated: (a) => `עודכן ${a}`, games: (n) => `${n} משחקים`, best: 'שיא', bestPlace: 'מקום הכי טוב', carriedTheNight: 'סחב את הערב:',
    noSessions: 'עוד אין סשנים 🪂', noSessionsText: 'סשן נפתח כששניים מאיתנו לפחות משחקים באותו צוות. ברגע שזה יקרה, זה יופיע כאן לבד.',
    recent: 'משחקים אחרונים', avgPlace: (p) => `מקום ממוצע #${p}`, streak: (n) => `רצף של ${n} משחקים בטופ 10 🔥`,
    bestPlays: 'המהלכים הכי טובים',
    hotFight: 'הקרב של הערב', hotKills: (n) => (n === 1 ? 'הריגה אחת' : `${n} הריגות`), hotKnocks: (n) => (n === 1 ? 'נוק אחד' : `${n} נוקים`), watchNow: 'לצפייה בקרב',
    replays: 'ריפליים', debrief: 'התחקיר המלא: MVP, מדליות, יומני הסקוואד', playReplay: 'לנגן ריפליי',
    whoCarried: 'מי סחב', carriedSquad: 'סחב את הסקוואד על הגב', medals: 'מדליות', engagements: 'המשחקים',
    highlights: 'רגעים', matchN: (n) => `משחק ${n}`, min: (n) => `${n} דק׳`, winner: 'WINNER WINNER CHICKEN DINNER',
    legend: ['נחיתה', 'מוות', 'הריגה שלנו', 'מעגל אחרון', 'מטוס'],
    share: 'לשתף בקבוצה', copied: 'הקישור הועתק', notFound: 'הסשן הזה לא קיים 🤷', back: 'לכל הסשנים',
    kd: (k, d, kn, r) => `${k} הריגות · ${d} נזק · ${kn} נוקים · ${r} החייאות`,
    sessionDesc: (t, mvp) => `${t.games} משחקים · ${t.wins ? `${t.wins} צ׳יקן דינר 🍗 · ` : `מקום הכי טוב #${t.best_place} · `}${t.kills} הריגות${mvp ? ` · ${mvp} סחב` : ''}`,
    siteDesc: 'יומן הסקוואד: כל הסשנים, המדליות והשיאים שלנו ב־PUBG',
    live: 'LIVE', liveText: (a) => `הסקוואד בשטח. המשחק האחרון נגמר ${a}. בודקים מול PUBG כל כמה דקות.`,
    duos: 'הצמדים', duosSub: 'אחוז ניצחון יחד, 3+ משחקים', rivals: 'יריבויות', rivalsSub: 'מי הרג יותר במשחקים משותפים', together: (g, w) => `${g} משחקים · ${w}% ניצחונות`, bestPartner: 'השותף הכי טוב', rival: 'היריב העיקרי', h2h: (a, b) => `${a}–${b} בהריגות ראש בראש`,
    narrator: 'הכתב הצבאי', narratorWait: 'הכתב הצבאי מקליד את הדיווח…',
    navMaps: 'מפות', mapsTitle: 'איפה נוחתים ואיפה מתים', drops: 'נחיתות', deaths: 'מוות', everyone: 'כולם', onMap: (n) => `${n} משחקים במפה הזאת`, noPoints: 'עוד אין משחקים מנותחים במפה הזאת. פותחים סשן והמפות מתמלאות.',
    navSessions: 'סשנים', navHall: 'היכל', hallTitle: 'היכל התהילה', chain: 'שרשרת הפיקוד', records: 'שיאים',
    serviceRecord: 'תיק אישי', medalCabinet: 'ארון המדליות', recordsHeld: 'שיאים שלו', recentSessions: 'סשנים אחרונים',
    xpTo: (x, n, r) => `${x} / ${n} XP עד ${r}`, xpMax: (x) => `${x} XP · ראש השרשרת`, watch: 'לצפייה', noMedals: 'עוד אין מדליות. בקרוב.',
    st: { games: 'משחקים', sessions: 'ערבים', wins: 'צ׳יקן דינר', winRate: 'אחוז ניצחון', kills: 'הריגות', kd: 'K/D', avgDmg: 'נזק ממוצע', knocks: 'נוקים', revives: 'החייאות', mvps: 'ערבי MVP' },
    squadLogs: 'יומני הסקוואד', medicLog: 'יומן חובש', medicSub: 'מי הקים את מי', setupLog: 'הכנות', setupSub: 'מי עזר להריגה של מי',
    reviver: 'מקים ↓ / הוקם →', assister: 'עוזר ↓ / הורג →',
    joinTitle: 'מצטרפים ליומן הסקוואד', welcome: 'ברוכים הבאים לסקוואד 🪂', noPassword: 'בלי סיסמה ובלי הרשמה. רק השם שלך במשחק.',
    ignQ: 'מה השם שלך ב־PUBG?', ignHint: 'בדיוק כמו במשחק, כולל אותיות גדולות וקטנות.', search: 'חיפוש',
    isThisYou: 'זה את/ה?', yes: 'כן, זה אני', no: 'לא', callsign: 'כינוי', color: 'צבע', insignia: 'סמל',
    imIn: 'יאללה, אני בפנים', pulling: 'מושכים את ההיסטוריה שלך…', pullingN: (d, t) => `מושכים את ההיסטוריה שלך ${d}/${t}`, ready: 'מוכן! 🍗',
    moreInBg: 'עוד קצת משחקים יימשכו ברקע. ', toJournal: 'ליומן הסקוואד ←',
    lastMatch: 'משחק אחרון: ', noRecent: 'לא מצאנו משחקים בשבועיים האחרונים (זה בסדר).', checkCaps: 'בדקו אותיות גדולות/קטנות ואפסים מול O.',
    tryAgain: 'משהו השתבש, נסו שוב', linkExpired: 'הקישור הזה כבר לא בתוקף 😬', askGuy: 'בקשו מגיא קישור חדש.',
    errToken: 'הקישור הזה כבר לא בתוקף, בקשו מגיא קישור חדש', errName: 'השם לא נראה כמו שם PUBG',
    errRate: 'יותר מדי ניסיונות, חכו דקה ונסו שוב', errNotFound: (n) => `לא מצאנו את "${n}". שימו לב לאותיות גדולות/קטנות ול־0 מול O.`,
    errSlow: 'עבר יותר מדי זמן, חפשו את השם שוב', errNick: 'צריך כינוי', errServer: 'משהו השתבש בשרת, נסו שוב עוד רגע',
    agoNow: 'הרגע', agoMin: (m) => `לפני ${m} דק׳`, agoHour: (h) => (h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`), agoDay: (d) => (d === 1 ? 'אתמול' : d === 2 ? 'לפני יומיים' : `לפני ${d} ימים`),
  },
};

/** Strings the session page script needs, as plain text (no functions). */
export function clientStrings(lang) {
  return lang === 'he' ? {
    loadOnScroll: 'המפה נטענת כשגוללים אליה', queued: 'ממתין בתור לניתוח…', downloading: 'מורידים טלמטריה…', parsing: 'מנתחים {n}MB של אירועים…',
    retry: 'עוד ניסיון…', news: 'חדשות מהשטח', newsMaking: 'מסוק החדשות מצלם… {n}%', preparing: 'מכינים את הריפליי… {n}%', director: 'במאי', sound: 'סאונד', playReplay: 'לצפייה בריפליי', tapSkip: 'הקשה לדילוג', squad: 'שלנו', enemy: 'אויב', actionOnly: 'רק אקשן', next: 'הבא', ffKills: '{n} הריגות', ffKills1: 'הריגה אחת', ffKnocks: '{n} נוקים', ffKnocks1: 'נוק אחד', ffRevives: '{n} החייאות', ffRevives1: 'החייאה אחת', ffDown: '{n} שלנו נפלו', ffDown1: 'אחד שלנו נפל', vs: 'נגד {names}', reel: 'לנגן את כל ההיילייטס ({n} קליפים)', enemies: 'הסקוואדים שנלחמנו בהם', theyKilled: 'הרגו לנו {n}', theyKilled1: 'הרגו לנו אחד', dealt: 'נתנו', taken: 'ספגנו', moreSquads: 'עוד {n} סקוואדים', clip: 'קליפ מהרגע', clipMaking: 'חותכים קליפ… {n}%', clipShare: 'לשתף קליפ', clipSave: 'לשמור', clipNoSupport: 'הדפדפן הזה לא יודע להקליט וידאו', shareMoment: 'לשתף את הרגע', newMatch: 'משחק חדש נכנס · לרענון', camAuto: 'מצלמה חכמה', slowmo: 'הילוך איטי באקשן', theater: 'מסך מלא', noTele: 'אין טלמטריה למשחק הזה 🤷', failed: 'לא הצלחנו לנתח את המשחק הזה', fullMap: 'כל המפה', zoomIn: 'זום לפעולה',
    killed: '{a} חיסל את {v}', knocked: '{a} הפיל את {v}', died: '{v} נפל ל־{a}', diedAlone: '{v} נפל', revived: '{a} הקים את {v}',
    more: 'עוד {n} אירועים', fists: 'אגרופים', copied: 'הקישור הועתק', replay: 'הילוך חוזר', stop: 'סגור', analyzing: 'מנתחים משחק {i}/{n}…',
    noMoments: 'עוד לא זוהו רגעים מיוחדים בסשן הזה.',
    clutch: '{a} נשאר אחרון מ־{n} ולקח את הצ׳יקן', wipe: '{a} גמרו צוות: {n} הריגות תוך {s} שניות', rampage: '{a}: {n} הריגות תוך {s} שניות',
    longshot: '{a} פגע מ־{d} מ׳ עם {w}', lastgasp: '{a} הקים את {v} אחרי {s} שניות על הרצפה', matchAt: 'משחק {m} · {t}', none: '—',
  } : {
    loadOnScroll: 'The map loads when you scroll to it', queued: 'Queued for analysis…', downloading: 'Downloading telemetry…', parsing: 'Crunching {n}MB of events…',
    retry: 'One more try…', news: 'News reel', newsMaking: 'The news chopper is filming… {n}%', preparing: 'Preparing the replay… {n}%', director: 'Director', sound: 'Sound', playReplay: 'Watch replay', tapSkip: 'tap to skip', squad: 'SQUAD', enemy: 'ENEMY', actionOnly: 'Action only', next: 'Next', ffKills: '{n} kills', ffKills1: '1 kill', ffKnocks: '{n} knocks', ffKnocks1: '1 knock', ffRevives: '{n} revives', ffRevives1: '1 revive', ffDown: '{n} of us down', ffDown1: '1 of us down', vs: 'vs {names}', reel: 'Play the highlights reel ({n} clips)', enemies: 'Enemy squads we fought', theyKilled: 'took out {n} of us', theyKilled1: 'took out 1 of us', dealt: 'dealt', taken: 'taken', moreSquads: '{n} more squads', clip: 'Clip this moment', clipMaking: 'Cutting your clip… {n}%', clipShare: 'Share clip', clipSave: 'Save', clipNoSupport: 'This browser cannot record video', shareMoment: 'Share this moment', newMatch: 'New match in · tap to refresh', camAuto: 'Auto camera', slowmo: 'Slow-mo on action', theater: 'Fullscreen', noTele: 'No telemetry for this match 🤷', failed: 'Could not analyse this match', fullMap: 'Full map', zoomIn: 'Zoom to action',
    killed: '{a} eliminated {v}', knocked: '{a} knocked {v}', died: '{v} went down to {a}', diedAlone: '{v} went down', revived: '{a} revived {v}',
    more: '{n} more events', fists: 'fists', copied: 'Link copied', replay: 'Replay', stop: 'Close', analyzing: 'Analysing match {i}/{n}…',
    noMoments: 'No special moments detected in this session yet.',
    clutch: '{a} was the last of {n} standing and took the chicken', wipe: '{a} finished off a squad: {n} kills in {s}s', rampage: '{a}: {n} kills in {s}s',
    longshot: '{a} hit from {d} m with the {w}', lastgasp: '{a} picked up {v} after {s}s on the ground', matchAt: 'Match {m} · {t}', none: '—',
  };
}

export const RECORD_TITLES = {
  most_kills: 'MOST KILLS', most_damage: 'MOST DAMAGE', longest_kill: 'LONGEST KILL', most_knocks: 'MOST KNOCKS',
  most_revives: 'MOST REVIVES', most_headshots: 'HEADHUNTER', squad_kills: 'SQUAD BODY COUNT', session_wins: 'CHICKEN NIGHT', win_streak: 'WIN STREAK',
};
const RECORD_TEXT = {
  en: { most_kills: (v) => `${v} kills in one game`, most_damage: (v) => `${v} damage in one game`, longest_kill: (v) => `a kill from ${v} m`,
    most_knocks: (v) => `${v} knocks in one game`, most_revives: (v) => `${v} revives in one game`, most_headshots: (v) => `${v} headshot kills in one game`,
    squad_kills: (v) => `${v} kills by the squad in one game`, session_wins: (v) => `${v} chicken dinners in one night`, win_streak: (v) => `${v} chicken dinners in a row` },
  he: { most_kills: (v) => `${v} הריגות במשחק אחד`, most_damage: (v) => `${v} נזק במשחק אחד`, longest_kill: (v) => `הריגה ממרחק ${v} מ׳`,
    most_knocks: (v) => `${v} נוקים במשחק אחד`, most_revives: (v) => `${v} החייאות במשחק אחד`, most_headshots: (v) => `${v} הריגות בראש במשחק אחד`,
    squad_kills: (v) => `${v} הריגות של הסקוואד במשחק אחד`, session_wins: (v) => `${v} צ׳יקן דינר בערב אחד`, win_streak: (v) => `${v} צ׳יקן דינר ברצף` },
};
export const recordText = (lang, r) => (RECORD_TEXT[lang][r.id] || (() => ''))(r.value);

export const MOMENT_TITLES = { firefight: 'FIREFIGHT', clutch: 'CLUTCH', wipe: 'SQUAD WIPE', rampage: 'RAMPAGE', longshot: 'LONG SHOT', lastgasp: 'LAST-GASP REVIVE' };
