"use client"

import * as React from "react"
import { Blocks } from "lucide-react"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ADDINS, useEnabledAddins, type AddinId } from "@/lib/addins"
import { cn } from "@/lib/utils"
import { RibbonButton, RibbonGroup, RibbonMenu } from "../ribbon/ribbon-ui"
import type { RibbonCtx } from "../ribbon/shared"
import { ADDIN_ICONS } from "./addin-icons"
import { AddinsDialog } from "./addins-dialog"

/** Il gruppo «Componenti aggiuntivi» in fondo alla scheda Home, come in Word */
export function AddinsGroup({ ctx }: { ctx: RibbonCtx }) {
  const enabled = useEnabledAddins()
  const [gallery, setGallery] = React.useState(false)
  const open = (id: AddinId) => ctx.openTaskPane({ kind: "addin", id })
  const active = ctx.taskPane?.kind === "addin" ? ctx.taskPane.id : null
  const list = ADDINS.filter((a) => enabled.includes(a.id))

  return (
    <RibbonGroup label="Componenti aggiuntivi" safe>
      <RibbonMenu
        className="w-64"
        trigger={
          <RibbonButton
            large
            chevron
            label="Componenti aggiuntivi"
            title="Codice QR, leggibilità, firma, Wikipedia e altri strumenti"
            active={active !== null}
            icon={<Blocks className="size-5" />}
          />
        }
      >
        <DropdownMenuLabel>I miei componenti aggiuntivi</DropdownMenuLabel>
        {list.length ? (
          list.map((addin) => (
            <DropdownMenuItem
              key={addin.id}
              onClick={() => open(addin.id)}
              className={cn(active === addin.id && "bg-accent")}
            >
              {ADDIN_ICONS[addin.id]("size-4")}
              <span className="min-w-0">
                <span className="block truncate">{addin.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {addin.tagline}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>Nessuno attivo</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setGallery(true)}>
          <Blocks className="size-4" /> Altri componenti aggiuntivi…
        </DropdownMenuItem>
      </RibbonMenu>
      <AddinsDialog
        open={gallery}
        onClose={() => setGallery(false)}
        onOpenAddin={open}
      />
    </RibbonGroup>
  )
}
