import { inflateSync } from "node:zlib"
import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"
import { openDemo, ribbonButton, withEditor } from "./editor"

/**
 * Sezione Esporta: anteprima delle pagine e file costruiti nell'app, senza la
 * stampa del browser. I PDF si aprono e si controllano byte per byte.
 */

test.setTimeout(120_000)

async function openStudio(page: Page) {
  await page.getByRole("button", { name: "Esporta", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Esporta", { exact: true })).toBeVisible()
  // l'anteprima è pronta quando c'è almeno una pagina disegnata
  await expect(dialog.getByRole("img", { name: "Pagina 1" })).toBeVisible({
    timeout: 60_000,
  })
  return dialog
}

async function downloadBytes(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent("download"), click()])
  const path = await download.path()
  return {
    name: download.suggestedFilename(),
    bytes: await readFile(path),
  }
}

/** Pagine, testo per pagina e immagini di un PDF */
function readPdf(bytes: Buffer) {
  const text = bytes.toString("latin1")
  const pages = text.match(/\/Type \/Page\b(?!s)/g)?.length ?? 0
  const words: string[] = []
  const byPage: string[][] = []
  const images: Buffer[] = []
  const imageWidths: number[] = []
  /** glifi disegnati come vettori, in tutte le pagine */
  let glyphs = 0
  const streams = /<<([^>]*?\/Length (\d+)[^>]*?)>>\nstream\n/g
  for (const match of text.matchAll(streams)) {
    const start = (match.index ?? 0) + match[0].length
    const body = bytes.subarray(start, start + Number(match[2]))
    if (match[1].includes("/Subtype /Image")) {
      if (match[1].includes("/DCTDecode")) images.push(body)
      imageWidths.push(Number(/\/Width (\d+)/.exec(match[1])?.[1] ?? 0))
      continue
    }
    // i disegni dei glifi non sono pagine
    if (match[1].includes("/Subtype /Form")) continue
    if (!match[1].includes("/FlateDecode")) continue
    const content = inflateSync(body).toString("latin1")
    const page: string[] = []
    for (const tj of content.matchAll(/\((.*?)\) Tj/g)) page.push(tj[1].trim())
    glyphs += content.match(/\/G\d+ Do/g)?.length ?? 0
    words.push(...page)
    byPage.push(page)
  }
  return { pages, words, byPage, images, imageWidths, glyphs }
}

test("un documento nuovo è completamente vuoto", async ({ page }) => {
  await page.goto("/")
  // i contatori compaiono quando lo spazio di lavoro è caricato e la pagina risponde
  await expect(
    page.getByRole("button", { name: /^Tutti i file \d/ })
  ).toBeVisible()
  await page.getByRole("button", { name: "Nuovo documento" }).first().click()
  const editor = page.locator("#doc-sheet .ProseMirror")
  await expect(editor).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Nome del file" })
  ).toHaveValue("")
  await expect(editor).toHaveText("")
  // nessun suggerimento scritto nel foglio
  const hints = await editor
    .locator("[data-placeholder]")
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-placeholder")).filter(Boolean)
    )
  expect(hints).toEqual([])
})

test("PDF con anteprima: pagine vere e testo selezionabile", async ({
  page,
}) => {
  await openDemo(page)
  const dialog = await openStudio(page)
  await expect(dialog.getByText(/A4 · 210×297 mm · 600 dpi/)).toBeVisible()

  const { name, bytes } = await downloadBytes(page, () =>
    dialog.getByRole("button", { name: "Esporta PDF" }).click()
  )
  expect(name).toBe("product-brief.pdf")
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
  expect(bytes.subarray(-6).toString()).toContain("%%EOF")
  const pdf = readPdf(bytes)
  expect(pdf.pages).toBeGreaterThan(0)
  expect(pdf.words).toContain("Product")
  expect(pdf.words).toContain("brief")
  // la sezione si chiude a esportazione finita
  await expect(dialog).toBeHidden()
})

