'use strict';
/*
 * Zahlenwerte: Einheiten, Bezeichnungen wie "2F" oder "l/2" auf Grundgrößen
 * zurückführen, "Gegeben"-Liste erstellen und Zufallsvarianten erzeugen.
 */
(function (TM) {
  const V = TM.V, M = TM.model;

  TM.units = (doc) => {
    const L = doc.meta.unit || 'm', F = doc.meta.funit || 'kN';
    return { L, F, M: F + L, q: `${F}/${L}` };
  };
  TM.loadUnit = (doc, l) => {
    const u = TM.units(doc);
    return l.type === 'force' ? u.F : l.type === 'moment' ? u.M : l.type === 'mass' ? 'kg' : u.q;
  };
  TM.defaultValue = (l) => (l.type === 'lineload' ? 5 : l.type === 'mass' ? 50 : 10);
  /** Erdbeschleunigung in Krafteinheit pro kg. */
  TM.gUnit = (doc) => {
    const f = { N: 1, kN: 1e-3, MN: 1e-6, daN: 0.1 }[doc.meta.funit || 'kN'];
    return 9.81 * (f == null ? 1e-3 : f);
  };

  /** "2F" → {coef:2, sym:"F"}, "l/2" → {coef:0.5, sym:"l"}, "F_1" → {coef:1, sym:"F_1"}. */
  TM.parseSym = function (label) {
    const s = String(label || '').trim().replace(/\s+/g, '');
    const m = s.match(/^(\d+(?:[.,]\d+)?)?\*?(\\[A-Za-z]+|[A-Za-zα-ωΑ-Ωϑφ](?:_(?:\{\w+\}|\w))?)(?:\/(\d+(?:[.,]\d+)?))?$/);
    if (!m) return null;
    const num = m[1] ? parseFloat(m[1].replace(',', '.')) : 1;
    const den = m[3] ? parseFloat(m[3].replace(',', '.')) : 1;
    return { coef: num / den, sym: m[2].replace(/_\{(\w+)\}/, '_$1') };
  };

  /** Winkel einer Kraft zur gewählten Bezugsachse (spitzer Winkel, Grad). */
  TM.forceRefAngle = (l) => {
    const d = V.dir(l.angle);
    const h = (Math.atan2(Math.abs(d.y), Math.abs(d.x)) * 180) / Math.PI;
    return l.angRef === 'v' ? 90 - h : h;
  };

  /** Alle Größen mit Bezeichnung, Wert und Einheit (für Gegeben-Liste, Parameter, Varianten). */
  TM.quantities = function (doc) {
    const u = TM.units(doc);
    const q = [];
    for (const l of doc.loads) {
      if (!l.unknown) q.push({ kind: 'load', obj: l, label: l.label, value: +l.value || 0, unit: TM.loadUnit(doc, l) });
      if (l.type === 'force' && (l.angRef === 'h' || l.angRef === 'v') && l.angLabel)
        q.push({ kind: 'fangle', obj: l, label: l.angLabel, value: TM.forceRefAngle(l), unit: '°' });
    }
    for (const d of doc.dims) {
      if (d.type === 'angle') {
        const g = TM.angleGeom(doc, d);
        if (!g.Vn) continue;
        q.push({ kind: 'angle', obj: d, label: d.label, value: g.val, unit: '°' });
      } else {
        const g = TM.dimGeom(d, M.node(doc, d.a), M.node(doc, d.b));
        q.push({ kind: 'dim', obj: d, label: d.label, value: g.val, unit: u.L });
      }
    }
    return q;
  };

  /** Gegeben-Liste: je Grundgröße ein Eintrag. */
  TM.givenList = function (doc) {
    const seen = new Map();
    const out = [];
    for (const q of TM.quantities(doc)) {
      if (!q.label) continue;
      const p = TM.parseSym(q.label);
      const sym = p ? p.sym : q.label;
      const val = p ? q.value / p.coef : q.value;
      if (seen.has(sym)) continue;
      seen.set(sym, val);
      out.push({ sym, value: val, unit: q.unit });
    }
    return out;
  };

  const nice = (v, step) => Math.max(step, Math.round(v / step) * step);
  const rnd = (a, b) => a + Math.random() * (b - a);
  function stepFor(v) {
    const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1)));
    return e / 2;
  }

  /**
   * Erzeugt eine Zufallsvariante: Lastwerte (und optional Längen/Winkel) werden variiert.
   * Größen mit gleicher Grundgröße (F, 2F; a, 2a, a/2) bleiben zueinander konsistent.
   */
  TM.randomize = function (doc, o = {}) {
    const base = new Map();
    const pick = (sym, cur, kind) => {
      if (sym && base.has(sym)) return base.get(sym);
      let v;
      if (kind === 'angle') v = [30, 45, 60][Math.floor(Math.random() * 3)];
      else if (kind === 'dim') v = nice(cur * rnd(0.6, 1.5), 0.5);
      else { const st = stepFor(cur || 10); v = nice((cur || 10) * rnd(0.5, 1.6), st); }
      if (sym) base.set(sym, v);
      return v;
    };
    for (const l of doc.loads) {
      if (l.unknown) continue;
      const p = TM.parseSym(l.label);
      const cur = (+l.value || TM.defaultValue(l)) / (p ? p.coef : 1);
      l.value = TM.clean(pick(p && 'L:' + p.sym, cur, 'load') * (p ? p.coef : 1));
    }
    if (!o.geometry) return doc;
    for (const l of doc.loads) {
      if (l.type !== 'force' || !(l.angRef === 'h' || l.angRef === 'v')) continue;
      const p = TM.parseSym(l.angLabel);
      const target = pick(p && 'A:' + p.sym, TM.forceRefAngle(l), 'angle');
      const d = V.dir(l.angle);
      const sx = Math.sign(d.x) || 1, sy = Math.sign(d.y) || -1;
      const h = l.angRef === 'v' ? 90 - target : target;
      l.angle = (Math.atan2(sy * Math.sin((h * Math.PI) / 180), sx * Math.cos((h * Math.PI) / 180)) * 180) / Math.PI;
    }
    for (const d of doc.dims) {
      const A = M.node(doc, d.a), B = M.node(doc, d.b);
      if (d.type === 'angle') continue;
      const g = TM.dimGeom(d, A, B);
      if (g.val < 1e-9) continue;
      const p = TM.parseSym(d.label);
      const val = pick(p && 'D:' + p.sym, g.val / (p ? p.coef : 1), 'dim') * (p ? p.coef : 1);
      let u;
      if (d.type === 'h') u = { x: Math.sign(B.x - A.x) || 1, y: 0 };
      else if (d.type === 'v') u = { x: 0, y: Math.sign(B.y - A.y) || 1 };
      else u = V.norm(V.sub(B, A));
      M.setDistance(doc, A.id, B.id, u, val, true);
    }
    return doc;
  };
})(window.TM);
