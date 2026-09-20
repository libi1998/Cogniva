import { expect, test } from "@playwright/test"
import { openDemo, withEditor } from "./editor"

/**
 * «Riprendi la lettura»: riaprendo un documento lasciato a metà compare un
 * segnalibro che riporta al punto giusto.
 */

const seed = (page: import("@playwright/test").Page, minutesAgo: number) =>
  page.evaluate((minutes) => {
    localStorage.setItem(
      "cogniva.doc.resume",
      JSON.stringify({
        "demo-doc": {
          pos: 300,
          at: Date.now() - minutes * 60 * 1000,
          page: 1,
          total: 388,
        },
      })
    )
  }, minutesAgo)

test("il segnalibro riporta dove si era rimasti", async ({ page }) => {
  await openDemo(page)
  await seed(page, 30)
  await openDemo(page)

  const card = page.getByRole("button", { name: /Riprendi la lettura/ })
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.click()
  expect(
    await withEditor<number>(page, `return editor.state.selection.head`)
  ).toBe(300)
  await expect(card).toBeHidden()
})

test("appena usciti non propone niente", async ({ page }) => {
  await openDemo(page)
  await seed(page, 1)
  await openDemo(page)
  await page.waitForTimeout(2000)
  await expect(
    page.getByRole("button", { name: /Riprendi la lettura/ })
  ).toHaveCount(0)
})

test("leggendo si segna il punto per la prossima volta", async ({ page }) => {
  await openDemo(page)
  await page.evaluate(() => localStorage.removeItem("cogniva.doc.resume"))
  await withEditor(
    page,
    `editor.commands.focus(editor.state.doc.content.size - 1)`
  )
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = localStorage.getItem("cogniva.doc.resume")
          const all = raw
            ? (JSON.parse(raw) as Record<string, { pos: number }>)
            : {}
          return all["demo-doc"]?.pos ?? 0
        }),
      { timeout: 10_000 }
    )
    .toBeGreaterThan(120)
})
