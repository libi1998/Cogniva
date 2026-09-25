import { execFileSync } from "node:child_process"
import { expect, test, type Page } from "@playwright/test"
import { openDemo, openTab, ribbonButton } from "./editor"

/**
 * Intestazione e piè di pagina a testo libero, come in Word: si scrivono sul
 * foglio con righe, tabulazioni (al centro e a destra), campi e immagini, e
 * arrivano uguali nel .docx. Le intestazioni in tre parti dei documenti di
 * prima si leggono ancora.
 */

/** un PNG di prova 80×40, disegnato nel browser */
async function logo(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas")
    c.width = 80
    c.height = 40
    const g = c.getContext("2d")!
    g.fillStyle = "#4f46e5"
    g.fillRect(0, 0, 80, 40)
    return c.toDataURL("image/png").split(",")[1]
  })
  return Buffer.from(data, "base64")
}

async function onA4(page: Page) {
  await openDemo(page)
  await openTab(page, "Layout")
  await (await ribbonButton(page, "Dimensioni")).click()
  await page.getByRole("menuitem", { name: /^A4/ }).click()
}

async function editHeader(page: Page) {
  await openTab(page, "Inserisci")
  await (await ribbonButton(page, "Intestazione")).click()
  await page.getByRole("menuitem", { name: "Modifica intestazione…" }).click()
  const header = page.getByRole("textbox", { name: "Intestazione" })
  await expect(header).toBeFocused()
  return header
}

const tools = (page: Page) =>
  page.getByRole("toolbar", { name: "Strumenti dell'intestazione" })

test("si scrive sul foglio come testo libero: righe, tabulazioni e campi", async ({
  page,
}) => {
  await onA4(page)
  const header = await editHeader(page)
  // gli spazi restano: prima ogni spazio battuto spariva
  await page.keyboard.type("Relazione di fine anno", { delay: 10 })
  // Tab porta al centro della riga, come le tabulazioni di Word
  await page.keyboard.press("Tab")
  await tools(page).getByRole("button", { name: /Campi/ }).click()
  await tools(page).getByRole("button", { name: "Numero di pagina" }).click()
  await expect(header).toBeFocused()
  // Invio va a capo: una seconda riga, allineata a destra
  await page.keyboard.press("Enter")
  await page.keyboard.type("Seconda riga", { delay: 10 })
  await tools(page).getByRole("button", { name: "Allinea a destra" }).click()
  await page.keyboard.press("Escape")
  await expect(header).toBeHidden()

  const band = page.locator('[data-band-kind="header"]').first()
  await expect(band).toContainText("Relazione di fine anno")
  await expect(band).toContainText("Seconda riga")
  // il numero di pagina sta al centro della riga, la seconda riga a destra
  const geometry = await band.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const [first, second] = Array.from(el.children) as HTMLElement[]
    const center = first.children[1].getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(second)
    const right = range.getBoundingClientRect()
    return {
      middle: box.left + box.width / 2,
      number: center.left + center.width / 2,
      text: first.children[1].textContent,
      gap: box.right - right.right,
    }
  })
  expect(geometry.text).toBe("1")
  expect(Math.abs(geometry.middle - geometry.number)).toBeLessThan(3)
  expect(geometry.gap).toBeLessThan(3)

  // doppio clic nel margine alto: si riapre con quello che c'era
  const sheet = await page.locator("#doc-sheet").boundingBox()
  if (!sheet) throw new Error("foglio non trovato")
  await page.mouse.dblclick(sheet.x + sheet.width / 2, sheet.y + 20)
  await expect(header).toBeFocused()
  await expect(header).toContainText("Relazione di fine anno")
  await expect(header).toContainText("Seconda riga")
})

test("un logo nell'intestazione sposta il testo e va nel .docx", async ({
  page,
}, info) => {
  await onA4(page)
  await editHeader(page)
  await page.keyboard.type("Acme", { delay: 10 })
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    tools(page).getByRole("button", { name: "Immagine", exact: true }).click(),
  ])
  await chooser.setFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: await logo(page),
  })
  const image = page.locator(".doc-band-editor img.doc-band-img")
  await expect(image).toBeVisible()
  // più alta: tre volte «Immagine più grande»
  await image.click()
  const bigger = tools(page).getByRole("button", {
    name: "Immagine più grande",
  })
  await expect(bigger).toBeVisible()
  for (let i = 0; i < 3; i += 1) await bigger.click()
  await page.keyboard.press("Escape")

  const band = page.locator('[data-band-kind="header"]').first()
  await expect(band.locator("img")).toBeVisible()
  // il testo del documento comincia sotto l'intestazione, come in Word
  const title = page.locator("#doc-sheet .ProseMirror.doc-prose > *").first()
  await expect
    .poll(async () => {
      const b = await band.boundingBox()
      const t = await title.boundingBox()
      return b && t ? t.y - (b.y + b.height) : -1
    })
    .toBeGreaterThan(0)

  // nel .docx: il testo e l'immagine nell'intestazione
  await page.getByRole("button", { name: "Esporta", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /^\.docx/ }).click()
  const download = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "Esporta .docx" }).click()
  const file = `${info.outputDir}/intestazione.docx`
  await (await download).saveAs(file)
  const names = execFileSync("unzip", ["-Z1", file])
    .toString("utf8")
    .split("\n")
  const headers = names.filter((n) => /^word\/header\d+\.xml$/.test(n))
  const xml = headers
    .map((n) => execFileSync("unzip", ["-p", file, n]).toString("utf8"))
    .join("\n")
  expect(xml).toContain("Acme")
  expect(xml).toContain("<pic:pic")
  expect(names.some((n) => /^word\/media\/.+\.png$/.test(n))).toBe(true)
})

test("un'intestazione in tre parti di prima si legge ancora", async ({
  page,
}) => {
  await onA4(page)
  // un modello del menu, che scrive la riga nel vecchio formato
  await openTab(page, "Inserisci")
  await (await ribbonButton(page, "Intestazione")).click()
  await page.getByRole("menuitem", { name: /^Autore e data/ }).click()
  const band = page.locator('[data-band-kind="header"]').first()
  // a sinistra l'autore, a destra la data: due parti della stessa riga
  const parts = await band.evaluate((el) => {
    const row = el.firstElementChild as HTMLElement
    return {
      grid: getComputedStyle(row).display,
      right: (row.children[2] as HTMLElement | undefined)?.textContent ?? "",
    }
  })
  expect(parts.grid).toBe("grid")
  expect(parts.right).toMatch(/\d{4}/)

  // si modifica come testo libero: le tabulazioni ci sono già
  const header = await editHeader(page)
  await expect(header.locator(".doc-band-tab")).toHaveCount(2)
  await page.keyboard.press("End")
  await page.keyboard.type(" · bozza", { delay: 10 })
  await page.keyboard.press("Escape")
  await expect(band).toContainText("· bozza")
})
