import { expect, test, type Page } from "@playwright/test"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * Componenti aggiuntivi: raccolta, riquadro attività e ogni strumento. I
 * servizi esterni (Wikipedia, Openverse) sono simulati: il test non dipende
 * dalla rete e verifica cosa entra nel documento.
 */

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64"
)

const images = (page: Page) =>
  withEditor<{ alt: string; src: string }[]>(
    page,
    `const out = []
     editor.state.doc.descendants((n) => { if (n.type.name === "image") out.push({ alt: n.attrs.alt, src: String(n.attrs.src).slice(0, 40) }) })
     return out`
  )

const docText = (page: Page) =>
  withEditor<string>(page, "return editor.state.doc.textContent")

async function openAddin(page: Page, name: string) {
  await openTab(page, "Home")
  await (await ribbonButton(page, "Componenti aggiuntivi")).click()
  await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click()
  await expect(page.getByLabel(name, { exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await openDemo(page)
  await caretAfter(page, 1, "clic destro.")
})

test("Codice QR: dal contenuto all'immagine nel documento", async ({
  page,
}) => {
  await openAddin(page, "Codice QR")
  const pane = page.getByLabel("Codice QR", { exact: true })
  await pane.locator("textarea").fill("https://example.com/cogniva")
  await expect(pane.getByTestId("qr-preview")).toBeVisible()
  await pane.getByRole("button", { name: "Inserisci codice QR" }).click()
  await expect
    .poll(() => images(page))
    .toEqual([
      {
        alt: "Codice QR: https://example.com/cogniva",
        src: expect.stringMatching(/^data:image\/png/),
      },
    ])

  // Wi-Fi: il formato standard con i caratteri protetti
  await pane.getByRole("button", { name: "Wi-Fi" }).click()
  await pane.getByLabel("Nome della rete (SSID)").fill("Casa;Rossi")
  await pane.getByLabel("Password").fill("segreta")
  await expect(pane.getByTestId("qr-preview")).toBeVisible()
})

test("Leggibilità e testo segnaposto", async ({ page }) => {
  await openAddin(page, "Leggibilità")
  const index = page.getByTestId("readability-index")
  await expect(index).toHaveText(/^\d+\/100$/)
  const before = Number((await index.textContent())?.split("/")[0])

  await openAddin(page, "Testo segnaposto")
  const pane = page.getByLabel("Testo segnaposto", { exact: true })
  await pane.getByLabel("Paragrafi").fill("2")
  await pane.getByLabel("Con titoli ed elenchi puntati").check()
  await pane.getByRole("button", { name: "Inserisci testo segnaposto" }).click()
  await expect.poll(() => docText(page)).toContain("Sezione 1")
  expect(
    await page
      .locator("#doc-sheet .ProseMirror h2", { hasText: "Sezione 1" })
      .count()
  ).toBe(1)

  await openAddin(page, "Leggibilità")
  await expect(index).toHaveText(/^\d+\/100$/)
  expect(Number.isFinite(before)).toBe(true)
})

test("Firma: il tratto diventa un'immagine ritagliata", async ({ page }) => {
  await openAddin(page, "Firma")
  const pane = page.getByLabel("Firma", { exact: true })
  const canvas = pane.getByTestId("signature-canvas")
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + 30, box.y + 100)
  await page.mouse.down()
  for (let i = 1; i <= 20; i += 1) {
    await page.mouse.move(
      box.x + 30 + i * 10,
      box.y + 100 - Math.sin(i / 2) * 40
    )
  }
  await page.mouse.up()
  await pane.getByRole("button", { name: "Inserisci firma" }).click()
  await expect
    .poll(() => images(page))
    .toEqual([{ alt: "Firma", src: expect.stringMatching(/^data:image\/png/) }])
})

test("raccolta: si aggiunge Wikipedia e inserisce il riassunto con la fonte", async ({
  page,
}) => {
  await page.route(
    "https://it.wikipedia.org/w/rest.php/v1/search/**",
    (route) =>
      route.fulfill({
        json: {
          pages: [
            {
              key: "Leonardo_da_Vinci",
              title: "Leonardo da Vinci",
              description: "artista italiano",
              thumbnail: null,
            },
          ],
        },
      })
  )
  await page.route(
    "https://it.wikipedia.org/api/rest_v1/page/summary/**",
    (route) =>
      route.fulfill({
        json: {
          title: "Leonardo da Vinci",
          extract:
            "Leonardo di ser Piero da Vinci è stato uno scienziato, inventore e artista italiano.",
          description: "artista italiano",
          content_urls: {
            desktop: {
              page: "https://it.wikipedia.org/wiki/Leonardo_da_Vinci",
            },
          },
        },
      })
  )
  await openTab(page, "Home")
  await (await ribbonButton(page, "Componenti aggiuntivi")).click()
  await page
    .getByRole("menuitem", { name: "Altri componenti aggiuntivi…" })
    .click()
  const dialog = page.getByRole("dialog", { name: "Componenti aggiuntivi" })
  await dialog.getByRole("tab", { name: "Ricerca" }).click()
  const card = dialog.getByRole("article", { name: "Wikipedia" })
  await expect(card.getByText(/Usa internet/)).toBeVisible()
  await card.getByRole("button", { name: "Aggiungi" }).click()
  await expect(card.getByRole("button", { name: "Aggiunto" })).toBeVisible()
  await card.getByRole("button", { name: "Apri" }).click()
  await expect(dialog).toBeHidden()

  const pane = page.getByLabel("Wikipedia", { exact: true })
  await pane.getByLabel("Cerca su Wikipedia").fill("Leonardo")
  await pane.getByRole("button", { name: /Leonardo da Vinci/ }).click()
  await expect(pane.getByTestId("wikipedia-extract")).toContainText(
    "scienziato"
  )
  await pane
    .getByRole("button", { name: "Inserisci riassunto con la fonte" })
    .click()
  await expect
    .poll(() => docText(page))
    .toContain("Fonte: «Leonardo da Vinci», Wikipedia, licenza CC BY-SA 4.0")
  const links = await page
    .locator("#doc-sheet a[href]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")))
  expect(links).toContain("https://it.wikipedia.org/wiki/Leonardo_da_Vinci")

  // la scelta resta: il menu ora elenca Wikipedia
  await (await ribbonButton(page, "Componenti aggiuntivi")).click()
  await expect(page.getByRole("menuitem", { name: /^Wikipedia/ })).toBeVisible()
})

