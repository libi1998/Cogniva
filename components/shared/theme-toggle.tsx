"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  setThemePreference,
  useMounted,
  useThemePreference,
} from "@/lib/use-theme"

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemePreference()
  const mounted = useMounted()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Aspetto"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground",
              className
            )}
            title="Aspetto"
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
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => setThemePreference("light")}>
          <Sun className="size-4" /> Chiaro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePreference("dark")}>
          <Moon className="size-4" /> Scuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePreference("system")}>
          <Monitor className="size-4" /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
