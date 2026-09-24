import { Node, mergeAttributes, type JSONContent } from "@tiptap/core"
import type { Editor } from "@tiptap/core"
import type { MergeData, MergeRule } from "./types"
import { guessDelimiter, splitDelimited } from "./delimited"
import { currentLocale, tr } from "@/lib/i18n/client"
import { N_, stripContext } from "@/lib/i18n/config"
/**
 * Stampa unione della scheda Corrispondenza: campi «Nome», regole
 * Se…Allora…Altrimenti, elenco destinatari (anche da CSV), anteprima dei
 * risultati e documento unito. Più buste ed etichette.
 */

/** I campi di un elenco destinatari nuovo, con un nome in ogni lingua */
export type MergeFieldKey =
  | "title"
  | "first"
  | "last"
  | "company"
  | "address"
  | "zip"
  | "city"
  | "region"
  | "email"

const FIELD_SOURCES: Record<MergeFieldKey, string> = {
  title: N_("Titolo||titolo di cortesia, come Sig. o Dott."),
  first: N_("Nome||nome di battesimo"),
  last: N_("Cognome"),
  company: N_("Società"),
  address: N_("Indirizzo"),
  zip: N_("CAP"),
  city: N_("Città"),
  region: N_("Provincia"),
  email: N_("Email"),
}

/** Il nome della colonna nella lingua dell'interfaccia */
export const fieldName = (key: MergeFieldKey) => tr(FIELD_SOURCES[key])

export const defaultFields = () =>
  (Object.keys(FIELD_SOURCES) as MergeFieldKey[]).map(fieldName)

/**
 * La colonna di un elenco che corrisponde a un campo: con il nome nella
 * lingua attiva oppure in italiano (gli elenchi creati prima delle lingue).
 */
export function findField(
  fields: string[],
  key: MergeFieldKey
): string | undefined {
  const names = new Set(
    [fieldName(key), stripContext(FIELD_SOURCES[key])].map((n) =>
      n.toLocaleLowerCase()
    )
  )
  return fields.find((f) => names.has(f.trim().toLocaleLowerCase()))
}

export function emptyMerge(type: MergeData["type"] = "letters"): MergeData {
  return {
    type,
    fields: defaultFields(),
    rows: [],
    excluded: [],
    preview: -1,
  }
}

/* ---------------------------------- CSV ---------------------------------- */

/** CSV, TSV o «;» (Excel italiano): virgolette, a capo nelle celle, BOM */
export function parseDelimited(text: string): {
  fields: string[]
  rows: Record<string, string>[]
} {
  // le virgolette contano solo in testa alla cella: in «Schermo 5"» sono un
  // carattere, e prima si mangiavano tutte le righe fino alla fine
  const table = splitDelimited(text, guessDelimiter(text))
  const nonEmpty = table.filter((r) => r.some((v) => v.trim()))
  const header = (nonEmpty[0] ?? []).map((h, i) => h.trim() || `Campo${i + 1}`)
  // nomi ripetuti: «Nome», «Nome 2»
  const fields = header.map((h, i) =>
    header.indexOf(h) === i
      ? h
      : `${h} ${header.slice(0, i).filter((x) => x === h).length + 1}`
  )
  const rows = nonEmpty
    .slice(1)
    .map((r) =>
      Object.fromEntries(fields.map((f, i) => [f, (r[i] ?? "").trim()]))
    )
  return { fields: fields.slice(0, 60), rows: rows.slice(0, 5000) }
}

export function toCsv(merge: MergeData) {
  const quote = (v: string) =>
    /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  return [
    merge.fields.map(quote).join(";"),
    ...merge.rows.map((r) =>
      merge.fields.map((f) => quote(r[f] ?? "")).join(";")
    ),
  ].join("\n")
}

/* --------------------------------- regole -------------------------------- */

export const RULE_OPS: { value: MergeRule["op"]; label: string }[] = [
  {
    value: "eq",
    get label() {
      return tr("Uguale a")
    },
  },
  {
    value: "ne",
    get label() {
      return tr("Diverso da")
    },
  },
  {
    value: "lt",
    get label() {
      return tr("Minore di")
    },
  },
  {
    value: "gt",
    get label() {
      return tr("Maggiore di")
    },
  },
  {
    value: "contains",
    get label() {
      return tr("Contiene")
    },
  },
  {
    value: "empty",
    get label() {
      return tr("È vuoto")
    },
  },
  {
    value: "filled",
    get label() {
      return tr("Non è vuoto")
    },
  },
]

