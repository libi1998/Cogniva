/**
 * Script eseguito mentre il browser legge l'HTML, prima di qualunque bundle.
 *
 * - Mette la classe `dark` prima del primo disegno, così con il tema scuro la
 *   pagina non lampeggia chiara.
 * - Comincia subito a leggere lo spazio di lavoro da IndexedDB: la lettura
 *   corre in parallelo al download del JavaScript e, quando React si idrata,
 *   i file sono di solito già pronti (vedi persist.ts).
 *
 * Sta fuori dai moduli "use client" perché il layout, che è un componente
 * server, deve poterlo importare come semplice testo; per lo stesso motivo
 * qui vivono anche nome e versione del database.
 */
export const THEME_KEY = "theme"

export const DB_NAME = "cogniva"
export const DB_VERSION = 1
export const DB_FILES = "files"

const theme = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}`

const workspace = `try{if(window.indexedDB&&!window.__cogniva){var p=new Promise(function(ok,ko){var q=indexedDB.open("${DB_NAME}",${DB_VERSION});q.onupgradeneeded=function(){var b=q.result;if(!b.objectStoreNames.contains("${DB_FILES}"))b.createObjectStore("${DB_FILES}",{keyPath:"id"})};q.onsuccess=function(){var b=q.result;try{var x=b.transaction("${DB_FILES}","readonly"),g=x.objectStore("${DB_FILES}").getAll();x.oncomplete=function(){ok({db:b,files:g.result})};x.onerror=x.onabort=function(){ko(x.error)}}catch(e){ko(e)}};q.onerror=function(){ko(q.error)};q.onblocked=function(){ko(new Error("blocked"))}});p.catch(function(){});window.__cogniva=p}}catch(e){}`

export const BOOT_SCRIPT = `(function(){${theme}${workspace}})()`
