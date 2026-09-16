"use client"

import { InputRule, Node, mergeAttributes } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import katex from "katex"
import { tr } from "@/lib/i18n/client"
import "katex/dist/katex.min.css"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      insertMath: (latex: string, display: boolean) => ReturnType
      /** passa da equazione nel testo a equazione su riga propria e ritorno */
      toggleMathDisplay: () => ReturnType
    }
  }
}

/**
 * Disegna una formula LaTeX. Solo HTML (niente MathML nascosto): la copia del
 * foglio per le esportazioni non conosce le regole che lo nascondono.
 */
function renderMath(el: HTMLElement, latex: string, display: boolean) {
  const source = latex.trim()
  if (!source) {
    el.textContent = display ? tr("Equazione vuota") : "∅"
    el.classList.add("doc-math-empty")
    return
  }
  el.classList.remove("doc-math-empty")
  katex.render(source, el, {
    displayMode: display,
    throwOnError: false,
    output: "html",
    strict: "ignore",
    trust: false,
  })
}

/** L'errore di una formula, o null se è corretta */
export function mathError(latex: string): string | null {
  if (!latex.trim()) return null
  try {
    katex.renderToString(latex, { throwOnError: true, strict: "ignore" })
    return null
  } catch (err) {
    return err instanceof Error
      ? err.message.replace(/^KaTeX parse error:\s*/, "")
      : tr("Formula non valida")
  }
}

export function mathHtml(latex: string, display = false) {
  return katex.renderToString(latex, {
    displayMode: display,
    throwOnError: false,
    output: "html",
    strict: "ignore",
  })
}

const latexAttr = {
  latex: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-latex") ?? "",
    renderHTML: (attrs: Record<string, unknown>) => ({
      "data-latex": String(attrs.latex ?? ""),
    }),
  },
}

/** Vista senza React: su un documento con cento formule conta */
function mathView(display: boolean) {
  return ({
    node,
  }: {
    node: { attrs: Record<string, unknown>; type: unknown }
  }) => {
    const dom = document.createElement(display ? "div" : "span")
    dom.className = display ? "doc-math doc-math-block" : "doc-math"
    dom.contentEditable = "false"
    let current = String(node.attrs.latex ?? "")
    dom.setAttribute("aria-label", current || tr("Equazione"))
    dom.setAttribute("role", "math")
    renderMath(dom, current, display)
    return {
      dom,
      update: (next: { attrs: Record<string, unknown>; type: unknown }) => {
        if (next.type !== node.type) return false
        const latex = String(next.attrs.latex ?? "")
        if (latex !== current) {
          current = latex
          dom.setAttribute("aria-label", latex || tr("Equazione"))
          renderMath(dom, latex, display)
        }
        return true
      },
      selectNode: () => dom.classList.add("is-selected"),
      deselectNode: () => dom.classList.remove("is-selected"),
      ignoreMutation: () => true,
    }
  }
}

/** Equazione nel testo: `$x^2$` scritto a mano diventa una formula */
export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return latexAttr
  },
  parseHTML() {
    // prima delle regole generiche di titoli, apici ed evidenziatori
    return [{ tag: "span[data-math-inline]", priority: 60 }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-inline": "" })]
  },
  renderText({ node }) {
    return `$${node.attrs.latex}$`
  },
  addNodeView() {
    return mathView(false) as never
  },
  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)\$([^$\s](?:[^$]*[^$\s])?)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1]
          const start = range.from + (match[0].startsWith("$") ? 0 : 1)
          state.tr.replaceWith(start, range.to, this.type.create({ latex }))
        },
      }),
    ]
  },
  addCommands() {
    return {
      insertMath:
        (latex, display) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: display ? "mathBlock" : "mathInline",
              attrs: { latex },
            })
            // la formula nuova resta selezionata: il pannello la apre
            .command(({ tr }) => {
              const name = display ? "mathBlock" : "mathInline"
              for (const pos of [tr.selection.from - 1, tr.selection.from]) {
                if (pos < 0) continue
                const found = tr.doc.nodeAt(pos)
                if (found?.type.name === name) {
                  tr.setSelection(NodeSelection.create(tr.doc, pos))
                  break
                }
              }
              // un blocco inserito lascia il cursore nel paragrafo dopo
              if (
                display &&
                !(tr.selection instanceof NodeSelection) &&
                tr.selection.$from.depth >= 1
              ) {
                const start = tr.selection.$from.before(1)
                const prev = tr.doc.resolve(start).nodeBefore
                if (prev?.type.name === name) {
                  tr.setSelection(
                    NodeSelection.create(tr.doc, start - prev.nodeSize)
                  )
                }
              }
              return true
            })
            .run(),
      toggleMathDisplay:
        () =>
        ({ state, tr, dispatch }) => {
          const sel = state.selection
          if (!(sel instanceof NodeSelection)) return false
          const node = sel.node
          const name = node.type.name
          if (name !== "mathInline" && name !== "mathBlock") return false
          if (!dispatch) return true
          const target =
            state.schema.nodes[
              name === "mathInline" ? "mathBlock" : "mathInline"
            ]
          const replacement = target.create({ latex: node.attrs.latex })
          if (name === "mathInline") {
            // su riga propria: il paragrafo si spezza intorno alla formula
            tr.delete(sel.from, sel.to)
            tr.split(sel.from)
            tr.insert(sel.from + 1, replacement)
            tr.setSelection(NodeSelection.create(tr.doc, sel.from + 1))
          } else {
            const paragraph = state.schema.nodes.paragraph.create(null, [
              replacement,
            ])
            tr.replaceWith(sel.from, sel.to, paragraph)
            tr.setSelection(NodeSelection.create(tr.doc, sel.from + 1))
          }
          return true
        },
    }
  },
})

