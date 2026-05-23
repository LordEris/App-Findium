/**
 * screens.jsx — Écrans principaux de l'application
 *
 * Contient les quatre vues hors investigation :
 *
 *   Dashboard        : tableau de bord avec métriques globales et liste des enquêtes
 *                      en trois modes d'affichage (table, cartes, kanban).
 *
 *   NewInvestigation : formulaire de création d'enquête — indices d'entrée, sélection
 *                      des sources, profondeur de recherche (0-4).
 *
 *   History          : historique complet avec recherche textuelle et filtres de statut.
 *
 *   Config           : configuration des sources, langue, région, clé API Anthropic.
 *                      La clé API est stockée de façon sécurisée via window.claude.setKey()
 *                      (DPAPI Windows en Electron, localStorage en dev).
 *                      Le composant ne conserve jamais la clé en état React après la
 *                      sauvegarde — seul un booléen keyIsSet est mémorisé.
 *
 * Composants internes :
 *   InvTable, InvCards, InvBoard : trois mises en page pour la liste des enquêtes.
 */
const { useState: _ss, useEffect: _se, useMemo: _sm, useRef: _sr } = React;

// ============================================================
// DASHBOARD
// ============================================================
// Affiche les métriques globales (actives, entités, recoupements, sources)
// et la liste des enquêtes dans le mode d'affichage choisi.
function Dashboard({ investigations, onOpen, onNew, layout, setLayout }) {
  const running   = investigations.filter(i => i.status === "running").length;
  const complete  = investigations.filter(i => i.status === "complete").length;
  const totalEntities = investigations.reduce((a, i) => a + (i.entities?.length || 0), 0);
  const totalCrossrefs = investigations.reduce((a, i) => a + (i.edges?.length || 0), 0);

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs">
            <span>workspace</span><span className="sep">/</span><span>dashboard</span>
          </div>
          <h1 className="h1">Dashboard</h1>
          <p>{running} enquête{running>1?"s":""} en cours · {complete} terminée{complete>1?"s":""} sur les 30 derniers jours</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost"><Icon n="filter" size={14}/> Filtres</button>
          <button className="btn btn--primary" onClick={onNew}><Icon n="plus" size={14}/> Nouvelle enquête</button>
        </div>
      </div>

      {/* Métriques globales en 4 colonnes */}
      <div className="metric-row">
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Enquêtes actives</div>
            <div className="metric__ico"><Icon n="pulse" size={14}/></div>
          </div>
          <div className="metric__value">{running}<small>/ {investigations.length}</small></div>
          <div className="metric__trend"><Icon n="bolt" size={12}/> {running > 0 ? `${running} en cours` : "Aucune en cours"}</div>
        </div>
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Entités tracées</div>
            <div className="metric__ico"><Icon n="graph" size={14}/></div>
          </div>
          <div className="metric__value">{totalEntities}</div>
          <div className="metric__trend"><Spark values={[1,1,1,1,1,1,1,1,totalEntities]}/> &nbsp;total</div>
        </div>
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Recoupements</div>
            <div className="metric__ico"><Icon n="link" size={14}/></div>
          </div>
          <div className="metric__value">{totalCrossrefs}</div>
          <div className="metric__trend"><Spark values={[1,1,1,1,1,1,1,1,totalCrossrefs]}/> &nbsp;total</div>
        </div>
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Sources connectées</div>
            <div className="metric__ico"><Icon n="globe" size={14}/></div>
          </div>
          <div className="metric__value">{window.FINDIUM.SOURCES_CATALOG.filter(s=>s.status==="ok").length}<small>/ {window.FINDIUM.SOURCES_CATALOG.length}</small></div>
          <div className="metric__trend flat"><Icon n="alert" size={12}/> {window.FINDIUM.SOURCES_CATALOG.filter(s=>s.status!=="ok").length} hors-ligne</div>
        </div>
      </div>

      {/* Sélecteur de mode d'affichage */}
      <div className="section-h">
        <h2 className="h2">Enquêtes</h2>
        <span className="mute">Triées par activité</span>
        <div className="layout-switch">
          <button data-on={layout==="table"?"1":"0"} onClick={() => setLayout("table")}>Table</button>
          <button data-on={layout==="cards"?"1":"0"} onClick={() => setLayout("cards")}>Cartes</button>
          <button data-on={layout==="board"?"1":"0"} onClick={() => setLayout("board")}>Kanban</button>
        </div>
      </div>

      {layout === "table" && <InvTable items={investigations} onOpen={onOpen}/>}
      {layout === "cards" && <InvCards items={investigations} onOpen={onOpen}/>}
      {layout === "board" && <InvBoard items={investigations} onOpen={onOpen}/>}
    </div>
  );
}

