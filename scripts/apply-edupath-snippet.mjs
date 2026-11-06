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
 *   --fees-before <id>      Insert the fee-management animation before this element id (default: pricing)
 *   --dry-run               Show what would change; write nothing
 *   --revert                Remove everything this script added
 *   --faq-block             Force the old behaviour: add the FAQ as a separate styled block instead of
 *                           adding items to the page's own `const faqs = [...]` array
 *   --allow-placeholders    Proceed even though [bracketed] placeholders remain in the FAQ
 *   --no-backup             Skip the timestamped .bak copy
 *   -h, --help              Show this help
 *
 * FAQ handling
 *   If the page defines `const faqs = [ [question, answer], ... ]` (as an Astro page that maps the array
 *   into its accordion), the new questions are appended to that array, so they use your existing markup,
 *   fonts, accordion JS and FAQPage JSON-LD. Answers are converted to plain text. Otherwise the FAQ is
 *   inserted as a separate block after the element given by --faq-after.
 *
 * Astro support
 *   Works on .astro files too. Literal { } in the section markup are escaped as &#123; &#125; (Astro would
 *   otherwise treat them as expressions and fail the build). For them the CSS is emitted as <style is:global> (so it also styles the
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
  fees:   ['<!-- EP:FEES:START -->',   '<!-- EP:FEES:END -->'],
  faq:    ['<!-- EP:FAQ:START -->',    '<!-- EP:FAQ:END -->'],
  script: ['<!-- EP:SCRIPT:START -->', '<!-- EP:SCRIPT:END -->'],
};

const JSM = ['// EP:FAQITEMS:START', '// EP:FAQITEMS:END']; // markers for items added to the faqs array

