/**
 * app.jsx — Shell principal de l'application
 *
 * Responsabilités :
 *   - Routage client (dashboard / nouvelle enquête / vue enquête / historique / config)
 *   - État global des enquêtes + persistance chiffrée au démarrage et à chaque mise à jour
 *   - Application du thème (palette, couleur d'accent, effet CRT) via CSS variables
 *   - Curseur personnalisé (réticule hacker avec label contextuel)
 *   - Panel de tweaks visuels (palette, CRT, layout dashboard)
 */

const { useState: _as, useEffect: _ae, useRef: _ar, useCallback: _au, useMemo: _aum } = React;

// Valeurs par défaut des tweaks visuels.
// Le bloc /*EDITMODE-BEGIN*/…/*EDITMODE-END*/ est relu/réécrit par l'outil
// de design claude.ai/design quand on modifie les tweaks depuis l'interface.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "matrix",
  "accent": "#00ff7a",
  "crt": false,
  "showCoords": false,
  "dashboardLayout": "table"
}/*EDITMODE-END*/;

// ─── Composant racine ─────────────────────────────────────────────────────────

function App() {
  const [tweaks, setTweaks] = window.useTweaks(TWEAK_DEFAULTS);

  // Route active : { name: string, params: object }
  // Routage entièrement côté client — pas de react-router (pas de serveur HTTP).
  const [route, setRoute] = _as({ name: "dashboard", params: {} });

  // Liste complète des enquêtes (en mémoire).
  // Initialisée avec les données démo ; remplacée par les données persistées au premier effet.
  const [investigations, setInvestigations] = _as(() => [...window.FINDIUM.DEMO_INVESTIGATIONS]);

  // Layout du dashboard (table / cartes / kanban), synchronisé avec les tweaks
  const [dashLayout, setDashLayout] = _as(tweaks.dashboardLayout || "table");

  // Statut Ollama — vérifié une seule fois au démarrage (null = en cours, false = off)
  const [ollamaInfo, setOllamaInfo] = _as(null);

  // ── Chargement initial depuis le stockage chiffré ─────────────────────────
  // Uniquement en Electron (window.findium injecté par preload.js).
  // Si aucune donnée n'est trouvée (premier lancement), on garde les données démo.
  _ae(() => {
    if (!window.findium) return;
    window.findium.store.load()
      .then(saved => {
        if (saved && Array.isArray(saved) && saved.length > 0) {
          setInvestigations(saved);
        }
      })
      .catch(() => {}); // erreur de déchiffrement → on reste sur les données démo
    // Vérification Ollama au démarrage
    if (window.findium.osint) {
      window.findium.osint.check()
        .then(s => setOllamaInfo(s))
        .catch(() => setOllamaInfo({ available: false }));
    }
  }, []); // [] : exécuté une seule fois au montage

  // ── Application du thème ──────────────────────────────────────────────────
  // Les palettes définissent des tokens de base (tokens.css) mais l'accent
  // peut être personnalisé librement via le color picker → on réécrit les
  // variables CSS dérivées à chaque changement pour rester cohérent.
  _ae(() => {
    document.body.setAttribute("data-palette", tweaks.palette || "matrix");
    document.body.setAttribute("data-crt", tweaks.crt ? "on" : "off");

    const a = tweaks.accent || "#00ff7a";
    document.documentElement.style.setProperty("--accent",      a);
    document.documentElement.style.setProperty("--accent-soft", hexA(a, 0.14));
    document.documentElement.style.setProperty("--accent-mute", hexA(a, 0.06));
    document.documentElement.style.setProperty("--accent-line", hexA(a, 0.30));
    document.documentElement.style.setProperty("--accent-hi",   lighten(a, 0.25));
  }, [tweaks.palette, tweaks.crt, tweaks.accent]);

  // ── Helpers de navigation ─────────────────────────────────────────────────
  const openInvestigation = (id) => setRoute({ name: "investigation", params: { id } });
  const goNew = () => setRoute({ name: "new", params: {} });

  const deleteInv = (id) => {
    setInvestigations(list => {
      const next = list.filter(i => i.id !== id);
      if (window.findium) window.findium.store.save(next).catch(() => {});
      return next;
    });
  };

  // ── Mise à jour d'une enquête (appelé par runInvestigation en streaming) ──
  // À chaque mise à jour, on persist vers le disque chiffré (non-bloquant).
  // On utilise une fonction de mise à jour (prev => next) pour éviter les
  // closures obsolètes dans un context asynchrone (runner IA multi-step).
  const updateInv = (newInv) => {
    setInvestigations(list => {
      const idx  = list.findIndex(i => i.id === newInv.id);
      const next = idx === -1
        ? [newInv, ...list]                               // nouvelle enquête → en tête de liste
        : list.map((x, i) => i === idx ? newInv : x);    // mise à jour enquête existante
      // Persistance asynchrone — on ne bloque pas le rendu si l'écriture échoue
      if (window.findium) window.findium.store.save(next).catch(() => {});
      return next;
    });
  };

  // ── Démarrage d'une nouvelle enquête ──────────────────────────────────────
  // Crée immédiatement un shell "en cours" visible dans la sidebar,
  // navigue vers la vue enquête, puis lance le runner IA en arrière-plan.
  // Le runner appelle onUpdate() à chaque étape → updateInv() met à jour l'UI en live.
  const startInvestigation = async (params) => {
    const tempId = "INV-" + Math.floor(2400 + Math.random() * 99);
    const now    = new Date();
    const pad    = n => String(n).padStart(2, "0");
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const { SOURCES_CATALOG } = window.FINDIUM;
    const activeSources = SOURCES_CATALOG.filter(s => params.sourcesUsed.includes(s.id));

    // Shell initial visible dès le clic sur "Lancer"
    const shell = {
      id: tempId, title: params.title,
      status: "running", createdAt, elapsed: "00:00:00", progress: 0.02,
      operator: "analyst.07", classif: "OPEN",
      summary: "Initialisation…",
      inputs: params.inputs,
      sourcesUsed: params.sourcesUsed,
      log: [],
      sources: activeSources.map(s => ({ name: s.name, status: "querying", latency: 0, hits: 0 })),
      entities: [], edges: [], timeline: [], locations: [],
      report: { key: [], sections: [] },
    };

    setInvestigations(list => [shell, ...list]);
    setRoute({ name: "investigation", params: { id: tempId } });

    // runInvestigation() est défini dans investigation.jsx
    // Il pilote les 4 phases (ingestion → sources → IA → consolidation)
    // et appelle onUpdate() à chaque étape pour mettre à jour le terminal live.
    await window.runInvestigation({
      params,
      onUpdate: (newInv) => {
        // On force l'id du shell créé ici (le runner génère le sien en interne)
        updateInv({ ...newInv, id: tempId });
      },
    });
  };

  // L'enquête actuellement affichée (vue détaillée)
  const current      = investigations.find(i => i.id === route.params.id);
  const activeRunning = investigations.filter(i => i.status === "running");

  // ── Entrées de navigation sidebar ────────────────────────────────────────
  const nav = [
    { key: "dashboard",  label: "Dashboard",    ico: "dashboard", k: "⌘1" },
    { key: "new",        label: "Nouvelle",     ico: "plus",      k: "⌘N" },
    { key: "history",    label: "Historique",   ico: "archive",   k: "⌘H" },
    { key: "effacement", label: "Effacement",   ico: "shield",    k: "⌘E" },
    { key: "config",     label: "Configuration",ico: "settings",  k: "⌘," },
    { key: "compte",     label: "Compte",       ico: "user",      k: "⌘." },
  ];

  return (
    <>
      <div className="app">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar__brand">
            <div className="logo"><Logo size={18}/></div>
            <div className="name">Findium<small>OSINT WORKSPACE</small></div>
          </div>

          <div className="sidebar__h">Espace</div>
          {nav.map(n => (
            <button key={n.key} className="nav"
              data-active={route.name === n.key ? "1" : "0"}
              onClick={() => setRoute({ name: n.key, params: {} })}>
              <span className="nav__ico"><Icon n={n.ico} size={16}/></span>
              <span>{n.label}</span>
              {n.key !== "new" && <span className="nav__k">{n.k}</span>}
              {/* Badge rouge : nombre d'enquêtes en cours */}
              {n.key === "dashboard" && activeRunning.length > 0 && (
                <span className="nav__badge">{activeRunning.length}</span>
              )}
            </button>
          ))}

          <div className="sidebar__divider"></div>

          {/* Raccourcis rapides vers les enquêtes actives (max 4) */}
          <div className="sidebar__h">Enquêtes en cours</div>
          {activeRunning.length === 0 && (
            <div style={{padding:"6px 12px",color:"var(--fg-3)",fontSize:12}}>Aucune.</div>
          )}
          {activeRunning.slice(0, 4).map(inv => (
            <button key={inv.id} className="nav"
              data-active={route.params.id === inv.id ? "1" : "0"}
              onClick={() => openInvestigation(inv.id)}>
              <span className="nav__ico" style={{color:"var(--accent)"}}>●</span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.title}</span>
            </button>
          ))}

          {/* Indicateurs système en bas de sidebar */}
          <div className="sidebar__pulse">
            <h6><span style={{color:"var(--accent)"}}>●</span> System pulse</h6>
            <div className="pulse-row"><span className="name">engine.reasoning</span><span className="val">ok</span></div>
            <div className="pulse-row">
              <span className="name">sources online</span>
              <span className="val">{window.FINDIUM.SOURCES_CATALOG.filter(s=>s.status==="ok").length} / {window.FINDIUM.SOURCES_CATALOG.length}</span>
            </div>
            <div className="pulse-row">
              <span className="name">ollama</span>
              <span className="val" style={{color: ollamaInfo?.available ? "var(--accent)" : "var(--fg-3)"}}>
                {ollamaInfo === null ? "…" : ollamaInfo?.available ? (ollamaInfo.model || "ok") : "off"}
              </span>
            </div>
            <div className="pulse-row"><span className="name">latence moy.</span><span className="val">—</span></div>
            <div className="pulse-row">
              <span className="name">throughput</span>
              <span className="val"><Spark values={[1,1,1,1,1,1,1,1,1,1]} h={10}/></span>
            </div>
          </div>
        </aside>

        {/* ── Topbar ──────────────────────────────────────────────────── */}
        <header className="topbar">
          <div className="topbar__search">
            <span className="ico"><Icon n="search" size={14}/></span>
            <input placeholder="Rechercher dans toutes les enquêtes, indices, entités…"/>
            <span className="kbd">⌘K</span>
          </div>
          <div className="topbar__right">
            <div className="topbar__stat"><span>Engine</span><b className="acc">● online</b></div>
            <div className="topbar__stat"><span>UTC</span><b><Clock/></b></div>
            <button className="btn btn--icon btn--ghost" title="Notifications"><Icon n="bell" size={14}/></button>
            <div className="topbar__avatar" onClick={() => setRoute({ name: "compte", params: {} })} title="Compte">?</div>
          </div>
        </header>

        {/* ── Contenu principal (router) ───────────────────────────────── */}
        <main className="main">
          {route.name === "dashboard" && (
            <Dashboard
              investigations={investigations}
              onOpen={openInvestigation}
              onNew={goNew}
              layout={dashLayout}
              setLayout={setDashLayout}
            />
          )}
          {route.name === "new" && (
            <NewInvestigation
              onStart={startInvestigation}
              onCancel={() => setRoute({ name: "dashboard", params: {} })}
            />
          )}
          {route.name === "investigation" && current && (
            <InvestigationView
              inv={current}
              onBack={() => setRoute({ name: "dashboard", params: {} })}
              onUpdate={updateInv}
              onDelete={deleteInv}
            />
          )}
          {route.name === "history" && (
            <History investigations={investigations} onOpen={openInvestigation}/>
          )}
          {route.name === "config" && (
            <Config tweaks={tweaks}/>
          )}
          {route.name === "compte" && (
            <Compte investigations={investigations}/>
          )}
          {route.name === "effacement" && (
            <Effacement/>
          )}
        </main>
      </div>

      {/* Curseur personnalisé (réticule + coordonnées) */}
      <CursorLayer showCoords={tweaks.showCoords}/>

      {/* Panel tweaks — visible uniquement depuis claude.ai/design (postMessage) */}
      <TweaksUI tweaks={tweaks} setTweaks={setTweaks}/>
    </>
  );
}


