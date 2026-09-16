"use client"

import * as React from "react"
import { Check, Languages, Monitor, Moon, Sun } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  setThemePreference,
  useMounted,
  useThemePreference,
} from "@/lib/use-theme"
import { switchLocale, useLocale, useT } from "@/lib/i18n/client"
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n/config"

/** Tema e lingua dell'interfaccia, dallo stesso menu in alto a destra */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useT()
  const locale = useLocale()
  const theme = useThemePreference()
  const mounted = useMounted()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("Aspetto e lingua")}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground",
              className
            )}
            title={t("Aspetto e lingua")}
          />
        }
      >
        {!mounted ? (
          <Sun className="size-4" />
        ) : theme === "dark" ? (
          <Moon className="size-4" />
        ) : theme === "light" ? (
          <Sun className="size-4" />
        ) : (
          <Monitor className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("Tema")}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setThemePreference("light")}>
          <Sun className="size-4" /> {t("Chiaro")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePreference("dark")}>
          <Moon className="size-4" /> {t("Scuro")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePreference("system")}>
          <Monitor className="size-4" /> {t("Sistema")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <Languages className="size-3.5" /> {t("Lingua")}
        </DropdownMenuLabel>
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            lang={code}
            onClick={() => {
              if (code === locale) return
              // la pagina si ricarica nella nuova lingua: i file restano dove sono
              window.location.assign(switchLocale(code))
            }}
          >
            <span className="flex-1">{LOCALE_NAMES[code]}</span>
            {code === locale ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
