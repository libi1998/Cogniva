import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * Gli strumenti del documento e della board, ciascuno con il caso che prima
 * sbagliava: leggibilità, firma e codice QR, trova e sostituisci, ordina,
 * commenti, riferimenti incrociati, Markdown e appunti della board.
 */

/** Sostituisce il documento con un titolo e dei paragrafi */
async function setParagraphs(page: Page, paragraphs: string[]) {
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Prova" }] },
      ...arg.map((text) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] })),
    ] })`,
    paragraphs
  )
}

const paragraphs = (page: Page) =>
  withEditor<string[]>(
    page,
    `const out = []
     editor.state.doc.forEach((n, _, i) => { if (i > 0) out.push(n.textContent) })
     return out`
  )

async function openAddin(page: Page, name: string) {
  await openTab(page, "Home")
  await (await ribbonButton(page, "Componenti aggiuntivi")).click()
  await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click()
  const pane = page.getByLabel(name, { exact: true })
  await expect(pane).toBeVisible()
  return pane
}

test("Leggibilità: una frase lunga resta una frase sola", async ({ page }) => {
  await openDemo(page)
  // 56 parole in una frase: la lettura ad alta voce la spezza oltre i 260
  // caratteri, e prima anche l'indice la contava come due frasi da 25
  const words = Array.from({ length: 48 }, (_, i) => `parola${i}`).join(" ")
  await setParagraphs(page, [
    `Questa è una frase ${words} che non finisce mai.`,
  ])
  const pane = await openAddin(page, "Leggibilità")
  await pane.getByRole("button", { name: "Ricalcola" }).click()
  await expect(pane.getByText("56 parole")).toBeVisible()
  // il titolo e la frase lunga
  await expect(
    pane.locator("dt", { hasText: /^Frasi$/ }).locator("xpath=..")
  ).toContainText("2")
})

test("Firma: il tratto compare sotto il puntatore", async ({ page }) => {
  await openDemo(page)
  const pane = await openAddin(page, "Firma")
  const canvas = pane.getByTestId("signature-canvas")
  const box = (await canvas.boundingBox())!
  // il riquadro è largo quanto il pannello, non 320 px: si disegna vicino al
  // bordo destro, dove prima il tratto finiva decine di pixel più a sinistra
  const x = box.x + box.width - 20
  await page.mouse.move(x, box.y + 60)
  await page.mouse.down()
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(x, box.y + 60 + i * 6)
  await page.mouse.up()
  const drawnAt = await canvas.evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data
    let min = c.width
    let max = -1
    for (let y = 0; y < c.height; y += 1)
      for (let px = 0; px < c.width; px += 1)
        if (data[(y * c.width + px) * 4 + 3]! > 8) {
          min = Math.min(min, px)
          max = Math.max(max, px)
        }
    const scale = c.getBoundingClientRect().width / c.width
    return ((min + max) / 2) * scale
  })
  expect(Math.abs(drawnAt - (box.width - 20))).toBeLessThan(4)
})

test("Codice QR: svuotato il campo, sparisce l'avviso «troppo lungo»", async ({
  page,
}) => {
  await openDemo(page)
  const pane = await openAddin(page, "Codice QR")
  const field = pane.locator("textarea")
  await field.fill("x".repeat(5000))
  await expect(pane.getByText("troppo lungo")).toBeVisible()
  await field.fill("")
  await expect(pane.getByText("Scrivi il contenuto del codice")).toBeVisible()
})

test("Sostituisci passa alla parola dopo anche se la sostituzione la contiene", async ({
  page,
}) => {
  await openDemo(page)
  await setParagraphs(page, ["il gatto e il gatto nero", "un altro gatto"])
  await page.keyboard.press("ControlOrMeta+f")
  await page.getByPlaceholder("Trova", { exact: true }).fill("gatto")
  await expect(page.getByText("1 di 3")).toBeVisible()
  await page.getByPlaceholder("Sostituisci con").fill("gattone")
  const replace = page.locator("[data-slot=button]", { hasText: "Sostituisci" })
  for (let i = 0; i < 3; i += 1) await replace.first().click()
  // prima si restava su «gattone» e la terza volta diventava «gattonene»
  expect(await paragraphs(page)).toEqual([
    "il gattone e il gattone nero",
    "un altro gattone",
  ])
})

test("Ordina per numero e per data legge i numeri e le date di ogni lingua", async ({
  page,
}) => {
  await openDemo(page)
  const sort = async (by: "number" | "date") => {
    await withEditor(page, `editor.commands.focus(10)`)
    await openTab(page, "Home")
    await (
      await ribbonButton(
        page,
        "Ordina: paragrafi, voci di elenco o righe di tabella"
      )
    ).click()
    const dialog = page.getByRole("dialog", { name: "Ordina testo" })
    await dialog
      .locator("label", { hasText: "Tipo" })
      .locator("select")
      .selectOption(by)
    await dialog.getByRole("button", { name: "Ordina", exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  // prima «3.5» valeva 35 e quello che non era un numero stava a caso
  await setParagraphs(page, ["10", "3.5", "2,25", "n/d", "100"])
  await sort("number")
  expect(await paragraphs(page)).toEqual(["2,25", "3.5", "10", "100", "n/d"])

  // «2025-12-31» era letta come 25/12/2031, «12 marzo 2025» non era una data
  await setParagraphs(page, [
    "2025-12-31",
    "12 marzo 2025",
    "01/02/2024",
    "2024-06-01",
  ])
  await sort("date")
  expect(await paragraphs(page)).toEqual([
    "01/02/2024",
    "2024-06-01",
    "12 marzo 2025",
    "2025-12-31",
  ])
})

test("un commento senza selezione prende la parola giusta anche dopo un campo", async ({
  page,
}) => {
  await openDemo(page)
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Prova" }] },
      { type: "paragraph", content: [
        { type: "field", attrs: { kind: "date" } },
        { type: "text", text: " parola importante" },
      ] },
    ] })
    let pos = editor.state.doc.child(0).nodeSize + 1
    // il cursore dentro «importante»
    pos += 1 + " parola impo".length
    editor.commands.focus(pos)`
  )
  await page.keyboard.press("ControlOrMeta+Alt+m")
  await expect
    .poll(() =>
      withEditor<string[]>(
        page,
        `const out = []
         editor.state.doc.descendants((n) => {
           if (n.isText && n.marks.some((m) => m.type.name === "comment")) out.push(n.text)
         })
         return out`
      )
    )
    .toEqual(["importante"])
})

