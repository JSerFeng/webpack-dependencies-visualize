/** @type {import('webpack').Configuration} */
module.exports = {
  mode: "development",
  entry: "/src/index.js",
  output: {
    path: "/dist",
    filename: "[name].js",
  },
  externals: ({ request }, callback) => {
    if (request.includes("index.js")) {
      return callback();
    }
    callback(null, request);
  },
  optimization: {
    minimize: false,
    concatenateModules: false,
    usedExports: false,
  },
};
