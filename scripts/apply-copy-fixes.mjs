#!/usr/bin/env node
/**
 * apply-copy-fixes.mjs
 *
 * Small, exact-text edits to src/pages/index.astro and src/components/Footer.astro:
 *
 *   1. Timetable Builder card: describes what the product does now, and links to the Timetables tour.
 *   2. New "Financial Reports" card (after Fee Management), linking to the Reports tour.
 *   3. Trust strip: "SAVE 20+ HRS/WEEK" -> "FREE UP TO 200 STUDENTS" (matches the Free plan),
 *      "LIVE IN 5 MINUTES" -> "SET UP IN 5-15 MINUTES" (matches the setup FAQ).
 *      Hero line: "Live in about 5 minutes" -> "Set up in 5 to 15 minutes".
 *   4. (v2) Cards link to the new /school-timetable-software and /school-financial-reports pages; both pages are
 *      added to the footer Product list and the nav's Features highlight; '#ep-tour' is added to the
 *      section-view tracking in analytics.js.
 *   5. (v3) Hero lead and homepage meta description describe the whole product (admissions and CBE report
 *      cards through timetables, fees, accounts and payroll). Use --lead "your text" to set your own lead.
 *   6. (v4) A KEMIS Readiness card on the homepage (opens the KEMIS tour tab), and the attendance page's
 *      NEMIS wording updated to KEMIS (KEMIS replaced NEMIS in January 2026).
 *   7. Footer social icons: WhatsApp points at wa.me/254711606968. X and LinkedIn are removed unless
 *      you pass real profile URLs (--x, --linkedin).
 *
 * Usage (run from the repo root):
 *   node scripts/apply-copy-fixes.mjs --dry-run
 *   node scripts/apply-copy-fixes.mjs
 *   node scripts/apply-copy-fixes.mjs --x https://x.com/yourhandle --linkedin https://www.linkedin.com/company/yourpage
 *
 * Options
 *   --root <dir>       Repo root (default: current directory)
 *   --x <url>          Keep the X icon and point it at this URL
 *   --linkedin <url>   Keep the LinkedIn icon and point it at this URL
 *   --lead <text>      Use your own hero lead sentence (plain text; replaces whatever the lead is now)
 *   --dry-run          Show what would change; write nothing
 *   --no-backup        Skip the timestamped .bak copies
 *   -h, --help         Show this help
 *
 * Safety: every edit is an exact-text match. If any expected text is missing (and the edit has not
 * already been applied), nothing is written and the missing items are listed. Re-running is safe.
 * Undo with git (git checkout -- <file>) or the .bak copy. Line endings (LF/CRLF) are preserved.
 */
import fs from 'node:fs';
import path from 'node:path';

