# 📖 Cogniva — Complete guide

> Back to the [README](../README.md) for the overview and quick start.

> 🇮🇹 Cogniva's interface is currently in Italian. This guide describes every feature in
> English and quotes the Italian label in parentheses where it helps you find it.

**Boards** (an infinite canvas for diagrams, wireframes and brainstorming) and
**documents** with a full ribbon toolbar, in a single app. No account and no server: files
live in the browser (IndexedDB), can be imported from DOCX and Markdown and exported to
PDF, DOCX, Markdown, PNG, SVG and JSON. All 308 fonts ship with the project; the network is
only needed for online videos, a few optional add-ins and, in some browsers, dictation.

## Stack

- **Next.js 16.3** (App Router, Turbopack, React Compiler) + **React 19.3**
- **Tailwind CSS 4.3** + **shadcn/ui** (`base-nova` style on **Base UI**, preset
  `b37aIC264`: zinc and indigo, Inter)
- **Zustand 5** for state, with history (undo/redo) and persistence in **IndexedDB**, one
  record per file
- **Tiptap 3** for documents, with a custom pagination engine for real pages
- **KaTeX** for equations
- **docx** and **mammoth** to export and import DOCX documents, **marked** for Markdown
  (all loaded only when needed)
- **cmdk** for the command palette
- **three.js** for 3D models, **Transformers.js**, **ONNX Runtime Web** and **Piper** for
  on-device translation and neural voices
- Hand-drawn SVG charts, shared by documents and boards
- Hand-written board canvas: pan/zoom, drag, resize, connectors, alignment guides,
  freehand drawing — no diagramming library
- **html2canvas-pro** for document PNGs
- TypeScript 6 in `strict` mode, ESLint 10, Prettier with Tailwind class sorting

## Getting started

```bash
pnpm install
```

```bash
pnpm dev
```

Then open http://localhost:3000. Other commands:

| Command         | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| `pnpm build`    | production build (also type-checks)                             |
| `pnpm start`    | runs the production build                                       |
| `pnpm check`    | types, lint and formatting in one go                            |
| `pnpm test:e2e` | end-to-end tests in real browsers (Chrome and Safari)           |
| `pnpm format`   | formats the code                                                |
| `pnpm fonts`    | downloads the fonts again and regenerates `lib/font-catalog.ts` |
| `pnpm icons`    | regenerates `lib/icon-library.ts` from the Lucide icons         |

> TypeScript stays on version 6: `typescript-eslint` doesn't support 7 yet, which no
> longer ships the JavaScript API it relies on.

## All files

- **Full-text search**: the search box at the top looks through titles and inside files
  (document text, board shapes, tables and charts), ignoring accents, and shows the
  matching snippet
- **Sort** by last modified, created date or name
- **Favorites** and **Trash**: a deleted file can be restored (also from the _Undo_ button
  in the notification); the trash empties itself after 30 days
- **Import** DOCX (`.docx`), Markdown (`.md`), HTML and plain-text files: they become
  editable documents with headings, lists, tables, images, footnotes and endnotes,
  checklists and formulas (`$…$`). Just drag the files onto the window
- **Export everything** to JSON and import it on another computer: files are added to the
  existing ones, nothing gets overwritten

## Command palette and shortcuts

`⌘K` (Ctrl+K) opens the palette from any page: new files, open files by name, theme,
import and every command of the current page — in a document insert tables, charts,
equations, notes and a table of contents, find and replace, comment, change the view and
export; on a board tools, modes, fit to window and exports. Recently used commands stay at
the top.

`?` (or `⌘/`) shows every keyboard shortcut for boards and documents.

## Boards

### Three modes

The switcher at the top (or the **Style** panel, _Stile_) changes the tools and defaults:

| Mode                      | What it's for                                        |
| ------------------------- | ---------------------------------------------------- |
| **Diagram** (_Diagramma_) | Flowchart shapes and connectors                      |
| **Wireframe**             | Drag-and-drop UI components and device frames        |
| **Cards** (_Card_)        | Sticky notes and cards, for brainstorming and kanban |