test("intervallo di pagine, carta orizzontale e PNG", async ({ page }) => {
  await openDemo(page)
  const dialog = await openStudio(page)

  await dialog.getByRole("button", { name: "Orizzontale" }).click()
  await expect(dialog.getByText(/A4 · 297×210 mm · 600 dpi/)).toBeVisible()
  await expect(dialog.getByRole("img", { name: "Pagina 1" })).toBeVisible({
    timeout: 60_000,
  })

  await dialog.getByRole("button", { name: "Intervallo" }).click()
  await dialog.getByRole("textbox", { name: "Pagine da esportare" }).fill("1")
  const pdf = await downloadBytes(page, () =>
    dialog.getByRole("button", { name: "Esporta PDF" }).click()
  )
  expect(readPdf(pdf.bytes).pages).toBe(1)
  // orizzontale: la pagina è più larga che alta (841,89 × 595,28 punti)
  expect(pdf.bytes.toString("latin1")).toMatch(
    /\/MediaBox \[0 0 841\.\d+ 595\.\d+\]/
  )

  const again = await openStudio(page)
  await again.getByRole("button", { name: /^PNG/ }).click()
  await again.getByRole("button", { name: "Corrente (1)" }).click()
  const png = await downloadBytes(page, () =>
    again.getByRole("button", { name: "Esporta PNG" }).click()
  )
  expect(png.name).toBe("product-brief.png")
  expect(png.bytes.subarray(1, 4).toString()).toBe("PNG")
})

test("Markdown con anteprima del testo", async ({ page }) => {
  await openDemo(page)
  const dialog = await openStudio(page)
  await dialog.getByRole("button", { name: /^Markdown/ }).click()
  await expect(dialog.locator("pre")).toContainText("Product brief")
  const md = await downloadBytes(page, () =>
    dialog.getByRole("button", { name: "Esporta Markdown" }).click()
  )
  expect(md.name).toBe("product-brief.md")
  expect(md.bytes.toString("utf8")).toContain("Product brief")
})

test("board in PDF senza la stampa del browser", async ({ page }) => {
  await page.goto("/board/demo-board")
  await expect(page.getByRole("button", { name: "Esporta" })).toBeVisible()
  const dialog = await openStudio(page)
  const pdf = await downloadBytes(page, () =>
    dialog.getByRole("button", { name: "Esporta PDF" }).click()
  )
  expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-")
  expect(readPdf(pdf.bytes).pages).toBe(1)
})

test("pagine lunghe: interruzioni fra i paragrafi, testo nella pagina giusta, niente ombre", async ({
  page,
}) => {
  await openDemo(page)
  await withEditor(
    page,
    `
    const blocks = []
    for (let i = 1; i <= 14; i++) {
      blocks.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sezione " + i }] })
      blocks.push({ type: "paragraph", content: [{ type: "text", text: ("Paragrafo " + i + ": testo di prova che occupa diverse righe per vedere dove si spezzano le pagine. ").repeat(3) }] })
    }
    editor.chain().focus("end").insertContent(blocks).run()
  `
  )
  // con un formato di carta le pagine le fa l'editor, e i fogli hanno l'ombra a video
  await page.getByRole("tab", { name: "Layout", exact: true }).click()
  await (await ribbonButton(page, "Dimensioni")).click()
  await page.getByRole("menuitem", { name: /^A4/ }).click()

  // se il disegno vettoriale non riesce l'esportazione ripiega sulle
  // immagini e lo dice nella console: il motivo finisce nell'errore
  const warnings: string[] = []
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error")
      warnings.push(message.text())
  })
  const dialog = await openStudio(page)
  // niente da scegliere: 600 dpi e il testo selezionabile ci sono sempre
  await expect(dialog.getByRole("button", { name: /^Bozza/ })).toHaveCount(0)
  await expect(dialog.getByText("Testo selezionabile")).toHaveCount(0)
  const { bytes } = await downloadBytes(page, () =>
    dialog.getByRole("button", { name: "Esporta PDF" }).click()
  )
  const pdf = readPdf(bytes)
  expect(pdf.pages).toBeGreaterThan(2)
  // ogni pagina dopo la prima comincia con un titolo di sezione intero
  for (const words of pdf.byPage.slice(1)) expect(words[0]).toBe("Sezione")
  // un PDF vero: il testo è disegnato a vettori e nessuna pagina è una
  // fotografia del foglio (prima ogni pagina era un'immagine grande quanto
  // lei: a 600 dpi un A4 intero è largo 4961 pixel)
  expect(pdf.glyphs, warnings.join("\n")).toBeGreaterThan(200)
  expect(Math.max(0, ...pdf.imageWidths)).toBeLessThan(4600)
})
