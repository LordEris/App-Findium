/**
 * demo-data.jsx — Données fictives de démonstration
 *
 * Ce fichier n'est PAS chargé par l'application. Il archive les données d'exemple
 * retirées des fichiers sources pour garder une référence.
 *
 * Pour ré-activer les démos, exposer via window.FINDIUM_DEMO et l'utiliser
 * dans app.jsx lors du chargement initial à la place du tableau vide.
 */

// ─── Enquêtes de démonstration (anciennement dans data.jsx) ──────────────────
const DEMO_INVESTIGATIONS = [
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
    log: [], sources: [],
    entities: [
      { id: "p1", type: "person", label: "Sara Lemay", conf: 0.94, sub: "photographe — Montréal" },
      { id: "p2", type: "url",    label: "saralemay.studio", conf: 0.96, sub: "portfolio" },
      { id: "p3", type: "location", label: "Montréal, CA", conf: 0.94, sub: "EXIF résiduel" },
    ],
    edges: [], timeline: [],
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
    inputs: [{ type: "url", value: "pharma-fr-shop.com" }],
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

// ─── Identité de démonstration (anciennement dans effacement.jsx) ─────────────
const DEMO_IDENTITY = [
  { type: "name",    value: "Anaïs Morel" },
  { type: "email",   value: "a.morel@findium.eu" },
  { type: "email",   value: "anais.morel@gmail.com" },
  { type: "phone",   value: "+33 6 12 34 56 78" },
  { type: "address", value: "12 rue de Belleville, 75020 Paris" },
  { type: "alias",   value: "@anaismrl" },
];

// ─── Détections deep web de démonstration (anciennement dans effacement.jsx) ──
const DEMO_DEEPWEB_FINDINGS = [
  { id:"dw-1", kind:"breach", zone:"breach-idx", source:"BREACH:linkedin-2021-700M",
    title:"Fuite LinkedIn 2021 · 700M comptes", severity:"high", detectedAt:"2026-05-21",
    records:700000000, url:"breach://pwned/linkedin-2021",
    description:"Scraping massif de profils publié sur RaidForums en juin 2021. Ton email professionnel figure dans le dump.",
    fields:[
      { type:"email", preview:"a.morel@findium.eu", leaked:true },
      { type:"name",  preview:"Anaïs Morel",        leaked:true },
      { type:"url",   preview:"linkedin.com/in/anaismorel", leaked:true },
    ],
    recommendations:[
      "Surveiller les tentatives de phishing ciblé sur cette adresse",
      "Vérifier que ce mot de passe n'est plus réutilisé nulle part",
      "Activer la 2FA sur tous les services rattachés à cet email",
    ], handled:false },
  { id:"dw-2", kind:"paste", zone:"paste-sites", source:"PASTE:ghostbin/9af2c1",
    title:"Paste anonyme · email + hash MD5", severity:"high", detectedAt:"2026-05-19",
    records:1, url:"ghostbin.com/p/9af2c1",
    description:"Paste publié il y a 4 jours contenant des paires email/hash issues d'une fuite plus large. Ton adresse personnelle apparaît avec un hash MD5 (algorithme cassé).",
    fields:[
      { type:"email", preview:"anais.morel@gmail.com", leaked:true },
      { type:"note",  preview:"5f4dcc3b5aa765d61d8327deb882cf99", leaked:true },
    ],
    recommendations:[
      "Changer immédiatement le mot de passe associé à cet email",
      "Vérifier l'historique de connexion sur les services Google",
      "Activer la 2FA Google avec clé matérielle si possible",
    ], handled:false },
  { id:"dw-3", kind:"telegram", zone:"tg-chans", source:"TG:@combolistsfr",
    title:"Canal Telegram FR · combo list 2024-Q4", severity:"critical", detectedAt:"2026-05-17",
    records:14000,
    description:"Combo list (email:password) partagée sur un canal Telegram français de credential stuffing. Ton email professionnel apparaît avec un mot de passe en clair.",
    fields:[
      { type:"email", preview:"a.morel@findium.eu", leaked:true },
      { type:"note",  preview:"M********6!  (12 car.)", leaked:true },
    ],
    recommendations:[
      "URGENT — changer le mot de passe Findium immédiatement",
      "Révoquer toutes les sessions actives de ton compte",
      "Auditer le journal d'accès des 90 derniers jours",
      "Notifier la cellule sécurité interne",
    ], handled:false },
  { id:"dw-4", kind:"forum", zone:"dark-forum", source:"FORUM:#7af2 (tor)",
    title:"Mention pseudonyme @anaismrl", severity:"medium", detectedAt:"2026-05-15",
    description:"Mention de ton pseudo dans un fil de discussion sur un forum .onion. Aucun contenu malveillant immédiat, mais corrélation possible avec ton identité réelle.",
    fields:[
      { type:"alias", preview:"@anaismrl", leaked:true },
      { type:"url",   preview:"forum.onion/thread/****", leaked:false },
    ],
    recommendations:[
      "Vérifier l'origine du fil — possiblement un OSINT amateur",
      "Surveiller les autres mentions du pseudo pendant 30 jours",
    ], handled:false },
  { id:"dw-5", kind:"market", zone:"market-onion", source:"MARKET:#bc91d (tor)",
    title:"Listing PII · paquet de 50 identités FR", severity:"critical", detectedAt:"2026-05-12",
    records:50,
    description:"Lot d'identités françaises mis en vente sur une marketplace .onion (0.12 BTC). Le hash de ton numéro de téléphone correspond à un des items du paquet.",
    fields:[
      { type:"phone",   preview:"+33 6 ** ** ** 78", leaked:true },
      { type:"address", preview:"75020 (district)",  leaked:false },
    ],
    recommendations:[
      "Demander le renouvellement de la carte SIM si possible",
      "Activer le filtre anti-spam renforcé sur l'opérateur",
      "Surveiller toute tentative de SIM-swap",
    ], handled:false },
  { id:"dw-6", kind:"combo", zone:"combo-lists", source:"COMBO:antipublic-2024",
    title:"AntiPublic · combolist agrégée", severity:"medium", detectedAt:"2026-05-09",
    records:4200000000,
    description:"Méta-aggregateur de combolists publié sous le nom AntiPublic. Ton ancien email étudiant figure dans 3 sous-lists distinctes.",
    fields:[
      { type:"email", preview:"anais.m@univ-paris-***.fr", leaked:true },
    ],
    recommendations:[
      "Considérer cet email comme compromis définitivement",
      "Vérifier qu'aucun compte critique n'y est encore rattaché",
    ], handled:true },
  { id:"dw-7", kind:"paste", zone:"paste-sites", source:"PASTE:pastebin/raw/8de1",
    title:"Paste public · numéro téléphone seul", severity:"low", detectedAt:"2026-05-04",
    records:1,
    description:"Numéro de téléphone publié dans un paste sans contexte. Probablement un dump partiel d'annuaire.",
    fields:[
      { type:"phone", preview:"+33 6 12 34 56 78", leaked:true },
    ],
    recommendations:[
      "Pas d'action immédiate — surveiller les démarchages SMS inhabituels",
    ], handled:true },
];

// Exposé pour consultation mais non utilisé par l'app au démarrage
window.FINDIUM_DEMO = { DEMO_INVESTIGATIONS, DEMO_IDENTITY, DEMO_DEEPWEB_FINDINGS };
