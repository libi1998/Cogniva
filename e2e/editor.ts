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

/**
 * Un comando della barra. Quando la finestra è stretta il suo gruppo può
 * essersi ridotto a un pulsante, come in Word: in quel caso si apre il gruppo
 * e si prende il comando da lì.
 */
export async function ribbonButton(
  page: Page,
  name: string | RegExp,
  { exact = true }: { exact?: boolean } = {}
) {
  // un gruppo lasciato aperto da un comando precedente confonderebbe la ricerca
  await page.keyboard.press("Escape")
  const panel = page.locator('[role="tabpanel"]')
  const direct = panel.getByRole("button", { name, exact }).first()
  if (await direct.isVisible().catch(() => false)) return direct

  const groups = panel.locator("[data-collapsed] button")
  for (let i = 0; i < (await groups.count()); i += 1) {
    await groups.nth(i).click()
    // solo il riquadro aperto: quello che si sta chiudendo resta nel DOM
    // per l'animazione, e il comando lì dentro sparirebbe sotto le mani
    const inside = page
      .locator('[data-slot="popover-content"][data-open]')
      .getByRole("button", { name, exact })
      .first()
    if (await inside.isVisible().catch(() => false)) return inside
    await page.keyboard.press("Escape")
  }
  // nessun gruppo ridotto lo contiene: si restituisce comunque il comando
  // diretto, così l'attesa di Playwright dà un errore leggibile
  return direct
}

export async function enableTracking(page: Page) {
  await openTab(page, "Revisione")
  await (await ribbonButton(page, "Revisioni")).click()
  // dato il comando, un gruppo ridotto si richiude: per leggerne lo stato lo
  // si ricerca, e poi si lascia la barra com'era
  await expect(await ribbonButton(page, "Revisioni")).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await page.keyboard.press("Escape")
}
