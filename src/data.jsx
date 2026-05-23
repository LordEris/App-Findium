/**
 * data.jsx — Données de démonstration et catalogues statiques
 *
 * Ce fichier ne contient aucune logique applicative — uniquement des données :
 *
 *   SOURCES_CATALOG      : liste des 12 sources OSINT disponibles avec leur
 *                          identifiant, nom, description, latence et état initial.
 *                          Utilisé dans NewInvestigation (sélecteur de sources)
 *                          et Config (panneau de gestion des sources).
 *
 *   INPUT_TYPES          : types d'indices acceptés en entrée d'enquête
 *                          (nom, alias, email, téléphone, adresse, URL, note, doc).
 *                          Définit les labels, placeholders et glyphs de l'UI.
 *
 *   DEMO_INVESTIGATIONS  : 6 enquêtes pré-remplies pour la démonstration.
 *                          La première (INV-2317) est complète avec log, entités,
 *                          arêtes, timeline, localisations et rapport structuré.
 *                          Les autres n'ont que les métadonnées (pas de log/entités)
 *                          pour alléger le fichier.
 *
 * Toutes les données sont exposées sur window.FINDIUM pour être accessibles
 * aux autres fichiers JSX sans système de module.
 *
 * Note : en production, ces données seraient remplacées par le store chiffré
 * chargé via window.findium.store.load() (voir app.jsx).
 */

// ─── Catalogue des sources OSINT ──────────────────────────────────────────────
// lat   : latence perçue ("fast" < 500 ms, "med" 500-2000 ms, "slow" > 2000 ms)
// on    : état activé par défaut
// status: état opérationnel courant (ok / rate-limit / off)
const SOURCES_CATALOG = [
  { id: "web",       name: "web.public",        kind: "Open web search",            lat: "fast",   on: true,  status: "ok" },
  { id: "news",      name: "press.archive",     kind: "Press & news archives",      lat: "fast",   on: true,  status: "ok" },
  { id: "social",    name: "social.crawl",      kind: "Social media indexers",      lat: "med",    on: true,  status: "ok" },
  { id: "reg",       name: "registries.eu",     kind: "Company & legal registries", lat: "med",    on: true,  status: "ok" },
  { id: "domains",   name: "whois.daemon",      kind: "WHOIS / DNS / certificates", lat: "fast",   on: true,  status: "ok" },
  { id: "leaks",     name: "leakindex",         kind: "Public breach indices",      lat: "slow",   on: false, status: "rate-limit" },
  { id: "img",       name: "reverse.image",     kind: "Reverse image search",       lat: "med",    on: true,  status: "ok" },
  { id: "gov",       name: "gov.opendata",      kind: "Government open data",       lat: "med",    on: true,  status: "ok" },
  { id: "geo",       name: "geoindex",          kind: "Geo / address normalizer",   lat: "fast",   on: true,  status: "ok" },
  { id: "wayback",   name: "wayback.machine",   kind: "Web archive snapshots",      lat: "slow",   on: true,  status: "ok" },
  { id: "darknet",   name: "tor.observatory",   kind: "Darknet observatory",        lat: "slow",   on: false, status: "off" },
  { id: "translate", name: "polyglot",          kind: "Translation & transliteration", lat:"fast", on: true,  status: "ok" },
];

// ─── Types d'indices d'entrée ─────────────────────────────────────────────────
// Définit les types acceptés dans le formulaire "Nouvelle enquête".
// icon : glyph monospace affiché dans le select et les chips de type.
const INPUT_TYPES = [
  { id: "name",     label: "Nom",        placeholder: "Marc Dubois", icon: "◉" },
  { id: "alias",    label: "Pseudo",     placeholder: "@blackbird", icon: "@" },
  { id: "email",    label: "Email",      placeholder: "m.dubois@example.fr", icon: "✉" },
  { id: "phone",    label: "Téléphone",  placeholder: "+33 6 12 34 56 78", icon: "☏" },
  { id: "address",  label: "Adresse",    placeholder: "12 rue de Belleville, Paris", icon: "▲" },
  { id: "url",      label: "URL/Domaine",placeholder: "blackbird-co.fr", icon: "/" },
  { id: "note",     label: "Note",       placeholder: "Aperçu, indice, contexte...", icon: "≡" },
  { id: "doc",      label: "Document",   placeholder: "annual-report-2024.pdf", icon: "▣" },
];

