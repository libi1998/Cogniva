/**
 * Testo a colonne (CSV, TSV, «;» dell'Excel italiano) diviso in righe e
 * celle: le celle fra virgolette possono contenere il separatore, le
 * virgolette raddoppiate e gli a capo. Le virgolette contano solo in testa
 * alla cella: in «Schermo 5"» sono un carattere come gli altri.
 */
export function splitDelimited(text: string, delimiter: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "")
  const table: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (c === '"') {
        quoted = false
      } else {
        cell += c
      }
    } else if (c === '"' && cell === "") {
      quoted = true
    } else if (c === delimiter) {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i += 1
      row.push(cell)
      table.push(row)
      row = []
      cell = ""
    } else {
      cell += c
    }
  }
  if (cell || row.length) {
    row.push(cell)
    table.push(row)
  }
  return table
}

/** Il separatore più probabile, dalla prima riga */
export function guessDelimiter(text: string) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? ""
  const counts = [",", ";", "\t"].map(
    (d) => [d, firstLine.split(d).length] as const
  )
  return counts.sort((a, b) => b[1] - a[1])[0][0]
}
