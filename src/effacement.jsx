// findium — Effacement (data brokers erasure feature)
const { useState: _es, useEffect: _ee, useRef: _er, useMemo: _em } = React;

// status flow: unknown -> scanning -> clean | found -> drafting -> sent -> acknowledged -> removed
function Effacement() {
  const [mode, setMode] = _es("brokers");
  const [identity, setIdentity] = _es([]);
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs"><span>workspace</span><span className="sep">/</span><span>effacement</span></div>
          <h1 className="h1">Effacement données</h1>
          <p>Scrute ton propre profil sur les data brokers et le deep web · demande des effacements (RGPD / opt-out).</p>
        </div>
      </div>

      <div className="eff-mode">
        <button className={"eff-mode__btn" + (mode==="brokers"?" eff-mode__btn--on":"")} onClick={() => setMode("brokers")}>
          <Icon n="shield" size={14}/>
          <div>
            <div className="eff-mode__t">Data brokers <span className="dim">· surface</span></div>
            <div className="eff-mode__s">Sites publics agrégeant les identités</div>
          </div>
        </button>
        <button className={"eff-mode__btn" + (mode==="deep"?" eff-mode__btn--on":"")} onClick={() => setMode("deep")}>
          <Icon n="eye" size={14}/>
          <div>
            <div className="eff-mode__t">Deep / Dark web <span className="dim">· profond</span></div>
            <div className="eff-mode__s">Fuites, pastes, forums, marketplaces .onion</div>
          </div>
        </button>
      </div>

      {mode === "brokers" && <BrokersScan identity={identity} setIdentity={setIdentity}/>}
      {mode === "deep"    && <DeepWebScan identity={identity}/>}
    </div>
  );
}

