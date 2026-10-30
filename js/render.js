'use strict';
/*
 * Darstellung als SVG im Lehrbuchstil.
 * Zeichenkoordinaten: 1 Längeneinheit = TM.S px, y nach unten.
 */
(function (TM) {
  const V = TM.V;
  const S = (TM.S = 40);
  const STY = (TM.STY = {
    bw: 9, bwi: 5, solid: 5, rod: 2.2, rope: 1.4, hinge: 3.8,
    ink: '#111', font: 'Times New Roman, Times, serif', fs: 17,
  });
  const ink = STY.ink;
  const c = (n) => Math.round(n * 100) / 100;
  const esc = (TM.esc = (s) =>
    String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])));
  const P = (TM.P = (p) => ({ x: p.x * S, y: -p.y * S }));
  const sd = (d) => ({ x: d.x, y: -d.y });

  TM.fmtNum = (v, dec = 2) => {
    const f = 10 ** dec;
    return String(Math.round(v * f) / f).replace('.', ',');
  };

  // ---------------------------------------------------------------- Text
  const GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
    theta: 'ϑ', vartheta: 'ϑ', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
    sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    cdot: '·', deg: '°', infty: '∞',
  };

  /** "F_1", "q_{0}", "x^2", "\alpha" → Segmente mit Hoch-/Tiefstellung. */
  function parseRich(s) {
    s = String(s ?? '').replace(/\\([A-Za-z]+)/g, (m, w) => GREEK[w] ?? m);
    const segs = [];
    let i = 0, cur = '';
    while (i < s.length) {
      const ch = s[i];
      if ((ch === '_' || ch === '^') && i + 1 < s.length) {
        if (cur) { segs.push({ t: cur, m: 0 }); cur = ''; }
        let t;
        if (s[i + 1] === '{') {
          const j = s.indexOf('}', i + 2);
          t = j < 0 ? s.slice(i + 2) : s.slice(i + 2, j);
          i = j < 0 ? s.length : j + 1;
        } else { t = s[i + 1]; i += 2; }
        segs.push({ t, m: ch === '_' ? 1 : -1 });
        continue;
      }
      cur += ch; i++;
    }
    if (cur) segs.push({ t: cur, m: 0 });
    return segs;
  }
  TM.parseRich = parseRich;

  TM.textWidth = (s, size = STY.fs) =>
    parseRich(s).reduce((w, g) => w + g.t.length * (g.m ? 0.7 : 1), 0) * size * 0.5;

  const LETTER = /[A-Za-zα-ωΑ-Ωϑφ]/;
  const RUNS = /[A-Za-zα-ωΑ-Ωϑφ]+|[^A-Za-zα-ωΑ-Ωϑφ]+/g;

  function textSVG(s, x, y, o = {}) {
    const size = o.size || STY.fs, anchor = o.anchor || 'middle', italic = o.italic !== false;
    let inner = '', shift = 0;
    for (const g of parseRich(s)) {
      const target = g.m === 1 ? size * 0.32 : g.m === -1 ? -size * 0.4 : 0;
      const dy = target - shift;
      shift = target;
      (g.t.match(RUNS) || []).forEach((r, k) => {
        const it = italic && LETTER.test(r[0]);
        inner += `<tspan${k === 0 && dy ? ` dy="${c(dy)}"` : ''}${g.m ? ` font-size="${c(size * 0.7)}"` : ''}${
          it ? ' font-style="italic"' : ''}>${esc(r)}</tspan>`;
      });
    }
    if (o.suffix) inner += `<tspan${shift ? ` dy="${c(-shift)}"` : ''}>${esc(o.suffix)}</tspan>`;
    const rot = o.rot ? ` transform="rotate(${c(o.rot)} ${c(x)} ${c(y)})"` : '';
    return `<text x="${c(x)}" y="${c(y)}" font-family="${STY.font}" font-size="${c(size)}" text-anchor="${anchor}" dominant-baseline="central" fill="${o.fill || ink}"${rot}${o.attrs || ''}>${inner}</text>`;
  }
  TM.textSVG = textSVG;

  // ---------------------------------------------------------------- Grundformen
  const line = (a, b, w = 1, extra = '') =>
    `<line x1="${c(a.x)}" y1="${c(a.y)}" x2="${c(b.x)}" y2="${c(b.y)}" stroke="${ink}" stroke-width="${w}"${extra}/>`;

  function headPts(tip, d, L, W) {
    const b = V.sub(tip, V.mul(d, L)), n = { x: -d.y, y: d.x };
    return `${c(tip.x)},${c(tip.y)} ${c(b.x + n.x * W)},${c(b.y + n.y * W)} ${c(b.x - n.x * W)},${c(b.y - n.y * W)}`;
  }
  const head = (tip, d, L, W) => `<polygon class="fk" points="${headPts(tip, d, L, W)}" fill="${ink}" stroke="none"/>`;

  function arrow(tail, tip, o = {}) {
    const w = o.w || 2, L = o.hl || 11, W = o.hw || 4.2;
    const d = V.norm(V.sub(tip, tail));
    const base = V.sub(tip, V.mul(d, L * 0.8));
    return line(tail, base, w) + head(tip, d, L, W);
  }
  TM.arrowSVG = arrow;

  function ground(y, x0, x1, thick = 1.8) {
    let h = '';
    for (let x = x0 + 5; x <= x1 + 0.01; x += 5) h += `M${c(x)} ${c(y)}l-5 6`;
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${ink}" stroke-width="${thick}" stroke-linecap="round"/>` +
      `<path d="${h}" stroke="${ink}" stroke-width="1" fill="none"/>`;
  }

  /** Lagerform im lokalen System: Knoten im Ursprung, Boden in +y. */
  TM.supportShape = function (type, off = 0) {
    const st = `stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"`;
    switch (type) {
      case 'fest':
        return `<polygon points="0,0 -11,17 11,17" fill="#fff" ${st}/>` + ground(17, -17, 17);
      case 'los':
        return `<polygon points="0,0 -11,15 11,15" fill="#fff" ${st}/>` + ground(20, -17, 17);
      case 'clamp':
        return ground(off, -18, 18, 2.4);
      case 'schiebe':
        return `<line x1="-13" y1="${off}" x2="13" y2="${off}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>` +
          `<circle cx="-7.5" cy="${off + 3.9}" r="3.1" fill="#fff" ${st}/><circle cx="7.5" cy="${off + 3.9}" r="3.1" fill="#fff" ${st}/>` +
          ground(off + 7.8, -17, 17);
      case 'gleit':
        return `<polygon points="0,0 -11,15 11,15" fill="#fff" ${st}/>` +
          `<circle cx="-6" cy="18.3" r="3" fill="#fff" ${st}/><circle cx="6" cy="18.3" r="3" fill="#fff" ${st}/>` + ground(21.6, -17, 17);
      default:
        return '';
    }
  };

  function springPath(a, b) {
    const L = V.dist(a, b);
    if (L < 1) return '';
    const u = V.norm(V.sub(b, a)), n = V.perp(u);
    const lead = Math.min(10, L * 0.2), zl = L - 2 * lead, k = 8, amp = 6;
    let d = `M${c(a.x)} ${c(a.y)}`;
    const p0 = V.add(a, V.mul(u, lead));
    d += `L${c(p0.x)} ${c(p0.y)}`;
    for (let i = 0; i < k; i++) {
      const q = V.add(V.add(a, V.mul(u, lead + (zl * (i + 0.5)) / k)), V.mul(n, i % 2 ? -amp : amp));
      d += `L${c(q.x)} ${c(q.y)}`;
    }
    const p1 = V.sub(b, V.mul(u, lead));
    d += `L${c(p1.x)} ${c(p1.y)}L${c(b.x)} ${c(b.y)}`;
    return d;
  }

  /** Kanonische Normale (zeigt nach oben bzw. links) – bestimmt "Seite" von Streckenlast & Beschriftung. */
  TM.upNormal = function (A, B) {
    let n = V.perp(V.norm(V.sub(B, A)));
    if (n.y < -1e-9 || (Math.abs(n.y) < 1e-9 && n.x > 0)) n = V.mul(n, -1);
    return n;
  };

  // ---------------------------------------------------------------- Lasten
  /** Endpunkte (Zeichenkoordinaten) einer Einzelkraft. */
  TM.forceEnds = function (doc, L) {
    const n = doc.nodes.find((k) => k.id === L.node);
    const els = doc.elements.filter((e) => e.n1 === n.id || e.n2 === n.id);
    const bw = doc.meta.beamStyle === 'solid' ? STY.solid : STY.bw;
    const s = doc.supports.find((x) => x.node === n.id);
    const ctx = {
      bw, beamAt: new Set(els.some((e) => e.type === 'beam') ? [n.id] : []),
      pinAt: new Set(n.hinge || els.some((e) => e.type === 'rod') || (s && s.type !== 'clamp' && s.type !== 'schiebe') ? [n.id] : []),
      lab: () => ({ t: '' }),
    };
    const r = forceSVG(L, n, ctx);
    return { tail: r.tail, tip: r.tip };
  };

  function forceSVG(L, n, ctx) {
    const p = P(n);
    const d = sd(V.dir(L.angle));
    const len = L.len || 55;
    const trim = ctx.beamAt.has(L.node) ? ctx.bw / 2 + 1 : ctx.pinAt.has(L.node) ? STY.hinge + 1 : 0;
    const tipMode = L.tip !== false;
    let tip, tail;
    if (tipMode) { tip = V.sub(p, V.mul(d, trim)); tail = V.sub(tip, V.mul(d, len)); }
    else { tail = V.add(p, V.mul(d, trim)); tip = V.add(tail, V.mul(d, len)); }
    let s = arrow(tail, tip, { w: 2.2, hl: 12, hw: 4.5 });
    const lab = ctx.lab(L);
    if (lab.t) {
      const end = tipMode ? tail : tip, out = tipMode ? V.mul(d, -1) : d;
      const w = TM.textWidth(lab.t);
      const dist = 7 + Math.abs(out.x) * w / 2 + Math.abs(out.y) * STY.fs * 0.5;
      s += textSVG(lab.t, end.x + out.x * dist, end.y + out.y * dist, { italic: lab.it });
    }
    if (L.angRef === 'h' || L.angRef === 'v') {
      const center = tipMode ? tip : tail;
      const body = tipMode ? V.mul(d, -1) : d;
      const ref = L.angRef === 'h' ? { x: body.x >= 0 ? 1 : -1, y: 0 } : { x: 0, y: body.y >= 0 ? 1 : -1 };
      const r = Math.min(len * 0.6, 34);
      s += line(center, V.add(center, V.mul(ref, r + 12)), 0.9, ' stroke-dasharray="4 3"');
      s += arcSVG(center, ref, body, r, false) ;
      const mid = V.norm(V.add(ref, body));
      const al = ctx.values ? TM.fmtNum(TM.forceRefAngle(L), 1) + '°' : L.angLabel;
      const aw = TM.textWidth(al || '', STY.fs * 0.9);
      const ad = r + 7 + Math.abs(mid.x) * aw / 2 + Math.abs(mid.y) * STY.fs * 0.4;
      if (al) s += textSVG(al, center.x + mid.x * ad, center.y + mid.y * ad, { size: STY.fs * 0.9 });
    }
    return { svg: s, tail, tip };
  }

  /** Bogen um center von Richtung d1 nach d2 (Bildschirmrichtungen). */
  function arcSVG(center, d1, d2, r, reflex) {
    const cr = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cr) < 1e-6 && V.dot(d1, d2) > 0) return '';
    const p1 = V.add(center, V.mul(d1, r)), p2 = V.add(center, V.mul(d2, r));
    let sweep = cr > 0 ? 1 : 0;
    if (reflex) sweep = 1 - sweep;
    return `<path d="M${c(p1.x)} ${c(p1.y)}A${c(r)} ${c(r)} 0 ${reflex ? 1 : 0} ${sweep} ${c(p2.x)} ${c(p2.y)}" stroke="${ink}" stroke-width="1" fill="none"/>`;
  }

  function momentSVG(L, n, ctx) {
    const p = P(n), r = L.r || 20, gap = L.gap ?? -90, sg = L.ccw !== false ? 1 : -1;
    const pt = (deg) => ({ x: p.x + r * Math.cos((deg * Math.PI) / 180), y: p.y - r * Math.sin((deg * Math.PI) / 180) });
    const start = gap + 45 * sg, end = gap + 315 * sg;
    const dth = ((10 * 0.8) / r) * (180 / Math.PI);
    const arcEnd = end - sg * dth;
    const a = pt(start), b = pt(arcEnd), tip = pt(end);
    const sweep = sg > 0 ? 0 : 1;
    let s = `<path d="M${c(a.x)} ${c(a.y)}A${r} ${r} 0 1 ${sweep} ${c(b.x)} ${c(b.y)}" stroke="${ink}" stroke-width="2" fill="none"/>`;
    // Tangente am Pfeilende
    const tw = sg > 0 ? { x: -Math.sin((end * Math.PI) / 180), y: Math.cos((end * Math.PI) / 180) }
                      : { x: Math.sin((end * Math.PI) / 180), y: -Math.cos((end * Math.PI) / 180) };
    const dir = V.norm(V.add(sd(tw), V.mul(V.norm(V.sub(tip, b)), 1)));
    s += head(tip, dir, 10, 4);
    const lab = ctx ? ctx.lab(L) : { t: L.label, it: true };
    if (lab.t) {
      const la = gap + 135, w = TM.textWidth(lab.t);
      const dv = V.dir(la);
      const dist = r + 8 + Math.abs(dv.x) * w / 2 + Math.abs(dv.y) * STY.fs * 0.45;
      s += textSVG(lab.t, p.x + dv.x * dist, p.y - dv.y * dist, { italic: lab.it });
    }
    const hit = `<circle class="hit" cx="${c(p.x)}" cy="${c(p.y)}" r="${r}" fill="none"/>`;
    return { svg: s, hit };
  }

  TM.momentSVG = (L, n, ctx) => momentSVG(L, n, ctx);

  function lineloadSVG(L, el, A, B, ctx) {
    const a = P(A), b = P(B);
    const Lpx = V.dist(a, b);
    if (Lpx < 1) return { svg: '', hit: '' };
    const sideSg = L.side === -1 ? -1 : 1;
    const topW = L.dir === 'vert' ? { x: 0, y: sideSg } : V.mul(TM.upNormal(A, B), sideSg);
    const ts = sd(topW);
    const qa = +L.qa || 0, qb = +L.qb || 0;
    const qm = Math.max(Math.abs(qa), Math.abs(qb)) || 1;
    const H = L.h || 28;
    const hAt = (t) => (H * Math.abs(qa + (qb - qa) * t)) / qm;
    const uS = V.norm(V.sub(b, a)), nS = V.perp(uS);
    const cosv = Math.max(0.3, Math.abs(V.dot(ts, nS)));
    const gap = (el.type === 'beam' ? ctx.bw / 2 + 1 : 2.5) / cosv;
    const base = (t) => V.add(V.lerp(a, b, t), V.mul(ts, gap));
    const top = (t) => V.add(base(t), V.mul(ts, hAt(t)));
    let s = '';
    const cnt = Math.max(2, Math.round(Lpx / 16));
    for (let i = 0; i <= cnt; i++) {
      const t = i / cnt;
      if (hAt(t) > 6) s += arrow(top(t), base(t), { w: 1, hl: 7, hw: 2.6 });
      else if (hAt(t) > 0.5) s += line(top(t), base(t), 1);
    }
    s += line(top(0), top(1), 1.2);
    const lab = ctx.lab(L);
    if (lab.t) {
      const tl = Math.abs(qa - qb) < 1e-9 ? 0.5 : Math.abs(qb) > Math.abs(qa) ? 0.88 : 0.12;
      const q = top(tl), w = TM.textWidth(lab.t);
      const dist = 6 + Math.abs(ts.x) * w / 2 + Math.abs(ts.y) * STY.fs * 0.5;
      s += textSVG(lab.t, q.x + ts.x * dist, q.y + ts.y * dist, { italic: lab.it });
    }
    const pts = [base(0), base(1), top(1), top(0)].map((q) => `${c(q.x)},${c(q.y)}`).join(' ');
    return { svg: s, hit: `<polygon class="hitr" points="${pts}"/>` };
  }

  // ---------------------------------------------------------------- Maße
  TM.dimGeom = function (d, A, B) {
    let n, D1, D2, val;
    if (d.type === 'h') {
      val = Math.abs(B.x - A.x); n = { x: 0, y: 1 };
      D1 = { x: A.x, y: A.y + d.off }; D2 = { x: B.x, y: A.y + d.off };
    } else if (d.type === 'v') {
      val = Math.abs(B.y - A.y); n = { x: 1, y: 0 };
      D1 = { x: A.x + d.off, y: A.y }; D2 = { x: A.x + d.off, y: B.y };
    } else {
      val = V.dist(A, B);
      n = V.perp(V.norm(V.sub(B, A)));
      D1 = V.add(A, V.mul(n, d.off)); D2 = V.add(B, V.mul(n, d.off));
    }
    return { val, n, D1, D2 };
  };

  TM.dimSVG = function (d, A, B, unit, o = {}) {
    const g = TM.dimGeom(d, A, B);
    const d1 = P(g.D1), d2 = P(g.D2), a = P(A), b = P(B);
    let s = '';
    const ext = (p, q) => {
      const v = V.sub(q, p), l = V.len(v);
      if (l < 0.5) return '';
      const e = V.mul(v, 1 / l);
      return line(V.add(p, V.mul(e, Math.min(4, l))), V.add(q, V.mul(e, 5)), 0.8);
    };
    s += ext(a, d1) + ext(b, d2);
    const Lp = V.dist(d1, d2);
    let hit = '';
    if (Lp > 0.5) {
      const e = V.norm(V.sub(d2, d1));
      if (Lp > 26) {
        s += line(d1, d2, 0.9) + head(d1, V.mul(e, -1), 8, 2.6) + head(d2, e, 8, 2.6);
      } else {
        s += line(V.sub(d1, V.mul(e, 14)), V.add(d2, V.mul(e, 14)), 0.9) + head(d1, e, 8, 2.6) + head(d2, V.mul(e, -1), 8, 2.6);
      }
      const txt = (!o.values && d.label) || TM.fmtNum(g.val) + (unit ? ' ' + unit : '');
      const sg = (d.off || 0) >= 0 ? 1 : -1;
      const ns = V.mul(sd(g.n), sg);
      let ang = (Math.atan2(e.y, e.x) * 180) / Math.PI;
      if (ang > 90.01) ang -= 180;
      if (ang <= -90.01) ang += 180;
      if (Math.abs(ang - 90) < 0.01) ang = -90;
      const mid = V.lerp(d1, d2, 0.5);
      const tp = V.add(mid, V.mul(ns, STY.fs * 0.55 + 1));
      s += textSVG(txt, tp.x, tp.y, { rot: ang });
      hit = `<line class="hit" x1="${c(d1.x)}" y1="${c(d1.y)}" x2="${c(d2.x)}" y2="${c(d2.y)}"/>` +
        `<circle class="hitr" cx="${c(tp.x)}" cy="${c(tp.y)}" r="10"/>`;
    }
    return o.edit ? s + hit : s;
  };

  TM.angleGeom = function (d, Vn, An, Bn) {
    const dirA = An ? V.norm(V.sub(An, Vn)) : V.dir(d.aRef || 0);
    const dirB = V.norm(V.sub(Bn, Vn));
    const s = (Math.atan2(V.cross(dirA, dirB), V.dot(dirA, dirB)) * 180) / Math.PI;
    let sweep = s;
    if (d.flip) sweep = s > 0 ? s - 360 : s + 360;
    return { dirA, dirB, sweep, val: Math.abs(sweep) };
  };

  TM.angleSVG = function (d, Vn, An, Bn, o = {}) {
    const g = TM.angleGeom(d, Vn, An, Bn);
    const cc = P(Vn), r = d.r || 30;
    const da = sd(g.dirA), db = sd(g.dirB);
    let s = '';
    if (!An) s += line(cc, V.add(cc, V.mul(da, r + 14)), 0.9, ' stroke-dasharray="4 3"');
    const p1 = V.add(cc, V.mul(da, r)), p2 = V.add(cc, V.mul(db, r));
    const large = Math.abs(g.sweep) > 180 ? 1 : 0, sweepFlag = g.sweep > 0 ? 0 : 1;
    const path = `M${c(p1.x)} ${c(p1.y)}A${r} ${r} 0 ${large} ${sweepFlag} ${c(p2.x)} ${c(p2.y)}`;
    if (g.val > 0.05) s += `<path d="${path}" stroke="${ink}" stroke-width="1" fill="none"/>`;
    const txt = (!o.values && d.label) || TM.fmtNum(g.val, 1) + '°';
    const mv = sd(V.dir(V.ang(g.dirA) + g.sweep / 2));
    const w = TM.textWidth(txt, STY.fs * 0.9);
    const dist = r + 7 + Math.abs(mv.x) * w / 2 + Math.abs(mv.y) * STY.fs * 0.45;
    s += textSVG(txt, cc.x + mv.x * dist, cc.y + mv.y * dist, { size: STY.fs * 0.9 });
    if (o.edit) s += `<path class="hit" d="${path}" fill="none"/>`;
    return s;
  };

  // ---------------------------------------------------------------- Gesamtbild
  /**
   * o.edit: Bearbeitungsmodus (Trefferflächen, Auswahl). o.sel: {kind,id}. o.z: Zoom.
   */
  TM.render = function (doc, o = {}) {
    const edit = !!o.edit, sel = o.sel, z = o.z || 1;
    const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
    const solid = doc.meta.beamStyle === 'solid';
    const bw = solid ? STY.solid : STY.bw;
    const beamAt = new Set(), rodAt = new Set();
    for (const e of doc.elements) {
      if (e.type === 'beam') { beamAt.add(e.n1); beamAt.add(e.n2); }
      if (e.type === 'rod') { rodAt.add(e.n1); rodAt.add(e.n2); }
    }
    const supAt = new Map(doc.supports.map((s) => [s.node, s]));
    const pinAt = new Set();
    for (const n of doc.nodes) {
      const s = supAt.get(n.id);
      if (n.hinge || rodAt.has(n.id) || (s && (s.type === 'fest' || s.type === 'los' || s.type === 'gleit'))) pinAt.add(n.id);
    }
    const values = !!doc.meta.showValues;
    const lab = (L) => {
      if (!values) return { t: L.label, it: true };
      const u = TM.units(doc);
      const unit = L.type === 'force' ? u.F : L.type === 'moment' ? u.M : u.q;
      return { t: `${TM.fmtNum(+L.value || 0)} ${unit}`, it: false };
    };
    const ctx = { beamAt, pinAt, bw, values, lab };
    const hw = c(14 / z);
    const isSel = (k, id) => sel && sel.kind === k && sel.id === id;
    const G = (kind, id, inner) =>
      edit ? `<g class="obj${isSel(kind, id) ? ' sel' : ''}" data-kind="${kind}" data-id="${id}">${inner}</g>` : `<g>${inner}</g>`;
    const hitLine = (a, b) => (edit ? `<line class="hit" stroke-width="${hw}" x1="${c(a.x)}" y1="${c(a.y)}" x2="${c(b.x)}" y2="${c(b.y)}"/>` : '');

    let out = '';

    // Streckenlasten (hinter dem Tragwerk)
    for (const L of doc.loads) {
      if (L.type !== 'lineload') continue;
      const el = doc.elements.find((e) => e.id === L.el);
      if (!el) continue;
      const r = lineloadSVG(L, el, nodes.get(el.n1), nodes.get(el.n2), ctx);
      out += G('load', L.id, r.svg + (edit ? r.hit : ''));
    }

    // Lager
    for (const s of o.hideSupports ? [] : doc.supports) {
      const n = nodes.get(s.node);
      if (!n) continue;
      const p = P(n);
      const off = s.type === 'clamp' || s.type === 'schiebe' ? (beamAt.has(n.id) ? bw / 2 : 1.5) : 0;
      const rot = -(s.angle ?? -90) - 90;
      const hit = edit ? `<rect class="hitr" x="-18" y="-2" width="36" height="${off + 28}"/>` : '';
      out += G('support', s.id, `<g transform="translate(${c(p.x)} ${c(p.y)}) rotate(${c(rot)})">${TM.supportShape(s.type, off)}${hit}</g>`);
    }

    // Balken: Außenkontur, dann Innenfüllung (ergibt verschmolzene Stöße).
    // Freie Enden werden eckig verlängert, Stöße mit Kreisscheiben geschlossen.
    const beams = doc.elements.filter((e) => e.type === 'beam');
    const beamDeg = new Map();
    for (const e of beams) for (const k of [e.n1, e.n2]) beamDeg.set(k, (beamDeg.get(k) || 0) + 1);
    const segD = (e, ext = 0) => {
      let a = P(nodes.get(e.n1)), b = P(nodes.get(e.n2));
      const ha = a, hb = b;
      if (ext) {
        const u = V.norm(V.sub(b, a));
        if (beamDeg.get(e.n1) === 1) a = V.sub(a, V.mul(u, ext));
        if (beamDeg.get(e.n2) === 1) b = V.add(b, V.mul(u, ext));
      }
      return { a: ha, b: hb, d: `M${c(a.x)} ${c(a.y)}L${c(b.x)} ${c(b.y)}` };
    };
    const joints = [...beamDeg].filter(([, k]) => k > 1).map(([id]) => P(nodes.get(id)));
    const discs = (r, fill) => joints.map((p) => `<circle cx="${c(p.x)}" cy="${c(p.y)}" r="${r}" fill="${fill}" stroke="none"/>`).join('');
    for (const e of beams) {
      const g = segD(e, bw / 2);
      out += G('element', e.id, `<path d="${g.d}" stroke="${ink}" stroke-width="${bw}" fill="none"/>` + hitLine(g.a, g.b));
    }
    if (joints.length) out += `<g pointer-events="none">${discs(bw / 2, ink)}</g>`;
    if (!solid && beams.length) {
      out += `<g pointer-events="none"><path d="${beams.map((e) => segD(e, STY.bwi / 2).d).join('')}" stroke="#fff" stroke-width="${STY.bwi}" fill="none"/>${discs(STY.bwi / 2, '#fff')}</g>`;
    }

    // Stäbe, Seile, Federn
    for (const e of doc.elements) {
      if (e.type === 'beam') continue;
      let { a, b } = segD(e);
      let shape;
      if (e.type === 'rope') {
        const u = V.norm(V.sub(b, a));
        const ta = beamAt.has(e.n1) && !pinAt.has(e.n1) ? bw / 2 : 0;
        const tb = beamAt.has(e.n2) && !pinAt.has(e.n2) ? bw / 2 : 0;
        const a2 = V.add(a, V.mul(u, ta)), b2 = V.sub(b, V.mul(u, tb));
        shape = line(a2, b2, STY.rope, ' stroke-linecap="round"');
      } else if (e.type === 'spring') {
        shape = `<path d="${springPath(a, b)}" stroke="${ink}" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`;
      } else {
        shape = line(a, b, STY.rod, ' stroke-linecap="round"');
      }
      out += G('element', e.id, shape + hitLine(a, b));
    }

    // Gelenke
    for (const id of pinAt) {
      const p = P(nodes.get(id));
      out += `<circle pointer-events="none" cx="${c(p.x)}" cy="${c(p.y)}" r="${STY.hinge}" fill="#fff" stroke="${ink}" stroke-width="1.5"/>`;
    }

    // Element-Beschriftungen
    for (const e of doc.elements) {
      if (!e.label) continue;
      const A = nodes.get(e.n1), B = nodes.get(e.n2);
      const m = P(V.lerp(A, B, 0.5));
      const ns = V.mul(sd(TM.upNormal(A, B)), e.labelSide === -1 ? -1 : 1);
      const w = TM.textWidth(e.label);
      const dist = (e.type === 'beam' ? bw / 2 : 3) + 6 + Math.abs(ns.x) * w / 2 + Math.abs(ns.y) * STY.fs * 0.5;
      out += G('element', e.id, textSVG(e.label, m.x + ns.x * dist, m.y + ns.y * dist));
    }

    // Einzelkräfte und Momente
    for (const L of doc.loads) {
      const n = nodes.get(L.node);
      if (!n) continue;
      if (L.type === 'force') {
        const r = forceSVG(L, n, ctx);
        out += G('load', L.id, r.svg + hitLine(r.tail, r.tip));
      } else if (L.type === 'moment') {
        const r = momentSVG(L, n, ctx);
        out += G('load', L.id, r.svg + (edit ? r.hit.replace('class="hit"', `class="hit" stroke-width="${hw}"`) : ''));
      }
    }

    // Maße
    for (const d of doc.dims) {
      if (d.type === 'angle') {
        const Vn = nodes.get(d.v), Bn = nodes.get(d.b), An = d.a ? nodes.get(d.a) : null;
        out += G('dim', d.id, TM.angleSVG(d, Vn, An, Bn, { edit, values }));
      } else {
        out += G('dim', d.id, TM.dimSVG(d, nodes.get(d.a), nodes.get(d.b), values ? TM.units(doc).L : doc.meta.unit, { edit, values }));
      }
    }

    // Freie Texte
    for (const t of doc.texts) {
      const p = P(t);
      out += G('text', t.id, textSVG(t.text, p.x, p.y, { size: t.size || 16, anchor: 'start', italic: t.italic !== false }));
    }

    // Knotenbeschriftungen
    for (const n of doc.nodes) {
      if (!n.label) continue;
      const p = P(n);
      const t = textSVG(n.label, p.x + (n.lx ?? -14), p.y + (n.ly ?? -18));
      out += edit ? `<g class="obj${isSel('node', n.id) ? ' sel' : ''}" data-kind="nlabel" data-id="${n.id}">${t}</g>` : t;
    }

    return out;
  };
})(window.TM);
