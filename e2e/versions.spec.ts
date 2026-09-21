import { expect, test } from "@playwright/test"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * «Cronologia versioni»: si salva una versione, si cambia il testo e la si
 * ripristina. Tutto resta in questo browser, in un database a parte.
 */

const firstParagraph = (page: import("@playwright/test").Page) =>
  withEditor<string>(page, `return editor.state.doc.child(1).textContent`)

test("salva una versione, poi la ripristina", async ({ page }) => {
  await openDemo(page)
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Cronologia")).click()

  const pane = page.getByLabel("Cronologia versioni")
  await expect(pane).toBeVisible()
  await expect(pane.getByText("Ancora nessuna versione")).toBeVisible()

  const original = await firstParagraph(page)
  await pane.getByRole("button", { name: "Salva una versione" }).click()
  await expect(pane.getByText("Versione salvata a mano")).toBeVisible()

  // si cambia il testo: la versione salvata deve poterlo riportare indietro
  await caretAfter(page, 1, "Un ")
  await page.keyboard.type("GRANDISSIMO ")
  expect(await firstParagraph(page)).toContain("GRANDISSIMO")

  await pane.getByRole("button", { name: "Ripristina questa versione" }).click()
  await pane.getByRole("button", { name: "Ripristina", exact: true }).click()

  await expect
    .poll(() => firstParagraph(page), { timeout: 10_000 })
    .toBe(original)
  // quello che c'era prima del ripristino non è andato perso
  await expect(pane.getByText("Salvataggio automatico")).toBeVisible()
})

test("le versioni restano dopo aver ricaricato la pagina", async ({ page }) => {
  await openDemo(page)
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Cronologia")).click()
  const pane = page.getByLabel("Cronologia versioni")
  await pane.getByRole("button", { name: "Salva una versione" }).click()
  await expect(pane.getByText("Versione salvata a mano")).toBeVisible()

  await openDemo(page)
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Cronologia")).click()
  await expect(
    page.getByLabel("Cronologia versioni").getByText("Versione salvata a mano")
  ).toBeVisible()
})
