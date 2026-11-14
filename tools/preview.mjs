#!/usr/bin/env node
/**
 * tools/preview.mjs
 * ------------------------------------------------------------
 * สร้างชุดเว็บ static สำหรับ "ทำงานออกแบบในเครื่อง" จาก template จริง
 * ของ Apps Script แล้วเปิดดูด้วย Chrome (ไม่ต้อง deploy)
 *
 * วิธีใช้
 *   node tools/preview.mjs           สร้างครั้งแรก (ถ้ามีอยู่แล้วจะไม่แตะ)
 *   node tools/preview.mjs --force   ลบ preview/ แล้วสร้างใหม่จาก template
 *
 * ผลลัพธ์
 *   preview/form.html, track.html, login.html, dashboard.html, equipment.html
 *   preview/assets/styles.css   (จาก Styles.html — แก้สี/สไตล์ที่ไฟล์นี้)
 *   preview/assets/app.js       (จาก AppJS.html — แก้ JS กลางที่ไฟล์นี้)
 *
 * หลักการทำงาน
 * - preview/ คือ "สำเนาทำงาน" แก้ไขได้ ถ้าไม่สั่ง --force จะไม่ถูกเขียนทับ
 * - แทน include() ที่เหลือ (Brand, PubHead, Shell, Dialog) และค่าที่ doGet() ส่งให้
 * - แปลงลิงก์ ?page=x เป็น x.html?page=x เพื่อกดนำทางในเครื่องได้
 * - ข้อมูลยังเป็นตัวอย่าง และ google.script.run ใช้ได้เฉพาะบน Apps Script
 * - preview/ ไม่ถูกอัปโหลดขึ้น Apps Script (ดู .claspignore)
 *
 * เมื่อออกแบบพอใจแล้ว: port กลับเข้าไฟล์ Apps Script
 *   preview/assets/styles.css -> Styles.html (ห่อด้วย <style>...</style>)
 *   preview/assets/app.js     -> AppJS.html  (ห่อด้วย <script>...</script>)
 *   preview/<หน้า>.html       -> Repair/Track/Login/Dashboard/Equipment.html
 * ------------------------------------------------------------
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'preview');
const assetsDir = join(outDir, 'assets');
const force = process.argv.includes('--force');

/* อ่าน LISTS / CONFIG / PAGES จาก Code.gs ตรง ๆ ไม่ต้องประกาศซ้ำ */
const codeSource = readFileSync(join(root, 'Code.gs'), 'utf8');
const { LISTS, CONFIG, PAGES } = new Function(
  codeSource + '\nreturn { LISTS: LISTS, CONFIG: CONFIG, PAGES: PAGES };'
)();

const INCLUDE = /[<][?]!= include[(]'([^']+)'[)] [?][>]/;
const PAGE_LINK = /[?]page=([a-z]+)/g;

function readTemplate(name) {
  return readFileSync(join(root, name + '.html'), 'utf8');
}

/** แทน <?!= include('Name') ?> ด้วยเนื้อหาไฟล์จริง (รองรับซ้อนกัน) */
function inlineIncludes(html, stack) {
  let out = html;
  let match = INCLUDE.exec(out);

  while (match) {
    const name = match[1];
    if (stack.includes(name)) {
      throw new Error('include วนซ้ำ: ' + stack.concat(name).join(' -> '));
    }
    out = out.replace(match[0], inlineIncludes(readTemplate(name), stack.concat(name)));
    match = INCLUDE.exec(out);
  }

  return out;
}

/** แปลงลิงก์ ?page=form → form.html?page=form (คง &no=... ไว้) */
function toLocalLinks(html) {
  return html.replace(PAGE_LINK, function (full, page) {
    return page + '.html?page=' + page;
  });
}

/** ผู้ใช้ตัวอย่างใน preview (Dashboard ใช้ชื่อที่ตรงกับข้อมูลจําลอง) */
function sampleUser(pageKey) {
  if (pageKey === 'dashboard') {
    return 'สมพงษ์ ช่างซ่อม';
  }

  /* หน้าสาธารณะ (form/track) ไม่มีผู้ใช้ล็อกอิน — คืนค่าแบบ production
     เพื่อให้ช่องชื่อผู้แจ้งกรอกได้ ไม่ถูกล็อก */
  if (pageKey === 'form' || pageKey === 'track') {
    return 'ผู้ใช้งาน';
  }

  return 'เจ้าหน้าที่ตัวอย่าง (' + pageKey + ')';
}

