"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { STORAGE, readStorage } from "@/lib/storage"
import { guardClicks } from "../focus-guard"
import { DesignTab } from "./design-tab"
import { DrawTab } from "./draw-tab"
import { FormatTab, formatKind, formatTabLabel } from "./format-tab"
import { HomeTab } from "./home-tab"
import { InsertTab } from "./insert-tab"
import { LayoutTab } from "./layout-tab"
import { MailingsTab } from "./mailings-tab"
import { ReferencesTab } from "./references-tab"
import { RibbonFitProvider } from "./ribbon-ui"
import { ReviewTab } from "./review-tab"
import type { RibbonCtx } from "./shared"
import { ViewTab } from "./view-tab"

import { useT } from "@/lib/i18n/client"
import { N_ } from "@/lib/i18n/config"
const TABS = [
  { key: "home", label: N_("Home"), Body: HomeTab },
  { key: "insert", label: N_("Inserisci"), Body: InsertTab },
  { key: "draw", label: N_("Disegno"), Body: DrawTab },
  { key: "layout", label: N_("Layout"), Body: LayoutTab },
  { key: "design", label: N_("Progettazione"), Body: DesignTab },
  { key: "references", label: N_("Riferimenti"), Body: ReferencesTab },
  { key: "mailings", label: N_("Corrispondenza"), Body: MailingsTab },
  { key: "review", label: N_("Revisione"), Body: ReviewTab },
  { key: "view", label: N_("Visualizza"), Body: ViewTab },
] as const
type FixedKey = (typeof TABS)[number]["key"]
/** «format» è la scheda contestuale dell'oggetto su cui si lavora */
type TabKey = FixedKey | "format"

const STORAGE_KEY = STORAGE.ribbon

/** `back`: la scheda da riaprire quando la scheda contestuale sparisce */
type Prefs = { tab: TabKey; collapsed: boolean; back: FixedKey }
const DEFAULT: Prefs = { tab: "home", collapsed: false, back: "home" }

/*
 * La scheda aperta si ricorda fra una sessione e l'altra. È un piccolo store
 * esterno letto con useSyncExternalStore: niente discordanze fra server e
 * client, e niente setState negli effetti.
 */
let cache: Prefs | null = null
const listeners = new Set<() => void>()

function readPrefs(): Prefs {
  if (cache) return cache
  try {
    const raw = JSON.parse(readStorage(STORAGE_KEY) ?? "{}")
    const fixed = (key: unknown): FixedKey =>
      TABS.some((t) => t.key === key) ? (key as FixedKey) : "home"
    // riaprendo il documento niente è selezionato: la scheda contestuale
    // lascia il posto a quella da cui si era arrivati
    cache = {
      tab: raw.tab === "format" ? fixed(raw.back) : fixed(raw.tab),
      collapsed: raw.collapsed === true,
      back: fixed(raw.back),
    }
  } catch {
    cache = DEFAULT
  }
  return cache
}

function writePrefs(next: Prefs) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // senza localStorage la scheda semplicemente non viene ricordata
  }
  listeners.forEach((l) => l())
}

/**
 * Apre una scheda della barra da fuori, per esempio la scheda dell'oggetto
 * appena inserito (un grafico, una forma) o scelto dal menu contestuale.
 */
