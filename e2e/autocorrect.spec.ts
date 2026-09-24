import { expect, test, type Page } from "@playwright/test"
import {
  focused,
  inserted,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * Correzione automatica mentre si scrive, come in Word. Il documento
 * d'esempio è in italiano: virgolette alte, ordinali con º e ª e la tabella
 * delle sostituzioni italiana.
 */

/** Scrive in un paragrafo nuovo in fondo al documento e legge il risultato */
async function type(page: Page, text: string) {
  await withEditor(
    page,
    `
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, { type: "paragraph" }).focus("end").run()
    `
  )
  // il comando `focus` di Tiptap mette il fuoco al fotogramma dopo: senza
  // aspettarlo il primo tasto arriverebbe prima e andrebbe perso
  await focused(page)
  await page.keyboard.type(text, { delay: 12 })
  return withEditor<string>(
    page,
    `return editor.state.doc.lastChild.textContent`
  )
}

const lastHtml = (page: Page) =>
  page.locator("#doc-sheet .ProseMirror > *").last().innerHTML()

test.beforeEach(async ({ page }) => {
  await openDemo(page)
})

test("virgolette tipografiche, puntini e lineette", async ({ page }) => {
  expect(await type(page, 'dice "ciao" a tutti... e poi --- fine')).toBe(
    "Dice “ciao” a tutti… e poi — fine"
  )
})

test("la lineetta breve arriva con lo spazio", async ({ page }) => {
  expect(await type(page, "roma -- milano ")).toBe("Roma – milano ")
})

test("simboli, frecce e frazioni", async ({ page }) => {
  expect(await type(page, "(c) 2026 (tm) --> 1/2 fatto")).toBe(
    "© 2026 ™ → ½ fatto"
  )
})

test("la tabella corregge la parola e la maiuscola della frase", async ({
  page,
}) => {
  expect(await type(page, "perche si. perche no.")).toBe(
    "Perché si. Perché no."
  )
})

test("dopo un'abbreviazione la frase non ricomincia", async ({ page }) => {
  expect(await type(page, "mele, pere ecc. sono frutti.")).toBe(
    "Mele, pere ecc. sono frutti."
  )
})

test("DUe iniziali maiuscole e ordinali", async ({ page }) => {
  expect(await type(page, "NOme al 1o posto.")).toBe("Nome al 1º posto.")
})

test("spenta non tocca niente", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "cogniva.doc.autocorrect",
      JSON.stringify({ enabled: false })
    )
  })
  await page.reload()
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible()
  await page.waitForFunction(() =>
    Boolean(
      (
        document.querySelector("#doc-sheet .ProseMirror") as unknown as {
          editor?: unknown
        } | null
      )?.editor
    )
  )
  expect(await type(page, 'dice "ciao"... perche')).toBe(
    'dice "ciao"... perche'
  )
})

test("la finestra spegne una singola opzione e la ricorda", async ({
  page,
}) => {
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Correzione automatica")).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  const quotes = dialog.getByRole("switch").nth(1)
  await expect(quotes).toHaveAttribute("aria-checked", "true")
  await quotes.click()
  await expect(quotes).toHaveAttribute("aria-checked", "false")
  await dialog
    .getByRole("button", { name: "Chiudi", exact: true })
    .first()
    .click()
  await expect(dialog).toBeHidden()

  // le virgolette restano dritte, il resto continua a funzionare
  expect(await type(page, 'dice "ciao"... perche si.')).toBe(
    'Dice "ciao"… perché si.'
  )

  // la scelta è di chi scrive: resta anche dopo aver ricaricato
  await openDemo(page)
  expect(await type(page, 'ancora "dritte"')).toBe('Ancora "dritte"')
})

