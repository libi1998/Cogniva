import { expect, test } from "@playwright/test"
import { openDemo, openTab, selectText, withEditor } from "./editor"

/**
 * Traduzione con il modello OPUS-MT sul dispositivo: deve funzionare in ogni
 * browser, anche senza il traduttore integrato di Chrome. La prima volta
 * scarica il modello (circa 130 MB), poi resta nella cache.
 */

test.setTimeout(300_000)

test("traduce la selezione con il modello sul dispositivo e la sostituisce", async ({
  page,
}) => {
  // niente traduttore integrato: è il caso di Safari e Firefox
  await page.addInitScript(() => {
    delete (globalThis as { Translator?: unknown }).Translator
  })
  await openDemo(page)
  await selectText(page, 1, "Un documento di esempio")
  await openTab(page, "Revisione")
  await page.getByRole("button", { name: "Traduci", exact: true }).click()
  await page.getByRole("menuitem", { name: "Traduci selezione" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Un documento di esempio")).toBeVisible()
  // in automatico, senza traduttore del browser, si usa il modello
  await expect(
    dialog.getByText(/Modello OPUS-MT sul dispositivo/)
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Traduci", exact: true }).click()
  await expect(dialog.getByRole("progressbar")).toBeVisible()

  const result = dialog.getByTestId("translation-result")
  await expect(result).toBeVisible({ timeout: 280_000 })
  const english = (await result.textContent()) ?? ""
  expect(english.toLowerCase()).toMatch(/document|example|sample/)

  await dialog.getByRole("button", { name: "Sostituisci" }).click()
  await expect(dialog).toBeHidden()
  const paragraph = await withEditor<string>(
    page,
    "return editor.state.doc.child(1).textContent"
  )
  expect(paragraph.startsWith(english.trim())).toBe(true)
})

test("traduce il documento in un nuovo documento con la stessa struttura", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (globalThis as { Translator?: unknown }).Translator
  })
  await openDemo(page)
  await openTab(page, "Revisione")
  await page.getByRole("button", { name: "Traduci", exact: true }).click()
  await page.getByRole("menuitem", { name: "Traduci documento" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("radio", { name: "Modello Cogniva" }).click()
  await dialog.getByRole("button", { name: "Traduci", exact: true }).click()

  await page.waitForURL((url) => !url.pathname.endsWith("/demo-doc"), {
    timeout: 280_000,
  })
  const sheet = page.locator("#doc-sheet .ProseMirror")
  await expect(sheet).toBeVisible()
  // stessa struttura: due titoli, tre attività, la citazione e il grassetto
  await expect(sheet.locator("h2")).toHaveCount(2)
  await expect(sheet.getByRole("checkbox")).toHaveCount(3)
  await expect(sheet.locator("blockquote")).toHaveCount(1)
  await expect(sheet.locator("strong")).toHaveCount(1)
  const text = ((await sheet.textContent()) ?? "").toLowerCase()
  expect(text).not.toContain("documento di esempio")
  expect(text).toMatch(/example|sample/)
})
