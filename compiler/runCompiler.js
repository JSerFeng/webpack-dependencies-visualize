const webpack = require('webpack');
const path = require('node:path');
const config = require('./webpack.config');
const { UsageState } = require('webpack/lib/ExportsInfo');
const {
  CIRCULAR_CONNECTION,
  TRANSITIVE_ONLY,
} = require('webpack/lib/ModuleGraphConnection');

// Parse arguments
const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex !== -1 ? args[modeIndex + 1] : 'production';

config.mode = mode;

// Create compiler
const compiler = webpack(config);

compiler.hooks.shouldEmit.tap('debug plugin', () => {
  return false;
});

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
      for (const key of Object.getOwnPropertyNames(current)) {
        allKeys.add(key);
      }
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

function getModulePath(module) {
  return module.resource || module.identifier();
}

function getModuleLabel(modulePath) {
  const normalized = modulePath.replace(/\\/g, '/');
  const label = path.posix.basename(normalized);
  return label || normalized;
}

function serializeConnectionEndpoint(module) {
  if (!module) {
    return null;
  }

  const modulePath = getModulePath(module);
  return {
    modulePath,
    moduleLabel: getModuleLabel(modulePath),
  };
}

function serializeConnectionSide(currentModule, resolvedModule) {
  const current = serializeConnectionEndpoint(currentModule);
  const resolved = serializeConnectionEndpoint(resolvedModule);

  return {
    current,
    resolved,
    changedByResolution: current?.modulePath !== resolved?.modulePath,
  };
}

function serializeConnectionState(connection) {
  const activeState = connection.getActiveState(undefined);

  if (activeState === true) {
    return 'active';
  }

  if (activeState === false) {
    return 'inactive';
  }

  if (activeState === TRANSITIVE_ONLY) {
    return 'transitive-only';
  }

  if (activeState === CIRCULAR_CONNECTION) {
    return 'circular-connection';
  }

  return 'inactive';
}

function serializeConnectionLoc(loc) {
  if (
    !loc ||
    typeof loc !== 'object' ||
    !('start' in loc) ||
    !('end' in loc) ||
    !loc.start ||
    !loc.end
  ) {
    return null;
  }

  return {
    start: {
      line: loc.start.line,
      column: loc.start.column,
    },
    end: {
      line: loc.end.line,
      column: loc.end.column,
    },
  };
}

function serializeModuleGraphConnection(connection) {
  const dependency = connection.dependency;

  return {
    dependencyType:
      dependency && typeof dependency.type === 'string'
        ? dependency.type
        : null,
    dependencyCategory:
      dependency && typeof dependency.category === 'string'
        ? dependency.category
        : null,
    request:
      dependency && typeof dependency.request === 'string'
        ? dependency.request
        : dependency && typeof dependency.userRequest === 'string'
          ? dependency.userRequest
          : null,
    loc: serializeConnectionLoc(dependency?.loc),
    weak: Boolean(connection.weak),
    conditional: connection.conditional,
    activeState: serializeConnectionState(connection),
    isActive: connection.isActive(undefined),
    isTargetActive: connection.isTargetActive(undefined),
    origin: serializeConnectionSide(
      connection.originModule,
      connection.resolvedOriginModule,
    ),
    target: serializeConnectionSide(
      connection.module,
      connection.resolvedModule,
    ),
    explanation: connection.explanation,
    explanations: connection.explanations ? [...connection.explanations] : [],
  };
}

function serializeModuleGraphConnections(module, moduleGraph) {
  return {
    incoming: Array.from(
      moduleGraph.getIncomingConnections(module),
      serializeModuleGraphConnection,
    ),
    outgoing: Array.from(
      moduleGraph.getOutgoingConnections(module),
      serializeModuleGraphConnection,
    ),
  };
}

function serializeUsedState(exportInfo) {
  switch (exportInfo.getUsed(undefined)) {
    case UsageState.Unused:
      return 'unused';
    case UsageState.OnlyPropertiesUsed:
      return 'only-properties-used';
    case UsageState.Unknown:
      return 'unknown';
    case UsageState.Used:
      return 'used';
    default:
      return 'no-info';
  }
}

function serializeProvidedState(exportInfo) {
  switch (exportInfo.provided) {
    case null:
      return 'maybe-provided';
    case true:
      return 'provided';
    case false:
      return 'not-provided';
    default:
      return 'no-info';
  }
}

function serializeTarget(target) {
  if (!target) return null;

  const modulePath = getModulePath(target.module);
  return {
    modulePath,
    moduleLabel: getModuleLabel(modulePath),
    exportPath: target.export || null,
  };
}

function serializeProvidedExports(exportsInfo) {
  const providedExports = exportsInfo.getProvidedExports();
  if (providedExports === null) {
    return { kind: 'unknown' };
  }
  if (providedExports === true) {
    return { kind: 'dynamic' };
  }
  return { kind: 'list', exports: providedExports };
}

