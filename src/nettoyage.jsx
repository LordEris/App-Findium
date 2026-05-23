// findium — Nettoyage PC (inspiré de daniilsys/cleanapp)
// Source : https://github.com/daniilsys/cleanapp
//
// Détecte les dossiers orphelins dans %APPDATA% et %LOCALAPPDATA%
// en croisant avec les apps installées lues depuis le registre Windows.
// Algorithme de confiance identique à cleanapp (âge, taille, correspondance de nom).

const { useState: _nws, useEffect: _nwe, useMemo: _nwm } = React;

function Nettoyage() {
  const [phase, setPhase] = _nws("idle");   // idle | scanning | done | error
  const [entries, setEntries] = _nws([]);
  const [selected, setSelected] = _nws(new Set());
  const [filter, setFilter] = _nws("all");
  const [deleting, setDeleting] = _nws(false);
  const [confirm, setConfirm] = _nws(false);
  const [result, setResult] = _nws(null);
  const [error, setError] = _nws(null);

  const scan = async () => {
    setPhase("scanning");
    setEntries([]);
    setSelected(new Set());
    setResult(null);
    setError(null);
    try {
      const items = await window.findium.cleaner.scan();
      setEntries(items);
      setPhase("done");
      // Pré-sélectionne les orphelins haute confiance (≥ 75 %)
      setSelected(new Set(items.filter(e => e.confidence >= 75).map(e => e.path)));
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  };

  const toggleSelect = (p) => setSelected(s => {
    const n = new Set(s);
    n.has(p) ? n.delete(p) : n.add(p);
    return n;
  });

  const toggleAll = () => {
    const paths = filtered.map(e => e.path);
    const allOn = paths.every(p => selected.has(p));
    setSelected(s => {
      const n = new Set(s);
      allOn ? paths.forEach(p => n.delete(p)) : paths.forEach(p => n.add(p));
      return n;
    });
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await window.findium.cleaner.delete([...selected]);
      setResult(res);
      const gone = new Set(res.deleted);
      setEntries(prev => prev.filter(x => !gone.has(x.path)));
      setSelected(new Set());
      setConfirm(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const stats = _nwm(() => {
    const totalSize = entries.reduce((s, e) => s + e.size, 0);
    const selSize   = entries.filter(e => selected.has(e.path)).reduce((s, e) => s + e.size, 0);
    return {
      total:    entries.length,
      high:     entries.filter(e => e.confidence >= 75).length,
      med:      entries.filter(e => e.confidence >= 50 && e.confidence < 75).length,
      totalSize,
      selSize,
    };
  }, [entries, selected]);

  const filtered = _nwm(() => {
    switch (filter) {
      case "high":     return entries.filter(e => e.confidence >= 75);
      case "med":      return entries.filter(e => e.confidence >= 50 && e.confidence < 75);
      case "selected": return entries.filter(e => selected.has(e.path));
      default:         return entries;
    }
  }, [entries, filter, selected]);

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <div className="crumbs"><span>workspace</span><span className="sep">/</span><span>nettoyage</span></div>
          <h1 className="h1">Nettoyage PC</h1>
          <p>
            Détecte les dossiers orphelins laissés par des applications désinstallées dans{" "}
            <span className="mono">%APPDATA%</span> et <span className="mono">%LOCALAPPDATA%</span> ·
            libère de l'espace en toute sécurité.
          </p>
        </div>
        <div className="page__actions">
          <button className="btn btn--primary" onClick={scan} disabled={phase === "scanning"}>
            {phase === "scanning"
              ? <><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>&nbsp;Analyse…</>
              : <><Icon n="search" size={14}/> Lancer le scan</>}
          </button>
        </div>
      </div>

      {/* ── Idle ──────────────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div className="empty" style={{marginTop:60}}>
          <div className="glyph"><Icon n="trash" size={32}/></div>
          <h3>Prêt à analyser</h3>
          <p>
            Clique sur <b>Lancer le scan</b> pour détecter automatiquement les dossiers orphelins.<br/>
            Le scan lit le registre Windows pour connaître les apps installées,<br/>
            puis compare avec les dossiers présents dans AppData.
          </p>
          <p className="dim" style={{fontSize:11,marginTop:12}}>
            Inspiré de{" "}
            <a href="#" onClick={e => { e.preventDefault(); window.findium?.shell?.openExternal("https://github.com/daniilsys/cleanapp"); }}
              style={{color:"var(--accent)"}}>daniilsys/cleanapp</a>
            {" "}· les données ne quittent jamais ta machine.
          </p>
        </div>
      )}

      {/* ── Scanning ──────────────────────────────────────────────────────── */}
      {phase === "scanning" && (
        <div className="empty" style={{marginTop:60}}>
          <div className="glyph mono" style={{fontSize:40,animation:"spin 1.2s linear infinite",color:"var(--accent)"}}>⟳</div>
          <h3>Analyse en cours…</h3>
          <p>Lecture du registre Windows · scan <span className="mono">%APPDATA%</span> / <span className="mono">%LOCALAPPDATA%</span></p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="empty" style={{marginTop:40}}>
          <div className="glyph" style={{color:"var(--err)"}}>⚠</div>
          <h3>Erreur de scan</h3>
          <p className="mono" style={{fontSize:12,color:"var(--err)"}}>{error}</p>
          <button className="btn btn--ghost" style={{marginTop:16}} onClick={scan}>Réessayer</button>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {phase === "done" && (
        <>
          {/* Bandeau de succès post-suppression */}
          {result && (
            <div className="card" style={{
              marginBottom:16,display:"flex",gap:16,alignItems:"center",
              padding:"12px 20px",background:"var(--accent-mute)",border:"1px solid var(--accent-line)"
            }}>
              <Icon n="check" size={16}/>
              <span>
                <b style={{color:"var(--accent)"}}>
                  {result.deleted.length} dossier{result.deleted.length > 1 ? "s" : ""} supprimé{result.deleted.length > 1 ? "s" : ""}
                </b>
                <span className="dim" style={{marginLeft:8,fontSize:12}}>
                  · {fmtSize(entries.reduce((s,e)=>s+e.size,0))} encore analysable{entries.length > 1 ? "s" : ""}
                </span>
                {result.errors.length > 0 && (
                  <span style={{marginLeft:12,color:"var(--err)",fontSize:12}}>
                    {result.errors.length} erreur{result.errors.length > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Dashboard stats */}
          <div className="exp-hero" style={{marginBottom:24}}>
            <div className="exp-hero__main">
              <div className="exp-hero__lbl">Orphelins détectés</div>
              <div className="exp-hero__big">
                <span className="exp-hero__val"
                  style={{color: stats.high > 0 ? "var(--warn)" : "var(--accent)"}}>
                  {stats.total}
                </span>
                <span className="exp-hero__unit">dossiers</span>
              </div>
              <div className="exp-hero__sub">
                ~{fmtSize(stats.totalSize)} total ·{" "}
                {stats.high} haute confiance · {stats.med} moyenne
              </div>
            </div>
            <div className="exp-hero__split">
              <div className="exp-stat">
                <div className="exp-stat__v" style={{color:"var(--err)"}}>{stats.high}</div>
                <div className="exp-stat__l">haute conf.</div>
              </div>
              <div className="exp-stat">
                <div className="exp-stat__v" style={{color:"var(--warn)"}}>{stats.med}</div>
                <div className="exp-stat__l">moyenne conf.</div>
              </div>
              <div className="exp-stat">
                <div className="exp-stat__v">{selected.size}</div>
                <div className="exp-stat__l">sélectionnés</div>
              </div>
              <div className="exp-stat">
                <div className="exp-stat__v" style={{color:"var(--accent)"}}>
                  {fmtSize(stats.selSize)}
                </div>
                <div className="exp-stat__l">à libérer</div>
              </div>
            </div>
          </div>

          {/* Filtres + actions */}
          <div className="brokers-actions">
            <div className="layout-switch">
              {[
                { k:"all",      l:"Tous" },
                { k:"high",     l:"Haute conf." },
                { k:"med",      l:"Moyenne" },
                { k:"selected", l:`Sélectionnés (${selected.size})` },
              ].map(f => (
                <button key={f.k} data-on={filter===f.k?"1":"0"} onClick={() => setFilter(f.k)}>
                  {f.l}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn--ghost btn--sm" onClick={toggleAll}>
                {filtered.length > 0 && filtered.every(e => selected.has(e.path))
                  ? "Désélectionner tout" : "Tout sélectionner"}
              </button>
              <button
                className="btn btn--sm"
                onClick={() => setConfirm(true)}
                disabled={selected.size === 0}
                style={{background:"var(--err)",borderColor:"var(--err)",color:"#fff",
                  opacity: selected.size === 0 ? 0.4 : 1}}>
                <Icon n="trash" size={12}/> Supprimer ({selected.size})
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="broker-list">
            {filtered.map(e => (
              <CleanerRow
                key={e.path}
                entry={e}
                checked={selected.has(e.path)}
                onToggle={() => toggleSelect(e.path)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="empty">
                <div className="glyph"><Icon n="check" size={26}/></div>
                <h3>Aucun résultat dans ce filtre</h3>
                <p>Essaie "Tous" pour voir toutes les détections.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal de confirmation ──────────────────────────────────────────── */}
      {confirm && (
        <DeleteConfirmModal
          selected={[...selected]}
          entries={entries}
          onConfirm={doDelete}
          onCancel={() => setConfirm(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}

// ── Ligne de résultat ────────────────────────────────────────────────────────
function CleanerRow({ entry, checked, onToggle }) {
  const c = entry.confidence;
  const confTag   = c >= 75 ? "tag--err" : c >= 50 ? "tag--warn" : "";
  const confLabel = c >= 75 ? "HAUTE" : c >= 50 ? "MOYENNE" : "FAIBLE";

  return (
    <div className="broker-row" data-st={checked ? "found" : "unknown"}
      onClick={onToggle} style={{cursor:"pointer", userSelect:"none"}}>

      {/* Checkbox */}
      <div style={{display:"flex",alignItems:"center",paddingRight:8,flexShrink:0}}>
        <input type="checkbox" checked={checked} readOnly
          onClick={e => e.stopPropagation()}
          style={{width:14,height:14,cursor:"pointer",accentColor:"var(--accent)"}}/>
      </div>

      {/* Infos dossier */}
      <div className="broker-row__head" style={{flex:"1 1 0",minWidth:0}}>
        <div className="broker-row__country dim mono" style={{fontSize:10,minWidth:100}}>
          {entry.base}
        </div>
        <div style={{minWidth:0}}>
          <div className="broker-row__name mono">{entry.name}</div>
          <div className="dim mono" style={{fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {entry.path}
          </div>
        </div>
      </div>

      {/* Métriques */}
      <div className="broker-row__right" style={{gap:10,flexShrink:0}}>
        <span className="dim mono" style={{fontSize:11,minWidth:56,textAlign:"right"}}>
          ~{fmtSize(entry.size)}
        </span>
        <span className="dim" style={{fontSize:11,minWidth:48,textAlign:"right"}}>
          {fmtAge(entry.ageDays)}
        </span>
        <span className={"tag " + confTag} style={{fontSize:10,minWidth:80,textAlign:"center"}}>
          <span className="dot"></span>{confLabel} {c}%
        </span>
      </div>
    </div>
  );
}

// ── Modal de confirmation avant suppression ──────────────────────────────────
function DeleteConfirmModal({ selected, entries, onConfirm, onCancel, loading }) {
  const selEntries = entries.filter(e => selected.includes(e.path));
  const totalSize  = selEntries.reduce((s, e) => s + e.size, 0);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="modal__sub" style={{color:"var(--err)"}}>Action irréversible</div>
            <div className="modal__title">
              Supprimer {selected.length} dossier{selected.length > 1 ? "s" : ""} ?
            </div>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onCancel}>
            <Icon n="x" size={14}/>
          </button>
        </div>

        <div className="modal__body">
          <div className="modal__meta">
            <span><b>Espace libéré estimé :</b> <span className="acc">~{fmtSize(totalSize)}</span></span>
            <span><b>Dossiers :</b> {selected.length}</span>
          </div>

          {/* Liste des chemins */}
          <div style={{maxHeight:180,overflowY:"auto",margin:"12px 0 0",
            border:"1px solid var(--border)",borderRadius:4,padding:"8px 10px"}}>
            {selEntries.map(e => (
              <div key={e.path} className="mono dim"
                style={{fontSize:11,padding:"2px 0",borderBottom:"1px solid var(--border)"}}>
                {e.path}
              </div>
            ))}
          </div>

          {/* Avertissement */}
          <div style={{
            display:"flex",gap:10,alignItems:"flex-start",marginTop:14,
            padding:"10px 12px",borderRadius:4,
            background:"rgba(255,50,50,0.07)",border:"1px solid rgba(255,50,50,0.25)"
          }}>
            <Icon n="alert" size={13} style={{color:"var(--err)",flexShrink:0,marginTop:1}}/>
            <span style={{fontSize:12,color:"var(--fg-1)",lineHeight:1.6}}>
              Ces dossiers seront <b>définitivement supprimés</b>. Vérifie qu'aucune application
              active n'en dépend. En cas de doute, fais une sauvegarde avant de continuer.
            </span>
          </div>
        </div>

        <div className="modal__foot">
          <div/>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>Annuler</button>
            <button className="btn" onClick={onConfirm} disabled={loading}
              style={{background:"var(--err)",borderColor:"var(--err)",color:"#fff"}}>
              {loading
                ? "Suppression…"
                : <><Icon n="trash" size={12}/> Supprimer définitivement</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes || bytes < 1) return "—";
  if (bytes < 1024)             return bytes + " B";
  if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3)        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 ** 3)).toFixed(2) + " GB";
}

function fmtAge(days) {
  if (!days || days < 1) return "auj.";
  if (days === 1)        return "hier";
  if (days < 30)         return `${days}j`;
  if (days < 365)        return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}an`;
}

window.FINDIUM_NETTOYAGE = { Nettoyage };
Object.assign(window, { Nettoyage });
