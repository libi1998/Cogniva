"use client"

import * as React from "react"
import { ChevronDown, PanelsTopLeft } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  focusBack,
  useFinalFocus,
  useFocusBackWhenClosed,
} from "@/components/ui/final-focus"
import { cn } from "@/lib/utils"

import { useT } from "@/lib/i18n/client"
import { formatDecimal } from "@/lib/numbers"
/**
 * Pezzi della barra a schede. I pulsanti usano il `title` nativo invece dei
 * tooltip: con un centinaio di comandi, un tooltip ciascuno pesava su ogni
 * ridisegno della barra.
 */

/**
 * I gruppi che non stanno nella finestra: come in Word si riducono a un solo
 * pulsante che apre il gruppo intero. Il contesto lo decide `RibbonFit`,
 * che misura la barra.
 */
const CollapsedGroups = React.createContext<ReadonlySet<string>>(new Set())

export function RibbonFitProvider({
  collapsed,
  children,
}: {
  collapsed: ReadonlySet<string>
  children: React.ReactNode
}) {
  return (
    <CollapsedGroups.Provider value={collapsed}>
      {children}
    </CollapsedGroups.Provider>
  )
}

/** Gruppo con l'etichetta in basso, come «Carattere» o «Paragrafo» in Word */
export function RibbonGroup({
  label,
  icon,
  children,
  className,
  safe,
  launcher,
  fixed,
}: {
  label: string
  /** icona del pulsante quando il gruppo si riduce */
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** i comandi del gruppo non toccano la selezione del testo */
  safe?: boolean
  /**
   * il pulsantino ↘ accanto al nome del gruppo, come in Word: apre la
   * finestra con tutte le opzioni («Carattere…», «Paragrafo…»)
   */
  launcher?: { title: string; onClick: () => void }
  /**
   * il gruppo è già un solo pulsante grande: ridotto sarebbe lo stesso
   * pulsante, che apre un riquadro con dentro il pulsante vero
   */
  fixed?: boolean
}) {
  const shut = React.useContext(CollapsedGroups)
  const collapsed = !fixed && shut.has(label)
  const body = (
    <div className={cn("flex min-h-0 flex-1 items-center gap-0.5", className)}>
      {children}
    </div>
  )

  if (collapsed) {
    return (
      <CollapsedGroup label={label} icon={icon} safe={safe}>
        {body}
      </CollapsedGroup>
    )
  }

  return (
    <div
      data-ribbon-group=""
      data-group-label={label}
      data-safe={safe ? "" : undefined}
      data-fixed={fixed ? "" : undefined}
      role="group"
      aria-label={label}
      className="flex shrink-0 flex-col border-r border-border/70 px-2 last:border-r-0"
    >
      {body}
      <div className="relative pt-0.5 text-center text-[10px] leading-4 text-muted-foreground select-none">
        {label}
        {launcher ? (
          <button
            type="button"
            title={launcher.title}
            aria-label={launcher.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={launcher.onClick}
            className="absolute right-[-6px] bottom-0 flex size-4 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
              <path
                d="M1.5 1.5v7h7M4 6 8.5 1.5M8.5 1.5v3M8.5 1.5h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Un gruppo ridotto a un pulsante: il riquadro che si apre contiene il gruppo
 * per intero. Dato un comando il riquadro si chiude, come in Word; restano
 * aperti i comandi che aprono un menu e i campi con le frecce.
 */
function CollapsedGroup({
  label,
  icon,
  safe,
  children,
}: {
  label: string
  icon?: React.ReactNode
  safe?: boolean
  children: React.ReactNode
}) {
  const backToText = useFinalFocus()
  const [open, setOpen] = React.useState(false)
  useFocusBackWhenClosed(open)

  // i menu dei comandi si aprono fuori dal riquadro: scelta una voce si
  // chiude anche il gruppo, come in Word
  React.useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[role="menuitem"]')) setOpen(false)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [open])

  return (
    <div
      data-ribbon-group=""
      data-group-label={label}
      data-collapsed=""
      data-safe={safe ? "" : undefined}
      role="group"
      aria-label={label}
      className="flex shrink-0 flex-col border-r border-border/70 px-1 last:border-r-0"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <RibbonButton
              large
              chevron
              label={label}
              title={label}
              active={open}
              icon={icon ?? <PanelsTopLeft className="size-5" />}
            />
          }
        />
        <PopoverContent
          align="start"
          sideOffset={2}
          // il riquadro vive in un portale, fuori dal gruppo: senza questo
          // i comandi «sicuri» perderebbero il loro contrassegno
          data-safe={safe ? "" : undefined}
          className="w-auto max-w-[min(96vw,900px)] overflow-x-auto p-1.5"
          // il fuoco torna nel testo, non sul pulsante del gruppo
          finalFocus={backToText ?? false}
        >
          <div
            className="flex h-[74px] items-stretch"
            onClick={(event) => {
              const button = (event.target as HTMLElement).closest("button")
              // i menu si aprono dentro il riquadro; le frecce dei campi
              // numerici stanno in una <label> e si ripremono più volte
              if (
                !button ||
                button.getAttribute("aria-haspopup") ||
                button.closest("label")
              ) {
                return
              }
              setOpen(false)
            }}
            // Invio in una casella (rientro, corpo del carattere) conferma e
            // torna al testo: il gruppo si chiude, invece di restare aperto
            // sopra al documento
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.target as HTMLElement).tagName === "INPUT"
              )
                setOpen(false)
            }}
          >
            {children}
          </div>
        </PopoverContent>
      </Popover>
      <div className="pt-0.5 text-center text-[10px] leading-4 text-transparent select-none">
        ·
      </div>
    </div>
  )
}

