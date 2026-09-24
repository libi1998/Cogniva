import { expect, test, type Page } from "@playwright/test"

/**
 * La board d'esempio: menu contestuale, connettori, tabelle e testo.
 *
 * Il menu contestuale vive in un portale ma dentro al canvas nell'albero di
 * React: la pressione su una voce risaliva fino al canvas, che chiudeva il
 * menu prima del clic, e nessuna voce faceva niente.
 */

type Board = {
  nodes: {
    id: string
    kind: string
    h: number
    table?: { rows: number }
  }[]
  edges: {
    id: string
    from: string
    to: string
    head: string | null
    tail: string | null
  }[]
  theme: { arrows: { head: string; tail: string } }
}

/** La board salvata nel browser, come la rileggerebbe l'app */
const saved = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("cogniva")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const files = await new Promise<{ id: string; data: unknown }[]>(
      (resolve) => {
        const request = db.transaction("files").objectStore("files").getAll()
        request.onsuccess = () => resolve(request.result)
      }
    )
    db.close()
    return files.find((f) => f.id === "demo-board")?.data as Board
  })

async function openBoard(page: Page) {
  await page.goto("/it/board/demo-board")
  await expect(page.locator('[data-node-id="n2"]')).toBeVisible()
}

async function center(page: Page, id: string) {
  const box = (await page.locator(`[data-node-id="${id}"]`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function contextMenu(page: Page, id: string) {
  const { x, y } = await center(page, id)
  await page.mouse.click(x, y, { button: "right" })
  await expect(page.getByRole("menu")).toBeVisible()
}

const nodes = (page: Page) => page.locator("[data-node-id]")

/**
 * Una voce di un sottomenu, arrivandoci col mouse come una persona: il
 * puntatore che salta da un punto all'altro passa sopra le voci vicine senza
 * che il menu lo veda muoversi
 */
async function pick(page: Page, submenu: string, item: string) {
  const trigger = (await page
    .getByRole("menuitem", { name: submenu })
    .boundingBox())!
  await page.mouse.move(trigger.x + 20, trigger.y + trigger.height / 2, {
    steps: 10,
  })
  const target = page.getByRole("menuitem", { name: item })
  await expect(target).toBeVisible()
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 10,
  })
  await target.click()
}

test("le voci del menu contestuale fanno quello che dicono", async ({
  page,
}) => {
  await openBoard(page)
  const before = await nodes(page).count()

  await contextMenu(page, "n2")
  await page.getByRole("menuitem", { name: /Elimina/ }).click()
  await expect(page.locator('[data-node-id="n2"]')).toHaveCount(0)
  await expect(nodes(page)).toHaveCount(before - 1)

  // il tasto destro seleziona l'elemento: Duplica lavora su quello, non su
  // quello che era selezionato prima
  await contextMenu(page, "n3")
  await page.getByRole("menuitem", { name: /Duplica/ }).click()
  await expect(nodes(page)).toHaveCount(before)
})

test("una riga aggiunta dal menu fa crescere la tabella", async ({ page }) => {
  await openBoard(page)
  const table = () =>
    saved(page).then((b) => b.nodes.find((n) => n.id === "tbl1")!)
  const start = await table()

  await contextMenu(page, "tbl1")
  await pick(page, "Tabella", "Aggiungi riga")

  await expect
    .poll(async () => (await table()).table?.rows)
    .toBe(start.table!.rows + 1)
  // le righe restano alte com'erano: il riquadro cresce con loro
  const end = await table()
  expect(end.h / end.table!.rows).toBeCloseTo(start.h / start.table!.rows, 0)
})

test("Inverti le punte gira la freccia invece di toglierla", async ({
  page,
}) => {
  await openBoard(page)
  const { edges, theme } = await saved(page)
  const edge = edges.find((e) => e.id === "e1")!
  const head = edge.head ?? theme.arrows.head
  const tail = edge.tail ?? theme.arrows.tail
  expect(head).not.toBe(tail)

  // il tasto destro vero, a metà del connettore: sta dentro una sezione, e
  // finché la sezione era disegnata sopra il clic andava a lei
  const mid = await page.evaluate(() => {
    const path = document.querySelector<SVGPathElement>(
      'path[data-edge-id="e1"]'
    )!
    const point = path.getPointAtLength(path.getTotalLength() / 2)
    const m = path.getScreenCTM()!
    return {
      x: point.x * m.a + point.y * m.c + m.e,
      y: point.x * m.b + point.y * m.d + m.f,
    }
  })
  await page.mouse.click(mid.x, mid.y, { button: "right" })
  await page.getByRole("menuitem", { name: "Inverti le punte" }).click()

  await expect
    .poll(async () => {
      const e = (await saved(page)).edges.find((x) => x.id === "e1")!
      return [e.head, e.tail]
    })
    .toEqual([tail, head])
})

test("il connettore collega trascinando, un clic fermo non crea niente", async ({
  page,
}) => {
  await openBoard(page)
  const edges = async () => (await saved(page)).edges
  const count = (await edges()).length
  const elements = await nodes(page).count()

  await page.keyboard.press("c")
  const from = await center(page, "n3")
  // un clic vero dura un attimo: prima collegava l'elemento alla sezione
  // che lo contiene
  await page.mouse.click(from.x, from.y, { delay: 80 })
  await page.waitForTimeout(400)
  await expect(nodes(page)).toHaveCount(elements)
  expect((await edges()).length).toBe(count)

  const to = await center(page, "n4")
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await edges()).map((e) => `${e.from}>${e.to}`))
    .toContain("n3>n4")
})

test("Invio scrive solo negli elementi che hanno un testo", async ({
  page,
}) => {
  await openBoard(page)
  // un'icona e una tabella non hanno un testo da scrivere nel riquadro
  for (const id of ["n8", "tbl1"]) {
    const { x, y } = await center(page, id)
    await page.mouse.click(x, y)
    await page.keyboard.press("Enter")
    await expect(page.locator(`[data-node-id="${id}"] textarea`)).toHaveCount(0)
    await page.keyboard.press("Escape")
  }
  // una forma sì
  const { x, y } = await center(page, "n2")
  await page.mouse.click(x, y)
  await page.keyboard.press("Enter")
  await expect(page.locator('[data-node-id="n2"] textarea')).toBeFocused()
})
