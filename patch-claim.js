const fs = require('fs');
const raw = fs.readFileSync('index.html', 'utf8');
const usesCRLF = raw.includes('\r\n');
let html = raw.replace(/\r\n/g, '\n');

const old = '<a href="#contact" style="display:inline-block;background:#fff;color:#4f46e5;font-weight:700;font-size:0.9rem;padding:0.65rem 1.75rem;border-radius:0.5rem;text-decoration:none;">Claim Offer &rarr;</a>';
const neu = '<a href="#register" style="display:inline-block;background:#fff;color:#4f46e5;font-weight:700;font-size:0.9rem;padding:0.65rem 1.75rem;border-radius:0.5rem;text-decoration:none;">Claim Offer &rarr;</a>';

if (html.includes(old)) {
  html = html.split(old).join(neu);
  console.log('  ✅  Claim Offer button now points to #register');
} else {
  console.log('  ⚠️   String not found — check index.html manually');
}

if (usesCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync('index.html', html, 'utf8');