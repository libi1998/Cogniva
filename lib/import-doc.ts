"use client"

import { getSchema, type JSONContent } from "@tiptap/core"
import { DOMParser as ProseMirrorParser, type Schema } from "@tiptap/pm/model"
import { nanoid } from "nanoid"
import { createDocExtensions } from "@/components/doc/extensions"
import { newDocTheme } from "./doc-design"
import type { WFile } from "./types"

/**
 * Importazione di documenti Word (.docx), Markdown (.md), HTML e testo.
 *
 * Tutti i formati passano da HTML e poi dallo schema dell'editor: così un
 * documento importato si comporta esattamente come uno scritto a mano. Le
 * librerie di conversione si scaricano solo quando servono.
 */

let schema: Schema | null = null

function docSchema() {
  schema ??= getSchema(createDocExtensions())
  return schema
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").trim()

/** Un documento nuovo con il contenuto dato */
function makeDoc(title: string, content: JSONContent): WFile {
  const now = Date.now()
  return {
    id: nanoid(10),
    kind: "doc",
    title: title || "Documento importato",
    icon: "file-text",
    createdAt: now,
    updatedAt: now,
    data: { content, theme: newDocTheme() },
  }
}

/**
 * HTML → contenuto dell'editor. Il primo titolo di livello 1 diventa il
 * titolo del documento; se manca si usa il nome del file.
 */
function htmlToDoc(html: string, fallbackTitle: string): WFile {
  const dom = new window.DOMParser().parseFromString(html, "text/html")
  const body = dom.body
  normalizeImportedDom(body)

  let title = fallbackTitle
  const first = body.firstElementChild
  if (first?.tagName === "H1" && first.textContent?.trim()) {
    title = first.textContent.trim()
    first.remove()
  }

  const doc = ProseMirrorParser.fromSchema(docSchema()).parse(body)
  const json = doc.toJSON() as JSONContent
  const content = json.content ?? []
  // il primo titolo del file diventa lo stile «Titolo doc» in cima; senza,
  // il documento comincia direttamente dal testo
  if (title) {
    const titleNode: JSONContent = {
      type: "docTitle",
      content: [{ type: "text", text: title }],
    }
    if (content[0]?.type === "docTitle") content[0] = titleNode
    else content.unshift(titleNode)
  }
  if (!content.length || (content.length === 1 && title)) {
    content.push({ type: "paragraph" })
  }
  return makeDoc(title, { type: "doc", content })
}

/**
 * Sistema l'HTML delle conversioni prima dello schema: note a piè di pagina
 * di Word, liste di controllo e formule del Markdown.
 */
function normalizeImportedDom(body: HTMLElement) {
  // note di Word: mammoth le mette in fondo con dei collegamenti avanti e indietro
  for (const kind of ["footnote", "endnote"] as const) {
    body
      .querySelectorAll<HTMLAnchorElement>(`a[href^="#${kind}-"]`)
      .forEach((link) => {
        const target = body.querySelector(link.getAttribute("href") ?? "")
        if (!target || target.tagName !== "LI") return
        const text = (target.textContent ?? "").replace(/\s*↑\s*$/, "").trim()
        const note = document.createElement("sup")
        note.setAttribute("data-footnote", "")
        note.setAttribute("data-text", text)
        note.setAttribute("data-kind", kind)
        const holder = link.closest("sup") ?? link
        holder.replaceWith(note)
      })
    body.querySelectorAll(`li[id^="${kind}-"]`).forEach((li) => {
      const list = li.parentElement
      li.remove()
      if (list && !list.children.length) list.remove()
    })
  }

  // liste di controllo del Markdown: <li><input type="checkbox"> testo
  body.querySelectorAll("li").forEach((li) => {
    const box = li.querySelector(
      ":scope > input[type=checkbox], :scope > p > input[type=checkbox]"
    )
    if (!box) return
    const checked = (box as HTMLInputElement).checked
    box.remove()
    li.setAttribute("data-type", "taskItem")
    li.setAttribute("data-checked", checked ? "true" : "false")
    li.parentElement?.setAttribute("data-type", "taskList")
  })

  // formule: $$…$$ su una riga sola, $…$ dentro al testo
  body.querySelectorAll("p").forEach((p) => {
    const text = p.textContent?.trim() ?? ""
    const block = text.match(/^\$\$([\s\S]+)\$\$$/)
    if (block && p.children.length === 0) {
      const div = document.createElement("div")
      div.setAttribute("data-math-block", "")
      div.setAttribute("data-latex", block[1].trim())
      p.replaceWith(div)
    }
  })
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (
      /\$[^$\s][^$]*\$/.test(n.nodeValue ?? "") &&
      !n.parentElement?.closest("code, pre")
    ) {
      texts.push(n as Text)
    }
  }
  for (const node of texts) {
    const parts = (node.nodeValue ?? "").split(/(\$[^$\s](?:[^$]*[^$\s])?\$)/)
    const frag = document.createDocumentFragment()
    for (const part of parts) {
      if (/^\$[^$]+\$$/.test(part)) {
        const span = document.createElement("span")
        span.setAttribute("data-math-inline", "")
        span.setAttribute("data-latex", part.slice(1, -1))
        frag.appendChild(span)
      } else if (part) {
        frag.appendChild(document.createTextNode(part))
      }
    }
    node.replaceWith(frag)
  }
}

