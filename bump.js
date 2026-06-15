const fs = require('fs');
const today = new Date();
const v = today.getFullYear().toString() +
  String(today.getMonth()+1).padStart(2,'0') +
  String(today.getDate()).padStart(2,'0');

// Incremento estilo folha-de-cálculo: '' → 'b' → … → 'z' → 'aa' → 'ab' …
// (mantém o comportamento antigo até 'z'; só corrige o overflow z→{).
function incrSuffix(s) {
  if (!s) return 'b';
  const a = s.split('');
  let i = a.length - 1;
  while (i >= 0) {
    if (a[i] === 'z') { a[i] = 'a'; i--; }
    else { a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1); return a.join(''); }
  }
  return 'a' + a.join('');
}

let html = fs.readFileSync('index.html', 'utf8');

// Detectar o sufixo mais alto de hoje: por comprimento, depois alfabético
// ('' < 'b' < 'z' < 'aa' < 'ab' …).
const matches = [...html.matchAll(/\?v=(\d{8})([a-z]*)/g)];
let newV = v;
const todays = matches.filter(m => m[1] === v).map(m => m[2]);
if (todays.length) {
  const cur = todays.sort((a, b) => a.length - b.length || a.localeCompare(b)).pop();
  newV = v + incrSuffix(cur);
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
