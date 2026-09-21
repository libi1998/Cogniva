import { expect, test } from "@playwright/test"
import {
  blockHtml,
  caretAfter,
  deleted,
  enableTracking,
  focused,
  inserted,
  openDemo,
  ribbonButton,
  selectText,
  withEditor,
} from "./editor"

/**
 * Rilevamento modifiche con la tastiera vera: Backspace, Canc, Invio,
 * selezioni, composizione (IME), incolla, annulla, accetta e rifiuta.
 * Il paragrafo 1 del documento d'esempio comincia con «Un documento di esempio».
 */

test.beforeEach(async ({ page }) => {
  await openDemo(page)
  await enableTracking(page)
})

test("la scrittura diventa un inserimento", async ({ page }) => {
  await caretAfter(page, 1, "Un ")
  await page.keyboard.type("NUOVO ")
  expect(await inserted(page)).toEqual(["NUOVO "])
  expect(await deleted(page)).toEqual([])
})

test("Backspace su testo originale lo segna eliminato e va a sinistra", async ({
  page,
}) => {
  await caretAfter(page, 1, "Un documento")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Backspace")
  expect(await deleted(page)).toEqual(["nto"])
  // il cursore è prima del testo eliminato: si scrive lì
  await page.keyboard.type("X")
  const html = await blockHtml(page, 1)
  expect(html).toMatch(/docume<ins[^>]*>X<\/ins><del[^>]*>nto<\/del>/)
})

test("Canc segna il testo dopo il cursore e lo scavalca", async ({ page }) => {
  await caretAfter(page, 1, "Un ")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  expect(await deleted(page)).toEqual(["doc"])
  await page.keyboard.type("Y")
  const html = await blockHtml(page, 1)
  expect(html).toMatch(/<del[^>]*>doc<\/del><ins[^>]*>Y<\/ins>umento/)
})

test("Backspace sul proprio testo nuovo lo cancella davvero", async ({
  page,
}) => {
  await caretAfter(page, 1, "Un ")
  await page.keyboard.type("ABC")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Backspace")
  expect(await inserted(page)).toEqual(["A"])
  expect(await deleted(page)).toEqual([])
})

test("scrivere su una selezione: eliminato più inserito", async ({ page }) => {
  await selectText(page, 1, "esempio")
  await page.keyboard.type("prova")
  expect(await deleted(page)).toEqual(["esempio"])
  expect(await inserted(page)).toEqual(["prova"])
})

test("una selezione su due paragrafi non unisce i paragrafi", async ({
  page,
}) => {
  const count = await page.locator("#doc-sheet .ProseMirror > *").count()
  await withEditor(
    page,
    `
    const doc = editor.state.doc
    let p1 = doc.child(0).nodeSize
    const text1 = doc.child(1).textContent
    let p2 = p1 + doc.child(1).nodeSize
    const from = p1 + 1 + text1.indexOf("clic destro")
    const to = p2 + 1 + 3
    editor.chain().focus().setTextSelection({ from, to }).run()
    `
  )
  await focused(page)
  await page.keyboard.press("Backspace")
  expect(await page.locator("#doc-sheet .ProseMirror > *").count()).toBe(count)
  const gone = (await deleted(page)).join("")
  expect(gone).toContain("clic destro")
  expect(gone).toContain("Obi")
})

test("Invio divide il paragrafo senza perdere testo", async ({ page }) => {
  const count = await page.locator("#doc-sheet .ProseMirror > *").count()
  await caretAfter(page, 1, "Un documento di esempio.")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Riga nuova")
  expect(await page.locator("#doc-sheet .ProseMirror > *").count()).toBe(
    count + 1
  )
  expect(await deleted(page)).toEqual([])
  expect(await inserted(page)).toEqual(["Riga nuova"])
})

test("la composizione (IME) viene tracciata a fine parola", async ({
  page,
}) => {
  await caretAfter(page, 1, "Un ")
  const client = await page.context().newCDPSession(page)
  await client.send("Input.imeSetComposition", {
    text: "か",
    selectionStart: 1,
    selectionEnd: 1,
  })
  await client.send("Input.imeSetComposition", {
    text: "かな",
    selectionStart: 2,
    selectionEnd: 2,
  })
  await client.send("Input.insertText", { text: "仮名" })
  await expect.poll(() => inserted(page)).toEqual(["仮名"])
  expect(await deleted(page)).toEqual([])
})

