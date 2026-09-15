import { expect, type Page } from "@playwright/test"

/** Apre il documento d'esempio e aspetta l'editor */
export async function openDemo(page: Page) {
  await page.goto("/doc/demo-doc")
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible()
  // l'editor è pronto quando espone l'istanza sul suo elemento
  await page.waitForFunction(() =>
    Boolean(
      (
        document.querySelector("#doc-sheet .ProseMirror") as unknown as {
          editor?: unknown
        } | null
      )?.editor
    )
  )
}

/** Esegue codice con l'editor Tiptap della pagina */
export { focused }

export async function withEditor<T>(
  page: Page,
  fn: string,
  arg?: unknown
): Promise<T> {
  return page.evaluate(
    ([source, value]) => {
      const el = document.querySelector(
        "#doc-sheet .ProseMirror"
      ) as unknown as {
        editor: unknown
      }
      return new Function("editor", "arg", source)(el.editor, value)
    },
    [fn, arg] as const
  ) as Promise<T>
}

/** Mette il cursore dopo `text` nel paragrafo n (0 = titolo) */
export async function caretAfter(page: Page, block: number, text: string) {
  await withEditor(
    page,
    `
    let pos = 0
    for (let i = 0; i < arg.block; i++) pos += editor.state.doc.child(i).nodeSize
    const node = editor.state.doc.child(arg.block)
    const offset = node.textContent.indexOf(arg.text)
    if (offset < 0) throw new Error("testo non trovato: " + arg.text)
    editor.commands.focus(pos + 1 + offset + arg.text.length)
    `,
    { block, text }
  )
  await focused(page)
}

/** Seleziona `text` nel paragrafo n */
export async function selectText(page: Page, block: number, text: string) {
  await withEditor(
    page,
    `
    let pos = 0
    for (let i = 0; i < arg.block; i++) pos += editor.state.doc.child(i).nodeSize
    const node = editor.state.doc.child(arg.block)
    const offset = node.textContent.indexOf(arg.text)
    if (offset < 0) throw new Error("testo non trovato: " + arg.text)
    editor.chain().focus().setTextSelection({ from: pos + 1 + offset, to: pos + 1 + offset + arg.text.length }).run()
    `,
    { block, text }
  )
  await focused(page)
}

/** Aspetta che il fuoco sia davvero nel testo: i tasti vanno lì */
async function focused(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#doc-sheet .ProseMirror")
    return Boolean(el && el.contains(document.activeElement))
  })
}

export const blockHtml = (page: Page, block: number) =>
  page
    .locator("#doc-sheet .ProseMirror > *")
    .nth(block)
    .evaluate((el) => el.innerHTML)

export const inserted = (page: Page) =>
  page
    .locator("#doc-sheet ins.doc-insertion")
    .evaluateAll((els) => els.map((e) => e.textContent))

export const deleted = (page: Page) =>
  page
    .locator("#doc-sheet del.doc-deletion")
    .evaluateAll((els) => els.map((e) => e.textContent))

export async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).click()
}

export async function enableTracking(page: Page) {
  await openTab(page, "Revisione")
  const button = page.getByRole("button", { name: "Revisioni", exact: true })
  await button.click()
  await expect(button).toHaveAttribute("aria-pressed", "true")
}
