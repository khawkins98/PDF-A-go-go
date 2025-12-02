# PDF-A-go-go

[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/khawkins98/PDF-A-go-go/actions)
[![Open issues](https://img.shields.io/github/issues/khawkins98/PDF-A-go-go.svg)](https://github.com/khawkins98/PDF-A-go-go/issues)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

PDF-A-go-go is a drop-in PDF viewer you can embed with a single script tag. Add a tiny CSS file for polish, set options with `data-*` attributes, and you're done—no framework, no build step, no init code.

Read more about [the motivation and design](https://www.allaboutken.com/posts/20250811-pdf-a-go-go/index.html).

## Quick Start

```html
<!-- Optional CSS for styling -->
<link
  rel="stylesheet"
  href="https://khawkins98.github.io/PDF-A-go-go/pdf-a-go-go.css"
/>

<!-- The viewer -->
<script
  defer
  src="https://khawkins98.github.io/PDF-A-go-go/pdf-a-go-go.js"
></script>

<!-- Your container -->
<div
  class="pdfagogo-container"
  data-pdf-url="./your-document.pdf"
  style="width:100%;max-width:100%;box-sizing:border-box"
></div>
```

## Demo

- [Basic demo](https://khawkins98.github.io/PDF-A-go-go/)
- [Large double spread](https://khawkins98.github.io/PDF-A-go-go/double-spread.html#pdf-page-10) (12MB PDF)
- [827-page stress test](https://khawkins98.github.io/PDF-A-go-go/stress-test-large-pdf.html)

## Features

- Vertical scroll viewing with smooth momentum
- Pinch-to-zoom, Ctrl+Plus/Minus, mouse wheel zoom (25%-500%)
- Tile-based rendering for efficient memory usage (~8MB vs ~80MB)
- Full-text search with highlighting
- Keyboard navigation and screen reader support
- Deep linking and shareable page URLs
- Mobile responsive with touch-optimized interactions
- Works in static HTML, CMS templates, and site builders

## Configuration

Set options via `data-*` attributes:

| Attribute                 | Default | Description                |
| ------------------------- | ------- | -------------------------- |
| `data-pdf-url`            | —       | PDF URL to load (required) |
| `data-default-page`       | 1       | Starting page (1-based)    |
| `data-show-search`        | true    | Show search controls       |
| `data-show-share`         | true    | Show share button          |
| `data-show-page-selector` | true    | Show page selector         |
| `data-show-download`      | true    | Show download button       |
| `data-show-fullscreen`    | true    | Show fullscreen toggle     |
| `data-show-resize-grip`   | true    | Show height resize handle  |
| `data-debug`              | false   | Show performance overlay   |

## Keyboard Shortcuts

| Shortcut          | Action                |
| ----------------- | --------------------- |
| Ctrl + Plus/Minus | Zoom in/out           |
| Ctrl + 0          | Reset zoom to 100%    |
| Ctrl + Scroll     | Zoom with mouse wheel |

## Browser Support

| Browser        | Minimum Version |
| -------------- | --------------- |
| Chrome         | 109+            |
| Firefox        | 128+            |
| Safari         | 15.6+           |
| Edge           | 133+            |
| iOS Safari     | 15.6+           |
| Android Chrome | 135+            |

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 9000)
npm run build        # Production build to /dist
npm test             # Run Playwright tests
```

## Credits

- [PDF.js](https://github.com/mozilla/pdf.js) - Mozilla's PDF rendering library (Apache 2.0)
- [Lucide](https://lucide.dev) - Icons (MIT)

## License

[MIT License](LICENSE)
