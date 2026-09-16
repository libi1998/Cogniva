import type { BoardEdge, BoardNode, WFile } from "./types"
import { defaultBoardTheme, defaultDocTheme, normalizeNode } from "./types"
import { newTable, tableSize, WIRE_SPECS } from "./items"

import { currentRegion, tr } from "@/lib/i18n/client"
/** Una frase tradotta con dei pezzi formattati al posto dei segnaposto */
function richText(
  template: string,
  values: Record<string, { text: string; marks?: { type: string }[] }>
) {
  return template
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((piece) => {
      const name = piece.match(/^\{(\w+)\}$/)?.[1]
      const value = name ? values[name] : undefined
      return value
        ? { type: "text", text: value.text, marks: value.marks }
        : { type: "text", text: piece }
    })
}

const node = (
  n: Partial<BoardNode> & { id: string; x: number; y: number }
): BoardNode => normalizeNode(n)

function edge(
  e: Partial<BoardEdge> & { id: string; from: string; to: string }
): BoardEdge {
  return {
    fromSide: "auto",
    toSide: "auto",
    label: "",
    routing: null,
    head: null,
    tail: null,
    style: null,
    color: null,
    width: null,
    ...e,
  }
}

const wire = (
  id: string,
  kind: keyof typeof WIRE_SPECS,
  x: number,
  y: number,
  extra: Partial<BoardNode> = {}
): BoardNode => {
  const s = WIRE_SPECS[kind]
  return normalizeNode({
    id,
    kind: "wire",
    wire: kind,
    wireProps: { ...(s.props ?? {}) },
    x,
    y,
    w: s.w,
    h: s.h,
    text: s.text ?? "",
    color: "white",
    align: "left",
    fontSize: 13,
    outline: false,
    shadow: false,
    ...extra,
  })
}