test("in inglese il riferimento incrociato trova le didascalie «Figure»", async ({
  page,
}) => {
  await page.goto("/en/doc/demo-doc")
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
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Test" }] },
      { type: "paragraph", attrs: { styleId: "caption" }, content: [
        { type: "text", text: "Figure " },
        { type: "field", attrs: { kind: "seq", label: "Figure", format: "arabic", target: "fig1" } },
        { type: "text", text: ": Sales" },
      ] },
      { type: "paragraph", content: [{ type: "text", text: "See " }] },
    ] })
    editor.commands.focus("end")`
  )
  await openTab(page, "Insert")
  await (await ribbonButton(page, "Cross-reference")).click()
  const dialog = page.getByRole("dialog", { name: "Cross-reference" })
  await dialog
    .locator("label", { hasText: "Reference type" })
    .locator("select")
    .selectOption({ label: "Figure" })
  await dialog.getByRole("button", { name: "Figure 1: Sales" }).click()
  await dialog.getByRole("button", { name: "Insert", exact: true }).click()
  await expect(page.locator("#doc-sheet .ProseMirror > p").last()).toHaveText(
    "See Figure 1"
  )
})

test("il Markdown esportato si reimporta uguale", async ({ page }, info) => {
  await openDemo(page)
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Rapporto" }] },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduzione" }] },
      { type: "paragraph", content: [{ type: "text", text: "1. non è un elenco" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Dettagli" }] },
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1" }] },
      { type: "paragraph", content: [{ type: "text", text: "Fine." }] },
    ] })`
  )
  await page.getByRole("button", { name: "Esporta", exact: true }).click()
  const studio = page.getByRole("dialog")
  await studio.getByRole("button", { name: /^Markdown/ }).click()
  const download = page.waitForEvent("download")
  await studio.getByRole("button", { name: "Esporta Markdown" }).click()
  const file = info.outputPath("rapporto.md")
  await (await download).saveAs(file)
  const markdown = readFileSync(file, "utf8")
  // «\1.» mostrava la barra: si protegge il punto
  expect(markdown).toContain("1\\. non è un elenco")

  await page.goto("/it")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Importa" }).click()
  await page.getByRole("menuitem", { name: /Word, Markdown/ }).click()
  await (await chooser).setFiles(file)
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible({
    timeout: 60_000,
  })
  await page.waitForFunction(() =>
    Boolean(
      (
        document.querySelector("#doc-sheet .ProseMirror") as unknown as {
          editor?: unknown
        } | null
      )?.editor
    )
  )
  // prima ogni giro abbassava i titoli di un livello, e il codice prendeva
  // una riga vuota in fondo
  expect(
    await withEditor<string[]>(
      page,
      `const out = []
       editor.state.doc.forEach((n) => out.push(n.type.name + (n.attrs.level ?? "") + ":" + n.textContent))
       return out`
    )
  ).toEqual([
    "docTitle:Rapporto",
    "heading1:Introduzione",
    "paragraph:1. non è un elenco",
    "heading2:Dettagli",
    "codeBlock:const x = 1",
    "paragraph:Fine.",
  ])
})

