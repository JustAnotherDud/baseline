// Carrega scripts browser (escopo global, sem modules) num sandbox node:vm.
// Os ficheiros js/ não são requireáveis — correm aqui com stubs mínimos.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadScript(relFile, extra = {}) {
  const ctx = vm.createContext({
    console,
    window: { matchMedia: () => ({ matches: true }) },
    document: { documentElement: {}, getElementById: () => null },
    getComputedStyle: () => ({ getPropertyValue: () => '#000000' }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    ...extra,
  });
  const src = fs.readFileSync(path.join(__dirname, '..', relFile), 'utf8');
  vm.runInContext(src, ctx, { filename: relFile });
  return ctx; // as funções top-level do ficheiro ficam como propriedades do ctx
}

module.exports = { loadScript };