test("la composizione su una selezione la segna eliminata", async ({
  page,
}) => {
  await selectText(page, 1, "esempio")
  const client = await page.context().newCDPSession(page)
  await client.send("Input.imeSetComposition", {
    text: "e",
    selectionStart: 1,
    selectionEnd: 1,
  })
  await client.send("Input.insertText", { text: "è" })
  await expect.poll(() => inserted(page)).toEqual(["è"])
  expect(await deleted(page)).toEqual(["esempio"])
})

test("incollare più paragrafi li segna tutti inseriti", async ({ page }) => {
  await caretAfter(page, 1, "Un ")
  await page.evaluate(() =>
    navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob(["<p>Primo</p><p>Secondo</p>"], {
          type: "text/html",
        }),
        "text/plain": new Blob(["Primo\n\nSecondo"], { type: "text/plain" }),
      }),
    ])
  )
  await page.keyboard.press("ControlOrMeta+V")
  const text = (await inserted(page)).join("|")
  expect(text).toContain("Primo")
  expect(text).toContain("Secondo")
  expect(await deleted(page)).toEqual([])
})

test("Annulla toglie la revisione", async ({ page }) => {
  await caretAfter(page, 1, "Un ")
  await page.keyboard.type("Z")
  expect(await inserted(page)).toEqual(["Z"])
  await page.keyboard.press("ControlOrMeta+Z")
  expect(await inserted(page)).toEqual([])
  expect(await deleted(page)).toEqual([])
  expect(await blockHtml(page, 1)).toMatch(/^Un documento/)
  // Ripristina riporta la revisione
  await page.keyboard.press("ControlOrMeta+Shift+Z")
  expect(await inserted(page)).toEqual(["Z"])
})

test("accetta tutto e rifiuta tutto dalla barra", async ({ page }) => {
  await selectText(page, 1, "esempio")
  await page.keyboard.type("prova")
  await (await ribbonButton(page, "Altre opzioni: accetta")).click()
  await page
    .getByRole("menuitem", { name: "Accetta tutte le modifiche", exact: true })
    .click()
  expect(await inserted(page)).toEqual([])
  expect(await deleted(page)).toEqual([])
  await expect(
    page.locator("#doc-sheet .ProseMirror > *").nth(1)
  ).toContainText("Un documento di prova")

  await selectText(page, 1, "prova")
  await page.keyboard.type("test")
  await (await ribbonButton(page, "Altre opzioni: rifiuta")).click()
  await page
    .getByRole("menuitem", { name: "Rifiuta tutte le modifiche", exact: true })
    .click()
  expect(await inserted(page)).toEqual([])
  await expect(
    page.locator("#doc-sheet .ProseMirror > *").nth(1)
  ).toContainText("Un documento di prova")
})

test("senza rilevamento Backspace e Canc cancellano normalmente", async ({
  page,
}) => {
  await (await ribbonButton(page, "Revisioni")).click()
  await caretAfter(page, 1, "Un documento")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Delete")
  expect(await blockHtml(page, 1)).toMatch(/^Un documentdi esempio/)
  expect(await deleted(page)).toEqual([])
})

test("⌥⌫ cancella una parola intera come revisione", async ({ page }) => {
  await caretAfter(page, 1, "Un documento")
  await page.keyboard.press(
    process.platform === "darwin" ? "Alt+Backspace" : "Control+Backspace"
  )
  expect(await deleted(page)).toEqual(["documento"])
  expect(await inserted(page)).toEqual([])
})

test("tagliare con ⌘X segna eliminato il testo tagliato", async ({ page }) => {
  await selectText(page, 1, "esempio")
  await page.keyboard.press("ControlOrMeta+X")
  expect(await deleted(page)).toEqual(["esempio"])
  // quello che si incolla altrove è il testo tagliato
  await caretAfter(page, 1, "Un ")
  await page.keyboard.press("ControlOrMeta+V")
  expect(await inserted(page)).toEqual(["esempio"])
})

test("il testo eliminato non si può riscrivere dentro", async ({ page }) => {
  await selectText(page, 1, "esempio")
  await page.keyboard.press("Backspace")
  // il cursore è prima del testo eliminato: una lettera non entra nel <del>
  await page.keyboard.type("k")
  const html = await blockHtml(page, 1)
  expect(html).toMatch(/<ins[^>]*>k<\/ins><del[^>]*>esempio<\/del>/)
})
