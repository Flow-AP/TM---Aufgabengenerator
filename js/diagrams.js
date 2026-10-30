'use strict';
/* Darstellung der Lösung: Schnittgrößenverläufe N, Q, M und Freikörperbild. */
(function (TM) {
  const V = TM.V, S = TM.S, P = TM.P;
  const c = (n) => Math.round(n * 100) / 100;
  const sd = (d) => ({ x: d.x, y: -d.y });
  const COLORS = (TM.DIAG_COLORS = { N: '#2e7d32', Q: '#1565c0', M: '#c62828', R: '#c62828', C: '#7b1fa2' });
  const EPS = 1e-7;

  TM.supportName = (doc, s) => {
    const n = doc.nodes.find((k) => k.id === s.node);
    if (n && n.label) return n.label;
    return 'L' + (doc.supports.indexOf(s) + 1);
  };

  /** Name einer Reaktionskomponente, z. B. A_H, A_V, M_A, B. */
  TM.reactionName = (doc, s, comp) => {
    const n = TM.supportName(doc, s);
    const sub = (b, i) => `${b}_{${i}}`;
    if (comp.c === 'x') return sub(n, 'H');
    if (comp.c === 'y') return sub(n, 'V');
    if (comp.c === 'm') return sub('M', n);
    if (Math.abs(comp.f.x) < 1e-9) return sub(n, 'V');
    if (Math.abs(comp.f.y) < 1e-9) return sub(n, 'H');
    return n;
  };

  TM.memberName = (doc, e) => {
    if (e.label) return e.label;
    const n1 = doc.nodes.find((n) => n.id === e.n1), n2 = doc.nodes.find((n) => n.id === e.n2);
    if (n1 && n1.label && n2 && n2.label) return n1.label + n2.label;
    return 'Element ' + (doc.elements.indexOf(e) + 1);
  };

  const recolor = (svg, col) => svg.replace(/#111/g, col);

  /**
   * Kraftpfeile im tatsächlichen Wirkungssinn mit Betrag.
   * items: [{n (Weltpunkt), elDirs (Bildschirmrichtungen), beam, comps: [{name, f?, m?, v}]}]
   */
  function arrowsSVG(doc, items, u, col) {
    let s = '';
    const bw = doc.meta.beamStyle === 'solid' ? TM.STY.solid : TM.STY.bw;
    for (const it of items) {
      const n = it.n, p = P(n), elDirs = it.elDirs;
      for (const cp of it.comps) {
        const name = cp.name;
        if (Math.abs(cp.v) < EPS) continue;
        if (cp.m) {
          const L = { r: 24, gap: cp.gap ?? 135, ccw: cp.v > 0, label: '' };
          const m = TM.momentSVG(L, n).svg;
          const t = TM.textSVG(name + ' = ', p.x - 30, p.y + 34, { anchor: 'end', size: 14, suffix: `${TM.fmtNum(Math.abs(cp.v))} ${u.M}` });
          s += recolor(m + t, col);
          continue;
        }
        const dir = sd(V.norm(V.mul(cp.f, cp.v)));
        // Pfeil auf die Seite legen, die am weitesten von den angeschlossenen Elementen entfernt ist
        const away = (bd) => Math.min(...elDirs.map((ed) => V.dot(bd, ed) > 0.999 ? 0 : Math.acos(Math.max(-1, Math.min(1, V.dot(bd, ed))))), Math.PI);
        const pushBody = V.mul(dir, -1);
        const pull = away(dir) > away(pushBody) + 0.05;
        const trim = it.beam ? bw / 2 + 1 : 4;
        let tip, tail;
        if (!pull) { tip = V.sub(p, V.mul(dir, trim)); tail = V.sub(tip, V.mul(dir, 50)); }
        else { tail = V.add(p, V.mul(dir, trim)); tip = V.add(tail, V.mul(dir, 50)); }
        const txt = `${TM.fmtNum(Math.abs(cp.v))} ${u.F}`;
        const mid = V.lerp(tail, tip, 0.5);
        const vertical = Math.abs(dir.y) > Math.abs(dir.x);
        const lp = vertical ? { x: mid.x + 7, y: mid.y } : { x: mid.x, y: mid.y + 12 };
        s += recolor(TM.arrowSVG(tail, tip, { w: 2, hl: 11, hw: 4.2 }) +
          TM.textSVG(name + ' = ', lp.x, lp.y, { anchor: vertical ? 'start' : 'middle', size: 14, suffix: txt }), col);
      }
    }
    return `<g>${s}</g>`;
  }

  const dirsAt = (doc, n, els) => els.map((e) => {
    const o = doc.nodes.find((k) => k.id === (e.n1 === n.id ? e.n2 : e.n1));
    return sd(V.norm(V.sub(o, n)));
  });

  function reactionsSVG(doc, res, u) {
    const items = res.reactions.map((r) => {
      const n = doc.nodes.find((k) => k.id === r.s.node);
      const atN = doc.elements.filter((e) => e.n1 === n.id || e.n2 === n.id);
      return {
        n, beam: atN.some((e) => e.type === 'beam'), elDirs: dirsAt(doc, n, atN),
        comps: r.comps.map((cp) => ({ ...cp, name: TM.reactionName(doc, r.s, cp) })),
      };
    });
    return arrowsSVG(doc, items, u, COLORS.R);
  }

  // ---------------------------------------------------------------- Freischneiden
  /** Starre Körper (biegesteif verbundene Balken) wie im Rechenkern. */
  TM.bodies = function (doc) {
    const parent = new Map();
    const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    for (const e of doc.elements) if (e.type === 'beam') parent.set(e.id, e.id);
    for (const n of doc.nodes) {
      if (n.hinge) continue;
      const els = doc.elements.filter((e) => e.n1 === n.id || e.n2 === n.id);
      const beams = els.filter((e, i) => e.type === 'beam' && !(n.joint && i === 0));
      for (let i = 1; i < beams.length; i++) parent.set(find(beams[i].id), find(beams[0].id));
    }
    const map = new Map();
    for (const e of doc.elements) {
      if (e.type !== 'beam') continue;
      const r = find(e.id);
      if (!map.has(r)) map.set(r, { elements: [], nodes: new Set() });
      const b = map.get(r);
      b.elements.push(e); b.nodes.add(e.n1); b.nodes.add(e.n2);
    }
    const list = [...map.values()];
    list.forEach((b, i) => { b.index = i; b.elSet = new Set(b.elements.map((e) => e.id)); });
    return list;
  };

  /** Äußere Last am Knoten (inkl. berechneter gesuchter Lasten). */
  function nodeExt(doc, res, nid) {
    let F = { x: 0, y: 0 }, Mz = 0;
    const g9 = TM.gUnit(doc);
    for (const l of doc.loads) {
      if (l.node !== nid) continue;
      const uk = res.unknownLoads.find((x) => x.l === l);
      const v = uk ? uk.v : +l.value || 0;
      if (l.type === 'force') F = V.add(F, V.mul(V.dir(l.angle), v));
      else if (l.type === 'moment') Mz += (l.ccw !== false ? 1 : -1) * v;
      else if (l.type === 'mass') F = V.add(F, { x: 0, y: -g9 * v });
    }
    for (const r of res.reactions) {
      if (r.s.node !== nid) continue;
      for (const cp of r.comps) {
        if (cp.f) F = V.add(F, V.mul(cp.f, cp.v)); else Mz += cp.v;
      }
    }
    return { F, Mz };
  }

  /**
   * Freigeschnittene Darstellung: jeder Körper einzeln, gegeneinander verschoben,
   * mit Lagerreaktionen und Schnittkräften an den Verbindungen.
   */
  function cutSVG(doc, res, u, top, solved) {
    const bodies = TM.bodies(doc);
    if (!bodies.length) return { svg: '', bottom: top };
    const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
    const x = res.x;
    // Eigentümer der Knotenlasten/Lager: Körper des ersten Elements am Knoten (wie im Rechenkern)
    const owner = new Map();
    for (const n of doc.nodes) {
      const els = doc.elements.filter((e) => e.n1 === n.id || e.n2 === n.id);
      const first = els[0] && els[0].type === 'beam' ? els[0] : els.find((e) => e.type === 'beam');
      if (first) owner.set(n.id, bodies.find((b) => b.elSet.has(first.id)));
    }
    // Verschiebung der Körper (vom Gesamtschwerpunkt weg)
    const cen = (ids) => { let sx = 0, sy = 0; for (const id of ids) { sx += nodes.get(id).x; sy += nodes.get(id).y; } return { x: sx / ids.length, y: sy / ids.length }; };
    const all = cen([...new Set(bodies.flatMap((b) => [...b.nodes]))]);
    const ext = (k) => Math.max(...doc.nodes.map((n) => n[k])) - Math.min(...doc.nodes.map((n) => n[k]));
    const gap = Math.max(2.2, 0.25 * Math.max(ext('x'), ext('y')));
    for (const b of bodies) {
      const cb = cen([...b.nodes]);
      const d = V.sub(cb, all);
      b.off = bodies.length > 1 && V.len(d) > 1e-6 ? V.mul(V.norm(d), gap) : { x: 0, y: 0 };
    }
    let minY = Infinity, maxY = -Infinity;
    for (const b of bodies) for (const id of b.nodes) { const y = nodes.get(id).y + b.off.y; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const dy = top - 95 / S - maxY;
    // Kopie des Dokuments mit getrennten Körpern
    const cd = TM.newDoc();
    cd.meta = { ...doc.meta };
    const items = [];
    for (const b of bodies) {
      const off = { x: b.off.x, y: b.off.y + dy };
      const map = new Map();
      const N = (id) => {
        if (!map.has(id)) {
          const n = nodes.get(id);
          const cn = { ...n, id: n.id + '#' + b.index, x: n.x + off.x, y: n.y + off.y, hinge: false, joint: null };
          delete cn.pulley;
          cd.nodes.push(cn);
          map.set(id, cn);
        }
        return map.get(id).id;
      };
      for (const e of b.elements) cd.elements.push({ ...e, id: e.id + '#' + b.index, n1: N(e.n1), n2: N(e.n2) });
      for (const l of doc.loads) {
        if (l.type === 'lineload' ? b.elSet.has(l.el) : owner.get(l.node) === b && b.nodes.has(l.node))
          cd.loads.push({ ...l, id: l.id, node: l.node && N(l.node), el: l.el && l.el + '#' + b.index });
      }
      // Lagerreaktionen und Schnittkräfte je Knoten des Körpers
      for (const nid of b.nodes) {
        const n = nodes.get(nid), cn = map.get(nid);
        const myEls = b.elements.filter((e) => e.n1 === nid || e.n2 === nid);
        const allEls = doc.elements.filter((e) => e.n1 === nid || e.n2 === nid);
        let f = { x: 0, y: 0 }, m = 0;
        for (const e of myEls) {
          const o = res.ends.get(e.id + ':' + (e.n1 === nid ? 1 : 2));
          f = V.add(f, { x: x[o.fx], y: x[o.fy] });
          if (o.m >= 0) m += x[o.m];
        }
        const own = owner.get(nid) === b;
        if (own) {
          const ext = nodeExt(doc, res, nid);
          f = V.sub(f, ext.F); m -= ext.Mz;
          const r = res.reactions.find((rr) => rr.s.node === nid);
          if (r) items.push({ n: cn, beam: true, elDirs: dirsAt(cd, cn, cd.elements.filter((e) => e.n1 === cn.id || e.n2 === cn.id)), col: COLORS.R,
            comps: r.comps.map((cp) => ({ ...cp, name: TM.reactionName(doc, r.s, cp) })) });
        }
        // Kraft der Nachbarn auf diesen Körper = f (Kraft des Knotens auf die eigenen Elementenden)
        if (V.len(f) < EPS && Math.abs(m) < EPS) continue;
        const others = allEls.filter((e) => !b.elSet.has(e.id));
        const nm = n.label || 'G';
        const comps = [];
        if (others.length === 1 && others[0].type !== 'beam') {
          const oe = others[0], o = res.ends.get(oe.id + ':' + (oe.n1 === nid ? 1 : 2));
          const w = V.norm(V.sub(o.P, res.ends.get(oe.id + ':' + (oe.n1 === nid ? 2 : 1)).P));
          const S0 = -V.dot(f, w); // Zugkraft im Stab/Seil
          comps.push({ name: `S_{${TM.memberName(doc, oe)}}`, f: V.mul(w, -1), v: S0 });
          void S0;
        } else {
          comps.push({ name: `${nm}_{H}`, f: { x: 1, y: 0 }, v: f.x }, { name: `${nm}_{V}`, f: { x: 0, y: 1 }, v: f.y });
        }
        if (Math.abs(m) > EPS) comps.push({ name: `M_{${nm}}`, m: 1, v: m, gap: -45 });
        items.push({ n: cn, beam: true, elDirs: dirsAt(cd, cn, cd.elements.filter((e) => e.n1 === cn.id || e.n2 === cn.id)), col: COLORS.C, comps });
      }
    }
    let svg = TM.render(cd, { edit: false, hideSupports: true, solved });
    for (const it of items) svg += arrowsSVG(cd, [it], u, it.col);
    const xs = cd.nodes.map((n) => n.x);
    const lp = P({ x: Math.min(...xs), y: maxY + dy });
    svg += TM.textSVG('Freigeschnitten:', lp.x - 30, lp.y - 62, { anchor: 'start', size: 16, italic: false, fill: COLORS.C });
    return { svg, bottom: minY + dy - 75 / S };
  }

  function fiber(doc, dy, gapPx) {
    let s = '';
    for (const e of doc.elements) {
      if (e.type !== 'beam') continue;
      const A = doc.nodes.find((n) => n.id === e.n1), B = doc.nodes.find((n) => n.id === e.n2);
      const u = V.norm(V.sub(B, A)), z = { x: u.y, y: -u.x };
      const a = P({ x: A.x, y: A.y + dy }), b = P({ x: B.x, y: B.y + dy });
      const zs = sd(z), us = sd(u), L = V.dist(a, b);
      const sh = Math.min(6, L * 0.1);
      const p1 = V.add(V.add(a, V.mul(us, sh)), V.mul(zs, gapPx)), p2 = V.add(V.sub(b, V.mul(us, sh)), V.mul(zs, gapPx));
      s += `<line x1="${c(p1.x)}" y1="${c(p1.y)}" x2="${c(p2.x)}" y2="${c(p2.y)}" stroke="#111" stroke-width="0.9" stroke-dasharray="5 3"/>`;
    }
    return s;
  }

  function diagram(doc, res, t, dy, k, labels, u) {
    const col = COLORS[t], unit = t === 'M' ? u.M : u.F;
    let s = '';
    for (const m of res.members) {
      const vals = m[t];
      if (t === 'N' && m.e.type !== 'beam') {
        // Pendelstab/Seil: konstante Normalkraft als Wert am Stab
        const a = P({ x: m.A.x, y: m.A.y + dy }), b = P({ x: m.B.x, y: m.B.y + dy });
        const v = vals[0];
        s += `<line x1="${c(a.x)}" y1="${c(a.y)}" x2="${c(b.x)}" y2="${c(b.y)}" stroke="${col}" stroke-width="${Math.abs(v) > EPS ? 3.2 : 1.6}" stroke-opacity="0.8"${v < -EPS ? ' stroke-dasharray="7 4"' : ''}/>`;
        const mid = V.lerp(a, b, 0.5), us = V.norm(V.sub(b, a));
        let nrm = { x: -us.y, y: us.x };
        if (nrm.y > 0) nrm = V.mul(nrm, -1);
        // vertikale Stäbe: Wert auf der vom Schwerpunkt abgewandten Seite
        const cx = res.members.reduce((acc, mm) => acc + (mm.A.x + mm.B.x) / 2, 0) / res.members.length * S;
        if (Math.abs(nrm.x) > 0.7 && (mid.x - cx) * nrm.x < 0) nrm = V.mul(nrm, -1);
        const txt = TM.fmtNum(v);
        const pos = V.add(mid, V.mul(nrm, 9 + Math.abs(nrm.x) * TM.textWidth(txt, 13) / 2));
        s += `<text x="${c(pos.x)}" y="${c(pos.y)}" font-family="${TM.STY.font}" font-size="13" text-anchor="middle" dominant-baseline="central" fill="${col}" stroke="#fff" stroke-width="3" paint-order="stroke">${txt}</text>`;
        continue;
      }
      if (!vals.some((v) => Math.abs(v) > EPS)) continue;
      const dirW = t === 'M' ? m.z : V.mul(m.z, -1);
      const ds = sd(dirW);
      const base = (x) => P({ x: m.A.x + m.u.x * x, y: m.A.y + m.u.y * x + dy });
      const pts = m.xs.map((x, i) => V.add(base(x), V.mul(ds, vals[i] * k)));
      const b0 = base(0), b1 = base(m.L);
      const poly = [b0, ...pts, b1].map((q) => `${c(q.x)},${c(q.y)}`).join(' ');
      s += `<polygon points="${poly}" fill="${col}" fill-opacity="0.13" stroke="none"/>`;
      // Schraffur senkrecht zur Stabachse
      const Lpx = m.L * S, nh = Math.max(1, Math.round(Lpx / 9));
      let h = '';
      for (let i = 1; i < nh; i++) {
        const x = (m.L * i) / nh, v = m.at(x)[t];
        if (Math.abs(v * k) < 1.5) continue;
        const b = base(x), q = V.add(b, V.mul(ds, v * k));
        h += `M${c(b.x)} ${c(b.y)}L${c(q.x)} ${c(q.y)}`;
      }
      if (h) s += `<path d="${h}" stroke="${col}" stroke-width="0.6" stroke-opacity="0.75" fill="none"/>`;
      s += `<polyline points="${poly}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>`;
      // Werte an den Rändern und Extremstellen
      const spots = [0, m.L, ...(t === 'M' ? m.ext : [])];
      for (const x of spots) {
        const v = m.at(x)[t];
        if (Math.abs(v) < EPS) continue;
        const q = V.add(base(x), V.mul(ds, v * k));
        const out = V.mul(ds, Math.sign(v) || 1);
        const txt = TM.fmtNum(v);
        const w = TM.textWidth(txt, 13);
        const pos = V.add(q, V.mul(out, 6 + Math.abs(out.x) * w / 2 + Math.abs(out.y) * 7));
        if (labels.some((l) => l.t === txt && V.dist(l.p, pos) < 28)) continue;
        labels.push({ t: txt, p: pos });
        s += `<text x="${c(pos.x)}" y="${c(pos.y)}" font-family="${TM.STY.font}" font-size="13" text-anchor="middle" dominant-baseline="central" fill="${col}" stroke="#fff" stroke-width="3" paint-order="stroke">${txt}</text>`;
      }
      // Vorzeichen
      const vm = m.at(m.L / 2)[t];
      const vmax = Math.max(...vals.map(Math.abs));
      if (Math.abs(vm) > 0.2 * vmax && Lpx > 40) {
        const q = V.add(base(m.L / 2), V.mul(ds, vm * k * 0.45));
        s += `<text x="${c(q.x)}" y="${c(q.y)}" font-family="system-ui,sans-serif" font-size="13" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="${col}">${vm > 0 ? '+' : '−'}</text>`;
      }
    }
    void unit;
    return s;
  }

  /**
   * o.show: {N,Q,M}, o.layout: 'stack' | 'overlay', o.scale, o.freebody.
   * Liefert SVG (Zeichenkoordinaten), das über das Tragwerk gelegt wird.
   */
  TM.renderSolution = function (doc, res, o = {}) {
    if (!res || !res.members) return '';
    const u = TM.units(doc);
    const hasBeam = res.members.some((m) => m.e.type === 'beam');
    const types = ['N', 'Q', 'M'].filter((t) => o.show && o.show[t] && (t === 'N' || hasBeam) &&
      res.members.some((m) => m[t].some((v) => Math.abs(v) > EPS) || (t === 'N' && m.e.type !== 'beam')));
    const amp = 42 * (o.scale || 1);
    const ys = doc.nodes.map((n) => n.y), xs = doc.nodes.map((n) => n.x);
    const minY = Math.min(...ys), maxY = Math.max(...ys), minX = Math.min(...xs);
    // Unterkante der Aufgabenskizze (inkl. Maßlinien und Lager)
    let bottom = minY - 45 / S;
    for (const d of doc.dims) {
      if (d.type === 'angle') continue;
      const A = doc.nodes.find((n) => n.id === d.a), B = doc.nodes.find((n) => n.id === d.b);
      const g = TM.dimGeom(d, A, B);
      bottom = Math.min(bottom, g.D1.y - 30 / S, g.D2.y - 30 / S);
    }
    let s = '';
    if (o.freebody) s += reactionsSVG(doc, res, u);
    if (o.cut) {
      const solved = new Map(res.unknownLoads.map((q) => [q.l.id, q.v]));
      const r = cutSVG(doc, res, u, bottom, solved);
      s += r.svg;
      bottom = r.bottom;
    }
    const labels = [];
    const showFiber = types.some((t) => t === 'M' || t === 'Q');
    const bw = doc.meta.beamStyle === 'solid' ? TM.STY.solid : TM.STY.bw;
    if (o.layout === 'overlay') {
      if (showFiber) s += fiber(doc, 0, bw / 2 + 3);
      // Diagramme am Tragwerk; die freigeschnittene Darstellung steht darunter
      for (const t of types) {
        const mx = Math.max(EPS, ...res.members.map((m) => Math.max(...m[t].map(Math.abs))));
        s += diagram(doc, res, t, 0, amp / mx, labels, u);
      }
      return s;
    }
    let prevBottom = bottom;
    for (const t of types) {
      const mx = Math.max(EPS, ...res.members.map((m) => Math.max(...m[t].map(Math.abs))));
      const dy = prevBottom - 30 / S - amp / S - maxY;
      prevBottom = minY + dy - amp / S - 18 / S;
      // Systemlinien
      let ax = '';
      for (const m of res.members) {
        const A = m.A, B = m.B;
        const a = P({ x: A.x, y: A.y + dy }), b = P({ x: B.x, y: B.y + dy });
        ax += `M${c(a.x)} ${c(a.y)}L${c(b.x)} ${c(b.y)}`;
      }
      s += `<path d="${ax}" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      if (t !== 'N') s += fiber(doc, dy, 3);
      s += diagram(doc, res, t, dy, amp / mx, labels, u);
      const lp = P({ x: minX, y: (minY + maxY) / 2 + dy });
      s += TM.textSVG(t, lp.x - 40, lp.y, { anchor: 'end', size: 20, fill: COLORS[t], suffix: ` [${t === 'M' ? u.M : u.F}]` }).replace('font-size="20"', 'font-size="20" font-weight="bold"');
    }
    return s;
  };
})(window.TM);
