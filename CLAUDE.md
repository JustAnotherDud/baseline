# CLAUDE.md — Baseline

Lê `baseline-handoff.md` antes de qualquer tarefa — é o mapa canónico da app.
Para contexto de produto/design, consulta `PRODUCT.md` e `DESIGN.md`.

## Regras de arquitectura invioláveis

- **Sem build step, sem bundler, sem ES modules.** Scripts via `<script>` tags; funções em escopo global; `onclick=` no HTML.
- **`escHtml()` em todas as interpolações innerHTML com dados externos** (nomes de alimentos, ICU, Hevy). Nunca inserir strings externas directamente em templates HTML.
- **Snapshot-diary:** nutrientes copiados no momento do registo em `diary`; editar `foods` não altera histórico.
- **`daily_targets` é read-only na PWA** — o DCB é a única fonte de escrita.

## Antes de cada push (ritual obrigatório)

```bash
node --check js/views/ficheiro_alterado.js
npm test          # deve passar 92 testes
node bump.js      # actualiza ?v= timestamps
```

O hook `githooks/pre-push` automatiza o `node --check` + `npm test`. Activar uma
vez por clone: `git config core.hooksPath githooks` (bloqueia o push se falhar).

Ao mexer em cores (`:root` de `styles.css`): `node contrast-check.js` — gate
WCAG AA que lê os tokens reais e falha se algum par texto/fundo descer abaixo
do mínimo. Todos passam em 2026-06-15 (pior caso `text3` em `surface2` 5.65:1).

## Convenção de linguagem e voz

- Comentários, commits e documentação em **pt-PT**.
- Voz: telegráfica, técnica, sem marketing. Ver exemplos em `PRODUCT.md`.
