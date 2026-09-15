// Estrae da lucide-react le icone della libreria della board.
// Uso: node scripts/gen-icons.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const src = fs.readFileSync("node_modules/lucide-react/dist/cjs/lucide-react.js", "utf8");
const head = /const __iconData\$[\w$]+ = \{\s*name: "([^"]+)",\s*size: (\d+),\s*node: /g;

/** estrae l'array bilanciando le parentesi quadre */
function readArray(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const all = new Map();
let m;
while ((m = head.exec(src))) {
  const name = m[1];
  const raw = readArray(src, head.lastIndex);
  if (!raw) continue;
  // l'array è codice JavaScript, non JSON: si valuta in un contesto isolato
  const node = vm.runInNewContext(raw).map(([tag, attrs]) => {
    const a = { ...attrs };
    delete a.key;
    return [tag, a];
  });
  all.set(name, node);
}

const CATS = [
  ["Interfaccia", ["search","settings","sliders-horizontal","list-filter","menu","x","check","plus","minus","chevron-right","chevron-down","chevron-left","chevron-up","ellipsis","ellipsis-vertical","refresh-cw","rotate-ccw","external-link","maximize","minimize","expand","move","grip-vertical","eye","eye-off","lock","lock-open","bell","bookmark","star","heart","flag","pin","trash","pencil","square-pen","copy","save","printer","download","upload","share-2","link","scissors","list","layout-grid","layout-dashboard","layout-template","shapes","sticky-note","frame","pen-line","presentation","notebook","panel-left","toggle-left","toggle-right"]],
  ["Persone", ["user","users","user-plus","user-check","user-round","circle-user","contact","face-smile","face-slightly-frowning","handshake","brain","eye-closed"]],
  ["File", ["file","file-text","file-plus","files","folder","folder-open","clipboard","clipboard-list","book","book-open","notebook-pen","newspaper","paperclip","archive","inbox","image","images","camera","video","film","music","mic","headphones","volume-2","volume-x"]],
  ["Comunicazione", ["mail","mail-open","message-square","message-circle","messages-square","send","phone","phone-call","at-sign","megaphone","reply","forward","bell-ring","rss","share"]],
  ["Commercio", ["shopping-cart","shopping-bag","store","credit-card","wallet","tag","tags","gift","package","truck","receipt","banknote","percent","coins","hand-coins"]],
  ["Dati", ["chart-column","chart-bar","chart-pie","chart-line","chart-spline","trending-up","trending-down","activity","database","server","hard-drive","cpu","layers","table","table-2","list-checks","calculator","gauge","funnel"]],
  ["Tempo", ["calendar","calendar-days","calendar-check","clock","timer","alarm-clock","rotate-ccw","hourglass","clock-alert"]],
  ["Luoghi", ["map","map-pin","navigation","globe","compass","house","building","building-2","warehouse","plane","car","bike","train-front","ship","route","milestone"]],
  ["Stato", ["circle-check","circle-x","circle-alert","triangle-alert","info","badge-help","circle-dashed","loader","loader-circle","zap","shield","shield-check","shield-alert","thumbs-up","thumbs-down","award","trophy","target","flame","sparkles","lightbulb","rocket","badge-check","ban","circle-slash"]],
  ["Sviluppo", ["code","code-xml","terminal","square-terminal","git-branch","git-commit-horizontal","git-merge","git-pull-request","bug","braces","brackets","binary","workflow","boxes","box","component","puzzle","container","blocks","webhook","key","key-round","fingerprint-pattern","scan"]],
  ["Sistema", ["play","pause","square","skip-forward","skip-back","fast-forward","circle-play","wifi","wifi-off","bluetooth","battery","battery-full","power","plug","plug-zap","sun","moon","cloud","cloud-upload","cloud-download","cloud-off","monitor","smartphone","tablet","laptop","mouse-pointer-2","keyboard","hard-drive-download"]],
  ["Flusso", ["arrow-right","arrow-left","arrow-up","arrow-down","arrow-up-right","arrow-down-right","corner-down-right","corner-up-right","repeat","shuffle","split","merge","undo-2","redo-2","log-in","log-out","import","circle-arrow-right","move-right","waypoints","spline","git-fork"]],
];

const used = [];
const missing = [];
const out = {};
for (const [, names] of CATS) {
  for (const n of names) {
    if (all.has(n)) {
      out[n] = all.get(n);
      used.push(n);
    } else {
      missing.push(n);
    }
  }
}

const cats = CATS.map(([label, names]) => [label, names.filter((n) => all.has(n))]);

const body = `/**
 * Libreria di icone — sottoinsieme curato di Lucide, estratto in dati puri
 * (tag + attributi) così da poter essere renderizzato sia in React sia
 * serializzato in SVG per l'esportazione.
 *
 * Rigenerabile con lo script in scripts/gen-icons.js
 */

export type IconNode = [tag: string, attrs: Record<string, string>][];

export const ICONS: Record<string, IconNode> = ${JSON.stringify(out, null, 0)};

export const ICON_CATEGORIES: { label: string; icons: string[] }[] = ${JSON.stringify(
  cats.map(([label, names]) => ({ label, icons: names })),
  null,
  2,
)};

export const ICON_NAMES = Object.keys(ICONS);

export function hasIcon(name: string) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}
`;

fs.writeFileSync(path.join("lib", "icon-library.ts"), body);
console.log("icone incluse:", used.length);
console.log("mancanti:", missing.join(", ") || "nessuna");
console.log("dimensione file:", (body.length / 1024).toFixed(1) + " KB");
