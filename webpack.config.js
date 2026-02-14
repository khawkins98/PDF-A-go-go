'use strict'
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const fs = require('fs')

// Partials paths for dependency tracking
const partialsDir = path.resolve(__dirname, 'src/partials');
const navPartial = path.join(partialsDir, 'nav.html');
const headPartial = path.join(partialsDir, 'head.html');

// Helper function to inject partials into HTML
function injectPartials(content, baseUrl = '.') {
  const header = fs.readFileSync(navPartial, 'utf8').replace(/\{\{BASE\}\}/g, baseUrl);
  const head = fs.readFileSync(headPartial, 'utf8').replace(/\{\{BASE\}\}/g, baseUrl);
  return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
}

// Custom plugin to add partials as webpack dependencies (triggers rebuild on change)
class WatchPartialsPlugin {
  apply(compiler) {
    compiler.hooks.afterCompile.tap('WatchPartialsPlugin', (compilation) => {
      // Add partials directory to webpack's watched paths
      compilation.contextDependencies.add(partialsDir);
      // Add individual partial files as file dependencies
      compilation.fileDependencies.add(navPartial);
      compilation.fileDependencies.add(headPartial);
    });

    // Force the dev server to do a full reload after each compilation
    compiler.hooks.afterEmit.tap('WatchPartialsPlugin', () => {
      if (compiler.options.mode === 'development' && compiler.watching) {
        // Touch a file that webpack definitely watches to trigger reload
        // The dev server will see the new compilation and reload
      }
    });
  }
}

const base = {
  entry: {
    'pdf-a-go-go': {
      import: './src/assets/js/pdfagogo.js',
      library: {
        name: 'flipbook',
        type: 'umd',
        umdNamedDefine: true,
      },
    },
    // 'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /legacy\/build\/pdf\.worker(\.min)?\.mjs$/,
        type: 'asset/resource',
        generator: {
          filename: 'pdf-a-go-go.dependencies.js'
        }
      },
    ],
  },
  plugins: [
    new WatchPartialsPlugin(),
    new CopyPlugin({
      patterns: [
        { from: 'src/assets/css/pdf-a-go-go.css', to: 'pdf-a-go-go.css' },
        // HTML with header injection
        { from: 'src/index.html', to: 'index.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/double-spread.html', to: 'double-spread.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/html-download-example.html', to: 'html-download-example.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/html-download-example-iframe.html', to: 'html-download-example-iframe.html' },
        { from: 'src/examples/stress-test-large-pdf.html', to: 'stress-test-large-pdf.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/remote-pdf-allowed.html', to: 'remote-pdf-allowed.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/remote-pdf-cors-fail.html', to: 'remote-pdf-cors-fail.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/kitchen-sink.html', to: 'kitchen-sink.html', transform: (content) => injectPartials(content, '.') },
        { from: 'src/examples/pdf-a-go-go-showcase.pdf', to: 'pdf-a-go-go-showcase.pdf' },
        { from: 'src/examples/example.pdf', to: 'example.pdf' },
        { from: 'src/examples/example_large.pdf', to: 'example_large.pdf' },
        { from: 'src/examples/example_spread.pdf', to: 'example_spread.pdf' },
        { from: 'src/tests/test-small.html', to: 'tests/test-small.html', transform: (content) => injectPartials(content, '..') },
        { from: 'src/tests/multi-instance.html', to: 'tests/multi-instance.html', transform: (content) => injectPartials(content, '..') },
        { from: 'src/tests/error-404.html', to: 'tests/error-404.html', transform: (content) => injectPartials(content, '..') },
        { from: 'src/tests/accessibility-test.html', to: 'tests/accessibility-test.html', transform: (content) => injectPartials(content, '..') },
        { from: 'src/tests', to: 'tests', globOptions: { ignore: ['**/test-small.html', '**/multi-instance.html', '**/error-404.html', '**/accessibility-test.html'] } },
      ]
    })
  ]
}

const prod = Object.assign({}, base, {
  mode: "production",
})

const dev = Object.assign({}, base, {
  mode: "development",
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
      watch: true,
    },
    // Write files to disk so static file watcher can detect changes
    devMiddleware: {
      writeToDisk: true,
    },
    compress: true,
    port: 9000,
    open: true,
    // Disable HMR - use full page reload instead (better for HTML/CSS changes)
    hot: false,
    // Allow connections from any host (needed for external tools/testing)
    allowedHosts: 'all',
    // Full page reload when files change
    liveReload: true,
  },
  // Disable caching to ensure partials are re-read on each build
  cache: false,
  // Watch options at webpack level to ensure rebuilds on partial changes
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 500,
  },
})

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    return dev;
  }
  return prod;
};