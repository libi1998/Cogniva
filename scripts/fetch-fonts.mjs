#!/usr/bin/env node
/**
 * Scarica i caratteri aggiuntivi da Google Fonts e li salva nel progetto.
 *
 * Si lancia una volta sola (`node scripts/fetch-fonts.mjs`): dopo, l'app non
 * ha più bisogno della rete. Per ogni famiglia tiene solo il sottoinsieme
 * latino (italiano compreso), in woff2, con tondo e corsivo quando esistono.
 *
 * Produce:
 *   fonts/files/*.woff2      i file dei caratteri
 *   fonts/fonts.css          le @font-face, importate dal layout
 *   lib/font-catalog.ts      l'elenco usato dall'interfaccia
 */
import { mkdir, writeFile, rm, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const OUT = path.join(ROOT, "fonts");
const FILES = path.join(OUT, "files");
// si scarica in una cartella a parte: se qualcosa va storto a metà, i
// caratteri già installati restano com'erano
const STAGING = path.join(OUT, "files.tmp");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/**
 * [famiglia Google, etichetta, gruppo, scala per le board, pila di riserva]
 * Le prime sei hanno le stesse metriche dei caratteri di Office: un documento
 * scritto in «Calibri» occupa lo stesso spazio anche dove Calibri non c'è.
 */
const LIST = [
  // compatibili con Word: prima il carattere installato, poi il gemello
  ["Arimo", "Arial", "word", 1, "Arial"],
  ["Carlito", "Calibri", "word", 1.04, "Calibri"],
  ["Caladea", "Cambria", "word", 1, "Cambria"],
  ["Cousine", "Courier New", "word", 0.96, "Courier New"],
  ["Gelasio", "Georgia", "word", 0.98, "Georgia"],
  ["Tinos", "Times New Roman", "word", 1.04, "Times New Roman"],
  // sans serif
  ["Roboto", "Roboto", "sans", 1],
  ["Open Sans", "Open Sans", "sans", 0.97],
  ["Lato", "Lato", "sans", 1.02],
  ["Montserrat", "Montserrat", "sans", 0.95],
  ["Oswald", "Oswald", "sans", 1.05],
  ["Raleway", "Raleway", "sans", 0.98],
  ["Nunito", "Nunito", "sans", 1],
  ["Nunito Sans", "Nunito Sans", "sans", 1],
  ["PT Sans", "PT Sans", "sans", 1.02],
  ["Source Sans 3", "Source Sans 3", "sans", 1.04],
  ["Noto Sans", "Noto Sans", "sans", 0.97],
  ["Ubuntu", "Ubuntu", "sans", 1],
  ["Roboto Condensed", "Roboto Condensed", "sans", 1.04],
  ["Work Sans", "Work Sans", "sans", 0.97],
  ["Rubik", "Rubik", "sans", 0.98],
  ["Fira Sans", "Fira Sans", "sans", 0.98],
  ["DM Sans", "DM Sans", "sans", 1],
  ["Quicksand", "Quicksand", "sans", 1],
  ["Karla", "Karla", "sans", 1.02],
  ["Mulish", "Mulish", "sans", 1],
  ["Barlow", "Barlow", "sans", 1.02],
  ["Heebo", "Heebo", "sans", 1],
  ["IBM Plex Sans", "IBM Plex Sans", "sans", 0.98],
  ["Libre Franklin", "Libre Franklin", "sans", 0.97],
  ["Josefin Sans", "Josefin Sans", "sans", 1.04],
  ["Titillium Web", "Titillium Web", "sans", 1.02],
  ["Cabin", "Cabin", "sans", 1],
  ["Fredoka", "Fredoka", "sans", 1],
  ["Archivo", "Archivo", "sans", 0.98],
  ["Archivo Black", "Archivo Black", "sans", 0.9],
  ["Outfit", "Outfit", "sans", 1],
  ["Plus Jakarta Sans", "Plus Jakarta Sans", "sans", 0.97],
  ["Sora", "Sora", "sans", 0.95],
  ["Lexend", "Lexend", "sans", 0.96],
  ["Red Hat Display", "Red Hat Display", "sans", 1],
  ["Figtree", "Figtree", "sans", 1],
  ["Public Sans", "Public Sans", "sans", 0.98],
  ["Alegreya Sans", "Alegreya Sans", "sans", 1.04],
  ["Geist", "Geist", "sans", 0.98],
  ["Atkinson Hyperlegible", "Atkinson Hyperlegible", "sans", 0.98],
  ["Instrument Sans", "Instrument Sans", "sans", 1],
  ["Bebas Neue", "Bebas Neue", "sans", 1.12],
  ["Anton", "Anton", "sans", 0.95],
  // serif
  ["Merriweather", "Merriweather", "serif", 0.94],
  ["Playfair Display", "Playfair Display", "serif", 1],
  ["PT Serif", "PT Serif", "serif", 0.98],
  ["Source Serif 4", "Source Serif 4", "serif", 1],
  ["Noto Serif", "Noto Serif", "serif", 0.96],
  ["Roboto Slab", "Roboto Slab", "serif", 0.97],
  ["IBM Plex Serif", "IBM Plex Serif", "serif", 0.97],
  ["Libre Baskerville", "Libre Baskerville", "serif", 0.92],
  ["EB Garamond", "EB Garamond", "serif", 1.08],
  ["Cormorant Garamond", "Cormorant Garamond", "serif", 1.12],
  ["Crimson Pro", "Crimson Pro", "serif", 1.1],
  ["Bitter", "Bitter", "serif", 0.97],
  ["Arvo", "Arvo", "serif", 0.96],
  ["Spectral", "Spectral", "serif", 1],
  ["Alegreya", "Alegreya", "serif", 1.04],
  ["Vollkorn", "Vollkorn", "serif", 1.02],
  ["Cinzel", "Cinzel", "serif", 0.95],
  ["Zilla Slab", "Zilla Slab", "serif", 1.04],
  ["DM Serif Display", "DM Serif Display", "serif", 1],
  ["Instrument Serif", "Instrument Serif", "serif", 1.1],
  ["Newsreader", "Newsreader", "serif", 1.04],
  ["Fraunces", "Fraunces", "serif", 0.97],
  ["Bodoni Moda", "Bodoni Moda", "serif", 1],
  // monospace
  ["Roboto Mono", "Roboto Mono", "mono", 0.94],
  ["Fira Code", "Fira Code", "mono", 0.94],
  ["IBM Plex Mono", "IBM Plex Mono", "mono", 0.94],
  ["Inconsolata", "Inconsolata", "mono", 1.04],
  ["Space Mono", "Space Mono", "mono", 0.92],
  ["Source Code Pro", "Source Code Pro", "mono", 0.94],
  ["Courier Prime", "Courier Prime", "mono", 0.96],
  ["Geist Mono", "Geist Mono", "mono", 0.94],
  // decorativi
  ["Abril Fatface", "Abril Fatface", "display", 0.95],
  ["Lobster", "Lobster", "display", 1.02],
  ["Comfortaa", "Comfortaa", "display", 0.95],
  ["Righteous", "Righteous", "display", 0.98],
  ["Alfa Slab One", "Alfa Slab One", "display", 0.92],
  ["Bungee", "Bungee", "display", 0.85],
  ["Press Start 2P", "Press Start 2P", "display", 0.7],
  ["Special Elite", "Special Elite", "display", 0.96],
  // manoscritti
  ["Pacifico", "Pacifico", "hand", 0.95],
  ["Dancing Script", "Dancing Script", "hand", 1.14],
  ["Shadows Into Light", "Shadows Into Light", "hand", 1.1],
  ["Indie Flower", "Indie Flower", "hand", 1.02],
  ["Permanent Marker", "Permanent Marker", "hand", 0.95],
  ["Satisfy", "Satisfy", "hand", 1.1],
  ["Great Vibes", "Great Vibes", "hand", 1.22],
  ["Amatic SC", "Amatic SC", "hand", 1.34],
  ["Kalam", "Kalam", "hand", 1],
  ["Patrick Hand", "Patrick Hand", "hand", 1.08],
  ["Gloria Hallelujah", "Gloria Hallelujah", "hand", 0.92],
  ["Kaushan Script", "Kaushan Script", "hand", 1.02],
  // ——— 200 caratteri aggiunti: moderni, con alfabeto latino completo ———
  // sans serif
  ["Inter Tight", "Inter Tight", "sans", 1],
  ["Jost", "Jost", "sans", 1],
  ["Kanit", "Kanit", "sans", 1],
  ["Prompt", "Prompt", "sans", 1],
  ["Merriweather Sans", "Merriweather Sans", "sans", 1],
  ["Saira", "Saira", "sans", 1],
  ["Oxygen", "Oxygen", "sans", 1],
  ["Asap", "Asap", "sans", 1],
  ["Hanken Grotesk", "Hanken Grotesk", "sans", 1],
  ["Lexend Deca", "Lexend Deca", "sans", 1],
  ["Bricolage Grotesque", "Bricolage Grotesque", "sans", 1],
  ["Epilogue", "Epilogue", "sans", 1],
  ["Rethink Sans", "Rethink Sans", "sans", 1],
  ["Mukta", "Mukta", "sans", 1],
  ["Urbanist", "Urbanist", "sans", 1],
  ["Be Vietnam Pro", "Be Vietnam Pro", "sans", 1],
  ["Assistant", "Assistant", "sans", 1],
  ["Syne", "Syne", "sans", 0.96],
  ["Schibsted Grotesk", "Schibsted Grotesk", "sans", 1],
  ["Dosis", "Dosis", "sans", 1],
  ["Unbounded", "Unbounded", "sans", 0.9],
  ["Sofia Sans", "Sofia Sans", "sans", 1],
  ["Signika", "Signika", "sans", 1],
  ["Sarabun", "Sarabun", "sans", 1],
  ["Catamaran", "Catamaran", "sans", 1],
  ["Barlow Condensed", "Barlow Condensed", "sans", 1.1],
  ["Barlow Semi Condensed", "Barlow Semi Condensed", "sans", 1.05],
  ["Golos Text", "Golos Text", "sans", 1],
  ["PT Sans Narrow", "PT Sans Narrow", "sans", 1.06],
  ["Questrial", "Questrial", "sans", 1],
  ["Kumbh Sans", "Kumbh Sans", "sans", 1],
  ["Alata", "Alata", "sans", 1],
  ["Archivo Narrow", "Archivo Narrow", "sans", 1.04],
  ["Albert Sans", "Albert Sans", "sans", 1],
  ["Didact Gothic", "Didact Gothic", "sans", 1],
  ["Onest", "Onest", "sans", 1],
  ["League Spartan", "League Spartan", "sans", 1],
  ["Chakra Petch", "Chakra Petch", "sans", 1],
  ["Andika", "Andika", "sans", 1],
  ["Red Hat Text", "Red Hat Text", "sans", 1],
  ["Alumni Sans", "Alumni Sans", "sans", 1.14],
  ["Exo 2", "Exo 2", "sans", 1],
  ["Encode Sans", "Encode Sans", "sans", 1],
  ["Atkinson Hyperlegible Next", "Atkinson Hyperlegible Next", "sans", 1],
  ["Overpass", "Overpass", "sans", 1],
  ["Varela Round", "Varela Round", "sans", 1],
  ["Chivo", "Chivo", "sans", 1],
  ["Fira Sans Condensed", "Fira Sans Condensed", "sans", 1.04],
  ["Spline Sans", "Spline Sans", "sans", 1],
  ["Funnel Sans", "Funnel Sans", "sans", 1],
  ["Reddit Sans", "Reddit Sans", "sans", 1],
  ["Readex Pro", "Readex Pro", "sans", 1],
  ["IBM Plex Sans Condensed", "IBM Plex Sans Condensed", "sans", 1.03],
  ["Hind", "Hind", "sans", 1],
  ["Abel", "Abel", "sans", 1],
  ["Mona Sans", "Mona Sans", "sans", 1],
  ["Hubot Sans", "Hubot Sans", "sans", 1],
  ["Host Grotesk", "Host Grotesk", "sans", 1],
  ["Wix Madefor Text", "Wix Madefor Text", "sans", 1],
  ["Wix Madefor Display", "Wix Madefor Display", "sans", 1],
  ["Radio Canada", "Radio Canada", "sans", 1],
  ["Commissioner", "Commissioner", "sans", 1],
  ["Anek Latin", "Anek Latin", "sans", 1],
  ["Sen", "Sen", "sans", 1],
  ["Gantari", "Gantari", "sans", 1],
  ["Afacad", "Afacad", "sans", 1],
  ["Parkinsans", "Parkinsans", "sans", 1],
  ["SUSE", "SUSE", "sans", 1],
  ["Ubuntu Sans", "Ubuntu Sans", "sans", 1],
  ["Tomorrow", "Tomorrow", "sans", 1],
  ["Pontano Sans", "Pontano Sans", "sans", 1],
  ["Mada", "Mada", "sans", 1],
  ["Cantarell", "Cantarell", "sans", 1],
  ["Martel Sans", "Martel Sans", "sans", 1],
  ["Livvic", "Livvic", "sans", 1],
  // serif
  ["Domine", "Domine", "serif", 1],
  ["Marcellus", "Marcellus", "serif", 1],
  ["Frank Ruhl Libre", "Frank Ruhl Libre", "serif", 1],
  ["Andada Pro", "Andada Pro", "serif", 1],
  ["Literata", "Literata", "serif", 1],
  ["Crimson Text", "Crimson Text", "serif", 1],
  ["Prata", "Prata", "serif", 0.95],
  ["Old Standard TT", "Old Standard TT", "serif", 1.02],
  ["Gilda Display", "Gilda Display", "serif", 1.02],
  ["Lustria", "Lustria", "serif", 1],
  ["Faustina", "Faustina", "serif", 1],
  ["Petrona", "Petrona", "serif", 1],
  ["GFS Didot", "GFS Didot", "serif", 1.04],
  ["Vidaloka", "Vidaloka", "serif", 1],
  ["Baskervville", "Baskervville", "serif", 1],
  ["Bree Serif", "Bree Serif", "serif", 1],
  ["Cardo", "Cardo", "serif", 1.04],
  ["DM Serif Text", "DM Serif Text", "serif", 1],
  ["Libre Caslon Text", "Libre Caslon Text", "serif", 1],
  ["Playfair", "Playfair", "serif", 1],
  ["Antic Slab", "Antic Slab", "serif", 1],
  ["Noticia Text", "Noticia Text", "serif", 1],
  ["Aleo", "Aleo", "serif", 1],
  ["STIX Two Text", "STIX Two Text", "serif", 1],
  ["Ovo", "Ovo", "serif", 1],
  ["Crete Round", "Crete Round", "serif", 1],
  ["Martel", "Martel", "serif", 1],
  ["Gloock", "Gloock", "serif", 1],
  ["Caudex", "Caudex", "serif", 1],
  ["Ibarra Real Nova", "Ibarra Real Nova", "serif", 1],
  ["Cormorant", "Cormorant", "serif", 1.14],
  ["Unna", "Unna", "serif", 1],
  ["Neuton", "Neuton", "serif", 1.1],
  ["Rokkitt", "Rokkitt", "serif", 1],
  ["Young Serif", "Young Serif", "serif", 1],
  ["Eczar", "Eczar", "serif", 1],
  ["Montagu Slab", "Montagu Slab", "serif", 1],
  ["Lusitana", "Lusitana", "serif", 1],
  ["Maitree", "Maitree", "serif", 1],
  ["Libertinus Serif", "Libertinus Serif", "serif", 1.06],
  ["Besley", "Besley", "serif", 1],
  ["Alike", "Alike", "serif", 1],
  ["Quattrocento", "Quattrocento", "serif", 1],
  ["Kreon", "Kreon", "serif", 1],
  ["Radley", "Radley", "serif", 1],
  ["Gentium Book Plus", "Gentium Book Plus", "serif", 1],
  ["Josefin Slab", "Josefin Slab", "serif", 1],
  ["Castoro", "Castoro", "serif", 1],
  ["Judson", "Judson", "serif", 1.06],
  ["Brygada 1918", "Brygada 1918", "serif", 1],
  // monospazio
  ["DM Mono", "DM Mono", "mono", 1],
  ["Fragment Mono", "Fragment Mono", "mono", 1],
  ["PT Mono", "PT Mono", "mono", 1],
  ["Share Tech Mono", "Share Tech Mono", "mono", 1.02],
  ["Red Hat Mono", "Red Hat Mono", "mono", 1],
  ["Azeret Mono", "Azeret Mono", "mono", 1],
  ["Martian Mono", "Martian Mono", "mono", 1],
  ["Victor Mono", "Victor Mono", "mono", 1],
  ["Chivo Mono", "Chivo Mono", "mono", 1],
  ["Spline Sans Mono", "Spline Sans Mono", "mono", 1],
  ["Ubuntu Mono", "Ubuntu Mono", "mono", 1],
  ["Fira Mono", "Fira Mono", "mono", 1],
  ["Sometype Mono", "Sometype Mono", "mono", 1],
  ["Overpass Mono", "Overpass Mono", "mono", 1],
  ["Anonymous Pro", "Anonymous Pro", "mono", 1],
  ["Reddit Mono", "Reddit Mono", "mono", 1],
  // decorativi
  ["Lobster Two", "Lobster Two", "display", 1],
  ["Changa One", "Changa One", "display", 0.98],
  ["Lilita One", "Lilita One", "display", 0.98],
  ["Audiowide", "Audiowide", "display", 0.9],
  ["Bangers", "Bangers", "display", 1.02],
  ["Dela Gothic One", "Dela Gothic One", "display", 0.86],
  ["Concert One", "Concert One", "display", 1],
  ["Oleo Script", "Oleo Script", "display", 1],
  ["Titan One", "Titan One", "display", 0.92],
  ["Calistoga", "Calistoga", "display", 1],
  ["Limelight", "Limelight", "display", 0.94],
  ["Gravitas One", "Gravitas One", "display", 0.84],
  ["Londrina Solid", "Londrina Solid", "display", 1],
  ["Chewy", "Chewy", "display", 1],
  ["Big Shoulders", "Big Shoulders", "display", 1.1],
  ["Patua One", "Patua One", "display", 1],
  ["Oxanium", "Oxanium", "display", 1],
  ["Fredericka the Great", "Fredericka the Great", "display", 1],
  ["Passion One", "Passion One", "display", 1.02],
  ["Gabarito", "Gabarito", "display", 1],
  ["Yeseva One", "Yeseva One", "display", 1],
  ["Forum", "Forum", "display", 1.08],
  ["Monoton", "Monoton", "display", 0.84],
  ["Poiret One", "Poiret One", "display", 1.06],
  ["Staatliches", "Staatliches", "display", 1.05],
  ["Luckiest Guy", "Luckiest Guy", "display", 0.92],
  ["Shantell Sans", "Shantell Sans", "display", 1],
  ["Rowdies", "Rowdies", "display", 0.92],
  ["Carter One", "Carter One", "display", 1],
  ["MuseoModerno", "MuseoModerno", "display", 1],
  // scritti a mano
  ["Rock Salt", "Rock Salt", "hand", 0.88],
  ["Homemade Apple", "Homemade Apple", "hand", 0.92],
  ["Pinyon Script", "Pinyon Script", "hand", 1.22],
  ["Italianno", "Italianno", "hand", 1.38],
  ["Merienda", "Merienda", "hand", 0.96],
  ["Reenie Beanie", "Reenie Beanie", "hand", 1.34],
  ["Yellowtail", "Yellowtail", "hand", 1.1],
  ["Mr Dafoe", "Mr Dafoe", "hand", 1.2],
  ["Courgette", "Courgette", "hand", 1],
  ["Covered By Your Grace", "Covered By Your Grace", "hand", 1.12],
  ["Sacramento", "Sacramento", "hand", 1.3],
  ["Shadows Into Light Two", "Shadows Into Light Two", "hand", 1.08],
  ["Playpen Sans", "Playpen Sans", "hand", 0.97],
  ["Tangerine", "Tangerine", "hand", 1.45],
  ["Petit Formal Script", "Petit Formal Script", "hand", 1.05],
  ["Norican", "Norican", "hand", 1.06],
  ["Style Script", "Style Script", "hand", 1.2],
  ["Alex Brush", "Alex Brush", "hand", 1.18],
  ["Coming Soon", "Coming Soon", "hand", 1],
  ["Grand Hotel", "Grand Hotel", "hand", 1.12],
  ["Cookie", "Cookie", "hand", 1.22],
  ["Damion", "Damion", "hand", 1.06],
  ["Handlee", "Handlee", "hand", 1],
  ["Parisienne", "Parisienne", "hand", 1.15],
  ["Caveat Brush", "Caveat Brush", "hand", 1.22],
  ["Comic Neue", "Comic Neue", "hand", 1],
  ["Allura", "Allura", "hand", 1.25],
  ["Gochi Hand", "Gochi Hand", "hand", 1],
  ["Pangolin", "Pangolin", "hand", 1],
];

const GENERIC = {
  word: null,
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, monospace",
  display: "ui-sans-serif, system-ui, sans-serif",
  hand: "ui-serif, cursive",
};
const WORD_GENERIC = {
  Arimo: "sans-serif",
  Carlito: "sans-serif",
  Caladea: "serif",
  Cousine: "monospace",
  Gelasio: "serif",
  Tinos: "serif",
};

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function get(url, as = "text") {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return as === "text"
        ? await res.text()
        : Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

/** La richiesta css2 giusta per la famiglia: asse variabile o pesi statici */
function query(meta) {
  const styles = Object.keys(meta.fonts);
  const wght = (meta.axes ?? []).find((a) => a.tag === "wght");
  const italic = styles.some((s) => s.endsWith("i"));
  const fam = meta.family.replace(/ /g, "+");
  if (wght) {
    const lo = Math.max(wght.min, Math.min(400, wght.max));
    const hi = Math.min(wght.max, Math.max(700, lo));
    const range = lo === hi ? `${lo}` : `${lo}..${hi}`;
    return italic
      ? `family=${fam}:ital,wght@0,${range};1,${range}`
      : `family=${fam}:wght@${range}`;
  }
  const want = ["400", "700", "400i", "700i"].filter((s) => styles.includes(s));
  if (!want.includes("400")) {
    // famiglie con un peso solo diverso da 400
    const only = styles.filter((s) => !s.endsWith("i")).sort()[0];
    return `family=${fam}:wght@${only}`;
  }
  const hasItal = want.some((s) => s.endsWith("i"));
  const tuples = want
    .map((s) => [s.endsWith("i") ? 1 : 0, parseInt(s, 10)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return hasItal
    ? `family=${fam}:ital,wght@${tuples.map((t) => t.join(",")).join(";")}`
    : `family=${fam}:wght@${tuples.map((t) => t[1]).join(";")}`;
}

async function main() {
  console.log("Leggo il catalogo di Google Fonts…");
  const metaAll = JSON.parse(
    await get("https://fonts.google.com/metadata/fonts"),
  );
  const byFamily = new Map(
    metaAll.familyMetadataList.map((f) => [f.family, f]),
  );

  if (existsSync(STAGING)) await rm(STAGING, { recursive: true });
  await mkdir(STAGING, { recursive: true });
  const seenKeys = new Set();

  const css = [
    "/* Generato da scripts/fetch-fonts.mjs: non modificare a mano */",
  ];
  const catalog = [];
  let bytes = 0;

  for (const [family, label, group, scale, local] of LIST) {
    const meta = byFamily.get(family);
    if (!meta) throw new Error(`Famiglia sconosciuta: ${family}`);
    const sheet = await get(
      `https://fonts.googleapis.com/css2?${query(meta)}&display=swap`,
    );
    // solo i blocchi del sottoinsieme latino; le famiglie con un sottoinsieme
    // solo non hanno i commenti che li separano
    let blocks = [
      ...sheet.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*{([^}]*)}/g),
    ];
    if (!blocks.length && !sheet.includes("/*")) {
      blocks = [...sheet.matchAll(/@font-face\s*{([^}]*)}/g)];
    }
    if (!blocks.length) throw new Error(`Nessun blocco latino per ${family}`);
    const seen = new Map();
    for (const [, body] of blocks) {
      const style = body.match(/font-style:\s*(\w+)/)[1];
      const weight = body.match(/font-weight:\s*([\d ]+);/)[1].trim();
      const url = body.match(/url\((https:[^)]+)\)/)[1];
      const range =
        body.match(/unicode-range:\s*([^;]+);/)?.[1].trim() ??
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
      let file = seen.get(url);
      if (!file) {
        file = `${slug(family)}-${style}-${weight.replace(/ /g, "-")}.woff2`;
        const buf = await get(url, "buffer");
        bytes += buf.length;
        await writeFile(path.join(STAGING, file), buf);
        seen.set(url, file);
      }
      css.push(
        `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(files/${file}) format("woff2");unicode-range:${range}}`,
      );
    }
    const generic = GENERIC[group] ?? WORD_GENERIC[family];
    const stack = local
      ? `"${local}", "${family}", ${WORD_GENERIC[family]}`
      : `"${family}", ${generic}`;
    const key = slug(label);
    if (seenKeys.has(key)) throw new Error(`Chiave doppia: ${key}`);
    seenKeys.add(key);
    catalog.push({
      key,
      label,
      family,
      group,
      scale,
      stack,
    });
    process.stdout.write(`  ✓ ${label}\n`);
  }

  if (existsSync(FILES)) await rm(FILES, { recursive: true });
  await rename(STAGING, FILES);
  await writeFile(path.join(OUT, "fonts.css"), css.join("\n") + "\n");

  const ts = `/* Generato da scripts/fetch-fonts.mjs: non modificare a mano */

export type CatalogFont = {
  key: string;
  label: string;
  /** nome della @font-face in fonts/fonts.css */
  family: string;
  group: "word" | "sans" | "serif" | "mono" | "display" | "hand";
  scale: number;
  stack: string;
};

export const FONT_CATALOG: CatalogFont[] = ${JSON.stringify(catalog, null, 2)};
`;
  await writeFile(path.join(ROOT, "lib", "font-catalog.ts"), ts);
  console.log(
    `\n${catalog.length} famiglie, ${(bytes / 1024 / 1024).toFixed(1)} MB in fonts/files`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
