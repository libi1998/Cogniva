import { expect, test, type Page } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * Modelli 3D: forme pronte e file glTF, rotazione col trascinamento,
 * visualizzazioni predefinite e anteprima che finisce nel file Word.
 */

test.setTimeout(90_000)

/** Un .glb minimo e valido: un triangolo */
function triangleGlb() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const bin = Buffer.from(positions.buffer)
  const json = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  }
  let jsonChunk = Buffer.from(JSON.stringify(json))
  jsonChunk = Buffer.concat([
    jsonChunk,
    Buffer.alloc((4 - (jsonChunk.length % 4)) % 4, 0x20),
  ])
  const binChunk = Buffer.concat([
    bin,
    Buffer.alloc((4 - (bin.length % 4)) % 4),
  ])
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunk = (type: number, data: Buffer) => {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(data.length, 0)
    head.writeUInt32LE(type, 4)
    return Buffer.concat([head, data])
  }
  return Buffer.concat([
    header,
    chunk(0x4e4f534a, jsonChunk),
    chunk(0x004e4942, binChunk),
  ])
}

const modelAttrs = (page: Page) =>
  withEditor<Record<string, unknown> | null>(
    page,
    `let found = null
     editor.state.doc.descendants((n) => { if (n.type.name === "model3d") { found = n.attrs; return false } })
     return found`
  )

test("inserisce una forma 3D, la ruota e usa le visualizzazioni", async ({
  page,
}) => {
  await openDemo(page)
  await caretAfter(page, 1, "clic destro.")
  await openTab(page, "Inserisci")
  await (await ribbonButton(page, "Modelli 3D")).click()
  await page.getByRole("button", { name: "Cubo", exact: true }).click()

  const frame = page.locator("#doc-sheet .doc-model3d-frame")
  await expect(frame).toBeVisible()
  // l'anteprima si genera appena il modello è disegnato. three.js arriva
  // solo adesso, alla prima forma: in sviluppo si compila al momento e può
  // volerci ben più dei 5 secondi di un'attesa normale
  await expect
    .poll(async () => String((await modelAttrs(page))?.poster ?? ""), {
      timeout: 20_000,
    })
    .toMatch(/^data:image\/png/)
  // il modello resta selezionato e la sua scheda si apre da sola
  await expect(page.getByRole("tab", { name: "Modello 3D" })).toHaveAttribute(
    "aria-selected",
    "true"
  )

  // trascinare ruota la vista
  const before = await modelAttrs(page)
  const box = (await frame.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2 + 120,
    box.y + box.height / 2 + 30,
    { steps: 8 }
  )
  await page.mouse.up()
  // una rotazione vera, non un passo annullato dal trascinamento del nodo
  await expect
    .poll(async () =>
      Math.abs(Number((await modelAttrs(page))?.yaw) - Number(before?.yaw))
    )
    .toBeGreaterThan(20)
  // il documento non ha perso il modello né selezionato testo
  expect(await page.locator("#doc-sheet .doc-model3d").count()).toBe(1)

  // visualizzazioni, zoom e rotazione stanno in «Altre opzioni»
  await (await ribbonButton(page, "Altre opzioni")).click()
  await page.getByRole("button", { name: "Dall'alto" }).click()
  await expect.poll(async () => (await modelAttrs(page))?.pitch).toBe(89)
  await page.getByRole("button", { name: "Reimposta" }).click()
  await expect.poll(async () => (await modelAttrs(page))?.yaw).toBe(35)

  await page.getByRole("switch").click()
  await expect.poll(async () => (await modelAttrs(page))?.autoRotate).toBe(true)
})

test("carica un file .glb e lo esporta in Word con l'anteprima", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "cogniva-3d-"))
  const glb = join(dir, "triangolo.glb")
  writeFileSync(glb, triangleGlb())

  await openDemo(page)
  await caretAfter(page, 1, "clic destro.")
  await openTab(page, "Inserisci")
  await page.getByTestId("model3d-file").setInputFiles(glb)
  await expect(page.locator("#doc-sheet .doc-model3d-canvas")).toBeVisible()
  await expect
    .poll(async () => String((await modelAttrs(page))?.poster ?? ""), {
      timeout: 20_000,
    })
    .toMatch(/^data:image\/png/)
  expect(String((await modelAttrs(page))?.name)).toBe("triangolo.glb")
  expect(String((await modelAttrs(page))?.src)).toMatch(
    /^data:model\/gltf-binary;base64,/
  )

  await page.getByRole("button", { name: "Esporta", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /^\.docx/ }).click()
  const download = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "Esporta .docx" }).click()
  const file = join(dir, "doc.docx")
  await (await download).saveAs(file)
  const media = execFileSync("unzip", ["-l", file]).toString()
  expect(media).toMatch(/word\/media\/.+\.png/)
  const xml = execFileSync("unzip", [
    "-p",
    file,
    "word/document.xml",
  ]).toString()
  expect(xml).toContain('descr="triangolo.glb"')
})
