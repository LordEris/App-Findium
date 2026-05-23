/**
 * atoms.jsx — Composants atomiques réutilisables
 *
 * Regroupe tous les petits éléments visuels partagés dans l'interface :
 *   Clock       : horloge UTC temps réel (mise à jour chaque seconde)
 *   Spark       : mini graphique en barres sparkline
 *   StatusTag   : badge coloré pour le statut d'une enquête
 *   SourceStatus: indicateur compact pour l'état d'une source OSINT
 *   ConfBar     : barre de confiance avec pourcentage
 *   Bar         : barre de progression générique
 *   typeIcon    : fonction utilitaire — glyph texte selon le type d'entité
 *   Icon        : ensemble d'icônes SVG inline (pas de dépendance externe)
 *   Logo        : petit logo Findium (loupe + point central)
 *
 * Tous les composants sont exportés sur window.FINDIUM_ATOMS ET directement
 * sur window (Object.assign) pour permettre leur usage sans import dans les
 * autres fichiers JSX chargés via <script type="text/babel">.
 */
const { useEffect, useState, useRef, useMemo, useCallback } = React;

// ─── Clock ────────────────────────────────────────────────────────────────────
// Affiche l'heure UTC courante au format HH:MM:SS.
// setInterval de 1 seconde, nettoyé à la destruction du composant.
function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <span className="topbar__clock" style={{fontFamily:"var(--font-mono)",color:"var(--accent)",fontSize:12}}>
      {pad(t.getUTCHours())}:{pad(t.getUTCMinutes())}:{pad(t.getUTCSeconds())}
      <span style={{color:"var(--fg-3)",marginLeft:6,fontSize:11}}>UTC</span>
    </span>
  );
}

// ─── Spark ────────────────────────────────────────────────────────────────────
// Sparkline en barres verticales.
//   values : tableau de nombres (ex : historique d'activité)
//   h      : hauteur totale en px (les barres s'y adaptent proportionnellement)
function Spark({ values = [3,5,2,7,4,8,3,6,9,5,4,7], h = 14 }) {
  const max = Math.max(...values) || 1;
  return (
    <span className="spark" style={{ height: h }}>
      {values.map((v, i) => (
        <span key={i} style={{ height: (v / max) * h, opacity: 0.4 + (v / max) * 0.6 }} />
      ))}
    </span>
  );
}

// ─── StatusTag ────────────────────────────────────────────────────────────────
// Badge rond coloré représentant le statut d'une enquête.
// Le statut "running" pulse visuellement pour indiquer l'activité.
function StatusTag({ status, small }) {
  const map = {
    running:   { cls: "tag--ok",     txt: "EN COURS",  pulse: true },
    complete:  { cls: "tag--info",   txt: "TERMINÉE",  pulse: false },
    paused:    { cls: "tag--warn",   txt: "PAUSE",     pulse: false },
    archived:  { cls: "",            txt: "ARCHIVÉE",  pulse: false },
    aborted:   { cls: "tag--err",    txt: "ABANDONNÉE",pulse: false },
  };
  const s = map[status] || { cls: "", txt: status, pulse: false };
  return (
    <span className={"tag " + s.cls} style={small ? {fontSize:10, padding:"2px 7px"} : null}>
      <span className={"dot" + (s.pulse ? " dot--pulse" : "")}></span>
      {s.txt}
    </span>
  );
}

// ─── SourceStatus ─────────────────────────────────────────────────────────────
// Indicateur texte compact pour l'état d'une source OSINT dans le terminal.
// Utilise les variables de couleur du thème (acc / warn / err / mute / info).
function SourceStatus({ status }) {
  const map = {
    hit:        { cls: "acc",  txt: "HIT" },
    partial:    { cls: "warn", txt: "PARTIAL" },
    querying:   { cls: "info", txt: "QUERY" },
    noresult:   { cls: "mute", txt: "—" },
    off:        { cls: "mute", txt: "OFF" },
    "rate-limit": { cls: "warn", txt: "LIMIT" },
    ok:         { cls: "acc",  txt: "OK" },
    error:      { cls: "err",  txt: "ERR" },
  };
  const s = map[status] || { cls: "mute", txt: status?.toUpperCase() || "?" };
  return <span className={s.cls} style={{fontFamily:"var(--font-mono)", fontSize:11, fontWeight:500}}>{s.txt}</span>;
}

// ─── ConfBar ─────────────────────────────────────────────────────────────────
// Barre de confiance horizontale + pourcentage.
//   value : flottant 0-1 (ex : 0.82 → "82%")
// La largeur de remplissage est injectée via la variable CSS --w
// pour éviter un style inline calculé dans chaque rendu.
function ConfBar({ value = 0 }) {
  const pct = Math.round(value * 100);
  return (
    <span className="conf-bar">
      <span className="conf-bar__bar" style={{ "--w": pct + "%" }}></span>
      <span className="conf-bar__pct">{pct}%</span>
    </span>
  );
}

