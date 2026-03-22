import { snapshot } from '@webcontainer/snapshot';

import fs from 'fs';
import os from 'os';
import path from 'path';

const COMPILER_DIR = path.resolve('./compiler');
const OUTPUT_PATH = path.resolve('./public/snapshot');
const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'webpack-dependencies-visualize-snapshot-'),
);
const stagedCompilerDir = path.join(tempRoot, 'compiler');

const copyForSnapshot = (sourcePath, destinationPath) => {
  const stats = fs.lstatSync(sourcePath);

  if (stats.isSymbolicLink()) {
    const resolvedPath = fs.realpathSync(sourcePath);
    const resolvedStats = fs.statSync(resolvedPath);

    if (resolvedStats.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true });
      for (const entry of fs.readdirSync(resolvedPath)) {
        copyForSnapshot(
          path.join(resolvedPath, entry),
          path.join(destinationPath, entry),
        );
      }
      return;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(resolvedPath, destinationPath);
    return;
  }

  if (stats.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });

    for (const entry of fs.readdirSync(sourcePath)) {
      if (path.basename(sourcePath) === 'node_modules' && entry === '.bin') {
        continue;
      }

      copyForSnapshot(
        path.join(sourcePath, entry),
        path.join(destinationPath, entry),
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
};

try {
  copyForSnapshot(COMPILER_DIR, stagedCompilerDir);

  // snapshot is a `Buffer`
  const folderSnapshot = await snapshot(stagedCompilerDir);
  fs.writeFileSync(OUTPUT_PATH, folderSnapshot);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
