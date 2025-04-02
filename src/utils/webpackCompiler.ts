import { initWebContainer, mkdir, writeFile } from "./webContainer";
import type { Dependency } from "webpack";

export type WebpackDependency = {
  type: string;
  category: string;
  ids?: string[];
  loc?: Pick<Dependency, "loc">;
};

export interface CompileResult {
  success: boolean;
  data?: { deps: WebpackDependency[] };
  error?: string;
}

export const compileCode = async (code: string): Promise<CompileResult> => {
  try {
    const container = await initWebContainer();

    // 写入入口文件
    await writeFile("/src/index.js", code);
    // 运行webpack
    const webpackProcess = await container.spawn("node", ["runCompiler.js"]);
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
        data: { deps: JSON.parse(result.value!) },
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
