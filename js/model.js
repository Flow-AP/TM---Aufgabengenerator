'use strict';
/*
 * Datenmodell und Geometrie-Operationen.
 *
 * Alles hängt an Knoten: Tragwerkselemente (Balken, Stäbe, Seile, Federn)
 * verbinden zwei Knoten, Lager, Einzelkräfte, Momente und Maße referenzieren
 * Knoten. Wird ein Knoten verschoben, "wachsen" alle angeschlossenen Elemente
 * automatisch mit. Nur Streckenlasten hängen an einem Element.
 *
 * Koordinaten sind Welt-Koordinaten (Längeneinheiten, y nach oben).
 */
window.TM = window.TM || {};
(function (TM) {
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  TM.uid = uid;

  const V = (TM.V = {
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
    dot: (a, b) => a.x * b.x + a.y * b.y,
    cross: (a, b) => a.x * b.y - a.y * b.x,
    len: (a) => Math.hypot(a.x, a.y),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    norm: (a) => {
      const l = Math.hypot(a.x, a.y) || 1;
      return { x: a.x / l, y: a.y / l };
    },
    perp: (a) => ({ x: -a.y, y: a.x }),
    rot: (a, deg) => {
      const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
    },
    ang: (a) => (Math.atan2(a.y, a.x) * 180) / Math.PI,
    dir: (deg) => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) }),
    lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  });

  TM.clean = (v) => Math.round(v * 1e6) / 1e6;

  TM.segProject = function (p, a, b) {
    const ab = V.sub(b, a);
    const L2 = V.dot(ab, ab) || 1e-12;
    let t = V.dot(V.sub(p, a), ab) / L2;
    t = Math.max(0, Math.min(1, t));
    const q = V.lerp(a, b, t);
    return { t, q, d: V.dist(p, q) };
  };

  TM.newDoc = () => ({
    version: 1,
    nodes: [],
    elements: [],
    supports: [],
    loads: [],
    dims: [],
    texts: [],
    meta: { title: '', text: '', unit: '', beamStyle: 'outline', grid: 0.5, showGrid: true, snap: true },
  });

  const M = (TM.model = {});
  const COLL = { node: 'nodes', element: 'elements', support: 'supports', load: 'loads', dim: 'dims', text: 'texts' };
  M.coll = (doc, kind) => doc[COLL[kind]] || [];
  M.get = (doc, kind, id) => M.coll(doc, kind).find((o) => o.id === id);
  M.node = (doc, id) => doc.nodes.find((n) => n.id === id);
  M.el = (doc, id) => doc.elements.find((e) => e.id === id);
  M.elementsAt = (doc, nid) => doc.elements.filter((e) => e.n1 === nid || e.n2 === nid);
  M.supportAt = (doc, nid) => doc.supports.find((s) => s.node === nid);
  M.other = (e, nid) => (e.n1 === nid ? e.n2 : e.n1);

  M.addNode = (doc, x, y) => {
    const n = { id: uid('n'), x: TM.clean(x), y: TM.clean(y), hinge: false, label: '', lx: -14, ly: -18 };
    doc.nodes.push(n);
    return n;
  };

  M.addElement = (doc, type, n1, n2) => {
    const e = { id: uid('e'), type, n1, n2, label: '', labelSide: 1 };
    doc.elements.push(e);
    return e;
  };

  M.nodeAt = (doc, p, tol, exclude) => {
    let best = null, bd = tol;
    for (const n of doc.nodes) {
      if (exclude && exclude.has(n.id)) continue;
      const d = V.dist(n, p);
      if (d <= bd) { bd = d; best = n; }
    }
    return best;
  };

  M.elementAt = (doc, p, tol, exclude) => {
    let best = null;
    for (const e of doc.elements) {
      if (exclude && exclude.has(e.id)) continue;
      const a = M.node(doc, e.n1), b = M.node(doc, e.n2);
      const h = TM.segProject(p, a, b);
      if (h.d <= tol && (!best || h.d < best.d)) best = { el: e, t: h.t, d: h.d, q: h.q };
    }
    return best;
  };

  /** Teilt ein Element bei t (0..1) und gibt den neuen Knoten zurück. */
  M.splitElement = (doc, el, t) => {
    const a = M.node(doc, el.n1), b = M.node(doc, el.n2);
    const p = V.lerp(a, b, t);
    const n = M.addNode(doc, p.x, p.y);
    const e2 = { ...el, id: uid('e'), n1: n.id, n2: el.n2, label: '' };
    el.n2 = n.id;
    doc.elements.push(e2);
    for (const L of doc.loads.filter((l) => l.type === 'lineload' && l.el === el.id)) {
      const qm = L.qa + (L.qb - L.qa) * t;
      doc.loads.push({ ...L, id: uid('l'), el: e2.id, qa: qm, qb: L.qb, label: '' });
      L.qb = qm;
    }
    return n;
  };

  /** Verschmilzt Knoten remId in keepId. */
  M.mergeNodes = (doc, keepId, remId) => {
    if (keepId === remId) return;
    const keep = M.node(doc, keepId), rem = M.node(doc, remId);
    if (!keep || !rem) return;
    for (const e of doc.elements) {
      if (e.n1 === remId) e.n1 = keepId;
      if (e.n2 === remId) e.n2 = keepId;
    }
    // doppelte Elemente entfernen
    const seen = new Set();
    doc.elements = doc.elements.filter((e) => {
      if (e.n1 === e.n2) return false;
      const k = [e.n1, e.n2].sort().join('|') + e.type;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const hasKeep = doc.supports.some((s) => s.node === keepId);
    doc.supports = doc.supports.filter((s) => !(s.node === remId && hasKeep));
    for (const s of doc.supports) if (s.node === remId) s.node = keepId;
    for (const l of doc.loads) if (l.node === remId) l.node = keepId;
    for (const d of doc.dims) for (const k of ['a', 'b', 'v']) if (d[k] === remId) d[k] = keepId;
    keep.hinge = keep.hinge || rem.hinge;
    if (!keep.label && rem.label) { keep.label = rem.label; keep.lx = rem.lx; keep.ly = rem.ly; }
    doc.nodes = doc.nodes.filter((n) => n.id !== remId);
    M.cleanup(doc);
  };

  M.remove = (doc, kind, id) => {
    if (kind === 'node') {
      const els = new Set(M.elementsAt(doc, id).map((e) => e.id));
      doc.elements = doc.elements.filter((e) => !els.has(e.id));
      doc.nodes = doc.nodes.filter((n) => n.id !== id);
    } else if (kind === 'element') {
      doc.elements = doc.elements.filter((e) => e.id !== id);
    } else {
      doc[COLL[kind]] = M.coll(doc, kind).filter((o) => o.id !== id);
    }
    M.cleanup(doc);
  };

  /** Entfernt ungültige Referenzen und unbenutzte Knoten. */
  M.cleanup = (doc) => {
    const nid = new Set(doc.nodes.map((n) => n.id));
    doc.elements = doc.elements.filter((e) => nid.has(e.n1) && nid.has(e.n2) && e.n1 !== e.n2);
    const eid = new Set(doc.elements.map((e) => e.id));
    doc.supports = doc.supports.filter((s) => nid.has(s.node));
    doc.loads = doc.loads.filter((l) => (l.type === 'lineload' ? eid.has(l.el) : nid.has(l.node)));
    doc.dims = doc.dims.filter((d) =>
      d.type === 'angle'
        ? nid.has(d.v) && nid.has(d.b) && (d.a == null || nid.has(d.a)) && d.v !== d.b
        : nid.has(d.a) && nid.has(d.b) && d.a !== d.b
    );
    const used = new Set();
    doc.elements.forEach((e) => { used.add(e.n1); used.add(e.n2); });
    doc.supports.forEach((s) => used.add(s.node));
    doc.loads.forEach((l) => l.node && used.add(l.node));
    doc.dims.forEach((d) => ['a', 'b', 'v'].forEach((k) => d[k] && used.add(d[k])));
    doc.nodes = doc.nodes.filter((n) => used.has(n.id));
  };

  /** Löst einen Knoten zwischen zwei gleichartigen Elementen auf (vereinigt sie). */
  M.dissolveNode = (doc, id) => {
    const els = M.elementsAt(doc, id);
    if (els.length !== 2 || els[0].type !== els[1].type) return 'Der Knoten verbindet nicht genau zwei gleichartige Elemente.';
    if (doc.supports.some((s) => s.node === id) || doc.loads.some((l) => l.node === id) ||
        doc.dims.some((d) => d.a === id || d.b === id || d.v === id))
      return 'Am Knoten hängen noch Lager, Lasten oder Maße.';
    const [e1, e2] = els;
    const reversed = e1.n1 === id;
    const o1 = M.other(e1, id), o2 = M.other(e2, id);
    e1.n1 = o1; e1.n2 = o2;
    if (reversed) for (const l of doc.loads) if (l.type === 'lineload' && l.el === e1.id) [l.qa, l.qb] = [l.qb, l.qa];
    if (!e1.label) e1.label = e2.label;
    doc.loads = doc.loads.filter((l) => !(l.type === 'lineload' && l.el === e2.id));
    doc.elements = doc.elements.filter((e) => e !== e2);
    doc.nodes = doc.nodes.filter((n) => n.id !== id);
    M.cleanup(doc);
    return null;
  };

  /** Alle Knoten, die von start aus erreichbar sind, ohne über blocked zu laufen. */
  M.reachable = (doc, start, blocked) => {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const id = stack.pop();
      for (const e of M.elementsAt(doc, id)) {
        const o = M.other(e, id);
        if (o === blocked || seen.has(o)) continue;
        seen.add(o);
        stack.push(o);
      }
    }
    return seen;
  };

  M.component = (doc, start) => M.reachable(doc, start, null);

  /**
   * Setzt den Abstand von B zu A in Richtung u (Einheitsvektor von A nach B).
   * all = true: alle Knoten "hinter" B (in Richtung u) werden mitverschoben,
   * die Elemente dazwischen wachsen dadurch mit.
   */
  M.setDistance = (doc, aId, bId, u, value, all) => {
    const A = M.node(doc, aId), B = M.node(doc, bId);
    const cur = V.dot(V.sub(B, A), u);
    const delta = value - cur;
    if (Math.abs(delta) < 1e-12) return;
    const move = (o) => { o.x = TM.clean(o.x + u.x * delta); o.y = TM.clean(o.y + u.y * delta); };
    for (const n of doc.nodes) {
      if (n.id === bId) { move(n); continue; }
      if (all && n.id !== aId && V.dot(V.sub(n, A), u) >= cur - 1e-6) move(n);
    }
    if (all) for (const t of doc.texts) if (V.dot(V.sub(t, A), u) >= cur - 1e-6) move(t);
  };

  /** Dreht Knoten B (und, falls all, alles dahinter Hängende) um V. */
  M.rotateAbout = (doc, vId, bId, deg, all, keepId) => {
    const C = M.node(doc, vId);
    let ids = all ? M.reachable(doc, bId, vId) : new Set([bId]);
    // Gelagerte Knoten (außer B selbst) bleiben fest – sonst nur B drehen
    if ((keepId && ids.has(keepId)) || [...ids].some((id) => id !== bId && doc.supports.some((s) => s.node === id)))
      ids = new Set([bId]);
    for (const n of doc.nodes) {
      if (!ids.has(n.id)) continue;
      const r = V.add(C, V.rot(V.sub(n, C), deg));
      n.x = TM.clean(r.x); n.y = TM.clean(r.y);
    }
  };

  M.swapDim = (doc, d) => {
    const A = M.node(doc, d.a), B = M.node(doc, d.b);
    if (d.type === 'h') d.off = A.y + d.off - B.y;
    else if (d.type === 'v') d.off = A.x + d.off - B.x;
    else d.off = -d.off;
    [d.a, d.b] = [d.b, d.a];
  };

  /** Ergänzt fehlende Felder (z. B. bei älteren Dateien). */
  M.normalize = (doc) => {
    const base = TM.newDoc();
    for (const k of Object.keys(base)) if (doc[k] == null) doc[k] = base[k];
    doc.meta = Object.assign(base.meta, doc.meta || {});
    M.cleanup(doc);
    return doc;
  };
})(window.TM);