/** Due righe di comandi piccoli dentro un gruppo */
export function RibbonRows({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col justify-center gap-0.5">{children}</div>
}

export function RibbonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

type ButtonProps = {
  icon?: React.ReactNode
  label?: string
  title?: string
  active?: boolean
  disabled?: boolean
  large?: boolean
  /** riga bassa, per le colonne di tre comandi come «Appunti» e «Modifica» */
  compact?: boolean
  /** freccia dei comandi che aprono un menu */
  chevron?: boolean
  onClick?: () => void
  className?: string
}

export const RibbonButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title">
>(function RibbonButton(
  {
    icon,
    label,
    title,
    active,
    disabled,
    large,
    compact,
    chevron,
    onClick,
    onMouseDown,
    className,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      title={title ?? label}
      // il nome accessibile comincia dall'etichetta visibile
      aria-label={label ?? title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // il fuoco resta nel testo: la selezione non si perde. Quando il
      // pulsante apre un menu, Base UI aggiunge il suo gestore: si chiamano
      // entrambi invece di sovrascriversi
      onMouseDown={(e) => {
        onMouseDown?.(e)
        e.preventDefault()
      }}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        large
          ? "h-[58px] min-w-[52px] flex-col gap-1 px-1.5 text-[11px] leading-tight"
          : cn(
              compact ? "h-[21px] gap-1 text-[11px]" : "h-7 gap-1 text-xs",
              label ? "px-1.5" : compact ? "w-6" : "w-7"
            ),
        active && "bg-accent text-accent-foreground hover:bg-accent",
        className
      )}
      {...rest}
    >
      {icon}
      {/* le parole lunghe (tedesco, olandese) vanno a capo invece di uscire */}
      {label ? (
        <span
          className={cn(
            large &&
              "max-w-[76px] text-center [overflow-wrap:anywhere] hyphens-auto"
          )}
        >
          {label}
          {chevron && large ? (
            <ChevronDown className="mx-auto mt-px size-3 opacity-60" />
          ) : null}
        </span>
      ) : null}
      {chevron && !large ? (
        <ChevronDown className="-ml-0.5 size-3 opacity-60" />
      ) : null}
    </button>
  )
})

const CloseMenuContext = React.createContext<(() => void) | null>(null)

/**
 * Chiude il menu della barra che contiene il componente. Serve alle griglie
 * (colori, tabella) fatte di pulsanti semplici: le voci di menu si chiudono da
 * sole, i pulsanti no.
 */
export function useCloseRibbonMenu() {
  return React.useContext(CloseMenuContext)
}

/**
 * Comando con menu. Chiudendo il menu il fuoco torna nel testo invece di
 * restare sul pulsante.
 */
