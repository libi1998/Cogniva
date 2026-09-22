import { expect, test, type Page } from "@playwright/test"
import { withEditor } from "./editor"

/**
 * Quello che arriva da fuori.
 *
 * Un .html, un .docx o uno spazio di lavoro .json possono essere scritti da
 * chiunque. Cogniva promette che i documenti non escono dal browser: niente di
 * quello che si importa deve poter aggiungere regole di stile, far partire una
 * richiesta verso un sito o lasciare in giro indirizzi «javascript:».
 */

/** Importa un file dal menu «Importa», come si fa a mano */
async function importFile(
  page: Page,
  file: { name: string; mimeType: string; body: string }
) {
  await page.goto("/it")
  // i file d'esempio compaiono a spazio di lavoro caricato: da lì in poi la
  // pagina è viva e il selettore di file risponde
  await expect(page.getByRole("link", { name: /Product brief/ })).toBeVisible()
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Importa" }).click()
  await page
    .getByRole("menuitem", { name: /Word, Markdown|Spazio di lavoro/ })
    .first()
    .click()
  await (
    await chooser
  ).setFiles({
    name: file.name,
    mimeType: file.mimeType,
    buffer: Buffer.from(file.body, "utf8"),
  })
}

async function editorReady(page: Page) {
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
}

test("un HTML importato non porta dentro script, stili e indirizzi strani", async ({
  page,
}) => {
  await importFile(page, {
    name: "ostile.html",
    mimeType: "text/html",
    body: `<h1>Rapporto</h1>
      <style>.doc-prose{background:url(https://tracker.example/pixel.png)}</style>
      <script>window.__preso = true</script>
      <p>Testo <a href="javascript:alert(1)">link</a> normale.</p>
      <p><img src="javascript:alert(2)" onerror="window.__preso = true" alt="finta"></p>
      <iframe src="https://tracker.example/frame"></iframe>`,
  })
  await editorReady(page)

  // il testo resta, il codice no
  const text = await withEditor<string>(
    page,
    "return editor.state.doc.textContent"
  )
  expect(text).toContain("Testo")
  expect(text).not.toContain("tracker.example")
  expect(text).not.toContain("__preso")

  // niente collegamenti eseguibili, niente sorgenti strane, niente riquadri
  const urls = await withEditor<string[]>(
    page,
    `const out = []
     editor.state.doc.descendants((n) => {
       for (const m of n.marks ?? []) if (m.type.name === "link") out.push(String(m.attrs.href))
       if (n.type.name === "image") out.push(String(n.attrs.src ?? ""))
     })
     return out`
  )
  expect(urls.filter((u) => /^javascript:/i.test(u))).toEqual([])
  await expect(page.locator("#doc-sheet iframe")).toHaveCount(0)
  expect(await page.evaluate(() => "__preso" in window)).toBe(false)
})

test("uno spazio di lavoro .json non può scrivere regole di stile", async ({
  page,
}) => {
  const beacon = "url(https://tracker.example/pixel.png)"
  const workspace = [
    {
      id: "ostile-1",
      kind: "doc",
      title: "Importato",
      icon: "file-text",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      data: {
        content: {
          type: "doc",
          content: [
            {
              type: "docTitle",
              content: [{ type: "text", text: "Importato" }],
            },
            {
              // attributi scritti a mano: ognuno prova a uscire dal suo valore
              type: "paragraph",
              attrs: {
                lineHeight: `1;background-image:${beacon}`,
                spaceBefore: `0px;background-image:${beacon}`,
                shading: `red;background-image:${beacon}`,
              },
              content: [
                {
                  type: "text",
                  marks: [
                    {
                      type: "textStyle",
                      attrs: {
                        fontSize: `12pt;background-image:${beacon}`,
                        textFill: beacon,
                      },
                    },
                  ],
                  text: "Riga",
                },
              ],
            },
          ],
        },
        theme: {
          styles: {
            normal: { color: `#111}.doc-prose{background-image:${beacon}` },
          },
        },
      },
    },
  ]

  await importFile(page, {
    name: "spazio.json",
    mimeType: "application/json",
    body: JSON.stringify(workspace),
  })

  // lo spazio di lavoro aggiunge i file senza aprirli: l'id resta quello
  await expect(page.getByText(/Aggiunt[oi] 1 file/)).toBeVisible()
  await page.waitForTimeout(500)
  await page.goto("/it/doc/ostile-1")
  await editorReady(page)
  await expect(page.locator("#doc-sheet")).toContainText("Riga")

  // né negli attributi del documento né nel foglio di stile che lo veste
  const inline = await page
    .locator("#doc-sheet [style]")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("style") ?? "").join(" ")
    )
  expect(inline).not.toContain("tracker.example")
  const sheets = await page
    .locator("style")
    .evaluateAll((els) => els.map((e) => e.textContent ?? "").join(" "))
  expect(sheets).not.toContain("tracker.example")
})

/** I blocchi del documento aperto, dopo il titolo: «tipo:testo» */
const blocks = (page: Page) =>
  withEditor<string[]>(
    page,
    `const out = []
     editor.state.doc.forEach((n, _, i) => { if (i > 0) out.push(n.type.name + ":" + n.textContent) })
     return out`
  )

test("un testo scritto su Windows mantiene i suoi paragrafi", async ({
  page,
}) => {
  // a capo \r\n: le righe vuote fra i paragrafi non si riconoscevano e tutto
  // finiva in un paragrafo solo
  await importFile(page, {
    name: "appunti.txt",
    mimeType: "text/plain",
    body: "Primo paragrafo\r\nsu due righe\r\n\r\nSecondo paragrafo\r\n",
  })
  await editorReady(page)
  expect(await blocks(page)).toEqual([
    "paragraph:Primo paragrafosu due righe",
    "paragraph:Secondo paragrafo",
  ])
})

test("i prezzi con il dollaro restano testo, le formule del Markdown no", async ({
  page,
}) => {
  await importFile(page, {
    name: "listino.html",
    mimeType: "text/html",
    body: "<h1>Listino</h1><p>Da $5-$10 al pezzo, oppure $20 e $30.</p>",
  })
  await editorReady(page)
  expect(await blocks(page)).toEqual([
    "paragraph:Da $5-$10 al pezzo, oppure $20 e $30.",
  ])

  await importFile(page, {
    name: "note.md",
    mimeType: "text/markdown",
    body: "# Note\n\nArea $\\pi r^2$ per $5-$10 al metro.\n",
  })
  await editorReady(page)
  const math = await withEditor<string[]>(
    page,
    `const out = []
     editor.state.doc.descendants((n) => { if (n.type.name === "mathInline") out.push(n.attrs.latex) })
     return out`
  )
  expect(math).toEqual(["\\pi r^2"])
  expect(
    await withEditor<string>(page, "return editor.state.doc.textContent")
  ).toContain("per $5-$10 al metro.")
})
