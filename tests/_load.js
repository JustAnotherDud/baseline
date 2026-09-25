// Carrega scripts browser (escopo global, sem modules) num sandbox node:vm.
// Os ficheiros js/ não são requireáveis — correm aqui com stubs mínimos.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// relFile: um ficheiro ou uma lista, carregados por ordem depois de config.js.
function loadScript(relFile, extra = {}) {
  const ctx = vm.createContext({
    console,
    window: { matchMedia: () => ({ matches: true }) },
    document: { documentElement: {}, getElementById: () => null },
    getComputedStyle: () => ({ getPropertyValue: () => '#000000' }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    ...extra,
  });
  // config.js vem sempre primeiro, como no index.html (localDate, MEALS).
  for (const f of new Set(['js/config.js', ...[].concat(relFile)])) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  }
  return ctx; // as funções top-level do ficheiro ficam como propriedades do ctx
}

module.exports = { loadScript };