Every element stays available in every mode: only the toolbar order changes.

### The page

By default the canvas is **infinite**. From **Style → Page** you can pick a paper size
(A4, A3, Letter…) and orientation: the sheet appears, the area around it becomes the
"desk", and the sheet also defines what gets exported — an A4 PDF really is A4. The **Fit
to view** button frames the sheet.

### Elements

- **Shapes** — 16 types: card, rectangle, pill, ellipse, decision (diamond),
  input/output, preparation (hexagon), database (cylinder), triangle, document, cloud,
  star, cross, arrow, sticky note, text
- **Wireframe components** — 35 low-fidelity components grouped into Basic, Form, Content
  and Structure (buttons, inputs, checkboxes, sliders, avatars, images, charts, cards,
  lists, calendar, navbar, tabs, breadcrumbs, sidebar, modals, alerts, pagination,
  footer…), each with editable properties
- **Frames** — Free frame, Browser, Desktop, Tablet, Phone, Watch, with the device bezel.
  Moving a frame moves everything inside it
- **Sections** — titled boxes that group your work; they move with their content
- **Tables** — editable rows and columns, cells edited with a double click, header and
  banded rows
- **Charts** (`K`) — column, bar, line, area, pie, doughnut, radar and scatter, with the
  **Edit data…** sheet (paste straight from any spreadsheet)
- **Icons** — 258 Lucide icons with search and categories
- **Freehand drawing** — pen, highlighter and eraser
- **Connectors** — see below

### Customization (Style panel)

| Setting        | Options                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Font**       | 8 families (Inter, Manrope, Space Grotesk, Poppins, Lora, Caveat, Architects Daughter, JetBrains Mono)                                          |
| **Radius**     | card corner radius 0–48px, global with per-element overrides                                                                                    |
| **Background** | _Auto_ (follows the theme), 12 presets, custom color; dots/grid/crosses/lines pattern with intensity                                            |
| **Arrows**     | routing (straight / elbow / curved), head and tail (10 types), line (solid, dashed, dotted, hand-drawn **sketch**), width, color, corner radius |
| **Page**       | Infinite or A3/A4/A5/Letter/Legal/Tabloid + orientation                                                                                         |
| Other          | shape, color, text, outline, shadow, order, lock                                                                                                |

Each connector can override the board style; _"use the board style"_ goes back to
inheriting it.

### Controls

| Action             | How                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tools              | `V` select · `H` hand · `R` card · `O` ellipse · `D` diamond · `S` sticky note · `T` text · `C` connector · `F` frame · `G` section · `B` table · `P` pen · `E` eraser |
| Create             | double-click the canvas, or tool + click (or drag to size)                                                                                                             |
| Connect            | drag one of the 4 handles on the edge; dropping on empty space creates a connected card                                                                                |
| Edit text          | double-click (or `Enter` with the element selected)                                                                                                                    |
| Cells and labels   | double-click the cell or the connector                                                                                                                                 |
| Context menu       | right-click the canvas, an element or a connector                                                                                                                      |
| Multiple selection | selection rectangle or `⇧` + click                                                                                                                                     |
| Copy / Cut / Paste | `⌘C` / `⌘X` / `⌘V` — also into a document                                                                                                                              |
| Order              | `⌘]` / `⌘[` (with `⇧` bring to front / send to back)                                                                                                                   |
| Pan the view       | scroll wheel, `space` + drag, middle mouse button                                                                                                                      |
| Zoom               | `⌘`/`Ctrl` + scroll wheel, or the controls at the bottom left                                                                                                          |
| Duplicate / Delete | `⌘D` / `Backspace`                                                                                                                                                     |
| Undo / Redo        | `⌘Z` / `⇧⌘Z`                                                                                                                                                           |

While dragging an element, **alignment guides** appear with snapping to edges and centers.

