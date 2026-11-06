#!/usr/bin/env node
/**
 * apply-edupath-snippet.mjs
 *
 * Injects the Edupath "watch it solve" section, the new FAQ block, their CSS and
 * their JS into your landing page HTML, programmatically and safely.
 *
 *   node apply-edupath-snippet.mjs <landing.html> [options]
 *
 * Options
 *   --snippet <file>        Snippet file (default: edupath-timetable-solver-snippet.html next to this script)
 *   --solver-before <id>    Insert the solver section before the element with this id   (default: pricing)
 *   --faq-after <id>        Insert the FAQ block after the element with this id         (default: faq)
 *   --dry-run               Show what would change; write nothing
 *   --revert                Remove everything this script added
 *   --allow-placeholders    Proceed even though [bracketed] placeholders remain in the FAQ
 *   --no-backup             Skip the timestamped .bak copy
 *   -h, --help              Show this help
 *
 * Astro support
 *   Works on .astro files too. For them the CSS is emitted as <style is:global> (so it also styles the
 *   elements the animation creates at runtime) and the JS as <script is:inline> (so Astro leaves it as is).
 *   If the file has no </head> or </body> (the page uses a Layout component), the CSS is placed right
 *   before the solver section and the JS right after the FAQ block instead.
 *
 * Safety properties
 *   - Idempotent: every insertion sits between EP:...:START/END markers. Re-running replaces
 *     those blocks instead of duplicating them, so you can edit the snippet and re-apply.
 *   - Never touches anything outside the markers, apart from the insertions themselves.
 *   - Refuses to write if anchors are missing, markers are corrupt, ids already exist
 *     outside the markers, unfilled [placeholders] remain, or the result looks structurally wrong.
 *   - Writes a timestamped backup, then writes atomically (temp file + rename).
 *   - Preserves the file's existing line endings (LF or CRLF).
 *
 * Requires Node 18+. No dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARK = {
  style:  ['<!-- EP:STYLE:START -->',  '<!-- EP:STYLE:END -->'],
  solve:  ['<!-- EP:SOLVE:START -->',  '<!-- EP:SOLVE:END -->'],
  faq:    ['<!-- EP:FAQ:START -->',    '<!-- EP:FAQ:END -->'],
  script: ['<!-- EP:SCRIPT:START -->', '<!-- EP:SCRIPT:END -->'],
};

// ---------- tiny helpers ----------
const die = (msg) => { console.error(`\u2716 ${msg}`); process.exit(1); };
const warn = (msg) => console.warn(`\u26A0 ${msg}`);
const ok = (msg) => console.log(`\u2714 ${msg}`);
const toLF = (s) => s.replace(/\r\n/g, '\n');
const lineOf = (s, idx) => s.slice(0, idx).split('\n').length;
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseArgs(argv) {
  const o = { solverBefore: 'pricing', faqAfter: 'faq', snippet: path.join(HERE, 'edupath-timetable-solver-snippet.html') };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) die(`Missing value for ${a}`); return argv[++i]; };
    switch (a) {
      case '--snippet': o.snippet = path.resolve(val()); break;
      case '--solver-before': o.solverBefore = val().replace(/^#/, ''); break;
      case '--faq-after': o.faqAfter = val().replace(/^#/, ''); break;
      case '--dry-run': o.dry = true; break;
      case '--revert': o.revert = true; break;
      case '--allow-placeholders': o.allowPlaceholders = true; break;
      case '--no-backup': o.noBackup = true; break;
      case '-h': case '--help': o.help = true; break;
      default:
        if (a.startsWith('-')) die(`Unknown option ${a} (try --help)`);
        rest.push(a);
    }
  }
  o.target = rest[0] ? path.resolve(rest[0]) : null;
  return o;
}

function showHelp() {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, '').trim());
}

/** Locate an element by id and return its full [start, end) range, matching nested tags of the same name. */
function findElementRange(html, id) {
  const open = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bid=["']${esc(id)}["'][^>]*>`, 'i').exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  const tok = new RegExp(`<(/?)${esc(tag)}\\b[^>]*>`, 'gi');
  tok.lastIndex = open.index + open[0].length;
  let depth = 1, m;
  while ((m = tok.exec(html))) {
    depth += m[1] ? -1 : (m[0].endsWith('/>') ? 0 : 1);
    if (depth === 0) return { start: open.index, end: m.index + m[0].length, tag };
  }
  die(`Element #${id} is not closed properly in the target file.`);
}

/** Remove a START..END marker block. Returns {html, found}. Dies if markers are unbalanced. */
function stripBlock(html, [start, end], name) {
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a === -1 && b === -1) return { html, found: false };
  if (a === -1 || b === -1 || b < a) die(`Marker block "${name}" is corrupt (one marker missing or out of order). Fix by hand, then re-run.`);
  if (html.indexOf(start, a + 1) !== -1) die(`Marker block "${name}" appears more than once. Fix by hand, then re-run.`);
  let from = a, to = b + end.length;
  // Remove exactly the newline we added when inserting (the one after the block), so revert restores the original byte-for-byte.
  if (html[to] === '\n') to++;
  else if (html[from - 1] === '\n') from--;
  return { html: html.slice(0, from) + html.slice(to), found: true };
}

