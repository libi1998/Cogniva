import { expect, test, type Page } from "@playwright/test"
import { openTab, ribbonButton, withEditor } from "./editor"

/**
 * Tabelle ridimensionabili, colore degli elenchi, menu dei colori e righello:
 * i ritocchi chiesti provando l'app vera.
 */

const CM = 96 / 2.54

async function newDocument(page: Page) {
  await page.goto("/it")
  await page.getByRole("button", { name: "Nuovo documento" }).first().click()
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

async function withTable(page: Page) {
  await newDocument(page)
  await withEditor(
    page,
    `editor.chain().focus().insertContent("Prima").insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()`
  )
  const table = page.locator("#doc-sheet table").first()
  await expect(table).toBeVisible()
  return table
}

test("tabella: si stringe dalla maniglia a destra e si allunga da quella in basso", async ({
  page,
}) => {
  const table = await withTable(page)
  const before = (await table.boundingBox())!
  await page.mouse.move(before.x + 40, before.y + 20)
  const right = page.locator('[data-table-resize="width"]')
  await expect(right).toBeVisible()
  const r = (await right.boundingBox())!
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await page.mouse.down()
  await page.mouse.move(r.x + r.width / 2 - 100, r.y + r.height / 2, {
    steps: 4,
  })
  await page.mouse.move(r.x + r.width / 2 - 200, r.y + r.height / 2, {
    steps: 4,
  })
  // mentre si trascina, la misura nuova in centimetri
  await expect(page.locator(".doc-table-resize-preview")).toContainText("cm")
  await page.mouse.up()
  await expect
    .poll(async () => Math.round((await table.boundingBox())!.width))
    .toBe(Math.round(before.width - 200))
  // le colonne restano uguali fra loro
  const widths = await table
    .locator("tr")
    .first()
    .locator("th, td")
    .evaluateAll((cells) => cells.map((c) => c.getBoundingClientRect().width))
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2)

  const bottom = page.locator('[data-table-resize="height"]')
  const b = (await bottom.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 6 })
  await page.mouse.up()
  await expect
    .poll(async () => Math.round((await table.boundingBox())!.height))
    .toBeGreaterThan(Math.round(before.height + 50))

  // un Annulla per volta: prima l'altezza, poi la larghezza
  await page.keyboard.press("Control+z")
  await expect
    .poll(async () => Math.round((await table.boundingBox())!.height))
    .toBe(Math.round(before.height))
  await page.keyboard.press("Control+z")
  await expect
    .poll(async () => Math.round((await table.boundingBox())!.width))
    .toBe(Math.round(before.width))
})

test("tabella: Larghezza e Altezza nella scheda Tabella, in centimetri", async ({
  page,
}) => {
  const table = await withTable(page)
  await table.locator("td").first().click()
  await openTab(page, "Tabella")
  const width = page
    .getByRole("group", { name: "Dimensioni tabella" })
    .getByRole("textbox", { name: "Larghezza" })
  await width.click()
  // la misura si applica con Invio, non a ogni cifra
  await page.keyboard.type("10")
  await page.keyboard.press("Enter")
  await expect
    .poll(async () => ((await table.boundingBox())!.width / CM).toFixed(2))
    .toBe("10.00")
  // e un Annulla torna alla tabella larga quanto il foglio
  await page.keyboard.press("Control+z")
  await expect
    .poll(async () => (await table.boundingBox())!.width / CM)
    .toBeGreaterThan(15)

  const height = page
    .getByRole("group", { name: "Dimensioni tabella" })
    .getByRole("textbox", { name: "Altezza" })
  await height.click()
  await page.keyboard.type("6")
  await page.keyboard.press("Enter")
  await expect
    .poll(async () => ((await table.boundingBox())!.height / CM).toFixed(1))
    .toBe("6.0")
})

test("Sfondo delle celle: i colori grandi come negli altri menu", async ({
  page,
}) => {
  const table = await withTable(page)
  await table.locator("td").first().click()
  await openTab(page, "Tabella")
  await (await ribbonButton(page, "Sfondo")).click()
  const swatch = page.getByRole("button", { name: "Giallo", exact: true })
  await expect(swatch).toBeVisible()
  const box = (await swatch.boundingBox())!
  // prima erano pochi pixel: il menu a larghezza automatica li schiacciava
  expect(box.width).toBeGreaterThan(20)
  await swatch.click()
  await expect(table.locator("td[data-bg]").first()).toBeVisible()
})

test("elenchi: il colore dei punti e dei numeri", async ({ page }) => {
  await newDocument(page)
  await withEditor(page, `editor.chain().focus().insertContent("Titolo").run()`)
  await page.keyboard.press("Enter")
  await page.keyboard.type("Primo punto", { delay: 5 })
  await openTab(page, "Home")
  // fuori da un elenco il colore lo crea già colorato
  await page
    .getByRole("button", { name: "Elenco puntato: altre opzioni" })
    .click()
  await page.getByRole("button", { name: "Magenta", exact: true }).click()
  const marker = () =>
    page.evaluate(() => {
      const li = document.querySelector("#doc-sheet .doc-prose li")
      return li ? getComputedStyle(li, "::marker").color : null
    })
  await expect.poll(marker).toBe("rgb(229, 57, 129)")
  // «Automatico» torna al grigio dei punti
  await page
    .getByRole("button", { name: "Elenco puntato: altre opzioni" })
    .click()
  await page.getByRole("button", { name: "Automatico", exact: true }).click()
  await expect.poll(marker).not.toBe("rgb(229, 57, 129)")
})

test("righello verticale: uno per pagina, con i numeri dentro", async ({
  page,
}) => {
  await newDocument(page)
  await withEditor(
    page,
    `editor.chain().focus().insertContent(Array.from({ length: 70 }, (_, i) => ({ type: "paragraph", content: [{ type: "text", text: "Riga di prova " + (i + 1) }] }))).run()`
  )
  const tracks = page.locator("#doc-ruler-y [data-ruler]")
  await expect.poll(() => tracks.count()).toBeGreaterThan(1)
  const pages = await tracks.count()
  // ogni foglio ha il suo: i numeri ripartono dal margine e restano dentro
  for (let i = 0; i < pages; i += 1) {
    const outside = await tracks.nth(i).evaluate((track) => {
      const box = track.getBoundingClientRect()
      return Array.from(track.querySelectorAll("span"))
        .filter((s) => s.textContent && /^\d+$/.test(s.textContent))
        .filter((s) => {
          const r = s.getBoundingClientRect()
          return r.top < box.top || r.bottom > box.bottom
        }).length
    })
    expect(outside).toBe(0)
    // mai oltre la lunghezza di una pagina A4 (29,7 cm)
    const labels = await tracks
      .nth(i)
      .locator("span")
      .evaluateAll((spans) =>
        spans.map((s) => Number(s.textContent)).filter((n) => n > 0)
      )
    expect(Math.max(...labels)).toBeLessThan(30)
  }
  // e in orizzontale nessun numero oltre il bordo
  const past = await page.locator("#doc-ruler").evaluate((ruler) => {
    const box = ruler.getBoundingClientRect()
    return Array.from(ruler.querySelectorAll("span")).filter((s) => {
      const r = s.getBoundingClientRect()
      return s.textContent && (r.left < box.left || r.right > box.right)
    }).length
  })
  expect(past).toBe(0)
})
