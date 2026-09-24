"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Stepper } from "./ribbon/ribbon-ui"
import { CM, PT } from "./ribbon/shared"
import type { DocState } from "./use-doc-state"

import { useT } from "@/lib/i18n/client"

/**
 * Le finestre «Paragrafo» e «Carattere» di Word, dal pulsantino in fondo ai
 * gruppi della scheda Home: tutto quello che nella barra non ci sta, con i
 * valori del paragrafo o del testo selezionato. Si applica con OK, a tutti i
 * paragrafi della selezione.
 */

const INDENT_TYPES = ["paragraph", "heading", "blockquote"]

type Special = "none" | "first" | "hanging"

const LINE_PRESETS = ["1", "1.15", "1.5", "2"] as const

const selectClass =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-border pb-1 text-xs font-semibold tracking-wide text-foreground/80 uppercase">
      {children}
    </h3>
  )
}

/* ------------------------------- paragrafo ------------------------------- */

export function ParagraphDialog({
  open,
  onClose,
  editor,
  st,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  st: DocState
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {open ? (
          <ParagraphForm editor={editor} st={st} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ParagraphForm({
  editor,
  st,
  onClose,
}: {
  editor: Editor
  st: DocState
  onClose: () => void
}) {
  const t = useT()
  // i valori all'apertura: si applica solo quello che si cambia, così gli
  // spazi dati dallo stile restano dello stile
  const [initial] = React.useState(() => {
    const hanging = st.firstLine < 0 ? -st.firstLine : 0
    const line = st.lineHeight
    return {
      align: st.align,
      left: (st.indentLeft - hanging) / CM,
      right: st.indentRight / CM,
      special: (st.firstLine > 0
        ? "first"
        : st.firstLine < 0
          ? "hanging"
          : "none") as Special,
      by: Math.abs(st.firstLine) / CM || 1.25,
      before: st.spaceBefore / PT,
      after: st.spaceAfter / PT,
      line: line
        ? (LINE_PRESETS as readonly string[]).includes(line)
          ? line
          : "multiple"
        : "",
      multiple: parseFloat(line) || 1.15,
      keepNext: st.keepNext,
      keepLines: st.keepLines,
      breakBefore: st.breakBefore,
    }
  })
  const [v, setV] = React.useState(initial)
  const set = (patch: Partial<typeof v>) => setV((o) => ({ ...o, ...patch }))

  const apply = () => {
    let chain = editor.chain().focus()
    if (v.align !== initial.align) chain = chain.setTextAlign(v.align)
    const indentChanged =
      v.left !== initial.left ||
      v.right !== initial.right ||
      v.special !== initial.special ||
      (v.special !== "none" && v.by !== initial.by)
    if (indentChanged) {
      const by = v.special === "none" ? 0 : Math.max(0, v.by)
      const attrs = {
        // sporgente: le righe dopo la prima rientrano, la prima resta al
        // margine di sinistra
        indent: Math.round((v.left + (v.special === "hanging" ? by : 0)) * CM),
        indentRight: Math.round(v.right * CM),
        firstLine: Math.round(
          (v.special === "first" ? by : v.special === "hanging" ? -by : 0) * CM
        ),
      }
      for (const type of INDENT_TYPES)
        chain = chain.updateAttributes(type, attrs)
    }
    if (v.before !== initial.before) {
      chain = chain.setSpaceBefore(Math.round(v.before * PT))
    }
    if (v.after !== initial.after) {
      chain = chain.setSpaceAfter(Math.round(v.after * PT))
    }
    if (v.line !== initial.line || v.multiple !== initial.multiple) {
      chain =
        v.line === ""
          ? chain.unsetLineHeight()
          : chain.setLineHeight(
              v.line === "multiple" ? String(v.multiple) : v.line
            )
    }
    if (
      v.keepNext !== initial.keepNext ||
      v.keepLines !== initial.keepLines ||
      v.breakBefore !== initial.breakBefore
    ) {
      chain = chain.setParagraphFlow({
        keepNext: v.keepNext,
        keepLines: v.keepLines,
        breakBefore: v.breakBefore,
      })
    }
    chain.run()
    onClose()
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("Paragrafo")}</DialogTitle>
        <DialogDescription>
          {t("Rientri, spaziatura e distribuzione del testo sulle pagine.")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4 text-sm">
        <section className="space-y-2">
          <Heading>{t("Generale")}</Heading>
          <Field label={t("Allineamento")}>
            <select
              aria-label={t("Allineamento")}
              className={selectClass}
              value={v.align}
              onChange={(e) =>
                set({ align: e.target.value as DocState["align"] })
              }
            >
              <option value="left">{t("A sinistra")}</option>
              <option value="center">{t("Al centro")}</option>
              <option value="right">{t("A destra")}</option>
              <option value="justify">{t("Giustificato")}</option>
            </select>
          </Field>
        </section>

        <section className="space-y-2">
          <Heading>{t("Rientri")}</Heading>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Stepper
              label={t("A sinistra")}
              labelWidth={70}
              width={96}
              value={v.left}
              unit="cm"
              step={0.25}
              min={0}
              max={8.4}
              decimals={2}
              onChange={(left) => set({ left })}
            />
            <Stepper
              label={t("A destra")}
              labelWidth={70}
              width={96}
              value={v.right}
              unit="cm"
              step={0.25}
              min={0}
              max={8.4}
              decimals={2}
              onChange={(right) => set({ right })}
            />
            <Field label={t("Speciale")}>
              <select
                aria-label={t("Speciale")}
                className={selectClass}
                value={v.special}
                onChange={(e) => set({ special: e.target.value as Special })}
              >
                <option value="none">{t("(nessuno)")}</option>
                <option value="first">{t("Prima riga")}</option>
                <option value="hanging">{t("Sporgente")}</option>
              </select>
            </Field>
            <div className="flex items-end">
              {v.special !== "none" ? (
                <Stepper
                  label={t("Di")}
                  labelWidth={70}
                  width={96}
                  value={v.by}
                  unit="cm"
                  step={0.25}
                  min={0}
                  max={5}
                  decimals={2}
                  onChange={(by) => set({ by })}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <Heading>{t("Spaziatura")}</Heading>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Stepper
              label={t("Prima")}
              labelWidth={70}
              width={96}
              value={v.before}
              unit="pt"
              step={6}
              min={0}
              max={200}
              decimals={0}
              onChange={(before) => set({ before })}
            />
            <Stepper
              label={t("Dopo")}
              labelWidth={70}
              width={96}
              value={v.after}
              unit="pt"
              step={6}
              min={0}
              max={200}
              decimals={0}
              onChange={(after) => set({ after })}
            />
            <Field label={t("Interlinea")}>
              <select
                aria-label={t("Interlinea")}
                className={selectClass}
                value={v.line}
                onChange={(e) => set({ line: e.target.value })}
              >
                <option value="">{t("Dello stile")}</option>
                <option value="1">{t("Singola")}</option>
                <option value="1.15">1,15</option>
                <option value="1.5">1,5</option>
                <option value="2">{t("Doppia")}</option>
                <option value="multiple">{t("Multipla")}</option>
              </select>
            </Field>
            <div className="flex items-end">
              {v.line === "multiple" ? (
                <Stepper
                  label={t("Valore")}
                  labelWidth={70}
                  width={96}
                  value={v.multiple}
                  unit="×"
                  step={0.05}
                  min={0.6}
                  max={4}
                  decimals={2}
                  onChange={(multiple) => set({ multiple })}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-1.5">
          <Heading>{t("Distribuzione testo")}</Heading>
          {(
            [
              [
                "keepNext",
                t("Mantieni con il successivo"),
                t("Non resta da solo in fondo alla pagina"),
              ],
              [
                "keepLines",
                t("Mantieni assieme le righe"),
                t("Il paragrafo non si spezza fra due pagine"),
              ],
              [
                "breakBefore",
                t("Anteponi interruzione di pagina"),
                t("Comincia sempre su una pagina nuova"),
              ],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={v[key]}
                onChange={(e) => set({ [key]: e.target.checked })}
              />
              <span className="flex flex-col">
                <span>{label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {hint}
                </span>
              </span>
            </label>
          ))}
        </section>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("Annulla")}
        </Button>
        <Button type="submit">{t("OK")}</Button>
      </DialogFooter>
    </form>
  )
}

/* ------------------------------- carattere ------------------------------- */

export function FontDialog({
  open,
  onClose,
  editor,
  st,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  st: DocState
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        {open ? <FontForm editor={editor} st={st} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

type Spread = "normal" | "expanded" | "condensed"
type Shift = "normal" | "raised" | "lowered"

function FontForm({
  editor,
  st,
  onClose,
}: {
  editor: Editor
  st: DocState
  onClose: () => void
}) {
  const t = useT()
  const [initial] = React.useState(() => ({
    spread: (st.letterSpacing > 0
      ? "expanded"
      : st.letterSpacing < 0
        ? "condensed"
        : "normal") as Spread,
    spreadBy: Math.abs(st.letterSpacing) / PT || 1,
    shift: (st.raise > 0
      ? "raised"
      : st.raise < 0
        ? "lowered"
        : "normal") as Shift,
    shiftBy: Math.abs(st.raise) / PT || 3,
    smallCaps: st.smallCaps,
  }))
  const [v, setV] = React.useState(initial)
  const set = (patch: Partial<typeof v>) => setV((o) => ({ ...o, ...patch }))

  const spacing =
    v.spread === "normal"
      ? 0
      : (v.spread === "expanded" ? 1 : -1) * v.spreadBy * PT
  const raise =
    v.shift === "normal" ? 0 : (v.shift === "raised" ? 1 : -1) * v.shiftBy * PT

  const apply = () => {
    let chain = editor.chain().focus()
    if (v.spread !== initial.spread || v.spreadBy !== initial.spreadBy) {
      chain = chain.setLetterSpacing(
        spacing ? Math.round(spacing * 100) / 100 : null
      )
    }
    if (v.shift !== initial.shift || v.shiftBy !== initial.shiftBy) {
      chain = chain.setTextRaise(raise ? Math.round(raise * 100) / 100 : null)
    }
    if (v.smallCaps !== initial.smallCaps) {
      chain = chain.setTextEffects({ smallCaps: v.smallCaps ? true : null })
    }
    chain.run()
    onClose()
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("Carattere")}</DialogTitle>
        <DialogDescription>
          {t("Spaziatura e posizione del testo selezionato.")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4 text-sm">
        <section className="space-y-2">
          <Heading>{t("Spaziatura caratteri")}</Heading>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label={t("Spaziatura")}>
              <select
                aria-label={t("Spaziatura")}
                className={selectClass}
                value={v.spread}
                onChange={(e) => set({ spread: e.target.value as Spread })}
              >
                <option value="normal">{t("Normale")}</option>
                <option value="expanded">{t("Espansa")}</option>
                <option value="condensed">{t("Ridotta")}</option>
              </select>
            </Field>
            <div className="flex items-end">
              {v.spread !== "normal" ? (
                <Stepper
                  label={t("Di")}
                  labelWidth={24}
                  width={96}
                  value={v.spreadBy}
                  unit="pt"
                  step={0.5}
                  min={0.1}
                  max={12}
                  decimals={1}
                  onChange={(spreadBy) => set({ spreadBy })}
                />
              ) : null}
            </div>
            <Field label={t("Posizione")}>
              <select
                aria-label={t("Posizione")}
                className={selectClass}
                value={v.shift}
                onChange={(e) => set({ shift: e.target.value as Shift })}
              >
                <option value="normal">{t("Normale")}</option>
                <option value="raised">{t("Alzata")}</option>
                <option value="lowered">{t("Abbassata")}</option>
              </select>
            </Field>
            <div className="flex items-end">
              {v.shift !== "normal" ? (
                <Stepper
                  label={t("Di")}
                  labelWidth={24}
                  width={96}
                  value={v.shiftBy}
                  unit="pt"
                  step={1}
                  min={0.5}
                  max={36}
                  decimals={1}
                  onChange={(shiftBy) => set({ shiftBy })}
                />
              ) : null}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.smallCaps}
              onChange={(e) => set({ smallCaps: e.target.checked })}
            />
            <span style={{ fontVariantCaps: "small-caps" }}>
              {t("Maiuscoletto")}
            </span>
          </label>
        </section>
        <section className="space-y-1.5">
          <Heading>{t("Anteprima")}</Heading>
          <p className="rounded-md border border-border px-3 py-4 text-center text-base">
            <span
              style={{
                letterSpacing: spacing ? `${spacing}px` : undefined,
                verticalAlign: raise ? `${raise}px` : undefined,
                fontVariantCaps: v.smallCaps ? "small-caps" : undefined,
              }}
            >
              {t("Testo di esempio")}
            </span>
          </p>
        </section>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("Annulla")}
        </Button>
        <Button type="submit">{t("OK")}</Button>
      </DialogFooter>
    </form>
  )
}
