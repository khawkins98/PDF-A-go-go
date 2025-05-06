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
    clean: {
      keep: (asset) => asset === 'index.html' || asset === 'pdf-a-go-go.css',
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
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/pdf-a-go-go.css', to: 'pdf-a-go-go.css' }
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
      directory: path.join(__dirname, '/'),
    },
    watchFiles: ['index.html', 'src/**/*'],
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