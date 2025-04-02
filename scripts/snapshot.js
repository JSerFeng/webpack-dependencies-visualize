import { snapshot } from "@webcontainer/snapshot";

import fs from "fs";

// snapshot is a `Buffer`
const folderSnapshot = await snapshot("./compiler");
fs.writeFileSync("./public/snapshot", folderSnapshot);