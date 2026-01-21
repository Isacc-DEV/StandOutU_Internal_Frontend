import { defineConfig } from "vite";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "../../../");

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, "runtimeEntry.ts"),
      name: "SmartworkAutofillRuntime",
      formats: ["iife"],
      fileName: () => "runtime.js",
    },
    outDir: resolve(projectRoot, "public", "autofill"),
    emptyOutDir: false,
    target: "es2017",
  },
});
