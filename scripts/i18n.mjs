#!/usr/bin/env node
/**
 * Cataloghi delle traduzioni.
 *
 *   node scripts/i18n.mjs          aggiorna lib/i18n/catalog/*.json
 *   node scripts/i18n.mjs --check  controlla che ogni frase abbia tutte le
 *                                  traduzioni (lo usa `pnpm check`)
 *
 * Le frasi sono i testi italiani passati a t(), tr(), translate() e N_().
 * Ogni frase finisce nel catalogo «app» se la usa qualcosa che home o board
 * caricano, altrimenti in «doc»: così una pagina riceve solo i testi che le
 * servono. Le traduzioni già scritte si conservano, quelle che non servono
 * più si tolgono.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import ts from "typescript"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const CATALOG_DIR = path.join(ROOT, "lib/i18n/catalog")
const TARGETS = ["en", "es", "fr", "de", "pt"]
const CHECK = process.argv.includes("--check")
const TRANSLATORS = new Set(["t", "tr", "translate", "N_"])

/** le pagine che non sono l'editor dei documenti */
const APP_ENTRIES = [
  "app/[lang]/layout.tsx",
  "app/[lang]/page.tsx",
  "app/[lang]/board/[id]/page.tsx",
  "app/[lang]/not-found.tsx",
  "app/[lang]/error.tsx",
  "app/[lang]/[...missing]/page.tsx",
]
const ALL_ENTRIES = [
  ...APP_ENTRIES,
  "app/[lang]/doc/layout.tsx",
  "app/[lang]/doc/[id]/page.tsx",
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|mts)$/.test(name)) out.push(full)
  }
  return out
}

function resolveImport(from, spec) {
  let base
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec)
  else return null
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

const parsed = new Map()
function parse(file) {
  let hit = parsed.get(file)
  if (hit) return hit
  const code = readFileSync(file, "utf8")
  const sf = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const imports = new Set()
  const keys = new Set()
  // «t» è la traduzione solo dove arriva da useT() o dal traduttore del server:
  // altrove può essere una funzione locale (citations.ts)
  const tIsTranslator =
    /const t = useT\(\)|\{ t(, locale)? \} = await translator\(\)/.test(code)
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = resolveImport(file, node.moduleSpecifier.text)
      if (target) imports.add(target)
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const first = node.arguments[0]
      if (
        callee.kind === ts.SyntaxKind.ImportKeyword &&
        first &&
        ts.isStringLiteral(first)
      ) {
        const target = resolveImport(file, first.text)
        if (target) imports.add(target)
      }
      if (
        ts.isIdentifier(callee) &&
        TRANSLATORS.has(callee.text) &&
        (callee.text !== "t" || tIsTranslator) &&
        first &&
        ts.isStringLiteralLike(first)
      ) {
        keys.add(first.text)
      }
    }
    // new Worker(new URL("./x.worker.ts", import.meta.url))
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL"
    ) {
      const first = node.arguments?.[0]
      if (first && ts.isStringLiteral(first)) {
        const target = resolveImport(file, first.text)
        if (target) imports.add(target)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  hit = { imports, keys }
  parsed.set(file, hit)
  return hit
}

function reachable(entries) {
  const seen = new Set()
  const stack = entries
    .map((e) => path.join(ROOT, e))
    .filter((e) => existsSync(e))
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const next of parse(file).imports) stack.push(next)
  }
  return seen
}

const appFiles = reachable(APP_ENTRIES)
const allFiles = reachable(ALL_ENTRIES)
// anche i file che nessuna pagina importa direttamente ma che esistono
for (const dir of ["components", "lib", "app"])
  for (const f of walk(path.join(ROOT, dir))) allFiles.add(f)

const namespaces = { app: new Map(), doc: new Map() }
for (const file of allFiles) {
  if (file.includes(`${path.sep}lib${path.sep}i18n${path.sep}`)) continue
  const rel = path.relative(ROOT, file)
  for (const key of parse(file).keys) {
    const ns = appFiles.has(file) ? "app" : "doc"
    if (!namespaces[ns].has(key)) namespaces[ns].set(key, new Set())
    namespaces[ns].get(key).add(rel)
  }
}
// una frase che serve anche fuori dall'editor sta solo in «app»
for (const key of namespaces.app.keys()) namespaces.doc.delete(key)

const readCatalog = (ns) => {
  const file = path.join(CATALOG_DIR, `${ns}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
}
const previous = { ...readCatalog("app"), ...readCatalog("doc") }

let missing = 0
const report = []
for (const [ns, keys] of Object.entries(namespaces)) {
  const catalog = {}
  for (const key of [...keys.keys()].sort((a, b) => a.localeCompare(b, "it"))) {
    const old = previous[key] ?? {}
    const entry = {}
    for (const lang of TARGETS) {
      entry[lang] = old[lang] ?? ""
      if (!entry[lang]) {
        missing++
        if (report.length < 40)
          report.push(`${ns}: «${key}» → ${lang} (${[...keys.get(key)][0]})`)
      }
      // i segnaposto {nome} devono restare gli stessi
      const holes = (s) =>
        [...s.matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort()
          .join(",")
      if (entry[lang] && holes(entry[lang]) !== holes(key)) {
        missing++
        report.push(
          `${ns}: «${key}» → ${lang}: segnaposto diversi in «${entry[lang]}»`
        )
      }
    }
    catalog[key] = entry
  }
  if (!CHECK)
    writeFileSync(
      path.join(CATALOG_DIR, `${ns}.json`),
      `${JSON.stringify(catalog, null, 2)}\n`
    )
  console.log(`${ns}: ${keys.size} frasi`)
}

if (missing) {
  console.log(
    `\n${missing} traduzioni mancanti o non valide${report.length ? ":" : ""}`
  )
  for (const line of report) console.log(`  ${line}`)
  if (CHECK) process.exit(1)
} else {
  console.log("Tutte le frasi sono tradotte.")
}