/** Equazione su una riga propria, centrata */
export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return latexAttr
  },
  parseHTML() {
    return [{ tag: "div[data-math-block]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "" })]
  },
  renderText({ node }) {
    return `$$${node.attrs.latex}$$`
  },
  addNodeView() {
    return mathView(true) as never
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$([^$]+)\$\$$/,
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from)
          const block = $from.before($from.depth)
          state.tr.replaceWith(
            block,
            $from.after($from.depth),
            this.type.create({ latex: match[1] })
          )
        },
      }),
    ]
  },
})

/** Le equazioni pronte del menu, come in Word */
export const BUILTIN_EQUATIONS: { label: string; latex: string }[] = [
  {
    get label() {
      return tr("Area del cerchio")
    },
    latex: "A = \\pi r^2",
  },
  {
    get label() {
      return tr("Formula quadratica")
    },
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  },
  {
    get label() {
      return tr("Teorema di Pitagora")
    },
    latex: "a^2 + b^2 = c^2",
  },
  {
    get label() {
      return tr("Teorema binomiale")
    },
    latex: "(x + a)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k a^{n-k}",
  },
  {
    get label() {
      return tr("Espansione di Taylor")
    },
    latex:
      "e^x = 1 + \\frac{x}{1!} + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots",
  },
  {
    get label() {
      return tr("Serie di Fourier")
    },
    latex:
      "f(x) = a_0 + \\sum_{n=1}^{\\infty} \\left( a_n \\cos \\frac{n\\pi x}{L} + b_n \\sin \\frac{n\\pi x}{L} \\right)",
  },
  {
    get label() {
      return tr("Identità trigonometrica")
    },
    latex: "\\sin^2 \\alpha + \\cos^2 \\alpha = 1",
  },
  {
    get label() {
      return tr("Integrale di Gauss")
    },
    latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
  },
]

/** Strutture e simboli per scrivere le formule senza ricordare il LaTeX */
export const MATH_STRUCTURES: {
  label: string
  insert: string
  preview: string
}[] = [
  {
    get label() {
      return tr("Frazione")
    },
    insert: "\\frac{a}{b}",
    preview: "\\frac{a}{b}",
  },
  {
    get label() {
      return tr("Apice")
    },
    insert: "x^{2}",
    preview: "x^{2}",
  },
  {
    get label() {
      return tr("Pedice")
    },
    insert: "x_{i}",
    preview: "x_{i}",
  },
  {
    get label() {
      return tr("Radice")
    },
    insert: "\\sqrt{x}",
    preview: "\\sqrt{x}",
  },
  {
    get label() {
      return tr("Radice n-esima")
    },
    insert: "\\sqrt[n]{x}",
    preview: "\\sqrt[n]{x}",
  },
  {
    get label() {
      return tr("Sommatoria")
    },
    insert: "\\sum_{i=1}^{n}",
    preview: "\\sum_{i=1}^{n}",
  },
  {
    get label() {
      return tr("Integrale")
    },
    insert: "\\int_{a}^{b}",
    preview: "\\int_{a}^{b}",
  },
  {
    get label() {
      return tr("Limite")
    },
    insert: "\\lim_{x \\to \\infty}",
    preview: "\\lim_{x \\to \\infty}",
  },
  {
    get label() {
      return tr("Parentesi")
    },
    insert: "\\left( x \\right)",
    preview: "\\left( x \\right)",
  },
  {
    get label() {
      return tr("Vettore")
    },
    insert: "\\vec{v}",
    preview: "\\vec{v}",
  },
  {
    get label() {
      return tr("Matrice")
    },
    insert: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
    preview: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
  },
  {
    get label() {
      return tr("Sistema")
    },
    insert: "\\begin{cases} x & x > 0 \\\\ -x & x \\le 0 \\end{cases}",
    preview: "\\begin{cases} x \\\\ y \\end{cases}",
  },
]

export const MATH_SYMBOLS = [
  "\\pm",
  "\\mp",
  "\\times",
  "\\div",
  "\\cdot",
  "\\neq",
  "\\approx",
  "\\equiv",
  "\\le",
  "\\ge",
  "\\ll",
  "\\gg",
  "\\infty",
  "\\propto",
  "\\partial",
  "\\nabla",
  "\\forall",
  "\\exists",
  "\\in",
  "\\notin",
  "\\subset",
  "\\cup",
  "\\cap",
  "\\emptyset",
  "\\to",
  "\\Rightarrow",
  "\\Leftrightarrow",
  "\\therefore",
  "\\alpha",
  "\\beta",
  "\\gamma",
  "\\delta",
  "\\epsilon",
  "\\theta",
  "\\lambda",
  "\\mu",
  "\\pi",
  "\\sigma",
  "\\phi",
  "\\omega",
  "\\Delta",
  "\\Sigma",
  "\\Pi",
  "\\Omega",
  "\\degree",
  "\\angle",
  "\\perp",
  "\\parallel",
]