export function RibbonMenu({
  trigger,
  children,
  align = "start",
  className,
  onClose,
}: {
  trigger: React.ReactElement
  children: React.ReactNode
  align?: "start" | "center" | "end"
  className?: string
  onClose?: () => void
}) {
  const backToText = useFinalFocus()
  const [open, setOpen] = React.useState(false)
  useFocusBackWhenClosed(open)
  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(next) => {
        if (!next) onClose?.()
      }}
    >
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align={align}
        className={cn("w-56", className)}
        // il fuoco torna nel testo, non sul pulsante della barra
        finalFocus={backToText ?? false}
      >
        <CloseMenuContext.Provider value={() => setOpen(false)}>
          {children}
        </CloseMenuContext.Provider>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Comando che apre un riquadro con dei campi (cursori, caselle, colori): a
 * differenza di un menu resta aperto mentre si lavora e si chiude con un clic
 * fuori o con Esc. Chiudendolo il fuoco torna nel testo.
 */
export function RibbonPopover({
  trigger,
  children,
  align = "start",
  className,
  label,
}: {
  trigger: React.ReactElement
  children: React.ReactNode
  align?: "start" | "center" | "end"
  className?: string
  /** nome del riquadro per i lettori di schermo */
  label: string
}) {
  const backToText = useFinalFocus()
  const [open, setOpen] = React.useState(false)
  useFocusBackWhenClosed(open)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align={align}
        sideOffset={4}
        aria-label={label}
        className={cn(
          "max-h-[min(70dvh,560px)] w-72 overflow-y-auto p-0",
          className
        )}
        finalFocus={backToText ?? false}
      >
        <CloseMenuContext.Provider value={() => setOpen(false)}>
          {children}
        </CloseMenuContext.Provider>
      </PopoverContent>
    </Popover>
  )
}