function serializeUsedExports(exportsInfo) {
  const usedExports = exportsInfo.getUsedExports(undefined);
  if (usedExports === null) {
    return { kind: 'unknown' };
  }
  if (usedExports === true) {
    return { kind: 'namespace' };
  }
  if (usedExports === false) {
    return { kind: 'unused' };
  }
  return { kind: 'list', exports: [...usedExports] };
}

function serializeSpecialExportInfo(name, exportInfo, moduleGraph) {
  return {
    name,
    usedState: serializeUsedState(exportInfo),
    usedLabel: exportInfo.getUsedInfo(),
    providedState: serializeProvidedState(exportInfo),
    providedLabel: exportInfo.getProvidedInfo(),
    renameLabel: exportInfo.getRenameInfo(),
    terminalBinding: Boolean(exportInfo.terminalBinding),
    isReexport: exportInfo.isReexport(),
    target: serializeTarget(exportInfo.getTarget(moduleGraph)),
  };
}

function serializeExportsInfo(exportsInfo, moduleGraph, seen = new WeakSet()) {
  if (seen.has(exportsInfo)) {
    return null;
  }
  seen.add(exportsInfo);

  const ownedExportNames = new Set(
    Array.from(exportsInfo.ownedExports, (exportInfo) => exportInfo.name),
  );
  const redirectedExportNames =
    exportsInfo._redirectTo !== undefined
      ? Array.from(
          exportsInfo._redirectTo.orderedExports,
          (exportInfo) => exportInfo.name,
        ).filter((name) => !ownedExportNames.has(name))
      : [];

  return {
    providedExports: serializeProvidedExports(exportsInfo),
    usedExports: serializeUsedExports(exportsInfo),
    exports: Array.from(exportsInfo.orderedExports, (exportInfo) => ({
      name: exportInfo.name,
      ownership: ownedExportNames.has(exportInfo.name) ? 'owned' : 'redirected',
      usedState: serializeUsedState(exportInfo),
      usedLabel: exportInfo.getUsedInfo(),
      providedState: serializeProvidedState(exportInfo),
      providedLabel: exportInfo.getProvidedInfo(),
      renameLabel: exportInfo.getRenameInfo(),
      usedName:
        typeof exportInfo._usedName === 'string' ? exportInfo._usedName : null,
      terminalBinding: Boolean(exportInfo.terminalBinding),
      isReexport: exportInfo.isReexport(),
      target: serializeTarget(exportInfo.getTarget(moduleGraph)),
      nested: exportInfo.exportsInfo
        ? serializeExportsInfo(exportInfo.exportsInfo, moduleGraph, seen)
        : null,
    })),
    otherExportsInfo: serializeSpecialExportInfo(
      'other exports',
      exportsInfo.otherExportsInfo,
      moduleGraph,
    ),
    sideEffectsOnlyInfo: serializeSpecialExportInfo(
      'side effects only',
      exportsInfo._sideEffectsOnlyInfo,
      moduleGraph,
    ),
    isUsed: exportsInfo.isUsed(undefined),
    isModuleUsed: exportsInfo.isModuleUsed(undefined),
    hasRedirect: exportsInfo._redirectTo !== undefined,
    redirectedExportNames,
  };
}

let allModules = [];

compiler.hooks.compilation.tap('debug plugin', (compilation) => {
  compilation.hooks.optimizeChunkModules.tap('debug plugin', () => {
    const modules = compilation.modules;
    const moduleGraph = compilation.moduleGraph;

    allModules = [...modules].map((module) => {
      const modulePath = getModulePath(module);

      // Get dependencies with target module info
      const deps = (module.dependencies || []).map((dep) => {
        const rawData = getRawData(dep);

        // Use moduleGraph.getModule to get the target module
        const targetModule = moduleGraph.getModule(dep);
        if (targetModule) {
          rawData.targetModule =
            targetModule.resource || targetModule.identifier();
        }

        return rawData;
      });

      const presentationalDeps = (module.presentationalDependencies || []).map(
        (dep) => {
          return getRawData(dep);
        },
      );

      const blocks = (module.blocks || []).map((block) => {
        const serializedBlock = getRawData(block);
        serializedBlock.dependencies = block.dependencies.map((dep) => {
          const rawData = getRawData(dep);
          const targetModule = moduleGraph.getModule(dep);
          if (targetModule) {
            rawData.targetModule =
              targetModule.resource || targetModule.identifier();
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
        exportsInfo: serializeExportsInfo(
          moduleGraph.getExportsInfo(module),
          moduleGraph,
        ),
        moduleGraphConnections: serializeModuleGraphConnections(
          module,
          moduleGraph,
        ),
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
