import { expect, test, type Page } from "@playwright/test"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * La scheda di un oggetto selezionato: nota, immagine, grafico.
 *
 * Cambiare un attributo riscrive l'oggetto, e per ProseMirror quello
 * selezionato spariva: la selezione diventava un cursore, il pannello si
 * chiudeva e il campo in cui si scriveva spariva alla prima lettera.
 */

/** Il valore di un attributo del primo nodo di quel tipo */
const attr = (page: Page, type: string, name: string) =>
  withEditor<string | null>(
    page,
    `let out = null
     editor.state.doc.descendants((n) => { if (out === null && n.type.name === arg.type) out = n.attrs[arg.name] })
     return out`,
    { type, name }
  )

/**
 * Il tipo di selezione e il nodo selezionato. Dal JSON della selezione, non
 * dal nome della classe: nella build di produzione i nomi sono accorciati
 * («G» invece di «NodeSelection»)
 */
const selection = (page: Page) =>
  withEditor<string>(
    page,
    `const kind = { node: "NodeSelection", text: "TextSelection", cell: "CellSelection", all: "AllSelection" }[editor.state.selection.toJSON().type] ?? "?"
     return kind + ":" + (editor.state.selection.node?.type.name ?? "")`
  )

test("il testo di una nota si scrive tutto", async ({ page }) => {
  await openDemo(page)
  await caretAfter(page, 1, "clic destro.")
  await openTab(page, "Riferimenti")
  await (await ribbonButton(page, "Inserisci nota a piè di pagina")).click()

  // la nota nuova si scrive subito, nel campo della sua scheda
  const field = page.getByPlaceholder("Testo della nota")
  await expect(field).toBeFocused()
  await page.keyboard.type("Fonte: archivio comunale", { delay: 12 })

  await expect(field).toBeFocused()
  expect(await attr(page, "footnote", "text")).toBe("Fonte: archivio comunale")
  expect(await selection(page)).toBe("NodeSelection:footnote")
})

test("la descrizione di un'immagine si scrive tutta", async ({ page }) => {
  await openDemo(page)
  // un'immagine di due pixel, selezionata come dopo un clic
  await withEditor(
    page,
    `const end = editor.state.doc.content.size
     editor.chain().insertContentAt(end, { type: "paragraph" }).focus("end")
       .setImage({ src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAr7kI7cAAAAASUVORK5CYII=" })
       .run()
     let pos = -1
     editor.state.doc.descendants((n, p) => { if (n.type.name === "image") pos = p })
     editor.chain().focus().setNodeSelection(pos).run()`
  )
  // il testo alternativo sta nella scheda dell'immagine, come in Word
  await page.getByRole("tab", { name: "Formato immagine" }).click()
  await page.getByRole("button", { name: "Testo alternativo" }).click()
  const field = page.getByPlaceholder("Descrivi l'immagine")
  await expect(field).toBeFocused()
  await page.keyboard.type("Grafico delle vendite", { delay: 12 })

  await expect(field).toBeFocused()
  await expect(field).toHaveValue("Grafico delle vendite")
  expect(await attr(page, "image", "alt")).toBe("Grafico delle vendite")
  expect(await selection(page)).toBe("NodeSelection:image")
})
