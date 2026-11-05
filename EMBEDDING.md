# Embed and configure a PDF

Start with the [complete embed snippet](README.md#embed-a-pdf). Add the following
attributes to that container; load the CSS and script once per page. The
[configuration reference](DOCUMENTATION.md#configuration-options) owns the full
option/default list, and [API reference](DOCUMENTATION.md#api-reference) covers
JavaScript methods.

## Open to a specific page with a toolbar

```html
<div class="pdfagogo-container"
  data-pdf-url="./handbook.pdf"
  data-default-page="5"
  data-show-search="true"
  data-show-page-selector="true"
  data-show-download="true"
  data-show-fullscreen="true"
  data-show-share="true"></div>
```

## Dark theme for a dashboard

```html
<div class="pdfagogo-container"
  data-pdf-url="./analytics.pdf"
  data-theme="dark"
  data-show-toolbar="true"></div>
```

## Translating the interface

German is bundled. Set `data-locale="de"`:

```html
<div class="pdfagogo-container" data-pdf-url="./document.pdf" data-locale="de"></div>
```

To supply another language or override individual labels, pass JSON in
`data-strings`; omitted keys retain the locale pack or English defaults:

```html
<div class="pdfagogo-container" data-pdf-url="./document.pdf"
  data-strings='{"nextPage":"Page suivante","pageAnnouncement":"Page {current} sur {total}"}'></div>
```

Keep `{token}` placeholders in translations. In a single-quoted HTML attribute,
escape apostrophes as `&#39;`; otherwise the browser closes the attribute early.
For JavaScript overrides, precedence and the full string list, see
[the internationalization reference](DOCUMENTATION.md#internationalization-i18n).
The [multilingual demo](https://www.allaboutken.com/PDF-A-go-go/multilingual.html)
shows language switching.

## Multiple PDFs on the same page

Each viewer gets its own state, so zoom and search in one don't affect the other:

```html
<div class="pdfagogo-container" data-pdf-url="./chapter-1.pdf"></div>
<div class="pdfagogo-container" data-pdf-url="./chapter-2.pdf"></div>
```

## Link directly to a page

Append `#pdf-page-N` to any URL hosting the viewer and it'll open to that page:

```
https://yoursite.com/docs.html#pdf-page-42
```

## Hosting and content security policy

For self-hosting, run `yarn build` and deploy `dist/pdf-a-go-go.js`,
`dist/pdf-a-go-go.css` and `dist/pdf-a-go-go.worker.js` together. Keep the worker
available beside the bundle, or configure `data-worker-url` explicitly. Serve
from HTTP(S); opening the HTML with `file://` is not a deployment test. PDFs on
another origin need CORS permission from that host.

For a same-origin bundle, worker and PDF, start with the directives below and
merge them with your site's policy:

```text
script-src 'self' blob:;
worker-src 'self' blob:;
connect-src 'self';
img-src 'self' blob: data:;
style-src 'self' 'unsafe-inline';
```

Allow the specific external origins you use: the bundle host in `script-src` and
`connect-src` when its worker is fetched there, the stylesheet host in `style-src`,
and PDF hosts in `connect-src`. These directives are a recipe, not a policy that
has been tested for every host or embedding environment.

PDF.js uses a Blob worker for a cross-origin worker script, so `worker-src` and
`script-src` permit `blob:`. Rendered tiles and icon inlining need `blob:`/`data:`
images. Toolbar layout currently needs inline styles; if your site cannot allow
`'unsafe-inline'`, use a separately hosted iframe with a policy that allows the
viewer. See [the worker/download reference](DOCUMENTATION.md#worker--downloads)
for configuration.

## Keyboard and browser checks

Focus the viewer before using `Ctrl/Cmd` plus `+`, `-` or `0` to zoom/reset.
Arrow keys change pages. See [accessibility](DOCUMENTATION.md#accessibility) for
focus and screen-reader behavior. Touch devices also support pinch zoom.

The automated suite uses Chromium. Test your intended Firefox/Safari versions,
mobile devices, CSP and cross-origin PDF host before shipping an integration;
this guide does not establish exact minimum browser versions.
