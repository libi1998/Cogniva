import { expect, test, type Page } from "@playwright/test"
import { openDemo, withEditor } from "./editor"

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

test("l'inglese mette gli ordinali in apice", async ({ page }) => {
  await withEditor(page, `editor.storage.autoCorrect.language = "en-US"`)
  await type(page, "the 21st time.")
  expect(await lastHtml(page)).toContain("<sup>st</sup>")
})
