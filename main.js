/**
 * main.js — Processus principal Electron (privileged process)
 *
 * C'est le seul endroit où tourne du code Node.js.
 * TOUTES les opérations sensibles passent par ici :
 *   - Chiffrement / déchiffrement des données au repos (AES-256-GCM)
 *   - Stockage de la clé API via l'API DPAPI Windows (safeStorage)
 *   - Appels HTTP vers l'API Anthropic (la clé ne quitte jamais ce process)
 *   - Accès au système de fichiers
 *
 * Le renderer (React / Findium.html) est sandboxé : il ne peut appeler
 * que les canaux IPC explicitement déclarés dans preload.js.
 */

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');
const dns    = require('dns').promises;

// ─── Chemins de stockage ──────────────────────────────────────────────────────
// app.getPath('userData') → %AppData%\Roaming\findium  (Windows)
// Tous les fichiers sont chiffrés ; leur contenu est illisible sans la clé maître.
const DATA_DIR            = path.join(app.getPath('userData'), 'findium-data');
const INVESTIGATIONS_FILE = path.join(DATA_DIR, 'investigations.enc'); // données enquêtes (AES-256-GCM)
const API_KEY_FILE        = path.join(DATA_DIR, 'apikey.enc');         // clé API (DPAPI ou AES fallback)
const CONFIG_FILE         = path.join(DATA_DIR, 'config.json');

/** Crée le dossier de données s'il n'existe pas encore. */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}


// ─── Chiffrement AES-256-GCM ──────────────────────────────────────────────────
//
// Utilisé pour les données enquêtes et comme fallback pour la clé API
// quand safeStorage (DPAPI) n'est pas disponible.
//
// La clé maître est dérivée de l'empreinte de l'installation via scrypt :
//   secret = "findium|<userData_path>|v1"
//   clé    = scrypt(secret, sel_fixe, 32 octets)
//
// ⚠ Ce schéma lie les données à la machine (pas à un mot de passe utilisateur).
//   Il protège contre la copie brute des fichiers, pas contre un attaquant
//   ayant accès à la session Windows. Pour une protection plus forte,
//   ajouter un mot de passe maître dérivé via Argon2 ou PBKDF2.

function _masterKey() {
  const secret = `findium|${app.getPath('userData')}|v1`;
  // scryptSync : CPU-intensif par design pour ralentir le brute-force
  return crypto.scryptSync(secret, 'findium-aes-salt-v1', 32);
}

/**
 * Chiffre une chaîne UTF-8 en AES-256-GCM.
 * Format du blob base64 : [IV 12B] [AuthTag 16B] [Ciphertext]
 * L'IV est aléatoire à chaque appel — deux chiffrements du même texte
 * produisent des blobs différents (sécurité sémantique).
 */
function encryptData(plaintext) {
  const iv     = crypto.randomBytes(12); // 96-bit IV recommandé pour GCM
  const key    = _masterKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag(); // 128-bit tag d'authentification (intégrité)
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

/**
 * Déchiffre un blob produit par encryptData.
 * Lance une exception si le tag d'authentification est invalide
 * (fichier corrompu ou falsifié).
 */
function decryptData(b64) {
  const buf     = Buffer.from(b64, 'base64');
  const iv      = buf.subarray(0, 12);
  const tag     = buf.subarray(12, 28);
  const ct      = buf.subarray(28);
  const key     = _masterKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}


// ─── Config JSON (non-sensitive settings) ─────────────────────────────────────

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

function writeConfig(data) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}


// ─── Ollama HTTP helpers ───────────────────────────────────────────────────────

function ollamaGet(apiPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: '127.0.0.1', port: 11434, path: apiPath,
        headers: { 'User-Agent': 'Findium/0.1' } },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch(e) { reject(new Error('Ollama JSON: ' + raw.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Ollama unreachable')); });
  });
}

function ollamaPost(apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1', port: 11434, path: apiPath,
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent':     'Findium/0.1',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch(e) { reject(new Error('Ollama response: ' + raw.slice(0, 300))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(data);
    req.end();
  });
}


// ─── Generic HTTP JSON fetch ───────────────────────────────────────────────────

