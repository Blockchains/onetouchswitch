// Single-file ESM bundle of the static client + deterministic engine for touch.grok.me to import.
import { defineConfig } from "vite";
export default defineConfig({ build: { outDir: "site/engine/v1", emptyOutDir: false, lib: { entry: "core/static-client.mjs", formats: ["es"], fileName: () => "ots-engine.mjs" }, minify: true } });
