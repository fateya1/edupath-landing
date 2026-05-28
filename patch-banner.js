const fs = require('fs');
const raw = fs.readFileSync('index.html', 'utf8');
const usesCRLF = raw.includes('\r\n');
let html = raw.replace(/\r\n/g, '\n');

const patches = [
  [
    'Banner heading — remove Zeraki mention',
    'Switching from Zeraki or another system?',
    'Already using a school management system?'
  ],
  [
    'Banner body — remove Zeraki mention',
    'Get your <strong>first term free</strong> + complimentary data migration — students, fees, results and timetable imported for you.',
    'Switch to Edupath and get your <strong>first term free</strong> + complimentary data migration — students, fees, results and timetable imported for you, at no extra cost.'
  ],
  [
    'Banner small print — update deadline to Term 2 2026',
    'Valid for new schools registering before end of Term 2 2025. One school per offer.',
    'Valid for schools registering before end of Term 2 2026. One school per offer.'
  ],
];

let applied = 0;
for (const [desc, oldStr, newStr] of patches) {
  if (html.includes(oldStr)) {
    html = html.split(oldStr).join(newStr);
    console.log('  ✅  ' + desc);
    applied++;
  } else {
    console.log('  ⚠️   SKIPPED: ' + desc);
  }
}

if (usesCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync('index.html', html, 'utf8');
console.log('\n✅  Done — ' + applied + ' applied.');