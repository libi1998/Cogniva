import { expect, test, type Page } from "@playwright/test"
import { withEditor } from "./editor"

/**
 * Un documento che l'app non capisce del tutto.
 *
 * Un file può arrivare da una versione futura di Cogniva o da uno spazio di
 * lavoro scritto a mano: un pezzo sconosciuto non deve portarsi via il resto.
 * Prima bastava un nodo solo perché il documento si aprisse bianco — e la
 * prima battuta lo salvava bianco sopra al testo vero.
 */

async function importWorkspace(page: Page, files: unknown[]) {
  await page.goto("/it")
  await expect(page.getByRole("link", { name: /Product brief/ })).toBeVisible()
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Importa" }).click()
  await page.getByRole("menuitem", { name: /Spazio di lavoro/ }).click()
  await (
    await chooser
  ).setFiles({
    name: "spazio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(files), "utf8"),
  })
  await expect(page.getByText(/Aggiunt[oi] 1 file/)).toBeVisible()
  // l'importazione scrive subito, ma la transazione ha bisogno del suo tempo
  await page.waitForTimeout(500)
}

test("un nodo sconosciuto non svuota il documento", async ({ page }) => {
  await importWorkspace(page, [
    {
      id: "rovinato-1",
      kind: "doc",
      title: "Rovinato",
      icon: "file-text",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      data: {
        content: {
          type: "doc",
          content: [
            { type: "docTitle", content: [{ type: "text", text: "Rovinato" }] },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Prima " },
                {
                  type: "text",
                  marks: [{ type: "marchioCheNonEsiste" }],
                  text: "riga",
                },
              ],
            },
            {
              type: "nodoCheNonEsiste",
              content: [{ type: "text", text: "testo dentro" }],
            },
            { type: "paragraph", content: [{ type: "text", text: "Ultima" }] },
          ],
        },
        theme: {},
      },
    },
  ])

  await page.goto("/it/doc/rovinato-1")
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

  const text = await withEditor<string>(
    page,
    "return editor.state.doc.textContent"
  )
  expect(text).toContain("Rovinato")
  expect(text).toContain("Prima riga")
  expect(text).toContain("testo dentro")
  expect(text).toContain("Ultima")
})

test("un documento senza il nodo del titolo si apre col suo testo", async ({
  page,
}) => {
  await importWorkspace(page, [
    {
      id: "senza-titolo-1",
      kind: "doc",
      title: "Senza nodo titolo",
      icon: "file-text",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      data: {
        // il primo nodo dovrebbe essere «docTitle»: qui manca
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Solo testo" }],
            },
          ],
        },
        theme: {},
      },
    },
  ])

  await page.goto("/it/doc/senza-titolo-1")
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator("#doc-sheet")).toContainText("Solo testo")
})