function loadSnippet(file) {
  if (!fs.existsSync(file)) die(`Snippet file not found: ${file}`);
  const s = toLF(fs.readFileSync(file, 'utf8'));
  const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(s);
  const script = /<script[^>]*>([\s\S]*?)<\/script>/i.exec(s);
  const solve = findElementRange(s, 'ep-solve');
  const faq = findElementRange(s, 'ep-faq-new');
  if (!style) die('Snippet has no <style> block.');
  if (!script) die('Snippet has no <script> block.');
  if (!solve) die('Snippet is missing the section with id="ep-solve".');
  if (!faq) die('Snippet is missing the section with id="ep-faq-new".');
  return {
    style: `<style>${style[1].replace(/\s+$/, '')}\n</style>`,
    script: `<script>${script[1].replace(/\s+$/, '')}\n</script>`,
    solve: s.slice(solve.start, solve.end),
    faq: s.slice(faq.start, faq.end),
  };
}

const wrap = (name, body) => `${MARK[name][0]}\n${body}\n${MARK[name][1]}`;

// ---------- main ----------
const opt = parseArgs(process.argv.slice(2));
if (opt.help || !opt.target) { showHelp(); process.exit(opt.help ? 0 : 1); }
if (!fs.existsSync(opt.target)) die(`Target file not found: ${opt.target}`);

const original = fs.readFileSync(opt.target, 'utf8');
const eol = /\r\n/.test(original) ? '\r\n' : '\n';
let html = toLF(original);

// 1) Always start from a clean baseline (removes any earlier run's blocks).
const removed = [];
for (const name of Object.keys(MARK)) {
  const r = stripBlock(html, MARK[name], name);
  html = r.html;
  if (r.found) removed.push(name);
}
if (removed.length) console.log(`Cleared previous blocks: ${removed.join(', ')}`);

const before = { open: (html.match(/<section\b/gi) || []).length, close: (html.match(/<\/section>/gi) || []).length };
let result = html;
const summary = [];