// ─── Bar ─────────────────────────────────────────────────────────────────────
// Barre de progression générique (utilisée dans les cartes et tableaux).
//   value : flottant 0-1
function Bar({ value = 0, className = "" }) {
  return (
    <div className={"bar " + className}>
      <div className="bar__fill" style={{ width: Math.min(100, Math.max(0, value * 100)) + "%" }}></div>
    </div>
  );
}

// ─── typeIcon ─────────────────────────────────────────────────────────────────
// Retourne un glyph texte monospace selon le type d'entité OSINT.
// Utilisé dans les icônes de nœuds du graphe et les listes d'entités.
function typeIcon(type) {
  const m = {
    person: "P", alias: "@", email: "✉", phone: "☏",
    address: "▲", url: "/", note: "≡", doc: "▣",
    org: "○", location: "△", domain: "/",
  };
  return m[type] || "·";
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
// Bibliothèque d'icônes SVG inline.
// Avantages vs bibliothèque externe :
//   - aucune dépendance réseau (l'app doit fonctionner hors-ligne)
//   - taille minimale (seules les icônes utilisées sont incluses)
//   - cohérence visuelle (stroke-based, même style pour toutes)
// Chaque cas retourne un <svg> avec les props communes (size, stroke…)
// transmises via spread — pas de surcharge par icône.
const Icon = ({ n, size = 16, stroke = 1.6, ...p }) => {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", ...p };
  switch (n) {
    case "dashboard": return <svg {...props}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>;
    case "plus":      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "search":    return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "folder":    return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
    case "archive":   return <svg {...props}><rect x="3" y="4" width="18" height="4"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>;
    case "settings":  return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "graph":     return <svg {...props}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="m7.8 7.8 2.4 2.4M16.2 7.8l-2.4 2.4M7.8 16.2l2.4-2.4M16.2 16.2l-2.4-2.4"/></svg>;
    case "timeline":  return <svg {...props}><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/><path d="M9 6h11M9 12h8M9 18h11"/></svg>;
    case "map":       return <svg {...props}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/></svg>;
    case "file":      return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>;
    case "report":    return <svg {...props}><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM7 7h10M7 11h10M7 15h6"/></svg>;
    case "play":      return <svg {...props}><path d="M5 4v16l14-8z" fill="currentColor"/></svg>;
    case "pause":     return <svg {...props}><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/></svg>;
    case "stop":      return <svg {...props}><rect x="5" y="5" width="14" height="14" fill="currentColor" stroke="none"/></svg>;
    case "share":     return <svg {...props}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>;
    case "download":  return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
    case "filter":    return <svg {...props}><path d="M3 4h18l-7 9v6l-4 2v-8L3 4z"/></svg>;
    case "chev":      return <svg {...props}><path d="m9 6 6 6-6 6"/></svg>;
    case "spark":     return <svg {...props}><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"/></svg>;
    case "shield":    return <svg {...props}><path d="M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6z"/></svg>;
    case "eye":       return <svg {...props}><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "link":      return <svg {...props}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
    case "globe":     return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case "alert":     return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>;
    case "check":     return <svg {...props}><path d="m5 12 5 5 9-11"/></svg>;
    case "x":         return <svg {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "user":      return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "tag":       return <svg {...props}><path d="M20 12 12 20 3 11V3h8z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>;
    case "bolt":      return <svg {...props}><path d="M13 2 3 14h7l-1 8 10-12h-7z" fill="currentColor" stroke="none"/></svg>;
    case "pulse":     return <svg {...props}><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>;
    case "bell":      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></svg>;
    case "key":       return <svg {...props}><circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 8.65-8.65M16 7l3 3"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="3"/></svg>;
  }
};

// ─── Logo ─────────────────────────────────────────────────────────────────────
// Loupe stylisée avec un point central — identité visuelle Findium.
function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="6"/>
      <path d="m21 21-6.5-6.5"/>
      <circle cx="10" cy="10" r="2" fill="currentColor"/>
    </svg>
  );
}

// Export global — accessible par tous les fichiers JSX chargés après celui-ci.
window.FINDIUM_ATOMS = { Clock, Spark, StatusTag, SourceStatus, ConfBar, Bar, typeIcon, Icon, Logo };
Object.assign(window, { Clock, Spark, StatusTag, SourceStatus, ConfBar, Bar, typeIcon, Icon, Logo });