/** แทนค่าที่ doGet() ใส่ให้ template ด้วยค่าตัวอย่าง */
function fillScriptlets(html, pageKey) {
  return html
    .split('<?!= lists ?>')
    .join(JSON.stringify(LISTS))
    .split('<?= maxFileMb ?>')
    .join(String(CONFIG.MAX_FILE_MB))
    .split('<?= currentUser ?>')
    .join(sampleUser(pageKey));
}

/** ดึงเนื้อหาข้างในแท็ก wrapper (เช่น <style>...</style>) */
function unwrap(content, open, close, label) {
  const start = content.indexOf(open);
  const end = content.lastIndexOf(close);
  if (start < 0 || end < start) {
    throw new Error('รูปแบบไฟล์ ' + label + ' ไม่ถูกต้อง: ไม่พบ ' + open + ' ... ' + close);
  }
  return content.slice(start + open.length, end).trim();
}

/* ----- กันงานที่แก้ใน preview/ หาย ----- */
if (existsSync(join(outDir, 'form.html')) && !force) {
  console.log('preview/ มีอยู่แล้ว — ไม่เขียนทับ เพื่อรักษางานออกแบบที่แก้ไว้');
  console.log('เปิดดูได้เลยที่ preview/form.html');
  console.log('ถ้าต้องการสร้างใหม่จาก template (จะลบของเดิมทั้งหมด): node tools/preview.mjs --force');
  process.exit(0);
}

if (force) {
  /* ลบเฉพาะ "เนื้อหา" ใน preview/ ไม่ลบตัวโฟลเดอร์
     เพราะบน Windows ถ้ามีโปรแกรมอื่นถือโฟลเดอร์นี้อยู่ (เช่น Live Server ที่เปิดทิ้งไว้)
     การลบทั้งโฟลเดอร์จะได้ EPERM แล้ว build ล้มเงียบ ๆ จนไฟล์ใน preview เป็นของเก่า */
  if (existsSync(outDir)) {
    readdirSync(outDir).forEach(function (name) {
      rmSync(join(outDir, name), { recursive: true, force: true, maxRetries: 10, retryDelay: 80 });
    });
  }
}
mkdirSync(assetsDir, { recursive: true });

/* CSS / JS กลาง แยกไฟล์เพื่อให้แก้ที่เดียว */
writeFileSync(
  join(assetsDir, 'styles.css'),
  unwrap(readTemplate('Styles'), '<style>', '</style>', 'Styles.html') + '\n',
  'utf8'
);
writeFileSync(
  join(assetsDir, 'app.js'),
  unwrap(readTemplate('AppJS'), '<script>', '</script>', 'AppJS.html') + '\n',
  'utf8'
);

const written = ['preview/assets/styles.css', 'preview/assets/app.js'];

/* ต่อท้ายด้วยเลขรุ่นของการ build เพื่อไม่ให้เบราว์เซอร์ใช้ CSS/JS เก่าจาก cache */
const ASSET_VERSION = Date.now().toString(36);

Object.keys(PAGES).forEach(function (pageKey) {
  const page = PAGES[pageKey];

  let html = readTemplate(page.file)
    .split("<?!= include('Styles') ?>")
    .join('<link rel="stylesheet" href="assets/styles.css?v=' + ASSET_VERSION + '">')
    .split("<?!= include('AppJS') ?>")
    .join('<script src="assets/app.js?v=' + ASSET_VERSION + '"></script>');

  html = inlineIncludes(html, []);

  if (INCLUDE.test(html)) {
    throw new Error(page.file + ': มี include ที่แทนค่าไม่ได้');
  }

  html = fillScriptlets(toLocalLinks(html), pageKey);

  if (html.includes('<?')) {
    throw new Error(page.file + ': แทนค่า scriptlet ไม่ครบ');
  }

  writeFileSync(join(outDir, pageKey + '.html'), html, 'utf8');
  written.push('preview/' + pageKey + '.html');
});

console.log('สร้าง preview สำเร็จ:');
written.forEach(function (file) {
  console.log('  - ' + file);
});
console.log('\nเปิด preview/form.html ใน Chrome ได้เลย');
console.log('แก้สไตล์ที่ preview/assets/styles.css และ JS กลางที่ preview/assets/app.js');
console.log('หมายเหตุ: ข้อมูลเป็นตัวอย่าง และ google.script.run ใช้ได้เฉพาะบน Apps Script');
