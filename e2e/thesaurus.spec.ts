import { expect, test } from "@playwright/test"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  selectText,
  withEditor,
} from "./editor"

/**
 * Thesaurus: il dizionario dei sinonimi di LibreOffice si scarica alla prima
 * ricerca, poi i sinonimi si cercano, si esplorano e si inseriscono nel testo.
 */

test.setTimeout(120_000)

const paragraph = (page: import("@playwright/test").Page) =>
  withEditor<string>(page, "return editor.state.doc.child(1).textContent")

test("cerca i sinonimi della parola selezionata e ne inserisce uno", async ({
  page,
}) => {
  await openDemo(page)
  await selectText(page, 1, "documento")
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Thesaurus")).click()

  const pane = page.getByLabel("Thesaurus", { exact: true })
  await expect(pane.getByLabel("Cerca sinonimi")).toHaveValue("documento")
  const results = pane.getByTestId("thesaurus-results")
  await expect(results).toBeVisible({ timeout: 90_000 })
  await expect(
    results.getByRole("button", { name: /^Inserisci «/ }).first()
  ).toBeAttached()

  // un clic su un sinonimo lo cerca, la freccia torna indietro
  const first = results.locator("li button").first()
  const term = ((await first.textContent()) ?? "").trim()
  await first.click()
  await expect(pane.getByLabel("Cerca sinonimi")).toHaveValue(term)
  await pane.getByRole("button", { name: "Parola precedente" }).click()
  await expect(pane.getByLabel("Cerca sinonimi")).toHaveValue("documento")
  await expect(results).toBeVisible()

  // «Inserisci» sostituisce la parola selezionata
  await selectText(page, 1, "documento")
  const insert = results.getByRole("button", { name: /^Inserisci «/ }).first()
  const name = (await insert.getAttribute("aria-label")) ?? ""
  const synonym = name.replace(/^Inserisci «|»$/g, "")
  await insert.click()
  expect(await paragraph(page)).toMatch(new RegExp(`^Un ${synonym} di esempio`))
})

test("una parola flessa trova la sua voce e le maiuscole restano", async ({
  page,
}) => {
  await openDemo(page)
  await caretAfter(page, 1, "Gli Stil")
  await page.keyboard.press("Shift+F7")
  const pane = page.getByLabel("Thesaurus", { exact: true })
  await expect(pane.getByLabel("Cerca sinonimi")).toHaveValue("Stili")
  await expect(pane.getByTestId("thesaurus-results")).toBeVisible({
    timeout: 90_000,
  })
  await expect(pane.getByText(/Risultati per .*«stile»/i)).toBeVisible()
  await caretAfter(page, 1, "Gli Stil")
  await pane
    .getByRole("button", { name: /^Inserisci «/ })
    .first()
    .click()
  // «Stili» → sinonimo con l'iniziale maiuscola
  expect(await paragraph(page)).toMatch(/Gli [A-ZÀ-Ý]\S* della scheda/)
})

test("il menu contestuale propone i sinonimi quando il dizionario c'è", async ({
  page,
}) => {
  await openDemo(page)
  await selectText(page, 1, "esempio")
  await page.keyboard.press("Shift+F7")
  const pane = page.getByLabel("Thesaurus", { exact: true })
  await expect(pane.getByTestId("thesaurus-results")).toBeVisible({
    timeout: 90_000,
  })
  await pane.getByRole("button", { name: "Chiudi il thesaurus" }).click()
  await expect(pane).toBeHidden()

  await caretAfter(page, 1, "Un documento di esem")
  const box = await page
    .locator("#doc-sheet .ProseMirror p")
    .first()
    .boundingBox()
  await page.mouse.click(box!.x + 40, box!.y + 8, { button: "right" })
  await page.getByRole("menuitem", { name: "Sinonimi" }).hover()
  const thesaurus = page.getByRole("menuitem", { name: /Thesaurus…/ })
  await expect(thesaurus).toBeVisible()
  const suggestions = page.getByRole("menu").last().getByRole("menuitem")
  await expect.poll(() => suggestions.count()).toBeGreaterThan(2)
})
