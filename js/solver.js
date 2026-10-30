'use strict';
/*
 * Statik-Rechenkern.
 *
 * Jedes Element (Balken, Stab, Seil, Feder) ist ein starrer Körper. Unbekannte:
 *   - Endkräfte (fx, fy) je Elementende = Kraft des Knotens auf das Element,
 *   - Endmoment m je biegesteifem Balkenende (Balken an Knoten ohne Gelenk),
 *   - Lagerreaktionen.
 * Gleichungen: 3 Gleichgewichtsbedingungen je Element und 2 bzw. 3 je Knoten.
 * Das Gleichungssystem wird per Gauß-Elimination mit Rangbestimmung gelöst:
 * quadratisch + voller Rang ⇔ statisch bestimmt.
 *
 * Vorzeichen der Schnittgrößen (übliche Konvention, "gestrichelte Faser"):
 * x-Achse von Knoten 1 nach Knoten 2, z-Achse rechts der Laufrichtung
 * (bei waagerechtem Balken von links nach rechts: nach unten).
 * N > 0 Zug, Q > 0 am positiven Schnittufer in +z, M > 0 erzeugt Zug auf der z-Seite.
 */
(function (TM) {
  const V = TM.V, M = TM.model;

  /** Wirkrichtung (Welt) und Intensitätsverlauf einer Streckenlast. */
  TM.lineloadDir = function (L, A, B) {
    const side = L.side === -1 ? -1 : 1;
    const top = L.dir === 'vert' ? { x: 0, y: side } : V.mul(TM.upNormal(A, B), side);
    return V.mul(top, -1);
  };
  const qNorm = (L) => Math.max(Math.abs(+L.qa || 0), Math.abs(+L.qb || 0)) || 1;

  /** Lagerwertigkeit: Liste der Reaktionskomponenten. */
  function supportComponents(s) {
    const nvec = V.mul(V.dir(s.angle ?? -90), -1); // vom Boden zum Knoten
    const tvec = V.perp(nvec);
    switch (s.type) {
      case 'fest': return [{ c: 'x', f: { x: 1, y: 0 } }, { c: 'y', f: { x: 0, y: 1 } }];
      case 'los': case 'gleit': return [{ c: 'n', f: nvec }];
      case 'clamp': return [{ c: 'x', f: { x: 1, y: 0 } }, { c: 'y', f: { x: 0, y: 1 } }, { c: 'm', m: 1 }];
      case 'schiebe': return [{ c: 'n', f: nvec }, { c: 'm', m: 1 }];
      default: return [];
    }
    void tvec;
  }

  function gauss(rows, rhs, n) {
    const m = rows.length;
    const A = rows.map((r, i) => { const x = new Float64Array(n + 1); x.set(r); x[n] = rhs[i]; return x; });
    let amax = 0, bmax = 0;
    for (const r of A) { for (let j = 0; j < n; j++) amax = Math.max(amax, Math.abs(r[j])); bmax = Math.max(bmax, Math.abs(r[n])); }
    const tol = 1e-9 * Math.max(1, amax);
    const piv = [];
    let r = 0;
    for (let c = 0; c < n && r < m; c++) {
      let p = r, best = Math.abs(A[r][c]);
      for (let i = r + 1; i < m; i++) { const v = Math.abs(A[i][c]); if (v > best) { best = v; p = i; } }
      if (best < tol) continue;
      [A[r], A[p]] = [A[p], A[r]];
      const R = A[r], inv = 1 / R[c];
      for (let j = c; j <= n; j++) R[j] *= inv;
      for (let i = 0; i < m; i++) {
        if (i === r) continue;
        const f = A[i][c];
        if (f === 0) continue;
        const Ri = A[i];
        for (let j = c; j <= n; j++) Ri[j] -= f * R[j];
      }
      piv.push(c);
      r++;
    }
    let inconsistent = false;
    const btol = 1e-7 * Math.max(1, bmax);
    for (let i = r; i < m; i++) if (Math.abs(A[i][n]) > btol) inconsistent = true;
    const x = new Float64Array(n);
    for (let i = 0; i < r; i++) x[piv[i]] = A[i][n];
    return { rank: r, x, inconsistent };
  }

  /** Klassisches Abzählkriterium n = a + z − 3p (Stäbe/Seile als Körper). */
  function countCriterion(doc, active) {
    const parent = new Map();
    const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    const union = (a, b) => parent.set(find(a), find(b));
    for (const e of doc.elements) parent.set(e.id, e.id);
    for (const n of doc.nodes) {
      if (n.hinge) continue;
      const beams = M.elementsAt(doc, n.id).filter((e) => e.type === 'beam');
      for (let i = 1; i < beams.length; i++) union(beams[0].id, beams[i].id);
    }
    const bodies = new Set(doc.elements.map((e) => find(e.id)));
    let z = 0, a = 0;
    for (const n of doc.nodes) {
      if (!active.has(n.id)) continue;
      const els = M.elementsAt(doc, n.id);
      const k = new Set(els.map((e) => find(e.id))).size;
      if (k > 1) z += 2 * (k - 1);
      const s = M.supportAt(doc, n.id);
      if (s) {
        const rigid = els.some((e) => e.type === 'beam' && !n.hinge);
        a += supportComponents(s).filter((c) => c.c !== 'm' || rigid).length;
      }
    }
    const p = bodies.size;
    return { a, z, p, n: a + z - 3 * p };
  }

  TM.solve = function (doc) {
    const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
    const warnings = [];
    const unk = [];
    const U = (d) => (unk.push(d), unk.length - 1);
    const ends = new Map();       // `${e.id}:${k}` → {fx, fy, m, node}
    const endsAt = new Map();     // node → [end]
    const rigidAt = new Map();
    for (const e of doc.elements) {
      for (const k of [1, 2]) {
        const nid = k === 1 ? e.n1 : e.n2, n = nodes.get(nid);
        const rigid = e.type === 'beam' && !n.hinge;
        const o = { e, k, node: nid, fx: U({ t: 'f' }), fy: U({ t: 'f' }), m: rigid ? U({ t: 'm' }) : -1 };
        ends.set(e.id + ':' + k, o);
        if (!endsAt.has(nid)) endsAt.set(nid, []);
        endsAt.get(nid).push(o);
        if (rigid) rigidAt.set(nid, (rigidAt.get(nid) || 0) + 1);
      }
    }
    const active = new Set(endsAt.keys());
    const sup = [];
    for (const s of doc.supports) {
      if (!active.has(s.node)) continue;
      const comps = supportComponents(s).map((c) => ({ ...c, i: U({ t: 'r' }) }));
      sup.push({ s, comps });
    }
    if (!doc.elements.length) return { empty: true };

    const n = unk.length;
    const rows = [], rhs = [];
    const newRow = () => new Float64Array(n);

    // Elementgleichgewicht
    const lineloadsOf = new Map();
    for (const L of doc.loads) if (L.type === 'lineload') {
      if (!lineloadsOf.has(L.el)) lineloadsOf.set(L.el, []);
      lineloadsOf.get(L.el).push(L);
    }
    for (const e of doc.elements) {
      const A = nodes.get(e.n1), B = nodes.get(e.n2);
      const d = V.sub(B, A), Lx = V.len(d), u = V.norm(d);
      let R = { x: 0, y: 0 }, M1 = 0;
      for (const L of lineloadsOf.get(e.id) || []) {
        const dv = TM.lineloadDir(L, A, B), q = (+L.value || 0) / qNorm(L), qa = +L.qa || 0, qb = +L.qb || 0;
        const res = (q * Lx * (qa + qb)) / 2;
        const mom = (q * Lx * Lx * (qa + 2 * qb)) / 6;
        R = V.add(R, V.mul(dv, res));
        M1 += V.cross(u, dv) * mom;
      }
      const e1 = ends.get(e.id + ':1'), e2 = ends.get(e.id + ':2');
      let r = newRow(); r[e1.fx] = 1; r[e2.fx] = 1; rows.push(r); rhs.push(-R.x);
      r = newRow(); r[e1.fy] = 1; r[e2.fy] = 1; rows.push(r); rhs.push(-R.y);
      r = newRow();
      if (e1.m >= 0) r[e1.m] = 1;
      if (e2.m >= 0) r[e2.m] = 1;
      r[e2.fy] += d.x; r[e2.fx] -= d.y;
      rows.push(r); rhs.push(-M1);
    }

    // Knotengleichgewicht
    for (const nd of doc.nodes) {
      const loads = doc.loads.filter((l) => l.node === nd.id);
      if (!active.has(nd.id)) {
        if (loads.length) warnings.push(`Last an einem Knoten ohne Tragwerk wird ignoriert.`);
        continue;
      }
      let Fx = 0, Fy = 0, Mz = 0;
      for (const l of loads) {
        if (l.type === 'force') { const f = V.mul(V.dir(l.angle), +l.value || 0); Fx += f.x; Fy += f.y; }
        else if (l.type === 'moment') Mz += (l.ccw !== false ? 1 : -1) * (+l.value || 0);
      }
      const es = endsAt.get(nd.id);
      const sp = sup.find((x) => x.s.node === nd.id);
      let rx = newRow(), ry = newRow();
      for (const o of es) { rx[o.fx] -= 1; ry[o.fy] -= 1; }
      let hasMsup = false;
      if (sp) for (const c of sp.comps) {
        if (c.f) { rx[c.i] += c.f.x; ry[c.i] += c.f.y; } else hasMsup = true;
      }
      rows.push(rx); rhs.push(-Fx);
      rows.push(ry); rhs.push(-Fy);
      if (rigidAt.get(nd.id) || hasMsup) {
        const rm = newRow();
        for (const o of es) if (o.m >= 0) rm[o.m] -= 1;
        if (sp) for (const c of sp.comps) if (c.m) rm[c.i] += 1;
        rows.push(rm); rhs.push(-Mz);
      } else if (Mz) {
        warnings.push(`Ein Moment greift an einem reinen Gelenkknoten an und kann nicht übertragen werden.`);
      }
    }

    const g = rows.length;
    const sol = gauss(rows, rhs, n);
    const count = countCriterion(doc, active);
    const status = {
      u: n, g, rank: sol.rank, f: n - g,
      kinematic: sol.rank < g,
      indeterminate: sol.rank < n,
      inconsistent: sol.inconsistent,
      count,
    };
    status.determinate = !status.kinematic && !status.indeterminate;
    status.degree = n - sol.rank; // Grad der statischen Unbestimmtheit (bei vollem Zeilenrang)
    status.mobility = g - sol.rank; // Freiheitsgrade des Mechanismus
    const result = { status, warnings, ends, sup, lineloadsOf, nodes };
    if (!status.determinate) return result;

    const x = sol.x;
    result.x = x;
    // Lagerreaktionen
    result.reactions = sup.map(({ s, comps }) => ({
      s,
      comps: comps.map((c) => ({ c: c.c, f: c.f, m: c.m, v: clean(x[c.i]) })),
    }));
    // Schnittgrößen je Element
    result.members = doc.elements.map((e) => memberForces(e, result));
    for (const m of result.members) {
      if (m.e.type === 'rope' && m.N[0] < -1e-9) warnings.push(`Seil auf Druck belastet (S = ${TM.fmtNum(m.N[0])}) – ein Seil kann keine Druckkraft aufnehmen.`);
    }
    return result;
  };

  const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);

  /** Schnittgrößen an der Stelle x (0..L) eines Elements. */
  function sectionAt(ctx, x) {
    const { u, z, f1, m1, loads, Lx } = ctx;
    let Fx = f1.x, Fy = f1.y;
    let Mc = m1 - x * V.cross(u, f1);
    for (const l of loads) {
      const k = (l.qb - l.qa) / Lx;
      const R = l.q * (l.qa * x + (k * x * x) / 2);
      Fx += l.dv.x * R; Fy += l.dv.y * R;
      Mc += V.cross(u, l.dv) * l.q * (-(l.qa * x * x) / 2 - (k * x * x * x) / 6);
    }
    const F = { x: -Fx, y: -Fy };
    return { N: clean(V.dot(F, u)), Q: clean(V.dot(F, z)), M: clean(-Mc) };
  }

  function memberForces(e, res) {
    const A = res.nodes.get(e.n1), B = res.nodes.get(e.n2);
    const d = V.sub(B, A), Lx = V.len(d), u = V.norm(d), z = { x: u.y, y: -u.x };
    const o = res.ends.get(e.id + ':1'), o2 = res.ends.get(e.id + ':2');
    const x = res.x;
    const f1 = { x: x[o.fx], y: x[o.fy] }, m1 = o.m >= 0 ? x[o.m] : 0;
    const loads = (res.lineloadsOf.get(e.id) || []).map((l) => ({
      dv: TM.lineloadDir(l, A, B), q: (+l.value || 0) / qNorm(l), qa: +l.qa || 0, qb: +l.qb || 0,
    }));
    const ctx = { u, z, f1, m1, loads, Lx };
    const xs = [];
    const nS = loads.length ? 48 : 1;
    for (let i = 0; i <= nS; i++) xs.push((Lx * i) / nS);
    // Extremstellen des Moments (Q = 0) exakt bestimmen
    const ext = [];
    if (loads.length) {
      for (let i = 0; i < nS; i++) {
        let a = xs[i], b = xs[i + 1];
        let qa = sectionAt(ctx, a).Q, qb = sectionAt(ctx, b).Q;
        if (qa === 0 || qb === 0 || Math.sign(qa) === Math.sign(qb)) continue;
        for (let it = 0; it < 50; it++) {
          const mdl = (a + b) / 2, qm = sectionAt(ctx, mdl).Q;
          if (Math.sign(qm) === Math.sign(qa)) { a = mdl; qa = qm; } else b = mdl;
        }
        ext.push((a + b) / 2);
      }
    }
    const all = [...xs, ...ext].sort((p, q) => p - q);
    const N = [], Q = [], Mm = [];
    for (const xi of all) { const s = sectionAt(ctx, xi); N.push(s.N); Q.push(s.Q); Mm.push(s.M); }
    const f2 = { x: x[o2.fx], y: x[o2.fy] };
    return { e, A, B, L: Lx, u, z, xs: all, ext, N, Q, M: Mm, f1, f2, m1, at: (xx) => sectionAt(ctx, xx) };
  }
})(window.TM);