export function openRibbonTab(tab: TabKey) {
  const prefs = readPrefs()
  writePrefs({
    ...prefs,
    tab,
    collapsed: false,
    back: prefs.tab === "format" ? prefs.back : prefs.tab,
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Barra a schede come quella di Word. Si disegna solo la scheda aperta: le
 * altre non esistono nel DOM finché non si aprono, così la barra resta leggera
 * mentre si scrive.
 */
export function Ribbon({ ctx }: { ctx: RibbonCtx | null }) {
  const t = useT()
  const state = React.useSyncExternalStore(subscribe, readPrefs, () => DEFAULT)
  const update = (next: Partial<Prefs>) => writePrefs({ ...state, ...next })

  // la scheda dell'oggetto su cui si lavora, come «Layout tabella» in Word
  const kind = ctx ? formatKind(ctx.st) : null
  const formatLabel = kind ? formatTabLabel(kind) : null
  const onFormat = state.tab === "format" && kind !== null
  // l'oggetto non c'è più (clic nel testo, oggetto eliminato): si torna alla
  // scheda di prima. Solo quando sparisce: aprendo la scheda per un oggetto
  // che sta per essere inserito, l'oggetto ancora non c'è
  const lastKind = React.useRef(kind)
  React.useEffect(() => {
    const was = lastKind.current
    lastKind.current = kind
    if (was && !kind && state.tab === "format") {
      writePrefs({ ...state, tab: state.back })
    }
  }, [kind, state])

  const shownKey: FixedKey = state.tab === "format" ? state.back : state.tab
  const active = TABS.find((t) => t.key === shownKey) ?? TABS[0]
  const Body = active.Body
  const pick = (key: TabKey) =>
    update({
      tab: key,
      collapsed: false,
      back:
        key === "format"
          ? state.tab === "format"
            ? state.back
            : state.tab
          : state.back,
    })

  return (
    <div
      className="shrink-0 border-b border-border bg-card"
      onClickCapture={ctx ? guardClicks(ctx.editor) : undefined}
    >
      <div
        role="tablist"
        aria-label={t("Schede")}
        className="flex h-9 items-end gap-1 overflow-x-auto px-2"
      >
        {TABS.map((tab) => {
          const selected = !onFormat && tab.key === shownKey
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              data-safe=""
              aria-selected={selected}
              onMouseDown={(e) => e.preventDefault()}
              // un clic apre la scheda (e la barra, se era compressa); il
              // doppio clic comprime, come in Word
              onClick={() => pick(tab.key)}
              onDoubleClick={() =>
                selected && update({ collapsed: !state.collapsed })
              }
              className={cn(
                "relative h-8 shrink-0 rounded-t-md px-3 text-[13px] transition-colors",
                selected
                  ? "font-semibold text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t(tab.label)}
            </button>
          )
        })}
        {formatLabel ? (
          <button
            type="button"
            role="tab"
            data-safe=""
            data-contextual=""
            aria-selected={onFormat}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick("format")}
            onDoubleClick={() =>
              onFormat && update({ collapsed: !state.collapsed })
            }
            // colorata come le schede contestuali di Word: si nota che è
            // comparsa e che vale per l'oggetto selezionato
            className={cn(
              "relative h-8 shrink-0 rounded-t-md px-3 text-[13px] text-primary transition-colors",
              onFormat
                ? "bg-primary/10 font-semibold after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary"
                : "hover:bg-primary/10"
            )}
          >
            {formatLabel}
          </button>
        ) : null}
        <button
          type="button"
          data-safe=""
          title={
            state.collapsed ? t("Mostra la barra") : t("Comprimi la barra")
          }
          aria-label={
            state.collapsed ? t("Mostra la barra") : t("Comprimi la barra")
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => update({ collapsed: !state.collapsed })}
          className="mb-1 ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {state.collapsed ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )}
        </button>
      </div>

      {!state.collapsed ? (
        onFormat && ctx && formatLabel ? (
          <RibbonBody key={`format-${kind}`} label={formatLabel}>
            <FormatTab ctx={ctx} />
          </RibbonBody>
        ) : (
          <RibbonBody key={active.key} label={t(active.label)}>
            {ctx ? <Body ctx={ctx} /> : null}
          </RibbonBody>
        )
      ) : null}
    </div>
  )
}

/** larghezza del pulsante di un gruppo ridotto, icona ed etichetta comprese */
const COLLAPSED_WIDTH = 74

/**
 * La riga dei gruppi, che si adatta alla finestra come in Word: finché ci
 * stanno restano aperti; quando lo spazio finisce si riducono a un pulsante,
 * a partire dall'ultimo. Niente comandi nascosti fuori dal bordo.
 */
function RibbonBody({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // la larghezza di ogni gruppo, aperto e ridotto, presa dal vero: le
  // etichette lunghe fanno un pulsante più largo, e la somma deve tornare
  const widths = React.useRef(new Map<string, number>())
  const small = React.useRef(new Map<string, number>())
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const measureRef = React.useRef<() => void>(undefined)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const groups = [
        ...el.querySelectorAll<HTMLElement>("[data-ribbon-group]"),
      ]
      if (!groups.length) return
      const labels: string[] = []
      const whole = new Set<string>()
      for (const group of groups) {
        const name = group.dataset.groupLabel ?? ""
        labels.push(name)
        if (group.dataset.fixed !== undefined) whole.add(name)
        if (group.offsetWidth <= 0) continue
        const store =
          group.dataset.collapsed === undefined ? widths.current : small.current
        store.set(name, group.offsetWidth)
      }
      // lo spazio vero è al netto della spaziatura della riga; due pixel di
      // margine perché gli arrotondamenti del browser non facciano comparire
      // la barra di scorrimento
      const pad = getComputedStyle(el)
      const available =
        el.clientWidth -
        parseFloat(pad.paddingLeft || "0") -
        parseFloat(pad.paddingRight || "0") -
        2
      const natural = labels.map(
        (name) => widths.current.get(name) ?? COLLAPSED_WIDTH
      )
      // un gruppo già stretto non guadagna niente a chiudersi
      const shrunk = labels.map((name, i) =>
        whole.has(name)
          ? natural[i]
          : Math.min(natural[i], small.current.get(name) ?? COLLAPSED_WIDTH)
      )
      const widthWith = (open: number) =>
        natural.slice(0, open).reduce((sum, w) => sum + w, 0) +
        shrunk.slice(open).reduce((sum, w) => sum + w, 0)

      // come in Word si chiudono gli ultimi gruppi: i primi della scheda
      // sono quelli che si usano di più e restano aperti il più a lungo
      let open = labels.length
      while (open > 0 && widthWith(open) > available) open -= 1
      const shut = new Set(
        Array.from({ length: labels.length - open }, (_, i) => open + i)
      )

      // chiudere fino a lì può aver liberato più spazio del necessario: i
      // gruppi che adesso ci rientrano si riaprono, a partire da sinistra
      let total = widthWith(open)
      for (const i of [...shut]) {
        const cost = natural[i] - shrunk[i]
        if (cost > 0 && total + cost > available) continue
        shut.delete(i)
        total += cost
      }

      const next = labels.filter((_, i) => shut.has(i))
      setCollapsed((prev) =>
        prev.size === next.length && next.every((name) => prev.has(name))
          ? prev
          : new Set(next)
      )
    }

    measureRef.current = measure
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    // i caratteri web cambiano la larghezza delle etichette: si rimisura
    // quando sono pronti
    void document.fonts?.ready.then(measure).catch(() => {})
    return () => observer.disconnect()
    // si misura all'apertura della scheda e quando cambia la finestra: la
    // barra non deve rimescolarsi mentre si scrive, solo perché un comando
    // si accende o un'etichetta si allunga
  }, [])

  // il primo conto usa una larghezza di comodo per i gruppi ridotti; appena
  // sono sullo schermo si sa quanto occupano davvero e il conto si rifà
  React.useLayoutEffect(() => {
    measureRef.current?.()
  }, [collapsed])

  return (
    <div
      ref={ref}
      role="tabpanel"
      aria-label={label}
      className="ribbon-body flex h-[88px] items-stretch overflow-x-auto overflow-y-hidden px-1 pt-1.5 pb-1"
    >
      <RibbonFitProvider collapsed={collapsed}>{children}</RibbonFitProvider>
    </div>
  )
}
