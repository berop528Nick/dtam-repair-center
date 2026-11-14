/**
 * ============================================================
 *  เว็บฟอร์มแจ้งซ่อมครุภัณฑ์ (Google Apps Script)
 *  ไฟล์: Code.gs
 * ============================================================
 *  ไฟล์ที่ต้องมีบน Apps Script (14 ไฟล์)
 *    Code.gs + appsscript.json
 *    Repair, Track, Login, Dashboard, Equipment
 *    Brand, PubHead, Shell, Styles, NavJS, AppJS, Dialog
 *  ดูรายการที่อัปโหลดจริงได้ใน .claspignore
 *
 *  ขั้นตอนดีพลอยแบบเร็ว (clasp)
 *  1) npm install -g @google/clasp && clasp login
 *  2) clasp push        (อ่าน Script ID จาก .clasp.json)
 *  3) clasp deploy -d "v1"
 *  4) ครั้งแรกที่มีการเรียกใช้ Google จะขออนุญาตสิทธิ์ ให้กด Allow
 *
 *  ดีพลอยจากหน้าเว็บ
 *  1) ตั้งค่า CONFIG ด้านล่าง (ถ้าไม่ผูกสคริปต์กับชีต ให้ใส่ SPREADSHEET_ID)
 *  2) Deploy > New deployment > Web app
 *       Execute as: Me
 *       Who has access: Anyone (หรือ Anyone with Google account)
 *  3) ครั้งแรกจะมีการขออนุญาตสิทธิ์ ให้กด Allow
 * ============================================================
 */

const CONFIG = {
  /** ไอดี Google Sheet ที่เก็บข้อมูล (เว้นว่าง = ใช้ชีตที่ผูกกับสคริปต์นี้) */
  SPREADSHEET_ID: '1wsH6E9KiACI33_KVVGZ8Pj73JWemj-7fhQNbC8D97vw',

  /** ชื่อชีตที่ใช้เก็บรายการ (สร้างให้อัตโนมัติถ้ายังไม่มี) */
  SHEET_NAME: 'แจ้งซ่อม',

  /** อีเมลผู้ดูแลที่รับแจ้งเตือน เช่น ['admin@school.ac.th'] (เว้นว่าง = ไม่ส่งอีเมล) */
  ADMIN_EMAILS: [],

  /** โฟลเดอร์ Drive สำหรับเก็บรูป (เว้นว่าง = ใช้/สร้างโฟลเดอร์ตามชื่อด้านล่าง) */
  DRIVE_FOLDER_ID: '',
  DRIVE_FOLDER_NAME: 'รูปแจ้งซ่อมครุภัณฑ์',

  /** LINE Messaging API (ไม่บังคับ) — ต้องมี Channel access token + userId */
  LINE_CHANNEL_TOKEN: '',
  LINE_USER_ID: '',

  /** ขนาดไฟล์แนบสูงสุด (MB) */
  MAX_FILE_MB: 5,

  /** เขตเวลาไทย */
  TIMEZONE: 'Asia/Bangkok',
};

/** ตัวเลือกในฟอร์ม (แก้ไขได้ตามหน่วยงาน) */
const LISTS = {
  departments: [
    'ศูนย์การแพทย์แผนไทยและการแพทย์ทางเลือก',
    'ศพท.เขตสุขภาพที่ 1 จ.ลำปาง',
    'ศพท.เขตสุขภาพที่ 2 จ.สุโขทัย',
    'ศพท.เขตสุขภาพที่ 3 จ.นครสวรรค์',
    'ศพท.เขตสุขภาพที่ 4 จ.นนทบุรี สาขาตักศิลา',
    'ศพท.เขตสุขภาพที่ 4 จ.นนทบุรี สาขาสยามมณี',
    'ศพท.เขตสุขภาพที่ 5 จ.นครปฐม',
    'ศพท.เขตสุขภาพที่ 6 จ.ฉะเชิงเทรา',
    'ศพท.เขตสุขภาพที่ 7 จ.ขอนแก่น',
    'ศพท.เขตสุขภาพที่ 8 จ.อุดรธานี',
    'ศพท.เขตสุขภาพที่ 9 จ.สุรินทร์',
    'ศพท.เขตสุขภาพที่ 10 จ.อุบลราชธานี',
    'ศพท.เขตสุขภาพที่ 11 จ.ชุมพร',
    'ศพท.เขตสุขภาพที่ 12 จ.พัทลุง',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขายศเส',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขาแจ้งวัฒนะ',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขามีนบุรี',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขารัฐสภา',
    'อื่น ๆ',
  ],
  categories: [
    'คอมพิวเตอร์/โน้ตบุ๊ก',
    'จอภาพ/มอนิเตอร์',
    'เครื่องพิมพ์/สแกนเนอร์',
    'ระบบเครือข่าย/อินเทอร์เน็ต',
    'โปรเจกเตอร์/ทีวี',
    'เครื่องเสียง',
    'ครุภัณฑ์สำนักงาน',
    'อื่น ๆ',
  ],
  urgencies: ['ปกติ', 'เร่งด่วน', 'ฉุกเฉิน'],
};

/** ลำดับคอลัมน์ในชีต (ห้ามสลับ) */
const HEADERS = [
  'เลขที่ใบแจ้ง',
  'วันเวลาที่แจ้ง',
  'ชื่อผู้แจ้ง',
  'หน่วยงาน',
  'เบอร์โทร',
  'อีเมล',
  'ครุภัณฑ์/อุปกรณ์',
  'รหัสครุภัณฑ์',
  'หมวดหมู่',
  'สถานที่',
  'อาการเสีย/รายละเอียด',
  'ความเร่งด่วน',
  'รูปภาพ',
  'สถานะ',
  'ผู้รับผิดชอบ',
  'หมายเหตุ',
  /* ---- คอลัมน์ที่เพิ่มภายหลัง (ต่อท้ายเสมอ ห้ามแทรกกลาง) ---- */
  'ไอดีไลน์',
  'ช่องทางติดต่อกลับ',
  'รูป QR LINE',
  'รูปเพิ่มเติม 2',
  'รูปเพิ่มเติม 3',
  /* ---- คอลัมน์สำหรับติดตามงาน (เพิ่มภายหลังเช่นกัน) ---- */
  'วันที่ปิดงาน',
  'อีเมลผู้รับผิดชอบ',
  'วันที่มอบหมาย',
];

/** ความกว้างคอลัมน์ (ลำดับตรงกับ HEADERS) */
const HEADER_WIDTHS = [
  120, 130, 140, 140, 110, 150, 180, 110, 160, 160, 320, 100, 180, 120, 120, 160,
  120, 130, 180, 180, 180, 140, 200, 140,
];

const STATUS_NEW = 'รอดำเนินการ';

/* ============================================================
 *  Web app
 * ============================================================ */

/**
 * เส้นทางของแต่ละหน้า: URL เดียวกัน ใช้ ?page=... เลือกหน้า
 *   https://.../exec              → ฟอร์มแจ้งซ่อม (สาธารณะ ไม่ต้องล็อกอิน)
 *   https://.../exec?page=form      → ฟอร์มแจ้งซ่อม
 *   https://.../exec?page=track     → ติดตามสถานะด้วยเลขที่ใบแจ้ง (สาธารณะ)
 *   https://.../exec?page=login     → หน้าเข้าสู่ระบบ (สำหรับแอดมิน/เจ้าหน้าที่)
 *   https://.../exec?page=dashboard → หน้าแรก (ประวัติการแจ้งซ่อม) — หลังล็อกอิน
 *   https://.../exec?page=equipment → รายละเอียดครุภัณฑ์
 */
const PAGES = {
  form: { file: 'Repair', title: 'แจ้งซ่อมครุภัณฑ์ · ศูนย์การแพทย์แผนไทยและการแพทย์ทางเลือก' },
  track: { file: 'Track', title: 'ติดตามสถานะ · ระบบแจ้งซ่อมครุภัณฑ์' },
  login: { file: 'Login', title: 'เข้าสู่ระบบ · ระบบแจ้งซ่อมครุภัณฑ์' },
  dashboard: { file: 'Dashboard', title: 'หน้าแรก · ระบบแจ้งซ่อมครุภัณฑ์' },
  equipment: { file: 'Equipment', title: 'รายละเอียดครุภัณฑ์ · ระบบแจ้งซ่อมครุภัณฑ์' },
};

