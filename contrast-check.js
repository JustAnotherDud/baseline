// Gate de contraste WCAG AA para o sistema de cores.
// Lê os tokens de :root em css/styles.css (não hardcoda hex) e verifica os
// pares texto/fundo principais. Sai com código 1 se algum descer abaixo do AA.
// Uso: node contrast-check.js
const fs = require('fs');

// Normaliza hex de 3 dígitos (#bbb) para 6 (#bbbbbb).
const norm6 = h => h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h;

const css = fs.readFileSync('css/styles.css', 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const tok = {};
for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)\b/g)) tok[m[1]] = norm6(m[2]);

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = h => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => { const l1 = L(a), l2 = L(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

// [label, fg-token, bg-token, kind] — kind 'body' = 4.5:1, 'large' = 3:1.
const PAIRS = [
  ['text primário', 'text', 'bg', 'body'],
  ['text2 secundário', 'text2', 'bg', 'body'],
  ['text3 labels/meta em bg', 'text3', 'bg', 'body'],
  ['text3 em surface2 (chips)', 'text3', 'surface2', 'body'],
  ['text3 em surface (sheets)', 'text3', 'surface', 'body'],
  ['red deficit (~11px)', 'red', 'bg', 'body'],
  ['accent kcal herói (large)', 'accent', 'bg', 'large'],
  ['blue PROT (large)', 'blue', 'bg', 'large'],
  ['yellow CARBS (large)', 'yellow', 'bg', 'large'],
  ['orange FAT (large)', 'orange', 'bg', 'large'],
  ['accent-ink em botão accent', 'accent-ink', 'accent', 'body'],
];

let failed = 0;
console.log('PAIRING'.padEnd(32), 'RATIO', ' THRESHOLD', 'RESULT');
for (const [label, fg, bg, kind] of PAIRS) {
  if (!tok[fg] || !tok[bg]) { console.log(label.padEnd(32), '  ?  ', '  token em falta', `(${fg}/${bg})`); failed++; continue; }
  const thr = kind === 'large' ? 3.0 : 4.5;
  const r = ratio(tok[fg], tok[bg]);
  const ok = r >= thr;
  if (!ok) failed++;
  console.log(label.padEnd(32), r.toFixed(2).padStart(5), `  ${kind} ${thr}`, `  ${ok ? 'PASS' : 'FAIL'}`);
}

if (failed) { console.error(`\n${failed} par(es) abaixo de WCAG AA.`); process.exit(1); }
console.log('\nTodos os pares passam WCAG AA.');