function fetchJson(url, sliceArray) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const port   = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
      const req = lib.get(
        {
          hostname: parsed.hostname,
          port,
          path:     parsed.pathname + parsed.search,
          headers:  { 'User-Agent': 'Findium/0.1 OSINT', 'Accept': 'application/json' },
        },
        (res) => {
          let raw = '';
          res.on('data', c => { raw += c; });
          res.on('end', () => {
            try {
              const d = JSON.parse(raw);
              resolve(sliceArray && Array.isArray(d) ? d.slice(0, sliceArray) : d);
            } catch {
              resolve({ _raw: raw.slice(0, 500) });
            }
          });
        }
      );
      req.on('error', e => resolve({ error: e.message }));
      req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    } catch(e) {
      resolve({ error: e.message });
    }
  });
}


// ─── OSINT tool implementations ────────────────────────────────────────────────

async function executeTool(name, args) {
  switch (name) {

    case 'dns_lookup': {
      const domain = String(args.domain || '').trim();
      const types  = Array.isArray(args.types) ? args.types : ['A', 'MX', 'TXT', 'NS'];
      const results = {};
      for (const t of types) {
        try {
          switch (t) {
            case 'A':     results.A     = await dns.resolve4(domain); break;
            case 'AAAA':  results.AAAA  = await dns.resolve6(domain); break;
            case 'MX':    results.MX    = await dns.resolveMx(domain); break;
            case 'TXT':   results.TXT   = (await dns.resolveTxt(domain)).map(r => r.join('')); break;
            case 'NS':    results.NS    = await dns.resolveNs(domain); break;
            case 'CNAME': results.CNAME = await dns.resolveCname(domain); break;
          }
        } catch(e) {
          results[t] = `NXDOMAIN / ${e.code || e.message}`;
        }
      }
      return results;
    }

    case 'cert_search': {
      const domain = encodeURIComponent(String(args.domain || ''));
      return await fetchJson(`https://crt.sh/?q=${domain}&output=json`, 15);
    }

    case 'wayback_check': {
      const url = encodeURIComponent(String(args.url || ''));
      const ts  = args.year ? `&timestamp=${args.year}0101000000` : '';
      return await fetchJson(`https://archive.org/wayback/available?url=${url}${ts}`);
    }

    case 'rdap_lookup': {
      const domain = encodeURIComponent(String(args.domain || ''));
      return await fetchJson(`https://rdap.org/domain/${domain}`);
    }

    case 'geoip_lookup': {
      const ip = encodeURIComponent(String(args.ip || ''));
      return await fetchJson(
        `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,lat,lon,isp,org,as,query`
      );
    }

    case 'web_search': {
      const q = encodeURIComponent(String(args.query || ''));
      return await fetchJson(
        `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`
      );
    }

    default:
      return { error: `Outil inconnu : ${name}` };
  }
}


// ─── Stockage de la clé API Anthropic ────────────────────────────────────────
//
// Stratégie en deux niveaux :
//   1. Si DPAPI est disponible (Windows avec session utilisateur active) :
//      → safeStorage.encryptString() — chiffrement lié au compte Windows courant
//        Le fichier est illisible sur toute autre machine ou session.
//   2. Sinon (Linux sans keyring, CI, etc.) :
//      → AES-256-GCM local (fallback moins fort mais toujours chiffré).
//
// Dans les deux cas, la clé ne passe JAMAIS dans le renderer.
// Le renderer ne peut qu'appeler store:hasKey (booléen) et store:setKey (écriture).

function storeApiKey(key) {
  ensureDataDir();
  if (safeStorage.isEncryptionAvailable()) {
    // DPAPI Windows : bytes bruts, pas de base64
    fs.writeFileSync(API_KEY_FILE, safeStorage.encryptString(key));
  } else {
    // Fallback : AES local (texte base64)
    fs.writeFileSync(API_KEY_FILE, encryptData(key), 'utf8');
  }
}

function readApiKey() {
  if (!fs.existsSync(API_KEY_FILE)) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(fs.readFileSync(API_KEY_FILE));
    }
    return decryptData(fs.readFileSync(API_KEY_FILE, 'utf8'));
  } catch {
    // Fichier corrompu ou clé invalide → on retourne vide sans crasher
    return '';
  }
}


