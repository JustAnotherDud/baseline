// 00:30 em UTC+1: a data UTC ainda é ontem; a app tem de usar a data local.
// Etc/GMT-1 = UTC+1 (o sinal POSIX é invertido). Cada ficheiro de teste corre
// no seu processo, por isso o TZ não passa para os outros.
process.env.TZ = 'Etc/GMT-1';

const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const NOW = '2026-09-24T23:30:00Z'; // 00:30 de 25/09 em UTC+1

// Date com "agora" fixo; o resto comporta-se como o Date real.
class FakeDate extends Date {
  constructor(...a) { super(...(a.length ? a : [NOW])); }
  static now() { return new Date(NOW).getTime(); }
}

test('cenário: às 00:30 em UTC+1 a data UTC ainda é a de ontem', () => {
  const d = new Date(NOW);
  assert.equal(d.getHours(), 0);
  assert.equal(d.toISOString().slice(0, 10), '2026-09-24');
});

test('localDate() às 00:30 em UTC+1 devolve o dia local', () => {
  const { localDate } = loadScript('js/config.js', { Date: FakeDate });
  assert.equal(localDate(), '2026-09-25');
  assert.equal(localDate(new Date(NOW)), '2026-09-25');
});

test('targets abre no dia local às 00:30 em UTC+1', () => {
  const ctx = loadScript('js/views/targets.js', { Date: FakeDate });
  // `let` de topo não fica no objecto global do contexto: ler por avaliação.
  assert.equal(vm.runInContext('currentTargetsDate', ctx), '2026-09-25');
});

test('janelas do Intervals.icu partem do dia local às 00:30 em UTC+1', () => {
  const { icuDateOffset } = loadScript('js/views/body.js', { Date: FakeDate });
  assert.equal(icuDateOffset(0), '2026-09-25');
  assert.equal(icuDateOffset(-14), '2026-09-11');
});
