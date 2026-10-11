import { defineConfig } from "@playwright/test";
const node = process.execPath;
export default defineConfig({
  testDir: "tests/e2e", timeout: 30000, retries: 0, reporter: [["list"]],
  use: { channel: process.env.PW_CHANNEL ?? "chrome", launchOptions: { args: ["--no-sandbox"] } },
  projects: [
    { name: "fixture-catalogue", testMatch: /journey-catalogue/, use: { baseURL: "http://127.0.0.1:8798" } },
    { name: "production-empty-catalogue", testMatch: /journey-empty/, use: { baseURL: "http://127.0.0.1:8799" } },
    { name: "static-pages-build", testMatch: /journey-static/, use: { baseURL: "http://127.0.0.1:8797" } },
  ],
  webServer: [
    { command: `${node} scripts/e2e-server.mjs 8798 fixture`, url: "http://127.0.0.1:8798/api/health", reuseExistingServer: false, timeout: 30000 },
    { command: `${node} scripts/e2e-server.mjs 8799 empty`, url: "http://127.0.0.1:8799/api/health", reuseExistingServer: false, timeout: 30000 },
    { command: `${node} scripts/static-server.mjs 8797`, url: "http://127.0.0.1:8797/onetouchswitch/api/v1/index.json", reuseExistingServer: false, timeout: 30000 },
  ],
});
