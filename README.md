# PDF-A-go-go

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/khawkins98/PDF-A-go-go/actions)
[![npm version](https://img.shields.io/npm/v/pdf-a-go-go.svg?style=flat)](https://www.npmjs.com/package/pdf-a-go-go)
[![Open Issues](https://img.shields.io/github/issues/khawkins98/PDF-A-go-go.svg)](https://github.com/khawkins98/PDF-A-go-go/issues)

PDF-A-go-go is a super simple, embeddable PDF viewer project. It is designed to be lightweight and easy to integrate into your own applications.

## Features

- 📖 Flipbook-style PDF viewing
- 📄📄 Dual-spread PDF viewing (auto-detects PDFs with 2 page layout, see notes below)
- 🔍 Text search within PDFs
- 🦾 Accessible (keyboard navigation, ARIA labels, screen reader support)
- ⚡ Fast, lightweight, and dependency-minimal
- 🎨 Customizable UI (show/hide controls)
- 📱 Responsive and embeddable
- 🎯 Set a default page to open via embed options
- 🔗 Shareable page links
- 🪶 Lightweight, embeddable PDF viewer
- ⌨️ Keyboard and accessible navigation
- 🔍 Search with next/prev match
- 📑 Page selector and navigation controls
- ⬇️ Download PDF button
- 🛠️ Based on [pdf.js](https://github.com/mozilla/pdf.js) and [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer)

## Demo

See [`dist/index.html`](dist/index.html) for a live demo, or try it online:
[PDF-A-go-go Demo](https://github.com/khawkins98/PDF-A-go-go#demo)

## Usage

Include the JS and CSS in your HTML, and add a container:

```html
<link rel="stylesheet" href="pdf-a-go-go.css">
<script src="pdf-a-go-go.js"></script>
<div class="pdfagogo-container" id="pdfagogo-container"></div>
```

Set options before loading:

```js
window.PDFaGoGoOptions = {
  showPrevNext: true,      // Show previous/next page buttons (default: true)
  showPageSelector: true,  // Show page selector input (default: true)
  showCurrentPage: true,   // Show current page indicator (default: true)
  showSearch: true,        // Show search controls (default: true)
  showDownload: true,      // Show a Download PDF button
  pdfUrl: "https://example.com/your.pdf", // PDF URL to load (default: sample PDF)
  defaultPage: 3,              // (NEW) Default page to open if no #page=N in URL (1-based)
};
```

## Development

=======
PDF-A-go-go is a super simple, embeddable PDF viewer project. It is designed to be lightweight and easy to integrate into your own applications.

This project is heavily based on the following open-source projects:

- [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer/)
- [pdf.js](https://github.com/mozilla/pdf.js)

> Note: The flipbook-viewer has been forked in this project to support navigating directly to specific pages and searching within the PDF.

## Development

To set up a local development environment:

## How to Contribute

We welcome contributions! To get started:

- Fork the repository and create your branch from `main`.
- Run `yarn install` and `yarn dev` to set up your environment.
- Please follow the code style and add comments where helpful.
- Open a pull request with a clear description of your changes.

## License

This project is licensed under the [MIT License](LICENSE).

### Open to a Specific Page

You can open the viewer to a specific page by adding `#page=N` to the URL (e.g. `#page=5`).
This will override the `defaultPage` option if both are present.

### Set a Default Page in Embed Options

Set `defaultPage` in `PDFaGoGoOptions` to specify which page to open by default (1-based). If the URL contains `#page=N`, that will take precedence.
=======
## Viewer options

You can control which UI features are enabled in the PDF-A-go-go viewer by passing options. Set the global `window.PDFaGoGoOptions` before the viewer loads, for example:

```js
window.PDFaGoGoOptions = {
  showPrevNext: true,      // Show previous/next page buttons (default: true)
  showPageSelector: true,  // Show page selector input (default: true)
  showCurrentPage: true,   // Show current page indicator (default: true)
  showSearch: true,        // Show search controls (default: true)
  showDownload: true,      // Show a Download PDF button
  spreadMode: true,        // or false, or omit for autodetect
  pdfUrl: "https://example.com/your.pdf" // PDF URL to load (default: sample PDF)
};
```

All options default to `true` (except `pdfUrl`, which defaults to a sample PDF). Set any to `false` to hide that feature from the UI, or set `pdfUrl` to your own PDF file.

Example: To load a custom PDF and hide search and page selector:

```js
window.PDFaGoGoOptions = {
  pdfUrl: "https://example.com/your.pdf",
  showSearch: false,
  showPageSelector: false
};
```

## Page spread (Two-page/single-spread) support

PDF-A-go-go supports both traditional single-page and two-page spread ("spread mode") PDFs, including those where each PDF page is already a two-page spread image.

### Features
- **Autodetection:**
  - The viewer will automatically detect if a PDF is in spread mode by checking the aspect ratio of the first (or second) page. If the page is much wider than it is tall, spread mode is enabled.
- **Manual Override:**
  - You can force spread mode on or off by passing the `spreadMode` option:
    ```js
    PDFaGoGoOptions = { spreadMode: true };
    ```
- **UI Toggle:**
  - A "Spread Mode" checkbox is available in the viewer controls, allowing users to switch between normal and spread mode at any time. The viewer will attempt to keep you on the same logical page when toggling.
- **First/Last Page Handling:**
  - In spread mode, if the first or last page is a single (not double) spread, it will be centered and shown at its natural aspect ratio, not stretched.
