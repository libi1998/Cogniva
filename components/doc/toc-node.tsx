"use client"

import * as React from "react"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react"
import { TableOfContents } from "@/lib/tiptap-extensions"
import {
  captionEntries,
  DocIndex,
  FigureIndex,
  indexItems,
  type IndexKind,
} from "@/lib/doc-references"
import { getPagination, pageAt } from "@/lib/pagination"
import { formatPageNumber } from "@/lib/header-footer"
import { cn } from "@/lib/utils"

import { useT } from "@/lib/i18n/client"
/**
 * Sommario, indice delle figure, indice analitico e delle autorità: elenchi
 * calcolati dal documento a ogni modifica, con i numeri di pagina quando il
 * documento è impaginato.
 */

type Row = { level: number; text: string; pos: number; page: string }

/**
 * Confronto fra due elenchi calcolati dal documento.
 *
 * Questi selettori girano a ogni modifica, quindi anche a ogni tasto premuto:
 * confrontarli serializzandoli in JSON voleva dire costruire due stringhe
 * lunghe quanto tutto il sommario a ogni battuta. Qui si confrontano i campi,
 * che sono sempre stringhe o numeri.
 */
function sameRows<T extends Record<string, unknown>>(
  a: T[],
  b: T[] | null
): boolean {
  if (a === b) return true
  if (!b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    for (const key of Object.keys(x)) {
      const xv = x[key]
      const yv = y[key]
      if (xv === yv) continue
      if (Array.isArray(xv) && Array.isArray(yv)) {
        if (
          !sameRows(
            xv as Record<string, unknown>[],
            yv as Record<string, unknown>[]
          )
        )
          return false
        continue
      }
      return false
    }
  }
  return true
}

/** Il numero di pagina di una posizione, se il documento ha più pagine */
function pageLabel(editor: Editor, pos: number) {
  const state = editor.state
  if (getPagination(state).pages <= 1) return ""
  const settings = editor.storage.field
  return formatPageNumber(
    pageAt(state, pos) + (settings?.pageStart ?? 1) - 1,
    settings?.pageFormat ?? "arabic"
  )
}

function go(editor: Editor, pos: number) {
  editor
    .chain()
    .focus(pos + 1)
    .scrollIntoView()
    .run()
}

function RowButton({
  editor,
  row,
  leaders,
}: {
  editor: Editor
  row: Row
  leaders: boolean
}) {
  const t = useT()
  return (
    <li data-level={row.level}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(editor, row.pos)}
      >
        <span className="doc-toc-text">{row.text || t("Senza titolo")}</span>
        {leaders && row.page ? (
          <>
            <span aria-hidden className="doc-toc-leader" />
            <span className="doc-toc-page">{row.page}</span>
          </>
        ) : null}
      </button>
    </li>
  )
}

function TocView({ editor, node, selected }: NodeViewProps) {
  const t = useT()
  const variant = String(node.attrs.variant ?? "card")
  const levels = Number(node.attrs.levels ?? 3)
  const rows =
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        const out: Row[] = []
        e.state.doc.forEach((child, offset) => {
          if (child.type.name !== "heading") return
          const level = Number(child.attrs.level ?? 1)
          if (level > levels) return
          out.push({
            level,
            text: child.textContent,
            pos: offset,
            page: variant === "classic" ? pageLabel(e, offset) : "",
          })
        })
        return out
      },
      equalityFn: sameRows,
    }) ?? []

  return (
    <NodeViewWrapper
      as="nav"
      className={cn("doc-toc", selected && "is-selected")}
      data-variant={variant}
      data-kind="toc"
      contentEditable={false}
    >
      <p className="doc-toc-title">{t("Sommario")}</p>
      {rows.length ? (
        <ol>
          {rows.map((row, i) => (
            <RowButton
              key={`${row.pos}-${i}`}
              editor={editor}
              row={row}
              leaders={variant === "classic"}
            />
          ))}
        </ol>
      ) : (
        <p className="doc-toc-empty">
          {t("Aggiungi dei titoli (Titolo 1, 2 o 3) e compariranno qui.")}
        </p>
      )}
    </NodeViewWrapper>
  )
}