export function testRule(row: Record<string, string>, rule: MergeRule) {
  const value = (row[rule.field] ?? "").trim()
  const other = rule.value.trim()
  const a = Number(value.replace(",", "."))
  const b = Number(other.replace(",", "."))
  const numeric =
    value !== "" && other !== "" && Number.isFinite(a) && Number.isFinite(b)
  const cmp = numeric
    ? a - b
    : value.localeCompare(other, currentLocale(), { sensitivity: "base" })
  switch (rule.op) {
    case "eq":
      return cmp === 0
    case "ne":
      return cmp !== 0
    case "lt":
      return cmp < 0
    case "gt":
      return cmp > 0
    case "contains":
      return value
        .toLocaleLowerCase("it")
        .includes(other.toLocaleLowerCase("it"))
    case "empty":
      return value === ""
    case "filled":
      return value !== ""
    default:
      return false
  }
}

/** I record che finiscono nell'unione: né esclusi né saltati da una regola */
export function mergedRows(merge: MergeData) {
  const excluded = new Set(merge.excluded)
  return merge.rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row, index }) =>
        !excluded.has(index) &&
        !(merge.skip ?? []).some((rule) => testRule(row, rule))
    )
}

/* ------------------------------- documento ------------------------------ */

const text = (value: string, marks?: JSONContent["marks"]): JSONContent[] =>
  value
    ? [{ type: "text", text: value, ...(marks?.length ? { marks } : {}) }]
    : []

/** Il contenuto con i campi sostituiti dai valori di un record */
export function fillContent(
  node: JSONContent,
  row: Record<string, string>
): JSONContent[] {
  if (node.type === "mergeField") {
    const name = String(node.attrs?.name ?? "")
    return text(row[name] ?? "", node.marks)
  }
  if (node.type === "mergeIf") {
    const a = node.attrs ?? {}
    const ok = testRule(row, {
      field: String(a.field ?? ""),
      op: (a.op ?? "eq") as MergeRule["op"],
      value: String(a.value ?? ""),
    })
    return text(String(ok ? (a.then ?? "") : (a.otherwise ?? "")), node.marks)
  }
  if (!node.content) return [node]
  return [
    {
      ...node,
      content: node.content.flatMap((child) => fillContent(child, row)),
    },
  ]
}

/** «Modifica singoli documenti»: un documento per record, uno per pagina */
export function mergedDocument(
  content: JSONContent,
  merge: MergeData
): JSONContent {
  const records = mergedRows(merge)
  const blocks = content.content ?? []
  const out: JSONContent[] = []
  records.forEach(({ row }, i) => {
    if (i > 0) out.push({ type: "pageBreak" })
    for (const block of blocks) {
      // il titolo del modello diventa un Titolo 1 in ogni lettera: tutte
      // uguali, e il documento unito tiene il suo nome («… — unione»)
      // invece di prendere quello della prima riga
      const filled = fillContent(block, row)
      for (const node of filled) {
        out.push(
          node.type === "docTitle"
            ? { ...node, type: "heading", attrs: { level: 1 } }
            : node
        )
      }
    }
  })
  return { type: "doc", content: out }
}

/** I campi usati nel documento, per «Controlla errori» */
export function usedFields(content: JSONContent): string[] {
  const found = new Set<string>()
  const walk = (node: JSONContent) => {
    if (node.type === "mergeField" && node.attrs?.name)
      found.add(String(node.attrs.name))
    if (node.type === "mergeIf" && node.attrs?.field)
      found.add(String(node.attrs.field))
    node.content?.forEach(walk)
  }
  walk(content)
  return [...found]
}

/** Il testo di un record per un'etichetta o una busta (blocco indirizzo) */
export function addressText(row: Record<string, string>) {
  const fields = Object.keys(row)
  const value = (key: MergeFieldKey) => {
    const name = findField(fields, key)
    return name ? (row[name] ?? "").trim() : ""
  }
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ")
  const region = value("region")
  // ogni paese scrive la località a modo suo
  const place =
    currentLocale() === "en"
      ? join([value("city"), region].filter(Boolean).join(", "), value("zip"))
      : join(value("zip"), value("city"), region ? `(${region})` : "")
  return [
    join(value("title"), value("first"), value("last")),
    value("company"),
    value("address"),
    place,
  ]
    .filter(Boolean)
    .join("\n")
}

