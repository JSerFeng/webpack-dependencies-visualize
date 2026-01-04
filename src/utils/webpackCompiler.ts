import { initWebContainer, writeFile, mkdir } from "./webContainer";

export type WebpackDependency = {
  targetModule?: string;
  [key: string]: any;
};

export type WebpackBlock = {
  dependencies?: WebpackDependency[];
  [key: string]: any;
};

export type WebpackModule = {
  path: string;
  deps: WebpackDependency[];
  presentationalDeps: WebpackDependency[];
  blocks: WebpackBlock[];
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

