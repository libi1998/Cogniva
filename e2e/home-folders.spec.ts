import { expect, test, type Page } from "@playwright/test"

/**
 * Le cartelle della home: si creano, ci si spostano più file insieme (dal
 * menu, dalla barra della selezione o trascinandoli), si rinominano e si
 * eliminano senza perdere i file.
 */

const count = async (page: Page, name: RegExp) => {
  const label = await page.getByRole("button", { name }).first().textContent()
  return Number(label?.match(/(\d+)\s*$/)?.[1] ?? NaN)
}

const folderDialog = (page: Page) => page.getByRole("dialog")

test.beforeEach(async ({ page }) => {
  await page.goto("/it")
  await expect(
    page.getByRole("button", { name: /^Tutti i file \d/ })
  ).toBeVisible()
})

test("più file in una cartella nuova, poi rinominata ed eliminata", async ({
  page,
}) => {
  const all = await count(page, /^Tutti i file \d/)
  const boxes = page.getByRole("checkbox", { name: /^Seleziona / })
  await boxes.nth(0).click()
  await boxes.nth(1).click()
  const bar = page.getByRole("toolbar", { name: "File selezionati" })
  await bar.getByRole("button", { name: "Sposta in" }).click()
  await page.getByRole("menuitem", { name: "Nuova cartella…" }).click()
  await expect(folderDialog(page)).toContainText(
    "I 2 file andranno nella cartella nuova."
  )
  await page.getByLabel("Nome della cartella").fill("Lavoro")
  await page.getByRole("button", { name: "Crea" }).click()
  await expect(page.getByText("2 file spostati in «Lavoro»")).toBeVisible()

  // la cartella nella barra laterale, con i suoi file
  const folder = page.getByRole("button", { name: /^Lavoro 2$/ })
  await expect(folder).toBeVisible()
  await folder.click()
  await expect(page.getByRole("checkbox", { name: /^Seleziona / })).toHaveCount(
    2
  )
  // «Tutti i file» li conta ancora tutti
  expect(await count(page, /^Tutti i file \d/)).toBe(all)

  // rinominata, i file la seguono
  await page.getByRole("button", { name: "Rinomina", exact: true }).click()
  await page.getByLabel("Nome della cartella").fill("Clienti")
  await page.getByRole("button", { name: "Salva" }).click()
  await expect(page.getByRole("button", { name: /^Clienti 2$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Lavoro/ })).toHaveCount(0)

  // eliminata: i file restano, fuori da ogni cartella
  await page.getByRole("button", { name: "Elimina cartella" }).click()
  await expect(page.getByText("Cartella «Clienti» eliminata")).toBeVisible()
  await expect(page.getByRole("button", { name: /^Clienti/ })).toHaveCount(0)
  expect(await count(page, /^Tutti i file \d/)).toBe(all)
})

test("dal menu di un file e trascinando sulla cartella", async ({ page }) => {
  // una cartella vuota dalla barra laterale
  await page.getByRole("button", { name: "Nuova cartella" }).first().click()
  await page.getByLabel("Nome della cartella").fill("Archivio")
  await page.getByRole("button", { name: "Crea" }).click()
  const folder = page.getByRole("button", { name: /^Archivio 0$/ })
  await expect(folder).toBeVisible()

  // dal menu del file
  const card = page.getByRole("link", { name: /Product brief/ })
  await card.hover()
  await page.getByRole("button", { name: "Azioni per Product brief" }).click()
  await page.getByRole("menuitem", { name: "Sposta in" }).click()
  await page.getByRole("menuitem", { name: "Archivio" }).click()
  await expect(page.getByRole("button", { name: /^Archivio 1$/ })).toBeVisible()
  // fuori dalla cartella il file dice dove sta
  await expect(card).toContainText("Archivio")

  // trascinando un altro file sulla cartella
  const other = page.getByRole("link", { name: /Onboarding/ })
  await other.dragTo(page.getByRole("button", { name: /^Archivio 1$/ }))
  // sopra la cartella il numero lascia il posto al suo menu: il puntatore va
  // via prima di leggerlo
  await page.mouse.move(700, 700)
  await expect(page.getByRole("button", { name: /^Archivio 2$/ })).toBeVisible()

  // e trascinandolo su «Tutti i file» esce dalla cartella
  await page.getByRole("button", { name: /^Archivio 2$/ }).click()
  await page
    .getByRole("link", { name: /Onboarding/ })
    .dragTo(page.getByRole("button", { name: /^Tutti i file \d/ }))
  await page.mouse.move(700, 700)
  await expect(page.getByRole("button", { name: /^Archivio 1$/ })).toBeVisible()
})

test("le cartelle restano dopo aver ricaricato la pagina", async ({ page }) => {
  await page.getByRole("button", { name: "Nuova cartella" }).first().click()
  await page.getByLabel("Nome della cartella").fill("Vuota")
  await page.getByRole("button", { name: "Crea" }).click()
  const card = page.getByRole("link", { name: /Product brief/ })
  await card.hover()
  await page.getByRole("button", { name: "Azioni per Product brief" }).click()
  await page.getByRole("menuitem", { name: "Sposta in" }).click()
  await page.getByRole("menuitem", { name: "Nuova cartella…" }).click()
  await page.getByLabel("Nome della cartella").fill("Piena")
  await page.getByRole("button", { name: "Crea" }).click()
  await expect(page.getByRole("button", { name: /^Piena 1$/ })).toBeVisible()

  // il salvataggio arriva poco dopo la modifica
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByRole("button", { name: /^Piena 1$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Vuota 0$/ })).toBeVisible()
})