// ─── Enquêtes ─────────────────────────────────────────────────────────────────
// Vide au démarrage — les enquêtes sont chargées depuis le stockage chiffré.
// Les données de démonstration sont archivées dans src/demo-data.jsx.
const DEMO_INVESTIGATIONS = [];

// (conservé pour référence — supprimé de l'usage actif)
const _UNUSED_DEMO = [
  {
    id: "INV-2317",
    title: "Sociétés-écrans : réseau Blackbird",
    status: "running",
    createdAt: "2026-05-22 14:08",
    elapsed: "00:47:12",
    progress: 0.62,
    operator: "analyst.07",
    classif: "RESTRICTED",
    summary: "Recoupement entre une holding française, deux entités estoniennes et un compte twitter pseudonyme actif depuis 2019.",
    inputs: [
      { type: "name",    value: "Marc Dubois" },
      { type: "alias",   value: "@blackbird_io" },
      { type: "url",     value: "blackbird-holdings.ee" },
      { type: "email",   value: "contact@blackbird-co.fr" },
      { type: "note",    value: "Soupçon de structure d'évasion fiscale ; mentionné dans rapport interne 04/2026." },
    ],
    sourcesUsed: ["web","news","reg","domains","social","wayback","geo"],
    log: [
      { lv: "step",  ms: "phase 01 — ingestion & normalisation" },
      { lv: "ok",    ms: "5 inputs ingérés, hash empreinte sha256:a4f...e91" },
      { lv: "info",  ms: "normalisation : <b>Marc Dubois</b> → 3 candidats potentiels (homonymes)" },
      { lv: "query", ms: "registries.eu :: dirigeants(France) name=\"Marc Dubois\"" },
      { lv: "ok",    ms: "12 résultats — 3 retenus après filtre âge/lieu" },
      { lv: "query", ms: "whois.daemon :: blackbird-holdings.ee" },
      { lv: "ok",    ms: "registrant <i>Pärnu Office Services OÜ</i>, créé 2019-03-14" },
      { lv: "step",  ms: "phase 02 — expansion & recoupement" },
      { lv: "query", ms: "web.public :: \"Pärnu Office Services\" + \"Dubois\"" },
      { lv: "warn",  ms: "résultats partiels — pivot vers archives" },
      { lv: "query", ms: "wayback.machine :: blackbird-co.fr (2019-2024)" },
      { lv: "ok",    ms: "snapshot 2020-11 mentionne <b>M. Dubois</b> comme founder" },
      { lv: "info",  ms: "recoupement : email <b>contact@blackbird-co.fr</b> ↔ téléphone Tallinn dans registres EE (conf 0.78)" },
      { lv: "query", ms: "social.crawl :: @blackbird_io" },
      { lv: "ok",    ms: "27 mentions de Tallinn dans tweets 2021-2023" },
      { lv: "step",  ms: "phase 03 — graphe & confiance" },
      { lv: "info",  ms: "noeud central confirmé : <b>Marc Dubois</b> ↔ 4 entités, conf moyenne 0.71" },
      { lv: "warn",  ms: "anomalie : 2 domaines partagent même certificat SSL (let's encrypt)" },
      { lv: "query", ms: "press.archive :: \"Pärnu Office Services\"" },
    ],
    sources: [
      { name: "registries.eu",     status: "hit",      latency: 320, hits: 12 },
      { name: "whois.daemon",      status: "hit",      latency: 110, hits: 1 },
      { name: "wayback.machine",   status: "hit",      latency: 980, hits: 4 },
      { name: "web.public",        status: "partial",  latency: 240, hits: 7 },
      { name: "social.crawl",      status: "hit",      latency: 620, hits: 27 },
      { name: "press.archive",     status: "querying", latency: 0,   hits: 0 },
      { name: "geoindex",          status: "hit",      latency: 90,  hits: 3 },
      { name: "leakindex",         status: "off",      latency: 0,   hits: 0 },
    ],
    entities: [
      { id: "n1", type: "person",  label: "Marc Dubois",                conf: 0.82, sub: "dirigeant — FR" },
      { id: "n2", type: "alias",   label: "@blackbird_io",              conf: 0.74, sub: "twitter — 2019" },
      { id: "n3", type: "email",   label: "contact@blackbird-co.fr",    conf: 0.91, sub: "MX active" },
      { id: "n4", type: "org",     label: "Blackbird Holdings OÜ",      conf: 0.88, sub: "Estonia" },
      { id: "n5", type: "org",     label: "Pärnu Office Services OÜ",   conf: 0.79, sub: "registrant" },
      { id: "n6", type: "url",     label: "blackbird-holdings.ee",      conf: 0.95, sub: "active" },
      { id: "n7", type: "url",     label: "blackbird-co.fr",            conf: 0.95, sub: "active" },
      { id: "n8", type: "location",label: "Tallinn, EE",                conf: 0.71, sub: "27 mentions" },
      { id: "n9", type: "location",label: "Paris, FR",                  conf: 0.68, sub: "siège déclaré" },
      { id: "n10",type: "phone",   label: "+372 5*** ****",             conf: 0.62, sub: "registres EE" },
      { id: "n11",type: "person",  label: "Anaïs Vidal",                conf: 0.55, sub: "co-dirigeante? — faible" },
    ],
    edges: [
      { from: "n1", to: "n2", kind: "alias-of",   conf: 0.74 },
      { from: "n1", to: "n3", kind: "owns",       conf: 0.91 },
      { from: "n1", to: "n4", kind: "directs",    conf: 0.78 },
      { from: "n4", to: "n5", kind: "registered-by", conf: 0.79 },
      { from: "n4", to: "n6", kind: "owns",       conf: 0.95 },
      { from: "n1", to: "n7", kind: "owns",       conf: 0.82 },
      { from: "n4", to: "n8", kind: "located",    conf: 0.71 },
      { from: "n1", to: "n9", kind: "located",    conf: 0.68 },
      { from: "n4", to: "n10", kind: "contact",   conf: 0.62 },
      { from: "n11",to: "n4", kind: "co-director?", conf: 0.55 },
      { from: "n3", to: "n7", kind: "mx-of",      conf: 0.92 },
      { from: "n2", to: "n8", kind: "geo-hint",   conf: 0.58 },
    ],
    timeline: [
      { date: "2019-03-14", title: "Création Pärnu Office Services OÜ", desc: "Inscription au registre estonien — services de domiciliation.", src: "registries.eu" },
      { date: "2019-08-02", title: "Apparition @blackbird_io",          desc: "Premier tweet depuis Paris.",                                  src: "social.crawl" },
      { date: "2020-11-04", title: "blackbird-co.fr en ligne",          desc: "Snapshot wayback : M. Dubois listé comme founder.",            src: "wayback.machine" },
      { date: "2021-06-19", title: "Blackbird Holdings OÜ enregistrée", desc: "Capital initial 2 500€, registrant Pärnu Office Services.",     src: "registries.eu" },
      { date: "2022-04-11", title: "Article presse spécialisée",        desc: "Mention discrète de M. Dubois sur un montage holding.",        src: "press.archive" },
      { date: "2023-09-27", title: "Migration DNS",                     desc: "Les deux domaines partagent un certificat SSL commun.",        src: "whois.daemon" },
      { date: "2024-12-01", title: "Activité twitter chute",            desc: "Pseudonyme @blackbird_io en quasi-silence depuis cette date.",  src: "social.crawl" },
    ],
    locations: [
      { label: "Paris, FR",   lat: 48.85, lng: 2.35,  type: "person",  size: 8 },
      { label: "Tallinn, EE", lat: 59.43, lng: 24.75, type: "org",     size: 10 },
      { label: "Pärnu, EE",   lat: 58.39, lng: 24.50, type: "org",     size: 7 },
      { label: "Riga, LV",    lat: 56.95, lng: 24.10, type: "weak",    size: 4 },
    ],
    report: {
      key: [
        { k: "Sujet principal", v: "Marc Dubois" },
        { k: "Entités liées",   v: "4" },
        { k: "Recoupements",    v: "12" },
        { k: "Confiance globale", v: "71%" },
      ],
      sections: [
        { h: "Résumé exécutif", body: [
          "Le sujet <b>Marc Dubois</b> (FR) apparaît comme dirigeant d'une structure française <i>Blackbird Co</i> et — avec une confiance modérée à forte (0.78) — comme bénéficiaire effectif d'une holding estonienne <i>Blackbird Holdings OÜ</i>.",
          "Le pseudonyme <b>@blackbird_io</b>, actif entre août 2019 et fin 2024, partage 27 indices géographiques avec Tallinn. Le compte est plausiblement opéré par le sujet (conf 0.74).",
          "Deux domaines (<i>blackbird-co.fr</i>, <i>blackbird-holdings.ee</i>) partagent un certificat SSL commun depuis 2023-09 — indicateur fort d'opérateur unique.",
        ]},
        { h: "Recoupements clés", body: [
          "<ul><li>Email <b>contact@blackbird-co.fr</b> ↔ téléphone EE dans registres (0.78)</li>"+
          "<li>Snapshot wayback 2020-11 ↔ identité dirigeante FR (0.82)</li>"+
          "<li>Tweets géolocalisés ↔ adresses déclarées EE (0.71)</li>"+
          "<li>Certificat SSL partagé entre 2 domaines (0.95)</li></ul>",
        ]},
        { h: "Hypothèses & faiblesses", body: [
          "L'identité <b>Anaïs Vidal</b> (co-directrice présumée) repose sur une seule source non corroborée — confiance 0.55.",
          "Le numéro de téléphone EE n'est observé qu'au registre ; aucun appel direct passé via cette piste.",
          "<div class='quote'>Recommandation : compléter par un cross-check ouvert sur registres LV et confirmation diplomatique avant toute publication.</div>",
        ]},
        { h: "Prochaines étapes suggérées", body: [
          "<ul><li>Élargir la requête registres au triangle EE/LV/LT</li>"+
          "<li>Cross-référencer le pseudonyme @blackbird_io avec autres réseaux (mastodon, telegram)</li>"+
          "<li>Recharger les snapshots wayback antérieurs à 2019 si disponibles</li></ul>",
        ]},
      ],
    },
  },

  {
    id: "INV-2316",
    title: "Identification — auteur(e) photo virale",
    status: "complete",
    createdAt: "2026-05-19 09:22",
    elapsed: "02:14:08",
    progress: 1,
    operator: "analyst.07",
    classif: "OPEN",
    summary: "Image diffusée massivement sans crédit ; identification du photographe original via EXIF résiduels + reverse search + archives presse.",
    inputs: [
      { type: "doc", value: "viral-2026-04-photo.jpg" },
      { type: "note", value: "Image publiée sans crédit, devenue virale en avril." },
    ],
    sourcesUsed: ["img","wayback","news","social"],
    log: [],
    sources: [],
    entities: [
      { id: "p1", type: "person", label: "Sara Lemay", conf: 0.94, sub: "photographe — Montréal" },
      { id: "p2", type: "url",    label: "saralemay.studio", conf: 0.96, sub: "portfolio" },
      { id: "p3", type: "location", label: "Montréal, CA", conf: 0.94, sub: "EXIF résiduel" },
    ],
    edges: [],
    timeline: [],
    locations: [{ label: "Montréal, CA", lat: 45.50, lng: -73.56, type: "person", size: 10 }],
    report: { key: [], sections: [] },
  },

  {
    id: "INV-2315",
    title: "Domaine douteux : pharma-fr-shop.com",
    status: "complete",
    createdAt: "2026-05-16 18:01",
    elapsed: "00:21:44",
    progress: 1,
    operator: "analyst.07",
    classif: "OPEN",
    summary: "Site présenté comme pharmacie en ligne FR. Hébergement et bénéficiaire situés hors UE ; nombreuses similarités avec un cluster de fraude déjà identifié.",
    inputs: [
      { type: "url", value: "pharma-fr-shop.com" },
    ],
    sourcesUsed: ["domains","web","leaks"],
    log: [], sources: [], entities: [], edges: [], timeline: [], locations: [],
    report: { key: [], sections: [] },
  },

  {
    id: "INV-2314",
    title: "Cross-check email — recrutement suspect",
    status: "paused",
    createdAt: "2026-05-14 11:33",
    elapsed: "00:08:31",
    progress: 0.18,
    operator: "analyst.07",
    classif: "RESTRICTED",
    summary: "Email d'apparence professionnelle ; mise en pause après deux requêtes — en attente d'autorisation niveau B pour interroger l'index leakindex.",
    inputs: [
      { type: "email", value: "talent@bridge-recruit.eu" },
      { type: "name",  value: "Julien Marchand" },
    ],
    sourcesUsed: ["web","reg"],
    log: [], sources: [], entities: [], edges: [], timeline: [], locations: [],
    report: { key: [], sections: [] },
  },

  {
    id: "INV-2313",
    title: "Numéro téléphone — démarchage",
    status: "complete",
    createdAt: "2026-05-11 16:42",
    elapsed: "00:04:12",
    progress: 1,
    operator: "analyst.07",
    classif: "OPEN",
    summary: "Pattern de démarchage agressif lié à un centre d'appels offshore connu — 14 plaintes consolidées sur 60 jours.",
    inputs: [{ type: "phone", value: "+33 9 70 81 22 14" }],
    sourcesUsed: ["web","gov"],
    log: [], sources: [], entities: [], edges: [], timeline: [], locations: [],
    report: { key: [], sections: [] },
  },

  {
    id: "INV-2312",
    title: "Vérification d'adresse — siège social",
    status: "archived",
    createdAt: "2026-05-08 10:14",
    elapsed: "00:31:55",
    progress: 1,
    operator: "analyst.07",
    classif: "OPEN",
    summary: "L'adresse 14 bd Haussmann héberge 87 autres sociétés : pattern typique de domiciliation collective.",
    inputs: [{ type: "address", value: "14 Bd Haussmann, 75009 Paris" }],
    sourcesUsed: ["geo","reg"],
    log: [], sources: [], entities: [], edges: [], timeline: [], locations: [],
    report: { key: [], sections: [] },
  },
];