/* ---------------------------- buste ed etichette ------------------------- */

export const ENVELOPES: {
  format: "dl" | "c5" | "c6"
  label: string
  hint: string
}[] = [
  {
    format: "dl",
    label: "DL",
    get hint() {
      return tr("110 × 220 mm · lettera A4 piegata in tre")
    },
  },
  {
    format: "c5",
    label: "C5",
    get hint() {
      return tr("162 × 229 mm · A4 piegato a metà")
    },
  },
  {
    format: "c6",
    label: "C6",
    get hint() {
      return tr("114 × 162 mm · A5 piegato a metà")
    },
  },
]

export type LabelProduct = {
  id: string
  label: string
  cols: number
  rows: number
  /** misure in millimetri */
  w: number
  h: number
  marginTop: number
  marginSide: number
}

export const LABEL_PRODUCTS: LabelProduct[] = [
  {
    id: "l7160",
    get label() {
      return tr("Avery L7160 · 21 per foglio")
    },
    cols: 3,
    rows: 7,
    w: 63.5,
    h: 38.1,
    marginTop: 15.1,
    marginSide: 7.2,
  },
  {
    id: "l7163",
    get label() {
      return tr("Avery L7163 · 14 per foglio")
    },
    cols: 2,
    rows: 7,
    w: 99.1,
    h: 38.1,
    marginTop: 15.1,
    marginSide: 4.6,
  },
  {
    id: "l7159",
    get label() {
      return tr("Avery L7159 · 24 per foglio")
    },
    cols: 3,
    rows: 8,
    w: 63.5,
    h: 33.9,
    marginTop: 13.1,
    marginSide: 6.5,
  },
  {
    id: "l7165",
    get label() {
      return tr("Avery L7165 · 8 per foglio")
    },
    cols: 2,
    rows: 4,
    w: 99.1,
    h: 67.7,
    marginTop: 13.1,
    marginSide: 4.6,
  },
  {
    id: "3474",
    get label() {
      return tr("Avery 3474 · 24 per foglio")
    },
    cols: 3,
    rows: 8,
    w: 70,
    h: 37,
    marginTop: 0,
    marginSide: 0,
  },
  {
    id: "tico",
    get label() {
      return tr("Tico A4 · 12 per foglio")
    },
    cols: 2,
    rows: 6,
    w: 105,
    h: 48,
    marginTop: 4.5,
    marginSide: 0,
  },
]

const MM = 96 / 25.4

/** Un foglio di etichette: una tabella senza bordi, righe alte come l'etichetta */
export function labelsContent(
  texts: string[],
  product: LabelProduct
): JSONContent {
  const perPage = product.cols * product.rows
  const count = Math.max(perPage, Math.ceil(texts.length / perPage) * perPage)
  const cells = Array.from({ length: count }, (_, i) => texts[i] ?? "")
  const rows: JSONContent[] = []
  for (let r = 0; r < cells.length / product.cols; r += 1) {
    rows.push({
      type: "tableRow",
      content: cells
        .slice(r * product.cols, (r + 1) * product.cols)
        .map((value) => ({
          type: "tableCell",
          attrs: { colwidth: [Math.round(product.w * MM)] },
          content: value
            ? value.split("\n").map((line) => ({
                type: "paragraph",
                attrs: { spaceAfter: "0px", lineHeight: "1.2" },
                content: text(line),
              }))
            : [{ type: "paragraph" }],
        })),
    })
  }
  return {
    type: "table",
    attrs: { borderWidth: 0, rowHeight: product.h },
    content: rows,
  }
}

export function labelsMargins(product: LabelProduct) {
  return {
    top: Math.max(8, product.marginTop * MM),
    bottom: Math.max(8, product.marginTop * MM),
    left: Math.max(8, product.marginSide * MM),
    right: Math.max(8, product.marginSide * MM),
  }
}

/* ------------------------------- nodi campo ------------------------------ */

export type MergeSettings = {
  row: Record<string, string> | null
  highlight: boolean
}

declare module "@tiptap/core" {
  interface Storage {
    mergeField: MergeSettings
  }
  interface Commands<ReturnType> {
    mergeField: {
      insertMergeField: (name: string) => ReturnType
      insertMergeRule: (rule: {
        field: string
        op: MergeRule["op"]
        value: string
        then: string
        otherwise: string
      }) => ReturnType
    }
  }
}