test("board: un testo copiato da un'altra app si incolla come testo", async ({
  page,
}) => {
  await page.goto("/it/board/demo-board")
  const node = page.locator('[data-node-id="n2"]')
  await expect(node).toBeVisible()
  await node.click()
  await page.keyboard.press("ControlOrMeta+c")
  // dopo, gli appunti ricevono un testo qualunque
  await page.evaluate(() => navigator.clipboard.writeText("testo da fuori"))
  const count = () => page.locator("[data-node-id]").count()
  const before = await count()
  await page.mouse.move(700, 700)
  await page.keyboard.press("ControlOrMeta+v")
  await expect.poll(count).toBe(before + 1)
  // prima tornava la copia degli elementi di prima
  await expect(
    page.locator("[data-node-id]", { hasText: "testo da fuori" })
  ).toBeVisible()
})

test("Disegno: una passata di gomma si annulla in un passo solo", async ({
  page,
}) => {
  await openDemo(page)
  await openTab(page, "Disegno")
  await page.locator('[role="tabpanel"] button[title*=" px"]').first().click()
  const sheet = (await page.locator("#doc-sheet").boundingBox())!
  const x = sheet.x + 150
  const y = sheet.y + 300
  for (let k = 0; k < 3; k += 1) {
    await page.mouse.move(x + k * 60, y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i += 1)
      await page.mouse.move(x + k * 60, y + i * 10)
    await page.mouse.up()
  }
  const strokes = page.locator("svg[data-ink] path")
  await expect(strokes).toHaveCount(3)

  await (await ribbonButton(page, "Gomma")).click()
  await page.mouse.move(x - 20, y + 40)
  await page.mouse.down()
  for (let i = 1; i <= 20; i += 1)
    await page.mouse.move(x - 20 + i * 10, y + 40)
  await page.mouse.up()
  await expect(strokes).toHaveCount(0)

  // prima ogni tratto cancellato era un passo: ne tornava uno alla volta
  await (await ribbonButton(page, "Annulla tratto")).click()
  await expect(strokes).toHaveCount(3)
})