// ─── Curseur personnalisé ─────────────────────────────────────────────────────
//
// Remplace le curseur natif par un réticule SVG animé.
// Trois états visuels :
//   - défaut   : réticule fin + anneau tournant
//   - hover    : anneau élargi + label contextuel (ex: "open", "toggle")
//   - texte    : curseur caret clignotant (sur input/textarea)
//   - click    : réticule rétréci (retour visuel du clic)
//
// La position est interpolée (lerp 50%) pour un effet de "traîne" fluide
// sans ajouter de latence perceptible.

function CursorLayer({ showCoords }) {
  const dotRef   = _ar(null);  // ref vers l'élément DOM du curseur
  const labelRef = _ar(null);
  const [coords, setCoords] = _as({ x: 0, y: 0 }); // pour le HUD coordonnées
  const targetRef = _ar({ x: 0, y: 0 }); // position réelle de la souris
  const posRef    = _ar({ x: 0, y: 0 }); // position interpolée du curseur
  const [hover,  setHover]  = _as(0);
  const [text,   setText]   = _as(0);
  const [label,  setLabel]  = _as("");
  const [down,   setDown]   = _as(0);

  _ae(() => {
    let raf;

    // Boucle d'animation : interpolation linéaire entre position cible et position affichée
    const tick = () => {
      posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.5;
      posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.5;
      if (dotRef.current) {
        dotRef.current.style.transform =
          `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e) => {
      targetRef.current.x = e.clientX;
      targetRef.current.y = e.clientY;
      setCoords({ x: e.clientX, y: e.clientY });

      // Détection du type d'élément survolé pour adapter la forme du curseur
      const el = e.target;
      const interactive = el?.closest?.(
        'button, a, [role="button"], [data-cursor-label], ' +
        '.invrow, .invcard, .board-card, .history-row, .source-item, ' +
        '.type-chip, .nav, .tab, .toggle, .del-btn, .layout-switch button, .topbar__avatar'
      );
      const inputEl = el?.closest?.('input, textarea, [contenteditable="true"]');

      if (inputEl) {
        // Curseur caret sur les champs de saisie
        setHover(0); setText(1); setLabel("");
      } else if (interactive) {
        // Anneau élargi + label sur les éléments cliquables
        setHover(1); setText(0);
        const lbl = interactive.getAttribute('data-cursor-label') || cursorLabelFor(interactive);
        setLabel(lbl);
      } else {
        setHover(0); setText(0); setLabel("");
      }
    };

    const onDown  = () => setDown(1);
    const onUp    = () => setDown(0);
    // Masquer le curseur quand la souris quitte la fenêtre
    const onLeave = () => { if (dotRef.current) dotRef.current.style.opacity = "0"; };
    const onEnter = () => { if (dotRef.current) dotRef.current.style.opacity = "1"; };

    window.addEventListener("mousemove",  onMove,  { passive: true });
    window.addEventListener("mousedown",  onDown);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseenter", onEnter);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mousedown",  onDown);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  return (
    <div className="cursor-root" aria-hidden="true">
      <div className="cursor"
        ref={dotRef}
        data-hover={hover ? "1" : "0"}
        data-active={down  ? "1" : "0"}
        data-text={text   ? "1" : "0"}
        data-show-label={label && hover ? "1" : "0"}
      >
        <svg viewBox="0 0 18 18">
          <circle className="cursor__ring" cx="9" cy="9" r="8"/>
          <circle className="cursor__dot" cx="9" cy="9" r="2.5"/>
        </svg>
        <span className="cursor__label" ref={labelRef}>{label}</span>
      </div>

      {/* HUD coordonnées en bas à droite — désactivable dans les tweaks */}
      {showCoords && (
        <div className="cursor__coords">
          <span>x · <b>{coords.x.toString().padStart(4, "0")}</b></span>
          <span>y · <b>{coords.y.toString().padStart(4, "0")}</b></span>
        </div>
      )}
    </div>
  );
}

/** Retourne le label affiché dans la bulle du curseur selon la classe de l'élément. */
function cursorLabelFor(el) {
  if (el.classList.contains("invrow")       ||
      el.classList.contains("invcard")      ||
      el.classList.contains("history-row")  ||
      el.classList.contains("board-card"))   return "open";
  if (el.classList.contains("type-chip"))   return "toggle";
  if (el.classList.contains("source-item")) return "toggle";
  if (el.classList.contains("toggle"))      return "toggle";
  if (el.classList.contains("nav"))         return "go";
  if (el.classList.contains("tab"))         return "view";
  if (el.classList.contains("del-btn"))     return "delete";
  return "click";
}


// ─── Panel de tweaks visuels ──────────────────────────────────────────────────
// Visible uniquement dans claude.ai/design (activation via postMessage).
// Permet d'ajuster palette, accent, CRT et layout sans recharger l'app.

function TweaksUI({ tweaks, setTweaks }) {
  const { TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } = window;
  return (
    <TweaksPanel title="Tweaks · Findium">
      <TweakSection label="Palette" />
      <TweakRadio
        label="Palette"
        value={tweaks.palette}
        options={[
          { value: "matrix", label: "Matrix" },
          { value: "neon",   label: "Néon"   },
          { value: "olive",  label: "Olive"  },
        ]}
        onChange={(v) => {
          // Synchroniser l'accent avec la palette sélectionnée
          const accentMap = { matrix: "#00ff7a", neon: "#39ff14", olive: "#c4e641", cyan: "#5cffe2" };
          setTweaks({ palette: v, accent: accentMap[v] || tweaks.accent });
        }}
      />
      <TweakColor
        label="Couleur d'accent"
        value={tweaks.accent}
        options={["#00ff7a", "#39ff14", "#c4e641", "#5cffe2", "#ff5a72", "#5cc5ff"]}
        onChange={(v) => setTweaks('accent', v)}
      />

      <TweakSection label="Affichage" />
      <TweakToggle label="Effet CRT / scanlines" value={tweaks.crt}        onChange={(v) => setTweaks('crt', v)}/>
      <TweakToggle label="HUD coordonnées curseur" value={tweaks.showCoords} onChange={(v) => setTweaks('showCoords', v)}/>

      <TweakSection label="Dashboard" />
      <TweakRadio
        label="Layout"
        value={tweaks.dashboardLayout}
        options={[
          { value: "table", label: "Table"  },
          { value: "cards", label: "Cartes" },
          { value: "board", label: "Kanban" },
        ]}
        onChange={(v) => setTweaks('dashboardLayout', v)}
      />
    </TweaksPanel>
  );
}


// ─── Utilitaires couleur ──────────────────────────────────────────────────────
// Utilisés pour recalculer les variantes CSS de l'accent dynamiquement.

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Retourne rgba(r,g,b,a) depuis un hex et une opacité. */
function hexA(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Éclaircit une couleur hex d'un facteur amt (0=identique, 1=blanc). */
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * amt));
  const lg = Math.min(255, Math.round(g + (255 - g) * amt));
  const lb = Math.min(255, Math.round(b + (255 - b) * amt));
  return `rgb(${lr},${lg},${lb})`;
}


// ─── Point de montage React ───────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("app")).render(<App/>);