function mergeNodeView(
  editor: Editor,
  render: (row: Record<string, string> | null) => {
    text: string
    title: string
  }
) {
  const dom = document.createElement("span")
  dom.className = "doc-merge-field"
  dom.contentEditable = "false"
  const paint = () => {
    const settings = editor.storage.mergeField
    const { text: value, title } = render(settings?.row ?? null)
    if (dom.textContent !== value) dom.textContent = value
    dom.title = title
    dom.toggleAttribute("data-highlight", Boolean(settings?.highlight))
    dom.toggleAttribute("data-preview", Boolean(settings?.row))
  }
  paint()
  editor.on("transaction", paint)
  return { dom, paint, destroy: () => editor.off("transaction", paint) }
}

export const MergeField = Node.create<Record<string, never>, MergeSettings>({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addStorage() {
    return { row: null, highlight: false }
  },

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-merge-field") ?? "",
        renderHTML: (a) => ({ "data-merge-field": a.name }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-merge-field]" }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes({ class: "doc-merge-field" }, HTMLAttributes),
      `«${node.attrs.name}»`,
    ]
  },

  renderText({ node }) {
    return `«${node.attrs.name}»`
  },

  addNodeView() {
    return ({ node, editor }) => {
      let current = node
      const view = mergeNodeView(editor, (row) => {
        const name = String(current.attrs.name)
        return row
          ? { text: row[name] ?? "", title: tr("Campo «{name}»", { name }) }
          : { text: `«${name}»`, title: tr("Campo unione") }
      })
      return {
        dom: view.dom,
        update: (next) => {
          if (next.type !== current.type) return false
          current = next
          view.paint()
          return true
        },
        ignoreMutation: () => true,
        destroy: view.destroy,
      }
    }
  },

  addCommands() {
    return {
      insertMergeField:
        (name) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { name } }),
      insertMergeRule:
        (rule) =>
        ({ commands }) =>
          commands.insertContent({ type: "mergeIf", attrs: rule }),
    }
  },
})

export const MergeIf = Node.create({
  name: "mergeIf",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    const attr = (name: string, fallback = "") => ({
      default: fallback,
      parseHTML: (el: HTMLElement) =>
        el.getAttribute(`data-${name}`) ?? fallback,
      renderHTML: (a: Record<string, unknown>) => ({
        [`data-${name}`]: String(a[name] ?? ""),
      }),
    })
    return {
      field: attr("field"),
      op: attr("op", "eq"),
      value: attr("value"),
      then: attr("then"),
      otherwise: attr("otherwise"),
    }
  },

  parseHTML() {
    return [{ tag: "span[data-merge-if]" }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(
        { class: "doc-merge-field", "data-merge-if": "" },
        HTMLAttributes
      ),
      `«Se ${node.attrs.field}»`,
    ]
  },

  addNodeView() {
    return ({ node, editor }) => {
      let current = node
      const view = mergeNodeView(editor, (row) => {
        const a = current.attrs
        const op =
          RULE_OPS.find((o) => o.value === a.op)?.label.toLowerCase() ?? a.op
        const title = tr(
          "Se «{field}» {op} {value} allora «{then}» altrimenti «{otherwise}»",
          {
            field: a.field,
            op,
            value: a.value,
            then: a.then,
            otherwise: a.otherwise,
          }
        )
        if (!row)
          return { text: tr("«Se {field}…»", { field: a.field }), title }
        const ok = testRule(row, { field: a.field, op: a.op, value: a.value })
        return { text: String(ok ? a.then : a.otherwise), title }
      })
      return {
        dom: view.dom,
        update: (next) => {
          if (next.type !== current.type) return false
          current = next
          view.paint()
          return true
        },
        ignoreMutation: () => true,
        destroy: view.destroy,
      }
    }
  },
})

/** Il record in anteprima e l'evidenziazione, dalla scheda al documento */
export function setMergeSettings(editor: Editor, next: MergeSettings) {
  const storage = editor.storage.mergeField
  if (!storage || editor.isDestroyed) return
  if (storage.row === next.row && storage.highlight === next.highlight) return
  storage.row = next.row
  storage.highlight = next.highlight
  editor.view.dispatch(
    editor.state.tr
      .setMeta("addToHistory", false)
      .setMeta("mergeSettings", true)
  )
}
