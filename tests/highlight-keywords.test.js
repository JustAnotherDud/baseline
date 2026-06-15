const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const { highlightFoodKeywords } = loadScript('js/ui.js', {
  document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
  history: { pushState: () => {} },
  location: { hash: '' },
  setTimeout: () => {},
  clearTimeout: () => {},
});

// ── Escape (contrato de segurança: nomes externos vão para innerHTML) ──────────
test('escapa < > & " em entidades HTML', () => {
  const out = highlightFoodKeywords('a <b> & "c"');
  assert.ok(!out.includes('<b>'), 'não deve conter <b> cru');
  assert.ok(out.includes('&lt;b&gt;'));
  assert.ok(out.includes('&amp;'));
  assert.ok(out.includes('&quot;c&quot;'));
});

test('neutraliza tentativa de <script>', () => {
  const out = highlightFoodKeywords('<script>alert(1)</script>');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});

test("apóstrofe ' passa intacta (texto em innerHTML — seguro)", () => {
  // Comportamento actual: escHtml escapa ' mas highlightFoodKeywords não.
  assert.equal(highlightFoodKeywords("d'água"), "d'água");
});

// ── Highlight de keywords ──────────────────────────────────────────────────────
test('envolve keyword conhecida num span colorido', () => {
  const out = highlightFoodKeywords('Iogurte Light');
  assert.ok(out.includes('<span style="color:var(--text3);font-weight:600">Light</span>'));
});

test('match é case-insensitive e preserva a caixa original', () => {
  const out = highlightFoodKeywords('iogurte integral');
  assert.ok(out.includes('>integral</span>'));
});

test('nome sem keyword nem caracteres especiais fica inalterado', () => {
  assert.equal(highlightFoodKeywords('Banana'), 'Banana');
});

test('combina escape + highlight no mesmo nome', () => {
  const out = highlightFoodKeywords('Pão & Integral');
  assert.ok(out.includes('&amp;'));
  assert.ok(out.includes('>Integral</span>'));
});
