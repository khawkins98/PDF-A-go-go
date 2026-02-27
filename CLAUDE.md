# CLAUDE.md

This file covers common gotchas and exceptions. For standard guidance, see `README.md` and `DOCUMENTATION.md`.

## Common Mistakes

- **Use `yarn`, not `npm`**. There is no `package-lock.json`; the project uses yarn exclusively.
- **Source is vanilla JS; tests are TypeScript.** Source files in `src/assets/js/` are plain `.js`. Only Playwright test files (`src/tests/*.spec.ts`) are TypeScript. Don't convert source to TS or introduce framework patterns.
- **PDF.js v5.x — not v4.** The `pdfjs-dist` dependency is v5.x, which has breaking API changes from v4. Don't use v4 patterns from older docs/examples.
- **`go_to_page(pageNum)` on ScrollablePdfViewer is 0-based. `goToPage(pageNum)` on ViewerInstance is 1-based.** Easy to confuse.
- **The UMD global is `flipbook`**, not `pdfagogo`. Set in webpack config.
- **The worker bundle is `pdf-a-go-go.dependencies.js`** — webpack renames `pdf.worker.mjs` to this via `asset/resource`.
- **CSS is plain CSS, not bundled by webpack.** It's copied as-is by CopyPlugin. No preprocessor, no CSS modules.
- **`yarn test` runs `yarn build` first** (via `pretest` hook). Don't build separately before testing.
- **Scope hoisting is disabled** in the webpack production build to prevent `pdfjs-dist` module registry collisions. Don't re-enable it.
- **HTML partials** (`src/partials/nav.html`, `src/partials/head.html`) are injected at build time via CopyPlugin transforms, not a template engine. Use `<!-- @@NAV@@ -->` and `<!-- @@HEAD@@ -->` placeholders.
