import { defineConfig, devices } from "@playwright/test"

/**
 * Test nel browser vero: tastiera, composizione e appunti passano dal
 * browser come quando si scrive a mano. Ogni test ha un profilo nuovo, quindi
 * i dati dell'area di lavoro non vengono toccati.
 *
 * Chrome esegue tutto; Safari (WebKit) le funzioni che dipendono dal
 * browser, come traduzione e lettura ad alta voce.
 */
const common = {
  viewport: { width: 1400, height: 900 },
  locale: "it-IT",
}
/**
 * Ambienti chiusi (container CI, sandbox) tengono i browser in una cartella
 * loro: `E2E_EXECUTABLE_PATH` indica l'eseguibile già presente invece di
 * scaricarlo, e `E2E_NO_SANDBOX` serve quando i test girano da root.
 */
const launchOptions = {
  ...(process.env.E2E_EXECUTABLE_PATH
    ? { executablePath: process.env.E2E_EXECUTABLE_PATH }
    : {}),
  ...(process.env.E2E_NO_SANDBOX ? { args: ["--no-sandbox"] } : {}),
}
const crossBrowser =
  /(translate|read-aloud|thesaurus|model-3d|add-ins|export-studio)\.spec\.ts/

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        ...common,
        ...(process.env.E2E_EXECUTABLE_PATH
          ? {}
          : { channel: process.env.E2E_CHANNEL ?? "chrome" }),
        launchOptions,
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
    {
      name: "webkit",
      testMatch: crossBrowser,
      use: { ...devices["Desktop Safari"], ...common },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
