const webpack = require("webpack");
const config = require("./webpack.config");
const compiler = webpack(config);

compiler.hooks.shouldEmit.tap("debug plugin", () => {
  return false;
});

let deps = [];
let blocks = [];
let presentationalDeps = [];

compiler.hooks.compilation.tap("debug plugin", (compilation) => {
  compilation.hooks.finishModules.tap("debug plugin", (modules) => {
    const target = [...modules].find((module) => {
      return module.identifier().includes("index.js");
    });

    deps = target.dependencies?.map((dep) => {
      const depType = dep.type;
      const loc = dep.loc;

      return {
        type: depType,
        ids: dep.ids,
        category: dep.category,
        loc: loc,
      };
    }) || [];

    presentationalDeps = target.presentationalDependencies?.map((dep) => {
      const depType = dep.type;
      const loc = dep.loc;
      return {
        type: depType,
        ids: dep.ids,
        loc: loc,
      };
    }) || [];

    blocks = target.blocks?.map((block) => {
      return {
        id: block.id,
        type: block.type,
        loc: block.loc,
        dependencies: block.dependencies.map((dep) => {
          return {
            type: dep.type,
            ids: dep.ids,
            category: dep.category,
            loc: dep.loc,
          };
        }),
      };
    }) || [];
  });
});

compiler.compile((err, stats) => {
  if (err) {
    throw err;
  }

  if (stats.errors.length > 0) {
    throw stats.errors;
  }

  console.log(JSON.stringify({ deps, presentationalDeps, blocks }));
});