export function seedFiles(): WFile[] {
  const now = Date.now()
  const table = newTable(3, 4)
  table.cells = [
    tr("Fase"),
    "Owner",
    tr("Stato"),
    tr("Ricerca||fase di un progetto"),
    "Marta",
    tr("Fatto"),
    "Wireframe",
    "Luca",
    tr("In corso"),
    "Test",
    "Sara",
    tr("Da fare"),
  ]
  const tSize = tableSize(table)

  const board: WFile = {
    id: "demo-board",
    kind: "board",
    title: tr("Onboarding — flusso"),
    icon: "shapes",
    createdAt: now - 86400000,
    updatedAt: now - 3600000,
    data: {
      theme: {
        ...defaultBoardTheme,
        font: "manrope",
        cornerRadius: 12,
        pattern: "dots",
        mode: "diagram",
      },
      nodes: [
        node({
          id: "sec1",
          kind: "section",
          x: 40,
          y: 120,
          w: 1300,
          h: 400,
          text: tr("Percorso di attivazione"),
          color: "blue",
          align: "left",
          fontSize: 14,
          bold: true,
          shadow: false,
        }),
        node({
          id: "n1",
          x: 80,
          y: 280,
          text: tr("Visitatore"),
          shape: "pill",
          color: "gray",
          w: 160,
          h: 56,
        }),
        node({
          id: "n2",
          x: 320,
          y: 260,
          text: tr("Landing page"),
          color: "blue",
        }),
        node({
          id: "n3",
          x: 600,
          y: 254,
          text: tr("Ha un account?"),
          shape: "diamond",
          color: "yellow",
          w: 170,
          h: 120,
        }),
        node({ id: "n4", x: 880, y: 170, text: tr("Login"), color: "teal" }),
        node({
          id: "n5",
          x: 880,
          y: 360,
          text: tr("Sign up"),
          color: "purple",
        }),
        node({
          id: "n6",
          x: 1150,
          y: 264,
          text: tr("Dashboard"),
          color: "green",
          bold: true,
        }),
        node({
          id: "n7",
          x: 600,
          y: 580,
          text: tr("Ricorda: testare il\ncopy della CTA"),
          shape: "note",
          color: "yellow",
          w: 170,
          h: 150,
          fontSize: 14,
          outline: false,
        }),
        node({
          id: "n8",
          kind: "icon",
          icon: "rocket",
          x: 1230,
          y: 600,
          w: 56,
          h: 56,
          color: "purple",
          outline: false,
          shadow: false,
          strokeWidth: 1.8,
        }),
        node({
          id: "tbl1",
          kind: "table",
          table,
          x: 900,
          y: 580,
          w: tSize.w,
          h: tSize.h,
          color: "white",
          align: "left",
          fontSize: 13,
        }),
        node({
          id: "db1",
          x: 320,
          y: 580,
          text: tr("Utenti"),
          shape: "cylinder",
          color: "teal",
          w: 150,
          h: 116,
        }),
      ],
      edges: [
        edge({ id: "e1", from: "n1", to: "n2" }),
        edge({ id: "e2", from: "n2", to: "n3" }),
        edge({
          id: "e3",
          from: "n3",
          to: "n4",
          label: tr("sì"),
          color: "#4eb22c",
        }),
        edge({
          id: "e4",
          from: "n3",
          to: "n5",
          label: tr("no"),
          color: "#e5780b",
        }),
        edge({ id: "e5", from: "n4", to: "n6" }),
        edge({ id: "e6", from: "n5", to: "n6" }),
        edge({
          id: "e7",
          from: "n7",
          to: "n2",
          style: "dashed",
          head: "open",
          routing: "curved",
        }),
        edge({
          id: "e8",
          from: "db1",
          to: "n2",
          style: "dotted",
          head: "circle",
        }),
      ],
      viewport: { x: 20, y: -60, zoom: 0.7 },
    },
  }

  const wireboard: WFile = {
    id: "demo-wireframe",
    kind: "board",
    title: tr("App — wireframe"),
    icon: "smartphone",
    createdAt: now - 7200000,
    updatedAt: now - 600000,
    data: {
      theme: {
        ...defaultBoardTheme,
        mode: "wireframe",
        font: "inter",
        pattern: "grid",
        patternOpacity: 0.35,
        cornerRadius: 8,
      },
      nodes: [
        node({
          id: "f1",
          kind: "frame",
          frame: "phone",
          x: 80,
          y: 80,
          w: 375,
          h: 812,
          text: tr("Home"),
          color: "white",
          align: "left",
          fontSize: 13,
          shadow: false,
          radius: 36,
        }),
        wire("w1", "navbar", 96, 150, {
          w: 343,
          h: 52,
          text: tr("Cogniva|Cerca|Profilo"),
        }),
        wire("w2", "searchField", 96, 218, { w: 343 }),
        wire("w3", "tabs", 96, 274, { w: 343, text: tr("Tutti|Board|Doc") }),
        wire("w4", "card", 96, 330, {
          w: 343,
          h: 190,
          text: tr("Onboarding — flusso"),
        }),
        wire("w5", "list", 96, 540, {
          w: 343,
          h: 200,
          wireProps: { rows: 4, avatar: true },
        }),
        wire("w6", "button", 96, 764, {
          w: 343,
          h: 46,
          text: tr("Crea nuovo"),
          wireProps: { variant: "primary" },
        }),
        node({
          id: "f2",
          kind: "frame",
          frame: "browser",
          x: 560,
          y: 80,
          w: 900,
          h: 600,
          text: tr("Dashboard"),
          color: "white",
          align: "left",
          fontSize: 13,
          shadow: false,
          radius: 10,
        }),
        wire("w7", "sidebarNav", 576, 132, { w: 190, h: 532 }),
        wire("w8", "heading", 790, 140, {
          w: 320,
          h: 40,
          text: tr("Buongiorno, Libo"),
        }),
        wire("w9", "chart", 790, 196, {
          w: 400,
          h: 200,
          wireProps: { type: "bar" },
        }),
        wire("w10", "chart", 1210, 196, {
          w: 230,
          h: 200,
          wireProps: { type: "line" },
        }),
        wire("w11", "list", 790, 416, {
          w: 650,
          h: 230,
          wireProps: { rows: 5, avatar: true },
        }),
      ],
      edges: [],
      viewport: { x: 40, y: 20, zoom: 0.55 },
    },
  }

  const doc: WFile = {
    id: "demo-doc",
    kind: "doc",
    title: tr("Product brief"),
    icon: "file-text",
    createdAt: now - 43200000,
    updatedAt: now - 1800000,
    data: {
      // il documento d'esempio è nella lingua dell'app, come i nuovi
      theme: { ...defaultDocTheme, language: currentRegion() },
      content: {
        type: "doc",
        content: [
          {
            type: "docTitle",
            content: [{ type: "text", text: tr("Product brief") }],
          },
          {
            type: "paragraph",
            content: richText(
              tr(
                "Un documento di esempio. Prova la barra degli strumenti in alto, oppure seleziona del testo per il menu contestuale. Gli {styles} della scheda Home si modificano con un clic destro."
              ),
              { styles: { text: tr("Stili"), marks: [{ type: "bold" }] } }
            ),
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: tr("Obiettivi") }],
          },
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: tr("Definire il flusso di onboarding"),
                      },
                    ],
                  },
                ],
              },
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: tr("Validare il copy con 5 utenti"),
                      },
                    ],
                  },
                ],
              },
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: tr("Misurare il tasso di attivazione"),
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: tr("Flusso") }],
          },
          {
            type: "boardEmbed",
            attrs: {
              boardId: "demo-board",
              snapshot: null,
              caption: tr("Onboarding — flusso"),
              height: 320,
            },
          },
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: tr(
                      "Se non riesci a spiegarlo in una frase, non è ancora pronto."
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  }

  return [board, wireboard, doc]
}
