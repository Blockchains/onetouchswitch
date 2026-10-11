import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const STATIC = process.env.VITE_STATIC === "1";
export default defineConfig({
  root: "web", base: STATIC ? (process.env.VITE_BASE ?? "/onetouchswitch/") : "/", plugins: [react()],
  build: { outDir: STATIC ? "../site" : "dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
