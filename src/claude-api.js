/**
 * claude-api.js — Bridge vers le moteur IA
 *
 * Expose window.claude dans le renderer avec une API uniforme,
 * quel que soit le contexte d'exécution :
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Electron (production)                                           │
 *   │   window.claude.complete(prompt)                               │
 *   │        │                                                        │
 *   │        └─► window.findium.ai.complete(prompt)  [contextBridge] │
 *   │                 │                                               │
 *   │                 └─► ipcRenderer → ipcMain → https Anthropic    │
 *   │                      (clé API lue en main process, jamais ici) │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Navigateur (dev / test)                                         │
 *   │   window.claude.complete(prompt)                               │
 *   │        │                                                        │
 *   │        └─► fetch() direct avec clé stockée dans localStorage   │
 *   │            (moins sécurisé — dev seulement)                    │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * investigation.jsx appelle window.claude.complete() sans connaître
 * le contexte — ce fichier absorbe la différence.
 */

(function () {
  // Détecte si on tourne dans Electron (window.findium injecté par preload.js)
  const isElectron = typeof window !== 'undefined' && !!window.findium;

  // Clé localStorage utilisée uniquement en mode navigateur (dev)
  const FALLBACK_KEY = 'FINDIUM_ANTHROPIC_KEY_DEV';

  window.claude = {

    /**
     * Indique si une clé API est configurée.
     * En Electron : retourne un booléen depuis le main process (la clé n'est pas transmise).
     * En navigateur : vérifie localStorage.
     */
    hasKey: async function () {
      if (isElectron) return window.findium.store.hasKey();
      return !!(localStorage.getItem(FALLBACK_KEY));
    },

    /**
     * Enregistre la clé API.
     * En Electron : stockage chiffré via DPAPI (main process).
     * En navigateur : localStorage (dev uniquement — ne pas utiliser en prod).
     */
    setKey: async function (key) {
      if (isElectron) return window.findium.store.setKey(key || '');
      if (key) localStorage.setItem(FALLBACK_KEY, key.trim());
      else localStorage.removeItem(FALLBACK_KEY);
    },

    /**
     * Envoie un prompt à Claude Haiku et retourne le texte de réponse.
     *
     * En Electron : la requête HTTPS est exécutée dans le main process.
     *   → La clé API ne transite pas dans le renderer.
     *
     * En navigateur (fallback dev) : fetch() direct avec le header
     *   'anthropic-dangerous-allow-browser' requis par l'API pour les
     *   appels depuis un browser (à ne pas utiliser en production).
     *
     * Lance une exception si la clé est absente ou si l'API répond en erreur.
     * investigation.jsx attrape cette exception et bascule sur fallbackSynthesis().
     */
    complete: async function (prompt) {
      // ── Chemin Electron (sécurisé) ────────────────────────────────────────
      if (isElectron) return window.findium.ai.complete(prompt);

      // ── Chemin navigateur (dev) ───────────────────────────────────────────
      const apiKey = localStorage.getItem(FALLBACK_KEY);
      if (!apiKey) throw new Error('Clé API non configurée');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // Header obligatoire pour les appels depuis un browser
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text().catch(() => response.statusText);
        throw new Error(`API ${response.status}: ${err}`);
      }

      return (await response.json()).content[0].text;
    },

  };
})();
