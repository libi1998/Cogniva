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

test("rinominato dalla home, il documento tiene il nome nuovo", async ({
  page,
}) => {
  await page.goto("/it")
  const card = page.getByRole("link", { name: /Product brief/ })
  await expect(card).toBeVisible()
  await card.hover()
  await page.getByRole("button", { name: "Azioni per Product brief" }).click()
  await page.getByRole("menuitem", { name: "Rinomina" }).click()
  await page.getByLabel("Nuovo nome").fill("Brief di lancio")
  await page.getByRole("button", { name: "Salva" }).click()

  // aprendolo il titolo nella prima riga si allinea al nome: prima il file
  // tornava a chiamarsi «Product brief» all'apertura o alla prima battuta
  await page.getByRole("link", { name: /Brief di lancio/ }).click()
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible()
  const name = page.getByRole("textbox", { name: "Nome del file" })
  await expect(name).toHaveValue("Brief di lancio")
  await expect(page.locator("#doc-sheet .ProseMirror > *").first()).toHaveText(
    "Brief di lancio"
  )

  await withEditor(page, "editor.chain().focus('end').run()")
  await page.waitForFunction(() =>
    document
      .querySelector("#doc-sheet .ProseMirror")
      ?.contains(document.activeElement)
  )
  await page.keyboard.type(" ancora", { delay: 12 })
  await page.waitForTimeout(600)
  await expect(name).toHaveValue("Brief di lancio")
})

test("l'app non scorre: niente sporge oltre la finestra", async ({ page }) => {
  // l'intestazione nascosta della tavolozza comandi stava fuori dalla
  // finestra, in fondo alla pagina e alta 29 px: la pagina intera scorreva
  // di 28 px e a volte l'app scivolava in su, sotto al puntatore
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    )
  await page.goto("/it")
  await expect(
    page.getByRole("button", { name: /^Tutti i file \d/ })
  ).toBeVisible()
  expect(await overflow()).toBe(0)
  await openDemo(page)
  expect(await overflow()).toBe(0)
  await page.goto("/it/board/demo-board")
  await expect(page.getByRole("button", { name: "Esporta" })).toBeVisible()
  expect(await overflow()).toBe(0)
})
