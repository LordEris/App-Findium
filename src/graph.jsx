/**
 * graph.jsx — Visualisations graphiques OSINT
 *
 * Deux composants de visualisation :
 *
 *   NetworkGraph : graphe de relations force-dirigé
 *     - Layout calculé via simulation itérative (220 itérations)
 *       combinant répulsion noeuds-noeuds, attraction des arêtes
 *       et gravité centrée douce.
 *     - Les noeuds sont déplaçables (drag pointer) et "épinglés"
 *       après déplacement — setPinned() mémorise les positions manuelles
 *       et les préserve lors des mises à jour du layout.
 *     - Taille des noeuds proportionnelle à la confiance (conf).
 *     - Arêtes en tirets si conf < 0.6 (lien faible / incertain).
 *     - Filtre SVG "glow" sur les noeuds pour l'effet néon.
 *     - Bouton "↺ Reset layout" affiché uniquement quand des noeuds
 *       ont été épinglés manuellement.
 *
 *   MapView : carte du monde stylisée
 *     - Projection Mercator simplifiée (équirectangulaire approchée).
 *     - Silhouettes continentales en paths SVG (placeholder esthétique,
 *       pas une carte géographique précise).
 *     - Grille de fond + graticule équateur/méridien central.
 *     - Pins avec halo, réticule et coordonnées pour chaque localisation.
 *     - Coins décorés (crosshairs style militaire).
 *
 * Couleurs de type définies dans TYPE_COLORS — exposées aussi pour usage
 * externe (légende, fiche entité).
 */
const { useEffect: _ge, useMemo: _gm, useState: _gs, useRef: _gr } = React;

// ─── Palette de couleurs par type d'entité ────────────────────────────────────
// Chaque type a une teinte distincte dans la famille verte/cyan pour rester
// cohérent avec le thème sans perdre la lisibilité des nœuds.
const TYPE_COLORS = {
  person:   "var(--accent)",
  alias:    "#a0ff66",
  email:    "#7cff9d",
  phone:    "#9effaa",
  address:  "#bfff8c",
  url:      "#5fffd0",
  location: "#5fffd0",
  org:      "#ffd966",
  note:     "#8ad9ff",
  doc:      "#c9b3ff",
};