test("il codice resta come si scrive", async ({ page }) => {
  await withEditor(
    page,
    `
    const end = editor.state.doc.content.size
    editor.commands.insertContentAt(end, {
      type: "paragraph",
      content: [{ type: "text", text: "// " }],
    })
    editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run()
    editor.commands.setCodeBlock()
    `
  )
  await page.keyboard.type('if (a --> b) "x"...', { delay: 12 })
  expect(
    await withEditor<string>(
      page,
      `
      let out = ""
      editor.state.doc.descendants((node) => {
        if (node.type.name === "codeBlock") out = node.textContent
        return true
      })
      return out
      `
    )
  ).toBe('// if (a --> b) "x"...')
})

test("le parole di Object.prototype non sono sostituzioni", async ({
  page,
}) => {
  // «constructor» e «toString» rispondono su qualunque oggetto: la tabella
  // deve guardare solo le chiavi che ha davvero
  expect(await type(page, "il constructor e il toString restano.")).toBe(
    "Il constructor e il toString restano."
  )
})

test("con il rilevamento le correzioni diventano revisioni", async ({
  page,
}) => {
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Revisioni")).click()
  await expect(await ribbonButton(page, "Revisioni")).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await page.keyboard.press("Escape")

  expect(await type(page, "perche si...")).toContain("Perché si…")
  // il testo corretto è comunque un inserimento, non una modifica silenziosa
  expect(await inserted(page)).not.toEqual([])
})

test("Invio divide il paragrafo, non lo corregge", async ({ page }) => {
  await withEditor(
    page,
    `
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, { type: "paragraph" }).focus("end").run()
    `
  )
  // come in `type`: il primo tasto aspetta il fuoco, o va perso
  await focused(page)
  await page.keyboard.type("perche", { delay: 12 })
  await page.keyboard.press("Enter")
  await page.keyboard.type("dopo", { delay: 12 })
  // due paragrafi veri: Invio non deve finire dentro al testo
  expect(
    await withEditor<string>(
      page,
      `
      const d = editor.state.doc
      const n = d.childCount
      return [d.child(n - 2), d.child(n - 1)]
        .map((c) => c.type.name + ":" + c.textContent)
        .join("|")
      `
    )
  ).toBe("paragraph:perche|paragraph:dopo")
})

test("l'inglese mette gli ordinali in apice", async ({ page }) => {
  await withEditor(page, `editor.storage.autoCorrect.language = "en-US"`)
  await type(page, "the 21st time.")
  expect(await lastHtml(page)).toContain("<sup>st</sup>")
})

/** I pezzi dell'ultimo paragrafo con i loro segni: «testo:bold,italic» */
const lastRuns = (page: Page) =>
  withEditor<string[]>(
    page,
    `const out = []
     editor.state.doc.lastChild.forEach((t) => out.push(t.text + ":" + t.marks.map((m) => m.type.name).join(",")))
     return out`
  )

test("la correzione tiene la formattazione della parola", async ({ page }) => {
  await type(page, "")
  // «grassetto» in grassetto, poi grassetto spento e uno spazio: la maiuscola
  // della frase arriva con lo spazio e prima si portava via il grassetto
  await page.keyboard.press("ControlOrMeta+b")
  await page.keyboard.type("grassetto", { delay: 12 })
  await page.keyboard.press("ControlOrMeta+b")
  await page.keyboard.type(" e ", { delay: 12 })
  await page.keyboard.press("ControlOrMeta+i")
  await page.keyboard.type("perche", { delay: 12 })
  await page.keyboard.press("ControlOrMeta+i")
  await page.keyboard.type(" no", { delay: 12 })
  expect(await lastRuns(page)).toEqual([
    "Grassetto:bold",
    " e :",
    "perché:italic",
    " no:",
  ])
})

test("i puntini tengono la formattazione del testo", async ({ page }) => {
  await type(page, "")
  await page.keyboard.press("ControlOrMeta+b")
  await page.keyboard.type("attesa...", { delay: 12 })
  expect(await lastRuns(page)).toEqual(["Attesa…:bold"])
})
