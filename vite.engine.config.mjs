// Single-file ESM bundle of the whole engine (postcode, offers, compare, guides, bill text, saved) for touch.grok.me to import from Pages.
import { defineConfig } from "vite";
export default defineConfig({ build: { outDir: "site/engine/v1", emptyOutDir: false, lib: { entry: "core/static-client.mjs", formats: ["es"], fileName: () => "ots-engine.mjs" }, minify: true, rollupOptions: { output: { codeSplitting: false } } } });