function FigureIndexView({ editor, node, selected }: NodeViewProps) {
  const t = useT()
  const label = String(node.attrs.label ?? t("Figura"))
  const rows =
    useEditorState({
      editor,
      selector: ({ editor: e }) =>
        captionEntries(e.state, label).map((entry): Row => ({
          level: 1,
          text: entry.text,
          pos: entry.pos,
          page: pageLabel(e, entry.pos),
        })),
      equalityFn: sameRows,
    }) ?? []
  // le etichette standard hanno il loro titolo in ogni lingua: prima in
  // inglese si leggeva «Table of figure», in tedesco «Verzeichnis der
  // abbildung»
  const title =
    label === t("Figura")
      ? t("Indice delle figure")
      : label === t("Tabella")
        ? t("Indice delle tabelle")
        : label === t("Equazione")
          ? t("Indice delle equazioni")
          : t("Indice delle {items}", { items: label })

  return (
    <NodeViewWrapper
      as="nav"
      className={cn("doc-toc", selected && "is-selected")}
      data-variant="classic"
      contentEditable={false}
    >
      <p className="doc-toc-title">{title}</p>
      {rows.length ? (
        <ol>
          {rows.map((row, i) => (
            <RowButton
              key={`${row.pos}-${i}`}
              editor={editor}
              row={row}
              leaders
            />
          ))}
        </ol>
      ) : (
        <p className="doc-toc-empty">
          {t(
            "Nessuna didascalia «{label}»: aggiungila con Inserisci didascalia.",
            {
              label,
            }
          )}
        </p>
      )}
    </NodeViewWrapper>
  )
}

function DocIndexView({ editor, node, selected }: NodeViewProps) {
  const t = useT()
  const kind = (node.attrs.kind ?? "index") as IndexKind
  const columns = Number(node.attrs.columns ?? 2)
  const items =
    useEditorState({
      editor,
      selector: ({ editor: e }) =>
        indexItems(e.state.doc, kind).map((item) => ({
          entry: item.entry,
          category: item.category,
          first: item.positions[0] ?? item.subs[0]?.positions[0] ?? 0,
          pages: [...new Set(item.positions.map((p) => pageLabel(e, p)))]
            .filter(Boolean)
            .join(", "),
          subs: item.subs.map((sub) => ({
            sub: sub.sub,
            first: sub.positions[0],
            pages: [...new Set(sub.positions.map((p) => pageLabel(e, p)))]
              .filter(Boolean)
              .join(", "),
          })),
        })),
      equalityFn: sameRows,
    }) ?? []

  // l'indice analitico si divide per iniziale, quello delle autorità per tipo
  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key =
      kind === "authority"
        ? item.category || t("Altre fonti")
        : item.entry.charAt(0).toLocaleUpperCase("it")
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return (
    <NodeViewWrapper
      as="nav"
      className={cn("doc-toc doc-index", selected && "is-selected")}
      data-variant="classic"
      contentEditable={false}
      style={{ "--index-columns": columns } as React.CSSProperties}
    >
      <p className="doc-toc-title">
        {kind === "authority"
          ? t("Indice delle autorità")
          : t("Indice analitico")}
      </p>
      {items.length ? (
        <div className="doc-index-body">
          {[...groups].map(([group, list]) => (
            <div key={group} className="doc-index-group">
              <p className="doc-index-letter">{group}</p>
              <ol>
                {list.map((item) => (
                  <React.Fragment key={item.entry}>
                    <RowButton
                      editor={editor}
                      row={{
                        level: 1,
                        text: item.entry,
                        pos: item.first,
                        page: item.pages,
                      }}
                      leaders
                    />
                    {item.subs.map((sub) => (
                      <RowButton
                        key={sub.sub}
                        editor={editor}
                        row={{
                          level: 2,
                          text: sub.sub,
                          pos: sub.first,
                          page: sub.pages,
                        }}
                        leaders
                      />
                    ))}
                  </React.Fragment>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="doc-toc-empty">
          {kind === "authority"
            ? t("Segna le citazioni con Riferimenti › Segna citazione.")
            : t("Segna le voci con Riferimenti › Segna voce.")}
        </p>
      )}
    </NodeViewWrapper>
  )
}

/** Sommario con la sua vista React */
export const DocToc = TableOfContents.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TocView)
  },
})

export const DocFigureIndex = FigureIndex.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FigureIndexView)
  },
})

export const DocIndexNode = DocIndex.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DocIndexView)
  },
})