// ── Mode tableau ──────────────────────────────────────────────────────────────
// Grille à 7 colonnes avec en-tête fixe. Chaque ligne est cliquable.
function InvTable({ items, onOpen }) {
  return (
    <div className="invlist">
      <div className="invlist__head">
        <div>Ref</div>
        <div>Titre</div>
        <div>Statut</div>
        <div>Progression</div>
        <div>Recoupements</div>
        <div>Dernière activité</div>
        <div></div>
      </div>
      {items.map((i) => (
        <div key={i.id} className="invrow" onClick={() => onOpen(i.id)}>
          <div className="invrow__id">{i.id}</div>
          <div className="invrow__title">{i.title}<small>{i.summary}</small></div>
          <div><StatusTag status={i.status} small/></div>
          <div className="invrow__bar">
            <Bar value={i.progress || 0} className="bar--thin"/>
            <div className="mono-sm" style={{marginTop:4}}>{Math.round((i.progress||0)*100)}%</div>
          </div>
          <div className="invrow__meta">{i.edges?.length || 0} liens · {i.entities?.length || 0} ent.</div>
          <div className="invrow__meta">{i.createdAt}</div>
          <div className="invrow__chev"><Icon n="chev" size={14}/></div>
        </div>
      ))}
    </div>
  );
}

