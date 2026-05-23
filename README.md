# Findium

> **OSINT workspace — AI-powered investigation with encrypted local storage**

Findium is a desktop application built with Electron that combines open-source intelligence (OSINT) tools, an AI analysis engine (Claude), and a data broker erasure module into a single encrypted workspace.

Think of it as a **free, open-source alternative to [Maltego](https://www.maltego.com/)** — same idea (graph-based OSINT investigation, entity linking, relationship mapping), without the $999/year price tag. No account required, no cloud, everything runs and stays local.

---

## Features

### Investigation
- Define any combination of indicators (name, alias, email, phone, address, URL, note, document)
- Automatically dispatches **6 real OSINT tools** against each indicator:
  - `dns_lookup` — DNS records (A, MX, TXT, NS, SOA)
  - `cert_search` — TLS certificate transparency logs (crt.sh)
  - `wayback_check` — Internet Archive snapshot history
  - `rdap_lookup` — Domain / IP RDAP registration data
  - `geoip_lookup` — IP geolocation (country, city, ASN, org)
  - `web_search` — Open web search results
- All collected data is sent to **Claude** (Anthropic) for senior OSINT analyst synthesis
- Results are structured as: entities, relationships, timeline, geolocations, and a prose report
- No simulated data — only real API calls and real AI output

### Graph
- Interactive relationship graph (Canvas 2D) built from investigation results
- Nodes: people, organizations, IPs, domains, emails, aliases, addresses, URLs
- Edges weighted by confidence score
- Zoom, pan, drag, filter by entity type and confidence threshold

### Effacement (Data Broker Erasure)
- Tracks **42 real data brokers** sourced directly from the [eraser](https://github.com/digisamroc/eraser) open-source project (750+ broker database in `data/brokers.yaml`)
- Covers four categories: `people-search`, `background-check`, `marketing`, `b2b-profiling`
- US brokers (Spokeo, BeenVerified, Whitepages, TruePeopleSearch, LexisNexis, Acxiom, Epsilon, LiveRamp…) and EU/UK brokers (192.com, Yasni, WerKenntWen, Experian, Equifax…)
- Manual verification workflow: visit each broker site, mark **Found** or **Clean**, then request removal
- **AI-generated removal emails** via Claude — always in English:
  - EU/GDPR brokers: invokes **GDPR Article 17** (Right to Erasure)
  - US brokers: invokes **CCPA** and applicable opt-out policies
  - Fallback template available without Claude API
- Direct **Opt-out** link for each broker that provides one
- Tracks request status: Unknown → Found → Drafting → Sent → Acknowledged → Removed
- Protection score dashboard with per-category breakdown

### Nettoyage PC
- Détecte les **dossiers orphelins** laissés par des applications désinstallées dans `%APPDATA%` et `%LOCALAPPDATA%`
- Lit le registre Windows (3 hives : HKLM, HKCU, WOW6432Node) pour connaître les apps installées
- Score de confiance 0–100 % par dossier basé sur : âge du dernier accès, taille, qualité de correspondance du nom (algorithme Jaccard tokenisé)
- Dossiers dont la correspondance avec une app installée est ≥ 60 % → exclus automatiquement (encore présente)
- Pré-sélectionne les orphelins haute confiance (≥ 75 %)
- Suppression sécurisée avec confirmation — garde-fou : tout chemin hors AppData est refusé
- Inspiré de [daniilsys/cleanapp](https://github.com/daniilsys/cleanapp) (Rust CLI cross-platform)

### Deep / Dark Web Monitor
- Radar UI showing 8 monitored zones (breach indices, paste sites, combo lists, dark forums, Telegram channels, Discord, .onion markets, I2P)
- Finding tracker with severity levels (Critical / High / Medium / Low)
- Integrates with HIBP or external Tor service (requires external API key)

### Security
- All investigations and settings stored in **DPAPI-encrypted** files on Windows (`safeStorage` via Electron)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — no Node.js in renderer
- Anthropic API key stored encrypted — **never exposed to the renderer process** (only a `keyIsSet: boolean` is passed)
- All external URLs opened via `shell.openExternal` with `https://` validation

---

## Open-Source Projects Used

| Project | Role |
|---|---|
| [digisamroc/eraser](https://github.com/digisamroc/eraser) | Broker database (`data/brokers.yaml`) — 750+ data brokers with emails and opt-out URLs. Eraser is a free CLI/web tool that automates sending removal requests via SMTP; Findium uses its broker registry to power the Effacement module. |
| [daniilsys/cleanapp](https://github.com/daniilsys/cleanapp) | PC cleaner algorithm — Rust CLI that detects orphaned AppData folders left by uninstalled apps using registry lookup + confidence scoring. Findium reimplements the same Windows scanning logic (registry hives, Jaccard token matching, age/size confidence) natively in Node.js. |
| [Electron](https://www.electronjs.org/) v31 | Desktop shell, IPC, DPAPI encryption (`safeStorage`) |
| [React](https://react.dev/) 18 | UI framework (runtime JSX via Babel standalone) |
| [Babel Standalone](https://babeljs.io/docs/babel-standalone) 7 | In-browser JSX compilation — no build step needed for the renderer |
| [Anthropic Claude API](https://docs.anthropic.com/en/api) | OSINT synthesis and removal email drafting |
| [electron-builder](https://www.electron.build/) | NSIS Windows installer packaging |

---

## Tech Stack

```
Electron 31  ─  main process (Node.js)
  ├── safeStorage (DPAPI) — encrypted key/value store
  ├── IPC handlers — osint tools, claude.complete, shell.openExternal
  └── BrowserWindow (sandbox: true, contextIsolation: true)
        └── Findium.html — single-file React 18 SPA
              ├── Babel standalone (transpiles JSX at runtime)
              ├── vendor/react.min.js      (18.3.1, local — no CDN)
              ├── vendor/react-dom.min.js  (18.3.1, local — no CDN)
              └── src/*.jsx inlined at build time via build.js
```

All vendor dependencies are bundled locally in `vendor/` — **no CDN calls at runtime**.

---

## Build & Run

### Prerequisites
- Node.js 18+
- Windows (DPAPI is Windows-only)

### Development
```bash
npm install
npm run dev        # starts Electron in dev mode
```

### Rebuild the HTML bundle
```bash
node build.js      # concatenates src/*.jsx into Findium.html
```

### Package installer
```bash
npm run dist       # produces dist/Findium Setup x.x.x.exe (NSIS)
```

---

## Project Structure

```
Findium/
├── main.js              # Electron main process — IPC, DPAPI, OSINT tools
├── preload.js           # Context bridge — exposes window.findium API
├── Findium.html         # Single-file app bundle (rebuilt by build.js)
├── build.js             # Build script — inlines src/*.jsx into Findium.html
├── package.json
├── vendor/
│   ├── react.min.js
│   ├── react-dom.min.js
│   └── babel.min.js
├── src/
│   ├── data.jsx         # Static catalogs: OSINT sources, broker list, input types
│   ├── app.jsx          # Root app, routing, encrypted store, API key management
│   ├── screens.jsx      # Home, new investigation, config screens
│   ├── investigation.jsx# Investigation runner — OSINT dispatch + Claude synthesis
│   ├── graph.jsx        # Canvas 2D relationship graph
│   └── effacement.jsx   # Data broker erasure module
└── build/
    ├── installer.nsh    # NSIS custom macro — asks to delete data on uninstall
    └── icon.ico
```

---

## Data Broker Coverage

Sourced from [eraser](https://github.com/digisamroc/eraser) `data/brokers.yaml`:

| Category | Brokers |
|---|---|
| `people-search` | Spokeo, BeenVerified, Whitepages, Intelius, TruePeopleSearch, FastPeopleSearch, USPhonebook, ThatsThem, MyLife, Pipl, ZabaSearch, FamilyTreeNow, Addresses.com, SearchPeopleFree, Nuwber, PeopleSmart, US Search, NeighborWho, Centeda, IDTrue, Veromi, Radaris, PeekYou, PublicRecordsNow, PublicRecords360, 192.com, Yasni, WerKenntWen |
| `background-check` | AdvancedBackgroundChecks, LexisNexis Risk Solutions, Checkr, GoodHire, Sterling, HireRight |
| `marketing` | Acxiom, Epsilon, LiveRamp, Oracle Data Cloud, CoreLogic, Equifax Marketing, Experian Marketing, TransUnion Marketing |
| `b2b-profiling` | — |

---

## Acknowledgements

- **[eraser](https://github.com/digisamroc/eraser)** by [@digisamroc](https://github.com/digisamroc) — the broker database that powers the Effacement module. If you want a standalone CLI tool to send removal emails directly, use Eraser.
- The Electron, React, and Babel teams for their excellent open-source tooling.

---

## License

MIT
