# PDF-A-go-go: Future Improvement Backlog

Findings from code audit and architecture review, organized by effort level.

## Priority 2 -- Medium Effort

- **Test coverage gaps**: Missing test coverage for multi-instance isolation, search functionality, accessibility features, error handling paths, and HTML download handler (`htmlDownloadHandler.js` -- 642 lines, 0 tests).

## Priority 3 -- Larger Opportunities

- **OffscreenCanvas rendering**: Now universally supported in modern browsers. Could move tile rendering to web workers via `ImageBitmap` transfer for non-blocking rendering.
- **IntersectionObserver for visibility detection**: Replace current scroll-position-based visibility calculation with `IntersectionObserver` API for more efficient and accurate visible page detection.
- **PDF.js struct tree support**: PDF.js v5.x has improved tagged PDF and accessibility tree features. Worth exposing for better screen reader support on tagged PDFs.
