'use strict'
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

const base = {
  entry: {
    'pdf-a-go-go': {
      import: './src/pdfagogo.js',
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
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/pdf-a-go-go.css', to: 'pdf-a-go-go.css' },
        { from: 'src/index.html', to: 'index.html' }
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