// ─── Fenêtre principale ───────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0f0d', // couleur de fond pendant le chargement (évite le flash blanc)
    title: 'Findium',
    show: false, // afficher après ready-to-show pour éviter le flash de contenu non peint
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,              // le renderer n'a PAS accès aux globals Node (require, process…)
      nodeIntegration: false,              // pas de require() dans le renderer
      sandbox: true,                       // sandboxing OS niveau process (Chromium sandbox)
      webSecurity: true,                   // CSP et same-origin policy actifs
      allowRunningInsecureContent: false,  // interdit les ressources HTTP en page HTTPS
      navigateOnDragDrop: false,           // évite l'ouverture accidentelle de fichiers glissés
    },
  });

  // Empêche le renderer de naviguer vers des URLs externes.
  // Sans ce garde, un XSS dans le renderer pourrait faire charger n'importe quelle URL.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });

  // Les liens externes (<a target="_blank">) s'ouvrent dans le navigateur du système,
  // pas dans une nouvelle fenêtre Electron (qui hériterait des mêmes permissions).
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile('Findium.html');
  win.once('ready-to-show', () => win.show());

  return win;
}

// ─── Squirrel Windows installer events ───────────────────────────────────────
//
// Lors d'une install/update/désinstall Squirrel, l'exe est lancé avec un flag
// spécial comme premier argument. Il faut traiter l'événement et quitter vite.
// Pour --squirrel-uninstall on affiche une confirmation avant de supprimer les données.

const _squirrelArg = process.argv[1];

