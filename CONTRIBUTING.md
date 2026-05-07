# Contributing

Thanks for your interest. PDF-A-go-go is a lightweight embeddable PDF viewer built on PDF.js — a single script-tag + `<div>` deploy story is the goal, so contributions that preserve that experience are most welcome.

## Filing issues

Open an issue at https://github.com/khawkins98/PDF-A-go-go/issues. Useful detail:

- Browser + OS, with a console log if there's an error.
- A small repro PDF if possible (or a public URL of one).
- Whether you're embedding via the script tag, importing the UMD, or running the dev server.
- For visual issues, before/after screenshots and the viewer URL.

## Proposing changes

1. Fork and branch off `main`.
2. **Use `yarn`, not `npm`.** There is no `package-lock.json` — the project uses yarn exclusively. `yarn install` to bootstrap.
3. `yarn test` runs the Playwright suite (it auto-runs `yarn build` first via the `pretest` hook).
4. Open a draft PR while you iterate.

## What to watch when editing

The CLAUDE.md file is the canonical list. The most important ones:

- **Source is vanilla JS; tests are TypeScript.** Don't convert source files in `src/assets/js/` to TypeScript or introduce framework patterns.
- **PDF.js is v5.x.** Older v4 patterns from blog posts or Stack Overflow won't work — verify against the v5 API.
- **0-based vs 1-based pages.** Internal `currentPage` and `go_to_page()` are 0-based. Public `goToPage()` (on both `ScrollablePdfViewer` and `ViewerInstance`) is 1-based. Don't conflate them.
- **CSS is plain CSS** — no preprocessor, no modules. It's copied through by CopyPlugin.
- **Scope hoisting stays disabled** in the webpack production build — re-enabling causes `pdfjs-dist` module-registry collisions.
- **HTML partials** use `<!-- @@NAV@@ -->` / `<!-- @@HEAD@@ -->` placeholders injected at build time via CopyPlugin transforms (not a template engine).

## Branch and commit style

- Branches: descriptive, e.g. `chore/cleanup-and-yarn-migration`, `fix/double-spread-mode`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) — match recent history.

## Review

Best-effort, no SLA — this is a personal project. PDF-rendering bug reports with a repro PDF are usually fast to triage.

## License

MIT. See [LICENSE](LICENSE).