## Documents

A rich text editor with a ribbon toolbar.

### The title is part of the document

The title isn't a separate field but the first node of the editor: it accepts bold,
italic, color, highlight, font, size, alignment and line spacing exactly like the rest of
the text. `Enter` or `Tab` jump to the start of the body, `Backspace` at the start of the
body goes back to the end of the title. The file name follows it, and renaming from the
top bar rewrites the title on the page.

### Ribbon

Nine tabs. Only the open tab is rendered (the ribbon stays light while you
type); the selected tab is remembered, and double-clicking a tab collapses the ribbon.

| Tab                             | Groups                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**                        | **Undo** · **Clipboard** · **Font** (typeable name and size, colors, highlight, change case) · **Paragraph** (lists, indents, alignment, line spacing, borders and shading) · editable **Styles** · **Editing** · **Voice** (dictation) · **Add-ins**          |
| **Insert** (_Inserisci_)        | cover page, blank page, page break · table · pictures, shapes, icons, smart diagrams, screenshot, **chart**, **3D models**, board · **online video** · link, bookmark, cross-reference · comment · header, footer, page numbers · text, **equations**, symbols |
| **Draw** (_Disegno_)            | pens, highlighter and eraser · ink to shape · drawing canvas · ink replay                                                                                                                                                                                      |
| **Layout**                      | margins, orientation, size, columns · breaks, **line numbers**, hyphenation · indents and spacing · arrange: position, wrap text, bring forward/send backward, align, rotate, selection pane                                                                   |
| **Design** (_Progettazione_)    | themes, style sets, colors, fonts, paragraph spacing, set as default · **watermark**, page color, page borders                                                                                                                                                 |
| **References** (_Riferimenti_)  | table of contents · **citations and bibliography** (APA, MLA, Chicago, ISO 690) · **footnotes** and endnotes · captions, table of figures, cross-reference                                                                                                     |
| **Mailings** (_Corrispondenza_) | envelopes and labels · **mail merge**: recipients, address block, greeting line, fields and rules · preview results · finish and merge                                                                                                                         |
| **Review** (_Revisione_)        | spelling, **Thesaurus**, word count · **read aloud** · accessibility checker · **translate**, language · **comments** · **track changes** with accept/reject · compare · restrict editing · ink                                                                |
| **View** (_Visualizza_)         | read mode, print layout, web layout, outline, draft · focus and immersive reader · ruler, gridlines, navigation pane · zoom, one page, multiple pages · new window, full screen                                                                                |

Every command lives in exactly one place: file settings are in the tabs, and the panel on
the right only shows what you're working on.

### Style panel (_Stile_)

Contextual: it changes with the selection and never shows file settings.

| Selection    | What you get                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Text**     | character spacing, first-line indent                                                                                                    |
| **Picture**  | wrapping, position and alignment, coordinates, width, rotation, border, shadow, alt text                                                |
| **Table**    | rows, columns, merge/split cells, headers · **line width, style and color**, banded rows · cell shading and vertical alignment          |
| **Board**    | height, caption, move up/down, open the board                                                                                           |
| **Note**     | note text (opens ready for typing), at the bottom of the page or at the end of the document, delete                                     |
| **Chart**    | type, title, data sheet, legend, palette, stacked, labels, gridlines, smooth lines, axis titles, width, height, alignment               |
| **Equation** | LaTeX with explained errors, inline or on its own line, structures (fractions, roots, sums, integrals, matrices…) and one-click symbols |
| **Citation** | source, cited pages, edit the source                                                                                                    |
| **Video**    | address, width, alignment                                                                                                               |
| **3D model** | preset views, zoom, auto-rotate, color, background, alt text, width, height, alignment, replace                                         |

### Pictures

Seven text wrapping options:

| Wrapping              | Effect                                            |
| --------------------- | ------------------------------------------------- |
| **In line with text** | on its own line, aligned left, center or right    |
| **Square**            | to the left or right, text flows around it        |
| **Tight**             | like square, with text closer                     |
| **Through**           | text almost touching                              |
| **Top and bottom**    | no text on the sides                              |
| **Behind text**       | out of the flow, under the text, free coordinates |
| **In front of text**  | out of the flow, over the text, free coordinates  |

**Every option except "In line" can be dragged freely on the page.**

- **With text wrapping** (square, tight, through, top and bottom) the picture anchors to
  the paragraph where you drop it and remembers its distance from the margin and from the
  start of the paragraph: text flows around it there, and the picture follows the
  paragraph when the text moves ("move with text"). Text flows on the wider
  side.
- **Behind and in front of text** stay fixed on the page, at free coordinates.

The panel's 3×3 grid places it top, middle or bottom, left, center or right, **relative to
the margins or the page**, for every wrapping option; _Center horizontally_ and _Center
vertically_ center it on one axis only; distances and coordinates are set in centimeters.
An in-line picture that gets a position becomes "Square". A picture behind the text is
selected with `⌥` + click; `⌥↑` and `⌥↓` move it by one block, the corners resize it.

### Margins

The four margins are independent: drag them from the ruler handles (left and right at the
top, top and bottom on the side), type them in centimeters in the page diagram (`↑`/`↓` by
0.1 cm, with `⇧` by 1 cm) or pick a preset: Normal, Narrow, Moderate, Wide.

### Page

- **Size**: A4, A5, A3, Letter, Legal, Tabloid or free-form, with orientation
- **Real pages**: with a paper size the document is split into separate sheets, each with
  its own four margins, header, footer and number. A paragraph breaks across two pages
  line by line (never a single line at the bottom or top, with widow/orphan
  control), a heading stays with the paragraph that follows it, tables break between rows.
  A page break really moves to the next sheet. Printing and PDF break exactly where you
  see it on screen: the gap between sheets exists only on screen
- **Footnotes** (`⌥⌘F`) at the bottom of the page of their reference, with the space
  reserved; **endnotes** (`⌥⌘D`) numbered i, ii, iii at the end of the document. A note can
  be switched from one type to the other in the panel
- **Line numbers** in the margin: continuous or restarting on every page
- **Columns**: one, two or three, with column breaks (with multiple columns the pages are
  shown as guides)
- **Page borders** thin, thick or double, and **page color**
- **Table of contents** that updates itself from the headings

### Comments

Comment on the selected text (or the word under the cursor) from **Review**, from the
selection toolbar, from the right-click menu or with `⌥⌘M`. Comments sit in the right
margin, each at the height of its text, with author and date: reply, resolve (they stay
dashed), delete, browse. Commented text is highlighted on screen but not in print or
exports. The conversation is stored in the file separately from the text: undoing an edit
doesn't delete the replies.

### Equations

**Insert › Equation** offers a new formula, an inline one and eight presets (quadratic
formula, binomial theorem, Taylor, Fourier…). Typing `$x^2$` in the text creates an inline
formula, `$$…$$` on an empty line a display formula. Edit them in LaTeX from the panel,
with one-click structures and symbols.

### Citations and bibliography

**Manage sources** collects books, articles, websites and reports with authors, year,
publisher or journal, pages and URL. **Insert citation** puts "(Eco, 1977, p. 12)" in the
text; **Bibliography** lists the cited sources alphabetically. Switching style (APA, MLA,
Chicago author-date, ISO 690) rewrites citations and bibliography automatically.

### Charts

Eight types, ready-made sample data and a data sheet where you can paste a table copied
from any spreadsheet app (Italian-style numbers like "1.234,5" work too). The
drawing is SVG: it stays sharp at every zoom level, in print and in exports. The same
charts are available on boards.

### Online videos

YouTube, Vimeo, Loom, Dailymotion or a video file. The document shows a preview: the
player only loads when you press play. Printouts and exports keep the preview and the
address.

### 3D models

