import { expect, test, type Page } from "@playwright/test"
import {
  caretAfter,
  openDemo,
  openTab,
  ribbonButton,
  withEditor,
} from "./editor"

/**
 * Leggi ad alta voce: voce neurale sul dispositivo (scaricata davvero) e voce
 * del sistema simulata, per controllare evidenziazione, pausa, ripresa dal
 * punto giusto, paragrafi e velocità senza dipendere dalle voci installate.
 */

const word = (page: Page) =>
  page
    .locator("#doc-sheet .read-aloud-word")
    .evaluateAll((els) => els.map((e) => e.textContent).join(""))

const bar = (page: Page) =>
  page.getByRole("toolbar", { name: "Lettura ad alta voce" })

const docJson = (page: Page) =>
  withEditor<string>(page, "return JSON.stringify(editor.getJSON())")

test.describe("voce neurale", () => {
  test.setTimeout(240_000)

  test("scarica Paola, legge evidenziando, pausa, riprende e si ferma", async ({
    page,
  }) => {
    await openDemo(page)
    const before = await docJson(page)
    await openTab(page, "Revisione")
    await page.getByTitle("Scegli la voce di lettura").click()
    const paola = page.getByRole("radio", { name: /Paola/ })
    await paola.click()
    await expect(paola).toHaveAttribute("aria-checked", "true", {
      timeout: 180_000,
    })
    await page.keyboard.press("Escape")

    await caretAfter(page, 1, "")
    await (await ribbonButton(page, "Leggi ad alta voce")).click()
    await expect(bar(page)).toBeVisible()
    await expect.poll(() => word(page), { timeout: 60_000 }).not.toBe("")
    const first = await word(page)
    await expect.poll(() => word(page), { timeout: 20_000 }).not.toBe(first)

    // in pausa la parola resta ferma
    await bar(page).getByRole("button", { name: "Pausa" }).click()
    const paused = await word(page)
    await page.waitForTimeout(1200)
    expect(await word(page)).toBe(paused)

    await bar(page).getByRole("button", { name: "Riprendi" }).click()
    await expect.poll(() => word(page), { timeout: 20_000 }).not.toBe(paused)

    // paragrafo successivo: si passa al titolo «Obiettivi»
    await bar(page)
      .getByRole("button", { name: "Paragrafo successivo" })
      .click()
    await expect.poll(() => word(page), { timeout: 30_000 }).toBe("Obiettivi")

    await bar(page).getByRole("button", { name: "Interrompi lettura" }).click()
    await expect(bar(page)).toBeHidden()
    await expect(page.locator("#doc-sheet .read-aloud-word")).toHaveCount(0)
    // la lettura non tocca il documento
    expect(await docJson(page)).toBe(before)
  })
})

test.describe("voce del sistema", () => {
  test.beforeEach(async ({ page }) => {
    // una sintesi finta ma fedele: annuncia ogni parola e la fine della frase
    await page.addInitScript(() => {
      const spoken: string[] = []
      ;(window as unknown as { __spoken: string[] }).__spoken = spoken
      let timers: number[] = []
      const voice = {
        name: "Test Voce Premium",
        lang: "it-IT",
        voiceURI: "test-it",
        localService: true,
        default: true,
      }
      const synth = {
        speaking: false,
        paused: false,
        pending: false,
        onvoiceschanged: null,
        getVoices: () => [voice],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel() {
          timers.forEach((t) => clearTimeout(t))
          timers = []
        },
        pause() {},
        resume() {},
        speak(u: SpeechSynthesisUtterance) {
          spoken.push(`${u.rate}|${u.text}`)
          const step = 400 / (u.rate || 1)
          timers.push(
            window.setTimeout(() => u.onstart?.(new Event("start") as never), 5)
          )
          const words = [...u.text.matchAll(/\S+/g)]
          words.forEach((m, i) => {
            timers.push(
              window.setTimeout(
                () =>
                  u.onboundary?.({
                    name: "word",
                    charIndex: m.index,
                    charLength: m[0].length,
                  } as never),
                10 + i * step
              )
            )
          })
          timers.push(
            window.setTimeout(
              () => u.onend?.(new Event("end") as never),
              20 + words.length * step
            )
          )
        },
      }
      // anche l'enunciato è finto: quello vero accetta solo voci vere
      class FakeUtterance {
        text: string
        lang = ""
        rate = 1
        pitch = 1
        volume = 1
        voice: unknown = null
        onstart: ((e: Event) => void) | null = null
        onend: ((e: Event) => void) | null = null
        onerror: ((e: Event) => void) | null = null
        onboundary: ((e: unknown) => void) | null = null
        constructor(text: string) {
          this.text = text
        }
      }
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        value: FakeUtterance,
        configurable: true,
      })
      Object.defineProperty(window, "speechSynthesis", {
        value: synth,
        configurable: true,
      })
    })
    await openDemo(page)
    await openTab(page, "Revisione")
  })

  test("pausa e ripresa ripartono dalla parola in corso", async ({ page }) => {
    await caretAfter(page, 1, "")
    await (await ribbonButton(page, "Leggi ad alta voce")).click()
    await expect.poll(() => word(page), { intervals: [50] }).toBe("esempio")
    await bar(page).getByRole("button", { name: "Pausa" }).click()
    const paused = await word(page)
    await page.waitForTimeout(500)
    expect(await word(page)).toBe(paused)

    await bar(page).getByRole("button", { name: "Riprendi" }).click()
    // la ripresa legge da quella parola, non dall'inizio della frase
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __spoken: string[] }).__spoken.length
        )
      )
      .toBe(2)
    const spoken = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken
    )
    expect(spoken[0]).toBe("1|Un documento di esempio. ")
    expect(spoken[1]!.slice(2).startsWith(paused)).toBe(true)
    await expect.poll(() => word(page)).not.toBe(paused)
  })

  test("legge frase per frase e cambia velocità al volo", async ({ page }) => {
    await caretAfter(page, 1, "")
    await (await ribbonButton(page, "Leggi ad alta voce")).click()
    await expect
      .poll(() => word(page), { intervals: [50], timeout: 8000 })
      .toBe("Prova")
    await bar(page)
      .getByRole("button", { name: /Velocità/ })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __spoken: string[] }).__spoken.at(-1)
        )
      )
      .toMatch(/^1\.25\|/)
    const spoken = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken
    )
    // le frasi arrivano una alla volta
    expect(spoken[0]).toBe("1|Un documento di esempio. ")
    expect(spoken[1]).toMatch(/^1\|Prova la barra/)
    await bar(page).getByRole("button", { name: "Interrompi lettura" }).click()
    await expect(bar(page)).toBeHidden()
  })

  test("con una selezione legge solo quella", async ({ page }) => {
    await withEditor(
      page,
      `
      const node = editor.state.doc.child(1)
      const start = 1 + editor.state.doc.child(0).nodeSize + node.textContent.indexOf("Prova")
      editor.chain().focus().setTextSelection({ from: start, to: start + "Prova la barra".length }).run()
      `
    )
    await (await ribbonButton(page, "Leggi ad alta voce")).click()
    await expect(bar(page)).toBeHidden({ timeout: 10_000 })
    const spoken = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken
    )
    expect(spoken).toEqual(["1|Prova la barra"])
  })
})
