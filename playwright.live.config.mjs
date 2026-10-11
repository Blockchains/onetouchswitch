import { defineConfig } from "@playwright/test";
// ONLINE journey against the deployed GitHub Pages site (run by the Pages workflow after deploy, or locally).
export default defineConfig({
  testDir: "tests/live", timeout: 120000, retries: 1, reporter: [["list"]], workers: 1,
  use: { channel: process.env.PW_CHANNEL ?? "chrome", baseURL: process.env.LIVE_URL ?? "https://blockchains.github.io/onetouchswitch/", launchOptions: { args: ["--no-sandbox"] } },
});
