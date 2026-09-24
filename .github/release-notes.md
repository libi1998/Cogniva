## 📝 Documents that work like Word

- **New documents start on a real A4 sheet** with Word's _Normal_ margins; _Blank page_ and _Page break_ really move to a new sheet
- **A contextual tab replaces the Style panel**: _Table_, _Picture format_, _Shape format_, _Chart format_, _Table of contents_, _Note_, _Video_, _3D model_, _Equation_ and _Board_ appear next to _View_ only while you work on that object, and open by themselves when you insert it
- **Tables with per-cell formatting**: borders side by side with pen style, width and color, shading, nine-position alignment, cell margins, row height, select cell/row/column/table, distribute columns — all saved to `.docx`
- **✥ move handle** on tables, tables of contents, charts, boards, videos, equations and 3D models: click to select, drag to move between paragraphs
- **Table of contents** with a title you type on the sheet, dot leaders and page numbers (even on a single page), moved with the handle or `⌥↑`/`⌥↓`
- **Headers and footers on the sheet**: double-click the margin and type in the left, center and right parts, with page number, page count, title, author and date one click away
- **Real shapes**: solid fill and outline, in front of the text and free to move, with fill, outline and text in _Shape format_ and side handles to stretch them
- **Paragraph** and **Font** dialogs (keep with next, keep lines together, page break before, hanging indent, character spacing, raised/lowered text, small caps) and a new _Indents and spacing_ group in _Home_
- **Formatting marks** redone: · for spaces, ° non-breaking spaces, → tabs, ↵ line breaks, ¶ paragraphs, ¤ cells — they no longer move the text or end up in exports

## 🖨️ Real vector PDF and SVG

- The PDF is no longer a picture of each page: text is drawn with the real outlines of the letters, from the same font files the browser uses (variable fonts included), sharp at any zoom
- Backgrounds, borders, highlights, underlines, shapes, charts, boards, icons and formulas become vector paths; links stay clickable
- **Always 600 dpi and always selectable text**: no quality or text options to pick any more — what can't be vector (photos, shadows, filters) is rendered at 600 dpi, and the PDF always carries searchable, copyable text
- The document's SVG export is true vector paths too, readable by any program

## 🏠 Home

- **Folders** in the sidebar: create, rename and delete them (files stay safe, with Undo); move files with _Move to_ or by dragging them onto a folder. Folders travel with the `.json` export
- **Select several files** with the checkbox, ⌘/Ctrl + click, ⇧ + click or ⌘A: favorite, duplicate, move, export or trash them all at once; restore or delete them forever from the trash
- A cleaner sidebar: the drag-and-drop hint and the _Import from Word_ button are gone (dragging a file still works)

## ⚡ Faster

- **Long documents**: when paginating takes longer than a third of a frame, pages are redone at short intervals while you type instead of on every key; short documents stay instant
- **Boards**: dragging redraws once per frame instead of for each of the 120–240 mouse or pen events per second; pen and eraser still get every point
- Actions on many files are a single save and a single redraw

## 🐛 Fixes

- Rectangles, rounded rectangles, pills, notes, ellipses and clouds are no longer drawn empty; a shape inserted mid-sentence no longer splits the paragraph
- Spaces typed in headers and footers are kept, and the field bar no longer covers the first line
- Selection handles no longer show up in the preview and in the PDF
- The page no longer scrolls 28 px under the app (a click could land on the item below the one you meant)
- The _Add-ins_ group is always a single button; number boxes select their value on focus, so typing replaces it (no more "11,5" instead of "1")

## 🔄 Upgrading

Nothing to do: your files stay in your browser. Shapes saved with the previous version redraw themselves the first time you open the document.

---

☕ Enjoying Cogniva? [Buy me a coffee on PayPal](https://www.paypal.me/liborioriggi98) — it keeps the project going. Thank you! 💜

**Full changelog**: https://github.com/libi1998/Cogniva/compare/v1.1.1...v1.2.0