// ---------- tiny helpers ----------
const die = (msg) => { console.error(`\u2716 ${msg}`); process.exit(1); };
const warn = (msg) => console.warn(`\u26A0 ${msg}`);
const ok = (msg) => console.log(`\u2714 ${msg}`);
const toLF = (s) => s.replace(/\r\n/g, '\n');
const lineOf = (s, idx) => s.slice(0, idx).split('\n').length;
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseArgs(argv) {
  const o = { solverBefore: 'pricing', faqAfter: 'faq', feesBefore: 'pricing', snippet: path.join(HERE, 'edupath-timetable-solver-snippet.html') };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) die(`Missing value for ${a}`); return argv[++i]; };
    switch (a) {
      case '--snippet': o.snippet = path.resolve(val()); break;
      case '--solver-before': o.solverBefore = val().replace(/^#/, ''); break;
      case '--faq-after': o.faqAfter = val().replace(/^#/, ''); break;
      case '--fees-before': o.feesBefore = val().replace(/^#/, ''); break;
      case '--dry-run': o.dry = true; break;
      case '--revert': o.revert = true; break;
      case '--faq-block': o.faqBlock = true; break;
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
  const styles = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1].trim());
  const scripts = [...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  const solve = findElementRange(s, 'ep-solve');
  const faq = findElementRange(s, 'ep-faq-new');
  const fees = findElementRange(s, 'ep-fees'); // optional
  if (!styles.length) die('Snippet has no <style> block.');
  if (!scripts.length) die('Snippet has no <script> block.');
  if (!solve) die('Snippet is missing the section with id="ep-solve".');
  if (!faq) die('Snippet is missing the section with id="ep-faq-new".');
  return {
    style: `<style>${styles.join('\n')}\n</style>`,
    script: `<script>${scripts.join('\n')}\n</script>`,
    solve: s.slice(solve.start, solve.end),
    faq: s.slice(faq.start, faq.end),
    fees: fees ? s.slice(fees.start, fees.end) : null,
  };
}


/** Remove the marker block inside the faqs array (including the newline + indent we added before it). */
function stripJsBlock(html) {
  const [s, e] = JSM;
  const a = html.indexOf(s), b = html.indexOf(e);
  if (a === -1 && b === -1) return { html, found: false };
  if (a === -1 || b === -1 || b < a) die('The FAQITEMS marker block is corrupt (one marker missing or out of order). Fix by hand, then re-run.');
  if (html.indexOf(s, a + 1) !== -1) die('The FAQITEMS marker block appears more than once. Fix by hand, then re-run.');
  const nl = html.lastIndexOf('\n', a);
  if (nl === -1 || !/^[ \t]*$/.test(html.slice(nl + 1, a))) die('The FAQITEMS start marker is not at the start of a line. Fix by hand, then re-run.');
  return { html: html.slice(0, nl) + html.slice(b + e.length), found: true };
}

/** Find `const faqs = [ ... ]` and where new items can be appended. Skips strings and comments. */
function findFaqArray(html) {
  const m = /\bconst\s+faqs\s*(?::[^=\n]+)?=\s*\[/.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length, n = html.length;
  const firstTok = /\S/.exec(html.slice(start));
  let indent = '  ';
  if (firstTok && firstTok[0] !== ']') {
    const fi = start + firstTok.index;
    indent = /^[ \t]*/.exec(html.slice(html.lastIndexOf('\n', fi) + 1))[0] || '  ';
  }
  let i = start, depth = 1, lastSig = start - 1, lastChar = '[';
  while (i < n) {
    const ch = html[i], nx = html[i + 1];
    if (ch === '/' && nx === '/') { i = html.indexOf('\n', i); if (i === -1) break; continue; }
    if (ch === '/' && nx === '*') { const e = html.indexOf('*/', i + 2); if (e === -1) break; i = e + 2; continue; }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < n && html[j] !== ch) { if (html[j] === '\\') j++; j++; }
      lastSig = j; lastChar = ch; i = j + 1; continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return { at: lastSig + 1, needsComma: lastChar !== ',' && lastChar !== '[', indent, line: lineOf(html, lastSig) };
    }
    if (!/\s/.test(ch)) { lastSig = i; lastChar = ch; }
    i++;
  }
  return null;
}

const ENT = { rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201C', rdquo: '\u201D', ndash: '\u2013', mdash: '\u2014', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function htmlToText(h) {
  return h.replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, g) => {
      if (g[0] === '#') { const c = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : all; }
      return ENT[g.toLowerCase()] ?? all;
    })
    .replace(/\s+/g, ' ').trim();
}
/** Pull [question, answer] pairs out of the snippet's <details><summary>..</summary><p>..</p></details> items. */
function parseFaqItems(faqHtml) {
  const re = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/gi;
  const out = []; let m;
  while ((m = re.exec(faqHtml))) out.push([htmlToText(m[1]), htmlToText(m[2])]);
  return out;
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
{
  const r = stripJsBlock(html);
  html = r.html;
  if (r.found) removed.push('faqitems');
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
    // In Astro templates { } start an expression, so escape any literal braces in the section markup.
    const esc = (h) => (h ? h.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;') : h);
    snip.solve = esc(snip.solve); snip.fees = esc(snip.fees); snip.faq = esc(snip.faq);
  }
  const hasHead = /<\/head>/i.test(html), hasBody = /<\/body>/i.test(html);
  const faqArr = opt.faqBlock ? null : findFaqArray(html);
  const dataMode = !!faqArr;
  let items = [];
  if (dataMode) {
    items = parseFaqItems(snip.faq);
    if (!items.length) die('Found the faqs array, but could not read any <details><summary>..</summary><p>..</p></details> items in the snippet.');
    // the standalone FAQ block is not used in this mode, so drop its CSS
    snip.style = snip.style.split('\n').filter((l) => !/^(#ep-faq-new\{|\.epf-)/.test(l)).join('\n');
  }

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
  let feesAnchor = null;
  if (snip.fees) {
    feesAnchor = findElementRange(html, opt.feesBefore);
    if (!feesAnchor) die(`Could not find an element with id="${opt.feesBefore}" for the fee animation. Use --fees-before <id>.`);
  }
  let faqAnchor = null;
  if (!dataMode) {
    faqAnchor = findElementRange(html, opt.faqAfter);
    if (!faqAnchor) die(`Could not find an element with id="${opt.faqAfter}" for the FAQ block, and no "const faqs = [...]" array was found. Use --faq-after <id>.`);
  }
  if (!hasHead && !isAstro) die('No </head> found, so the CSS has nowhere to go.');
  if (!hasBody && !isAstro) die('No </body> found, so the JS has nowhere to go.');

  // 5) Build insertions, then apply from the END of the document backwards so offsets stay valid.
  const styleB = wrap('style', snip.style), solveB = wrap('solve', snip.solve), scriptB = wrap('script', snip.script);
  const edits = [];
  if (hasBody) edits.push({ at: html.toLowerCase().lastIndexOf('</body>'), text: `${scriptB}\n`, label: 'JS before </body>' });
  if (dataMode) {
    const ind = faqArr.indent;
    const lines = items.map(([q, a]) => `${ind}[${JSON.stringify(q)}, ${JSON.stringify(a)}],`);
    if (faqArr.needsComma) lines[0] = `${ind}, ${lines[0].slice(ind.length)}`;
    edits.push({ at: faqArr.at, text: `\n${ind}${JSM[0]}\n${lines.join('\n')}\n${ind}${JSM[1]}`, label: `${items.length} FAQ items appended to the faqs array (ends line ${faqArr.line})` });
    edits.push({ at: solveAnchor.start, text: `${hasHead ? '' : `${styleB}\n`}${solveB}\n${hasBody ? '' : `${scriptB}\n`}`, label: `${hasHead ? '' : 'CSS, '}Solver section${hasBody ? '' : ' and JS'} before #${opt.solverBefore}` });
  } else {
    edits.push({ at: faqAnchor.end, text: `\n${wrap('faq', snip.faq)}${hasBody ? '' : `\n${scriptB}`}`, label: `FAQ block${hasBody ? '' : ' and JS'} after #${opt.faqAfter}` });
    edits.push({ at: solveAnchor.start, text: `${hasHead ? '' : `${styleB}\n`}${solveB}\n`, label: `${hasHead ? '' : 'CSS and '}Solver section before #${opt.solverBefore}` });
  }
  if (snip.fees) edits.push({ at: feesAnchor.start, text: `${wrap('fees', snip.fees)}\n`, label: `Fee animation before #${opt.feesBefore}` });
  if (hasHead) edits.push({ at: html.toLowerCase().indexOf('</head>'), text: `${styleB}\n`, label: 'CSS before </head>' });
  edits.sort((x, y) => y.at - x.at);

  for (const e of edits) {
    summary.push(`  line ${lineOf(html, e.at)}: ${e.label}`);
    result = result.slice(0, e.at) + e.text + result.slice(e.at);
  }
  summary.reverse();
  summary.unshift(`  FAQ mode: ${dataMode ? 'items added to the page\u2019s own faqs array' : 'separate block'}`);

  // 6) Structural sanity checks on the result.
  const after = { open: (result.match(/<section\b/gi) || []).length, close: (result.match(/<\/section>/gi) || []).length };
  const expectNew = (dataMode ? 1 : 2) + (snip.fees ? 1 : 0);
  if (after.open - after.close !== before.open - before.close) die('Sanity check failed: <section> tags are unbalanced after the edit. Nothing was written.');
  if (after.open !== before.open + expectNew) die(`Sanity check failed: expected ${expectNew} new section(s), found ${after.open - before.open}. Nothing was written.`);
  const need = (dataMode ? ['style', 'solve', 'script'] : ['style', 'solve', 'faq', 'script']).concat(snip.fees ? ['fees'] : []);
  for (const name of need) {
    const [ms, me] = MARK[name];
    if (result.split(ms).length !== 2 || result.split(me).length !== 2) die(`Sanity check failed: marker "${name}" is not present exactly once. Nothing was written.`);
  }
  if (dataMode && (result.split(JSM[0]).length !== 2 || result.split(JSM[1]).length !== 2)) die('Sanity check failed: FAQITEMS markers are not present exactly once. Nothing was written.');
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