**Insert › 3D Models** (_Modelli 3D_): a glTF model (`.glb`, or `.gltf` with embedded data,
up to 40 MB) from your device or an https address, or one of twelve ready-made **3D
shapes**. In the document you rotate it by dragging and zoom with the scroll wheel when
it's selected; the Style panel has preset views (front, top, isometric…), zoom,
auto-rotate, color, background, size and alt text. three.js is downloaded only when a model
appears on screen, and an off-screen model doesn't hold on to a WebGL context. Print, PDF,
PNG and DOCX use a snapshot of the current view.

### Review: voice, synonyms and translation

- **Read aloud** reads from the cursor (or the selection) one sentence at a time and
  highlights the sentence and the word without touching the selection or the undo
  history. The bar at the bottom has previous/next paragraph, a pause that resumes from the
  exact word, speed from 0.5× to 2× and stop; reading continues when you switch tabs.
  Voices: the system ones, sorted by quality (neural, premium and cloud voices
  first, no novelty voices), or **Cogniva neural voices** (Piper) that run on your device
  in every browser: downloaded once (~64 MB), verified with SHA-256 and then available
  offline. The chosen voice is remembered per language
- **Thesaurus** (`⇧F7`, or _Sinonimi_ in the context menu): synonyms grouped by meaning,
  with inflected forms mapped to their entry ("stili" → "stile", "stilo"), history, and
  insertion that keeps the original capitalization. Italian, English, French, German,
  Spanish and Portuguese; each dictionary is downloaded on the first lookup
- **Translate** uses the browser's built-in translator where available (Chrome, Edge) and
  on-device OPUS-MT models everywhere else (Safari, Firefox…), with progress and cancel.
  The translated document keeps its structure, bold text and links; a translated selection
  replaces the original text

### Add-ins

**Home › Add-ins** (_Componenti aggiuntivi_) opens the active add-ins in a pane next to the
document; the gallery adds and removes them (your choice is saved in the browser). They
are all written in Cogniva, with no third-party code running in the page: **QR Code**
(link, Wi-Fi, e-mail, phone), **Readability** (Gulpease, Flesch and the indexes for other
languages, sentences to simplify), **Placeholder text**, **Signature**, **Wikipedia** and
**Free images** (Openverse, with author and license in the caption). The last two use the
internet, say so, and start disabled.

### Fonts

**308 fonts**: six free metric-compatible alternatives to the most common document fonts
(the installed font is used when available), sans serif, serif, monospace, display and handwriting. The font lists have search, groups and
recently used fonts, and every entry is rendered in its own font. The files ship with the
project (`fonts/`, 14 MB): a font is loaded only when some text uses it. Regenerate them
with `pnpm fonts`.

### Find and replace

`⌘F` opens the pane (_Replace_ opens it on the second field): it counts the matches,
highlights all of them with the active one in orange, and has toggles for **match case**
and **whole words only**. `↵` and `⇧↵` step through them, and you can replace one at a time
or all at once.

### Status bar