// ─── NetworkGraph ─────────────────────────────────────────────────────────────
function NetworkGraph({ entities = [], edges = [], onSelect, selectedId, onUpdateEntity }) {
  const svgRef = _gr(null);
  const [positions, setPositions] = _gs(null);
  const [dragId, setDragId] = _gs(null);
  const [pinned, setPinned] = _gs({});
  const dragOffsetRef = _gr({ x: 0, y: 0 });
  const dragMovedRef  = _gr(false);
  const [editId, setEditId] = _gs(null);
  const [overrides, setOverrides] = _gs({});

  // ── Calcul du layout initial ───────────────────────────────────────────────
  // useMemo : ne recalcule que quand entities/edges changent (pas à chaque rendu).
  // Algorithme en 3 passes sur 220 itérations :
  //   1. Répulsion inversement proportionnelle à d² entre toutes les paires
  //   2. Attraction des arêtes vers une distance cible (150px), pondérée par conf
  //   3. Gravité douce vers le centre (0.5% par itération)
  const initialLayout = _gm(() => {
    const W = 900, H = 560;
    const cx = W / 2, cy = H / 2;
    const pos = {};

    // Placement initial en cercle, rayon variable pour éviter les superpositions
    const ids = entities.map(e => e.id);
    const N = ids.length;
    ids.forEach((id, i) => {
      const angle = (i / N) * Math.PI * 2;
      const r = 220 + (i % 3) * 18;
      pos[id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
    // Le premier noeud (sujet principal) est placé au centre
    if (ids[0]) pos[ids[0]] = { x: cx, y: cy };

    for (let it = 0; it < 220; it++) {
      // Répulsion entre toutes les paires
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pos[ids[i]], b = pos[ids[j]];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy + 0.1;
          let d = Math.sqrt(d2);
          let f = 8000 / d2;
          dx = (dx / d) * f; dy = (dy / d) * f;
          a.x -= dx; a.y -= dy;
          b.x += dx; b.y += dy;
        }
      }
      // Attraction des arêtes (ressort avec longueur cible 150px)
      edges.forEach((e) => {
        const a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const target = 150;
        const k = 0.02 * (e.conf || 0.6);
        const f = (d - target) * k;
        const ux = dx / d, uy = dy / d;
        a.x += ux * f; a.y += uy * f;
        b.x -= ux * f; b.y -= uy * f;
      });
      // Gravité centrée — évite que les noeuds isolés dérivent trop loin
      ids.forEach((id) => {
        const p = pos[id];
        p.x += (cx - p.x) * 0.005;
        p.y += (cy - p.y) * 0.005;
      });
    }
    return { pos, W, H };
  }, [entities, edges]);

  // ── Synchronisation positions ↔ layout ────────────────────────────────────
  // Quand le layout change (nouvelle enquête), on réinitialise les positions
  // SAUF pour les noeuds épinglés manuellement par l'utilisateur.
  _ge(() => {
    setPositions((prev) => {
      const next = { ...initialLayout.pos };
      if (prev) {
        Object.keys(prev).forEach((id) => {
          if (pinned[id] && next[id]) next[id] = prev[id];
        });
      }
      return next;
    });
  }, [initialLayout]);

  const { W, H } = initialLayout;
  const pos = positions || initialLayout.pos;

  // ── Conversion coordonnées client → coordonnées SVG ───────────────────────
  // Nécessaire car le SVG est mis à l'échelle par CSS (viewBox + preserveAspectRatio).
  const toSvg = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    return { x, y };
  };

  // Début du drag — mémorise l'offset et réinitialise le flag de mouvement
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    dragMovedRef.current = false;
    const { x, y } = toSvg(e.clientX, e.clientY);
    const p = pos[id];
    dragOffsetRef.current = { x: x - p.x, y: y - p.y };
    setDragId(id);
    if (onSelect) onSelect(id);
  };

  // ── Gestionnaires pointer globaux pendant le drag ──────────────────────────
  // Attachés sur window (pas sur le SVG) pour ne pas perdre l'événement
  // quand le curseur sort du SVG à grande vitesse.
  _ge(() => {
    if (!dragId) return;
    const move = (ev) => {
      ev.preventDefault();
      dragMovedRef.current = true;
      const { x, y } = toSvg(ev.clientX, ev.clientY);
      setPositions((prev) => ({
        ...(prev || {}),
        [dragId]: {
          x: Math.max(20, Math.min(W - 20, x - dragOffsetRef.current.x)),
          y: Math.max(20, Math.min(H - 20, y - dragOffsetRef.current.y)),
        },
      }));
    };
    const up = () => {
      if (!dragMovedRef.current) {
        // Simple clic (pas de déplacement) → ouvrir le panneau d'édition
        setEditId(dragId);
      } else {
        // Déplacement réel → épingler la nouvelle position
        setPinned((p) => ({ ...p, [dragId]: true }));
      }
      dragMovedRef.current = false;
      setDragId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragId, W, H]);

  // Remet tous les noeuds à leur position calculée par l'algorithme
  const resetLayout = () => {
    setPinned({});
    setPositions({ ...initialLayout.pos });
  };

  return (
    <div className="graph-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", userSelect: "none", touchAction: "none" }}>
        <defs>
          {/* Flèche directionnelle — hérite de la couleur du trait (context-stroke) */}
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="context-stroke"/>
          </marker>
          {/* Filtre de lueur néon sur les noeuds */}
          <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Arêtes — couleur distincte des nœuds, épaisseur/opacité selon confiance
            Solide si conf ≥ 0.65, pointillés si conf < 0.65 (lien supposé) */}
        {edges.map((e, i) => {
          const a = pos[e.from], b = pos[e.to];
          if (!a || !b) return null;
          const sel  = selectedId && (selectedId === e.from || selectedId === e.to);
          const conf = e.conf || 0.5;
          const dashed = conf < 0.65;
          const edgeColor = sel ? "#ffffff" : conf >= 0.75 ? "#5fffd0" : "#a0c8ff";
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={edgeColor}
                strokeOpacity={sel ? 1 : 0.5 + conf * 0.4}
                strokeWidth={sel ? 2.2 : 0.9 + conf * 1.1}
                strokeDasharray={dashed ? "7 5" : "none"}
                markerEnd="url(#arr)"
              />
              {/* Label relation + confiance — plus visible que l'ancien */}
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6}
                textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono"
                fill={edgeColor} opacity={sel ? 1 : 0.8}>
                {e.kind}
              </text>
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 5}
                textAnchor="middle" fontSize="7.5" fontFamily="JetBrains Mono"
                fill={edgeColor} opacity={sel ? 0.9 : 0.55}>
                {Math.round(conf * 100)}%{dashed ? " ·?" : ""}
              </text>
            </g>
          );
        })}

        {/* Noeuds — rayon = 6 + conf * 10 (plus la confiance est haute, plus le noeud est grand) */}
        {entities.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const ov    = overrides[n.id] || {};
          const color = ov.color || TYPE_COLORS[n.type] || "var(--accent)";
          const r = 6 + (n.conf || 0.5) * 10;
          const sel = selectedId === n.id;
          const isPinned = pinned[n.id];
          const isDragging = dragId === n.id;
          const isEditing  = editId === n.id;
          return (
            <g key={n.id} transform={`translate(${p.x}, ${p.y})`}
              style={{ cursor: isDragging ? "grabbing" : "pointer" }}
              onPointerDown={(e) => onNodeDown(e, n.id)}
              data-cursor-label={isDragging ? "déplacer" : "éditer"}>
              <circle r={r + 12} fill="transparent"/>
              <circle r={r + 8} fill={color} opacity={sel || isDragging || isEditing ? 0.28 : 0.08} />
              {/* Anneau de surbrillance quand édition en cours */}
              {isEditing && <circle r={r + 6} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9"/>}
              <circle r={r} fill="var(--bg)" stroke={color} strokeWidth={sel || isDragging || isEditing ? 2.2 : 1.2} filter="url(#glow)" />
              <circle r={r * 0.4} fill={color} opacity="0.85"/>
              {isPinned && (
                <circle r={r + 4} fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6"/>
              )}
              <text className="node-label" textAnchor="middle" y={r + 14}>{ov.label ?? n.label}</text>
              <text className="node-sub" textAnchor="middle" y={r + 25}>{ov.sub ?? (n.sub || n.type)}</text>
            </g>
          );
        })}
      </svg>

      {/* Légende des types de noeuds + explication liens */}
      <div className="graph-legend">
        <div className="lg"><span className="sw" style={{background:"var(--accent)"}}></span>person</div>
        <div className="lg"><span className="sw" style={{background:"#ffd966"}}></span>org</div>
        <div className="lg"><span className="sw" style={{background:"#7cff9d"}}></span>email</div>
        <div className="lg"><span className="sw" style={{background:"#a0ff66"}}></span>alias</div>
        <div className="lg"><span className="sw" style={{background:"#5fffd0"}}></span>url / location</div>
        <div className="lg"><span className="sw" style={{background:"#9effaa"}}></span>phone</div>
        <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--line)",color:"var(--fg-3)",fontSize:10,letterSpacing:"0.08em"}}>
          <span style={{color:"#5fffd0"}}>─</span> confirmé &nbsp;
          <span style={{color:"#a0c8ff",letterSpacing:1}}>· · ·</span> supposé
        </div>
        <div style={{color:"var(--fg-3)",fontSize:10,marginTop:3}}>
          clic = éditer · glisse = déplacer
        </div>
      </div>

      {/* Panneau d'édition de nœud — apparaît au clic */}
      {editId && (
        <NodeEditPanel
          entity={entities.find(n => n.id === editId)}
          override={overrides[editId] || {}}
          onClose={() => setEditId(null)}
          onSave={(patch) => {
            setOverrides(ov => ({...ov, [editId]: {...(ov[editId]||{}), ...patch}}));
            onUpdateEntity?.(editId, patch);
            setEditId(null);
          }}
        />
      )}

      {/* Contrôles flottants — badge LIVE + bouton reset conditionnel */}
      <div className="graph-controls">
        <div className="tag tag--ok"><span className="dot dot--pulse"></span>LIVE</div>
        {Object.keys(pinned).length > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={resetLayout} style={{fontSize:11}}>
            ↺ Reset layout
          </button>
        )}
      </div>
    </div>
  );
}

