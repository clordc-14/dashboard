import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default {
  build: {
    rollupOptions: {
      input: {
        index: resolve(rootDir, "index.html"),
        table: resolve(rootDir, "table.html"),
        search: resolve(rootDir, "search.html")
      }
    }
  }
};
