/**
 * investigation.jsx — Vue détaillée d'une enquête + Runner IA
 *
 * Deux responsabilités distinctes dans ce fichier :
 *
 * 1. COMPOSANTS UI
 *    InvestigationView  — shell avec header, terminal live et onglets
 *    InvLeftPane        — panneau gauche : log terminal + ticker sources
 *    TimelineView       — chronologie des événements détectés
 *    FicheView          — fiche structurée (indices, entités, recoupements)
 *    ReportView         — rapport exécutif final généré par l'IA
 *
 * 2. RUNNER IA (runInvestigation)
 *    Orchestre les 4 phases d'une enquête :
 *      Phase 01 — Ingestion & normalisation des indices
 *      Phase 02 — Interrogation simulée des sources OSINT
 *      Phase 03 — Appel à Claude (via window.claude.complete) pour la synthèse
 *      Phase 04 — Consolidation et finalisation
 *    À chaque étape, onUpdate() est appelé → le terminal se met à jour en live.
 */

const { useState: _is, useEffect: _ie, useMemo: _im, useRef: _ir, useCallback: _ic } = React;


// ─── InvestigationView ────────────────────────────────────────────────────────

function InvestigationView({ inv, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = _is("graph");
  const [selectedNode, setSelectedNode] = _is(null);
  const [confirmDelete, setConfirmDelete] = _is(false);

  if (!inv) return null;

  const handleDelete = () => {
    onDelete?.(inv.id);
    onBack();
  };

  return (
    <div className="inv-shell">

      {/* ── Header : identité + statut + barre de progression ───────── */}
      <div className="inv-head">
        <div className="inv-head__left">
          <div className="inv-head__id">{inv.id} · {inv.classif}</div>
          <h1 className="h1">{inv.title}</h1>
          <div className="inv-head__meta">
            <span>opérateur · <b>{inv.operator}</b></span>
            <span>démarrée · <b>{inv.createdAt}</b></span>
            <span>écoulé · <b>{inv.elapsed}</b></span>
            <span>indices · <b>{inv.inputs?.length || 0}</b></span>
          </div>
          {/* Barre de progression — visible uniquement pendant l'exécution */}
          {inv.status === "running" && (
            <div className="inv-progress">
              <Bar value={inv.progress || 0}/>
              <div className="pct">{Math.round((inv.progress || 0) * 100)}%</div>
            </div>
          )}
        </div>

        <div className="inv-head__actions">
          <StatusTag status={inv.status}/>
          {inv.status === "running" && (
            <>
              <button className="btn btn--ghost btn--sm"><Icon n="pause" size={12}/> Pause</button>
              <button className="btn btn--danger btn--sm"><Icon n="stop" size={12}/> Abort</button>
            </>
          )}
          <button className="btn btn--ghost btn--sm"><Icon n="share" size={12}/> Partager</button>
          <button className="btn btn--ghost btn--sm"><Icon n="download" size={12}/> Export</button>
          {inv.status !== "running" && (
            <button className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(true)}>
              <Icon n="x" size={12}/> Supprimer
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Retour</button>
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="modal__sub" style={{color:"var(--err)"}}>Action irréversible</div>
                <div className="modal__title">Supprimer cette enquête ?</div>
              </div>
              <button className="btn btn--ghost btn--icon" onClick={() => setConfirmDelete(false)}><Icon n="x" size={14}/></button>
            </div>
            <div className="modal__body">
              <p style={{color:"var(--fg-1)",fontSize:13,margin:0}}>
                L'enquête <b>{inv.id}</b> — <i>{inv.title}</i> sera définitivement supprimée.
                Log, graphe, rapport et toutes les entités associées seront perdus.
              </p>
            </div>
            <div className="modal__foot">
              <div/>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
                <button className="btn btn--danger" onClick={handleDelete}>
                  <Icon n="x" size={12}/> Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Corps : terminal gauche | contenu tabulaire droit ────────── */}
      <div className="inv-body">
        <InvLeftPane inv={inv}/>

        <div className="inv-right">
          {/* Onglets de visualisation */}
          <div className="tabs">
            <button className="tab" data-on={tab==="graph"?"1":"0"} onClick={() => setTab("graph")}>
              <Icon n="graph" size={14}/> Graphe <span className="count">{inv.entities?.length || 0}</span>
            </button>
            <button className="tab" data-on={tab==="timeline"?"1":"0"} onClick={() => setTab("timeline")}>
              <Icon n="timeline" size={14}/> Timeline <span className="count">{inv.timeline?.length || 0}</span>
            </button>
            <button className="tab" data-on={tab==="map"?"1":"0"} onClick={() => setTab("map")}>
              <Icon n="map" size={14}/> Carte <span className="count">{inv.locations?.length || 0}</span>
            </button>
            <button className="tab" data-on={tab==="fiche"?"1":"0"} onClick={() => setTab("fiche")}>
              <Icon n="file" size={14}/> Fiche
            </button>
            <button className="tab" data-on={tab==="report"?"1":"0"} onClick={() => setTab("report")}>
              <Icon n="report" size={14}/> Rapport
            </button>
          </div>

          {tab === "graph"    && <div className="pane pane--graph"><NetworkGraph entities={inv.entities || []} edges={inv.edges || []} onSelect={setSelectedNode} selectedId={selectedNode}
            onUpdateEntity={(id, patch) => onUpdate({...inv, entities: (inv.entities||[]).map(e => e.id===id ? {...e,...patch} : e)})}
          /></div>}
          {tab === "timeline" && <div className="pane"><TimelineView events={inv.timeline || []}/></div>}
          {tab === "map"      && <div className="pane"><MapView locations={inv.locations || []}/></div>}
          {tab === "fiche"    && <div className="pane"><FicheView inv={inv}/></div>}
          {tab === "report"   && <div className="pane"><ReportView inv={inv}/></div>}
        </div>
      </div>
    </div>
  );
}


// ─── InvLeftPane : terminal live + ticker sources ────────────────────────────

function InvLeftPane({ inv }) {
  const termRef = _ir(null);

  // Auto-scroll vers le bas à chaque nouvelle ligne de log
  _ie(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [inv.log?.length]);

  return (
    <div className="inv-left">
      <div className="inv-left__head">
        <span style={{color:"var(--accent)"}}>●</span> live log{" "}
        <b>{inv.status === "running" ? "// STREAM" : "// STATIC"}</b>
        <span style={{marginLeft:"auto",color:"var(--fg-3)",fontFamily:"var(--font-mono)",fontSize:11}}>
          {(inv.log||[]).length} lines
        </span>
      </div>

      {/* Terminal — dangerouslySetInnerHTML utilisé car les logs contiennent du HTML
          léger (<b>, <i>) généré par le runner (pas d'input utilisateur, pas de XSS risk) */}
      <div className="term" ref={termRef}>
        {(inv.log || []).map((l, i) => (
          <div key={i} className={"l" + (l.lv === "step" ? " l--step" : "")}>
            <span className="ts">{l.ts || formatTs(i)}</span>
            <span className={"lv lv--" + (l.lv || "info")}>[{(l.lv||"info").toUpperCase()}]</span>
            <span className="ms" dangerouslySetInnerHTML={{__html: l.ms}}/>
          </div>
        ))}
        {/* Curseur clignotant pendant l'exécution */}
        {inv.status === "running" && (
          <div className="l">
            <span className="ts">{formatTs((inv.log||[]).length)}</span>
            <span className="lv lv--query">[QUERY]</span>
            <span className="ms"><span className="cursor"></span></span>
          </div>
        )}
      </div>

      {/* Ticker sources : statut et hits par source interrogée */}
      <div className="inv-left__foot">
        <h3 className="h3" style={{marginBottom:8,color:"var(--fg)"}}>Sources interrogées</h3>
        <div className="src-tick">
          {(inv.sources || []).map((s, i) => (
            <div key={i} className="src-tick__row">
              <span className="nm">{s.name}</span>
              <SourceStatus status={s.status}/>
              <span className="ms">{s.hits || 0}h · {s.latency}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Convertit un index de ligne de log en timestamp HH:MM:SS.
 * Seed basé sur 14h08 (heure de la démo initiale) + 17s par ligne.
 */
function formatTs(seed) {
  const base = 14 * 3600 + 8 * 60;
  const t    = base + seed * 17;
  const pad  = n => String(n).padStart(2, "0");
  return `${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
}


// ─── TimelineView ─────────────────────────────────────────────────────────────

function TimelineView({ events }) {
  if (!events.length) return (
    <EmptyState icon="timeline"
      title="Pas encore d'événement"
      sub="Les événements chronologiques s'affichent ici au fur et à mesure des recoupements."/>
  );
  return (
    <div className="tl">
      {events.map((e, i) => (
        <div key={i} className="tl__row">
          <div className="tl__dot"></div>
          <div className="tl__date">{e.date}</div>
          <div className="tl__title">{e.title}</div>
          <div className="tl__desc">{e.desc}</div>
          <div className="tl__src">source : {e.src}</div>
        </div>
      ))}
    </div>
  );
}


// ─── FicheView ────────────────────────────────────────────────────────────────

function FicheView({ inv }) {
  return (
    <div className="fiche">
      {/* Colonne gauche : identité + indices fournis + synthèse */}
      <div className="fiche__col">
        <div className="fiche__sect">
          <h3 className="h3">Identification</h3>
          <div className="field-row"><span className="k">Référence</span>     <span className="v mono">{inv.id}</span></div>
          <div className="field-row"><span className="k">Titre</span>          <span className="v">{inv.title}</span></div>
          <div className="field-row"><span className="k">Classification</span> <span className="v"><span className="tag tag--warn" style={{fontSize:10}}>{inv.classif}</span></span></div>
          <div className="field-row"><span className="k">Statut</span>         <span className="v"><StatusTag status={inv.status} small/></span></div>
          <div className="field-row"><span className="k">Opérateur</span>      <span className="v">{inv.operator}</span></div>
          <div className="field-row"><span className="k">Démarrée</span>       <span className="v mono">{inv.createdAt}</span></div>
          <div className="field-row"><span className="k">Durée</span>          <span className="v mono">{inv.elapsed}</span></div>
        </div>

        <div className="fiche__sect">
          <h3 className="h3">Indices fournis</h3>
          <div className="entity-list">
            {(inv.inputs || []).map((inp, i) => (
              <div key={i} className="entity">
                <div className="entity__ico">{typeIcon(inp.type)}</div>
                <div className="entity__name">{inp.value}<small>{inp.type}</small></div>
              </div>
            ))}
            {(!inv.inputs?.length) && <div className="dim" style={{fontSize:12,padding:8}}>—</div>}
          </div>
        </div>

        <div className="fiche__sect">
          <h3 className="h3">Synthèse</h3>
          <p style={{margin:0,color:"var(--fg-1)",fontSize:13}}>{inv.summary}</p>
        </div>
      </div>

      {/* Colonne droite : entités identifiées + recoupements clés */}
      <div className="fiche__col">
        <div className="fiche__sect">
          <h3 className="h3">Entités identifiées <span className="mute" style={{marginLeft:6}}>· {inv.entities?.length || 0}</span></h3>
          <div className="entity-list">
            {(inv.entities || []).map(e => (
              <div key={e.id} className="entity">
                <div className="entity__ico">{typeIcon(e.type)}</div>
                <div className="entity__name">{e.label}<small>{e.sub || e.type}</small></div>
                {/* Barre de confiance : 0.0 → 1.0 */}
                <ConfBar value={e.conf}/>
              </div>
            ))}
            {(!inv.entities?.length) && <div className="dim" style={{fontSize:12,padding:8}}>—</div>}
          </div>
        </div>

        <div className="fiche__sect">
          <h3 className="h3">Recoupements clés <span className="mute" style={{marginLeft:6}}>· {inv.edges?.length || 0}</span></h3>
          <div className="entity-list">
            {/* On n'affiche que les 8 premiers pour ne pas surcharger la fiche */}
            {(inv.edges || []).slice(0, 8).map((e, i) => {
              const a = (inv.entities || []).find(x => x.id === e.from);
              const b = (inv.entities || []).find(x => x.id === e.to);
              if (!a || !b) return null; // edge orphelin (ne devrait pas arriver)
              return (
                <div key={i} className="entity" style={{gridTemplateColumns:"auto 1fr auto"}}>
                  <div className="entity__ico" style={{width:24,height:24,fontSize:11}}><Icon n="link" size={12}/></div>
                  <div className="entity__name" style={{fontSize:12}}>
                    {a.label} <span className="mute mono" style={{fontSize:10,margin:"0 6px"}}>→ {e.kind} →</span> {b.label}
                  </div>
                  <ConfBar value={e.conf}/>
                </div>
              );
            })}
            {(!inv.edges?.length) && <div className="dim" style={{fontSize:12,padding:8}}>—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── ReportView ───────────────────────────────────────────────────────────────
// Rapport structuré généré par l'IA : chiffres clés + sections HTML.
// Les sections peuvent contenir du HTML léger (<b>, <ul>, <div class="quote">)
// produit par le prompt de buildPrompt() — pas d'input utilisateur direct.

function ReportView({ inv }) {
  const report = inv.report || { key: [], sections: [] };
  return (
    <div className="report">
      {/* Bloc de chiffres clés */}
      <div className="hdr-block">
        {(report.key || []).map((k, i) => (
          <div key={i}>
            <div className="lbl">{k.k}</div>
            {/* Premier chiffre en blanc, les suivants en accent */}
            <div className={"val" + (i === 0 ? "" : " acc")}>{k.v}</div>
          </div>
        ))}
        {(!report.key?.length) && (
          <div style={{gridColumn:"1/-1"}} className="dim">
            Rapport en attente — la synthèse sera générée à la fin de l'enquête.
          </div>
        )}
      </div>

      {(report.sections || []).map((s, i) => (
        <section key={i}>
          <h2>{s.h}</h2>
          {s.body.map((html, j) => (
            <div key={j} dangerouslySetInnerHTML={{__html: html.startsWith("<") ? html : `<p>${html}</p>`}}/>
          ))}
        </section>
      ))}
    </div>
  );
}


// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty">
      <div className="glyph"><Icon n={icon} size={26}/></div>
      <h3>{title}</h3>
      <p>{sub}</p>
    </div>
  );
}


// ─── Outils OSINT — définitions pour l'agent Ollama (format OpenAI tool-use) ──
const OSINT_TOOLS = [
  { type:"function", function:{ name:"dns_lookup",    description:"Requête DNS (A/AAAA/MX/TXT/NS/CNAME) sur un domaine.", parameters:{ type:"object", properties:{ domain:{type:"string"}, type:{type:"string",enum:["A","AAAA","MX","TXT","NS","CNAME"],default:"A"} }, required:["domain"] } } },
  { type:"function", function:{ name:"cert_search",   description:"Certificats SSL/TLS émis pour un domaine (crt.sh).", parameters:{ type:"object", properties:{ domain:{type:"string"} }, required:["domain"] } } },
  { type:"function", function:{ name:"wayback_check", description:"Vérifie l'archivage d'une URL sur la Wayback Machine.", parameters:{ type:"object", properties:{ url:{type:"string"} }, required:["url"] } } },
  { type:"function", function:{ name:"rdap_lookup",   description:"Informations d'enregistrement d'un domaine (registrant, dates).", parameters:{ type:"object", properties:{ domain:{type:"string"} }, required:["domain"] } } },
  { type:"function", function:{ name:"geoip_lookup",  description:"Géolocalise une adresse IP (pays, ville, ASN, ISP).", parameters:{ type:"object", properties:{ ip:{type:"string"} }, required:["ip"] } } },
  { type:"function", function:{ name:"web_search",    description:"Recherche web via DuckDuckGo Instant Answers.", parameters:{ type:"object", properties:{ query:{type:"string"} }, required:["query"] } } },
];

// Construit la liste des appels d'outils OSINT à exécuter en Phase 02
function getOsintCalls(inputs) {
  const calls = [], seen = new Set();
  const add = (tool, args, label) => {
    const key = tool + JSON.stringify(args);
    if (seen.has(key)) return;
    seen.add(key);
    calls.push({ tool, args, label });
  };
  for (const inp of inputs) {
    const v = (inp.value || "").trim();
    if (!v) continue;
    if (inp.type === "domain" || inp.type === "url") {
      const domain = v.replace(/^https?:\/\//i,"").split("/")[0].split("?")[0];
      add("dns_lookup",    { domain, type:"A" }, `dns.A(${domain})`);
      add("cert_search",   { domain },             `crt.sh(${domain})`);
      add("rdap_lookup",   { domain },             `rdap(${domain})`);
      if (inp.type === "url") add("wayback_check", { url: v }, `wayback(${domain})`);
    } else if (inp.type === "ip") {
      add("geoip_lookup",  { ip: v }, `geoip(${v})`);
    } else if (inp.type === "email") {
      const dom = v.split("@")[1];
      if (dom) {
        add("dns_lookup",  { domain: dom, type:"MX" }, `dns.MX(${dom})`);
        add("cert_search", { domain: dom },             `crt.sh(${dom})`);
      }
      add("web_search", { query: v }, `web("${v.slice(0,25)}")`);
    } else {
      add("web_search", { query: v }, `web("${v.slice(0,30)}")`);
    }
  }
  return calls;
}

// Résumé court des arguments pour l'affichage terminal
function argSummary(tool, args) {
  if (args.domain) return args.domain + (args.type ? ` (${args.type})` : "");
  if (args.ip)     return args.ip;
  if (args.url)    return String(args.url).slice(0, 50);
  if (args.query)  return `"${String(args.query).slice(0, 40)}"`;
  return JSON.stringify(args).slice(0, 60);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER IA — runInvestigation()
//
// Fonction asynchrone qui orchestre les 4 phases d'une enquête.
// Elle est appelée depuis app.jsx::startInvestigation() et reçoit :
//   - params   : { title, inputs, sourcesUsed, depth }
//   - onUpdate : callback appelé à chaque mutation de l'enquête
//
// Architecture des phases :
//
//   Phase 01 — Ingestion & normalisation
//     Simule la réception et le hashage des indices fournis.
//
//   Phase 02 — OSINT réel ou simulé
//     Si Ollama est disponible : exécute les vrais outils OSINT (dns, crt.sh,
//     rdap, wayback, geoip, web_search) via window.findium.osint.tool().
//     Sinon : simule les sources du SOURCES_CATALOG avec latences aléatoires.
//
//   Phase 03 — Synthèse IA
//     Si Ollama disponible : boucle tool-use (runOllamaAgent) — le LLM local
//     peut demander des outils supplémentaires puis produit le JSON final.
//     Sinon : appel Claude (window.claude.complete) ou fallback synthétique.
//
//   Phase 04 — Consolidation
//     Calcule la confiance moyenne, marque l'enquête comme terminée.
// ═══════════════════════════════════════════════════════════════════════════════

async function runInvestigation({ params, onUpdate }) {
  const id  = "INV-" + String(Date.now()).slice(-6);
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const createdAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let inv = {
    id, title: params.title,
    status: "running", createdAt, elapsed: "00:00:00", progress: 0,
    operator: "analyst.07", classif: "OPEN",
    summary: "Recherche en cours...",
    inputs: params.inputs,
    sourcesUsed: params.sourcesUsed,
    log: [], sources: [],
    entities: [], edges: [], timeline: [], locations: [],
    report: { key: [], sections: [] },
  };

  const tsBase = Date.now();
  const addLog      = (lv, ms) => { const s = Math.floor((Date.now()-tsBase)/1000); inv = {...inv, log: [...inv.log, {ts:formatTs(s), lv, ms}]}; onUpdate(inv); };
  const setSrc      = (name, patch) => { inv = {...inv, sources: inv.sources.map(s => s.name===name ? {...s,...patch} : s)}; onUpdate(inv); };
  const setProgress = p => { inv = {...inv, progress: p}; onUpdate(inv); };

  // ── Phase 01 — Ingestion ──────────────────────────────────────────────────
  addLog("step", "phase 01 — ingestion & normalisation");
  addLog("ok", `${params.inputs.length} indice${params.inputs.length>1?"s":""} ingéré${params.inputs.length>1?"s":""}`);
  for (const inp of params.inputs)
    addLog("info", `type=<b>${inp.type}</b> · <i>${escapeHtml(inp.value)}</i>`);
  setProgress(0.08);

  // ── Phase 02 — Collecte OSINT réelle ─────────────────────────────────────
  addLog("step", "phase 02 — collecte OSINT");
  const osintCalls = getOsintCalls(params.inputs);
  if (!osintCalls.length) {
    addLog("warn", "aucun outil applicable (fournir un domaine, une IP ou un email pour activer DNS/RDAP/crt.sh)");
  }
  inv = { ...inv, sources: osintCalls.map(c => ({ name: c.label, status: "querying", latency: 0, hits: 0 })) };
  onUpdate(inv);

  const rawData = {};
  for (let i = 0; i < osintCalls.length; i++) {
    const { tool, args, label } = osintCalls[i];
    addLog("query", `<b>${label}</b> :: ${argSummary(tool, args)}`);
    const t0 = Date.now();
    try {
      const result = await window.findium.osint.tool(tool, args);
      const lat = Date.now() - t0;
      rawData[label] = result;
      const ok = result && !result.error && Object.keys(result).length > 0;
      setSrc(label, { status: ok ? "hit" : "partial", latency: lat, hits: ok ? 1 : 0 });
      addLog(ok ? "ok" : "warn", `<b>${label}</b> · ${ok ? `données reçues (${lat}ms)` : `aucune donnée (${lat}ms)`}`);
    } catch(e) {
      setSrc(label, { status: "noresult", latency: Date.now() - t0, hits: 0 });
      addLog("info", `<b>${label}</b> · indisponible`);
    }
    setProgress(0.08 + ((i + 1) / Math.max(osintCalls.length, 1)) * 0.57);
  }

  // ── Phase 03 — Synthèse Claude avec les données réelles ──────────────────
  addLog("step", "phase 03 — analyse & synthèse · Claude API");
  addLog("query", `claude.api :: entity-extraction · confidence-scoring · cross-reference`);
  setProgress(0.72);

  let aiText = "";
  try {
    aiText = await window.claude.complete(buildPromptWithData(params, rawData));
    addLog("ok", "réponse IA reçue");
  } catch (err) {
    addLog("err", `IA indisponible · ${escapeHtml(String(err?.message || err))}`);
    aiText = fallbackSynthesis(params);
  }

  const parsed = tryParseJson(aiText) || heuristicExtract(aiText, params);
  addLog("ok", `structure validée · <b>${parsed.entities?.length||0}</b> entités · <b>${parsed.edges?.length||0}</b> liens`);

  inv = {
    ...inv,
    summary:   parsed.summary   || inv.summary,
    entities:  parsed.entities  || [],
    edges:     parsed.edges     || [],
    timeline:  parsed.timeline  || [],
    locations: parsed.locations || [],
    report:    parsed.report    || { key: [], sections: [] },
  };
  onUpdate(inv);

  // ── Phase 04 — Consolidation ──────────────────────────────────────────────
  setProgress(0.94);
  addLog("step", "phase 04 — consolidation");
  if (inv.edges?.length)    addLog("info", `confiance moyenne · <b>${avgConf(inv.edges)}%</b>`);
  if (inv.entities?.length) addLog("ok",   `<b>${inv.entities.length}</b> entité${inv.entities.length>1?"s":""} consolidée${inv.entities.length>1?"s":""}`);

  inv = { ...inv, status: "complete", progress: 1, elapsed: humanElapsed(Date.now() - tsBase) };
  onUpdate(inv);
  addLog("ok", "enquête terminée — rapport disponible");
  return inv;
}


// ─── Agent Ollama — boucle tool-use ──────────────────────────────────────────
// Envoie les données collectées à Ollama et laisse le LLM appeler des outils
// supplémentaires si nécessaire. Boucle jusqu'à ce qu'il produise le JSON final.
async function runOllamaAgent({ params, rawData, ollamaStatus, addLog }) {
  const model = ollamaStatus.model || "llama3.2";

  const inputsTxt = params.inputs.map(i => `[${i.type}] ${i.value}`).join("\n");
  const rawTxt = Object.entries(rawData)
    .map(([k, v]) => `## ${k}\n${JSON.stringify(v, null, 2)}`)
    .join("\n\n");

  const systemPrompt = `Tu es un analyste OSINT expert. Analyse les indices et les données collectées, puis génère un rapport structuré.
Utilise les outils disponibles si tu as besoin de données supplémentaires.
Quand tu as assez d'informations, renvoie UNIQUEMENT ce bloc JSON (sans texte avant ni après) :
{"summary":"1-2 phrases résumant les découvertes","entities":[{"id":"n1","type":"person|email|domain|ip|org|url","label":"...","conf":0.85,"sub":"contexte"}],"edges":[{"from":"n1","to":"n2","kind":"owns|alias-of|hosts|contact|directs","conf":0.8}],"timeline":[{"date":"YYYY-MM-DD","title":"événement","desc":"1 phrase","src":"source"}],"locations":[{"label":"Ville, PAYS","lat":0.0,"lng":0.0,"type":"person|org","size":6}],"report":{"key":[{"k":"Sujet","v":"..."},{"k":"Entités","v":"N"},{"k":"Recoupements","v":"N"},{"k":"Confiance","v":"XX%"}],"sections":[{"h":"Résumé exécutif","body":["<p>...</p>"]},{"h":"Recoupements clés","body":["<ul><li>...</li></ul>"]},{"h":"Prochaines étapes","body":["<ul><li>...</li></ul>"]}]}}
Contraintes : 4-10 entités, 3-10 edges, 2-6 events timeline, 1-4 locations. Style sobre, en français.`;

  const userMsg = `ENQUÊTE : ${params.title}
INDICES :
${inputsTxt}
DONNÉES OSINT :
${rawTxt || "(aucune — utilise les outils pour collecter)"}
Produis le rapport JSON final.`;

  let messages = [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userMsg },
  ];

  let turns = 0;
  const maxTurns = 12;
  while (turns++ < maxTurns) {
    let resp;
    try {
      resp = await window.findium.osint.chat(model, messages, OSINT_TOOLS);
    } catch(e) {
      addLog("err", `Ollama — ${escapeHtml(String(e.message))}`);
      return null;
    }
    if (!resp || resp.error) {
      addLog("warn", `Ollama — ${escapeHtml(String(resp?.error || "réponse vide"))}`);
      return null;
    }

    const msg = resp.message || {};
    messages.push(msg);

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        const fn   = tc.function || {};
        const name = fn.name || "";
        const args = typeof fn.arguments === "string"
          ? (() => { try { return JSON.parse(fn.arguments); } catch { return {}; } })()
          : (fn.arguments || {});
        addLog("query", `agent → <b>${escapeHtml(name)}</b>(${escapeHtml(argSummary(name, args))})`);
        try {
          const result = await window.findium.osint.tool(name, args);
          messages.push({ role: "tool", content: JSON.stringify(result) });
          addLog("ok", `<b>${escapeHtml(name)}</b> · résultat intégré`);
        } catch(e) {
          messages.push({ role: "tool", content: JSON.stringify({ error: String(e.message) }) });
          addLog("warn", `<b>${escapeHtml(name)}</b> · échec`);
        }
      }
    } else {
      const content = String(msg.content || "");
      const parsed  = tryParseJson(content);
      if (parsed?.entities) {
        addLog("ok", `JSON validé · <b>${parsed.entities.length}</b> entités, <b>${parsed.edges?.length||0}</b> liens`);
        return parsed;
      }
      addLog("warn", "réponse non-JSON · extraction heuristique");
      return heuristicExtract(content, params);
    }
  }

  addLog("warn", `limite ${maxTurns} tours atteinte`);
  const last = messages[messages.length - 1] || {};
  const c = String(last.content || "");
  return tryParseJson(c) || heuristicExtract(c, params);
}


// ─── Utilitaires runner ───────────────────────────────────────────────────────

function escapeHtml(s) { return (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }

function avgConf(edges) {
  if (!edges.length) return 0;
  return Math.round((edges.reduce((a, e) => a + (e.conf||0), 0) / edges.length) * 100);
}

function humanElapsed(ms) {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = n => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

/** Retourne un label de requête lisible pour le terminal, par source. */
function queryLabel(source, params) {
  const sample = params.inputs[0]?.value || "";
  const labels = {
    "web.public":      `keyword "${sample}"`,
    "press.archive":   `archive search "${sample}"`,
    "social.crawl":    `mentions of "${sample}" 2019-2026`,
    "registries.eu":   `eu corporate registries`,
    "whois.daemon":    `whois + ssl certs lookup`,
    "reverse.image":   `phash + exif analysis`,
    "gov.opendata":    `open data cross-check`,
    "geoindex":        `address normalize + geocode`,
    "wayback.machine": `snapshots 2018-2026`,
    "tor.observatory": `darknet markets observatory`,
    "polyglot":        `translate + transliterate`,
    "leakindex":       `breach indices lookup`,
  };
  return labels[source.name] || "generic.lookup";
}

/**
 * Extrait le premier bloc {...} d'un texte et tente un JSON.parse.
 * Claude peut parfois entourer le JSON de texte parasite (explication, markdown).
 */
function tryParseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/**
 * Construit le prompt envoyé à Claude, en y incluant les données OSINT réelles collectées.
 * Claude doit baser ses conclusions sur les faits observés, pas les inventer.
 */
function buildPromptWithData(params, rawData) {
  const inputsTxt = params.inputs.map(i => `- [${i.type}] ${i.value}`).join("\n");
  const dataEntries = Object.entries(rawData);
  const dataTxt = dataEntries.length
    ? dataEntries.map(([k, v]) => `### ${k}\n${JSON.stringify(v, null, 2).slice(0, 2500)}`).join("\n\n")
    : "(aucune donnée technique collectée — analyse basée sur les indices fournis uniquement)";

  return `Tu es un analyste OSINT senior. Analyse les indices et les données réelles collectées ci-dessous, puis génère un rapport structuré.

ENQUÊTE : ${params.title}

INDICES FOURNIS :
${inputsTxt}

DONNÉES OSINT COLLECTÉES (DNS, RDAP, certificats TLS, Wayback Machine, GeoIP, recherche web) :
${dataTxt}

Renvoie UN SEUL bloc JSON valide (sans texte avant/après, sans markdown) :
{"summary":"1-2 phrases factuelles résumant les découvertes","entities":[{"id":"n1","type":"person|email|alias|phone|address|url|location|org|note|doc","label":"valeur exacte","conf":0.0-1.0,"sub":"contexte court"}],"edges":[{"from":"n1","to":"n2","kind":"owns|hosts|alias-of|contact|directs|registered-by|resolves-to","conf":0.0-1.0}],"timeline":[{"date":"YYYY-MM-DD","title":"événement","desc":"1 phrase","src":"outil source"}],"locations":[{"label":"Ville, PAYS","lat":0.0,"lng":0.0,"type":"person|org|weak","size":4-10}],"report":{"key":[{"k":"Sujet","v":"..."},{"k":"Entités","v":"N"},{"k":"Recoupements","v":"N"},{"k":"Confiance","v":"XX%"}],"sections":[{"h":"Résumé exécutif","body":["<p>...</p>"]},{"h":"Données collectées","body":["<ul><li>...</li></ul>"]},{"h":"Recoupements","body":["<ul><li>...</li></ul>"]},{"h":"Limites & prochaines étapes","body":["<ul><li>...</li></ul>"]}]}}

Règles strictes :
- Extraire les entités DIRECTEMENT depuis les données JSON ci-dessus (IPs, domaines, orgs, dates, noms)
- Confiance ≥ 0.8 uniquement pour les faits explicitement présents dans les données
- Confiance < 0.6 pour toute entité inférée sans preuve directe
- Si les données sont vides, produire un rapport minimal honnête (2-3 entités max depuis les indices)
- Style factuel, sobre, en français — pas d'inventions`;
}

/**
 * Synthèse minimale utilisée quand l'API Claude est indisponible.
 * Garantit que l'UI reste fonctionnelle même sans connexion internet.
 */
function fallbackSynthesis(params) {
  const v = params.inputs[0]?.value || "Sujet";
  return JSON.stringify({
    summary: `Enquête synthétique sur ${v}. Mode dégradé — relancer pour résultats complets.`,
    entities: [
      { id: "n1", type: "person", label: v,             conf: 0.7, sub: "sujet principal" },
      { id: "n2", type: "url",    label: "exemple.com", conf: 0.6, sub: "domaine lié"     },
    ],
    edges:    [{ from: "n1", to: "n2", kind: "owns", conf: 0.65 }],
    timeline: [{ date: "2024-01-01", title: "Première mention", desc: "...", src: "web.public" }],
    locations:[{ label: "Paris, FR", lat: 48.85, lng: 2.35, type: "person", size: 8 }],
    report: {
      key: [{ k:"Sujet",v }, {k:"Entités",v:"2"}, {k:"Recoupements",v:"1"}, {k:"Confiance",v:"67%"}],
      sections: [{ h: "Note", body: ["Mode dégradé — IA indisponible."] }],
    },
  });
}

/**
 * Extraction heuristique quand la réponse IA n'est pas du JSON valide.
 * Dernier recours : on expose le texte brut dans le rapport.
 */
function heuristicExtract(text, params) {
  return {
    summary:  text.slice(0, 240),
    entities: params.inputs.slice(0, 6).map((inp, i) => ({
      id: "n"+(i+1), type: inp.type, label: inp.value, conf: 0.7, sub: inp.type,
    })),
    edges: [], timeline: [], locations: [],
    report: { key: [], sections: [{ h: "Synthèse brute", body: [text] }] },
  };
}


// ─── Exports globaux ──────────────────────────────────────────────────────────
// Les fichiers JSX chargés via <script type="text/babel"> partagent le scope
// global window. On expose explicitement ce dont app.jsx a besoin.
window.FINDIUM_INV = { InvestigationView, runInvestigation };
Object.assign(window, { InvestigationView, runInvestigation });