// ── Mode cartes ───────────────────────────────────────────────────────────────
// Grille de cartes 3 colonnes avec résumé tronqué (2 lignes max via -webkit-line-clamp).
function InvCards({ items, onOpen }) {
  return (
    <div className="invgrid">
      {items.map((i) => (
        <div key={i.id} className="invcard" onClick={() => onOpen(i.id)}>
          <div className="invcard__top">
            <div className="invcard__id">{i.id}</div>
            <StatusTag status={i.status} small/>
          </div>
          <div className="invcard__title">{i.title}</div>
          <div className="invcard__sum">{i.summary}</div>
          <Bar value={i.progress || 0} className="bar--thin"/>
          <div className="invcard__meta">
            <span><b>{i.entities?.length || 0}</b> entités</span>
            <span><b>{i.edges?.length || 0}</b> recoupements</span>
            <span>· {i.elapsed}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mode kanban ───────────────────────────────────────────────────────────────
// 4 colonnes par statut (running / paused / complete / archived).
// Les statuts "aborted" n'ont pas de colonne dédiée (cas rare, peu affichés).
function InvBoard({ items, onOpen }) {
  const cols = [
    { key: "running",  label: "En cours" },
    { key: "paused",   label: "En pause" },
    { key: "complete", label: "Terminées" },
    { key: "archived", label: "Archivées" },
  ];
  return (
    <div className="board">
      {cols.map(c => {
        const items_ = items.filter(i => i.status === c.key);
        return (
          <div key={c.key} className="board__col">
            <div className="board__h">
              {c.label}
              <span className="count">{items_.length}</span>
            </div>
            {items_.map(i => (
              <div key={i.id} className="board-card" onClick={() => onOpen(i.id)}>
                <div className="t">
                  <small>{i.id}</small>
                  {i.title}
                </div>
                <Bar value={i.progress || 0} className="bar--thin"/>
                <div className="meta">
                  <span>{i.entities?.length || 0} ent.</span>
                  <span>{i.edges?.length || 0} liens</span>
                </div>
              </div>
            ))}
            {items_.length === 0 && (
              <div style={{textAlign:"center",color:"var(--fg-3)",padding:"24px 0",fontSize:12}}>—</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// NEW INVESTIGATION
// ============================================================
// Formulaire de création d'enquête.
// État local :
//   title      : titre libre de l'enquête
//   note       : contexte libre (ajouté comme input "note" à la soumission)
//   inputs     : tableau d'indices {type, value} — au moins un par défaut
//   sources    : map id → boolean (état coché/décoché par source)
//   depth      : profondeur de recherche 0-4 (surface → exhaustif)
//   busy       : bloque la double soumission
function NewInvestigation({ onStart, onCancel }) {
  const { INPUT_TYPES, SOURCES_CATALOG } = window.FINDIUM;
  const [title, setTitle] = _ss("");
  const [note, setNote]   = _ss("");
  const [inputs, setInputs] = _ss([{ type: "name", value: "" }]);
  const [sources, setSources] = _ss(() => Object.fromEntries(SOURCES_CATALOG.map(s => [s.id, s.on])));
  const [depth, setDepth] = _ss(2);
  const [busy, setBusy] = _ss(false);

  const addInput = () => setInputs([...inputs, { type: "name", value: "" }]);
  const updInput = (i, k, v) => { const c = [...inputs]; c[i][k] = v; setInputs(c); };
  const delInput = (i) => setInputs(inputs.filter((_, j) => j !== i));
  const toggleSource = (id) => setSources({ ...sources, [id]: !sources[id] });
  const activeSources = SOURCES_CATALOG.filter(s => sources[s.id]);

  // Soumission : filtre les indices vides, ajoute la note si présente,
  // puis délègue à onStart() (défini dans app.jsx → startInvestigation).
  const submit = () => {
    if (busy) return;
    setBusy(true);
    const cleanInputs = inputs.filter(i => i.value.trim());
    if (note.trim()) cleanInputs.push({ type: "note", value: note.trim() });
    onStart({
      title: title || "Enquête sans titre",
      inputs: cleanInputs,
      sourcesUsed: activeSources.map(s => s.id),
      depth,
    });
  };

  const depthLabels = ["surface", "léger", "standard", "approfondi", "exhaustif"];

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs">
            <span>workspace</span><span className="sep">/</span><span>dashboard</span><span className="sep">/</span><span>nouvelle</span>
          </div>
          <h1 className="h1">Nouvelle enquête</h1>
          <p>Saisis les éléments dont tu disposes, choisis tes sources, l'IA lancera la recherche et les recoupements.</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost" onClick={onCancel}>Annuler</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            <Icon n="play" size={12}/>
            {busy ? "Initialisation…" : "Lancer l'enquête"}
          </button>
        </div>
      </div>

      {/* Grille 2 colonnes : indices (gauche) + sources + profondeur (droite) */}
      <div className="new-grid">
        {/* Colonne gauche — titre et indices */}
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div className="card">
            <h3 className="h3" style={{marginBottom:10}}>Titre & contexte</h3>
            <div className="field" style={{marginBottom:12}}>
              <label className="field__label">Titre de l'enquête</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="Ex : Réseau Blackbird — sociétés-écrans"/>
            </div>
            <div className="field">
              <label className="field__label">Contexte / note libre</label>
              <textarea className="textarea" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Décris ce que tu cherches, ce que tu sais déjà, et toute hypothèse à vérifier..."/>
            </div>
          </div>

          <div className="card">
            <h3 className="h3" style={{marginBottom:10}}>Indices disponibles</h3>
            <p className="dim" style={{margin:"4px 0 12px",fontSize:12}}>
              Ajoute autant d'éléments que tu veux. L'IA s'en sert comme points de départ pour ses recoupements.
            </p>
            <div className="inputs-stack">
              {inputs.map((inp, i) => {
                const it = INPUT_TYPES.find(t => t.id === inp.type) || INPUT_TYPES[0];
                return (
                  <div key={i} className="input-row">
                    <select className="select" value={inp.type} onChange={e => updInput(i, "type", e.target.value)}>
                      {INPUT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon}  {t.label}</option>)}
                    </select>
                    <input className="input mono" value={inp.value}
                      onChange={e => updInput(i, "value", e.target.value)}
                      placeholder={it.placeholder}/>
                    <button className="del-btn" onClick={() => delInput(i)} title="Supprimer">×</button>
                  </div>
                );
              })}
            </div>
            <button className="btn btn--ghost btn--sm" style={{marginTop:12}} onClick={addInput}>
              <Icon n="plus" size={12}/> Ajouter un indice
            </button>
          </div>
        </div>

        {/* Colonne droite — profondeur + sources + résumé */}
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div className="card">
            <h3 className="h3" style={{marginBottom:10}}>Profondeur de recherche</h3>
            <input type="range" min="0" max="4" value={depth} onChange={e => setDepth(+e.target.value)} className="slider"/>
            <div className="depth-track">
              {depthLabels.map((l, i) => (
                <span key={i} style={{color: i === depth ? "var(--accent)" : "var(--fg-3)", fontWeight: i === depth ? 600 : 400}}>{l}</span>
              ))}
            </div>
            <p className="dim" style={{margin:"14px 0 0",fontSize:12}}>
              Mode <b className="acc">{depthLabels[depth]}</b> — ~{[3,6,12,20,30][depth]} requêtes par indice, expansion {[1,2,2,3,4][depth]} hop.
            </p>
          </div>

          <div className="card">
            <h3 className="h3" style={{marginBottom:10}}>Sources actives <span className="mute" style={{marginLeft:6}}>· {activeSources.length}/{SOURCES_CATALOG.length}</span></h3>
            <div className="source-list">
              {SOURCES_CATALOG.map(s => (
                <div key={s.id} className="source-item" data-on={sources[s.id] ? "1" : "0"} onClick={() => toggleSource(s.id)}>
                  <div className="source-item__cb">{sources[s.id] ? "✓" : ""}</div>
                  <div className="source-item__name">{s.name}<small>{s.kind}</small></div>
                  <div className="source-item__lat">~{s.lat}</div>
                  <SourceStatus status={s.status}/>
                </div>
              ))}
            </div>
          </div>

          {/* Récapitulatif + bouton de lancement secondaire */}
          <div className="card" style={{borderColor:"var(--accent-line)", background:"linear-gradient(180deg, var(--accent-mute), var(--bg-card))"}}>
            <h3 className="h3" style={{color:"var(--accent)",marginBottom:8}}>⚡ Prêt à lancer</h3>
            <p className="dim" style={{fontSize:12, margin:"0 0 12px"}}>
              {inputs.filter(i => i.value.trim()).length} indice{inputs.filter(i => i.value.trim()).length>1?"s":""} ·
              {" "}{activeSources.length} source{activeSources.length>1?"s":""} ·
              {" "}profondeur <b className="acc">{depthLabels[depth]}</b>
            </p>
            <button className="btn btn--primary btn--lg" style={{width:"100%",justifyContent:"center"}} onClick={submit} disabled={busy}>
              <Icon n="play" size={14}/> Lancer la recherche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HISTORY
// ============================================================
// Liste filtrée de toutes les enquêtes.
// Filtres :
//   q            : recherche textuelle (titre + résumé + id)
//   statusFilter : filtre par statut (all / running / complete / paused / archived)
function History({ investigations, onOpen }) {
  const [q, setQ] = _ss("");
  const [statusFilter, setStatusFilter] = _ss("all");
  const items = investigations.filter(i =>
    (statusFilter === "all" || i.status === statusFilter) &&
    (q === "" || (i.title + " " + i.summary + " " + i.id).toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs"><span>workspace</span><span className="sep">/</span><span>historique</span></div>
          <h1 className="h1">Historique</h1>
          <p>Toutes les enquêtes — actives, archivées, abandonnées.</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost"><Icon n="download" size={14}/> Export CSV</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="topbar__search" style={{maxWidth:360, flex:1}}>
          <span className="ico"><Icon n="search" size={14}/></span>
          <input placeholder="Rechercher par titre, ref, indice…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <div className="layout-switch">
          {["all","running","complete","paused","archived"].map(s => (
            <button key={s} data-on={statusFilter===s?"1":"0"} onClick={() => setStatusFilter(s)}>
              {s === "all" ? "Toutes" : ({running:"En cours",complete:"Terminées",paused:"Pause",archived:"Archivées"}[s])}
            </button>
          ))}
        </div>
      </div>

      <div className="history-grid">
        {items.map(i => (
          <div key={i.id} className="history-row" onClick={() => onOpen(i.id)}>
            <div className="history-row__id">{i.id}</div>
            <StatusTag status={i.status} small/>
            <div className="history-row__title">{i.title}<small>{i.summary}</small></div>
            <div className="history-row__meta">{i.createdAt}</div>
            <div className="history-row__meta">{i.elapsed}</div>
            <div className="history-row__meta">{i.entities?.length || 0} ent. · {i.edges?.length || 0} liens</div>
            <div style={{textAlign:"right",color:"var(--fg-3)"}}><Icon n="chev" size={14}/></div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="empty">
            <div className="glyph"><Icon n="archive" size={26}/></div>
            <h3>Aucune enquête trouvée</h3>
            <p>Ajuste tes filtres ou relance une recherche.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CONFIG
// ============================================================
// Panneau de configuration général.
//
// Sécurité clé API :
//   - L'input est de type "password" — la valeur n'est jamais affichée.
//   - Après saveAnthropicKey() : la clé est transmise à window.claude.setKey()
//     (qui la route vers DPAPI en Electron ou localStorage en dev), puis
//     l'état local anthropicKey est vidé immédiatement.
//   - Seul keyIsSet (booléen) est conservé en état — jamais la clé elle-même.
//   - L'indicateur "Clé configurée" appelle window.claude.hasKey() de façon async
//     au montage (une seule fois), sans jamais lire la clé en clair.
function Config({ tweaks }) {
  const { SOURCES_CATALOG } = window.FINDIUM;
  const [sources, setSources] = _ss(() => Object.fromEntries(SOURCES_CATALOG.map(s => [s.id, s.on])));
  const [verbose, setVerbose] = _ss(true);
  const [autoExport, setAutoExport] = _ss(false);
  const [lang, setLang] = _ss("fr-en");
  const [region, setRegion] = _ss("eu");
  // anthropicKey : saisie temporaire, vidée après sauvegarde
  const [anthropicKey, setAnthropicKey] = _ss("");
  // keyIsSet : vrai si une clé valide est configurée dans le stockage sécurisé
  const [keyIsSet, setKeyIsSet] = _ss(false);
  // keySaved : indicateur visuel de succès (reset après 2s)
  const [keySaved, setKeySaved] = _ss(false);
  // Ollama
  const [ollamaStatus, setOllamaStatus] = _ss(null);
  const [ollamaBusy, setOllamaBusy] = _ss(false);

  // Vérification initiale du statut de la clé (async — IPC vers main process en Electron)
  _se(() => {
    if (window.claude?.hasKey) {
      Promise.resolve(window.claude.hasKey()).then(v => setKeyIsSet(!!v)).catch(() => {});
    }
    if (window.findium?.osint) {
      window.findium.osint.check()
        .then(s => setOllamaStatus(s))
        .catch(() => setOllamaStatus({ available: false }));
    }
  }, []);

  const pingOllama = async () => {
    setOllamaBusy(true);
    try {
      const s = await window.findium.osint.check();
      setOllamaStatus(s);
    } catch(e) {
      setOllamaStatus({ available: false });
    }
    setOllamaBusy(false);
  };

  // Sauvegarde de la clé : transmise au stockage sécurisé, puis état local vidé
  const saveAnthropicKey = async () => {
    await window.claude?.setKey(anthropicKey);
    const nowSet = await Promise.resolve(window.claude?.hasKey?.()).catch(() => !!anthropicKey);
    setKeyIsSet(!!nowSet);
    setAnthropicKey(""); // efface la valeur de l'input immédiatement
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs"><span>workspace</span><span className="sep">/</span><span>configuration</span></div>
          <h1 className="h1">Configuration</h1>
          <p>Sources, langue, région et préférences du moteur de recherche.</p>
        </div>
      </div>

      <div className="config-grid">
        {/* Bloc sources OSINT — toggle individuel par source */}
        <div className="config-block">
          <h3>Sources OSINT</h3>
          <p>Active ou désactive les bases interrogées par l'IA. Désactiver une source réduit la couverture mais accélère les requêtes.</p>
          {SOURCES_CATALOG.map(s => (
            <div key={s.id} className="source-config-row">
              <div className="n">{s.name}<small>{s.kind}</small></div>
              <div><SourceStatus status={s.status}/></div>
              <div className="mono-sm">~{s.lat}</div>
              <div style={{textAlign:"right"}}>
                <span className="toggle" data-on={sources[s.id]?"1":"0"} onClick={() => setSources({...sources, [s.id]: !sources[s.id]})}>
                  <span className="toggle__sw"></span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          {/* Bloc langue & région */}
          <div className="config-block">
            <h3>Recherche & langue</h3>
            <p>Réglages globaux du moteur.</p>
            <div className="field" style={{marginBottom:14}}>
              <label className="field__label">Langues prioritaires</label>
              <select className="select" value={lang} onChange={e => setLang(e.target.value)}>
                <option value="fr">Français uniquement</option>
                <option value="en">Anglais uniquement</option>
                <option value="fr-en">Français + Anglais</option>
                <option value="multi">Multilingue (auto)</option>
              </select>
            </div>
            <div className="field" style={{marginBottom:14}}>
              <label className="field__label">Région de référence</label>
              <select className="select" value={region} onChange={e => setRegion(e.target.value)}>
                <option value="eu">Europe</option>
                <option value="fr">France</option>
                <option value="na">Amérique du Nord</option>
                <option value="global">Mondial</option>
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:6}}>
              <span className="toggle" data-on={verbose?"1":"0"} onClick={() => setVerbose(!verbose)}>
                <span className="toggle__sw"></span> Logs détaillés (étapes de raisonnement)
              </span>
              <span className="toggle" data-on={autoExport?"1":"0"} onClick={() => setAutoExport(!autoExport)}>
                <span className="toggle__sw"></span> Export PDF auto à la fin d'une enquête
              </span>
            </div>
          </div>

          {/* Bloc clés API — surlignage vert si l'utilisateur est en train de saisir */}
          <div className="config-block" style={anthropicKey ? {borderColor:"var(--accent-line)"} : {}}>
            <h3>API & clés</h3>
            <p>Identifiants pour les sources qui en demandent. Stockés localement dans le navigateur.</p>

            {/* Champ clé Anthropic — type password, jamais affiché en clair */}
            <div className="field" style={{marginBottom:14}}>
              <label className="field__label" style={{color:"var(--accent)"}}>Clé API — Anthropic (moteur IA)</label>
              <div style={{display:"flex",gap:8}}>
                <input className="input mono" type="password"
                  placeholder="sk-ant-…"
                  value={anthropicKey}
                  onChange={e => setAnthropicKey(e.target.value)}
                  style={{flex:1}}
                />
                <button className="btn btn--primary btn--sm" onClick={saveAnthropicKey}>
                  {keySaved ? <><Icon n="check" size={12}/> Sauvegardé</> : <><Icon n="key" size={12}/> Sauvegarder</>}
                </button>
              </div>
              <div style={{fontSize:11,color:"var(--fg-3)",marginTop:4}}>
                {keyIsSet
                  ? <span style={{color:"var(--accent)"}}>● Clé configurée — l'IA est active pour les nouvelles enquêtes</span>
                  : "Sans clé, les enquêtes utilisent un mode synthétique dégradé."}
              </div>
            </div>

            <div className="field" style={{marginBottom:10}}>
              <label className="field__label">Clé API — registries.eu</label>
              <input className="input mono" placeholder="aucune clé configurée"/>
            </div>
            <div className="field" style={{marginBottom:10}}>
              <label className="field__label">Clé API — leakindex</label>
              <input className="input mono" placeholder="aucune clé configurée"/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button className="btn btn--ghost btn--sm"><Icon n="key" size={12}/> Tester les clés</button>
              <button className="btn btn--ghost btn--sm">Importer un fichier .env</button>
            </div>
          </div>

          {/* Bloc Ollama — moteur IA local gratuit */}
          {window.findium?.osint && (
            <div className="config-block" style={ollamaStatus?.available ? {borderColor:"var(--accent-line)"} : {}}>
              <h3>Moteur IA local — Ollama</h3>
              <p>Agent OSINT natif, gratuit et privé. Fonctionne hors-ligne avec un LLM local.</p>

              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                {ollamaStatus === null && (
                  <span className="dim" style={{fontSize:12}}>Vérification en cours…</span>
                )}
                {ollamaStatus?.available && (
                  <span style={{color:"var(--accent)",fontSize:12,fontFamily:"var(--font-mono)"}}>
                    ● actif · {ollamaStatus.model || "modèle inconnu"}
                    {ollamaStatus.models?.length > 1 && (
                      <span className="dim"> ({ollamaStatus.models.length} modèles)</span>
                    )}
                  </span>
                )}
                {ollamaStatus?.available === false && (
                  <span style={{color:"var(--err)",fontSize:12,fontFamily:"var(--font-mono)"}}>
                    ○ hors-ligne — lancez Ollama pour activer l'agent réel
                  </span>
                )}
                <button className="btn btn--ghost btn--sm" style={{marginLeft:"auto"}}
                  onClick={pingOllama} disabled={ollamaBusy}>
                  {ollamaBusy ? "…" : <><Icon n="pulse" size={12}/> Tester</>}
                </button>
              </div>

              {ollamaStatus?.models?.length > 0 && (
                <div className="field" style={{marginBottom:10}}>
                  <label className="field__label">Modèle actif</label>
                  <select className="select">
                    {ollamaStatus.models.map(m => (
                      <option key={m} value={m} selected={m === ollamaStatus.model}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              <p className="dim" style={{fontSize:11,margin:"8px 0 0"}}>
                Sans Ollama, les enquêtes utilisent Claude (clé API ci-dessus) ou le mode synthétique.
                Installer : <span style={{fontFamily:"var(--font-mono)",color:"var(--fg-1)"}}>ollama.com</span>
                {" · "}Modèles recommandés : llama3.2, mistral, qwen2.5
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPTE
// ============================================================
function Compte({ investigations }) {
  const [tab, setTab] = _ss("profile");
  const completed = investigations.filter(i => i.status === "complete").length;
  const running = investigations.filter(i => i.status === "running").length;
  const totalEntities = investigations.reduce((a, i) => a + (i.entities?.length || 0), 0);
  const totalEdges = investigations.reduce((a, i) => a + (i.edges?.length || 0), 0);
  const avgConf = (() => {
    let n = 0, s = 0;
    investigations.forEach(i => (i.edges || []).forEach(e => { s += (e.conf || 0); n++; }));
    return n ? Math.round((s / n) * 100) : 0;
  })();

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs"><span>workspace</span><span className="sep">/</span><span>compte</span></div>
          <h1 className="h1">Compte analyste</h1>
          <p>Profil, sécurité, équipe et historique d'activité.</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost btn--sm"><Icon n="download" size={14}/> Exporter mes données</button>
          <button className="btn btn--ghost btn--sm"><Icon n="x" size={14}/> Déconnexion</button>
        </div>
      </div>

      <div className="acct-hero">
        <div className="acct-hero__left">
          <div className="acct-avatar">?<div className="acct-avatar__rank"></div></div>
          <div>
            <div className="acct-name">
              —
              <span className="tag tag--ok" style={{marginLeft:10}}><span className="dot dot--pulse"></span>EN LIGNE</span>
            </div>
            <div className="acct-handle dim">Profil non configuré</div>
            <div className="acct-meta">
              <span><Icon n="shield" size={12}/> Habilitation <b className="acc">—</b></span>
            </div>
          </div>
        </div>
        <div className="acct-hero__right">
          <div className="acct-clearance">
            <div className="acct-clearance__lbl">Enquêtes</div>
            <div className="acct-clearance__val">{completed + running}</div>
            <Bar value={Math.min((completed + running) / 10, 1)} className="bar--thin"/>
            <div className="acct-clearance__sub">{running} en cours · {completed} terminée{completed>1?"s":""}</div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{padding:"0",margin:"24px 0 0",background:"transparent",borderBottom:"1px solid var(--line)"}}>
        <button className="tab" data-on={tab==="profile"?"1":"0"}   onClick={() => setTab("profile")}><Icon n="user" size={14}/> Profil</button>
        <button className="tab" data-on={tab==="stats"?"1":"0"}     onClick={() => setTab("stats")}><Icon n="pulse" size={14}/> Statistiques</button>
        <button className="tab" data-on={tab==="security"?"1":"0"}  onClick={() => setTab("security")}><Icon n="shield" size={14}/> Sécurité</button>
        <button className="tab" data-on={tab==="team"?"1":"0"}      onClick={() => setTab("team")}><Icon n="user" size={14}/> Équipe</button>
        <button className="tab" data-on={tab==="audit"?"1":"0"}     onClick={() => setTab("audit")}><Icon n="eye" size={14}/> Journal d'accès</button>
      </div>

      <div style={{marginTop:24}}>
        {tab === "profile"  && <CompteProfile/>}
        {tab === "stats"    && <CompteStats completed={completed} running={running} totalEntities={totalEntities} totalEdges={totalEdges} avgConf={avgConf} investigations={investigations}/>}
        {tab === "security" && <CompteSecurity/>}
        {tab === "team"     && <CompteTeam/>}
        {tab === "audit"    && <CompteAudit/>}
      </div>
    </div>
  );
}

function CompteProfile() {
  const [nick, setNick] = _ss("");
  const [email, setEmail] = _ss("");
  const [bio, setBio] = _ss("");
  return (
    <div className="config-grid">
      <div className="config-block">
        <h3>Identité</h3>
        <p>Visible dans l'équipe et sur les rapports signés.</p>
        <div className="field" style={{marginBottom:14}}>
          <label className="field__label">Identifiant opérationnel</label>
          <input className="input mono" value={nick} onChange={e => setNick(e.target.value)}/>
        </div>
        <div className="field" style={{marginBottom:14}}>
          <label className="field__label">Email professionnel</label>
          <input className="input mono" value={email} onChange={e => setEmail(e.target.value)}/>
        </div>
        <div className="field" style={{marginBottom:14}}>
          <label className="field__label">Cellule</label>
          <select className="select" defaultValue="eu-north">
            <option value="eu-north">EU-North</option>
            <option value="eu-south">EU-South</option>
            <option value="emea">EMEA</option>
            <option value="apac">APAC</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label">Bio courte</label>
          <textarea className="textarea" value={bio} onChange={e => setBio(e.target.value)}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button className="btn btn--primary"><Icon n="check" size={12}/> Enregistrer</button>
          <button className="btn btn--ghost">Annuler</button>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div className="config-block">
          <h3>Spécialités</h3>
          <p>Domaines d'expertise affichés aux autres analystes.</p>
          <div className="input-types">
            {["Sociétés-écrans","Crypto","Désinformation","Cybercrime","Trafic d'art","Sanctions","Géopolitique","Reverse image"].map((tag, i) => (
              <span key={tag} className="type-chip" data-on={i < 4 ? "1" : "0"}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="config-block">
          <h3>Préférences</h3>
          <p>Comment l'interface s'adapte à toi.</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <span className="toggle" data-on="1"><span className="toggle__sw"></span> Résumé quotidien par email</span>
            <span className="toggle" data-on="1"><span className="toggle__sw"></span> Push sur recoupement à forte confiance</span>
            <span className="toggle" data-on="0"><span className="toggle__sw"></span> Mode silencieux (pas de son sur log live)</span>
            <span className="toggle" data-on="1"><span className="toggle__sw"></span> Signer mes rapports avec ma clé GPG</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompteStats({ completed, running, totalEntities, totalEdges, avgConf, investigations = [] }) {
  const { INPUT_TYPES } = window.FINDIUM;
  const inputCounts = _sm(() => {
    const counts = {};
    investigations.forEach(inv => (inv.inputs || []).forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; }));
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return INPUT_TYPES.map(t => ({ label: t.label, v: (counts[t.id] || 0) / total })).filter(t => t.v > 0);
  }, [investigations]);
  return (
    <div>
      <div className="metric-row">
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Enquêtes menées</div>
            <div className="metric__ico"><Icon n="folder" size={14}/></div>
          </div>
          <div className="metric__value">{completed + running}<small>total</small></div>
          <div className="metric__trend"><Icon n="bolt" size={12}/> total</div>
        </div>
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Entités identifiées</div>
            <div className="metric__ico"><Icon n="graph" size={14}/></div>
          </div>
          <div className="metric__value">{totalEntities}</div>
          <div className="metric__trend"><Spark values={[2,4,3,6,5,8,7,9,11,9,12]}/> &nbsp;cumul</div>
        </div>
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Confiance moyenne</div>
            <div className="metric__ico"><Icon n="check" size={14}/></div>
          </div>
          <div className="metric__value">{avgConf}<small>%</small></div>
          <div className="metric__trend">—</div>
        </div>
        <div className="metric">
          <div className="metric__top">
            <div className="metric__label">Temps moyen / enquête</div>
            <div className="metric__ico"><Icon n="pulse" size={14}/></div>
          </div>
          <div className="metric__value">—</div>
          <div className="metric__trend flat">—</div>
        </div>
      </div>

      <div className="acct-grid2">
        <div className="config-block">
          <h3>Activité 30 derniers jours</h3>
          <p>Heures de connexion + actions par jour.</p>
          <div className="acct-heatmap">
            {Array.from({length: 30}).map((_, i) => {
              const v = Math.floor(((Math.sin(i * 1.7) + 1) * 0.5 + Math.random() * 0.4) * 9);
              const op = 0.05 + (v / 9) * 0.85;
              return <div key={i} className="hm-cell" style={{background: `rgba(0, 255, 122, ${op})`}} title={`J-${30 - i} · ${v} actions`}/>;
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:11,color:"var(--fg-3)",fontFamily:"var(--font-mono)"}}>
            <span>-30j</span><span>moins ←  → plus</span><span>aujourd'hui</span>
          </div>
        </div>

        <div className="config-block">
          <h3>Répartition par type d'indice</h3>
          <p>Sur toutes les enquêtes.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:6}}>
            {inputCounts.length === 0
              ? <div className="dim" style={{fontSize:12}}>Aucune enquête pour l'instant.</div>
              : inputCounts.map(r => (
                <div key={r.label}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--fg-1)",marginBottom:4}}>
                    <span>{r.label}</span>
                    <span className="mono dim">{Math.round(r.v * 100)}%</span>
                  </div>
                  <Bar value={r.v} className="bar--thin"/>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function CompteSecurity() {
  const [twofa, setTwofa] = _ss(true);
  const [biometric, setBiometric] = _ss(false);
  return (
    <div className="config-grid">
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div className="config-block">
          <h3>Authentification</h3>
          <p>Méthodes utilisées pour vérifier ton identité.</p>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:10}}>
            <div className="acct-row">
              <div className="acct-row__ico"><Icon n="key" size={16}/></div>
              <div className="acct-row__body">
                <div className="acct-row__t">Mot de passe principal</div>
                <div className="acct-row__s">Dernière modification il y a 14 jours</div>
              </div>
              <button className="btn btn--ghost btn--sm">Modifier</button>
            </div>
            <div className="acct-row">
              <div className="acct-row__ico"><Icon n="shield" size={16}/></div>
              <div className="acct-row__body">
                <div className="acct-row__t">Double facteur (TOTP)</div>
                <div className="acct-row__s">App authenticator · 6 codes de secours restants</div>
              </div>
              <span className="toggle" data-on={twofa?"1":"0"} onClick={() => setTwofa(!twofa)}>
                <span className="toggle__sw"></span>
              </span>
            </div>
            <div className="acct-row">
              <div className="acct-row__ico"><Icon n="eye" size={16}/></div>
              <div className="acct-row__body">
                <div className="acct-row__t">Clé matérielle (WebAuthn)</div>
                <div className="acct-row__s">YubiKey · non configurée</div>
              </div>
              <span className="toggle" data-on={biometric?"1":"0"} onClick={() => setBiometric(!biometric)}>
                <span className="toggle__sw"></span>
              </span>
            </div>
          </div>
        </div>

        <div className="config-block">
          <h3>Clé de signature GPG</h3>
          <p>Tes rapports terminés sont signés avec cette clé.</p>
          <div className="acct-gpg">
            <div className="acct-gpg__fp dim">Aucune clé GPG configurée</div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button className="btn btn--ghost btn--sm"><Icon n="download" size={12}/> Exporter clé publique</button>
            <button className="btn btn--ghost btn--sm"><Icon n="key" size={12}/> Régénérer</button>
          </div>
        </div>
      </div>

      <div className="config-block">
        <h3>Sessions actives</h3>
        <p>Tous les appareils actuellement connectés à ton compte.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
          <div className="acct-session">
            <div>
              <div className="acct-session__d">
                Findium Desktop
                <span className="tag tag--ok" style={{marginLeft:8}}><span className="dot dot--pulse"></span>SESSION ACTUELLE</span>
              </div>
              <div className="acct-session__s dim">Session locale</div>
            </div>
          </div>
        </div>
        <div style={{marginTop:14}}>
          <button className="btn btn--danger btn--sm" style={{width:"100%",justifyContent:"center"}}>
            <Icon n="x" size={12}/> Déconnecter toutes les autres sessions
          </button>
        </div>
      </div>
    </div>
  );
}

function CompteTeam() {
  return (
    <div>
      <div className="acct-grid2" style={{marginBottom:18}}>
        <div className="config-block">
          <h3>Cellule</h3>
          <p>Aucun membre configuré.</p>
          <div style={{display:"flex",alignItems:"center",gap:14,marginTop:8}}>
            <button className="btn btn--ghost btn--sm"><Icon n="plus" size={12}/> Inviter un analyste</button>
          </div>
        </div>
        <div className="config-block">
          <h3>Partage d'enquêtes</h3>
          <p>Visibilité par défaut de tes nouvelles enquêtes.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:6}}>
            <span className="toggle" data-on="0"><span className="toggle__sw"></span> Visibles dans la cellule</span>
            <span className="toggle" data-on="0"><span className="toggle__sw"></span> Lead uniquement</span>
            <span className="toggle" data-on="0"><span className="toggle__sw"></span> Mentions auto sur recoupement</span>
          </div>
        </div>
      </div>
      <div className="empty">
        <div className="glyph"><Icon n="user" size={26}/></div>
        <h3>Aucun membre d'équipe</h3>
        <p>Invite des analystes pour partager des enquêtes.</p>
      </div>
    </div>
  );
}

function CompteAudit() {
  const events = [];
  return (
    <div className="config-block">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <h3 style={{marginBottom:4}}>Journal d'accès</h3>
          <p style={{margin:0}}>Toutes les actions sur ton compte — 30 derniers jours. Immuable, signé.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn--ghost btn--sm"><Icon n="download" size={12}/> Export JSON</button>
        </div>
      </div>
      <div className="acct-audit">
        {events.length === 0
          ? <div className="dim" style={{fontSize:12,padding:"16px 0"}}>Aucun événement enregistré.</div>
          : events.map((e, i) => (
            <div key={i} className="acct-audit__row">
              <span className="acct-audit__ts mono">{e.ts}</span>
              <span className={"acct-audit__lv " + (e.lv === "warn" ? "warn" : e.lv === "ok" ? "acc" : "info")}>
                {e.lv === "warn" ? "⚠" : e.lv === "ok" ? "✓" : "·"}
              </span>
              <span className="acct-audit__ev">{e.ev}</span>
              <span className="acct-audit__det dim">{e.det}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// Export global — accessible via window.Dashboard, window.NewInvestigation, etc.
window.FINDIUM_SCREENS = { Dashboard, NewInvestigation, History, Config, Compte };
Object.assign(window, { Dashboard, NewInvestigation, History, Config, Compte });