// ─── NodeEditPanel ────────────────────────────────────────────────────────────
// Panneau flottant permettant de modifier la couleur et la description d'un nœud.
// Positionné en haut à droite du graphe pour ne pas masquer les nœuds.
function NodeEditPanel({ entity, override, onClose, onSave }) {
  if (!entity) return null;
  const [color, setColor] = _gs(override.color || TYPE_COLORS[entity.type] || "#00ff7a");
  const [label, setLabel] = _gs(override.label ?? entity.label ?? "");
  const [sub,   setSub]   = _gs(override.sub   ?? entity.sub   ?? "");

  const swatches = [
    "#00ff7a","#a0ff66","#7cff9d","#5fffd0","#9effaa",
    "#ffd966","#8ad9ff","#c9b3ff","#ff5a72","#ff9a3c",
    "#ffffff","#bfff8c",
  ];

  const hexOrCss = color.startsWith("var(") ? "#00ff7a" : color;

  return (
    <div style={{
      position:"absolute", top:12, right:12, width:230, zIndex:20,
      background:"var(--bg-elev)", border:"1px solid var(--accent-line)",
      borderRadius:"var(--r-md)", padding:14,
      boxShadow:"0 6px 28px rgba(0,0,0,0.55)",
    }} onClick={e => e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:600,color:"var(--fg)",fontFamily:"var(--font-mono)",letterSpacing:"0.08em"}}>
          NŒUD · {entity.type}
        </span>
        <button className="btn btn--ghost btn--icon" style={{width:22,height:22,padding:0}} onClick={onClose}>
          <Icon n="x" size={11}/>
        </button>
      </div>

      {/* Couleur */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:"var(--fg-3)",marginBottom:5,letterSpacing:"0.08em"}}>COULEUR</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
          {swatches.map((c, i) => (
            <button key={i} onClick={() => setColor(c)} style={{
              width:18, height:18, borderRadius:"50%", background:c, padding:0,
              border: color === c ? "2px solid white" : "2px solid transparent",
              cursor:"pointer", flex:"none", outline:"none",
            }}/>
          ))}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input type="color" value={hexOrCss} onChange={e => setColor(e.target.value)}
            style={{width:32,height:24,border:"1px solid var(--line)",borderRadius:4,background:"var(--bg-2)",cursor:"pointer",padding:2,flex:"none"}}/>
          <span style={{fontSize:10,fontFamily:"var(--font-mono)",color:"var(--fg-2)"}}>{hexOrCss}</span>
          <span style={{width:14,height:14,borderRadius:"50%",background:color,display:"inline-block",flex:"none",border:"1px solid rgba(255,255,255,0.2)"}}/>
        </div>
      </div>

      {/* Label */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:"var(--fg-3)",marginBottom:4,letterSpacing:"0.08em"}}>LABEL</div>
        <input className="input" value={label} onChange={e => setLabel(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",fontSize:12}}/>
      </div>

      {/* Description */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:"var(--fg-3)",marginBottom:4,letterSpacing:"0.08em"}}>DESCRIPTION</div>
        <input className="input" value={sub} onChange={e => setSub(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",fontSize:12}} placeholder={entity.type}/>
      </div>

      <div style={{display:"flex",gap:6}}>
        <button className="btn btn--primary btn--sm" style={{flex:1,justifyContent:"center"}}
          onClick={() => onSave({ color, label, sub })}>
          <Icon n="check" size={11}/> Appliquer
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}


// ─── MapView ──────────────────────────────────────────────────────────────────
// Carte du monde stylisée avec silhouettes continentales et pins de localisation.
// La projection est équirectangulaire approchée (lng → x linéaire, lat → y linéaire)
// suffisante pour positionner des villes connues à l'échelle mondiale.
function MapView({ locations = [] }) {
  const W = 1000, H = 500;
  // Projection équirectangulaire : lat/lng → coordonnées SVG
  const project = (lat, lng) => {
    const x = ((lng + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    return { x, y };
  };
  return (
    <div className="map-wrap">
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`}>
        {/* Grilles de fond : petite (40px) et grande (200px) */}
        <defs>
          <pattern id="mgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line)" strokeWidth="0.5"/>
          </pattern>
          <pattern id="mgrid2" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="var(--line-strong)" strokeWidth="0.6"/>
          </pattern>
        </defs>
        <rect width={W} height={H} fill="var(--bg)"/>
        <rect width={W} height={H} fill="url(#mgrid)"/>
        <rect width={W} height={H} fill="url(#mgrid2)"/>

        {/* Silhouettes continentales — paths simplifiés, rôle esthétique uniquement */}
        <g fill="none" stroke="var(--accent)" strokeWidth="0.7" opacity="0.5">
          {/* europe */}
          <path d="M450,120 L470,110 L500,108 L530,118 L560,130 L580,150 L575,180 L550,200 L520,210 L500,215 L480,200 L460,180 L450,150 Z"/>
          {/* africa */}
          <path d="M470,230 L520,225 L560,240 L580,290 L560,360 L520,400 L490,395 L470,360 L460,300 Z"/>
          {/* asia */}
          <path d="M580,110 L650,100 L730,110 L800,130 L820,180 L780,220 L720,230 L660,210 L600,180 Z"/>
          {/* north america */}
          <path d="M120,110 L180,100 L240,110 L280,130 L290,170 L260,200 L210,215 L170,200 L140,170 Z"/>
          {/* south america */}
          <path d="M230,260 L270,250 L300,290 L290,360 L260,410 L240,400 L220,360 L210,310 Z"/>
          {/* australia */}
          <path d="M780,330 L840,320 L880,340 L870,380 L830,395 L790,380 Z"/>
        </g>

        {/* Graticule : équateur + méridien central en tirets */}
        <g stroke="var(--line-strong)" strokeWidth="0.4" strokeDasharray="2 3" opacity="0.5">
          <line x1="0" y1={H/2} x2={W} y2={H/2}/>
          <line x1={W/2} y1="0" x2={W/2} y2={H}/>
        </g>

        {/* Pins de localisation avec halo, réticule et étiquette */}
        {locations.map((loc, i) => {
          const { x, y } = project(loc.lat, loc.lng);
          const r = loc.size || 8;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={r + 6} fill="var(--accent)" opacity="0.1"/>
              <circle cx={x} cy={y} r={r} fill="none" stroke="var(--accent)" strokeWidth="1"/>
              <circle cx={x} cy={y} r="2" fill="var(--accent)"/>
              {/* Réticule à 4 branches autour du pin */}
              <line x1={x - r - 4} y1={y} x2={x - r - 1} y2={y} stroke="var(--accent)"/>
              <line x1={x + r + 1} y1={y} x2={x + r + 4} y2={y} stroke="var(--accent)"/>
              <line x1={x} y1={y - r - 4} x2={x} y2={y - r - 1} stroke="var(--accent)"/>
              <line x1={x} y1={y + r + 1} x2={x} y2={y + r + 4} stroke="var(--accent)"/>
              <text x={x + r + 8} y={y + 3} fontSize="10" fontFamily="JetBrains Mono" fill="var(--fg)">
                {loc.label}
              </text>
              <text x={x + r + 8} y={y + 14} fontSize="8" fontFamily="JetBrains Mono" fill="var(--fg-mute)">
                {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Crosshairs décoratifs aux 4 coins (style militaire / OSINT) */}
        <g stroke="var(--accent)" strokeWidth="1" fill="none">
          <path d="M10,10 L30,10 M10,10 L10,30"/>
          <path d={`M${W-30},10 L${W-10},10 M${W-10},10 L${W-10},30`}/>
          <path d={`M10,${H-30} L10,${H-10} M10,${H-10} L30,${H-10}`}/>
          <path d={`M${W-30},${H-10} L${W-10},${H-10} M${W-10},${H-10} L${W-10},${H-30}`}/>
        </g>

        <text x="14" y={H - 20} fontSize="9" fontFamily="JetBrains Mono" fill="var(--fg-mute)" textTransform="uppercase">
          mercator · proj.simplified · {locations.length} pin{locations.length > 1 ? "s" : ""}
        </text>
      </svg>
    </div>
  );
}

// Export global — accessible via window.NetworkGraph, window.MapView, etc.
window.FINDIUM_GRAPH = { NetworkGraph, MapView, TYPE_COLORS };
Object.assign(window, { NetworkGraph, MapView, TYPE_COLORS });
