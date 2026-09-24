import { Extension } from "@tiptap/core"
import { cssLength } from "./css"

/**
 * Le opzioni di «Paragrafo › Distribuzione testo» e di «Carattere ›
 * Avanzate» di Word che mancavano:
 *
 * - Mantieni con il successivo: il paragrafo non resta da solo in fondo alla
 *   pagina, passa insieme a quello dopo (come fanno già i titoli);
 * - Mantieni assieme le righe: il paragrafo non si spezza fra due pagine;
 * - Anteponi interruzione di pagina: comincia sempre su una pagina nuova;
 * - Posizione del carattere: alzato o abbassato di qualche punto, senza
 *   rimpicciolirlo come apice e pedice.
 *
 * L'impaginazione (lib/pagination.ts) legge i primi tre dal nodo; il
 * formato Word li esporta con le proprietà omonime.
 */

const FLOW_TYPES = ["docTitle", "paragraph", "heading"]

export type ParagraphFlow = {
  keepNext: boolean
  keepLines: boolean
  breakBefore: boolean
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphFlow: {
      setParagraphFlow: (flow: Partial<ParagraphFlow>) => ReturnType
    }
    textPosition: {
      /** alza (positivo) o abbassa (negativo) il testo, in pixel */
      setTextRaise: (px: number | null) => ReturnType
    }
  }
}

const flag = (name: string) => ({
  default: false,
  parseHTML: (el: HTMLElement) => el.hasAttribute(`data-${name}`),
  renderHTML: (attrs: Record<string, unknown>) =>
    attrs[camel(name)] ? { [`data-${name}`]: "" } : {},
})

const camel = (name: string) =>
  name.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())

export const ParagraphFlowExtension = Extension.create({
  name: "paragraphFlow",
  addGlobalAttributes() {
    return [
      {
        types: FLOW_TYPES,
        attributes: {
          keepNext: flag("keep-next"),
          keepLines: flag("keep-lines"),
          breakBefore: flag("break-before"),
        },
      },
    ]
  },
  addCommands() {
    return {
      setParagraphFlow:
        (flow) =>
        ({ commands }) =>
          FLOW_TYPES.map((type) => commands.updateAttributes(type, flow)).some(
            Boolean
          ),
    }
  },
})

export const TextPosition = Extension.create({
  name: "textPosition",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          raise: {
            default: null,
            parseHTML: (el) => {
              const v = parseFloat(el.style.verticalAlign)
              return Number.isFinite(v) && v !== 0 ? v : null
            },
            renderHTML: (attrs) => {
              const value = cssLength(
                attrs.raise ? `${Number(attrs.raise)}px` : null
              )
              return value ? { style: `vertical-align:${value}` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setTextRaise:
        (px) =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", {
              raise: px ? Math.max(-48, Math.min(48, px)) : null,
            })
            .removeEmptyTextStyle()
            .run(),
    }
  },
})
