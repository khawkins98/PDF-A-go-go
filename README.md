# PDF-A-go-go

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/khawkins98/PDF-A-go-go/actions)
[![npm version](https://img.shields.io/npm/v/pdf-a-go-go.svg?style=flat)](https://www.npmjs.com/package/pdf-a-go-go)
[![Open Issues](https://img.shields.io/github/issues/khawkins98/PDF-A-go-go.svg)](https://github.com/khawkins98/PDF-A-go-go/issues)

PDF-A-go-go is a super simple, embeddable PDF viewer project. It is designed to be lightweight and easy to integrate into your own applications.

## Features

- 📖 Flipbook-style PDF viewing
- 🔍 Text search within PDFs
- 🦾 Accessible (keyboard navigation, ARIA labels, screen reader support)
- ⚡ Fast, lightweight, and dependency-minimal
- 🎨 Customizable UI (show/hide controls)
- 📱 Responsive and embeddable
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
  pdfUrl: "https://example.com/your.pdf" // PDF URL to load (default: sample PDF)
};
```
## Development

1. Install dependencies:
   ```sh
   yarn install
   ```
2. Start the local server:
   ```sh
   yarn dev
   ```
3. Open your browser and navigate to the address shown in the terminal (usually http://localhost:5000) to view `dist/index.html`.

## How to Contribute

We welcome contributions! To get started:

- Fork the repository and create your branch from `main`.
- Run `yarn install` and `yarn dev` to set up your environment.
- Please follow the code style and add comments where helpful.
- Open a pull request with a clear description of your changes.

## License

This project is licensed under the [MIT License](LICENSE).
