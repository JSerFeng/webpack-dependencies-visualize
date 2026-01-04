const webpack = require("webpack");
const config = require("./webpack.config");

// Parse arguments
const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex !== -1 ? args[modeIndex + 1] : 'development';

config.mode = mode;

// Create compiler
const compiler = webpack(config);

compiler.hooks.shouldEmit.tap("debug plugin", () => {
  return false;
});

// Safe stringify function to handle circular references and omit null/undefined
function safeStringify(obj) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        // Circular reference found
        return;
      }
      // Store value in our collection
      cache.add(value);
    }
    // Remove underscores and internal webpack properties if needed, 
    // but for "raw data" we might want to keep most things.
    // However, some webpack internal objects are huge.
    // Let's at least filter out commonly problematic or huge internal fields if needed.
    // For now, simple circular ref protection.
    return value;
  });
}

// Improved serialization for raw data
function getRawData(dep) {
  const seen = new WeakSet();
  
  const serialize = (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (seen.has(obj)) {
      return '[Circular]';
    }
    
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(serialize);
    }

    if (obj instanceof Set) {
      return Array.from(obj).map(serialize);
    }

    if (obj instanceof Map) {
      const mapObj = {};
      for (const [k, v] of obj) {
        mapObj[String(k)] = serialize(v);
      }
      return mapObj;
    }

    // Capture all keys including accessors from prototype chain
    const allKeys = new Set();
    let current = obj;
    while (current && current !== Object.prototype) {
      Object.getOwnPropertyNames(current).forEach(key => allKeys.add(key));
      current = Object.getPrototypeOf(current);
    }

    const newObj = {};
    for (const key of allKeys) {
      // Skip internal properties that are not useful or problematic
      if (key === 'constructor' || key.startsWith('_')) {
        continue;
      }
      
      // Still avoid 'compilation' as it is the root context and endless
      if (key === 'compilation') {
        continue;
      }

      try {
        const value = obj[key];
        // Filter out functions
        if (typeof value === 'function') {
           continue;
        }
        newObj[key] = serialize(value);
      } catch (err) {
        // Ignore properties that throw on access (e.g. deprecated getters)
      }
    }
    return newObj;
  };

  return serialize(dep);
}


let allModules = [];

compiler.hooks.compilation.tap("debug plugin", (compilation) => {
  compilation.hooks.optimizeChunkModules.tap("debug plugin", () => {
    const modules = compilation.modules;
    const moduleGraph = compilation.moduleGraph;
    
    allModules = [...modules].map((module) => {
      const modulePath = module.resource || module.identifier();
      
      // Get dependencies with target module info
      const deps = (module.dependencies || []).map((dep) => {
        const rawData = getRawData(dep);
        
        // Use moduleGraph.getModule to get the target module
        const targetModule = moduleGraph.getModule(dep);
        if (targetModule) {
          rawData.targetModule = targetModule.resource || targetModule.identifier();
        }
        
        return rawData;
      });

      const presentationalDeps = (module.presentationalDependencies || []).map((dep) => {
        return getRawData(dep);
      });

      const blocks = (module.blocks || []).map((block) => {
        const serializedBlock = getRawData(block);
        serializedBlock.dependencies = block.dependencies.map((dep) => {
          const rawData = getRawData(dep);
          const targetModule = moduleGraph.getModule(dep);
          if (targetModule) {
            rawData.targetModule = targetModule.resource || targetModule.identifier();
          }
          return rawData;
        });
        return serializedBlock;
      });

      return {
        path: modulePath,
        deps,
        presentationalDeps,
        blocks,
      };
    });
  });
});

compiler.compile((err, stats) => {
  if (err) {
    throw err;
  }

  if (stats.errors.length > 0) {
    throw stats.errors;
  }

  console.log(JSON.stringify({ modules: allModules }));
});