if (!opt.revert) {
  const snip = loadSnippet(opt.snippet);
  const isAstro = /\.astro$/i.test(opt.target);
  if (isAstro) {
    snip.style = snip.style.replace(/^<style>/, '<style is:global>');
    snip.script = snip.script.replace(/^<script>/, '<script is:inline>');
  }
  const hasHead = /<\/head>/i.test(html), hasBody = /<\/body>/i.test(html);

  // 2) Guard: ids must not already exist outside our markers.
  for (const id of ['ep-solve', 'ep-faq-new']) {
    if (new RegExp(`\\bid=["']${id}["']`, 'i').test(html)) die(`id="${id}" already exists in the target outside the EP markers. Remove it by hand first.`);
  }

  // 3) Guard: unfilled placeholders in the FAQ.
  const placeholders = (snip.faq.replace(/<[^>]+>/g, ' ').match(/\[[A-Za-z][^\]\n]*\]/g)) || [];
  if (placeholders.length) {
    const list = placeholders.map((p) => `   ${p}`).join('\n');
    if (!opt.allowPlaceholders && !opt.dry) die(`The FAQ still has ${placeholders.length} unfilled placeholder(s):\n${list}\nFill them in the snippet file, or re-run with --allow-placeholders.`);
    warn(`${placeholders.length} unfilled placeholder(s) in the FAQ:\n${list}`);
  }

  // 4) Locate anchors on the clean baseline.
  const solveAnchor = findElementRange(html, opt.solverBefore);
  if (!solveAnchor) die(`Could not find an element with id="${opt.solverBefore}" for the solver section. Use --solver-before <id>.`);
  const faqAnchor = findElementRange(html, opt.faqAfter);
  if (!faqAnchor) die(`Could not find an element with id="${opt.faqAfter}" for the FAQ block. Use --faq-after <id>.`);
  if (!hasHead && !isAstro) die('No </head> found, so the CSS has nowhere to go.');
  if (!hasBody && !isAstro) die('No </body> found, so the JS has nowhere to go.');

  // 5) Build insertions, then apply from the END of the document backwards so offsets stay valid.
  const edits = [];
  if (hasBody) edits.push({ at: html.toLowerCase().lastIndexOf('</body>'), text: `${wrap('script', snip.script)}\n`, label: 'JS before </body>' });
  edits.push({ at: faqAnchor.end, text: `\n${wrap('faq', snip.faq)}${hasBody ? '' : `\n${wrap('script', snip.script)}`}`, label: `FAQ block${hasBody ? '' : ' and JS'} after #${opt.faqAfter}` });
  edits.push({ at: solveAnchor.start, text: `${hasHead ? '' : `${wrap('style', snip.style)}\n`}${wrap('solve', snip.solve)}\n`, label: `${hasHead ? '' : 'CSS and '}Solver section before #${opt.solverBefore}` });
  if (hasHead) edits.push({ at: html.toLowerCase().indexOf('</head>'), text: `${wrap('style', snip.style)}\n`, label: 'CSS before </head>' });
  edits.sort((a, b) => b.at - a.at);

  for (const e of edits) {
    summary.push(`  line ${lineOf(html, e.at)}: ${e.label}`);
    result = result.slice(0, e.at) + e.text + result.slice(e.at);
  }

  // 6) Structural sanity checks on the result.
  const after = { open: (result.match(/<section\b/gi) || []).length, close: (result.match(/<\/section>/gi) || []).length };
  if (after.open - after.close !== before.open - before.close) die('Sanity check failed: <section> tags are unbalanced after the edit. Nothing was written.');
  if (after.open !== before.open + 2) die(`Sanity check failed: expected 2 new sections, found ${after.open - before.open}. Nothing was written.`);
  for (const name of ['style', 'solve', 'faq', 'script']) {
    const [s, e] = MARK[name];
    if (result.split(s).length !== 2 || result.split(e).length !== 2) die(`Sanity check failed: marker "${name}" is not present exactly once. Nothing was written.`);
  }
} else {
  summary.push(removed.length ? `  removed: ${removed.join(', ')}` : '  nothing to remove');
}

// ---------- report / write ----------
const final = result.replace(/\n/g, eol);
if (final === original) { ok('No changes needed. The file is already up to date.'); process.exit(0); }

console.log(`${opt.revert ? 'Revert' : 'Apply'} plan for ${path.basename(opt.target)}:`);
console.log(summary.join('\n'));
console.log(`  size: ${original.length} \u2192 ${final.length} characters, line endings: ${eol === '\r\n' ? 'CRLF' : 'LF'}`);

if (opt.dry) { ok('Dry run only. Nothing was written.'); process.exit(0); }

if (!opt.noBackup) {
  const bak = `${opt.target}.bak-${stamp()}`;
  fs.copyFileSync(opt.target, bak);
  ok(`Backup written: ${path.basename(bak)}`);
}
const tmp = `${opt.target}.tmp-${process.pid}`;
try {
  fs.writeFileSync(tmp, final, 'utf8');
  fs.renameSync(tmp, opt.target);
} catch (err) {
  try { fs.unlinkSync(tmp); } catch {}
  die(`Write failed, original left untouched: ${err.message}`);
}
ok(opt.revert ? 'Reverted. All EP blocks removed.' : 'Applied. Re-run any time to update; use --revert to remove.');
