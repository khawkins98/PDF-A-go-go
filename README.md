# PDF-A-go-go

[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/khawkins98/PDF-A-go-go/actions)
[![Open issues](https://img.shields.io/github/issues/khawkins98/PDF-A-go-go.svg)](https://github.com/khawkins98/PDF-A-go-go/issues)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

PDF-A-go-go is a simple, embeddable PDF viewer project. It is designed to be lightweight and easy to integrate into your own applications.

## Future plans

This project is very fresh (rolled on 6 May 2025). I may yet publish to npm or change it completely.

## Demo

- [Basic demo](https://khawkins98.github.io/PDF-A-go-go/)
- [Double spread demo](https://khawkins98.github.io/PDF-A-go-go/double-spread.html#page=4)

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


## Usage and features

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

### Features

- **Open to a specific page**
  - You can open the viewer to a specific page by adding `#page=N` to the URL (e.g. `#page=5`).
  - This will override the `defaultPage` option if both are present.
- **Page spread (Two-page/single-spread) support**
  - PDF-A-go-go supports both traditional single-page and two-page spread ("spread mode") PDFs, including those where each PDF page is already a two-page spread image.
- **First/Last page handling:**
  - In spread mode, if the first or last page is a single (not double) spread, it will be centered and shown at its natural aspect ratio, not stretched.

## Credits

This project is heavily based on the following open-source projects:

- [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer/)
- [pdf.js](https://github.com/mozilla/pdf.js)

> Note: The flipbook-viewer has been forked in this project to support navigating directly to specific pages and searching within the PDF.

## Development

To set up a local development environment:

- Fork the repository and create your branch from `main`.
- Run `yarn install` and `yarn dev` to set up your environment.
- Compiled JS is available in the local `/dist` folder.
- Please follow the code style and add comments where helpful.
- Open a pull request with a clear description of your changes.

## License

This project is licensed under the [MIT License](LICENSE).