function BrokersScan({ identity, setIdentity }) {
  const { DATA_BROKERS } = window.FINDIUM;

  const [states, setStates] = _es(() => Object.fromEntries(
    DATA_BROKERS.map(b => [b.id, { status: "unknown", detected: null, requestedAt: null, removedAt: null, lastChecked: null }])
  ));

  const [filter, setFilter] = _es("all");
  const [drafting, setDrafting] = _es(null);
  const [draftPreview, setDraftPreview] = _es(null);

  const score = _em(() => {
    const found   = Object.values(states).filter(s => s.status === "found").length;
    const sent    = Object.values(states).filter(s => ["sent","acknowledged"].includes(s.status)).length;
    const removed = Object.values(states).filter(s => s.status === "removed").length;
    const clean   = Object.values(states).filter(s => s.status === "clean").length;
    const total   = DATA_BROKERS.length;
    const exposure   = Math.round(((found + sent * 0.5) / total) * 100);
    const protection = Math.round(100 - exposure);
    return { found, sent, removed, clean, total, exposure, protection };
  }, [states]);

  // Marquer manuellement un broker comme trouvé ou propre
  const markBroker = (id, status) => {
    const now = new Date().toISOString();
    setStates(s => ({ ...s, [id]: { ...s[id], status, lastChecked: now, detected: null }}));
  };

  const draftRemoval = async (broker) => {
    setDrafting(broker.id);
    setStates(s => ({ ...s, [broker.id]: { ...s[broker.id], status: "drafting" }}));
    try {
      const prompt = buildRemovalPrompt(broker, identity);
      const text = await window.claude.complete(prompt);
      setDraftPreview({ broker, text: text.trim() });
    } catch (e) {
      setDraftPreview({ broker, text: fallbackRemovalText(broker, identity) });
    } finally {
      setDrafting(null);
    }
  };

  const sendRemoval = () => {
    if (!draftPreview) return;
    const id = draftPreview.broker.id;
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    setStates(s => ({ ...s, [id]: { ...s[id], status: "sent", requestedAt: ymd }}));
    setDraftPreview(null);
  };

  const cancelDraft = () => {
    if (!draftPreview) return;
    const id = draftPreview.broker.id;
    setStates(s => ({ ...s, [id]: { ...s[id], status: s[id].detected ? "found" : "unknown" }}));
    setDraftPreview(null);
  };

  const askAll = () => {
    Object.entries(states).forEach(([id, st]) => {
      if (st.status === "found") {
        setStates(s => {
          const now = new Date();
          const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
          return { ...s, [id]: { ...s[id], status: "sent", requestedAt: ymd }};
        });
      }
    });
  };

  const [catFilter, setCatFilter] = _es("all");

  const CATEGORIES = [...new Set(DATA_BROKERS.map(b => b.category))].sort();

  const filtered = DATA_BROKERS.filter(b => {
    const statusOk = (
      filter === "all"     ? true :
      filter === "found"   ? states[b.id]?.status === "found" :
      filter === "pending" ? ["sent","acknowledged"].includes(states[b.id]?.status) :
      filter === "removed" ? states[b.id]?.status === "removed" :
      filter === "clean"   ? states[b.id]?.status === "clean" :
      filter === "unknown" ? states[b.id]?.status === "unknown" : true
    );
    const catOk = catFilter === "all" || b.category === catFilter;
    return statusOk && catOk;
  });

  return (
    <>
      <div className="brokers-actions">
        <div style={{fontSize:11,color:"var(--fg-3)",display:"flex",alignItems:"center",gap:6}}>
          <Icon n="info" size={12}/>
          Vérification manuelle — visite chaque site et marque le résultat
        </div>
        <button className="btn btn--ghost" onClick={askAll} disabled={score.found === 0}>
          <Icon n="bolt" size={14}/> Demander tout ({score.found})
        </button>
      </div>

      <div className="exp-hero">
        <div className="exp-hero__main">
          <div className="exp-hero__lbl">Score de protection</div>
          <div className="exp-hero__big">
            <span className="exp-hero__val" style={{color: score.protection > 70 ? "var(--accent)" : score.protection > 40 ? "var(--warn)" : "var(--err)"}}>
              {score.protection}
            </span>
            <span className="exp-hero__unit">/ 100</span>
          </div>
          <div className="exp-hero__sub">
            {score.protection > 70 ? "Bon niveau — quelques fuites résiduelles à traiter."
             : score.protection > 40 ? "Niveau moyen — plusieurs brokers exposent encore tes données."
             : "Niveau faible — données très exposées, action requise."}
          </div>
          <ExposureBar score={score}/>
        </div>
        <div className="exp-hero__split">
          <div className="exp-stat">
            <div className="exp-stat__v" style={{color:"var(--err)"}}>{score.found}</div>
            <div className="exp-stat__l">détectés</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat__v" style={{color:"var(--warn)"}}>{score.sent}</div>
            <div className="exp-stat__l">en cours</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat__v" style={{color:"var(--accent)"}}>{score.removed}</div>
            <div className="exp-stat__l">effacés</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat__v">{score.clean}</div>
            <div className="exp-stat__l">propres</div>
          </div>
        </div>
      </div>

      <div className="section-h" style={{marginTop:28}}>
        <h2 className="h2">Identité à protéger</h2>
        <span className="mute">{identity.length} éléments</span>
      </div>
      <IdentityEditor identity={identity} setIdentity={setIdentity}/>

      <div className="section-h">
        <h2 className="h2">Data brokers</h2>
        <span className="mute">{filtered.length} / {DATA_BROKERS.length}</span>
        <div className="layout-switch">
          {[
            { k:"all",     l:"Tous" },
            { k:"found",   l:"Détectés" },
            { k:"pending", l:"En cours" },
            { k:"removed", l:"Effacés" },
            { k:"clean",   l:"Propres" },
            { k:"unknown", l:"Non vérifiés" },
          ].map(f => (
            <button key={f.k} data-on={filter===f.k?"1":"0"} onClick={() => setFilter(f.k)}>{f.l}</button>
          ))}
        </div>
      </div>
      {/* Filtre par catégorie */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
        <button className="btn btn--ghost btn--sm" data-on={catFilter==="all"?"1":"0"}
          style={{fontSize:11}} onClick={() => setCatFilter("all")}>Toutes catégories</button>
        {CATEGORIES.map(c => (
          <button key={c} className="btn btn--ghost btn--sm" data-on={catFilter===c?"1":"0"}
            style={{fontSize:11}} onClick={() => setCatFilter(c)}>{c}</button>
        ))}
      </div>

      <div className="broker-list">
        {filtered.map(b => (
          <BrokerRow
            key={b.id}
            broker={b}
            state={states[b.id]}
            onDraft={() => draftRemoval(b)}
            drafting={drafting === b.id}
            onMark={(status) => markBroker(b.id, status)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="empty">
            <div className="glyph"><Icon n="shield" size={26}/></div>
            <h3>Rien à afficher</h3>
            <p>Aucun broker dans cette catégorie pour l'instant.</p>
          </div>
        )}
      </div>

      {draftPreview && (
        <DraftModal preview={draftPreview} identity={identity} onSend={sendRemoval} onCancel={cancelDraft}/>
      )}
    </>
  );
}

function ExposureBar({ score }) {
  const total = score.total;
  return (
    <div className="exp-bar">
      <div className="exp-bar__seg exp-bar__seg--found"   style={{flex: score.found    || 0.001}} title={`${score.found} détectés`}/>
      <div className="exp-bar__seg exp-bar__seg--sent"    style={{flex: score.sent     || 0.001}} title={`${score.sent} en cours`}/>
      <div className="exp-bar__seg exp-bar__seg--removed" style={{flex: score.removed  || 0.001}} title={`${score.removed} effacés`}/>
      <div className="exp-bar__seg exp-bar__seg--clean"   style={{flex: score.clean    || 0.001}} title={`${score.clean} propres`}/>
      <div className="exp-bar__seg exp-bar__seg--unknown" style={{flex: (total - score.found - score.sent - score.removed - score.clean) || 0.001}} title={`non scannés`}/>
    </div>
  );
}

function IdentityEditor({ identity, setIdentity }) {
  const { INPUT_TYPES } = window.FINDIUM;
  const [adding, setAdding] = _es(false);
  const [newType, setNewType] = _es("name");
  const [newVal, setNewVal] = _es("");

  const remove = (i) => setIdentity(identity.filter((_, j) => j !== i));
  const add = () => {
    if (!newVal.trim()) return;
    setIdentity([...identity, { type: newType, value: newVal.trim() }]);
    setNewVal(""); setAdding(false);
  };

  return (
    <div className="card" style={{marginBottom:24}}>
      <div className="identity-grid">
        {identity.map((it, i) => (
          <div key={i} className="identity-chip">
            <span className="identity-chip__ico">{typeIcon(it.type)}</span>
            <div>
              <div className="identity-chip__t">{it.value}</div>
              <div className="identity-chip__s">{it.type}</div>
            </div>
            <button className="del-btn" onClick={() => remove(i)} style={{width:24,height:24,fontSize:12}}>×</button>
          </div>
        ))}

        {!adding && (
          <button className="identity-chip identity-chip--plus" onClick={() => setAdding(true)}>
            <Icon n="plus" size={14}/> Ajouter
          </button>
        )}
      </div>

      {adding && (
        <div className="identity-add">
          <div className="identity-add__head">
            <Icon n="plus" size={12}/> Nouvel élément à protéger
          </div>
          <div className="identity-add__row">
            <div className="field" style={{width:200,flexShrink:0}}>
              <label className="field__label">Type</label>
              <select className="select" value={newType} onChange={e => setNewType(e.target.value)}>
                {INPUT_TYPES.filter(t => !["note","doc"].includes(t.id)).map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{flex:1,minWidth:0}}>
              <label className="field__label">Valeur</label>
              <input className="input mono" autoFocus value={newVal} onChange={e => setNewVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setNewVal(""); } }}
                placeholder={(INPUT_TYPES.find(t => t.id === newType) || {}).placeholder || "..."} />
            </div>
            <div className="identity-add__actions">
              <button className="btn btn--ghost" onClick={() => { setAdding(false); setNewVal(""); }}>
                <Icon n="x" size={12}/> Annuler
              </button>
              <button className="btn btn--primary" onClick={add} disabled={!newVal.trim()}>
                <Icon n="check" size={12}/> Ajouter
              </button>
            </div>
          </div>
          <div className="dim" style={{fontSize:11,marginTop:10,display:"flex",alignItems:"center",gap:6}}>
            <kbd className="kbd">Enter</kbd> pour valider · <kbd className="kbd">Esc</kbd> pour annuler
          </div>
        </div>
      )}

      <div className="dim" style={{fontSize:11,marginTop:14,display:"flex",alignItems:"center",gap:8}}>
        <Icon n="shield" size={12}/> Ces données ne sont jamais transmises aux brokers — elles servent à identifier ton profil dans leurs index.
      </div>
    </div>
  );
}

function BrokerRow({ broker, state, onDraft, drafting, onMark }) {
  const st = state?.status || "unknown";
  const meta = STATUS_META[st] || STATUS_META.unknown;
  return (
    <div className="broker-row" data-st={st}>
      <div className="broker-row__head">
        <div className="broker-row__country">{broker.country}</div>
        <div>
          <div className="broker-row__name">{broker.name}</div>
          <div className="broker-row__cat">
            <span className="tag" style={{fontSize:10}}>{broker.category}</span>
            {broker.gdpr && <span className="tag tag--info" style={{fontSize:10}}>RGPD</span>}
            <span className="dim" style={{fontSize:11,fontFamily:"var(--font-mono)"}}>~{broker.avgDays}j de traitement</span>
          </div>
        </div>
      </div>

      <div className="broker-row__body">
        <div className="broker-row__methodology dim">
          {broker.methodology}
          {broker.email && (
            <span className="mono" style={{marginLeft:8,opacity:0.6,fontSize:10}}>· {broker.email}</span>
          )}
        </div>
        {state?.detected && (
          <div className="broker-row__detected">
            <span className="mute" style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase"}}>Détecté:</span>
            {state.detected.map((d, i) => (
              <span key={i} className="broker-detect">
                <span className="broker-detect__ico">{typeIcon(d.type)}</span>
                <span className="mono" style={{fontSize:11}}>{d.value}</span>
              </span>
            ))}
          </div>
        )}
        {state?.requestedAt && (
          <div className="broker-row__timing dim">
            <Icon n="bolt" size={11}/> Demande envoyée le <b>{state.requestedAt}</b> · échéance estimée <b>{addDays(state.requestedAt, broker.avgDays)}</b>
          </div>
        )}
        {state?.removedAt && (
          <div className="broker-row__timing acc">
            <Icon n="check" size={11}/> Données effacées le <b>{state.removedAt}</b>
          </div>
        )}
      </div>

      <div className="broker-row__right">
        <span className={"tag " + meta.tag}><span className="dot"></span>{meta.label}</span>

        {/* Vérification manuelle : marquer trouvé / propre */}
        {(st === "unknown") && (
          <>
            <button className="btn btn--ghost btn--sm" style={{color:"var(--err)",borderColor:"var(--err)"}}
              onClick={() => onMark("found")} title="Marquer : mes données sont présentes">
              <Icon n="alert" size={11}/> Trouvé
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => onMark("clean")} title="Marquer : non présent">
              <Icon n="check" size={11}/> Propre
            </button>
          </>
        )}

        {/* Opt-out direct si URL disponible */}
        {broker.optOutUrl && (
          <button className="btn btn--ghost btn--sm" title={broker.optOutUrl}
            onClick={() => window.findium?.shell?.openExternal(broker.optOutUrl)}>
            <Icon n="link" size={11}/> Opt-out
          </button>
        )}

        {st === "found" && (
          <button className="btn btn--primary btn--sm" onClick={onDraft} disabled={drafting}>
            {drafting ? "Rédaction…" : "Demander effacement"}
          </button>
        )}
        {(st === "found" || st === "clean") && (
          <button className="btn btn--ghost btn--sm" style={{fontSize:10,opacity:0.6}}
            onClick={() => onMark("unknown")}>↩</button>
        )}
        {st === "sent" && (
          <button className="btn btn--ghost btn--sm">Voir demande</button>
        )}
        {st === "removed" && (
          <button className="btn btn--ghost btn--sm">Certificat</button>
        )}
      </div>
    </div>
  );
}

