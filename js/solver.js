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
      case 'contact': {
        // Auflage mit Coulomb-Reibung: Normalkraft N (Druck) und Reibkraft R tangential
        const mu = +s.mu || 0;
        if (mu <= 0) return [{ c: 'n', f: nvec }];
        if (s.fmode === 'limit') {
          // Grenzfall: R = μ N, entgegen der Rutschrichtung (slip = ±1 bezogen auf t)
          const sl = s.slip === -1 ? -1 : 1;
          return [{ c: 'n', f: V.sub(nvec, V.mul(tvec, sl * mu)), limit: { n: nvec, t: tvec, k: -sl * mu } }];
        }
        return [{ c: 'n', f: nvec }, { c: 't', f: tvec }];
      }
      default: return [];
    }
  }
  TM.supportComponents = supportComponents;

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

  const JOINT_DOF = { sleeve: 2, sleevepin: 1, parallel: 2 };

  /** Klassisches Abzählkriterium n = a + z − 3p (Stäbe/Seile als Körper). */
  function countCriterion(doc, active, nUnknownLoads) {
    const parent = new Map();
    const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    const union = (a, b) => parent.set(find(a), find(b));
    for (const e of doc.elements) parent.set(e.id, e.id);
    for (const n of doc.nodes) {
      if (n.hinge) continue;
      const els = M.elementsAt(doc, n.id);
      // Bei Verbindungen (Schiebehülse …) ist das erste Element von den übrigen getrennt
      const beams = els.filter((e, i) => e.type === 'beam' && !(n.joint && i === 0));
      for (let i = 1; i < beams.length; i++) union(beams[0].id, beams[i].id);
    }
    const bodies = new Set(doc.elements.map((e) => find(e.id)));
    let z = 0, a = 0, p = bodies.size;
    for (const n of doc.nodes) {
      if (!active.has(n.id)) continue;
      const els = M.elementsAt(doc, n.id);
      let k = new Set(els.map((e) => find(e.id))).size;
      if (n.joint && els.length >= 2) { z += JOINT_DOF[n.joint] + 2 * Math.max(0, k - 2); }
      else {
        if (n.pulley && n.pulley.mode !== 'friction') { k += 1; p += 1; }
        if (k > 1) z += 2 * (k - 1);
      }
      const s = M.supportAt(doc, n.id);
      if (s) {
        const rigid = els.some((e) => e.type === 'beam' && !n.hinge) || (n.pulley && n.pulley.mode === 'friction');
        a += supportComponents(s).filter((c) => c.c !== 'm' || rigid).length;
      }
    }
    // Massenpunkte ohne Tragwerk (z. B. Klotz auf einer Ebene): 2 Freiheitsgrade
    const pts = [...active].filter((id) => !M.elementsAt(doc, id).length).length;
    return { a, z, p, pts, u: nUnknownLoads, n: a + z - 3 * p - 2 * pts + nUnknownLoads };
  }

  TM.solve = function (doc) {
    const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
    const warnings = [];
    const unk = [];
    const U = (d) => (unk.push(d), unk.length - 1);
    const pg = M.pulleyGeom(doc);
    const ends = new Map();       // `${e.id}:${k}` → {fx, fy, m, node, P}
    const endsAt = new Map();     // node → [end]
    for (const e of doc.elements) {
      for (const k of [1, 2]) {
        const nid = k === 1 ? e.n1 : e.n2, n = nodes.get(nid);
        const rigid = e.type === 'beam' && !n.hinge;
        const P = pg.pt.get(e.id + ':' + k) || { x: n.x, y: n.y };
        const o = { e, k, node: nid, P, fx: U({ t: 'f' }), fy: U({ t: 'f' }), m: rigid ? U({ t: 'm' }) : -1 };
        ends.set(e.id + ':' + k, o);
        if (!endsAt.has(nid)) endsAt.set(nid, []);
        endsAt.get(nid).push(o);
      }
    }
    const active = new Set(endsAt.keys());
    // Massenpunkte: Knoten ohne Element, aber mit Lager und Last (Klotz auf Unterlage)
    for (const nd of doc.nodes) {
      if (!active.has(nd.id) && M.supportAt(doc, nd.id) && doc.loads.some((l) => l.node === nd.id)) {
        active.add(nd.id);
        endsAt.set(nd.id, []);
      }
    }
    const sup = [];
    for (const s of doc.supports) {
      if (!active.has(s.node)) continue;
      const comps = supportComponents(s).map((c) => ({ ...c, i: U({ t: 'r' }) }));
      sup.push({ s, comps });
    }
    if (!doc.elements.length && !active.size) return { empty: true };
    // gesuchte Lasten als Unbekannte
    const unknownLoads = [];
    for (const l of doc.loads) {
      if (!l.unknown || l.type === 'lineload' || !active.has(l.node)) continue;
      unknownLoads.push({ l, i: U({ t: 'load' }) });
    }
    // Verbindungen mit Freigaben: Knoten in zwei Seiten teilen
    const jointU = new Map();
    for (const nd of doc.nodes) {
      if (!nd.joint || !active.has(nd.id) || endsAt.get(nd.id).length < 2) continue;
      const t = V.dir(nd.jangle || 0), q = V.perp(t);
      const comps = [];
      if (nd.joint === 'sleeve' || nd.joint === 'sleevepin') comps.push({ f: q });
      if (nd.joint === 'parallel') comps.push({ f: t });
      if (nd.joint !== 'sleevepin') comps.push({ m: 1 });
      jointU.set(nd.id, comps.map((c) => ({ ...c, i: U({ t: 'j' }) })));
    }
    const g9 = TM.gUnit ? TM.gUnit(doc) : 9.81e-3;

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
      const e1 = ends.get(e.id + ':1'), e2 = ends.get(e.id + ':2');
      const Lx = V.dist(A, B), u = V.norm(V.sub(B, A));
      let R = { x: 0, y: 0 }, M1 = 0;
      for (const L of lineloadsOf.get(e.id) || []) {
        const dv = TM.lineloadDir(L, A, B), q = (+L.value || 0) / qNorm(L), qa = +L.qa || 0, qb = +L.qb || 0;
        const res = (q * Lx * (qa + qb)) / 2;
        const mom = (q * Lx * Lx * (qa + 2 * qb)) / 6;
        R = V.add(R, V.mul(dv, res));
        M1 += V.cross(u, dv) * mom + V.cross(V.sub(A, e1.P), V.mul(dv, res));
      }
      const d = V.sub(e2.P, e1.P);
      let r = newRow(); r[e1.fx] = 1; r[e2.fx] = 1; rows.push(r); rhs.push(-R.x);
      r = newRow(); r[e1.fy] = 1; r[e2.fy] = 1; rows.push(r); rhs.push(-R.y);
      r = newRow();
      if (e1.m >= 0) r[e1.m] = 1;
      if (e2.m >= 0) r[e2.m] = 1;
      r[e2.fy] += d.x; r[e2.fx] -= d.y;
      rows.push(r); rhs.push(-M1);
    }

    // Knotengleichgewicht
    const pulleyRes = [];
    for (const nd of doc.nodes) {
      const loads = doc.loads.filter((l) => l.node === nd.id);
      if (!active.has(nd.id)) {
        if (loads.length) warnings.push('Last an einem Knoten ohne Tragwerk wird ignoriert.');
        continue;
      }
      let Fx = 0, Fy = 0, Mz = 0;
      const ux = newRow(), uy = newRow(), um = newRow(); // Anteile gesuchter Lasten
      let hasUm = false;
      for (const l of loads) {
        const uk = unknownLoads.find((x) => x.l === l);
        if (l.type === 'force') {
          const dd = V.dir(l.angle);
          if (uk) { ux[uk.i] += dd.x; uy[uk.i] += dd.y; } else { Fx += dd.x * (+l.value || 0); Fy += dd.y * (+l.value || 0); }
        } else if (l.type === 'moment') {
          const sg = l.ccw !== false ? 1 : -1;
          if (uk) { um[uk.i] += sg; hasUm = true; } else Mz += sg * (+l.value || 0);
        } else if (l.type === 'mass') {
          if (uk) uy[uk.i] -= g9; else Fy -= g9 * (+l.value || 0);
        }
      }
      const es = endsAt.get(nd.id);
      const sp = sup.find((x) => x.s.node === nd.id);
      const jc = jointU.get(nd.id);
      const groups = jc ? [es.filter((o) => o.e === es[0].e), es.filter((o) => o.e !== es[0].e)] : [es];
      const pul = nd.pulley && !jc ? pg.pulleys.get(nd.id) : null;
      groups.forEach((grp, gi) => {
        const sgn = gi === 0 ? 1 : -1;
        const rx = gi === 0 ? ux.slice() : newRow(), ry = gi === 0 ? uy.slice() : newRow();
        for (const o of grp) { rx[o.fx] -= 1; ry[o.fy] -= 1; }
        let hasMsup = false;
        if (gi === 0 && sp) for (const c of sp.comps) {
          if (c.f) { rx[c.i] += c.f.x; ry[c.i] += c.f.y; } else hasMsup = true;
        }
        let hasMj = false;
        if (jc) for (const c of jc) {
          if (c.f) { rx[c.i] += sgn * c.f.x; ry[c.i] += sgn * c.f.y; } else hasMj = true;
        }
        rows.push(rx); rhs.push(gi === 0 ? -Fx : 0);
        rows.push(ry); rhs.push(gi === 0 ? -Fy : 0);
        const rigidEnds = grp.some((o) => o.m >= 0);
        // Moment der Seilkräfte am Rollenumfang um die Achse
        const ropeMoment = (row) => {
          for (const o of grp) if (o.e.type === 'rope' && pul) {
            const rr = V.sub(o.P, nd);
            row[o.fy] -= rr.x; row[o.fx] += rr.y; // −(r × f)
          }
        };
        const friction = pul && nd.pulley.mode === 'friction';
        if (pul && !friction && gi === 0) {
          const rd = newRow();
          ropeMoment(rd);
          rows.push(rd); rhs.push(0);
        }
        if (rigidEnds || hasMsup || hasMj || friction || (gi === 0 && hasUm)) {
          const rm = gi === 0 ? um.slice() : newRow();
          for (const o of grp) if (o.m >= 0) rm[o.m] -= 1;
          if (gi === 0 && sp) for (const c of sp.comps) if (c.m) rm[c.i] += 1;
          if (jc) for (const c of jc) if (c.m) rm[c.i] += sgn;
          if (friction) ropeMoment(rm);
          rows.push(rm); rhs.push(gi === 0 ? -Mz : 0);
        } else if (gi === 0 && Mz) {
          warnings.push('Ein Moment greift an einem reinen Gelenkknoten an und kann nicht übertragen werden.');
        }
      });
      // Seilreibung (Euler-Eytelwein, Grenzfall): S_groß = S_klein · e^(μα)
      if (pul && pul.ropes.length === 2) {
        const K = Math.exp((+nd.pulley.mu || 0) * (pul.alpha * Math.PI) / 180);
        const hi = pul.ropes.find((q) => q.e.id === nd.pulley.heavy) || pul.ropes[0];
        const lo = pul.ropes.find((q) => q !== hi);
        const info = { node: nd, alpha: pul.alpha, K: nd.pulley.mode === 'friction' ? K : 1, hi, lo };
        pulleyRes.push(info);
        if (nd.pulley.mode === 'friction') {
          const rf = newRow();
          const add = (q, f) => {
            const o = ends.get(q.e.id + ':' + q.k);
            const w = V.norm(V.sub(o.P, q.O));
            rf[o.fx] += f * w.x; rf[o.fy] += f * w.y;
          };
          add(hi, 1); add(lo, -K);
          rows.push(rf); rhs.push(0);
        }
      }
    }

    const g = rows.length;
    const sol = gauss(rows, rhs, n);
    const count = countCriterion(doc, active, unknownLoads.length);
    const status = {
      u: n, g, rank: sol.rank, f: n - g,
      kinematic: sol.rank < g,
      indeterminate: sol.rank < n,
      inconsistent: sol.inconsistent,
      count,
    };
    status.determinate = !status.kinematic && !status.indeterminate;
    // verschieblich, aber für die gegebene Belastung im Gleichgewicht (z. B. Seil mit Masse)
    status.solvable = !status.indeterminate && !status.inconsistent;
    status.degree = n - sol.rank;
    status.mobility = g - sol.rank;
    const result = { status, warnings, ends, sup, lineloadsOf, nodes, pg };
    if (!status.solvable) return result;

    const x = sol.x;
    result.x = x;
    result.reactions = sup.map(({ s, comps }) => ({
      s,
      comps: comps.flatMap((c) => c.limit
        ? [{ c: 'n', f: c.limit.n, v: clean(x[c.i]) }, { c: 't', f: c.limit.t, v: clean(c.limit.k * x[c.i]) }]
        : [{ c: c.c, f: c.f, m: c.m, v: clean(x[c.i]) }]),
    }));
    // Reibung an Auflagen: Haftbedingung |R| ≤ μ N und Kontaktbedingung N ≥ 0
    result.friction = result.reactions.filter((r) => r.s.type === 'contact').map((r) => {
      const N = (r.comps.find((c) => c.c === 'n') || { v: 0 }).v;
      const T = (r.comps.find((c) => c.c === 't') || { v: 0 }).v;
      const mu = +r.s.mu || 0;
      const lift = N < -1e-9;
      const ratio = Math.abs(N) > 1e-12 ? Math.abs(T) / N : (Math.abs(T) > 1e-12 ? Infinity : 0);
      const limit = r.s.fmode === 'limit' && mu > 0;
      const sticks = !lift && (limit || Math.abs(T) <= mu * N + 1e-9);
      return { s: r.s, N, T, mu, ratio, lift, sticks, limit };
    });
    for (const f of result.friction) {
      if (f.lift) warnings.push(`Die Auflage ${TM.supportName ? TM.supportName(doc, f.s) : ''} hebt ab (N < 0) – der Kontakt kann keine Zugkraft übertragen.`);
    }
    result.unknownLoads = unknownLoads.map(({ l, i }) => ({ l, v: clean(x[i]) }));
    result.members = doc.elements.map((e) => memberForces(e, result));
    result.pulleys = pulleyRes.map((p) => {
      const S = (q) => result.members.find((m) => m.e === q.e).N[0];
      return { ...p, Shi: S(p.hi), Slo: p.lo ? S(p.lo) : 0 };
    });
    for (const m of result.members) {
      if (m.e.type === 'rope' && m.N[0] < -1e-9) warnings.push(`Seil auf Druck belastet (S = ${TM.fmtNum(m.N[0])}) – ein Seil kann keine Druckkraft aufnehmen.`);
    }
    for (const ul of result.unknownLoads) {
      if (ul.l.type === 'mass' && ul.v < -1e-9) warnings.push('Die gesuchte Masse ist negativ – Gleichgewicht so nicht möglich.');
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
    const o = res.ends.get(e.id + ':1'), o2 = res.ends.get(e.id + ':2');
    const A = e.type === 'rope' ? o.P : res.nodes.get(e.n1), B = e.type === 'rope' ? o2.P : res.nodes.get(e.n2);
    const d = V.sub(B, A), Lx = V.len(d), u = V.norm(d), z = { x: u.y, y: -u.x };
    const x = res.x;
    let f1 = { x: x[o.fx], y: x[o.fy] }, m1 = o.m >= 0 ? x[o.m] : 0;
    // Endkräfte auf die Stabachse beziehen (Balken: Achse von Knoten zu Knoten)
    if (e.type !== 'rope') m1 += V.cross(V.sub(o.P, A), f1);
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
