import { expect, test, type Page } from "@playwright/test"

/**
 * La home: si scelgono più file e si lavora su tutti insieme, invece che
 * uno per uno dal menu di ciascuno.
 */

const count = async (page: Page, name: RegExp) => {
  const label = await page.getByRole("button", { name }).first().textContent()
  return Number(label?.match(/(\d+)\s*$/)?.[1] ?? NaN)
}

test.beforeEach(async ({ page }) => {
  await page.goto("/it")
  await expect(
    page.getByRole("button", { name: /^Tutti i file \d/ })
  ).toBeVisible()
})

test("la home non ha più l'avviso sul trascinamento né «Importa da Word»", async ({
  page,
}) => {
  await expect(page.getByText(/Trascina qui un file Word/)).toHaveCount(0)
  await expect(page.getByText("Importa da Word")).toHaveCount(0)
})

test("più file nel cestino in un colpo solo, e si annulla", async ({
  page,
}) => {
  const all = await count(page, /^Tutti i file \d/)
  const inTrash = await count(page, /^Cestino/)
  const boxes = page.getByRole("checkbox", { name: /^Seleziona / })

  // la casella del primo, poi Maiuscole + clic sul terzo: tre file
  await boxes.nth(0).click()
  await boxes.nth(2).click({ modifiers: ["Shift"] })
  const bar = page.getByRole("toolbar", { name: "File selezionati" })
  await expect(bar).toContainText("3 selezionati")
  await expect(boxes.nth(1)).toHaveAttribute("aria-checked", "true")

  await bar.getByRole("button", { name: "Sposta nel cestino" }).click()
  await expect(page.getByText("3 file spostati nel cestino")).toBeVisible()
  await expect(bar).toBeHidden()
  await expect.poll(() => count(page, /^Tutti i file \d/)).toBe(all - 3)
  await expect.poll(() => count(page, /^Cestino/)).toBe(inTrash + 3)

  await page.getByRole("button", { name: "Annulla", exact: true }).click()
  await expect.poll(() => count(page, /^Tutti i file \d/)).toBe(all)
})

test("con «Seleziona» un clic sceglie invece di aprire; ⌘A, preferiti ed Esc", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Seleziona", exact: true }).click()
  const bar = page.getByRole("toolbar", { name: "File selezionati" })
  await expect(bar).toContainText("Scegli i file")

  // la card è un link: mentre si sceglie non apre il file
  await page.getByRole("link", { name: /Product brief/ }).click()
  await expect(page).toHaveURL(/\/it\/?$/)
  await expect(bar).toContainText("1 selezionato")

  await page.keyboard.press("ControlOrMeta+a")
  const all = await count(page, /^Tutti i file \d/)
  await expect(bar).toContainText(`${all} selezionati`)

  await bar.getByRole("button", { name: "Aggiungi ai preferiti" }).click()
  await expect.poll(() => count(page, /^Preferiti/)).toBe(all)
  await bar.getByRole("button", { name: "Rimuovi dai preferiti" }).click()
  await expect.poll(() => count(page, /^Preferiti/)).toBe(0)

  await page.keyboard.press("Escape")
  await expect(bar).toBeHidden()
  // fuori dalla selezione il clic torna ad aprire
  await page.getByRole("link", { name: /Product brief/ }).click()
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible()
})

test("nel cestino: ripristina più file insieme", async ({ page }) => {
  const boxes = page.getByRole("checkbox", { name: /^Seleziona / })
  await boxes.nth(0).click()
  await boxes.nth(1).click()
  const bar = page.getByRole("toolbar", { name: "File selezionati" })
  await bar.getByRole("button", { name: "Sposta nel cestino" }).click()

  await page
    .getByRole("button", { name: /^Cestino/ })
    .first()
    .click()
  await page.keyboard.press("ControlOrMeta+a")
  await expect(bar).toContainText("2 selezionati")
  await bar.getByRole("button", { name: "Ripristina" }).click()
  await expect(page.getByText("2 file ripristinati")).toBeVisible()
  await expect.poll(() => count(page, /^Cestino/)).toBe(0)
})
