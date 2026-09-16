"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { STORAGE, readStorage } from "@/lib/storage"
import { guardClicks } from "../focus-guard"
import { DesignTab } from "./design-tab"
import { DrawTab } from "./draw-tab"
import { HomeTab } from "./home-tab"
import { InsertTab } from "./insert-tab"
import { LayoutTab } from "./layout-tab"
import { MailingsTab } from "./mailings-tab"
import { ReferencesTab } from "./references-tab"
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
type TabKey = (typeof TABS)[number]["key"]

const STORAGE_KEY = STORAGE.ribbon

type Prefs = { tab: TabKey; collapsed: boolean }
const DEFAULT: Prefs = { tab: "home", collapsed: false }

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
    cache = {
      tab: TABS.some((t) => t.key === raw.tab) ? raw.tab : "home",
      collapsed: raw.collapsed === true,
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

  const active = TABS.find((t) => t.key === state.tab) ?? TABS[0]
  const Body = active.Body

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
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            data-safe=""
            aria-selected={tab.key === state.tab}
            onMouseDown={(e) => e.preventDefault()}
            // un clic apre la scheda (e la barra, se era compressa); il
            // doppio clic comprime, come in Word
            onClick={() => update({ tab: tab.key, collapsed: false })}
            onDoubleClick={() =>
              tab.key === state.tab && update({ collapsed: !state.collapsed })
            }
            className={cn(
              "relative h-8 shrink-0 rounded-t-md px-3 text-[13px] transition-colors",
              tab.key === state.tab
                ? "font-semibold text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t(tab.label)}
          </button>
        ))}
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
        <div
          role="tabpanel"
          aria-label={t(active.label)}
          className="ribbon-body flex h-[88px] items-stretch overflow-x-auto overflow-y-hidden px-1 pt-1.5 pb-1"
        >
          {ctx ? <Body ctx={ctx} /> : null}
        </div>
      ) : null}
    </div>
  )
}
