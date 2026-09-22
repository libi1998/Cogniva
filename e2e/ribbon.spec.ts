import { expect, test, type Page } from "@playwright/test"
import { openDemo, openTab, ribbonButton, withEditor } from "./editor"

/**
 * La barra a schede e le sue finestre, come in Word.
 *
 * Tre cose che prima non tornavano: i gruppi che non ci stavano finivano
 * fuori dallo schermo invece di ridursi; le finestre avevano tutte una barra
 * di scorrimento, perché la fascia dei pulsanti sporgeva dai bordi; e chiusa
 * una finestra o un menu la prima lettera battuta si perdeva.
 */

const TABS = [
  "Home",
  "Inserisci",
  "Disegno",
  "Layout",
  "Progettazione",
  "Riferimenti",
  "Corrispondenza",
  "Revisione",
  "Visualizza",
]

/** Quanto sporge la barra oltre il bordo della finestra */
const overflow = (page: Page) =>
  page
    .locator('[role="tabpanel"]')
    .evaluate((el) => el.scrollWidth - el.clientWidth)

/** Scrive in un paragrafo nuovo e restituisce quello che è arrivato */
async function type(page: Page, text: string) {
  await withEditor(
    page,
    `
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, { type: "paragraph" }).focus("end").run()
    `
  )
  await page.keyboard.type(text, { delay: 12 })
  return withEditor<string>(
    page,
    `return editor.state.doc.lastChild.textContent`
  )
}

test.describe("la barra sta nella finestra", () => {
  for (const width of [1400, 1100, 900]) {
    test(`nessun gruppo fuori dallo schermo a ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await openDemo(page)
      for (const tab of TABS) {
        await openTab(page, tab)
        // i gruppi che non ci stanno si riducono a un pulsante: la barra non
        // deve mai scorrere in orizzontale
        expect(await overflow(page), tab).toBeLessThanOrEqual(0)
      }
    })
  }
})

test("un comando di un gruppo ridotto si raggiunge e funziona", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 })
  await openDemo(page)
  await openTab(page, "Inserisci")
  const collapsed = page.locator('[role="tabpanel"] [data-collapsed]')
  await expect(collapsed.first()).toBeVisible()

  // «Equazione» sta nel gruppo Simboli, che a questa larghezza è ridotto
  await (await ribbonButton(page, "Equazione")).click()
  await page
    .getByRole("menuitem", { name: "Inserisci nuova equazione" })
    .click()
  await expect
    .poll(() =>
      withEditor<number>(
        page,
        `
        let n = 0
        editor.state.doc.descendants((node) => { if (node.type.name === "mathBlock") n += 1; return true })
        return n
        `
      )
    )
    .toBe(1)
})

test("le finestre stanno nello spazio che occupano", async ({ page }) => {
  await openDemo(page)
  await openTab(page, "Inserisci")
  for (const command of ["Segnalibro", "Riferimento incrociato", "Icone"]) {
    await (await ribbonButton(page, command)).click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    // intestazione e pulsanti restano fermi: a scorrere è semmai il corpo
    expect(
      await dialog.evaluate((el) => el.scrollHeight - el.clientHeight),
      command
    ).toBeLessThanOrEqual(0)
    expect(
      await dialog.evaluate((el) => el.scrollWidth - el.clientWidth),
      command
    ).toBeLessThanOrEqual(0)
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  }
})

test("chiusa una finestra o un menu si riprende a scrivere", async ({
  page,
}) => {
  await openDemo(page)
  await openTab(page, "Inserisci")

  // un menu della barra, chiuso senza scegliere niente
  await (await ribbonButton(page, "Capolettera")).click()
  await expect(page.getByRole("menuitem").first()).toBeVisible()
  await page.keyboard.press("Escape")
  expect(await type(page, "perche si...")).toBe("Perché si…")

  // una finestra
  const dialog = page.locator('[data-slot="dialog-content"]')
  await (await ribbonButton(page, "Segnalibro")).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  expect(await type(page, "perche si...")).toBe("Perché si…")
})
