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

- 📖 Side-scroll-style PDF viewing
- 🦾 Accessible (keyboard navigation, ARIA labels, screen reader support)
- ⚡ Fast, lightweight, and dependency-minimal
- 🎨 Customizable UI (show/hide controls)
- 📱 Mobile friendly
- 🎯 Set a default page to open via embed options
- 🔗 Shareable page links
- 🪶 Lightweight, embeddable PDF viewer
- ⌨️ Keyboard and accessible navigation
- 🔍 Search with next/prev match
- 🔝 Resizable viewer
- 📑 Page selector and navigation controls
- 🔍 Basic search within PDFs
- ⬇️ Download PDF button
- 🛠️ Based on [pdf.js](https://github.com/mozilla/pdf.js)

## Usage and features

Include the JS and CSS in your HTML, and add a container:

```html
<link rel="stylesheet" href="pdf-a-go-go.css">
<script src="pdf-a-go-go.js"></script>
<div class="pdfagogo-container" id="pdfagogo-container"
     data-pdf-url="./example.pdf"
     data-show-search="true"
     data-show-prev-next="true"
     data-show-page-selector="true"
     data-show-current-page="true"
     data-show-download="true"
     data-show-resize-grip="true"
     style="width:100vw;max-width:100%;box-sizing:border-box;overflow-x:hidden;"></div>
```

Set options via data attributes on the container:

- `data-pdf-url` (string): PDF URL to load (default: sample PDF)
- `data-show-prev-next` (true/false): Show previous/next page buttons (default: true)
- `data-show-page-selector` (true/false): Show page selector input (default: true)
- `data-show-current-page` (true/false): Show current page indicator (default: true)
- `data-show-search` (true/false): Show search controls (default: true)
- `data-show-download` (true/false): Show a Download PDF button (default: true)
- `data-show-resize-grip` (true/false): Show a bar to allow the user to resize the height (default: true)
- `data-default-page` (number): Default page to open if no #page=N in URL (1-based)
- `data-background-color` (string): Background color (optional)
- `data-box-border` (number): Box border size (optional)
- `data-margin`, `data-margin-top`, `data-margin-left` (number): Margins (optional)
- `data-disable-webgl` (true/false): Disable WebGL rendering in PDF.js (default: true / WebGL off).
  - **Note:** Disabling WebGL (the default) seems to be more performant in most browsers.

## Development

To set up a local development environment:

- Fork the repository and create your branch from `main`.
- Run `yarn install` and `yarn dev` to set up your environment.
- Compiled JS is available in the local `/dist` folder.
- Please follow the code style and add comments where helpful.
- Open a pull request with a clear description of your changes.

## License

This project is licensed under the [MIT License](LICENSE).
