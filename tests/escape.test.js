const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const { escHtml } = loadScript('js/ui.js', {
  document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
  history: { pushState: () => {} },
  location: { hash: '' },
  setTimeout: () => {},
  clearTimeout: () => {},
});

// ── caracteres especiais HTML ────────────────────────────────────────────────
test("escHtml escapa & < > \" '", () => {
  assert.equal(escHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});

test("apóstrofe vira &#39;", () => {
  assert.equal(escHtml("Iogurte d'água"), 'Iogurte d&#39;água');
});

// ── inputs nulos/vazios → string vazia ───────────────────────────────────────
test("escHtml(null) → ''", () => assert.equal(escHtml(null), ''));
test("escHtml(undefined) → ''", () => assert.equal(escHtml(undefined), ''));
test("escHtml('') → ''", () => assert.equal(escHtml(''), ''));

// ── string sem caracteres especiais passa sem alteração ──────────────────────
test("escHtml('texto normal') passa inalterado", () => {
  assert.equal(escHtml('texto normal'), 'texto normal');
});