const die = (m) => { console.error(`\u2716 ${m}`); process.exit(1); };
const ok = (m) => console.log(`\u2714 ${m}`);
const args = process.argv.slice(2);
const opt = { root: process.cwd() };
for (let i = 0; i < args.length; i++) {
  const a = args[i], val = () => (i + 1 < args.length ? args[++i] : die(`Missing value for ${a}`));
  if (a === '--root') opt.root = path.resolve(val());
  else if (a === '--x') opt.x = val();
  else if (a === '--linkedin') opt.linkedin = val();
  else if (a === '--lead') opt.lead = val();
  else if (a === '--dry-run') opt.dry = true;
  else if (a === '--no-backup') opt.noBackup = true;
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, '').trim()); process.exit(0); }
  else die(`Unknown option ${a} (try --help)`);
}
if (opt.lead && /[<>{}]/.test(opt.lead)) die('--lead must be plain text (no < > { } characters)');
for (const [k, v] of [['--x', opt.x], ['--linkedin', opt.linkedin]]) if (v && !/^https:\/\//.test(v)) die(`${k} must be a full https:// URL`);

const files = {
  index: path.join(opt.root, 'src/pages/index.astro'),
  footer: path.join(opt.root, 'src/components/Footer.astro'),
  nav: path.join(opt.root, 'src/components/Nav.astro'),
  attendance: path.join(opt.root, 'src/pages/school-attendance.astro'),
  analytics: path.join(opt.root, 'analytics.js'),
};
for (const f of Object.values(files)) if (!fs.existsSync(f)) die(`Not found: ${f}\nRun this from the repo root, or pass --root <dir>.`);

const raw = {}, eol = {}, txt = {};
for (const [k, f] of Object.entries(files)) {
  raw[k] = fs.readFileSync(f, 'utf8');
  eol[k] = /\r\n/.test(raw[k]) ? '\r\n' : '\n';
  txt[k] = raw[k].replace(/\r\n/g, '\n');
}

const results = [];
const missing = [];
/** Replace exactly one occurrence of `from` with `to`. `done` is a string that, if present, means already applied. */
function edit(file, label, from, to, done) {
  const t = txt[file];
  // already applied? (checked first, because the new text may still contain the old text)
  if (done && t.includes(done)) { results.push(`  already   ${label}`); return; }
  const n = t.split(from).length - 1;
  if (n === 1) { txt[file] = t.replace(from, () => to); results.push(`  applied   ${label}`); return; }
  if (n > 1) { missing.push(`${label}: expected one match in ${path.basename(files[file])}, found ${n}`); return; }
  missing.push(`${label}: text not found in ${path.basename(files[file])}`);
}

/** Like edit(), but accepts any of several earlier versions of the text. */
function editAny(file, label, froms, to, done) {
  const t = txt[file];
  if (done && t.includes(done)) { results.push(`  already   ${label}`); return; }
  const hit = froms.filter((f) => t.split(f).length - 1 === 1);
  if (hit.length === 1) { txt[file] = t.replace(hit[0], () => to); results.push(`  applied   ${label}`); return; }
  missing.push(`${label}: expected text not found in ${path.basename(files[file])}`);
}

// 1. Timetable Builder card
const ttNew = "{ title: 'Timetable Builder', text: 'Generate clash-free timetables from your teaching requirements, then move lessons, cover absences, repair and print.', href: '/school-timetable-software' },";
editAny('index', 'Timetable Builder card',
  [
    "{ title: 'Timetable Builder', text: 'Assign periods, bulk import from Excel, personalised weekly schedules.', href: null },",
    "{ title: 'Timetable Builder', text: 'Generate clash-free timetables from your teaching requirements, then move lessons, cover absences, repair and print.', href: '/#tour-timetables' },",
  ], ttNew, "href: '/school-timetable-software' }");

// 2. Financial Reports card, right after Fee Management & M-Pesa
const fee = "{ title: 'Fee Management & M-Pesa', text: 'STK push payments, balances and automatic receipts and statements.', href: '/mpesa-school-fees' },";
const frNew = "{ title: 'Financial Reports', text: 'Collection rate, defaulters, class comparison, trial balance and cash book, with CSV and PDF downloads.', href: '/school-financial-reports' },";
const frOld = "{ title: 'Financial Reports', text: 'Collection rate, defaulters, class comparison, trial balance and cash book, with CSV and PDF downloads.', href: '/#tour-reports' },";
if (txt.index.includes("href: '/school-financial-reports' }")) results.push('  already   Financial Reports card');
else if (txt.index.includes(frOld)) edit('index', 'Financial Reports card', frOld, frNew);
else edit('index', 'Financial Reports card', fee, fee + '\n  ' + frNew);

// 2b. KEMIS Readiness card, right after Financial Reports
const kemisCard = "{ title: 'KEMIS Readiness', text: 'Check learner data, export a KEMIS registration worksheet and import UPI numbers back in bulk.', href: '/#tour-kemis' },";
if (txt.index.includes("title: 'KEMIS Readiness'")) results.push('  already   KEMIS Readiness card');
else edit('index', 'KEMIS Readiness card', frNew, frNew + '\n  ' + kemisCard);

// 3. Unsourced claims
edit('index', 'Trust strip: hours claim', '<span class="trust-item">SAVE 20+ HRS/WEEK</span>', '<span class="trust-item">FREE UP TO 200 STUDENTS</span>', 'FREE UP TO 200 STUDENTS');
edit('index', 'Trust strip: setup time', '<span class="trust-item">LIVE IN 5 MINUTES</span>', '<span class="trust-item">SET UP IN 5\u201315 MINUTES</span>', 'SET UP IN 5\u201315 MINUTES');
edit('index', 'Hero line: setup time', '\u00b7 Live in about 5 minutes</p>', '\u00b7 Set up in 5 to 15 minutes</p>', 'Set up in 5 to 15 minutes</p>');

// 3b. Hero lead + homepage meta description: describe the whole product
const DEFAULT_LEAD = "From admissions and CBE report cards to timetables, fee collection, accounts and payroll, Edupath SMS runs your whole school in one place, with M-Pesa and WhatsApp built in.";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const heroOld = '<p class="hero-lead">Edupath SMS brings admissions, attendance, academics and fees into one all-in-one platform \u2014 built for Kenya\'s CBE curriculum, with M-Pesa and WhatsApp built in.</p>';
const lead = opt.lead || DEFAULT_LEAD;
const heroNew = `<p class="hero-lead">${esc(lead).replace(/&quot;/g, '"')}</p>`;
const heroRe = /<p class="hero-lead">[\s\S]*?<\/p>/;
if (txt.index.includes(heroNew)) results.push('  already   Hero lead');
else if (txt.index.includes(heroOld)) edit('index', 'Hero lead', heroOld, heroNew);
else if (opt.lead && heroRe.test(txt.index)) { txt.index = txt.index.replace(heroRe, () => heroNew); results.push('  applied   Hero lead (replaced the current text)'); }
else if (heroRe.test(txt.index)) results.push('  already   Hero lead (already changed; pass --lead to replace it)');
else missing.push('Hero lead: <p class="hero-lead"> not found in index.astro');

const META_OLD = 'description="Edupath SMS is an all-in-one school management platform for Kenyan schools \u2014 CBE-ready, with M-Pesa fee collection and WhatsApp notifications built in."';
const META_NEW = 'description="Edupath SMS is an all-in-one school management system for Kenyan schools: admissions, CBE report cards, timetables, fees and M-Pesa, accounts and payroll."';
if (txt.index.includes(META_NEW)) results.push('  already   Homepage meta description');
else if (txt.index.includes(META_OLD)) edit('index', 'Homepage meta description', META_OLD, META_NEW);
else results.push('  already   Homepage meta description (already changed)');

// 3c. Attendance page: NEMIS -> KEMIS
edit('attendance', 'Attendance page: report description',
  'Useful for NEMIS compliance and parent meetings.</p>',
  'Useful for school records, KEMIS preparation and parent meetings.</p>',
  'Useful for school records, KEMIS preparation');
edit('attendance', 'Attendance page: FAQ question',
  '<h3>Can I generate attendance reports for NEMIS?</h3>',
  '<h3>Can I generate attendance reports for KEMIS?</h3>',
  '<h3>Can I generate attendance reports for KEMIS?</h3>');
edit('attendance', 'Attendance page: FAQ answer',
  'These can be exported and used for NEMIS reporting and compliance purposes.</p>',
  'These can be exported for your records and for any reporting you are asked to provide, including to KEMIS, which replaces NEMIS.</p>',
  'including to KEMIS, which replaces NEMIS.');

// 4a. Footer product links, nav highlight, analytics section tracking
edit('footer', 'Footer: product links',
  '<li><a href="/mpesa-school-fees">M-Pesa Fees</a></li>',
  '<li><a href="/mpesa-school-fees">M-Pesa Fees</a></li>\n          <li><a href="/school-timetable-software">Timetables</a></li>\n          <li><a href="/school-financial-reports">Financial Reports</a></li>',
  'href="/school-timetable-software"');
edit('nav', 'Nav: highlight Features on the new pages',
  "match: ['/cbe-school-management', '/mpesa-school-fees', '/parent-portal', '/school-attendance'] }",
  "match: ['/cbe-school-management', '/mpesa-school-fees', '/parent-portal', '/school-attendance', '/school-timetable-software', '/school-financial-reports'] }",
  "'/school-timetable-software', '/school-financial-reports'] }");
edit('analytics', 'Analytics: track views of the tour section',
  "const sections = ['#hero', '#features', '#portals', '#pricing', '#wa', '#register', '#testimonials', '#faq'];",
  "const sections = ['#hero', '#features', '#ep-tour', '#portals', '#pricing', '#wa', '#register', '#testimonials', '#faq'];",
  "'#ep-tour'");

// 4b. Footer socials
edit('footer', 'Footer: WhatsApp link',
  '<a href="#" title="WhatsApp" aria-label="Edupath on WhatsApp">',
  '<a href="https://wa.me/254711606968" target="_blank" rel="noopener" title="WhatsApp" aria-label="Edupath on WhatsApp">',
  'href="https://wa.me/254711606968"');
for (const [name, key, title] of [['X', 'x', 'X \\(Twitter\\)'], ['LinkedIn', 'linkedin', 'LinkedIn']]) {
  const re = new RegExp(`\\n?[ \\t]*<a href="#" title="${title}"[^>]*>[\\s\\S]*?<\\/a>`);
  const hasPlaceholder = re.test(txt.footer);
  if (opt[key]) {
    if (hasPlaceholder) {
      txt.footer = txt.footer.replace(new RegExp(`<a href="#" title="${title}"`), `<a href="${opt[key]}" target="_blank" rel="noopener" title="${title.replace(/\\/g, '')}"`);
      results.push(`  applied   Footer: ${name} link -> ${opt[key]}`);
    } else if (txt.footer.includes(opt[key])) results.push(`  already   Footer: ${name} link`);
    else missing.push(`Footer: ${name} icon not found (it may already have been removed; restore Footer.astro with git, then re-run)`);
  } else if (hasPlaceholder) {
    txt.footer = txt.footer.replace(re, '');
    results.push(`  applied   Footer: ${name} icon removed (no URL given; pass --${key} <url> to keep it)`);
  } else results.push(`  already   Footer: ${name} icon`);
}

if (missing.length) {
  console.error('\u2716 Nothing was written. These edits could not be applied:');
  for (const m of missing) console.error(`   - ${m}`);
  console.error('The source may have changed. Send me the current lines and I will update this script.');
  process.exit(1);
}

console.log(`${opt.dry ? 'Dry run' : 'Apply'} plan:`);
console.log(results.join('\n'));

let changed = 0;
const changedNames = [];
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
for (const k of Object.keys(files)) {
  const out = txt[k].replace(/\n/g, eol[k]);
  if (out === raw[k]) continue;
  changed++; changedNames.push(path.relative(opt.root, files[k]));
  if (opt.dry) continue;
  if (!opt.noBackup) fs.copyFileSync(files[k], `${files[k]}.bak-${stamp}`);
  const tmp = `${files[k]}.tmp-${process.pid}`;
  try { fs.writeFileSync(tmp, out, 'utf8'); fs.renameSync(tmp, files[k]); }
  catch (e) { try { fs.unlinkSync(tmp); } catch {} die(`Write failed for ${files[k]}: ${e.message}`); }
}
if (!changed) ok('No changes needed. Everything is already applied.');
else if (opt.dry) ok(`Dry run only. ${changed} file(s) would change (${changedNames.join(', ')}); nothing was written.`);
else ok(`Applied to ${changed} file(s): ${changedNames.join(', ')}.${opt.noBackup ? '' : ' Backups: *.bak-' + stamp}`);
