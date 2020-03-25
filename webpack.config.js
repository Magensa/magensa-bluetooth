const path = require('path');

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
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
        }
      }
    ]
  }
};