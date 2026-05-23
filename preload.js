/**
 * preload.js — Pont sécurisé entre le renderer et le main process
 *
 * Ce script s'exécute dans un contexte privilégié (accès à require/ipcRenderer)
 * mais dans le même processus que le renderer. contextBridge garantit que
 * l'objet exposé est une copie sérialisée — le renderer ne peut pas remonter
 * jusqu'aux APIs Node via des astuces prototype.
 *
 * Règle : n'exposer QUE ce dont le renderer a besoin. Moins la surface est large,
 * moins il y a de vecteurs d'attaque si le renderer est compromis (XSS, injection…).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('findium', {

  // ── Stockage chiffré ─────────────────────────────────────────────────────
  // Toutes les données enquêtes sont chiffrées (AES-256-GCM) côté main process.
  // Le renderer manipule du JSON en clair en mémoire ; seule la persistance disque est chiffrée.
  store: {
    /** Charge la liste des enquêtes depuis le fichier chiffré. Retourne null au premier lancement. */
    load: () => ipcRenderer.invoke('store:load'),

    /** Écrase le fichier chiffré avec la liste passée en argument. */
    save: (data) => ipcRenderer.invoke('store:save', data),

    /** Stocke la clé API Anthropic de façon sécurisée (DPAPI Windows ou AES fallback). */
    setKey: (key) => ipcRenderer.invoke('store:setKey', key),

    /**
     * Retourne true si une clé valide est configurée.
     * La clé elle-même ne revient JAMAIS dans le renderer.
     */
    hasKey: () => ipcRenderer.invoke('store:hasKey'),
  },

  // ── Moteur IA ────────────────────────────────────────────────────────────
  // L'appel HTTP à l'API Anthropic part du main process.
  // Le renderer envoie uniquement le prompt (texte) et reçoit uniquement la réponse (texte).
  ai: {
    /** Envoie un prompt à Claude Haiku et retourne le texte de réponse. */
    complete: (prompt) => ipcRenderer.invoke('ai:complete', prompt),
  },

  // ── OSINT agent (Ollama local) ───────────────────────────────────────────
  // Toutes les requêtes réseau OSINT partent du main process.
  // Le renderer ne reçoit que les résultats JSON.
  osint: {
    /** Vérifie si Ollama tourne et retourne { running: bool, models: string[] }. */
    check: () => ipcRenderer.invoke('osint:check'),

    /** Envoie un tour de conversation à Ollama. Retourne la réponse brute Ollama. */
    chat: (model, messages, tools) =>
      ipcRenderer.invoke('osint:chat', { model, messages, tools }),

    /** Exécute un outil OSINT réel (dns_lookup, cert_search, etc.) et retourne le résultat JSON. */
    tool: (name, args) => ipcRenderer.invoke('osint:tool', { name, args }),
  },

  // ── Configuration non-sensible ───────────────────────────────────────────
  config: {
    get: ()       => ipcRenderer.invoke('config:get'),
    set: (patch)  => ipcRenderer.invoke('config:set', patch),
  },

  // ── Shell — ouvre les liens externes dans le navigateur par défaut ───────
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },

});
