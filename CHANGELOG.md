# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged in git (`v1.5`, `v1.6`, …); the `package.json` version is
realigned with the tag as of 1.6.0.

## [1.6.0] - 2026-08-31

### Fixed

- Share ("copy link") button now produces the correct `#pdf-page-N` fragment
  for the current page (was off by one).
- Multi-instance search isolation: highlights are scoped per viewer instead of
  a shared global, so searching in one viewer no longer highlights another.
- PDF loader probes the content type with a `HEAD` request instead of a second
  full `GET`, so a direct PDF is no longer downloaded twice. Ambiguous HEAD
  responses fall back to `GET`, preserving HTML-redirect detection.
- No longer rasterizes and discards a full-page canvas for every page on the
  tile-rendering path (memory/CPU win, largest on big documents).
- Window/document event listeners are removed on `destroy()` (no leaks in
  single-page-app / multi-instance teardown).
- `data-momentum="0"` is now respected instead of being coerced to the default.

### Added — accessibility (WCAG 2.1 AA)

- Keyboard focus is never invisible; removed hundreds of nameless per-page
  canvas tab stops on large documents.
- Search results and "Link copied" are announced to screen readers via
  `role="status"`.
- Implemented the advertised `Ctrl+F` shortcut, made the resize grip
  keyboard-operable, and added fullscreen focus management.
- `prefers-reduced-motion` support, larger touch targets, improved hint-text
  contrast, and `prefers-color-scheme` auto-dark theming.

### Changed

- Consolidated the two search implementations onto `SearchController`;
  `search.js` is now a thin UI layer.
- Removed the unreachable legacy render/cleanup path and the unused `init()`
  export. Programmatic embedders should use `initializeContainer()` / the
  auto-init path.

### Removed

- Dead code: legacy offscreen-page cleanup branch, `_renderAllPages` /
  `_updateVisiblePages` guards, and an empty webpack `afterEmit` hook.

### Tooling

- Added a `commit-msg` git hook (in `.githooks/`, auto-wired via the `prepare`
  script) that blocks AI/agent co-author trailers and machine-generated
  attribution lines while leaving genuine human commits untouched.
- Dev-dependency bumps: `@playwright/test`, `webpack`, `webpack-cli`,
  `webpack-dev-server`, `start-server-and-test`.
