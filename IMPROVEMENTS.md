# PDF-A-go-go: Future Improvement Backlog

Findings from code audit and architecture review, organized by effort level.

## Priority 2 -- Medium Effort

- **Test coverage gaps**: ~~Missing test coverage for multi-instance isolation, search functionality, accessibility features, error handling paths, and HTML download handler.~~ Addressed in `multi-instance.spec.ts`, `search.spec.ts`, `accessibility.spec.ts`, `error-handling.spec.ts`, and `html-download.spec.ts`. Remaining: deeper `htmlDownloadHandler.js` unit tests (642 lines, integration-tested only).

## Priority 3 -- Larger Opportunities

- **Switch back to PDF.js modern build**: Currently using the legacy build (`pdfjs-dist/legacy/build/`) to support Samsung Internet, which lacks `Uint8Array.toHex()` (requires Chromium 140+). Samsung Internet 29 ships Chromium 136. Revisit once Samsung Internet reaches Chromium 140+ (estimated late 2026). See `pdfLoader.js` imports and `webpack.config.js` worker rule.

- **OffscreenCanvas rendering**: Now universally supported in modern browsers. Could move tile rendering to web workers via `ImageBitmap` transfer for non-blocking rendering.
- **PDF.js struct tree support**: PDF.js v5.x has improved tagged PDF and accessibility tree features. Worth exposing for better screen reader support on tagged PDFs.
