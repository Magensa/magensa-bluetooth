const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/deviceEntry.js',
  mode: "production",
  output: {
    filename: 'magensa-bluetooth.js',
    path: path.resolve(__dirname, 'dist'),
    library: "magensa-bluetooth",
    libraryTarget: "umd",
    sourceMapFilename: 'magensa-bluetooth.map'
  },
  devtool: 'nosources-source-map',
  plugins: [
    new CopyPlugin([
      { from: 'README.md', to: path.resolve(__dirname, 'dist') },
      { from: 'package.json', to: path.resolve(__dirname, 'dist') },
      { from: 'LICENSE', to: path.resolve(__dirname, 'dist') }
    ])
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
        }
      },

    ]
  }
};