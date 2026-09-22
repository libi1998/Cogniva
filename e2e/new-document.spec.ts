import { expect, test } from "@playwright/test"
import { openDemo, withEditor } from "./editor"

/**
 * Un documento nuovo e le scorciatoie di Word per lavorarci.
 */

test("un documento nuovo è pronto per scrivere", async ({ page }) => {
  await page.goto("/it")
  await expect(
    page.getByRole("button", { name: /^Tutti i file \d/ })
  ).toBeVisible()
  await page.getByRole("button", { name: "Nuovo documento" }).first().click()
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible()

  // il cursore aspetta nella riga del titolo: prima le prime battute dopo
  // «Nuovo documento» andavano perse finché non si cliccava nel foglio
  await page.waitForFunction(() =>
    document
      .querySelector("#doc-sheet .ProseMirror")
      ?.contains(document.activeElement)
  )
  await page.keyboard.type("Verbale", { delay: 12 })
  await expect(
    page.getByRole("textbox", { name: "Nome del file" })
  ).toHaveValue("Verbale")
})

test("Ctrl+H apre Trova e sostituisci", async ({ page, browserName }) => {
  // sul Mac ⌃H cancella il carattere prima del cursore, come Backspace
  test.skip(process.platform === "darwin", "scorciatoia di Windows e Linux")
  test.skip(browserName !== "chromium", "basta un browser")
  await openDemo(page)
  await withEditor(page, "editor.chain().focus('end').run()")
  await page.keyboard.press("Control+h")
  await expect(page.getByPlaceholder("Sostituisci con")).toBeVisible()
})