test("in inglese i decimali si scrivono col punto", async ({ page }) => {
  await page.goto("/en/doc/demo-doc")
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
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Test" }] },
      { type: "paragraph", content: [{ type: "text", text: "small", marks: [{ type: "textStyle", attrs: { fontSize: "10.5pt" } }] }] },
    ] })
    editor.chain().focus().setTextSelection({ from: 7, to: 10 }).run()`
  )
  await openTab(page, "Home")
  // prima «10,5» anche in inglese
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue(
    "10.5"
  )
})

test("board: i connettori dentro una sezione si cliccano", async ({ page }) => {
  await page.goto("/it/board/demo-board")
  await expect(page.locator('[data-node-id="n2"]')).toBeVisible()
  // il punto a metà del connettore e1, che sta dentro la sezione sec1
  const mid = await page.evaluate(() => {
    const path = document.querySelector<SVGPathElement>(
      'path[data-edge-id="e1"]'
    )!
    const point = path.getPointAtLength(path.getTotalLength() / 2)
    const m = path.getScreenCTM()!
    return {
      x: point.x * m.a + point.y * m.c + m.e,
      y: point.x * m.b + point.y * m.d + m.f,
    }
  })
  // prima la sezione, disegnata sopra, si prendeva il clic
  await page.mouse.click(mid.x, mid.y, { button: "right" })
  await expect(
    page.getByRole("menuitem", { name: "Inverti direzione" })
  ).toBeVisible()
  await page.keyboard.press("Escape")

  // doppio clic: l'etichetta si scrive, ⎋ la annulla, Invio la salva
  await page.mouse.dblclick(mid.x, mid.y)
  const label = page.locator("foreignObject input")
  await expect(label).toBeVisible()
  await label.fill("sì")
  await page.keyboard.press("Enter")
  await expect(page.locator('span[data-edge-id="e1"]')).toHaveText("sì")
})

test("board: quello che si cambia dal pannello Stile si annulla", async ({
  page,
}) => {
  await page.goto("/it/board/demo-board")
  const node = page.locator('[data-node-id="n4"]')
  await expect(node).toBeVisible()
  await node.click()
  const text = () => node.innerText()
  await expect.poll(text).toBe("Login")

  // un testo scritto nel pannello: prima non entrava nella cronologia, e
  // «Annulla» saltava all'ultima modifica fatta sulla board
  await page.getByPlaceholder("Testo…").fill("Accesso")
  await expect.poll(text).toBe("Accesso")
  await page.locator('[data-node-id="n6"]').click()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(text).toBe("Login")

  // un cursore: la foto per «Annulla» si scattava a modifica finita, e il
  // primo «Annulla» non faceva niente
  await node.click()
  const size = () =>
    node.evaluate((el) => getComputedStyle(el.querySelector("span")!).fontSize)
  const before = await size()
  const slider = page.getByRole("slider", { name: "Dimensione" })
  await slider.focus()
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowRight")
  await expect.poll(size).not.toBe(before)
  await page.locator('[data-node-id="n6"]').click()
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(size).toBe(before)
})

test("Carattere: la spaziatura si imposta dalla finestra e resta sulla selezione", async ({
  page,
}) => {
  await openDemo(page)
  await setParagraphs(page, ["Un paragrafo abbastanza lungo da selezionare"])
  await withEditor(
    page,
    `editor.chain().focus().setTextSelection({ from: 8, to: 20 }).run()`
  )
  await openTab(page, "Home")
  await page
    .getByRole("button", { name: "Carattere: spaziatura e posizione…" })
    .click()
  const dialog = page.getByRole("dialog", { name: "Carattere" })
  await dialog
    .getByLabel("Spaziatura", { exact: true })
    .selectOption("expanded")
  await dialog.getByLabel("Di", { exact: true }).fill("1,5")
  await dialog.getByRole("button", { name: "OK" }).click()
  await expect(dialog).toBeHidden()
  // 1,5 pt sono 2 px; la selezione resta quella di prima
  expect(
    await withEditor<[string | null, number, number]>(
      page,
      `const m = editor.state.doc.resolve(9).marks().find((m) => m.type.name === "textStyle")
       return [m?.attrs.letterSpacing ?? null, editor.state.selection.from, editor.state.selection.to]`
    )
  ).toEqual(["2px", 8, 20])
})

test("Layout: il rientro si scrive nella casella, non nel documento", async ({
  page,
}) => {
  await openDemo(page)
  await setParagraphs(page, ["Testo del paragrafo"])
  await caretAfter(page, 1, "Te")
  await openTab(page, "Layout")
  const field = page.getByLabel("A sinistra", { exact: true })
  await field.click()
  // la casella seleziona il suo testo al fotogramma dopo il fuoco
  await field.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done))
      )
  )
  await page.keyboard.type("1,5", { delay: 30 })
  // prima dopo la prima cifra il fuoco tornava al testo: «,5» finiva nel
  // documento («Te,5sto del paragrafo»)
  await expect(field).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(field).toBeFocused()
  expect(await paragraphs(page)).toEqual(["Testo del paragrafo"])
  expect(
    await withEditor<number>(
      page,
      "return editor.state.doc.child(1).attrs.indent"
    )
  ).toBe(Math.round((2 * 96) / 2.54))

  // Invio torna al testo, dove si era
  await page.keyboard.press("Enter")
  await page.keyboard.type("X")
  expect(await paragraphs(page)).toEqual(["TeXsto del paragrafo"])
})

test("Copia formato non toglie commenti e revisioni", async ({ page }) => {
  await openDemo(page)
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Prova" }] },
      { type: "paragraph", content: [
        { type: "text", text: "uno", marks: [{ type: "bold" }] },
        { type: "text", text: " " },
        { type: "text", text: "due", marks: [{ type: "comment", attrs: { id: "c1" } }] },
        { type: "text", text: " " },
        { type: "text", text: "tre", marks: [{ type: "deletion", attrs: { author: "Ada", date: 1 } }] },
      ] },
    ] })
    editor.chain().focus().setTextSelection({ from: 8, to: 11 }).run()`
  )
  await openTab(page, "Home")
  await (await ribbonButton(page, "Copia formato")).click()
  const marks = (from: number) =>
    withEditor<string[]>(
      page,
      `return editor.state.doc.resolve(${from}).marks().map((m) => m.type.name).sort()`
    )
  // si dipinge su «due», che ha un commento, e su «tre», eliminata con le
  // revisioni: prima il commento perdeva il suo testo e l'eliminazione
  // spariva, facendo ricomparire la parola
  for (const [from, to] of [
    [12, 15],
    [16, 19],
  ]) {
    await withEditor(
      page,
      `editor.chain().setTextSelection({ from: ${from}, to: ${to} }).run()`
    )
    await page.locator("#doc-sheet .ProseMirror").dispatchEvent("mouseup")
    if (from === 12) await (await ribbonButton(page, "Copia formato")).click()
  }
  expect(await marks(13)).toEqual(["bold", "comment"])
  expect(await marks(17)).toEqual(["bold", "deletion"])
})

