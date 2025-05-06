# PDF-A-go-go

PDF-A-go-go is a super simple, embeddable PDF viewer project. It is designed to be lightweight and easy to integrate into your own applications.

This project is heavily based on the following open-source projects:

- [flipbook-viewer](https://github.com/theproductiveprogrammer/flipbook-viewer/)
- [pdf.js](https://github.com/mozilla/pdf.js)

> Note: The flipbook-viewer has been forked in this project to support navigating directly to specific pages and searching within the PDF.

## Development

To set up a local development environment:

1. Install dependencies:
   ```sh
   yarn install
   ```
2. Start the local server:
   ```sh
   yarn dev
   ```
3. Open your browser and navigate to the address shown in the terminal (usually http://localhost:5000) to view `dist/index.html`.

## Viewer options

You can control which UI features are enabled in the PDF-A-go-go viewer by passing options. Set the global `window.PDFaGoGoOptions` before the viewer loads, for example:

```js
window.PDFaGoGoOptions = {
  showPrevNext: true,      // Show previous/next page buttons (default: true)
  showPageSelector: true,  // Show page selector input (default: true)
  showCurrentPage: true,   // Show current page indicator (default: true)
  showSearch: true         // Show search controls (default: true)
};
```

All options default to `true`. Set any to `false` to hide that feature from the UI.

Example: To hide search and page selector:

```js
window.PDFaGoGoOptions = {
  showSearch: false,
  showPageSelector: false
};
```
