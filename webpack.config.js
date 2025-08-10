'use strict'
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const fs = require('fs')

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
        test: /pdf\.worker(\.min)?\.mjs$/,
        type: 'asset/resource',
        generator: {
          filename: 'pdf-a-go-go.dependencies.js'
        }
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/assets/css/pdf-a-go-go.css', to: 'pdf-a-go-go.css' },
        // HTML with header injection
        { from: 'src/index.html', to: 'index.html', transform(content) {
            const base = '.';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/examples/double-spread.html', to: 'double-spread.html', transform(content) {
            const base = '.';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/examples/html-download-example.html', to: 'html-download-example.html', transform(content) {
            const base = '.';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/examples/html-download-example-iframe.html', to: 'html-download-example-iframe.html' },
        { from: 'src/examples/stress-test-large-pdf.html', to: 'stress-test-large-pdf.html', transform(content) {
            const base = '.';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/examples/remote-pdf-allowed.html', to: 'remote-pdf-allowed.html', transform(content) {
            const base = '.';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/examples/remote-pdf-cors-fail.html', to: 'remote-pdf-cors-fail.html', transform(content) {
            const base = '.';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/examples/example.pdf', to: 'example.pdf' },
        { from: 'src/examples/example_large.pdf', to: 'example_large.pdf' },
        { from: 'src/examples/example_spread.pdf', to: 'example_spread.pdf' },
        { from: 'src/tests/test-small.html', to: 'tests/test-small.html', transform(content) {
            const base = '..';
            const header = fs.readFileSync(path.resolve(__dirname, 'src/partials/nav.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            const head = fs.readFileSync(path.resolve(__dirname, 'src/partials/head.html'), 'utf8').replace(/\{\{BASE\}\}/g, base);
            return content.toString().replace('<!-- @@NAV@@ -->', header).replace('<!-- @@HEAD@@ -->', head);
          }
        },
        { from: 'src/tests', to: 'tests', globOptions: { ignore: ['**/test-small.html'] } },
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
    },
    compress: true,
    port: 9000,
    open: true,
    hot: true,
    watchFiles: ['src/**/*'],
  },
})

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    return dev;
  }
  return prod;
};