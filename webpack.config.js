'use strict'
const path = require('path')

const base = {
  entry: {
    'pdf-a-go-go': {
      import: './src/flipbook.js',
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
    clean: {
      keep: ['index.html', 'pdf-a-go-go.css'],
    },
  },
  module: {
    rules: [
      {
        test: /pdf\.worker(\.min)?\.mjs$/,
        type: 'asset/resource',
      },
    ],
  },
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
    watchFiles: ['dist/index.html', 'src/**/*'],
    open: true,
    hot: true,
  },
});

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    return dev;
  }
  return prod;
};