/** Tavolozza dentro un menu */
export function SwatchGrid({
  colors,
  value,
  onPick,
  columns = 6,
}: {
  /** `swatch` quando il valore non è già un colore CSS (una chiave) */
  colors: { label: string; value: string; swatch?: string }[]
  value?: string | null
  onPick: (value: string) => void
  columns?: number
}) {
  const close = useCloseRibbonMenu()
  return (
    <div
      className="grid gap-1.5 p-1.5"
      // mai più piccoli dei colori degli altri menu: in un menu a larghezza
      // automatica una colonna «0-1fr» si stringeva a pochi pixel
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(1.5rem, 1fr))` }}
    >
      {colors.map((c) => (
        <button
          key={c.label}
          type="button"
          title={c.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onPick(c.value)
            close?.()
          }}
          className={cn(
            "relative aspect-square rounded-md transition hover:scale-110",
            (value ?? "") === c.value &&
              "ring-2 ring-ring ring-offset-1 ring-offset-background"
          )}
          style={{
            background:
              c.swatch ||
              c.value ||
              "linear-gradient(135deg, transparent 45%, #e03177 45% 55%, transparent 55%)",
            boxShadow: "inset 0 0 0 1px rgba(15,1,26,0.16)",
          }}
        />
      ))}
    </div>
  )
}

/**
 * Campo numerico con frecce, come «Rientro» e «Spaziatura» nella scheda
 * Layout. Mentre si scrive il testo resta com'è; il valore si applica quando
 * è un numero valido.
 */
export function Stepper({
  icon,
  label,
  value,
  unit,
  step,
  min,
  max,
  decimals = 1,
  onChange,
  width = 64,
  labelWidth = 62,
  compact,
  lazy,
}: {
  icon?: React.ReactNode
  label: string
  value: number
  unit: string
  step: number
  min: number
  max: number
  decimals?: number
  onChange: (value: number) => void
  width?: number
  labelWidth?: number
  /** riga bassa: due campi e un'intestazione stanno nell'altezza della barra */
  compact?: boolean
  /**
   * il numero scritto si applica con Invio o uscendo dalla casella, non a
   * ogni cifra: per le misure in cui «1» prima di «10» farebbe un passo vero
   * (e uno in più da annullare), come la larghezza di una tabella
   */
  lazy?: boolean
}) {
  const t = useT()
  const backToText = useFinalFocus()
  const [draft, setDraft] = React.useState<string | null>(null)
  const input = React.useRef<HTMLInputElement>(null)
  // entrando nella casella l'unità sparisce e il numero resta selezionato,
  // per scriverci sopra. La selezione si rifà appena il numero è nella
  // casella: fatta prima, cambiare il valore la toglierebbe e quello che si
  // scrive finirebbe in coda («1» diventava «11,5»)
  const selectAll = React.useRef(false)
  const fresh = React.useRef(false)
  // con «lazy»: c'è un numero scritto e non ancora applicato
  const typed = React.useRef(false)
  React.useLayoutEffect(() => {
    if (!selectAll.current) return
    selectAll.current = false
    input.current?.select()
  }, [draft])
  const clamp = (v: number) =>
    Math.min(max, Math.max(min, Number(v.toFixed(decimals))))
  const shown =
    draft ?? `${formatDecimal(Number(value.toFixed(decimals)))} ${unit}`

  const commit = (text: string) => {
    const n = Number(text.replace(",", ".").replace(/[^\d.-]/g, ""))
    if (Number.isFinite(n) && text.trim() !== "") onChange(clamp(n))
  }

  return (
    <label
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        compact ? "h-[22px]" : "h-7"
      )}
    >
      {icon}
      <span className="shrink-0 truncate" style={{ width: labelWidth }}>
        {label}
      </span>
      <span
        className={cn(
          "flex items-center overflow-hidden rounded-md border border-border bg-background focus-within:border-ring",
          compact ? "h-5" : "h-6"
        )}
        style={{ width }}
      >
        <input
          ref={input}
          value={shown}
          inputMode="decimal"
          aria-label={label}
          onFocus={() => {
            selectAll.current = true
            fresh.current = true
            setDraft(formatDecimal(Number(value.toFixed(decimals))))
          }}
          // il clic che dà il fuoco non deve togliere la selezione appena
          // fatta, mettendo il cursore dove si è cliccato
          onMouseUp={(e) => {
            if (!fresh.current) return
            fresh.current = false
            if (e.currentTarget.selectionStart !== e.currentTarget.selectionEnd)
              return
            e.preventDefault()
            e.currentTarget.select()
          }}
          onKeyUp={() => {
            fresh.current = false
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            if (lazy) typed.current = true
            else commit(e.target.value)
          }}
          onBlur={(e) => {
            if (typed.current) {
              typed.current = false
              commit(e.currentTarget.value)
            }
            setDraft(null)
          }}
          onKeyDown={(e) => {
            // Invio torna al testo, come in Word: si riprende a scrivere nel
            // documento (il valore si applica già mentre si digita). In una
            // finestra, come «Modifica stile», si resta nella finestra; nel
            // riquadro di un gruppo ridotto è il gruppo a chiudersi e a
            // rimettere il fuoco nel testo
            if (e.key === "Enter") {
              e.preventDefault()
              const input = e.currentTarget
              if (typed.current) {
                // applicato qui: uscendo dalla casella non si rifà
                typed.current = false
                commit(input.value)
              }
              if (backToText?.current && !input.closest('[role="dialog"]'))
                focusBack(backToText.current)
              else input.blur()
              return
            }
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
            e.preventDefault()
            // le frecce partono dal numero scritto, se c'è
            const typedValue = Number(
              e.currentTarget.value.replace(",", ".").replace(/[^\d.-]/g, "")
            )
            const base =
              typed.current && Number.isFinite(typedValue) ? typedValue : value
            typed.current = false
            const next = clamp(base + (e.key === "ArrowUp" ? step : -step))
            setDraft(formatDecimal(next))
            onChange(next)
          }}
          className="h-full w-0 min-w-0 flex-1 bg-transparent px-1.5 text-foreground tabular-nums outline-none"
        />
        <span className="flex h-full flex-col border-l border-border">
          {[1, -1].map((dir) => (
            <button
              key={dir}
              type="button"
              tabIndex={-1}
              aria-label={dir > 0 ? t("Aumenta") : t("Riduci")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(clamp(value + dir * step))}
              className="flex h-1/2 w-4 items-center justify-center text-[8px] leading-none hover:bg-muted"
            >
              {dir > 0 ? "▲" : "▼"}
            </button>
          ))}
        </span>
      </span>
    </label>
  )
}