test("Cancella formattazione lascia commenti, revisioni e collegamenti", async ({
  page,
}) => {
  await openDemo(page)
  await withEditor(
    page,
    `editor.commands.setContent({ type: "doc", content: [
      { type: "docTitle", content: [{ type: "text", text: "Prova" }] },
      { type: "paragraph", content: [
        { type: "text", text: "uno", marks: [{ type: "bold" }, { type: "comment", attrs: { id: "c1" } }] },
        { type: "text", text: " " },
        { type: "text", text: "due", marks: [{ type: "italic" }, { type: "deletion", attrs: { author: "Ada", date: 1 } }] },
        { type: "text", text: " " },
        { type: "text", text: "tre", marks: [{ type: "underline" }, { type: "link", attrs: { href: "https://example.com" } }] },
      ] },
    ] })
    editor.chain().focus().setTextSelection({ from: 8, to: 19 }).run()`
  )
  await openTab(page, "Home")
  await (await ribbonButton(page, "Cancella tutta la formattazione")).click()
  const marks = (at: number) =>
    withEditor<string[]>(
      page,
      `return editor.state.doc.resolve(${at}).marks().map((m) => m.type.name).sort()`
    )
  // la formattazione se ne va, il resto no
  expect(await marks(9)).toEqual(["comment"])
  expect(await marks(13)).toEqual(["deletion"])
  expect(await marks(17)).toEqual(["link"])
})

test("intestazione e piè di pagina si scrivono sul foglio", async ({
  page,
}) => {
  await openDemo(page)
  // su fogli veri, come un documento nuovo
  await openTab(page, "Layout")
  await (await ribbonButton(page, "Dimensioni")).click()
  await page.getByRole("menuitem", { name: /^A4/ }).click()

  await openTab(page, "Inserisci")
  await (await ribbonButton(page, "Intestazione")).click()
  await page.getByRole("menuitem", { name: "Modifica intestazione…" }).click()
  const left = page.getByRole("textbox", { name: "Intestazione, a sinistra" })
  await expect(left).toBeFocused()
  await page.keyboard.type("Relazione", { delay: 12 })
  await page.keyboard.press("Escape")
  await expect(left).toBeHidden()
  await expect(page.locator("[data-band]").first()).toContainText("Relazione")

  // doppio clic nel margine alto: si riapre, con il cursore al centro
  const sheet = await page.locator("#doc-sheet").boundingBox()
  if (!sheet) throw new Error("foglio non trovato")
  await page.mouse.dblclick(sheet.x + sheet.width / 2, sheet.y + 24)
  const center = page.getByRole("textbox", { name: "Intestazione, al centro" })
  await expect(center).toBeFocused()
  await page
    .locator("[data-band-editor]")
    .getByRole("button", { name: "Numero di pagina" })
    .click()
  await expect(center).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-band]").first()).toContainText("1")
})

test("forme: piene, davanti al testo, con la loro scheda", async ({ page }) => {
  await openDemo(page)
  await caretAfter(page, 1, "clic destro.")
  await openTab(page, "Inserisci")
  await (await ribbonButton(page, "Forme")).click()
  await page.getByRole("button", { name: "Rettangolo", exact: true }).click()

  const shape = () =>
    withEditor<Record<string, unknown> | null>(
      page,
      `let out = null
       editor.state.doc.descendants((n) => { if (!out && n.attrs.shape) out = n.attrs })
       return out`
    )
  // un colore pieno, non il riempimento tenue di prima
  await expect.poll(async () => (await shape())?.wrap).toBe("front")
  const first = await shape()
  expect(first?.shape).toBe("rect")
  expect(String(first?.fill)).toMatch(/^#[0-9a-f]{6}$/i)
  expect(first?.fill).not.toBe("#ffffff")

  // la scheda della forma si apre da sola; il riempimento cambia il disegno
  await expect(
    page.getByRole("tab", { name: "Formato forma" })
  ).toHaveAttribute("aria-selected", "true")
  await (await ribbonButton(page, "Riempimento")).click()
  await page.getByRole("button", { name: "Bianco", exact: true }).click()
  await expect.poll(async () => (await shape())?.fill).toBe("#ffffff")
  expect(String((await shape())?.src)).toContain(encodeURIComponent("#ffffff"))
})
