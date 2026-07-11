import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/[!._]*.test.ts"],
    exclude: ["**/node_modules/**", "**/._*"],
    coverage: { reporter: ["text", "json", "html"] },
  },
});
