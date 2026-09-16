import { test, expect } from "@playwright/test"

/**
 * La lingua dell'app: viene dall'indirizzo, dal browser di chi arriva e dal
 * menu dell'aspetto. I file restano dove sono in ogni lingua.
 */

test("chi arriva senza lingua finisce in quella del browser", async ({
  page,
}) => {
  // il profilo dei test è italiano (playwright.config.ts)
  await page.goto("/")
  await expect(page).toHaveURL(/\/it$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "it")
  await expect(
    page.getByRole("button", { name: "Nuovo documento" }).first()
  ).toBeVisible()
})

test("un browser inglese apre l'app in inglese", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" })
  const page = await context.newPage()
  await page.goto("/")
  await expect(page).toHaveURL(/\/en$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(
    page.getByRole("button", { name: "New document" }).first()
  ).toBeVisible()
  await context.close()
})

test("una lingua che l'app non conosce va in inglese", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP" })
  const page = await context.newPage()
  await page.goto("/")
  await expect(page).toHaveURL(/\/en$/)
  await context.close()
})

test("il menu dell'aspetto cambia lingua e la ricorda", async ({ page }) => {
  await page.goto("/it")
  await page.getByRole("button", { name: "Aspetto e lingua" }).click()
  await page.getByRole("menuitem", { name: "Español" }).click()

  await expect(page).toHaveURL(/\/es$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "es")
  await expect(
    page.getByRole("button", { name: "Nuevo documento" }).first()
  ).toBeVisible()

  // la scelta resta: chi torna all'indirizzo senza lingua ritrova lo spagnolo
  await page.goto("/")
  await expect(page).toHaveURL(/\/es$/)
})

test("l'indirizzo con la lingua vince sul browser", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" })
  const page = await context.newPage()
  await page.goto("/de")
  await expect(page.locator("html")).toHaveAttribute("lang", "de")
  await expect(
    page.getByRole("button", { name: "Neues Dokument" }).first()
  ).toBeVisible()
  await context.close()
})

test("nessuna lingua sbagliata nell'HTML del server", async ({ browser }) => {
  for (const locale of ["en", "es", "fr", "de", "pt"]) {
    const context = await browser.newContext({ locale: "it-IT" })
    const page = await context.newPage()
    const problems: string[] = []
    page.on("console", (message) => {
      const text = message.text()
      // React segnala così il testo del server diverso da quello del browser
      if (/hydrat|did not match/i.test(text)) problems.push(text)
    })
    for (const path of ["", "/doc/demo-doc", "/board/demo-board"]) {
      await page.goto(`/${locale}${path}`)
      await page.waitForLoadState("networkidle")
    }
    expect(problems, `${locale}: ${problems[0] ?? ""}`).toHaveLength(0)
    await context.close()
  }
})

test("l'editor parla la lingua dell'indirizzo", async ({ page }) => {
  await page.goto("/fr/doc/demo-doc")
  await expect(page.locator("#doc-sheet .ProseMirror")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Accueil" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Insertion" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Révision" })).toBeVisible()
})