// ─── Data brokers — registre Effacement ──────────────────────────────────────
// Source : https://github.com/digisamroc/eraser  data/brokers.yaml
// 764 brokers total — list below = all people-search + background-check entries
// plus key marketing aggregators and real EU/UK brokers.
// Champs : id, name, country, category, gdpr, avgDays, severity, email, optOutUrl, methodology
const DATA_BROKERS = [

  // ── People search — US (25 entries from eraser repo) ─────────────────────
  { id:"spokeo",            name:"Spokeo",               country:"US", category:"people-search",    gdpr:false, avgDays:3,  severity:"high",
    email:"privacy@spokeo.com",                       optOutUrl:"https://www.spokeo.com/optout",
    methodology:"Aggregates public records, social profiles, phone numbers, and address history" },

  { id:"beenverified",      name:"BeenVerified",          country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"high",
    email:"privacy@beenverified.com",                 optOutUrl:"https://www.beenverified.com/app/optout/search",
    methodology:"Criminal records, court filings, address history, and social media profiles" },

  { id:"whitepages",        name:"Whitepages",            country:"US", category:"people-search",    gdpr:false, avgDays:3,  severity:"high",
    email:"privacy@whitepages.com",                   optOutUrl:"https://www.whitepages.com/suppression-requests",
    methodology:"National reverse-lookup directory — name, phone, address cross-reference" },

  { id:"intelius",          name:"Intelius",              country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"high",
    email:"privacy@intelius.com",                     optOutUrl:"https://www.intelius.com/opt-out",
    methodology:"Address history, relatives, and employment data compiled from public sources" },

  { id:"truepeoplesearch",  name:"TruePeopleSearch",      country:"US", category:"people-search",    gdpr:false, avgDays:3,  severity:"high",
    email:"contact@truepeoplesearch.com",             optOutUrl:"https://www.truepeoplesearch.com/removal",
    methodology:"Free instant name/phone/address lookup with no registration required" },

  { id:"fastpeoplesearch",  name:"FastPeopleSearch",      country:"US", category:"people-search",    gdpr:false, avgDays:3,  severity:"high",
    email:"privacy@fastpeoplesearch.com",             optOutUrl:"https://www.fastpeoplesearch.com/removal",
    methodology:"Fast free people search with name, address, and phone number results" },

  { id:"usphonebook",       name:"USPhonebook",           country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"med",
    email:"info@usphonebook.com",                     optOutUrl:"https://www.usphonebook.com/opt-out",
    methodology:"Reverse phone lookup and address directory aggregating telco data" },

  { id:"thatsthem",         name:"ThatsThem",             country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"high",
    email:"support@thatsthem.com",                    optOutUrl:"https://thatsthem.com/optout",
    methodology:"Free people search aggregating public records, IPs, and vehicle data" },

  { id:"mylife",            name:"MyLife",                country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"high",
    email:"privacy@mylife.com",                       optOutUrl:"https://www.mylife.com/ccpa/index.pubview",
    methodology:"Reputation score profiles sold to consumers and background check buyers" },

  { id:"pipl",              name:"Pipl",                  country:"US", category:"people-search",    gdpr:true,  avgDays:14, severity:"high",
    email:"privacy@pipl.com",                         optOutUrl:"https://pipl.com/personal-information-removal-request",
    methodology:"Deep web people search widely used by investigators, HR, and law enforcement" },

  { id:"zabasearch",        name:"ZabaSearch",            country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"med",
    email:"privacy@zabasearch.com",                   optOutUrl:"https://www.zabasearch.com/block_records/",
    methodology:"Public records search by name and address; widely re-scraped by other brokers" },

  { id:"publicrecordsnow",  name:"PublicRecordsNow",      country:"US", category:"people-search",    gdpr:false, avgDays:30, severity:"high",
    email:"privacy@publicrecordsnow.com",             optOutUrl:"",
    methodology:"Aggregates state and federal public records including court and property data" },

  { id:"familytreenow",     name:"FamilyTreeNow",         country:"US", category:"people-search",    gdpr:false, avgDays:3,  severity:"high",
    email:"privacy@familytreenow.com",                optOutUrl:"https://www.familytreenow.com/optout",
    methodology:"Free people search built on genealogical and public records data" },

  { id:"addresses",         name:"Addresses.com",         country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"med",
    email:"privacy@addresses.com",                    optOutUrl:"https://www.addresses.com/optout.php",
    methodology:"Address-centric directory linking people to current and past residences" },

  { id:"publicrecords360",  name:"PublicRecords360",      country:"US", category:"people-search",    gdpr:false, avgDays:30, severity:"med",
    email:"privacy@publicrecords360.com",             optOutUrl:"",
    methodology:"Compiles public record snapshots sold to consumer background check services" },

  { id:"searchpeoplefree",  name:"SearchPeopleFree",      country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"high",
    email:"privacy@searchpeoplefree.com",             optOutUrl:"https://www.searchpeoplefree.com/optout",
    methodology:"Free people search indexing addresses, relatives, and email addresses" },

  { id:"nuwber",            name:"Nuwber",                country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"high",
    email:"support@nuwber.com",                       optOutUrl:"https://nuwber.com/removal/link",
    methodology:"Aggregates public records across all US states — name, age, address, phone" },

  { id:"peoplesmart",       name:"PeopleSmart",           country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"high",
    email:"privacy@peoplesmart.com",                  optOutUrl:"",
    methodology:"People search and background report subscription service" },

  { id:"ussearch",          name:"US Search",             country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"med",
    email:"privacy@ussearch.com",                     optOutUrl:"",
    methodology:"Paid people search and background check reports using aggregated public data" },

  { id:"neighborwho",       name:"NeighborWho",           country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"high",
    email:"privacy@neighborwho.com",                  optOutUrl:"https://neighborwho.com/remove",
    methodology:"Neighborhood and household profile aggregation with address-centric search" },

  { id:"centeda",           name:"Centeda",               country:"US", category:"people-search",    gdpr:false, avgDays:7,  severity:"med",
    email:"support@centeda.com",                      optOutUrl:"https://centeda.com/ng/control/privacy",
    methodology:"People search directory aggregating public records and social data" },

  { id:"idtrue",            name:"IDTrue",                country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"high",
    email:"privacy@idtrue.com",                       optOutUrl:"https://www.idtrue.com/optout",
    methodology:"Identity lookup combining name, address, phone, and email cross-references" },

  { id:"veromi",            name:"Veromi",                country:"US", category:"people-search",    gdpr:false, avgDays:14, severity:"med",
    email:"privacy@veromi.net",                       optOutUrl:"",
    methodology:"People search service aggregating address, phone, and relatives data" },

  { id:"radaris",           name:"Radaris",               country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"high",
    email:"support@radaris.com",                      optOutUrl:"https://radaris.com/ng/page/opt-out",
    methodology:"Profile aggregation cross-referencing social networks and public records" },

  { id:"peekyou",           name:"PeekYou",               country:"US", category:"people-search",    gdpr:false, avgDays:5,  severity:"med",
    email:"privacy@peekyou.com",                      optOutUrl:"https://www.peekyou.com/about/contact/optout",
    methodology:"Links real identities to online usernames across social and web platforms" },

  // ── Background check — US / global (6 entries from eraser repo) ──────────
  { id:"advancedbackgroundchecks", name:"AdvancedBackgroundChecks", country:"US", category:"background-check", gdpr:false, avgDays:14, severity:"high",
    email:"privacy@advancedbackgroundchecks.com",     optOutUrl:"https://www.advancedbackgroundchecks.com/removal",
    methodology:"Criminal records, court filings, and address history aggregation" },

  { id:"lexisnexis",        name:"LexisNexis Risk Solutions", country:"US", category:"background-check", gdpr:true, avgDays:30, severity:"high",
    email:"privacy.information.mgr@lexisnexis.com",   optOutUrl:"https://optout.lexisnexis.com/",
    methodology:"Risk scoring, fraud detection, financial history — used by banks and insurers" },

  { id:"checkr",            name:"Checkr",                country:"US", category:"background-check", gdpr:false, avgDays:30, severity:"high",
    email:"privacy@checkr.com",                       optOutUrl:"",
    methodology:"Employment background screening used by Uber, Lyft, Instacart, and thousands of employers" },

  { id:"goodhire",          name:"GoodHire",              country:"US", category:"background-check", gdpr:false, avgDays:30, severity:"high",
    email:"privacy@goodhire.com",                     optOutUrl:"",
    methodology:"Employment background checks including criminal, credit, and drug screening" },

  { id:"sterling",          name:"Sterling",              country:"US", category:"background-check", gdpr:true,  avgDays:30, severity:"high",
    email:"privacy@sterlingcheck.com",                optOutUrl:"",
    methodology:"Global background screening for enterprise hiring — criminal, identity, education" },

  { id:"hireright",         name:"HireRight",             country:"US", category:"background-check", gdpr:true,  avgDays:30, severity:"high",
    email:"privacy@hireright.com",                    optOutUrl:"",
    methodology:"Worldwide employment background screening used by Fortune 500 companies" },

  // ── Marketing aggregators / data brokers (eraser repo — global) ──────────
  { id:"acxiom",            name:"Acxiom",                country:"US", category:"marketing",        gdpr:true,  avgDays:30, severity:"high",
    email:"consumeradvo@acxiom.com",                  optOutUrl:"https://isapps.acxiom.com/optout/optout.aspx",
    methodology:"10,000+ data points per consumer — feeds nearly every major ad network globally" },

  { id:"epsilon",           name:"Epsilon Data Management", country:"US", category:"marketing",      gdpr:true,  avgDays:45, severity:"high",
    email:"privacy@epsilon.com",                      optOutUrl:"https://www.epsilon.com/privacy/consumer-preference-center",
    methodology:"Loyalty, purchase, and behavioral data for omnichannel ad targeting" },

  { id:"liveramp",          name:"LiveRamp",              country:"US", category:"marketing",        gdpr:true,  avgDays:30, severity:"high",
    email:"privacy@liveramp.com",                     optOutUrl:"https://liveramp.com/opt_out/",
    methodology:"Identity resolution — links offline, online, and device data for advertisers" },

  { id:"oracle-america",    name:"Oracle Data Cloud",     country:"US", category:"marketing",        gdpr:true,  avgDays:30, severity:"high",
    email:"privacy_ww@oracle.com",                    optOutUrl:"https://datacloudoptout.oracle.com/",
    methodology:"Behavioral and purchase profiles powering Oracle's advertising ecosystem" },

  { id:"corelogic",         name:"CoreLogic",             country:"US", category:"marketing",        gdpr:false, avgDays:30, severity:"med",
    email:"privacy@corelogic.com",                    optOutUrl:"",
    methodology:"Property, mortgage, and consumer data sold to real estate and financial sectors" },

  { id:"equifax-marketing", name:"Equifax Marketing Services", country:"US", category:"marketing",   gdpr:true,  avgDays:30, severity:"high",
    email:"privacy@equifax.com",                      optOutUrl:"https://www.equifax.com/personal/education/identity/opt-out-prescreen/",
    methodology:"Consumer financial and demographic data sold to lenders and marketers" },

  { id:"experian-marketing",name:"Experian Marketing Services", country:"US", category:"marketing",  gdpr:true,  avgDays:30, severity:"high",
    email:"privacy@experian.com",                     optOutUrl:"https://www.experian.com/privacy/opting_out",
    methodology:"Consumer credit and behavioral data for direct marketing and targeting" },

  { id:"transunion-marketing", name:"TransUnion Marketing", country:"US", category:"marketing",      gdpr:true,  avgDays:30, severity:"high",
    email:"privacy@transunion.com",                   optOutUrl:"",
    methodology:"Consumer data and analytics platform used for marketing segmentation" },

  // ── EU / UK — GDPR ────────────────────────────────────────────────────────
  { id:"192com",            name:"192.com",               country:"UK", category:"people-search",    gdpr:true,  avgDays:7,  severity:"high",
    email:"privacy@192.com",                          optOutUrl:"https://www.192.com/atoz/opt-out/",
    methodology:"UK national directory using Companies House, electoral roll, and phone data" },

  { id:"yasni",             name:"Yasni",                 country:"DE", category:"people-search",    gdpr:true,  avgDays:14, severity:"med",
    email:"privacy@yasni.de",                         optOutUrl:"https://www.yasni.de/index.php?action=remove",
    methodology:"German people search aggregating social media and web profiles by name" },

  { id:"werkenntwen",       name:"WerKenntWen",           country:"DE", category:"people-search",    gdpr:true,  avgDays:14, severity:"med",
    email:"privacy@werkenntwen.de",                   optOutUrl:"https://www.werkenntwen.de/loeschen",
    methodology:"German social network whose profile data is still indexed by third parties" },
];

// Export global — accessible via window.FINDIUM dans tous les fichiers JSX.
window.FINDIUM = {
  SOURCES_CATALOG,
  INPUT_TYPES,
  DEMO_INVESTIGATIONS,
  DATA_BROKERS,
};
