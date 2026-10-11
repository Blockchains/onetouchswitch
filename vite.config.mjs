// The app is ALWAYS a static bundle: GitHub Pages (base /onetouchswitch/) or any static host (VITE_BASE=/ for a root domain).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ root: "web", base: process.env.VITE_BASE ?? "/onetouchswitch/", plugins: [react()], build: { outDir: "../site", emptyOutDir: true } });