if (_squirrelArg === '--squirrel-uninstall') {
  app.whenReady().then(() => {
    const hasData = fs.existsSync(DATA_DIR);
    let choice = 1; // défaut : conserver
    if (hasData) {
      choice = dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Désinstallation — Findium',
        message: 'Supprimer vos enquêtes ?',
        detail:
          'Vos enquêtes chiffrées sont stockées dans :\n' +
          DATA_DIR + '\n\n' +
          '⚠  Si vous souhaitez les conserver, sauvegardez ce dossier\n' +
          'sur un autre support AVANT de continuer.\n\n' +
          'Sans sauvegarde, elles seront définitivement perdues.',
        buttons: ['Supprimer mes données', 'Conserver mes données'],
        defaultId: 1, // "Conserver" présélectionné par sécurité
        cancelId: 1,
      });
    }
    if (choice === 0) {
      try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
    }
    app.quit();
  });

} else if (
  _squirrelArg === '--squirrel-install' ||
  _squirrelArg === '--squirrel-updated' ||
  _squirrelArg === '--squirrel-obsolete'
) {
  // Événements install/update : rien à faire côté app, on quitte immédiatement.
  app.quit();

} else {
  // ── Démarrage normal ──────────────────────────────────────────────────────
  app.whenReady().then(() => {
    ensureDataDir();
    createWindow();
    // macOS : recréer la fenêtre si l'icône du dock est cliquée sans fenêtre ouverte
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Quitter l'app quand toutes les fenêtres sont fermées (comportement Windows/Linux standard)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}


// ─── IPC : stockage chiffré des enquêtes ─────────────────────────────────────
//
// Chaque canal IPC est un contrat explicite entre le renderer et le main process.
// Le renderer invoque ces canaux via window.findium.store.* (défini dans preload.js).
// ipcMain.handle() est asynchrone et retourne une Promise côté renderer.

/** Charge et déchiffre la liste des enquêtes depuis le disque. */
ipcMain.handle('store:load', () => {
  try {
    if (!fs.existsSync(INVESTIGATIONS_FILE)) return null; // premier lancement
    return JSON.parse(decryptData(fs.readFileSync(INVESTIGATIONS_FILE, 'utf8')));
  } catch (e) {
    console.error('[store:load]', e.message);
    return null; // données corrompues → on retombe sur les données démo
  }
});

/** Chiffre et écrit la liste des enquêtes sur le disque. */
ipcMain.handle('store:save', (_, data) => {
  try {
    ensureDataDir();
    fs.writeFileSync(
      INVESTIGATIONS_FILE,
      encryptData(JSON.stringify(data)),
      'utf8'
    );
    return true;
  } catch (e) {
    console.error('[store:save]', e.message);
    return false;
  }
});


// ─── IPC : gestion de la clé API ─────────────────────────────────────────────

/** Stocke la clé API de façon chiffrée. Le renderer n'envoie la clé qu'une fois (au Config). */
ipcMain.handle('store:setKey', (_, key) => {
  try {
    storeApiKey(key || '');
    return true;
  } catch (e) {
    console.error('[store:setKey]', e.message);
    return false;
  }
});

/**
 * Retourne true si une clé valide est configurée.
 * Le renderer ne reçoit JAMAIS la clé en clair — seulement ce booléen.
 */
ipcMain.handle('store:hasKey', () => {
  const k = readApiKey();
  return k.length > 0 && k.startsWith('sk-ant-');
});


// ─── IPC : appel Claude / Anthropic API ──────────────────────────────────────
//
// Point de sécurité clé : l'appel HTTPS est initié ici, dans le main process.
// La clé API est lue depuis le stockage sécurisé et injectée dans l'en-tête HTTP.
// Elle n'est jamais transmise au renderer (pas de retour, pas de log de la valeur).
//
// On utilise le module https natif Node plutôt que fetch() pour rester dans
// le main process sans dépendances supplémentaires.

ipcMain.handle('ai:complete', (_, prompt) => {
  return new Promise((resolve, reject) => {
    const apiKey = readApiKey();
    if (!apiKey) return reject(new Error('Clé API Anthropic non configurée'));

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // modèle rapide et économique pour l'OSINT
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': apiKey,           // ← clé injectée ici, jamais loguée
          'anthropic-version': '2023-06-01',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode !== 200)
              return reject(new Error(`API ${res.statusCode}: ${parsed.error?.message || raw}`));
            resolve(parsed.content[0].text);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', reject);
    // Timeout 90s : les réponses OSINT complexes peuvent être longues
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
});

// ─── IPC : Ollama & OSINT ─────────────────────────────────────────────────────

/** Vérifie si Ollama tourne et liste les modèles disponibles. */
ipcMain.handle('osint:check', async () => {
  try {
    const data = await ollamaGet('/api/tags');
    return { running: true, models: (data.models || []).map(m => m.name) };
  } catch {
    return { running: false, models: [] };
  }
});

/**
 * Envoie un tour de conversation à Ollama (avec ou sans tools).
 * Le renderer construit les messages et tools, le main process fait l'appel HTTP.
 */
ipcMain.handle('osint:chat', async (_, { model, messages, tools }) => {
  const body = { model, messages, stream: false };
  if (tools && tools.length) body.tools = tools;
  return await ollamaPost('/api/chat', body);
});

/** Exécute un outil OSINT réel (DNS, RDAP, crt.sh, Wayback, GeoIP, DDG). */
ipcMain.handle('osint:tool', async (_, { name, args }) => {
  try {
    return await executeTool(name, args);
  } catch(e) {
    return { error: e.message };
  }
});


// ─── IPC : configuration non-sensible ─────────────────────────────────────────

/** Lit le fichier config.json (modèle Ollama, préférences UI...). */
ipcMain.handle('config:get', () => readConfig());

/** Écrit des clés dans config.json (merge shallow avec l'existant). */
ipcMain.handle('config:set', (_, patch) => {
  writeConfig({ ...readConfig(), ...patch });
  return true;
});

ipcMain.handle('shell:openExternal', (_, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
  return null;
});


// ─── IPC : Nettoyage PC (inspiré de daniilsys/cleanapp) ──────────────────────
//
// Algorithme calqué sur src/scan/windows.rs de daniilsys/cleanapp :
//   1. Lit les apps installées depuis le registre Windows (3 hives)
//   2. Scanne %APPDATA% et %LOCALAPPDATA%
//   3. Score de confiance 0-100 : âge + qualité de correspondance du nom
//   4. Dossiers dont le meilleur score de correspondance ≥ 0.6 → exclus (app encore présente)
//
// Source : https://github.com/daniilsys/cleanapp

const { execSync } = require('child_process');

// Dossiers système à ne jamais signaler comme orphelins
const CLEANER_SKIP = new Set([
  'microsoft', 'windows', 'windowsapps', 'packages', 'temp', 'tmp',
  'inetcache', 'inetcookies', 'inethistory', 'low', 'crashpad', 'crashdumps',
  'roamingstate', 'comms', 'd3dshadercache', 'local settings', 'application data',
  'nvidia corporation', 'nvidia', 'intel', 'amd', 'realtek', 'microsoft corporation',
  'default', 'public', 'all users', 'google', 'mozilla', 'apple',
  'desktop', 'documents', 'downloads', 'pictures', 'music', 'videos', 'onedrive',
]);

/** Découpe un nom en tokens significatifs (longueur > 2). */
function cleanerTokenize(name) {
  return name.toLowerCase().split(/[\s.\-_]+/).filter(t => t.length > 2);
}

/** Score de correspondance Jaccard entre un nom de dossier et des ensembles de tokens d'apps. */
function cleanerBestMatch(folderName, appTokenSets) {
  const fSet = new Set(cleanerTokenize(folderName));
  if (fSet.size === 0) return 0;
  let best = 0;
  for (const aSet of appTokenSets) {
    if (aSet.size === 0) continue;
    const inter = [...fSet].filter(t => aSet.has(t)).length;
    const union = new Set([...fSet, ...aSet]).size;
    const score = union > 0 ? inter / union : 0;
    if (score > best) best = score;
    if (best >= 0.6) return best; // early exit
  }
  return best;
}

/** Taille estimée d'un dossier (enfants directs uniquement — rapide). */
function cleanerShallowSize(dirPath) {
  try {
    return fs.readdirSync(dirPath).reduce((sum, e) => {
      try { return sum + fs.statSync(path.join(dirPath, e)).size; } catch { return sum; }
    }, 0);
  } catch { return 0; }
}

/** Scan des dossiers orphelins dans AppData. */
ipcMain.handle('cleaner:scan', async () => {
  // 1. Apps installées depuis le registre Windows
  let appTokenSets = [];
  try {
    const psCmd = [
      "Get-ItemProperty",
      "'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
      "-ErrorAction SilentlyContinue",
      "| Where-Object { $_.DisplayName }",
      "| Select-Object -ExpandProperty DisplayName",
      "| ConvertTo-Json -Compress",
    ].join(' ');
    const raw = execSync(
      `powershell -NoProfile -NonInteractive -Command "${psCmd}"`,
      { timeout: 20000, maxBuffer: 4 * 1024 * 1024 }
    ).toString().trim();
    const names = JSON.parse(raw);
    appTokenSets = (Array.isArray(names) ? names : [names])
      .filter(Boolean)
      .map(n => new Set(cleanerTokenize(String(n))));
  } catch { /* registre inaccessible ou PowerShell absent */ }

  // 2. Scan des dossiers AppData
  const scanDirs = [
    { base: process.env.APPDATA    || '', label: 'APPDATA'      },
    { base: process.env.LOCALAPPDATA || '', label: 'LOCALAPPDATA' },
  ].filter(d => d.base);

  const results = [];

  for (const { base, label } of scanDirs) {
    let entries = [];
    try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { continue; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;

      // Filtres d'exclusion système
      if (CLEANER_SKIP.has(name.toLowerCase())) continue;
      if (/^\{[0-9a-f\-]{36}\}$/i.test(name)) continue; // GUID
      if (name.length < 3) continue;

      const fullPath = path.join(base, name);
      const matchScore = cleanerBestMatch(name, appTokenSets);
      if (matchScore >= 0.6) continue; // encore installée

      let stats = null;
      try { stats = fs.statSync(fullPath); } catch { continue; }

      const ageDays = Math.round((Date.now() - stats.mtimeMs) / 86400000);

      // Score de confiance — même logique que cleanapp
      let confidence = 0.5;
      if      (ageDays < 7)    confidence -= 0.30;
      else if (ageDays > 365)  confidence += 0.35;
      else if (ageDays > 90)   confidence += 0.20;
      else if (ageDays > 30)   confidence += 0.10;
      confidence += 0.35 * (1 - matchScore); // faible match → plus suspect
      confidence = Math.max(0, Math.min(1, confidence));

      results.push({
        name,
        path:       fullPath,
        base:       label,
        confidence: Math.round(confidence * 100),
        ageDays,
        size:       cleanerShallowSize(fullPath),
        matchScore: Math.round(matchScore * 100),
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
});

/** Supprime les chemins sélectionnés. */
ipcMain.handle('cleaner:delete', async (_, paths) => {
  if (!Array.isArray(paths)) return { deleted: [], errors: [] };
  const deleted = [], errors = [];
  for (const p of paths) {
    // Garde-fou : refuser toute suppression hors de AppData
    const appdata   = (process.env.APPDATA    || '').toLowerCase();
    const localdata = (process.env.LOCALAPPDATA || '').toLowerCase();
    const pl = p.toLowerCase();
    if (!pl.startsWith(appdata) && !pl.startsWith(localdata)) {
      errors.push({ path: p, error: 'chemin refusé (hors AppData)' });
      continue;
    }
    try {
      fs.rmSync(p, { recursive: true, force: true });
      deleted.push(p);
    } catch (e) {
      errors.push({ path: p, error: e.message });
    }
  }
  return { deleted, errors };
});
