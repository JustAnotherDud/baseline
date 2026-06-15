const { test } = require('node:test');
const assert = require('node:assert/strict');
const { incrSuffix, nextVersion } = require('../bump.js');

// ── incrSuffix: '' → 'b' … 'z' → 'aa' (sem overflow para '{') ──────────────────
test("incrSuffix('') → 'b' (primeiro do dia já com data; segundo é 'b')", () => {
  assert.equal(incrSuffix(''), 'b');
});
test("incrSuffix('b') → 'c'", () => assert.equal(incrSuffix('b'), 'c'));
test("incrSuffix('y') → 'z'", () => assert.equal(incrSuffix('y'), 'z'));
test("incrSuffix('z') → 'aa' (overflow corrigido — era '{')", () => {
  assert.equal(incrSuffix('z'), 'aa');
});
test("incrSuffix('az') → 'ba'", () => assert.equal(incrSuffix('az'), 'ba'));
test("incrSuffix('zz') → 'aaa'", () => assert.equal(incrSuffix('zz'), 'aaa'));

// ── nextVersion: escolhe o sufixo mais alto de hoje e incrementa ───────────────
test('nextVersion: sem versões de hoje → só o stamp', () => {
  const html = `<link href="css/styles.css?v=20260101"> <script src="a.js?v=20260101b">`;
  assert.equal(nextVersion(html, '20260615'), '20260615');
});
test('nextVersion: hoje só com data (sem sufixo) → b', () => {
  const html = `<a href="x?v=20260615"><b href="y?v=20260615">`;
  assert.equal(nextVersion(html, '20260615'), '20260615b');
});
test("nextVersion: hoje em 'z' → 'aa' (a regressão de 2026-06-15)", () => {
  const html = `<a href="x?v=20260615z"><b href="y?v=20260615z">`;
  assert.equal(nextVersion(html, '20260615'), '20260615aa');
});
test("nextVersion: 'aa' ordena acima de 'z' (length-aware) → 'ab'", () => {
  const html = `<a href="x?v=20260615z"><b href="y?v=20260615aa">`;
  assert.equal(nextVersion(html, '20260615'), '20260615ab');
});
