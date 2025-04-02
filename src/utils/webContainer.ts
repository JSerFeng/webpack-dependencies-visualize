import { WebContainer } from "@webcontainer/api";
let instance: Promise<WebContainer> | null = null;
let snapshotPromise: Promise<ArrayBuffer> | null = null;

// 预加载snapshot文件
const preloadSnapshot = () => {
  if (!snapshotPromise) {
    snapshotPromise = fetch("/snapshot")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load snapshot: ${res.status}`);
        return res.arrayBuffer();
      })
      .catch((error) => {
        snapshotPromise = null;
        throw error;
      });
  }
  return snapshotPromise;
};

export const initWebContainer = async () => {
  if (instance) return instance;

  let resolveInstance;
  let rejectInstance;
  instance = new Promise((resolve, reject) => {
    resolveInstance = resolve;
    rejectInstance = reject;
  });
  try {
    // 并行执行WebContainer启动和snapshot加载
    const [container, snapshot] = await Promise.all([
      WebContainer.boot(),
      preloadSnapshot(),
    ]);

    resolveInstance!(container);
    const currInstance = await instance;
    await currInstance.mount(snapshot);
    return instance;
  } catch (error) {
    rejectInstance!(error);
    console.error("Failed to initialize WebContainer:", error);
    throw error;
  }
};

export const getWebContainer = async () => {
  if (!instance) {
    throw new Error("WebContainer not initialized");
  }
  return instance;
};

export const writeFile = async (path: string, contents: string) => {
  const container = await getWebContainer();
  await container.fs.writeFile(path, contents);
};

export const mkdir = async (path: string) => {
  const container = await getWebContainer();
  await container.fs.mkdir(path, { recursive: true });
};

export const readFile = async (path: string) => {
  const container = await getWebContainer();
  const contents = await container.fs.readFile(path, "utf-8");
  return contents;
};

export const destroyWebContainer = async () => {
  if (instance) {
    (await instance).teardown();
    instance = null;
  }
  snapshotPromise = null;
};