function doGet(e) {
  const requested = String((e && e.parameter && e.parameter.page) || 'form');
  let page = PAGES[requested] ? requested : 'form';

  /* หน้าที่ต้องล็อกอิน : ต้องมี token ที่ยังใช้ได้ติดมาด้วย (?t=…)
     ถ้าไม่มี/ปลอม/หมดอายุ → ส่งหน้า login แทน
     (ไม่ส่ง HTML ของแดชบอร์ดออกไปเลย แม้ฝั่ง client จะมีตัวกันอยู่แล้ว)

     หน้า public (form / track) ไม่สนใจ token — ผู้ใช้ทั่วไปเปิดลิงก์มา
     ก็ใช้แจ้งซ่อม/ติดตามสถานะได้เลยโดยไม่ต้องล็อกอิน */
  const token = String((e && e.parameter && e.parameter.t) || '');
  const session = token ? sessionInfo(token) : { ok: false };

  if (PROTECTED_PAGES.indexOf(page) >= 0 && !session.ok) {
    page = 'login';
  }

  const template = HtmlService.createTemplateFromFile(PAGES[page].file);

  template.currentUser = session.ok ? session.name : currentUserName_();

  if (page === 'form') {
    template.lists = JSON.stringify(LISTS);
    template.maxFileMb = CONFIG.MAX_FILE_MB;
  }

  /* ส่ง token ที่ตรวจแล้วเข้าไปในหน้าเว็บ (window.__DTAM_TOKEN)
     เพื่อให้ฝั่ง client รู้ว่าใครล็อกอินอยู่ทันทีที่หน้าโหลด — ไม่ต้องพึ่ง
     localStorage ใน iframe ซึ่งเบราว์เซอร์มักบล็อก/ล้าง = รีเฟรชแล้วหลุด */
  const out = HtmlService.createHtmlOutput(withBootScript_(template.evaluate().getContent(), {
    token: session.ok ? token : '',
    name: session.name,
    role: session.role,
    exp: session.exp,
    page: page,
  }))
    .setTitle(PAGES[page].title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return out;
}

/**
 * ใช้โดย NavJS (สลับหน้าในที่เดียว) : คืน HTML ของหน้าเป้าหมายเป็นสตริง
 * - ต้องมี เพราะใน iframe ของ Apps Script การ fetch หน้าเดียวกันบางเครื่องถูกบล็อก
 *   หรือได้หน้า wrapper กลับมา ทำให้สลับหน้าไม่ได้แล้วต้องโหลดใหม่ทั้งหน้า (เห็นเป็นกระพริบ)
 * - ตั้งค่าตัวแปรเทมเพลตเหมือน doGet เพื่อให้หน้าเป้าหมายเรนเดอร์ได้ครบ
 */
function getPageHtml(page, token) {
  const key = String(page || '');

  if (!PAGES[key]) {
    return '';
  }

  const session = token ? sessionInfo(token) : { ok: false };

  if (PROTECTED_PAGES.indexOf(key) >= 0 && !session.ok) {
    return '';
  }

  const template = HtmlService.createTemplateFromFile(PAGES[key].file);
  template.currentUser = session.ok ? session.name : currentUserName_();

  if (key === 'form') {
    template.lists = JSON.stringify(LISTS);
    template.maxFileMb = CONFIG.MAX_FILE_MB;
  }

  return withBootScript_(template.evaluate().getContent(), {
    token: session.ok ? token : '',
    name: session.name,
    role: session.role,
    exp: session.exp,
    page: key,
  });
}

/** ใช้ในเทมเพลต HTML: <?!= include('Styles') ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
 *  ระบบเข้าสู่ระบบ (ของเราเอง)
 *  - เว็บแอปตั้งเป็น ANYONE_ANONYMOUS จึงใช้ Session.getActiveUser() ไม่ได้
 *  - บัญชีเจ้าหน้าที่เก็บในชีต "Users" ของสเปรดชีตเดียวกับใบแจ้งปัญหา
 *      คอลัมน์: username | name | role | salt | hash | active | created | updated
 *  - รหัสผ่านไม่เก็บตัวจริง : hash = SHA-256(salt + ':' + password)
 *  - ล็อกอินสำเร็จได้ token (UUID) ฝั่งเซิร์ฟเวอร์ อายุ 8 ชั่วโมง (เก็บใน Script Properties)
 *  - ลองผิดเกิน 5 ครั้ง/ผู้ใช้ → ล็อก 10 นาที
 * ============================================================ */

const AUTH = {
  SHEET_NAME: 'Users',
  HEADERS: ['username', 'name', 'role', 'salt', 'hash', 'active', 'created', 'updated'],
  OLD_USERS_KEY: 'AUTH_USERS',
  SESSION_PREFIX: 'AUTH_SESSION_',
  TRY_PREFIX: 'AUTH_TRY_',
  TTL_HOURS: 8,
  MAX_TRIES: 5,
  LOCK_MINUTES: 10,
};

/** หน้าที่ต้องล็อกอินก่อนเข้า */
const PROTECTED_PAGES = ['dashboard', 'equipment'];

/** SHA-256 เป็น hex */
function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function (b) {
      const v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

/** เปิดสเปรดชีตของระบบ (ใช้ทั้งชีตใบแจ้งและชีตบัญชี) */
function openSs_() {
  const ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('ไม่พบ Spreadsheet กรุณาตั้งค่า CONFIG.SPREADSHEET_ID ใน Code.gs');
  }

  return ss;
}

/** ชีตเก็บบัญชีเจ้าหน้าที่ (สร้าง + ใส่หัวตารางให้เองถ้ายังไม่มี) */
function usersSheet_() {
  const ss = openSs_();
  const width = AUTH.HEADERS.length;
  let sheet = ss.getSheetByName(AUTH.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(AUTH.SHEET_NAME);
  }

  const head = sheet.getLastRow() === 0
    ? []
    : sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) {
      return String(value).trim();
    });

  if (head[0]) {
    if (head[0] !== AUTH.HEADERS[0]) {
      throw new Error(
        'ชีต "' + AUTH.SHEET_NAME + '" มีอยู่แล้วแต่หัวตารางไม่ใช่ "username" ' +
        'กรุณาเปลี่ยนชื่อชีตหรือล้างข้อมูลก่อนใช้งาน'
      );
    }
    return sheet;
  }

  sheet.getRange(1, 1, 1, width)
    .setValues([AUTH.HEADERS])
    .setFontWeight('bold')
    .setBackground('#0f4c5c')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  [140, 180, 90, 240, 300, 70, 140, 140].forEach(function (w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  return sheet;
}

/** คอลัมน์ active : ว่าง/yes/1/true/y = ใช้งาน, ค่าอื่น = ปิดใช้งาน */
function isActive_(value) {
  const v = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  return v === '' || v === 'yes' || v === 'y' || v === '1' || v === 'true';
}

/**
 * อ่านบัญชีทั้งหมดจากชีต
 * @return {Object} { username: { name, role, salt, hash, active, created, updated } }
 */
function users_() {
  const sheet = usersSheet_();
  const last = sheet.getLastRow();
  const out = {};

  if (last < 2) {
    return out;
  }

  sheet.getRange(2, 1, last - 1, AUTH.HEADERS.length).getValues().forEach(function (row) {
    const user = String(row[0] || '').trim().toLowerCase();

    if (!user) {
      return;
    }

    out[user] = {
      name: String(row[1] || '').trim() || user,
      role: String(row[2] || '').trim() || 'staff',
      salt: String(row[3] || '').trim(),
      hash: String(row[4] || '').trim(),
      active: isActive_(row[5]),
      created: row[6],
      updated: row[7],
    };
  });

  return out;
}

/** เพิ่มหรืออัปเดตบัญชีลงชีต (มีชื่อผู้ใช้เดิม = แก้แถวเดิม ไม่สร้างซ้ำ) */
function saveUser_(rec) {
  const sheet = usersSheet_();
  const last = sheet.getLastRow();
  const now = new Date();
  let at = 0;

  if (last >= 2) {
    const names = sheet.getRange(2, 1, last - 1, 1).getValues();

    for (let i = 0; i < names.length; i += 1) {
      if (String(names[i][0] || '').trim().toLowerCase() === rec.username) {
        at = i + 2;
        break;
      }
    }
  }

  const row = [rec.username, rec.name, rec.role, rec.salt, rec.hash, 'yes', now, now];

  if (at) {
    const old = sheet.getRange(at, 1, 1, AUTH.HEADERS.length).getValues()[0];
    row[5] = String(old[5] || '').trim() || 'yes';
    row[6] = old[6] || now;
    sheet.getRange(at, 1, 1, AUTH.HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

/**
 * สร้างผู้ใช้หรือตั้งรหัสผ่านใหม่ : รันจากหน้า editor
 * @param {string} username
 * @param {string} password อย่างน้อย 6 ตัวอักษร
 * @param {string=} name ชื่อที่แสดง
 * @param {string=} role admin | staff
 * @return {string}
 */
function setUserPassword(username, password, name, role) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');

  if (!user || pass.length < 6) {
    return 'ต้องมีชื่อผู้ใช้ และรหัสผ่านอย่างน้อย 6 ตัวอักษร';
  }

  const old = users_()[user] || {};
  const salt = Utilities.getUuid();

  saveUser_({
    username: user,
    name: String(name || old.name || user),
    role: String(role || old.role || 'staff'),
    salt: salt,
    hash: sha256_(salt + ':' + pass),
  });

  const msg = 'ตั้งรหัสผ่านของ "' + user + '" แล้ว (' + (role || old.role || 'staff') + ') — คนที่ล็อกอินค้างไว้ต้องเข้าสู่ระบบใหม่';

  Logger.log(msg);
  return msg;
}

/**
 * เตรียมชีตบัญชี + สร้างผู้ใช้ตั้งต้น admin / admin1234 (รันครั้งเดียวจาก editor)
 * ถ้าเคยเก็บผู้ใช้ไว้ใน Script Properties (เวอร์ชันก่อน) จะย้ายเข้าชีตให้ก่อน
 * @return {string}
 */
function setupAuth() {
  const sheet = usersSheet_();
  const props = PropertiesService.getScriptProperties();
  const moved = [];

  /* ย้ายบัญชีรุ่นเก่า (AUTH_USERS) เข้าชีต เมื่อชีตยังว่าง */
  const oldRaw = props.getProperty(AUTH.OLD_USERS_KEY);

  if (oldRaw && !Object.keys(users_()).length) {
    try {
      const list = JSON.parse(oldRaw) || {};

      Object.keys(list).forEach(function (user) {
        const rec = list[user] || {};

        saveUser_({
          username: String(user).trim().toLowerCase(),
          name: String(rec.name || user),
          role: String(rec.role || 'staff'),
          salt: String(rec.salt || ''),
          hash: String(rec.hash || ''),
        });
        moved.push(user);
      });
    } catch (err) {
      Logger.log('ย้ายบัญชีเดิมไม่สำเร็จ: ' + err);
    }

    if (moved.length) {
      props.deleteProperty(AUTH.OLD_USERS_KEY);
    }
  }

  if (!Object.keys(users_()).length) {
    setUserPassword('admin', 'admin1234', 'ผู้ดูแลระบบ', 'admin');
  }

  const list = Object.keys(users_());
  const lines = [
    'ชีตบัญชีเจ้าหน้าที่: ' + sheet.getParent().getName() + ' / ' + sheet.getName() + ' (' + list.length + ' คน)',
    'รายชื่อ: ' + list.join(', '),
    'ลิงก์ชีต: ' + sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId(),
  ];

  if (moved.length) {
    lines.push('ย้ายบัญชีจาก Script Properties: ' + moved.join(', '));
  }

  if (list.indexOf('admin') < 0) {
    lines.push('บัญชีตั้งต้น: admin / admin1234 — เปลี่ยนรหัสด้วย setUserPassword("admin", "รหัสใหม่", "ชื่อ", "admin")');
  }

  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}

/** ดูรายชื่อเจ้าหน้าที่ในชีต (รันจาก editor) */
function listUsers() {
  const users = users_();
  const list = Object.keys(users);
  const msg = list.length
    ? list.map(function (user) {
      const rec = users[user];
      return user + ' — ' + rec.name + ' (' + rec.role + ')' + (rec.active ? '' : ' [ปิดใช้งาน]');
    }).join('\n')
    : 'ยังไม่มีบัญชีเจ้าหน้าที่ — รัน setupAuth() ก่อน';

  Logger.log(msg);
  return msg;
}

/** จำนวนครั้งที่ล็อกอินผิด (ยังไม่หมดเวลาล็อก) */
function failedTries_(user) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(AUTH.TRY_PREFIX + user);

  if (!raw) {
    return 0;
  }

  try {
    const data = JSON.parse(raw);

    if (!data.until || data.until < Date.now()) {
      props.deleteProperty(AUTH.TRY_PREFIX + user);
      return 0;
    }

    return Number(data.n) || 0;
  } catch (err) {
    return 0;
  }
}

function noteFailedTry_(user) {
  const props = PropertiesService.getScriptProperties();
  const n = failedTries_(user) + 1;

  props.setProperty(AUTH.TRY_PREFIX + user, JSON.stringify({
    n: n,
    until: Date.now() + AUTH.LOCK_MINUTES * 60 * 1000,
  }));

  return n;
}

/**
 * เข้าสู่ระบบ
 * @param {string} username
 * @param {string} password
 * @return {Object} { ok, token, name, role, exp } หรือ { ok:false, message }
 */
function login(username, password) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');

  if (!user || !pass) {
    return { ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  }

  if (failedTries_(user) >= AUTH.MAX_TRIES) {
    return {
      ok: false,
      message: 'ลองผิดหลายครั้งเกินไป กรุณารอ ' + AUTH.LOCK_MINUTES + ' นาทีแล้วลองใหม่',
    };
  }

  const rec = users_()[user];

  if (!rec) {
    noteFailedTry_(user);
    return { ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  if (!rec.active) {
    return { ok: false, message: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
  }

  if (!rec.hash || rec.hash !== sha256_(rec.salt + ':' + pass)) {
    noteFailedTry_(user);
    return { ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  const props = PropertiesService.getScriptProperties();

  props.deleteProperty(AUTH.TRY_PREFIX + user);

  const token = Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + AUTH.TTL_HOURS * 60 * 60 * 1000;

  props.setProperty(AUTH.SESSION_PREFIX + token, JSON.stringify({
    user: user,
    name: rec.name,
    role: rec.role,
    exp: exp,
  }));

  return { ok: true, token: token, name: rec.name, role: rec.role, exp: exp };
}

/**
 * ตรวจ session
 * @param {string} token
 * @return {Object} { ok, name, role, exp } หรือ { ok:false }
 */
function sessionInfo(token) {
  const key = String(token || '');

  if (!key) {
    return { ok: false };
  }

  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(AUTH.SESSION_PREFIX + key);

  if (!raw) {
    return { ok: false };
  }

  let data;

  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { ok: false };
  }

  if (!data || !data.exp || data.exp < Date.now()) {
    props.deleteProperty(AUTH.SESSION_PREFIX + key);
    return { ok: false };
  }

  return { ok: true, name: data.name, role: data.role, exp: data.exp };
}

/** ออกจากระบบ (ลบ session ฝั่งเซิร์ฟเวอร์) */
function logout(token) {
  const key = String(token || '');

  if (key) {
    PropertiesService.getScriptProperties().deleteProperty(AUTH.SESSION_PREFIX + key);
  }

  return { ok: true };
}

/* ============================================================
 *  อ่านข้อมูลจากชีต (แดชบอร์ด / ครุภัณฑ์ / ติดตามสถานะ)
 *  หน้าที่ต้องล็อกอินจะตรวจ token ก่อนคืนข้อมูลเสมอ
 * ============================================================ */

/** ชื่อคอลัมน์ → ลำดับ (0 ฐาน) ตาม HEADERS */
const HEADER_INDEX = HEADERS.reduce(function (map, name, index) {
  map[name] = index;
  return map;
}, {});

/** ชีตครุภัณฑ์ (แยกจากชีตใบแจ้งซ่อม) */
const EQUIP = {
  SHEET_NAME: 'ครุภัณฑ์',
  HEADERS: [
    'รหัสครุภัณฑ์', 'ชื่อครุภัณฑ์', 'หมวดหมู่', 'หน่วยงาน', 'ผู้ครอบครอง', 'วันที่ได้มา', 'สถานะ',
  ],
  WIDTHS: [140, 260, 180, 150, 180, 130, 110],
};

/** ตรวจ token : คืน session หรือ null */
function requireSession_(token) {
  const info = sessionInfo(token);
  return info && info.ok ? info : null;
}

/** อ่านค่าจากแถวตามชื่อคอลัมน์ */
function cell_(row, header) {
  const index = HEADER_INDEX[header];

  if (index === undefined || index >= row.length) {
    return '';
  }

  return row[index];
}

/** แปลงวันที่ในชีตเป็นสตริงแบบ 2026-11-10T08:57:03 (เขตเวลาไทย) */
function isoLocal_(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) {
    return String(value).trim();
  }

  return Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

/** ไทม์ไลน์ของใบแจ้ง (สร้างจากคอลัมน์ที่มีอยู่) */
function stepsFor_(ticket) {
  const steps = [{ label: 'รับแจ้งปัญหา', at: ticket.reportedAt }];

  if (ticket.assignedAt) {
    steps.push({
      label: 'มอบหมายผู้รับผิดชอบ: ' + (ticket.owner || '—'),
      at: ticket.assignedAt,
    });
  }

  if (ticket.status === 'เสร็จสิ้น') {
    steps.push({ label: 'ปิดงาน', at: ticket.closedAt || '' });
  } else if (ticket.status === 'ยกเลิก') {
    steps.push({ label: 'ยกเลิกงาน', at: ticket.closedAt || '', current: !ticket.closedAt });
  } else if (ticket.status === 'กำลังดำเนินการ') {
    steps.push({ label: 'อยู่ระหว่างดำเนินการซ่อม', at: '', current: true });
  } else {
    steps.push({
      label: ticket.owner ? 'รอเริ่มดำเนินการ' : 'รอเจ้าหน้าที่รับเรื่อง',
      at: '',
      current: true,
    });
  }

  return steps;
}

/** แถวในชีต → ข้อมูลใบแจ้งที่หน้าเว็บใช้ */
function rowToTicket_(row) {
  const ticket = {
    no: String(cell_(row, 'เลขที่ใบแจ้ง') || '').trim(),
    reportedAt: isoLocal_(cell_(row, 'วันเวลาที่แจ้ง')),
    reporter: String(cell_(row, 'ชื่อผู้แจ้ง') || '').trim(),
    department: String(cell_(row, 'หน่วยงาน') || '').trim(),
    equipment: String(cell_(row, 'ครุภัณฑ์/อุปกรณ์') || '').trim(),
    equipCode: String(cell_(row, 'รหัสครุภัณฑ์') || '').trim(),
    category: String(cell_(row, 'หมวดหมู่') || '').trim(),
    location: String(cell_(row, 'สถานที่') || '').trim(),
    detail: String(cell_(row, 'อาการเสีย/รายละเอียด') || '').trim(),
    urgency: String(cell_(row, 'ความเร่งด่วน') || '').trim(),
    status: String(cell_(row, 'สถานะ') || '').trim() || STATUS_NEW,
    owner: String(cell_(row, 'ผู้รับผิดชอบ') || '').trim(),
    ownerEmail: String(cell_(row, 'อีเมลผู้รับผิดชอบ') || '').trim(),
    closedAt: isoLocal_(cell_(row, 'วันที่ปิดงาน')),
    assignedAt: isoLocal_(cell_(row, 'วันที่มอบหมาย')),
    phone: String(cell_(row, 'เบอร์โทร') || '').trim(),
    lineId: String(cell_(row, 'ไอดีไลน์') || '').trim(),
    contactChannel: String(cell_(row, 'ช่องทางติดต่อกลับ') || '').trim(),
    note: String(cell_(row, 'หมายเหตุ') || '').trim(),
    photos: [
      String(cell_(row, 'รูปภาพ') || '').trim(),
      String(cell_(row, 'รูปเพิ่มเติม 2') || '').trim(),
      String(cell_(row, 'รูปเพิ่มเติม 3') || '').trim(),
    ].filter(function (url) {
      return !!url;
    }),
    qrUrl: String(cell_(row, 'รูป QR LINE') || '').trim(),
  };

  ticket.steps = stepsFor_(ticket);
  return ticket;
}

/** ทุกใบแจ้งในชีต */
function readTicketRows_() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();

  if (last < 2) {
    return [];
  }

  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .map(rowToTicket_)
    .filter(function (ticket) {
      return ticket.no;
    });
}

/**
 * ใบแจ้งซ่อมทั้งหมด (หน้าแดชบอร์ด)
 * @param {string} token
 * @return {Object} { ok, rows } หรือ { ok:false, message }
 */
function getTickets(token) {
  if (!requireSession_(token)) {
    return { ok: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  }

  return { ok: true, rows: readTicketRows_() };
}

/**
 * ตัวเลขสรุปแดชบอร์ด (payload เล็ก ~1KB — หน้าเว็บโชว์การ์ดสรุป/บาร์ได้ก่อน
 * ไม่ต้องรอ getTickets ที่ขนข้อมูลทั้งชีต ~1MB)
 * นับลอจิกเดียวกับ renderSummary ฝั่งหน้าเว็บ : ทุกช่วงเวลา ไม่กรองวันที่
 * @param {string} token
 * @param {string} scope 'mine' = เฉพาะงานของฉัน (เทียบชื่อผู้รับผิดชอบ)
 * @param {string} ownerName ชื่อผู้ใช้ที่ล็อกอิน (ใช้เมื่อ scope เป็น mine)
 * @return {Object} { ok, total, done, progress, pending, cancel,
 *                     monthRows, monthDone, aging, avgDays, top }
 */
function getDashboardStats(token, scope, ownerName) {
  if (!requireSession_(token)) {
    return { ok: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  }

  var tickets = readTicketRows_();

  if (scope === 'mine') {
    var want = String(ownerName || '').trim().toLowerCase();
    tickets = tickets.filter(function (ticket) {
      return String(ticket.owner || '').trim().toLowerCase() === want;
    });
  }

  var now = new Date();
  var today = now.getTime();
  var done = 0;
  var progress = 0;
  var pending = 0;
  var cancel = 0;
  var monthRows = 0;
  var monthDone = 0;
  var aging = 0;
  var repairTotal = 0;
  var repairCount = 0;
  var equipCounts = {};

  tickets.forEach(function (ticket) {
    if (ticket.status === 'เสร็จสิ้น') {
      done += 1;
      var key = ticket.equipment || 'ไม่ระบุ';
      equipCounts[key] = (equipCounts[key] || 0) + 1;
    } else if (ticket.status === 'กำลังดำเนินการ') {
      progress += 1;
    } else if (ticket.status === 'รอดำเนินการ') {
      pending += 1;
    } else if (ticket.status === 'ยกเลิก') {
      cancel += 1;
    }

    var opened = ticket.reportedAt ? new Date(ticket.reportedAt) : null;

    if (opened && !isNaN(opened.getTime())) {
      if (opened.getFullYear() === now.getFullYear() &&
          opened.getMonth() === now.getMonth()) {
        monthRows += 1;
        if (ticket.status === 'เสร็จสิ้น') {
          monthDone += 1;
        }
      }

      if (ticket.status !== 'เสร็จสิ้น' && ticket.status !== 'ยกเลิก' &&
          (today - opened.getTime()) / 86400000 > 7) {
        aging += 1;
      }
    }

    if (ticket.status === 'เสร็จสิ้น' && ticket.reportedAt && ticket.closedAt) {
      var start = new Date(ticket.reportedAt).getTime();
      var end = new Date(ticket.closedAt).getTime();
      if (isFinite(start) && isFinite(end) && end >= start) {
        repairTotal += (end - start) / 86400000;
        repairCount += 1;
      }
    }
  });

  var top = Object.keys(equipCounts).map(function (name) {
    return { name: name, count: equipCounts[name] };
  }).sort(function (a, b) {
    return b.count - a.count;
  }).slice(0, 5);

  return {
    ok: true,
    total: tickets.length,
    done: done,
    progress: progress,
    pending: pending,
    cancel: cancel,
    monthRows: monthRows,
    monthDone: monthDone,
    aging: aging,
    avgDays: repairCount ? repairTotal / repairCount : 0,
    top: top,
  };
}

/**
 * ใบแจ้งซ่อมใบเดียว (หน้าติดตามสถานะ — ไม่ต้องล็อกอิน
 * กรอกเลขที่ใบแจ้ง "หรือ" เบอร์โทร/ไอดีไลน์ที่ใช้แจ้ง อย่างใดอย่างหนึ่งก็ได้
 * เลขที่ใบแจ้งเป็นรหัสสุ่มเดาไม่ได้ จึงค้นด้วยเลขอย่างเดียวได้
 * ถ้ากรอกทั้งสองช่องจะตรวจว่าข้อมูลติดต่อตรงกับใบนั้นด้วย)
 * @param {string} ticketNo เลขที่ใบแจ้ง (เว้นว่างได้ถ้ากรอก contact)
 * @param {string} contact เบอร์โทรหรือไอดีไลน์ของผู้แจ้ง (เว้นว่างได้ถ้ามีเลขที่ใบแจ้ง)
 * @return {Object} { ok, ticket } หรือ { ok, rows } (ค้นด้วยข้อมูลติดต่ออย่างเดียว)
 */
function getTicket(ticketNo, contact) {
  const want = normalizeNo_(ticketNo);
  const contactRaw = String(contact || '').trim();

  if (!want && !contactRaw) {
    return { ok: false, message: 'กรุณากรอกเลขที่ใบแจ้ง หรือเบอร์โทร/ไลน์ที่ใช้แจ้ง' };
  }

  const res = searchTickets_(readTicketRows_(), want, contactRaw);

  if (res.error) {
    return { ok: false, message: res.error };
  }

  if (res.ticket) {
    return { ok: true, ticket: res.ticket };
  }

  return { ok: true, rows: res.rows };
}

/** normalize เลขที่ใบแจ้ง (ตัวพิมพ์ใหญ่ทั้งหมด + ตัดช่องว่าง) */
function normalizeNo_(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * หัวใจการค้นหาใบแจ้ง (pure — ไม่แตะชีต เทสต์ใน harness ได้)
 * @return {Object} { ticket } | { rows } | { error }
 */
function searchTickets_(rows, want, contactRaw) {
  const list = rows || [];

  /* กรอกเลขที่ใบแจ้งมา (จะมีข้อมูลติดต่อด้วยหรือไม่ก็ได้) */
  if (want) {
    const found = list.filter(function (ticket) {
      return normalizeNo_(ticket.no) === want;
    })[0];

    /* ถ้ากรอกข้อมูลติดต่อมาด้วยต้องตรงกับใบนั้น ส่วนเลขสุ่มเดาไม่ได้อยู่แล้ว */
    if (!found || (contactRaw && !contactMatches_(found, contactRaw))) {
      return { error: 'ไม่พบใบแจ้งปัญหา กรุณาตรวจสอบเลขที่และข้อมูลติดต่อ' };
    }

    return { ticket: found };
  }

  /* กรอกข้อมูลติดต่ออย่างเดียว — คืนรายการทุกใบที่ใช้ข้อมูลนี้ (ใหม่สุดก่อน) */
  const hits = list.filter(function (ticket) {
    return contactMatches_(ticket, contactRaw);
  });

  if (!hits.length) {
    return { error: 'ไม่พบใบแจ้งปัญหาที่ใช้ข้อมูลติดต่อนี้' };
  }

  return {
    rows: hits.reverse().slice(0, 50).map(function (ticket) {
      return {
        no: ticket.no,
        reportedAt: ticket.reportedAt,
        category: ticket.category,
        urgency: ticket.urgency,
        status: ticket.status,
        equipment: ticket.equipment,
      };
    }),
  };
}

/** ตรวจว่า contact ตรงกับเบอร์โทร (เทียบเฉพาะตัวเลข) หรือไอดีไลน์ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
function contactMatches_(ticket, contactRaw) {
  const digits = String(contactRaw || '').replace(/\D/g, '');

  if (digits && String(ticket.phone || '').replace(/\D/g, '') === digits) {
    return true;
  }

  if (contactRaw && String(ticket.lineId || '').trim().toLowerCase() ===
      String(contactRaw).trim().toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * อัปเดตใบแจ้งปัญหา (หน้าแดชบอร์ด — ต้องล็อกอิน)
 * ประทับวันที่มอบหมาย/ปิดงานให้อัตโนมัติ เปิดงานซ้ำจะล้างวันที่ปิดงาน
 * @param {string} token
 * @param {Object} patch { no, status?, owner?, ownerEmail?, note? }
 * @return {Object} { ok, ticket } หรือ { ok:false, message }
 */
function updateTicket(token, patch) {
  if (!requireSession_(token)) {
    return { ok: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  }

  patch = patch || {};
  const want = String(patch.no || '').trim().toUpperCase().replace(/\s+/g, '');

  if (!want) {
    return { ok: false, message: 'กรุณาระบุเลขที่ใบแจ้งปัญหา' };
  }

  const allowedStatus = ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'];
  const hasStatus = Object.prototype.hasOwnProperty.call(patch, 'status');
  const status = String(patch.status || '').trim();

  if (hasStatus && allowedStatus.indexOf(status) < 0) {
    return { ok: false, message: 'สถานะไม่ถูกต้อง' };
  }

  const owner = String(patch.owner || '').trim().slice(0, 100);
  const ownerEmail = String(patch.ownerEmail || '').trim().slice(0, 120);

  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return { ok: false, message: 'อีเมลผู้รับผิดชอบไม่ถูกต้อง' };
  }

  const note = String(patch.note || '').trim().slice(0, 500);
  const hasNote = Object.prototype.hasOwnProperty.call(patch, 'note');

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  }

  try {
    const sheet = getSheet_();
    const last = sheet.getLastRow();

    if (last < 2) {
      return { ok: false, message: 'ไม่พบใบแจ้งปัญหานี้' };
    }

    const nos = sheet.getRange(2, 1, last - 1, 1).getValues();
    let at = 0;

    for (let i = 0; i < nos.length; i += 1) {
      if (String(nos[i][0] || '').trim().toUpperCase().replace(/\s+/g, '') === want) {
        at = i + 2;
        break;
      }
    }

    if (!at) {
      return { ok: false, message: 'ไม่พบใบแจ้งปัญหานี้' };
    }

    /* อ่านเฉพาะคอลัมน์ที่ต้องใช้ตัดสินใจ แล้วเขียนเฉพาะช่องที่เปลี่ยน
       (ไม่เขียนทับทั้งแถวเพื่อกันข้อมูลอื่นหาย) */
    const col = function (header) {
      return HEADER_INDEX[header] + 1;
    };
    const curStatus = String(sheet.getRange(at, col('สถานะ')).getValue() || '').trim();
    const curOwner = String(sheet.getRange(at, col('ผู้รับผิดชอบ')).getValue() || '').trim();
    const curAssigned = sheet.getRange(at, col('วันที่มอบหมาย')).getValue();
    const closedCell = sheet.getRange(at, col('วันที่ปิดงาน'));
    const now = new Date();

    if (hasStatus) {
      sheet.getRange(at, col('สถานะ')).setValue(status);
    }

    if (owner) {
      sheet.getRange(at, col('ผู้รับผิดชอบ')).setValue(owner);
    }

    if (ownerEmail) {
      sheet.getRange(at, col('อีเมลผู้รับผิดชอบ')).setValue(ownerEmail);
    }

    if (hasNote) {
      sheet.getRange(at, col('หมายเหตุ')).setValue(note);
    }

    const finalStatus = hasStatus ? status : curStatus;

    /* มอบหมายครั้งแรก หรือเปลี่ยนตัวผู้รับผิดชอบ = ประทับวันมอบหมายใหม่
       (เดิมประทับครั้งเดียว เปลี่ยนคนแล้ววันที่ยังเป็นของคนเก่า) */
    if (owner && (!curAssigned || owner !== curOwner)) {
      sheet.getRange(at, col('วันที่มอบหมาย')).setValue(now);
    }

    if (finalStatus === 'เสร็จสิ้น' || finalStatus === 'ยกเลิก') {
      if (!closedCell.getValue()) {
        closedCell.setValue(now);
      }
    } else if (hasStatus) {
      closedCell.clearContent();
    }

    const updated = sheet.getRange(at, 1, 1, HEADERS.length).getValues()[0];
    return { ok: true, ticket: rowToTicket_(updated) };
  } finally {
    lock.releaseLock();
  }
}

/** ชีตครุภัณฑ์ (สร้าง + หัวตารางให้เอง) */
function equipmentSheet_() {
  const ss = openSs_();
  const width = EQUIP.HEADERS.length;
  let sheet = ss.getSheetByName(EQUIP.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(EQUIP.SHEET_NAME);
  }

  const head = sheet.getLastRow() === 0
    ? []
    : sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) {
      return String(value).trim();
    });

  if (head[0]) {
    if (head[0] !== EQUIP.HEADERS[0]) {
      throw new Error(
        'ชีต "' + EQUIP.SHEET_NAME + '" มีอยู่แล้วแต่หัวตารางไม่ใช่ "' + EQUIP.HEADERS[0] + '" ' +
        'กรุณาเปลี่ยนชื่อชีตหรือล้างข้อมูลก่อนใช้งาน'
      );
    }
    return sheet;
  }

  sheet.getRange(1, 1, 1, width)
    .setValues([EQUIP.HEADERS])
    .setFontWeight('bold')
    .setBackground('#0f4c5c')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  EQUIP.WIDTHS.forEach(function (w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  return sheet;
}

/**
 * รายชื่อเจ้าหน้าที่ (สำหรับ datalist ช่องผู้รับผิดชอบในโมดัล)
 * คืนเฉพาะชื่อที่ active — ไม่ส่ง salt/hash ออกไป
 * @param {string} token
 * @return {Object} { ok, staff } หรือ { ok:false, message }
 */
function getStaffList(token) {
  if (!requireSession_(token)) {
    return { ok: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  }

  const users = users_();
  const staff = Object.keys(users)
    .filter(function (key) {
      return users[key].active;
    })
    .map(function (key) {
      return users[key].name;
    })
    .sort(function (a, b) {
      return String(a).localeCompare(String(b), 'th');
    });

  return { ok: true, staff: staff };
}

/**
 * รายการครุภัณฑ์ (หน้าครุภัณฑ์)
 * @param {string} token
 * @return {Object} { ok, rows }
 */
function getEquipmentItems(token) {
  if (!requireSession_(token)) {
    return { ok: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  }

  const sheet = equipmentSheet_();
  const last = sheet.getLastRow();
  const rows = [];

  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, EQUIP.HEADERS.length).getValues()
      .forEach(function (row) {
        const code = String(row[0] || '').trim();

        if (!code) {
          return;
        }

        rows.push({
          equipCode: code,
          name: String(row[1] || '').trim(),
          category: String(row[2] || '').trim(),
          department: String(row[3] || '').trim(),
          owner: String(row[4] || '').trim(),
          acquiredAt: isoLocal_(row[5]).slice(0, 10),
          status: String(row[6] || '').trim() || 'ใช้งาน',
        });
      });
  }

  return { ok: true, rows: rows };
}

/* ============================================================
 *  ข้อมูลตัวอย่าง (ชุดเดียวกับที่เคยฝังอยู่ในหน้าเว็บ)
 *  วิธีใช้: หน้า editor → เลือก seedDemoData → Run (ครั้งเดียว)
 * ============================================================ */

const DEMO = {
  seed: 20261112,
  /* สร้าง 1999 ใบ + ใบอ้างอิง RQ2611-0001 อีก 1 ใบ = ลงชีต 2000 ใบพอดี */
  rowCount: 1999,
  names: [
    'พีรวิชญ์ นวลทอง', 'สมชาย ใจดี', 'ปวีณา สุขศรี', 'อรุณี พรหมมา', 'นภาพร วงศ์ทอง',
    'วีระชัย ศรีสมบัติ', 'กนกวรรณ ใจงาม', 'ธนากร พูลผล', 'มณีรัตน์ ทองดี', 'ศิริชัย บุญมา',
    'ณัฐพงษ์ แก้วประเสริฐ', 'รัตนา จันทร์เพ็ญ', 'อนุชา ภูผา', 'จิราพร แสงทอง', 'ปรีชา ตั้งใจ',
    'อรทัย สุขใจ', 'ชัยวัฒน์ เมืองไทย', 'สุพัตรา ดวงแก้ว', 'ทวีศักดิ์ พรหมมา', 'เบญจวรรณ ใจดี',
  ],
  departments: [
    'ศูนย์การแพทย์แผนไทยและการแพทย์ทางเลือก',
    'ศพท.เขตสุขภาพที่ 1 จ.ลำปาง',
    'ศพท.เขตสุขภาพที่ 2 จ.สุโขทัย',
    'ศพท.เขตสุขภาพที่ 3 จ.นครสวรรค์',
    'ศพท.เขตสุขภาพที่ 4 จ.นนทบุรี สาขาตักศิลา',
    'ศพท.เขตสุขภาพที่ 4 จ.นนทบุรี สาขาสยามมณี',
    'ศพท.เขตสุขภาพที่ 5 จ.นครปฐม',
    'ศพท.เขตสุขภาพที่ 6 จ.ฉะเชิงเทรา',
    'ศพท.เขตสุขภาพที่ 7 จ.ขอนแก่น',
    'ศพท.เขตสุขภาพที่ 8 จ.อุดรธานี',
    'ศพท.เขตสุขภาพที่ 9 จ.สุรินทร์',
    'ศพท.เขตสุขภาพที่ 10 จ.อุบลราชธานี',
    'ศพท.เขตสุขภาพที่ 11 จ.ชุมพร',
    'ศพท.เขตสุขภาพที่ 12 จ.พัทลุง',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขายศเส',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขาแจ้งวัฒนะ',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขามีนบุรี',
    'ศพท.เขตสุขภาพที่ 13 กรุงเทพมหานคร สาขารัฐสภา',
  ],
  equipment: [
    'คอมพิวเตอร์ตั้งโต๊ะ', 'โน้ตบุ๊ก', 'จอภาพ/มอนิเตอร์', 'เครื่องพิมพ์เลเซอร์', 'เครื่องสแกนเนอร์',
    'โปรเจกเตอร์', 'เครื่องปรับอากาศ', 'ระบบโทรศัพท์/สายสัญญาณ', 'ระบบเครือข่าย/อินเทอร์เน็ต',
    'เครื่องเสียงห้องประชุม',
  ],
  owners: [
    { name: 'สมพงษ์ ช่างซ่อม', email: 'sompong@example.ac.th' },
    { name: 'ตระกูลศักดิ์ หุนประเสริฐ', email: 'trakul@example.ac.th' },
    { name: 'ช่างประจำอาคาร', email: 'building@example.ac.th' },
    { name: 'วีระ อินทร์ทอง', email: 'weera@example.ac.th' },
    { name: 'ปรีชา ตั้งใจ', email: 'preecha@example.ac.th' },
  ],
  statuses: [
    { value: 'เสร็จสิ้น', weight: 60 },
    { value: 'กำลังดำเนินการ', weight: 25 },
    { value: 'รอดำเนินการ', weight: 10 },
    { value: 'ยกเลิก', weight: 5 },
  ],
  locations: [
    'อาคาร 1 ชั้น 1 ห้องธุรการ',
    'อาคาร 1 ชั้น 2 ห้องประชุม',
    'อาคาร 2 ชั้น 1 ห้องการเงิน',
    'อาคาร 2 ชั้น 2 ห้องพัสดุ',
    'อาคาร 3 ชั้น 1 ห้องคอมพิวเตอร์',
    'อาคารศูนย์ฯ ชั้น 1 ห้อง IT',
    'อาคารศูนย์ฯ ชั้น 2 ห้องวิชาการ',
    'อาคารอเนกประสงค์ ชั้น 1 ห้องประชุมใหญ่',
    'อาคารเรียน ชั้น 3 ห้อง 301',
    'อาคารเรียน ชั้น 4 ห้อง 402',
  ],
  details: [
    'เปิดเครื่องไม่ติด ไม่มีไฟเข้า',
    'เครื่องพิมพ์ติดกระดาษและมีเสียงดังผิดปกติ',
    'จอภาพมีเส้นแนวตั้ง ภาพสั่น',
    'อินเทอร์เน็ตหลุดบ่อย ใช้งานไม่ได้เป็นช่วง ๆ',
    'เครื่องปรับอากาศไม่เย็น มีน้ำหยดจากตัวเครื่อง',
    'โปรเจกเตอร์ภาพเบลอและมีจุดดำกลางจอ',
    'เครื่องเสียงมีเสียงฮัม ไม่มีเสียงออกลำโพง',
    'แป้นพิมพ์บางปุ่มกดไม่ติด',
    'คอมพิวเตอร์รีสตาร์ตเองเป็นระยะ',
    'สแกนเนอร์ดึงกระดาษติดและสแกนไม่ครบหน้า',
  ],
};

/**
 * สร้างใบแจ้งตัวอย่าง 1,000 ใบ (อัลกอริทึมเดียวกับที่เคยอยู่ใน Dashboard.html)
 * + ใบอ้างอิงของหน้าติดตามสถานะ
 * @return {Array<Object>}
 */
function demoTicketObjects_() {
  let seed = DEMO.seed;

  const random = function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const randomInt = function (min, max) {
    return min + Math.floor(random() * (max - min + 1));
  };
  const pick = function (list) {
    return list[Math.floor(random() * list.length)];
  };
  const pad = function (value, length) {
    let text = String(value);
    while (text.length < length) {
      text = '0' + text;
    }
    return text;
  };
  const randomStatus = function () {
    const total = DEMO.statuses.reduce(function (sum, item) {
      return sum + item.weight;
    }, 0);
    let point = random() * total;

    for (let i = 0; i < DEMO.statuses.length; i += 1) {
      point -= DEMO.statuses[i].weight;
      if (point <= 0) {
        return DEMO.statuses[i].value;
      }
    }

    return DEMO.statuses[0].value;
  };

  const start = new Date(2025, 10, 1, 8, 0, 0).getTime();   /* 1 พ.ย. 2568 */
  const spanMs = 375 * 24 * 60 * 60 * 1000;                /* ถึง พ.ย. 2569 */
  const limit = new Date(2026, 10, 12, 17, 0, 0).getTime();
  const list = [];

  for (let i = 0; i < DEMO.rowCount; i += 1) {
    /* สุ่มเฉพาะสถานะที่ปิดการสุ่ม "รอดำเนินการ" ออก — ใบรอดำเนินการ
       จะบังคับให้มีexactly 5 ใบหลังหัก patch ด้านล่าง */
    let status = randomStatus();
    if (status === 'รอดำเนินการ') {
      status = pick(['เสร็จสิ้น', 'กำลังดำเนินการ', 'ยกเลิก']);
    }
    const reportedAt = new Date(start + random() * spanMs);
    let closedAt = '';

    if (status === 'เสร็จสิ้น') {
      const closedTime = reportedAt.getTime() + randomInt(1, 14) * 86400000 +
        randomInt(0, 8) * 3600000;
      closedAt = new Date(Math.min(closedTime, limit));
    }

    const hasCode = random() > 0.15;
    const owner = pick(DEMO.owners);
    const equipCode = hasCode
      ? '7440-' + pad(randomInt(1, 9), 3) + '-' + pad(randomInt(1, 400), 4)
      : 'ไม่มีเลขครุภัณฑ์';
    const equipment = pick(DEMO.equipment);
    const reporter = pick(DEMO.names);
    const department = pick(DEMO.departments);
    const assigned = status !== 'รอดำเนินการ'
      ? new Date(Math.min(reportedAt.getTime() + (2 + (i % 5)) * 3600000, limit))
      : '';

    list.push({
      no: 'J110969C04S20N' + (2766 + i),
      reportedAt: reportedAt,
      reporter: reporter,
      department: department,
      /* เบอร์โทรสมมติแบบเดาได้ (ใช้ทดสอบค้นหาในหน้าติดตามสถานะ) */
      phone: '081-555-' + pad(2766 + i, 4),
      contactChannel: 'โทรศัพท์',
      equipment: equipment,
      equipCode: equipCode,
      category: '',
      location: DEMO.locations[i % DEMO.locations.length],
      detail: DEMO.details[i % DEMO.details.length],
      urgency: LISTS.urgencies[i % LISTS.urgencies.length],
      status: status,
      owner: status === 'รอดำเนินการ' ? '' : owner.name,
      ownerEmail: status === 'รอดำเนินการ' ? '' : owner.email,
      assignedAt: assigned,
      closedAt: closedAt,
      /* รูปตัวอย่าง (picsum) ประมาณ 1 ใน 3 ใบ — ให้เห็นคอลัมน์รูปในตาราง
         ล้างทิ้งพร้อมข้อมูลตัวอย่างอื่นก่อนเปิดใช้จริง */
      photoUrls: (function () {
        if (i % 9 === 0) {
          return [
            'https://picsum.photos/seed/dtam' + (2766 + i) + 'a/400/300',
            'https://picsum.photos/seed/dtam' + (2766 + i) + 'b/400/300',
          ];
        }
        if (i % 3 === 0) {
          return ['https://picsum.photos/seed/dtam' + (2766 + i) + '/400/300'];
        }
        return [];
      })(),
    });
  }

  /* ใบอ้างอิงจากหน้าติดตามสถานะ (ให้ค้นด้วยเลขเดิมที่เคยใช้ทดสอบได้) */
  const patches = {
    J110969C04S20N2766: {
      reportedAt: new Date('2026-09-11T08:38:16'),
      reporter: 'พีรวิชญ์ นวลทอง', department: 'ศพท.เขตสุขภาพที่ 1 จ.ลำปาง',
      phone: '082-111-2233', contactChannel: 'โทรศัพท์',
      equipment: 'ระบบโทรศัพท์/สายสัญญาณ', equipCode: 'ไม่มีเลขครุภัณฑ์',
      location: 'อาคารศูนย์ฯ ชั้น 1 ห้อง IT',
      owner: 'ตระกูลศักดิ์ หุนประเสริฐ', ownerEmail: 'trakul@example.ac.th',
      detail: 'สายสัญญาณโทรศัพท์ขาด ทำให้โทรออกไม่ได้',
      status: 'เสร็จสิ้น',
      assignedAt: new Date('2026-09-12T09:00:00'),
      closedAt: new Date('2026-09-17T09:16:43'),
      photoUrls: [
        'https://picsum.photos/seed/dtam2766a/400/300',
        'https://picsum.photos/seed/dtam2766b/400/300',
        'https://picsum.photos/seed/dtam2766c/400/300',
      ],
    },
    J110969C04S20N2784: {
      reportedAt: new Date('2026-10-21T13:45:30'),
      reporter: 'ปวีณา สุขศรี', department: 'ศพท.เขตสุขภาพที่ 5 จ.นครปฐม',
      phone: '083-777-8899', contactChannel: 'โทรศัพท์',
      equipment: 'เครื่องพิมพ์เลเซอร์', equipCode: '7440-002-0015',
      location: 'อาคาร 2 ชั้น 1 ห้องการเงิน',
      owner: 'สมพงษ์ ช่างซ่อม', ownerEmail: 'sompong@example.ac.th',
      detail: 'เครื่องพิมพ์ติดกระดาษและมีเสียงดังผิดปกติ',
      status: 'กำลังดำเนินการ',
      assignedAt: new Date('2026-10-22T09:10:00'),
      closedAt: '',
      photoUrls: ['https://picsum.photos/seed/dtam2784/400/300'],
    },
    J110969C04S20N2803: {
      reportedAt: new Date('2026-11-05T15:22:41'),
      reporter: 'พีรวิชญ์ นวลทอง', department: 'ศพท.เขตสุขภาพที่ 7 จ.ขอนแก่น',
      phone: '', lineId: 'it-support', contactChannel: 'LINE',
      equipment: 'ระบบเครือข่าย/อินเทอร์เน็ต', equipCode: 'ไม่มีเลขครุภัณฑ์',
      location: 'อาคารศูนย์ฯ ชั้น 1 ห้อง IT',
      owner: '', ownerEmail: '',
      detail: 'อินเทอร์เน็ตห้อง IT หลุดบ่อย',
      status: 'รอดำเนินการ',
      photoUrls: ['https://picsum.photos/seed/dtam2803/400/300'],
      assignedAt: '',
      closedAt: '',
    },
  };

  list.forEach(function (ticket) {
    const patch = patches[ticket.no];

    if (!patch) {
      return;
    }

    Object.keys(patch).forEach(function (key) {
      ticket[key] = patch[key];
    });
  });

  /* บังคับให้มีใบ "รอดำเนินการ" รวม 5 ใบพอดี
     (ใบนึงคือ patch 2803 ที่เป็นรอดำเนินการอยู่แล้ว + อีก 4 ใบเลือกจากเลขที่ไม่ใช่ patch
     ตั้งวันแจ้งให้อยู่ในช่วงล่าสุดเพื่อทดสอบง่าย) */
  ['J110969C04S20N2771', 'J110969C04S20N3000', 'J110969C04S20N3500', 'J110969C04S20N4000']
    .forEach(function (no, k) {
      const found = list.filter(function (ticket) {
        return ticket.no === no;
      })[0];

      if (!found) {
        return;
      }

      found.status = 'รอดำเนินการ';
      found.owner = '';
      found.ownerEmail = '';
      found.assignedAt = '';
      found.closedAt = '';
      found.reportedAt = new Date(2026, 10, 10 + k, 9 + k, 15, 0);
    });

  /* ใบรูปแบบ RQ (เลขที่ที่ submitForm สร้าง) ใช้เป็นตัวอย่างหน้าแรก */
  list.push({
    no: 'RQ2611-0001',
    reportedAt: new Date('2026-11-10T08:57:03'),
    reporter: 'นภาพร วงศ์ทอง',      department: 'ศูนย์การแพทย์แผนไทยและการแพทย์ทางเลือก',
    phone: '081-234-5678', contactChannel: 'โทรศัพท์',
    equipment: 'เครื่องปรับอากาศ',
    equipCode: '7440-004-0021',
    category: 'ครุภัณฑ์สำนักงาน',
    location: 'อาคาร 1 ชั้น 2 ห้องประชุม',
    detail: 'แอร์ไม่เย็น มีน้ำหยดจากตัวเครื่อง',
    urgency: 'เร่งด่วน',
    status: 'กำลังดำเนินการ',
    owner: 'ช่างประจำอาคาร',
    ownerEmail: 'building@example.ac.th',
    assignedAt: new Date('2026-11-10T11:20:00'),
    closedAt: '',
    photoUrls: ['https://picsum.photos/seed/dtamRQ2611/400/300'],
  });

  list.sort(function (a, b) {
    return new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
  });

  return list;
}

/** ข้อมูลใบแจ้ง → แถวเรียงตาม HEADERS */
function ticketToRow_(ticket) {
  const row = HEADERS.map(function () {
    return '';
  });
  const put = function (header, value) {
    const index = HEADER_INDEX[header];

    if (index !== undefined) {
      row[index] = value === null || value === undefined ? '' : value;
    }
  };

  put('เลขที่ใบแจ้ง', ticket.no);
  put('วันเวลาที่แจ้ง', ticket.reportedAt || '');
  put('ชื่อผู้แจ้ง', ticket.reporter || '');
  put('หน่วยงาน', ticket.department || '');
  put('เบอร์โทร', ticket.phone || '');
  put('อีเมล', ticket.email || '');
  put('ครุภัณฑ์/อุปกรณ์', ticket.equipment || '');
  put('รหัสครุภัณฑ์', ticket.equipCode || '');
  put('หมวดหมู่', ticket.category || '');
  put('สถานที่', ticket.location || '');
  put('อาการเสีย/รายละเอียด', ticket.detail || '');
  put('ความเร่งด่วน', ticket.urgency || 'ปกติ');
  put('ไอดีไลน์', ticket.lineId || '');
  put('ช่องทางติดต่อกลับ', ticket.contactChannel || (ticket.lineId ? 'LINE' : 'โทรศัพท์'));
  put('สถานะ', ticket.status || STATUS_NEW);
  put('ผู้รับผิดชอบ', ticket.owner || '');
  put('วันที่ปิดงาน', ticket.closedAt || '');
  put('อีเมลผู้รับผิดชอบ', ticket.ownerEmail || '');
  put('วันที่มอบหมาย', ticket.assignedAt || '');
  put('รูปภาพ', (ticket.photoUrls || [])[0] || '');
  put('รูปเพิ่มเติม 2', (ticket.photoUrls || [])[1] || '');
  put('รูปเพิ่มเติม 3', (ticket.photoUrls || [])[2] || '');

  return row;
}

/** ครุภัณฑ์ตัวอย่าง 8 รายการ (ชุดเดิมจากหน้า Equipment) */
function demoEquipmentItems_() {
  return [
    {
      equipCode: '7440-001-0001', name: 'คอมพิวเตอร์ตั้งโต๊ะ (Dell OptiPlex)',
      category: 'คอมพิวเตอร์/โน้ตบุ๊ก', department: 'ศูนย์การแพทย์แผนไทยและการแพทย์ทางเลือก',
      owner: 'สมชาย ใจดี', acquiredAt: '2023-04-12', status: 'ใช้งาน',
    },
    {
      equipCode: '7440-002-0015', name: 'เครื่องพิมพ์เลเซอร์ HP LaserJet',
      category: 'เครื่องพิมพ์/สแกนเนอร์', department: 'ศพท.เขตสุขภาพที่ 5 จ.นครปฐม',
      owner: 'ปวีณา สุขศรี', acquiredAt: '2022-11-08', status: 'ส่งซ่อม',
    },
    {
      equipCode: '7440-003-0007', name: 'โปรเจกเตอร์ Epson EB-X06',
      category: 'โปรเจกเตอร์/ทีวี', department: 'ศพท.เขตสุขภาพที่ 7 จ.ขอนแก่น',
      owner: 'อรุณี พรหมมา', acquiredAt: '2024-01-25', status: 'ใช้งาน',
    },
    {
      equipCode: '7440-004-0021', name: 'เครื่องปรับอากาศ Carrier 18,000 BTU',
      category: 'ครุภัณฑ์สำนักงาน', department: 'ศพท.เขตสุขภาพที่ 4 จ.นนทบุรี สาขาตักศิลา',
      owner: 'ช่างประจำอาคาร', acquiredAt: '2021-06-30', status: 'ชำรุด',
    },
    {
      equipCode: '7440-005-0003', name: 'โน้ตบุ๊ก ASUS VivoBook',
      category: 'คอมพิวเตอร์/โน้ตบุ๊ก', department: 'ศูนย์การแพทย์แผนไทยและการแพทย์ทางเลือก',
      owner: 'ผู้อำนวยการ', acquiredAt: '2024-08-19', status: 'ใช้งาน',
    },
    {
      equipCode: '7440-006-0011', name: 'เครื่องเสียงห้องประชุม',
      category: 'เครื่องเสียง', department: 'ศพท.เขตสุขภาพที่ 2 จ.สุโขทัย',
      owner: 'ธุรการกลาง', acquiredAt: '2020-02-14', status: 'จำหน่าย',
    },
    {
      equipCode: '7440-007-0002', name: 'จอภาพ LED 24 นิ้ว',
      category: 'จอภาพ/มอนิเตอร์', department: 'ศพท.เขตสุขภาพที่ 1 จ.ลำปาง',
      owner: 'พีรวิชญ์ นวลทอง', acquiredAt: '2025-03-03', status: 'ใช้งาน',
    },
    {
      equipCode: '7440-008-0009', name: 'สแกนเนอร์ Fujitsu fi-7160',
      category: 'เครื่องพิมพ์/สแกนเนอร์', department: 'ศพท.เขตสุขภาพที่ 9 จ.สุรินทร์',
      owner: 'ปวีณา สุขศรี', acquiredAt: '2022-07-11', status: 'ใช้งาน',
    },
  ];
}

/** ข้อมูลครุภัณฑ์ → แถวเรียงตาม EQUIP.HEADERS */
function equipmentToRow_(item) {
  return [
    item.equipCode, item.name, item.category, item.department,
    item.owner, item.acquiredAt, item.status,
  ];
}

/**
 * ใส่ข้อมูลตัวอย่างเข้าชีต (รันครั้งเดียวจากหน้า editor)
 * @param {boolean=} reset true = ล้างข้อมูลเดิมในชีตทั้งสองก่อน (ระวัง: ใบแจ้งจริงจะหายด้วย)
 * @return {string}
 */
function seedDemoData(reset) {
  const sheet = getSheet_();
  const existing = Math.max(0, sheet.getLastRow() - 1);

  if (existing && !reset) {
    const warn = 'ชีต "' + sheet.getName() + '" มีข้อมูลอยู่แล้ว ' + existing +
      ' รายการ — ถ้าต้องการล้างและใส่ข้อมูลตัวอย่างใหม่ ให้รัน seedDemoData(true)';

    Logger.log(warn);
    return warn;
  }

  if (existing) {
    sheet.getRange(2, 1, existing, HEADERS.length).clearContent();
  }

  const tickets = demoTicketObjects_();
  sheet.getRange(2, 1, tickets.length, HEADERS.length)
    .setValues(tickets.map(ticketToRow_));
  sheet.getRange(2, 2, tickets.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  ['วันที่ปิดงาน', 'วันที่มอบหมาย'].forEach(function (header) {
    sheet.getRange(2, HEADER_INDEX[header] + 1, tickets.length, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');
  });

  const equipSheet = equipmentSheet_();
  const equipExisting = Math.max(0, equipSheet.getLastRow() - 1);

  if (equipExisting) {
    equipSheet.getRange(2, 1, equipExisting, EQUIP.HEADERS.length).clearContent();
  }

  const equipItems = demoEquipmentItems_();
  equipSheet.getRange(2, 1, equipItems.length, EQUIP.HEADERS.length)
    .setValues(equipItems.map(equipmentToRow_));

  const msg = [
    'ใส่ข้อมูลตัวอย่างลงชีตเรียบร้อย',
    'ใบแจ้งซ่อม: ' + tickets.length + ' รายการ → ชีต "' + sheet.getName() + '"',
    'ครุภัณฑ์: ' + equipItems.length + ' รายการ → ชีต "' + equipSheet.getName() + '"',
    'เปิดดู: ' + sheet.getParent().getUrl(),
  ].join('\n');

  Logger.log(msg);
  return msg;
}

/**
 * URL จริงของเว็บแอป (…/exec หรือ …/dev)
 * @return {string} สตริงว่าง ถ้าอ่านไม่ได้ (เช่น รันนอกบริบทเว็บแอป)
 */
function baseUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

/**
 * เติม <script> ค่าเริ่มต้นของหน้าเว็บไว้ใน <head> (ต้องมาก่อนสคริปต์ของหน้า):
 *   window.__DTAM_BASE   URL จริงของเว็บแอป (…/exec) — ใช้ต่อลิงก์ให้ถูกโดเมน
 *   window.__DTAM_TOKEN  token ของผู้ใช้ที่ตรวจแล้ว (ถ้ามี)
 *   window.__DTAM_NAME / __DTAM_ROLE / __DTAM_EXP  ข้อมูลผู้ใช้
 *   window.__DTAM_PAGE   หน้าที่กำลังแสดง
 * @param {string} html HTML ของหน้า
 * @param {Object} session { token, name, role, exp, page }
 * @return {string}
 */
function withBootScript_(html, session) {
  const data = session || {};
  const parts = [];
  const base = baseUrl_();

  if (base) {
    parts.push('window.__DTAM_BASE=' + JSON.stringify(base));
  }

  if (data.token) {
    parts.push('window.__DTAM_TOKEN=' + JSON.stringify(String(data.token)));

    if (data.name) {
      parts.push('window.__DTAM_NAME=' + JSON.stringify(String(data.name)));
    }

    if (data.role) {
      parts.push('window.__DTAM_ROLE=' + JSON.stringify(String(data.role)));
    }

    if (data.exp) {
      parts.push('window.__DTAM_EXP=' + Number(data.exp));
    }
  }    parts.push('window.__DTAM_PAGE=' + JSON.stringify(String(data.page || 'form')));

  /* บอกหน้ากากที่ฝัง iframe (เช่น GitHub Pages) ว่าแอปเริ่มทำงานแล้ว
     หน้ากากจะได้จาง splash "กำลังเปิดระบบ" ออกตอนที่ loader ข้างในขึ้นพอดี
     (ไม่ต้องรอ iframe load ที่วัดได้แค่ wrapper ของ Google)
     ส่งทุกครั้งรวม NavJS สลับหน้า — ฝั่งหน้ากากซ่อนซ้ำได้อย่างปลอดภัย */
  parts.push(
    'try{if(window.top&&window.top!==window.self){window.top.postMessage(' +
    JSON.stringify({ dtam: 'auth', type: 'ready', page: String(data.page || 'form') }) +
    ',"*");}}catch(e){}'
  );

  const tag = '<script>' + parts.join(';') + ';</script>';
  const lowered = html.toLowerCase();
  let at = lowered.lastIndexOf('</head>');

  if (at < 0) {
    at = lowered.lastIndexOf('</body>');
  }

  return at < 0 ? tag + html : html.slice(0, at) + tag + html.slice(at);
}

/** ชื่อผู้ใช้ที่แสดงบนหน้าเว็บ (ขั้นถัดไป: เปลี่ยนเป็นชื่อจากระบบล็อกอินของศูนย์) */
function currentUserName_() {
  try {
    return Session.getActiveUser().getEmail() || 'ผู้ใช้งาน';
  } catch (err) {
    return 'ผู้ใช้งาน';
  }
}

/**
 * รับข้อมูลจากฟอร์มและบันทึกลงชีต
 * @param {Object} data ข้อมูลจากหน้าเว็บ
 * @return {Object} { ok, ticketNo, photoUrls, qrUrl }
 */
function submitForm(data) {
  data = data || {};

  const name = requireText_(data.name, 'ชื่อผู้แจ้ง', 100);
  let department = String(data.department || '').trim().slice(0, 100);
  if (LISTS.departments.indexOf(department) < 0) {
    department = 'อื่น ๆ';
  }

  /* ช่องทางติดต่อกลับ : ต้องมีข้อมูลของช่องทางที่เลือก */
  const contactChannel = data.contactChannel === 'line' ? 'LINE' : 'โทรศัพท์';
  const phone = String(data.phone || '').trim().slice(0, 20);
  const lineId = String(data.lineId || '').trim().slice(0, 60);

  if (contactChannel === 'LINE') {
    if (!lineId) {
      throw new Error('กรุณากรอกไอดีไลน์');
    }
  } else if (!phone) {
    throw new Error('กรุณากรอกเบอร์โทรติดต่อ');
  }

  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) {
    throw new Error('เบอร์โทรติดต่อไม่ถูกต้อง');
  }

  if (lineId && !/^@?[A-Za-z0-9._-]{2,40}$/.test(lineId)) {
    throw new Error('ไอดีไลน์ไม่ถูกต้อง');
  }

  const email = String(data.email || '').trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('อีเมลไม่ถูกต้อง');
  }

  /* ชื่อครุภัณฑ์/อุปกรณ์: ไม่บังคับ (ฟอร์มไม่มีช่องนี้แล้ว) */
  const itemName = String(data.itemName || '').trim().slice(0, 150);
  const itemCode = String(data.itemCode || '').trim().slice(0, 50);
  const category = requireText_(data.category, 'หมวดหมู่', 100);
  if (LISTS.categories.indexOf(category) < 0) {
    throw new Error('หมวดหมู่ที่เลือกไม่ถูกต้อง');
  }

  const location = String(data.location || '').trim().slice(0, 150);
  const detail = requireText_(data.detail, 'อาการเสีย/รายละเอียด', 2000);

  /* หมายเหตุจากผู้แจ้ง : ต่อท้ายรายละเอียด (คอลัมน์ "หมายเหตุ" เก็บไว้ให้เจ้าหน้าที่ใช้) */
  const note = String(data.note || '').trim().slice(0, 500);
  const detailFull = note ? detail + '\n\nหมายเหตุจากผู้แจ้ง: ' + note : detail;
  let urgency = String(data.urgency || 'ปกติ').trim();
  if (LISTS.urgencies.indexOf(urgency) < 0) {
    urgency = 'ปกติ';
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  }

  try {
    const sheet = getSheet_();
    const ticketNo = nextTicketNo_(sheet);
    const now = new Date();

    /* รูปอาการเสียสูงสุด 3 ภาพ + รูป QR LINE แยกจากกัน */
    const photoFiles = (Array.isArray(data.photos) ? data.photos : [])
      .filter(function (file) { return file && file.data; })
      .slice(0, 3);
    const qrFile = data.qrFile && data.qrFile.data ? data.qrFile : null;

    /* เผื่อหน้าเว็บรุ่นก่อนที่ยังส่ง data.file มาไฟล์เดียว */
    if (!photoFiles.length && data.file && data.file.data) {
      photoFiles.push(data.file);
    }

    const photoUrls = photoFiles.map(function (file) {
      return saveFile_(file);
    });
    const qrUrl = qrFile ? saveFile_(qrFile) : '';

    const rowValues = [
      ticketNo,
      now,
      name,
      department,
      phone,
      email,
      itemName,
      itemCode,
      category,
      location,
      detailFull,
      urgency,
      photoUrls[0] || '',
      STATUS_NEW,
      '',
      '',
      lineId,
      contactChannel,
      qrUrl,
      photoUrls[1] || '',
      photoUrls[2] || '',
    ];

    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(row, 2).setNumberFormat('dd/MM/yyyy HH:mm');
    sheet.getRange(row, 1, 1, rowValues.length).setVerticalAlignment('top');
    sheet.getRange(row, 11).setWrap(true);

    notify_({
      ticketNo: ticketNo,
      time: now,
      name: name,
      department: department,
      phone: phone,
      lineId: lineId,
      contactChannel: contactChannel,
      email: email,
      itemName: itemName,
      itemCode: itemCode,
      category: category,
      location: location,
      detail: detailFull,
      urgency: urgency,
      fileUrls: photoUrls,
      qrUrl: qrUrl,
    });

    return { ok: true, ticketNo: ticketNo, photoUrls: photoUrls, qrUrl: qrUrl };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ตรวจสอบการตั้งค่า — รันจากหน้า editor เพื่อดูผลใน Execution log
 * @return {string}
 */
function testSetup() {
  const sheet = getSheet_();
  const folder = getFolder_();
  const info = [
    'ชีต: ' + sheet.getParent().getName() + ' / ' + sheet.getName() +
      ' (' + Math.max(0, sheet.getLastRow() - 1) + ' รายการ)',
    'โฟลเดอร์รูป: ' + folder.getName(),
    'อีเมลแจ้งเตือน: ' + (CONFIG.ADMIN_EMAILS.length ? CONFIG.ADMIN_EMAILS.join(', ') : 'ยังไม่ตั้งค่า'),
    'LINE: ' + (CONFIG.LINE_CHANNEL_TOKEN && CONFIG.LINE_USER_ID ? 'พร้อมใช้งาน' : 'ยังไม่ตั้งค่า'),
  ];
  Logger.log(info.join('\n'));
  return info.join('\n');
}

/**
 * เตรียมชีตใหม่ทั้งระบบในครั้งเดียว — ใช้ตอนขึ้น Google Sheet ใหม่
 * วิธีใช้:
 *   1) สร้างสเปรดชีตใหม่ (หรือใช้ชีตเดิมที่ว่าง)
 *   2) ใส่ไอดีชีตใน CONFIG.SPREADSHEET_ID ด้านบน
 *   3) หน้า editor เลือกฟังก์ชัน setupAll แล้วกด Run (ครั้งแรกกด Allow)
 *   4) ตั้งรหัส admin: setUserPassword("admin", "รหัสผ่านใหม่", "ชื่อ", "admin")
 *   5) ถ้าต้องการข้อมูลทดสอบ: รัน seedDemoData() แล้ว Deploy เวอร์ชันใหม่
 * @return {string}
 */
function setupAll() {
  const lines = ['=== เตรียม Google Sheet ใหม่ ==='];

  lines.push('--- 1/3 ชีตใบแจ้งปัญหา + โฟลเดอร์รูป ---');
  lines.push(setupSheet());

  lines.push('--- 2/3 ชีตครุภัณฑ์ ---');
  const equipSheet = equipmentSheet_();
  lines.push(
    'สร้าง/ตรวจชีตเรียบร้อย: ' + equipSheet.getParent().getName() + ' / ' + equipSheet.getName() +
    ' (ครุภัณฑ์ ' + Math.max(0, equipSheet.getLastRow() - 1) + ' รายการ)'
  );

  lines.push('--- 3/3 ชีตบัญชีเจ้าหน้าที่ ---');
  lines.push(setupAuth());

  lines.push('ขั้นตอนถัดไป: setUserPassword("admin", "รหัสผ่านใหม่", "ชื่อ", "admin")');
  lines.push('ถ้าต้องการข้อมูลทดสอบ: seedDemoData() — แล้ว Deploy เวอร์ชันใหม่ก่อนใช้งาน');

  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}

/**
 * สร้างชีต + คอลัมน์ครบตาม HEADERS ให้อัตโนมัติ
 * วิธีใช้ : หน้า editor เลือกฟังก์ชัน setupSheet แล้วกด Run (ครั้งเดียว)
 * (หรือรัน setupAll() เพื่อเตรียมทุกชีตพร้อมกัน)
 * @return {string}
 */
function setupSheet() {
  const sheet = getSheet_();
  const info = [
    'สร้าง/ตรวจชีตเรียบร้อย: ' + sheet.getParent().getName() + ' / ' + sheet.getName(),
    'คอลัมน์ ' + HEADERS.length + ': ' + HEADERS.join(' | '),
    'แถวข้อมูลปัจจุบัน: ' + Math.max(0, sheet.getLastRow() - 1),
    'โฟลเดอร์รูป: ' + getFolder_().getName(),
  ];

  Logger.log(info.join('\n'));
  return info.join('\n');
}

/* ============================================================
 *  ชีต / เลขที่ใบแจ้ง
 * ============================================================ */

function getSheet_() {
  const ss = openSs_();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const width = HEADERS.length;
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getLastRow() === 0
    ? []
    : sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (value) {
      return String(value).trim();
    });

  /* ยังไม่มีหัวตาราง */
  if (!current.length || current[0] === '') {
    writeHeaders_(sheet, 0);
    return;
  }

  /* หัวตารางเดิมต้องตรงกับ HEADERS ตั้งแต่ต้นเรียงไป (เพิ่มคอลัมน์ต่อท้ายได้)
     ถ้าตำแหน่งใดไม่ตรง = ชีตคนละแบบ ให้แจ้งเตือนเหมือนเดิม */
  let matched = 0;
  while (matched < current.length && current[matched] === HEADERS[matched]) {
    matched += 1;
  }

  if (matched !== current.length) {
    throw new Error(
      'ชีต "' + sheet.getName() + '" มีหัวตารางอยู่แล้วแต่ไม่ตรงกับที่สคริปต์กำหนด ' +
      'กรุณาเปลี่ยนชื่อชีต หรือล้างแถวแรกก่อนใช้งาน'
    );
  }

  /* เติมเฉพาะคอลัมน์ที่เพิ่มใหม่ (ข้อมูลเดิมไม่ถูกเลื่อนคอลัมน์) */
  if (current.length < width) {
    writeHeaders_(sheet, current.length);
  }
}

/** เขียนหัวตารางตั้งแต่คอลัมน์ fromIndex ขึ้นไป (ใช้ทั้งสร้างใหม่และเติมคอลัมน์) */
function writeHeaders_(sheet, fromIndex) {
  const width = HEADERS.length;

  if (fromIndex < width) {
    sheet.getRange(1, fromIndex + 1, 1, width - fromIndex)
      .setValues([HEADERS.slice(fromIndex)]);
  }

  sheet.getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#0f4c5c')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);

  HEADER_WIDTHS.forEach(function (w, i) {
    sheet.setColumnWidth(i + 1, w);
  });
}

/* ตัวอักษรสำหรับสุ่มเลขที่ใบแจ้ง — ตัด 0/O/1/I/L ออกกันอ่านผิด */
const TICKET_ALPHABET_ = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * ออกเลขที่ใบแจ้งแบบสุ่ม รูปแบบ RQ + ปีเดือน (yyMM) + รหัสสุ่ม 6 หลัก เช่น RQ2611-X7K9P2
 * เดาไม่ได้ ไม่เรียงลำดับ — ตรวจซ้ำกับเลขที่มีในชีตแล้วสุ่มใหม่ (สูงสุด 20 ครั้ง)
 */
function nextTicketNo_(sheet) {
  const taken = new Set();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    values.forEach(function (row) {
      const value = String(row[0] || '').trim().toUpperCase();
      if (value) {
        taken.add(value);
      }
    });
  }

  return randomTicketNo_(taken);
}

/** สุ่มเลขที่ใบแจ้ง 1 เลข (pure — รับ Set ของเลขที่มีอยู่ เทสต์ใน harness ได้) */
function randomTicketNo_(taken) {
  const ym = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyMM');

  for (let attempt = 0; attempt < 20; attempt++) {
    let tail = '';
    for (let i = 0; i < 6; i++) {
      tail += TICKET_ALPHABET_.charAt(Math.floor(Math.random() * TICKET_ALPHABET_.length));
    }
    const no = 'RQ' + ym + '-' + tail;
    if (!taken || !taken.has(no)) {
      return no;
    }
  }

  throw new Error('สุ่มเลขที่ใบแจ้งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
}

/* ============================================================
 *  ไฟล์แนบ
 * ============================================================ */

function getFolder_() {
  if (CONFIG.DRIVE_FOLDER_ID) {
    return DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  }
  const name = CONFIG.DRIVE_FOLDER_NAME;
  const found = DriveApp.getFoldersByName(name);
  if (found.hasNext()) {
    return found.next();
  }
  return DriveApp.createFolder(name);
}

function saveFile_(file) {
  const bytes = Utilities.base64Decode(file.data);
  const limit = CONFIG.MAX_FILE_MB * 1024 * 1024;
  if (bytes.length > limit) {
    throw new Error('ไฟล์แนบใหญ่เกิน ' + CONFIG.MAX_FILE_MB + ' MB');
  }

  const name = String(file.name || 'photo.jpg').slice(-120);
  const blob = Utilities.newBlob(bytes, file.mimeType || 'application/octet-stream', name);
  const created = getFolder_().createFile(blob);
  created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return created.getUrl();
}

/* ============================================================
 *  แจ้งเตือน
 * ============================================================ */

function notify_(row) {
  const timeText = Utilities.formatDate(row.time, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm');
  const lines = [
    'เลขที่ใบแจ้ง: ' + row.ticketNo,
    'ผู้แจ้ง: ' + row.name + ' (' + row.department + ')',
    'ติดต่อ: ' + (row.contactChannel === 'LINE'
      ? 'LINE ' + (row.lineId || '-')
      : (row.phone || '-')) + (row.email ? ' / ' + row.email : ''),
    'ครุภัณฑ์: ' + (row.itemName || row.category || '-') + (row.itemCode ? ' (' + row.itemCode + ')' : ''),
    'หมวดหมู่: ' + row.category,
    'สถานที่: ' + (row.location || '-'),
    'อาการเสีย: ' + row.detail,
    'ความเร่งด่วน: ' + row.urgency,
    'เวลา: ' + timeText,
  ];
  (row.fileUrls || []).forEach(function (url, index) {
    lines.push('รูปภาพ ' + (index + 1) + ': ' + url);
  });

  if (row.qrUrl) {
    lines.push('รูป QR LINE: ' + row.qrUrl);
  }

  const subject = '[แจ้งซ่อม] ' + row.ticketNo + ' · ' + (row.itemName || row.category || 'ไม่ระบุครุภัณฑ์') + ' · ' + row.urgency;
  const message = lines.join('\n');

  if (CONFIG.ADMIN_EMAILS.length) {
    try {
      const html = lines.map(function (line) {
        return '<div>' + escapeHtml_(line).replace(/\n/g, '<br>') + '</div>';
      }).join('');
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAILS.join(','),
        subject: subject,
        body: message,
        htmlBody: '<div style="font-family:Sarabun,Tahoma,sans-serif;font-size:14px;line-height:1.8">' +
          html +
          ((row.fileUrls || []).length
            ? '<p>' + row.fileUrls.map(function (url, index) {
              return '<a href="' + url + '">รูป ' + (index + 1) + '</a>';
            }).join(' · ') +
              (row.qrUrl ? ' · <a href="' + row.qrUrl + '">QR LINE</a>' : '') + '</p>'
            : '') +
          '</div>',
      });
    } catch (err) {
      console.error('ส่งอีเมลแจ้งเตือนไม่สำเร็จ: ' + err);
    }
  }

  if (CONFIG.LINE_CHANNEL_TOKEN && CONFIG.LINE_USER_ID) {
    try {
      UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_TOKEN },
        payload: JSON.stringify({
          to: CONFIG.LINE_USER_ID,
          messages: [{ type: 'text', text: subject + '\n' + message }],
        }),
        muteHttpExceptions: true,
      });
    } catch (err) {
      console.error('ส่ง LINE แจ้งเตือนไม่สำเร็จ: ' + err);
    }
  }
}

/* ============================================================
 *  helpers
 * ============================================================ */

function requireText_(value, label, maxLength) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) {
    throw new Error('กรุณากรอก' + label);
  }
  if (maxLength && text.length > maxLength) {
    throw new Error(label + 'ยาวเกิน ' + maxLength + ' ตัวอักษร');
  }
  return text;
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
