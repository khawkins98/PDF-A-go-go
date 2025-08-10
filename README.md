# PDF-A-go-go

[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/khawkins98/PDF-A-go-go/actions)
[![Open issues](https://img.shields.io/github/issues/khawkins98/PDF-A-go-go.svg)](https://github.com/khawkins98/PDF-A-go-go/issues)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

PDF-A-go-go is a drop‑in PDF viewer you can embed with a single script tag. Add a tiny CSS file for polish, set options with `data-*` attributes, and you’re done—no framework, no build step, no init code. It works almost anywhere you can write HTML.

## Why PDF-A-go-go?

- **One‑line install**: Include one JS file, optionally one small CSS file.
- **Tiny footprint**: Real‑world transfer sizes in the demo are about 120 KB for the core viewer JS, ~490 KB for JS dependencies, and ~4 KB for CSS.
- **Works almost anywhere**: Static HTML, CMS templates, site builders, static‑site generators, no `<iframe>` required.
- **Super flexible embed**: Configure everything via `data-*` attributes—no custom JS required.
- **Accessible and fast**: Keyboard navigation, ARIA labels, screen‑reader support, and performance‑minded rendering.

## Quick start (one line of JS)

Paste this into any HTML page. Replace the `data-pdf-url` with your PDF.

```html
<!-- Optional but recommended: small CSS for sensible defaults -->
<link rel="stylesheet" href="https://khawkins98.github.io/PDF-A-go-go/pdf-a-go-go.css">

<!-- One line to add the viewer -->
<script defer src="https://khawkins98.github.io/PDF-A-go-go/pdf-a-go-go.js"></script>

<!-- Drop a container anywhere on the page -->
<div class="pdfagogo-container"
     data-pdf-url="./example.pdf"
     style="width:100%;max-width:100%;box-sizing:border-box"></div>
```

That’s it. No initialization code—`pdf-a-go-go.js` auto‑boots and reads options from your container.

## Future plans

This project is very fresh (rolled on May 2025, refactored in Aug 2025). I may yet publish to npm or change it completely.

## Demo

- [Basic demo](https://khawkins98.github.io/PDF-A-go-go/)
- [Large double spread demo](https://khawkins98.github.io/PDF-A-go-go/double-spread.html#pdf-page-10) (12MB PDF)
- [Load iFrame with meta redirect](https://khawkins98.github.io/PDF-A-go-go/html-download-example.html)
- [Large PDF stress test (827 pages)](https://khawkins98.github.io/PDF-A-go-go/stress-test-large-pdf.html)
- [Remote PDF (CORS allowed)](https://khawkins98.github.io/PDF-A-go-go/remote-pdf-allowed.html)
- [Remote PDF (expected CORS failure)](https://khawkins98.github.io/PDF-A-go-go/remote-pdf-cors-fail.html)

## Features

- 📖 **Vertical scroll PDF viewing** with smooth native momentum
- 🔍 **Advanced zoom support** (pinch-to-zoom, Ctrl+Plus/Minus, mouse wheel)
- 📏 **Accurate scroll positioning** - scroll bar reflects true document position
- 🧠 **Intelligent memory management** - automatically scales for small and large documents (tested up to 827 pages)
- 🦾 **Fully accessible** (keyboard navigation, ARIA labels, screen reader support)
- ⚡ **Performance optimized** with adaptive batching and unified scaling algorithms
- 🎨 **Customizable UI** (show/hide controls)
- 📱 **Mobile responsive** with touch-optimized interactions
- 🎯 **Deep linking** - set default page via embed options
- 🔗 **Shareable page links** with URL fragments
- 🪶 **Lightweight** - minimal dependencies, embeddable (single script tag + small CSS)
- ⌨️ **Comprehensive keyboard navigation**
- 🔍 **Full-text search** with highlighting and match navigation
- 🔝 **Resizable viewer** with drag handle
- 📑 **Complete navigation controls** (page selector, share link)
- ⬇️ **PDF download** functionality
- 🖥️ **Fullscreen toggle** for viewer and controls
- 🌐 **Smart HTML download handling** for institutional repositories
- 🛠️ **Built on** [pdf.js](https://github.com/mozilla/pdf.js) with performance enhancements

## Usage and features

Include the JS and CSS in your HTML, and add a container:

```html
<link rel="stylesheet" href="pdf-a-go-go.css">
<script defer src="https://khawkins98.github.io/PDF-A-go-go/pdf-a-go-go.js"></script>
<div class="pdfagogo-container" id="pdfagogo-container"
     data-pdf-url="./example.pdf"
     data-show-search="true"
     data-show-share="true"
     data-show-page-selector="true"
     data-show-current-page="true"
     data-show-download="true"
     data-show-fullscreen="true"
     data-show-resize-grip="true"
     data-show-accessibility-controls-visibly="true"
     style="width:100vw;max-width:100%;box-sizing:border-box;overflow-x:hidden;"></div>
```

Set options via `data-*` attributes on the container (no init code required):

- `data-pdf-url` (string): PDF URL to load (default: sample PDF)
- `data-show-page-selector` (true/false): Show page selector input (default: true)
- `data-show-current-page` (true/false): Show current page indicator (default: true)
- `data-show-search` (true/false): Show search controls (default: true)
- `data-show-share` (true/false): Show a Share button (default: true)
- `data-show-download` (true/false): Show a Download PDF button (default: true)
- `data-show-fullscreen` (true/false): Show a Fullscreen toggle (default: true)
- `data-show-resize-grip` (true/false): Show a bar to allow the user to resize the height (default: true)
- `data-show-accessibility-controls-visibly` (true/false): Show a visible accessibility instructions block below the viewer (default: true)
- `data-default-page` (number): Default page to open if no #page=N in URL (1-based)
- `data-background-color` (string): Background color (optional)
- `data-box-border` (number): Box border size (optional)
- `data-margin`, `data-margin-top`, `data-margin-left` (number): Margins (optional)
- `data-disable-webgl` (true/false): Disable WebGL rendering in PDF.js (default: true / WebGL off).
  - **Note:** Disabling WebGL (the default) seems to be more performant in most browsers.

### Embedding flexibility

You can place the `pdfagogo-container` almost anywhere:

- Inside CMS templates (WordPress/Drupal), static site builders, or hand‑written HTML
- In responsive layouts; the viewer fills the container width
- In an `<iframe>` for sandboxed embeds

Use inline styles or your own stylesheet to size the container. The viewer will adapt to the space you give it.

## Zoom Functionality

PDF-A-go-go supports multiple zoom methods for better document readability:

### Touch Devices

- **Pinch-to-zoom**: Use two fingers to pinch in/out to zoom in/out
- Zoom range: 25% to 500%

### Desktop/Keyboard

- **Ctrl + Plus** (or **Ctrl + =**): Zoom in
- **Ctrl + Minus**: Zoom out
- **Ctrl + 0**: Reset zoom to 100%
- **Mouse wheel + Ctrl**: Scroll wheel while holding Ctrl to zoom

**Note**: For keyboard zoom shortcuts to work, the PDF viewer must be focused. Click on the PDF viewer area first, then use the keyboard shortcuts.

### Zoom Behavior

- Zoom uses CSS scaling for smooth performance (no PDF re-rendering required)
- Zoom is centered at the top of the viewing area
- When zoomed in, horizontal scrolling becomes available
- Zoom level ranges from 25% to 500% in 10% increments

## HTML Download Handler

---

Note this is an advanced feature and may require some customisation or adaptation. It is quite experimental. See more in <https://github.com/khawkins98/PDF-A-go-go/pull/7>

- This currently has only been tested against iframes using meta redirects
- CORS must be set correctly (this is best used when the source and target page are the same)
- This may change to support user-based navigation to a PDF link and intercepting of the PDF load

---

PDF-A-go-go includes smart handling for cases where a PDF URL initially returns an HTML page that triggers the actual PDF download. This is common with institutional repositories, document management systems, and academic websites.

When such a case is detected, PDF-A-go-go will:

1. Display the HTML page in an iframe
2. Monitor for PDF download links or triggers
3. Automatically handle the PDF download once detected
4. Display the PDF in the viewer

To configure the HTML download handler behavior, use these options:

```html
<div class="pdfagogo-container"
     data-pdf-url="https://example.com/document/download"
     data-download-timeout="30000"
     ...></div>
```

Options:

- `data-download-timeout` (number): Time in milliseconds to wait for PDF download to start (default: 30000)

You can see this in action in the [HTML download example](//khawkins98.github.io/PDF-A-go-go/html-download-example.html).

## Performance Monitoring

PDF-A-go-go includes a debug mode that provides performance metrics for PDF loading and rendering. To enable debug mode, add the `data-debug="true"` attribute to your container:

```html
<div class="pdfagogo-container"
     data-pdf-url="./example.pdf"
     data-debug="true"
     ...></div>
```

When debug mode is enabled, a floating overlay is shown and you can programmatically access metrics using `getPerformanceMetrics()`:

```javascript
const viewer = document.querySelector('.pdfagogo-container').pdfViewer;
const metrics = viewer.getPerformanceMetrics();
console.log(metrics);
```

The metrics object includes:

- `initialRenderTime`: Time for initial render (ms)
- `averageHighResRenderTime`: Average time to render a page upgrade (ms)
- `totalPagesRendered`: Total number of pages rendered
- `totalHighResUpgrades`: Total number of high-res upgrades performed
- `pageRenderTimes`: Object mapping page indices to render times
- `highResUpgradeTimes`: Object mapping page indices to upgrade times

Note: `getPerformanceMetrics()` returns `null` when debug mode is disabled.

## Development

To set up a local development environment:

- Fork the repository and create your branch from `main`.
- Run `npm install` and `npm run dev` to start the dev server.
- Production build is written to `/dist` via `npm run build`.
- Please follow the code style and add comments where helpful.
- Open a pull request with a clear description of your changes.

## Performance & Testing

PDF-A-go-go includes comprehensive automated testing using Playwright, covering functionality, performance, and scalability:

### Test Coverage

- **Zoom functionality** (15 test scenarios including pinch, keyboard, boundaries)
- **Large document handling** (827-page PDF stress tests)
- **Memory management** (adaptive cleanup and buffer sizing)
- **Scroll accuracy** (precise positioning across all document sizes)
- **Performance benchmarks** (render times, CPU usage, memory efficiency)

### Performance Optimizations

- **Unified scaling algorithms** - single codebase handles all document sizes efficiently
- **Adaptive memory management** - buffer sizes scale automatically (4-20 pages depending on document size and device)
- **Intelligent batching** - page creation scales from 10-50 pages per batch
- **Progressive cleanup timing** - cleanup intervals adapt to document complexity (150ms-1000ms)

To run the tests:

```bash
# Install dependencies
npm install

# Run all tests (automatically starts dev server)
npm test

# Debug mode for all tests
npm run test:debug

# Run specific tests (start dev server in another terminal first)
# Terminal 1:
npm run test:serve
# Terminal 2:
npx playwright test src/tests/zoom.spec.ts
```

Performance thresholds (as enforced by tests):

- **Desktop**: Initial render < 5s
- **Mobile**: Initial render < 10s (with CPU throttling)
- **Scroll/CPU**: Reasonable scroll duration and CPU usage under load

The development server runs on port 9000 by default (<http://localhost:9000>).

## License

This project is licensed under the [MIT License](LICENSE).