/** Documento Word: testo, titoli, elenchi, tabelle, immagini e note */
async function importDocx(file: File): Promise<{
  file: WFile
  warnings: number
}> {
  const mammoth = await import("mammoth")
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Titolo'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Citazione'] => blockquote > p:fresh",
        "r[style-name='Strong'] => strong",
        "u => u",
        "strike => s",
      ],
    }
  )
  const warnings = result.messages.filter((m) => m.type === "warning").length
  return { file: htmlToDoc(result.value, baseName(file.name)), warnings }
}

/** Markdown con tabelle, liste di controllo e formule */
async function importMarkdown(file: File): Promise<WFile> {
  const { marked } = await import("marked")
  const html = await marked.parse(markdownFootnotes(await file.text()), {
    gfm: true,
  })
  return htmlToDoc(html, baseName(file.name))
}

/**
 * Note in stile [^1]: il Markdown di base non le conosce, quindi le definizioni
 * «[^1]: testo» si tolgono e i richiami diventano note dell'editor.
 */
function markdownFootnotes(source: string) {
  const notes = new Map<string, string>()
  const body = source.replace(
    /^\[\^([^\]\s]+)\]:[ \t]*(.*(?:\n(?: {2,}|\t).*)*)/gm,
    (_, id: string, text: string) => {
      notes.set(id, text.replace(/\n\s+/g, " ").trim())
      return ""
    }
  )
  if (!notes.size) return source
  const attr = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  return body.replace(/\[\^([^\]\s]+)\]/g, (match, id: string) =>
    notes.has(id)
      ? `<sup data-footnote data-kind="footnote" data-text="${attr(notes.get(id)!)}">*</sup>`
      : match
  )
}

/** Testo semplice: un paragrafo per riga, le righe vuote separano i blocchi */
async function importText(file: File): Promise<WFile> {
  const text = await file.text()
  const html = text
    .split(/\n{2,}/)
    .map((block) => {
      const escaped = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
      return `<p>${escaped.replace(/\n/g, "<br>")}</p>`
    })
    .join("")
  return htmlToDoc(html, baseName(file.name))
}

/** Sceglie il convertitore giusto dall'estensione del file */
export async function importDocumentFile(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith(".docx")) return importDocx(file)
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return { file: await importMarkdown(file), warnings: 0 }
  }
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    return {
      file: htmlToDoc(await file.text(), baseName(file.name)),
      warnings: 0,
    }
  }
  if (name.endsWith(".txt"))
    return { file: await importText(file), warnings: 0 }
  if (name.endsWith(".doc")) {
    throw new Error(
      "Il vecchio formato .doc non è supportato: salvalo come .docx da Word e riprova."
    )
  }
  throw new Error("Formato non supportato")
}
