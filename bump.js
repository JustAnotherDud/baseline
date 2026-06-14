const fs = require('fs');
const today = new Date();
const v = today.getFullYear().toString() +
  String(today.getMonth()+1).padStart(2,'0') +
  String(today.getDate()).padStart(2,'0');

let html = fs.readFileSync('index.html', 'utf8');

// Detectar versão mais alta actual
const matches = [...html.matchAll(/\?v=(\d{8})([a-z]*)/g)];
let newV = v;
if (matches.length) {
  const current = matches
    .map(m => m[1] + m[2])
    .sort().pop();
  const curDate = current.slice(0, 8);
  const curSuffix = current.slice(8);
  if (curDate === v) {
    const next = curSuffix
      ? String.fromCharCode(curSuffix.charCodeAt(0) + 1)
      : 'b';
    newV = v + next;
  }
}

html = html.replace(/\?v=\d{8}[a-z]*/g, `?v=${newV}`);
fs.writeFileSync('index.html', html);
console.log(`Bumped all ?v= to ${newV}`);

// Manter APP_VERSION (js/config.js) em sync com a versão dos scripts.
const cfgPath = 'js/config.js';
let cfg = fs.readFileSync(cfgPath, 'utf8');
cfg = cfg.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${newV}';`);
fs.writeFileSync(cfgPath, cfg);
console.log(`APP_VERSION → ${newV}`);
