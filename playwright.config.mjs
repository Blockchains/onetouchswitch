import { defineConfig } from "@playwright/test";
const node = process.execPath;
// Every project serves the BUILT static site exactly like GitHub Pages. No app server exists.
export default defineConfig({
  testDir: "tests/e2e", timeout: 60000, retries: 0, reporter: [["list"]], workers: 1,
  use: { channel: process.env.PW_CHANNEL ?? "chrome", launchOptions: { args: ["--no-sandbox"] } },
  projects: [
    { name: "pages-production-catalogue", testMatch: /journey-static/, use: { baseURL: "http://127.0.0.1:8797" } },
    { name: "pages-fixture-catalogue", testMatch: /journey-fixture/, use: { baseURL: "http://127.0.0.1:8798" } },
    { name: "offline-after-load", testMatch: /journey-offline/ },
  ],
  webServer: [
    { command: `${node} scripts/static-server.mjs 8797`, url: "http://127.0.0.1:8797/onetouchswitch/api/v1/index.json", reuseExistingServer: false, timeout: 30000 },
    { command: `${node} scripts/static-server.mjs 8798 tests/fixtures/overlay`, url: "http://127.0.0.1:8798/onetouchswitch/api/v1/index.json", reuseExistingServer: false, timeout: 30000 },
  ],
});
