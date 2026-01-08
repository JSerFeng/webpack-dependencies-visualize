/** @type {import('webpack').Configuration} */
module.exports = {
  mode: "development",
  entry: "/src/index.js",
  output: {
    path: "/dist",
    filename: "[name].js",
  },
  experiments: {
    css: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        type: "css/auto",
      },
    ],
  },
  resolve: {
    // Support relative path resolution within /src
    modules: ["/src", "node_modules"],
  },
  externals: ({ request }, callback) => {
    // CSS files should be resolved normally (not external)
    if (request.endsWith(".css")) {
      return callback();
    }
    // Imports starting with "external" are treated as external modules
    if (request.startsWith("external")) {
      return callback(null, request);
    }
    // Relative paths and entry file are resolved normally
    if (
      request.startsWith(".") ||
      request.startsWith("/") ||
      request.includes("index.js")
    ) {
      return callback();
    }
    // Other bare imports are external
    callback(null, request);
  },
  optimization: {
    minimize: false,
    concatenateModules: false,
  },
};
