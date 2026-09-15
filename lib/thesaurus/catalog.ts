/**
 * I dizionari dei sinonimi, gli stessi di LibreOffice (formato MyThes). Si
 * scaricano alla prima ricerca dalla loro origine pubblica, fissata a un
 * commit e verificata con SHA-256, e restano nel browser: dopo funzionano
 * anche offline. Cogniva non li ridistribuisce.
 */

const COMMIT = "32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4"
const JSDELIVR = `https://cdn.jsdelivr.net/gh/LibreOffice/dictionaries@${COMMIT}`
// jsDelivr non serve file oltre i 20 MB: il tedesco arriva da GitHub
const GITHUB = `https://raw.githubusercontent.com/LibreOffice/dictionaries/${COMMIT}`

export type ThesaurusSource = {
  lang: string
  label: string
  url: string
  sha256: string
  bytes: number
  license: string
  credit: string
  home: string
}

export const THESAURI: ThesaurusSource[] = [
  {
    lang: "it",
    label: "Italiano",
    url: `${JSDELIVR}/it_IT/th_it_IT_v2.dat`,
    sha256: "96af44562d73ec56dbaacce04588f6a3b7569d581542d9518f64b7c5b1926bcf",
    bytes: 2126707,
    license: "GPL-3.0",
    credit: "LibreItalia, D. Volta, G. Zuliani, D. Prina, A. Pescetti",
    home: "https://github.com/LibreOffice/dictionaries/tree/master/it_IT",
  },
  {
    lang: "en",
    label: "Inglese",
    url: `${JSDELIVR}/en/th_en_US_v2.dat`,
    sha256: "8a3e4637450b7277428da248f0a604b5c92942bc30507220c051181462340f39",
    bytes: 18553257,
    license: "Licenza WordNet (Princeton)",
    credit: "WordNet, Princeton University; Kevin Atkinson",
    home: "https://github.com/LibreOffice/dictionaries/tree/master/en",
  },
  {
    lang: "fr",
    label: "Francese",
    url: `${JSDELIVR}/fr_FR/dictionaries/thes_fr.dat`,
    sha256: "52efa736c37f98d7f0abfe5dd4345b6f712880ca0ca664c15a8168d9475a0b46",
    bytes: 4801627,
    license: "LGPL-2.1",
    credit: "Frédéric Labbé, Grammalecte",
    home: "https://github.com/LibreOffice/dictionaries/tree/master/fr_FR",
  },
  {
    lang: "de",
    label: "Tedesco",
    url: `${GITHUB}/de/th_de_DE_v2.dat`,
    sha256: "cae18340c59738350b8abe7d7822edb76a8f26d177c3f7cdc68fb0187ca25693",
    bytes: 31662751,
    license: "LGPL-2.1",
    credit: "OpenThesaurus, Daniel Naber",
    home: "https://www.openthesaurus.de",
  },
  {
    lang: "es",
    label: "Spagnolo",
    url: `${JSDELIVR}/es/th_es_v2.dat`,
    sha256: "ee0b7ad7dfede636aa5d5509cbbcbab59bef4cb8cbdff01f9528b15bd139b889",
    bytes: 2876858,
    license: "LGPL-2.1",
    credit: "OpenThesaurus español, Marcelo Garrone",
    home: "https://github.com/LibreOffice/dictionaries/tree/master/es",
  },
  {
    lang: "pt",
    label: "Portoghese",
    url: `${JSDELIVR}/pt_PT/th_pt_PT.dat`,
    sha256: "daa89fee61347f401f005f3efd17fa8878eeeabd903ff4e684ab4bc1a53df2fd",
    bytes: 3052378,
    license: "CC BY 3.0 e altre licenze libere",
    credit: "Tiago F. Santos, Onto.PT, PAPEL",
    home: "https://github.com/LibreOffice/dictionaries/tree/master/pt_PT",
  },
]

export const thesaurusFor = (lang: string) =>
  THESAURI.find((t) => t.lang === lang.slice(0, 2).toLowerCase()) ?? null

export const THESAURUS_CACHE = "cogniva-thesaurus-v1"