test("Immagini libere: inserisce l'immagine con autore e licenza", async ({
  page,
}) => {
  await page.route("https://api.openverse.org/v1/images/**", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "abc",
            title: "Montagne",
            url: "https://images.example.org/montagne.png",
            thumbnail: "https://images.example.org/montagne-thumb.png",
            creator: "Anna Bianchi",
            creator_url: "https://example.org/anna",
            license: "by",
            license_version: "4.0",
            license_url: "https://creativecommons.org/licenses/by/4.0/",
            foreign_landing_url: "https://example.org/foto/montagne",
            provider: "flickr",
          },
        ],
      },
    })
  )
  await page.route("https://images.example.org/**", (route) =>
    route.fulfill({ body: PNG, contentType: "image/png" })
  )
  await openTab(page, "Home")
  await (await ribbonButton(page, "Componenti aggiuntivi")).click()
  await page
    .getByRole("menuitem", { name: "Altri componenti aggiuntivi…" })
    .click()
  const dialog = page.getByRole("dialog", { name: "Componenti aggiuntivi" })
  await dialog
    .getByRole("article", { name: "Immagini libere" })
    .getByRole("button", { name: "Apri" })
    .click()

  const pane = page.getByLabel("Immagini libere", { exact: true })
  await pane.getByLabel("Cerca immagini libere").fill("montagne")
  await pane.getByRole("button", { name: /Montagne — Anna Bianchi/ }).click()
  await pane
    .getByRole("button", { name: "Inserisci con autore e licenza" })
    .click()
  await expect
    .poll(() => images(page))
    .toEqual([
      { alt: "Montagne", src: "https://images.example.org/montagne.png" },
    ])
  await expect
    .poll(() => docText(page))
    .toContain("«Montagne» di Anna Bianchi, CC BY 4.0")
})
