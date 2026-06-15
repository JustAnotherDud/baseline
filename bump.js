const fs = require('fs');

// Stamp YYYYMMDD para uma data (default: hoje).
function todayStamp(d = new Date()) {
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

// Incremento estilo folha-de-cálculo: '' → 'b' → … → 'z' → 'aa' → 'ab' …
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

// Próxima versão dado o HTML actual e o stamp de hoje. Puro (sem IO).
// Maior sufixo de hoje por comprimento, depois alfabético ('' < 'b' < 'z' < 'aa').
function nextVersion(html, stamp) {
  const matches = [...html.matchAll(/\?v=(\d{8})([a-z]*)/g)];
  const todays = matches.filter(m => m[1] === stamp).map(m => m[2]);
  if (!todays.length) return stamp;
  const cur = todays.sort((a, b) => a.length - b.length || a.localeCompare(b)).pop();
  return stamp + incrSuffix(cur);
}

function run() {
  const stamp = todayStamp();
  let html = fs.readFileSync('index.html', 'utf8');
  const newV = nextVersion(html, stamp);
  html = html.replace(/\?v=\d{8}[a-z]*/g, `?v=${newV}`);
  fs.writeFileSync('index.html', html);
  console.log(`Bumped all ?v= to ${newV}`);

  // Manter APP_VERSION (js/config.js) em sync com a versão dos scripts.
  const cfgPath = 'js/config.js';
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = cfg.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${newV}';`);
  fs.writeFileSync(cfgPath, cfg);
  console.log(`APP_VERSION → ${newV}`);
}

if (require.main === module) run();

module.exports = { incrSuffix, nextVersion, todayStamp };