function DraftModal({ preview, identity = [], onSend, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="modal__sub">Demande d'effacement · brouillon généré par l'IA</div>
            <div className="modal__title">{preview.broker.name} <span className="dim" style={{fontSize:13}}>· {preview.broker.country}</span></div>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onCancel}><Icon n="x" size={14}/></button>
        </div>
        <div className="modal__body">
          <div className="modal__meta">
            <span><b>À :</b> {preview.broker.email || `dpo@${preview.broker.name.toLowerCase().replace(/\s+/g,"").replace(/\.[a-z]+$/,"")}.com`}</span>
            <span><b>De :</b> {identity?.find?.(i => i.type === "email")?.value || "—"}</span>
            <span><b>Objet :</b> Demande d'effacement · {preview.broker.gdpr ? "RGPD Art. 17" : "Opt-out"}</span>
          </div>
          <pre className="modal__textarea">{preview.text}</pre>
        </div>
        <div className="modal__foot">
          <div className="dim" style={{fontSize:11,display:"flex",alignItems:"center",gap:8}}>
            <Icon n="shield" size={12}/> La demande sera envoyée depuis <span className="mono">noreply@findium.eu</span> en ton nom.
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn--ghost" onClick={onCancel}>Annuler</button>
            <button className="btn btn--primary" onClick={onSend}>
              <Icon n="bolt" size={12}/> Envoyer la demande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// helpers
// ============================================================
const STATUS_META = {
  unknown:       { label: "NON VÉRIFIÉ",     tag: ""           },
  clean:         { label: "PROPRE",          tag: "tag--ok"    },
  found:         { label: "DÉTECTÉ",         tag: "tag--err"   },
  drafting:      { label: "RÉDACTION…",      tag: "tag--warn"  },
  sent:          { label: "DEMANDE ENVOYÉE", tag: "tag--warn"  },
  acknowledged:  { label: "ACCUSÉ REÇU",     tag: "tag--info"  },
  removed:       { label: "EFFACÉ",          tag: "tag--ok"    },
};


function addDays(ymd, n) {
  const d = new Date(ymd);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function buildRemovalPrompt(broker, identity) {
  const lines = identity.map(i => `- [${i.type}] ${i.value}`).join("\n");
  const legalRef = broker.gdpr
    ? "GDPR Article 17 (Right to Erasure) — the broker is subject to EU data protection law"
    : "applicable opt-out regulations including the California Consumer Privacy Act (CCPA) where relevant";
  return `You are a legal assistant specializing in personal data protection.
Write a short, polite but FIRM email requesting the complete erasure of a user's personal data from a data broker.

Broker: ${broker.name} (${broker.country})
Legal basis: ${legalRef}
Category: ${broker.category}

User identity to be erased:
${lines}

Requirements:
- Write entirely in English — no French, no other language
- Plain email format — no markdown, no "Subject:" header (handled separately)
- Open with "Dear Data Protection Officer," or "To Whom It May Concern,"
- Include: legal reference, explicit list of data to erase, request for written confirmation within 30 days, mention that failure to comply will be reported to the relevant supervisory authority
- 150–220 words maximum
- No bold / markdown
- Close with "Sincerely," followed by the name from the first identity item of type 'name'

Return ONLY the email body text, nothing else.`;
}

function fallbackRemovalText(broker, identity) {
  const name = identity.find(i => i.type === "name")?.value || "[Your Name]";
  const lines = identity.map(i => `  · [${i.type}] ${i.value}`).join("\n");
  const legalClause = broker.gdpr
    ? `This request is made pursuant to Article 17 of the General Data Protection Regulation (GDPR — Regulation (EU) 2016/679), which grants data subjects the right to erasure ("right to be forgotten"). Please be aware that non-compliance may be reported to the competent supervisory authority under Article 77 of the GDPR.`
    : `This request is made pursuant to applicable privacy regulations, including the California Consumer Privacy Act (CCPA) where relevant, as well as ${broker.name}'s own opt-out policies. Non-compliance may be reported to the Federal Trade Commission and the appropriate state attorney general.`;
  return `Dear Data Protection Officer,

I am writing to formally request the complete and permanent erasure of all personal data that ${broker.name} holds, processes, or distributes concerning me.

The data to be erased includes, but is not limited to:
${lines}

This request covers all of your databases, backups, sub-processors, and any partner sites that re-publish your content.

${legalClause}

Please confirm in writing, within 30 days, that all the above data has been permanently deleted and that all third-party recipients have been notified of this erasure.

Sincerely,
${name}`;
}

// ============================================================
// DEEP / DARK WEB SCAN
// ============================================================
function DeepWebScan({ identity = [] }) {
  const [findings, setFindings] = _es(() => DEFAULT_DEEPWEB_FINDINGS);
  const [monitor, setMonitor] = _es(true);
  const [filter, setFilter] = _es("all");
  const [selectedFinding, setSelectedFinding] = _es(null);

  const counts = _em(() => ({
    total:    findings.length,
    critical: findings.filter(f => f.severity === "critical").length,
    high:     findings.filter(f => f.severity === "high").length,
    breaches: findings.filter(f => f.kind === "breach").length,
    pastes:   findings.filter(f => f.kind === "paste").length,
    forums:   findings.filter(f => f.kind === "forum").length,
    markets:  findings.filter(f => f.kind === "market").length,
    telegram: findings.filter(f => f.kind === "telegram").length,
    handled:  findings.filter(f => f.handled).length,
  }), [findings]);


  const filtered = findings.filter(f =>
    filter === "all" ? true
    : filter === "open" ? !f.handled
    : filter === "handled" ? f.handled
    : f.kind === filter);

  const markHandled = (id) => setFindings(fs => fs.map(f => f.id === id ? { ...f, handled: !f.handled } : f));

  return (
    <>
      <div className="brokers-actions">
        <span className="toggle" data-on={monitor?"1":"0"} onClick={() => setMonitor(!monitor)} style={{marginRight:4}}>
          <span className="toggle__sw"></span>
          <span className="dim" style={{fontSize:12}}>Monitoring continu</span>
        </span>
        <div style={{fontSize:11,color:"var(--fg-3)",display:"flex",alignItems:"center",gap:6}}>
          <Icon n="info" size={12}/>
          Scan deep/dark web nécessite HIBP API ou un service Tor externe
        </div>
      </div>

      <div className="deep-hero">
        <div className="deep-radar">
          <svg viewBox="0 0 240 240" className="radar-svg">
            <defs>
              <radialGradient id="radar-grad">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25"/>
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0"/>
              </radialGradient>
              <linearGradient id="radar-sweep" x1="0" x2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0"/>
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0.7"/>
              </linearGradient>
            </defs>
            <circle cx="120" cy="120" r="115" fill="url(#radar-grad)"/>
            <circle cx="120" cy="120" r="115" fill="none" stroke="var(--accent-line)" strokeWidth="1"/>
            <circle cx="120" cy="120" r="85"  fill="none" stroke="var(--accent-line)" strokeWidth="0.5"/>
            <circle cx="120" cy="120" r="55"  fill="none" stroke="var(--accent-line)" strokeWidth="0.5"/>
            <circle cx="120" cy="120" r="25"  fill="none" stroke="var(--accent-line)" strokeWidth="0.5"/>
            <line x1="120" y1="5"  x2="120" y2="235" stroke="var(--accent-line)" strokeWidth="0.5"/>
            <line x1="5"  y1="120" x2="235" y2="120" stroke="var(--accent-line)" strokeWidth="0.5"/>
            <line x1="33"  y1="33"  x2="207" y2="207" stroke="var(--accent-line)" strokeWidth="0.4" strokeDasharray="2 4"/>
            <line x1="207" y1="33"  x2="33"  y2="207" stroke="var(--accent-line)" strokeWidth="0.4" strokeDasharray="2 4"/>

            <g className={"radar-sweep" + (monitor ? " radar-sweep--on" : "")} style={{transformOrigin:"120px 120px"}}>
              <path d="M120,120 L120,5 A115,115 0 0,1 220,75 Z" fill="url(#radar-sweep)" opacity="0.7"/>
              <line x1="120" y1="120" x2="120" y2="5" stroke="var(--accent)" strokeWidth="1.5"/>
            </g>

            {DEEPWEB_ZONES.map((z, i) => {
              const angle = (i / DEEPWEB_ZONES.length) * Math.PI * 2 - Math.PI / 2;
              const r = 50 + (i % 3) * 28;
              const x = 120 + Math.cos(angle) * r;
              const y = 120 + Math.sin(angle) * r;
              const hit = findings.some(f => f.zone === z.id && !f.handled);
              const active = false;
              return (
                <g key={z.id} transform={`translate(${x}, ${y})`}>
                  <circle r={active ? 6 : 4} fill={hit ? "var(--err)" : "var(--accent)"} opacity={active ? 1 : 0.7} style={{transition:"all 0.3s"}}/>
                  {(active || hit) && (
                    <circle r="8" fill="none" stroke={hit ? "var(--err)" : "var(--accent)"} strokeWidth="0.5" opacity="0.6">
                      <animate attributeName="r" values="6;14;6" dur="1.6s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite"/>
                    </circle>
                  )}
                </g>
              );
            })}

            <text x="120" y="125" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--fg-3)">scope</text>
          </svg>
          <div className="deep-radar__caption">
            <div className="dim mono" style={{fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase"}}>
              {monitor ? "MONITORING ACTIF" : "MONITORING INACTIF"}
            </div>
            <div className="acc mono" style={{fontSize:11,marginTop:4}}>
              {DEEPWEB_ZONES.length} zones surveillées
            </div>
          </div>
        </div>

        <div className="deep-metrics">
          <div className="deep-metric deep-metric--err">
            <div className="deep-metric__v">{counts.critical}</div>
            <div className="deep-metric__l">Critique</div>
          </div>
          <div className="deep-metric deep-metric--warn">
            <div className="deep-metric__v">{counts.high}</div>
            <div className="deep-metric__l">Élevée</div>
          </div>
          <div className="deep-metric">
            <div className="deep-metric__v">{counts.breaches}</div>
            <div className="deep-metric__l">Fuites</div>
          </div>
          <div className="deep-metric">
            <div className="deep-metric__v">{counts.pastes}</div>
            <div className="deep-metric__l">Pastes</div>
          </div>
          <div className="deep-metric">
            <div className="deep-metric__v">{counts.forums + counts.telegram}</div>
            <div className="deep-metric__l">Forums / TG</div>
          </div>
          <div className="deep-metric">
            <div className="deep-metric__v">{counts.markets}</div>
            <div className="deep-metric__l">Markets</div>
          </div>
          <div className="deep-metric deep-metric--full">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14}}>
              <div>
                <div className="dim" style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase"}}>Dernier scan</div>
                <div className="mono" style={{fontSize:12,marginTop:4,color:"var(--fg)"}}>2026-05-23 · 04:12 UTC</div>
              </div>
              <div>
                <div className="dim" style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase"}}>Prochain</div>
                <div className="mono" style={{fontSize:12,marginTop:4,color:"var(--accent)"}}>dans 5h 48min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-h">
        <h2 className="h2">Détections deep web</h2>
        <span className="mute">{filtered.length} / {findings.length}</span>
        <div className="layout-switch">
          {[
            { k:"all",      l:"Toutes" },
            { k:"breach",   l:"Fuites" },
            { k:"paste",    l:"Pastes" },
            { k:"forum",    l:"Forums" },
            { k:"telegram", l:"Telegram" },
            { k:"market",   l:"Markets" },
            { k:"open",     l:"À traiter" },
            { k:"handled",  l:"Traitées" },
          ].map(f => (
            <button key={f.k} data-on={filter===f.k?"1":"0"} onClick={() => setFilter(f.k)}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="deep-list">
        {filtered.map(f => (
          <DeepFinding key={f.id} finding={f} onOpen={() => setSelectedFinding(f)} onToggle={() => markHandled(f.id)}/>
        ))}
        {filtered.length === 0 && (
          <div className="empty">
            <div className="glyph"><Icon n="shield" size={26}/></div>
            <h3>Aucune détection</h3>
            <p>Aucune fuite ne correspond à ce filtre.</p>
          </div>
        )}
      </div>

      {selectedFinding && <DeepFindingModal finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onToggle={() => { markHandled(selectedFinding.id); setSelectedFinding(null); }}/>}
    </>
  );
}

function DeepFinding({ finding, onOpen, onToggle }) {
  const meta = KIND_META[finding.kind] || KIND_META.breach;
  const sev = SEVERITY_META[finding.severity];
  return (
    <div className="deep-row" data-handled={finding.handled ? "1" : "0"} onClick={onOpen}>
      <div className="deep-row__ico" style={{color: meta.color}}>
        <Icon n={meta.icon} size={16}/>
      </div>
      <div style={{minWidth:0}}>
        <div className="deep-row__top">
          <span className="deep-row__source mono">{finding.source}</span>
          <span className="tag" style={{fontSize:10}}>{meta.label}</span>
          <span className={"tag " + sev.tag} style={{fontSize:10}}><span className="dot"></span>{sev.label}</span>
        </div>
        <div className="deep-row__title">{finding.title}</div>
        <div className="deep-row__meta">
          <span><Icon n="globe" size={10}/> {finding.zone}</span>
          <span><Icon n="pulse" size={10}/> détecté {finding.detectedAt}</span>
          {finding.records && <span><Icon n="folder" size={10}/> {finding.records.toLocaleString()} entrées</span>}
        </div>
        <div className="deep-row__preview">
          {finding.fields.map((fld, i) => (
            <span key={i} className="deep-field" data-leaked={fld.leaked ? "1" : "0"}>
              <span className="deep-field__ico">{typeIcon(fld.type)}</span>
              <span className="mono">{fld.preview}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="deep-row__right" onClick={e => e.stopPropagation()}>
        <button className="btn btn--ghost btn--sm" onClick={onToggle}>
          {finding.handled ? <><Icon n="x" size={12}/> Réouvrir</> : <><Icon n="check" size={12}/> Traité</>}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onOpen}>Détails</button>
      </div>
    </div>
  );
}

function DeepFindingModal({ finding, onClose, onToggle }) {
  const meta = KIND_META[finding.kind] || KIND_META.breach;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="modal__sub" style={{color: meta.color}}>{meta.label} · {finding.zone}</div>
            <div className="modal__title">{finding.title}</div>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon n="x" size={14}/></button>
        </div>
        <div className="modal__body">
          <div className="modal__meta">
            <span><b>Source :</b> <span className="acc">{finding.source}</span></span>
            <span><b>Détecté :</b> {finding.detectedAt}</span>
            <span><b>Sévérité :</b> <span className={SEVERITY_META[finding.severity].cls}>{SEVERITY_META[finding.severity].label}</span></span>
            {finding.records && <span><b>Volume :</b> {finding.records.toLocaleString()} enregistrements</span>}
            {finding.url && <span><b>URL :</b> <span className="mono dim">{finding.url}</span></span>}
          </div>

          <h3 style={{color:"var(--fg)",fontSize:13,fontWeight:600,margin:"4px 0 8px",textTransform:"none",letterSpacing:0}}>Description</h3>
          <p style={{color:"var(--fg-1)",fontSize:13,lineHeight:1.6,margin:"0 0 16px"}}>{finding.description}</p>

          <h3 style={{color:"var(--fg)",fontSize:13,fontWeight:600,margin:"4px 0 8px",textTransform:"none",letterSpacing:0}}>Données concernées ({finding.fields.length})</h3>
          <div className="deep-fields-detail">
            {finding.fields.map((fld, i) => (
              <div key={i} className="deep-field-row">
                <span className="deep-field__ico">{typeIcon(fld.type)}</span>
                <div>
                  <div className="dim" style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em"}}>{fld.type}</div>
                  <div className="mono" style={{fontSize:13,color:"var(--fg)"}}>{fld.preview}</div>
                </div>
                <span className={fld.leaked ? "err mono" : "acc mono"} style={{fontSize:11,marginLeft:"auto"}}>
                  {fld.leaked ? "EXPOSÉ" : "PARTIEL"}
                </span>
              </div>
            ))}
          </div>

          <h3 style={{color:"var(--fg)",fontSize:13,fontWeight:600,margin:"20px 0 8px",textTransform:"none",letterSpacing:0}}>Actions recommandées</h3>
          <ul style={{margin:0,paddingLeft:18,color:"var(--fg-1)",fontSize:13,lineHeight:1.7}}>
            {finding.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
        <div className="modal__foot">
          <div className="dim" style={{fontSize:11,display:"flex",alignItems:"center",gap:8}}>
            <Icon n="shield" size={12}/> Données détectées via relais .onion · jamais stockées en clair.
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn--ghost" onClick={onClose}>Fermer</button>
            <button className="btn btn--primary" onClick={onToggle}>
              <Icon n="check" size={12}/> {finding.handled ? "Réouvrir" : "Marquer traité"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Deep web data ----------
const DEEPWEB_ZONES = [
  { id:"breach-idx",  label:"breach indices · pwned-style" },
  { id:"paste-sites", label:"paste sites · pastebin / ghostbin" },
  { id:"combo-lists", label:"combo lists · credential dumps" },
  { id:"dark-forum",  label:"forums .onion · raidforum-style" },
  { id:"tg-chans",    label:"channels telegram · leaks fr/ru" },
  { id:"discord",     label:"discords privés · doxxing rings" },
  { id:"market-onion",label:"marketplaces .onion · PII for sale" },
  { id:"i2p",         label:"sites i2p · réseaux alternatifs" },
];

const KIND_META = {
  breach:   { label:"FUITE",       icon:"alert", color:"var(--err)" },
  paste:    { label:"PASTE",       icon:"file",  color:"var(--warn)" },
  forum:    { label:"FORUM",       icon:"eye",   color:"var(--info)" },
  telegram: { label:"TELEGRAM",    icon:"bell",  color:"var(--info)" },
  market:   { label:"MARKETPLACE", icon:"tag",   color:"var(--err)" },
  combo:    { label:"COMBO LIST",  icon:"key",   color:"var(--warn)" },
  i2p:      { label:"I2P",         icon:"globe", color:"var(--violet)" },
};
const SEVERITY_META = {
  critical: { label:"CRITIQUE", tag:"tag--err",  cls:"err" },
  high:     { label:"ÉLEVÉE",   tag:"tag--err",  cls:"err" },
  medium:   { label:"MOYENNE",  tag:"tag--warn", cls:"warn" },
  low:      { label:"FAIBLE",   tag:"tag--info", cls:"info" },
};

// Données de démonstration archivées dans src/demo-data.jsx
const DEFAULT_DEEPWEB_FINDINGS = [];
const _UNUSED_DEEPWEB = [
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


window.FINDIUM_EFFACEMENT = { Effacement };
Object.assign(window, { Effacement });
