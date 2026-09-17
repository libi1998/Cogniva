import { execFileSync } from "node:child_process"
import { expect, test, type Page } from "@playwright/test"
import { caretAfter, enableTracking, openDemo, openTab } from "./editor"

/** Esporta in .docx dalla sezione Esporta e restituisce il percorso del file */
async function exportDocx(page: Page, dir: string) {
  await page.getByRole("button", { name: "Esporta", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /^\.docx/ }).click()
  const download = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "Esporta .docx" }).click()
  const file = `${dir}/documento.docx`
  await (await download).saveAs(file)
  return file
}

const entry = (file: string, name: string) =>
  execFileSync("unzip", ["-p", file, name]).toString("utf8")

const entries = (file: string) =>
  execFileSync("unzip", ["-Z1", file]).toString("utf8").split("\n")

test("la filigrana finisce in Word dietro al testo, su ogni pagina", async ({
  page,
}, info) => {
  await openDemo(page)
  await openTab(page, "Progettazione")
  await page.getByRole("button", { name: "Filigrana" }).click()
  await page
    .getByRole("button", { name: /^BOZZA/ })
    .first()
    .click()
  await expect(page.locator("[data-watermark]").first()).toBeVisible()

  const file = await exportDocx(page, info.outputDir)
  const names = entries(file)
  const headers = names.filter((n) => /^word\/header\d+\.xml$/.test(n))
  expect(headers.length).toBeGreaterThan(0)
  const header = entry(file, headers[0])
  // un'immagine ancorata alla pagina, dietro al documento
  expect(header).toContain('behindDoc="1"')
  expect(header).toContain('relativeFrom="page"')
  expect(names.some((n) => /^word\/media\/.+\.png$/.test(n))).toBe(true)
})

test("le revisioni restano revisioni anche in Word", async ({ page }, info) => {
  await openDemo(page)
  await enableTracking(page)
  await caretAfter(page, 1, "Un ")
  await page.keyboard.type("NUOVO ")
  await caretAfter(page, 1, "NUOVO documento")
  await page.keyboard.press("Backspace")

  const file = await exportDocx(page, info.outputDir)
  const xml = entry(file, "word/document.xml")
  expect(xml).toMatch(/<w:ins [^>]*w:author="[^"]+"/)
  expect(xml).toContain("NUOVO ")
  expect(xml).toMatch(/<w:del [^>]*>[\s\S]*?<w:delText[^>]*>o<\/w:delText>/)
})
