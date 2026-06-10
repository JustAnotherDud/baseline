const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

// ui.js precisa de alguns stubs de DOM no topo — já cobertos pelo loadScript
const { parseGramsExpr } = loadScript('js/ui.js', {
  document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
  history: { pushState: () => {} },
  location: { hash: '' },
  setTimeout: () => {},
  clearTimeout: () => {},
});

// ── expressões válidas ────────────────────────────────────────────────────────
test("'100' → 100", () => assert.equal(parseGramsExpr('100'), 100));
test("'50+30' → 80", () => assert.equal(parseGramsExpr('50+30'), 80));
test("'3*25' → 75", () => assert.equal(parseGramsExpr('3*25'), 75));
test("'(20+30)*2' → 100", () => assert.equal(parseGramsExpr('(20+30)*2'), 100));
test("'100/3' → 33.3 (arredonda a 1 decimal)", () => assert.equal(parseGramsExpr('100/3'), 33.3));

// ── rejeições por resultado inválido ────────────────────────────────────────
test("'100/0' → null (Infinity rejeitado)", () => assert.equal(parseGramsExpr('100/0'), null));
test("'-50' → null (negativo rejeitado)", () => assert.equal(parseGramsExpr('-50'), null));

// ── inputs vazios/nulos ───────────────────────────────────────────────────────
test("'' → null", () => assert.equal(parseGramsExpr(''), null));
test("'   ' → null", () => assert.equal(parseGramsExpr('   '), null));
test("null → null", () => assert.equal(parseGramsExpr(null), null));
test("undefined → null", () => assert.equal(parseGramsExpr(undefined), null));

// ── caso limite: 0 → null (!raw é true para 0) ───────────────────────────────
// parseGramsExpr(0) devolve null porque !0 é true — o falsy check apanha 0.
// Comportamento actual documentado; se o utilizador precisar de 0g, terá de
// passar '0' como string.
test("0 → null (!raw apanha o falsy 0)", () => assert.equal(parseGramsExpr(0), null));

// ── strings com caracteres não-numéricos (fallback parseFloat) ───────────────
test("'abc' → null (regex falha, parseFloat('abc') é NaN)", () => assert.equal(parseGramsExpr('abc'), null));

// Comportamento actual: quando a regex falha, parseFloat aceita prefixo numérico.
// Não é um bug intencional — apenas documento o que o código faz hoje.
test("'10g' → 10 (regex falha, parseFloat lê prefixo numérico)", () => assert.equal(parseGramsExpr('10g'), 10));
test("'1e3' → 1000 (regex falha, parseFloat resolve notação científica)", () => assert.equal(parseGramsExpr('1e3'), 1000));