"Page X of Y" (the cursor's page), words, characters, language, paper size, and zoom from
50% to 200% with slider, percentage and _Fit_. Zoom also responds to `⌘+`, `⌘−`, `⌘0` and
`ctrl` + scroll wheel; the cursor lands in the right spot at any zoom level.

### More

- **Dictation**: speak and the text appears at the cursor, in Italian. Punctuation is
  spoken as words ("virgola", "punto", "punto interrogativo", "a capo", "nuovo
  paragrafo"…), capitalization is automatic, the session restarts after pauses and the
  status bar shows the incoming text while you speak. Where the browser allows it (recent
  Chrome) recognition happens on the device, without internet. The browser asks for
  microphone permission, and Firefox doesn't support dictation
- **Paste from boards**: elements copied from a board become a vector preview in the
  document; an embedded whole board stays linked
- **Context menu** on right-click and a **bubble menu** on the selection
- **Narrow windows**: below 900px the panel starts closed; between 900 and 1180px it floats
  over the page without covering the status bar
- **Speed**: on a 12,000-word document a keystroke costs about 0.3 ms, and pagination adds
  about 1 ms (it measures everything before the browser paints, so nothing jumps). Words,
  characters and line numbers are counted when idle; formulas, citations and bibliography
  are rendered without React

## Light and dark theme

Toggle at the top right (Light / Dark / System), also from the palette. The theme is
applied before the page appears, so there's no light flash in dark mode. Canvas
background, page background and sheet color have an **Auto** value that follows the theme;
any color picked by hand stays fixed.

## Export

|              | Board                                 | Document                  |
| ------------ | ------------------------------------- | ------------------------- |
| **PDF**      | ✔ **vector**, selectable text         | ✔ **vector**, multi-page  |
| **DOCX**     | —                                     | ✔ editable `.docx`        |
| **Markdown** | —                                     | ✔ `.md` (GitHub Flavored) |
| **SVG**      | ✔ pure vector (~40 KB, embedded font) | ✔ (used fonts embedded)   |
| **PNG**      | ✔ 3× from the vector                  | ✔ 2.5×                    |

### DOCX

The `.docx` is a real, editable word-processing document, not a picture: title and headings
with standard heading styles (navigation panes recognize them), bold, italic, colors, highlight, font and size,
alignment, indents, line spacing, paragraph shading and borders, nested bulleted and
numbered lists, checklists, quotes and code, **tables** with header, cell colors, line
width, style and color, **footnotes and endnotes** as native notes, **comments** with
author, date and replies, **tracked changes**, links, citations and bibliography in the
chosen style, table of contents, page and column breaks, pictures with their text
wrapping, **watermark**, header, footer and **page numbers**, paper size, orientation,
margins, columns, page borders and **line numbers**. Charts, equations, embedded boards
and 3D models become high-resolution pictures. Fonts that aren't installed on the computer
opening the file are substituted by the word processor.

### Markdown

Headings, emphasis, links, nested lists and checklists, tables, code, formulas (`$…$` and
`$$…$$`), footnotes `[^1]`, a table of contents linking to the headings, and the
bibliography. Charts become a table of their data. Opening the file again in Cogniva
restores everything, notes and formulas included.

### Boards and PDF

Boards are exported from a **native** SVG renderer (`board-preview.tsx`): no
`<foreignObject>`, only shapes, paths and `<text>`. The file stays light, opens in any
vector editor and rasterizes at high resolution. The PNG scale is reduced automatically if
the canvas would exceed Chromium's limits.

The **automatic** sheet is always printed and exported **light**, even with the app in
dark mode, and printing keeps backgrounds — colored cells, highlights, page color —
without having to enable "Background graphics".

The **PDF goes through the browser's print engine**: it's the only way to get a truly
vector PDF, with the right fonts and selectable text. Choosing _PDF_ opens the print dialog
already set to the paper size: just pick "Save as PDF".

## Project structure

```
app/                        # routes: home, /board/[id], /doc/[id]; layout with theme and fonts
components/
├── board/                  # canvas, nodes, edges, toolbar, panels, wireframes,
│                           # static preview, context menu, inspector
├── doc/                    # Tiptap editor and its extensions (extensions.ts),
│   │                       # contextual panel, bubble menu, rulers, margins,
│   │                       # pictures, notes, table of contents, find and replace,
│   │                       # outline, format painter, dictation, comments, equations,
│   │                       # videos, 3D models, citations, charts, line numbers,
│   │                       # read aloud, thesaurus pane
│   ├── addins/             # add-ins, gallery and task pane API
│   └── ribbon/             # ribbon: Home, Insert, Draw, Layout, Design,
│                           # References, Mailings, Review, View
├── home/                   # file screen, previews
├── shared/                 # top bar, command palette, theme, logo, font picker,
│                           # charts, color picker, primitives
└── ui/                     # shadcn/ui (Base UI)
docs/                       # this guide and the README screenshots
e2e/                        # Playwright end-to-end tests
fonts/                      # the 308 font files and their @font-face rules
lib/
├── store.ts                # state, history, trash
├── persist.ts              # IndexedDB persistence, one record per file
├── storage.ts              # localStorage keys and migration from Whimsy
├── import-doc.ts           # DOCX, Markdown, HTML and text → document
├── import-files.ts         # import from picked or dropped files
├── export-docx.ts          # document → DOCX
├── export-markdown.ts      # document → Markdown
├── export*.ts              # PNG / SVG / PDF
├── search.ts               # search inside file contents
├── use-theme.ts            # light/dark/system theme (applied before first paint)
├── geometry.ts             # anchors, connector routing, arrowheads
├── shapes.ts · sketch.ts   # shape paths and the "hand-drawn" stroke
├── items.ts                # element types, wireframe components, frames, tables
├── icon-library.ts         # icons extracted from Lucide (generated)
├── palette.ts              # content colors, zinc neutrals
├── tiptap-extensions.ts    # title, indents, spacing, paragraph, breaks,
│                           # table of contents, notes, tables, comments, pictures
├── track-changes.ts        # tracked insertions and deletions
├── pagination.ts           # real pages: spacers, footnotes
├── chart.ts · citations.ts # charts; APA, MLA, Chicago, ISO 690 styles
├── read-aloud/             # read aloud, system and neural voices
├── translate/              # on-device translation worker
├── thesaurus/              # synonym dictionaries
├── model3d/                # 3D model viewer
├── addins.ts               # add-in registry
├── fonts.ts                # the 308 fonts; font-catalog.ts is generated
└── seed.ts                 # sample content on first launch
```

## Third-party components downloaded on demand

None of these files are part of the project: the browser downloads them the first time
they're needed, from a fixed address, and keeps them in Cache Storage.

| What                                                         | From                                                                 | License                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| OPUS-MT translation models (Helsinki-NLP, Xenova conversion) | huggingface.co                                                       | CC BY 4.0                                                         |
| ONNX Runtime Web engine                                      | served from `public/ort` (copied from `node_modules`)                | MIT                                                               |
| Piper voices (Paola, Kristin, John, Alba, Siwis, Thorsten…)  | huggingface.co/rhasspy, pinned revision, SHA-256                     | CC0, public domain, CC BY 3.0/4.0 (shown next to each voice)      |
| espeak-ng phonemizer (piper-phonemize)                       | cdn.jsdelivr.net, pinned version with SRI                            | GPL-3.0                                                           |
| LibreOffice synonym dictionaries                             | cdn.jsdelivr.net / raw.githubusercontent.com, pinned commit, SHA-256 | GPL-3.0 (it), WordNet (en), LGPL-2.1 (fr, de, es), CC BY 3.0 (pt) |

The Content Security Policy allows only the phonemizer as an external script, and
`wasm-unsafe-eval` lets the app compile WebAssembly without enabling `eval`.

## Notes

- Files live in **IndexedDB** (database `cogniva`, one record per file): only changed files
  are rewritten and the storage limit is your disk, so pasted pictures no longer fill up the
  5 MB of `localStorage`. The app also asks the browser not to evict the data when space
  runs low. If a save fails, a warning appears.
- **Coming from Whimsy** in the same browser and at the same address, on first launch
  files, the open ribbon tab, the author name and recent fonts are copied into Cogniva;
  elements copied from a Whimsy board can still be pasted.
- On startup saved files are normalized (new fields, icons), so files from earlier
  versions keep opening.
- Every file has an icon picked from Lucide: change it from the button next to the title.
  The file name is also the browser tab title.
- Chromium marks canvases that draw an SVG containing `<foreignObject>` as "tainted",
  making it impossible to extract a PNG from them: that's why boards use a native SVG and
  document PNGs go through html2canvas-pro.
