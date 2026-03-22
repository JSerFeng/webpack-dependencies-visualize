import { initWebContainer, writeFile, mkdir } from "./webContainer";

export type WebpackDependency = {
  targetModule?: string;
  [key: string]: any;
};

export type WebpackBlock = {
  dependencies?: WebpackDependency[];
  [key: string]: any;
};

export type SerializedProvidedExports =
  | { kind: "unknown" }
  | { kind: "dynamic" }
  | { kind: "list"; exports: string[] };

export type SerializedUsedExports =
  | { kind: "unknown" }
  | { kind: "namespace" }
  | { kind: "unused" }
  | { kind: "list"; exports: string[] };

export type SerializedUsageState =
  | "unused"
  | "only-properties-used"
  | "no-info"
  | "unknown"
  | "used";

export type SerializedProvidedState =
  | "no-info"
  | "maybe-provided"
  | "provided"
  | "not-provided";

export type ExportOwnership = "owned" | "redirected";

export type SerializedExportTarget = {
  modulePath: string;
  moduleLabel: string;
  exportPath: string[] | null;
};

export type SerializedExportState = {
  name: string;
  usedState: SerializedUsageState;
  usedLabel: string;
  providedState: SerializedProvidedState;
  providedLabel: string;
  renameLabel: string;
  terminalBinding: boolean;
  isReexport: boolean;
  target: SerializedExportTarget | null;
};

export type SerializedExportInfo = SerializedExportState & {
  ownership: ExportOwnership;
  usedName: string | null;
  nested: SerializedExportsInfo | null;
};

export type SerializedSpecialExportInfo = SerializedExportState;

export type SerializedExportsInfo = {
  providedExports: SerializedProvidedExports;
  usedExports: SerializedUsedExports;
  exports: SerializedExportInfo[];
  otherExportsInfo: SerializedSpecialExportInfo;
  sideEffectsOnlyInfo: SerializedSpecialExportInfo;
  isUsed: boolean;
  isModuleUsed: boolean;
  hasRedirect: boolean;
  redirectedExportNames: string[];
};

export type WebpackModule = {
  path: string;
  deps: WebpackDependency[];
  presentationalDeps: WebpackDependency[];
  blocks: WebpackBlock[];
  exportsInfo: SerializedExportsInfo | null;
};

export interface CompileResult {
  success: boolean;
  data?: {
    modules: WebpackModule[];
  };
  error?: string;
}

export type FileMap = { [filename: string]: string };

export const compileCode = async (
  files: FileMap,
  mode: 'development' | 'production' = 'development'
): Promise<CompileResult> => {
  try {
    const container = await initWebContainer();

    // Ensure /src directory exists
    await mkdir("/src");

    // Write all files to WebContainer
    for (const [filename, content] of Object.entries(files)) {
      const filePath = filename.startsWith('/') ? filename : `/src/${filename}`;
      await writeFile(filePath, content);
    }

    // Run webpack
    const webpackProcess = await container.spawn("node", ["runCompiler.js", "--mode", mode]);
    const webpackOutput = await webpackProcess.output;
    const exitCode = await webpackProcess.exit;

    const result = await webpackOutput.getReader().read();

    if (exitCode !== 0) {
      return {
        success: false,
        error: result.value,
      };
    }

    try {
      return {
        success: true,
        data: JSON.parse(result.value!),
      };
    } catch (error) {
      return {
        success: false,
        error: `处理编译结果时出错: ${error}`,
      };
    }
  } catch (e) {
    return {
      success: false,
      error: e as any,
    };
  }
};
