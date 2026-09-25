# CLAUDE.md

Mapa da app, schema e integrações: `README.md`. Produto e design: `PRODUCT.md` e `DESIGN.md`.

## Regras

- Sem build, sem bundler, sem ES modules. Scripts por `<script>`, funções globais, `onclick=` no HTML.
- `escHtml()` em toda a interpolação `innerHTML` com dados externos (alimentos, ICU, Hevy).
- Diário em snapshot: editar `foods` não muda registos antigos.
- `daily_targets` é só de leitura na PWA. Só o DCB escreve.

## Antes de cada push

```bash
npm test          # o hook githooks/pre-push corre node --check + npm test
node bump.js      # actualiza ?v= e APP_VERSION
```

Ao mexer nas cores de `:root`: `node contrast-check.js`.

## Língua

Comentários, commits e docs em pt-PT. Voz telegráfica, sem marketing.
