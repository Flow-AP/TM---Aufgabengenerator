'use strict';
/* Beispielaufgaben (klassische Stereostatik-Aufgaben). */
(function (TM) {
  const M = TM.model;

  function builder() {
    const d = TM.newDoc();
    const api = {
      d,
      N(x, y, label = '', lx, ly) {
        const n = M.addNode(d, x, y);
        n.label = label;
        if (lx != null) { n.lx = lx; n.ly = ly; }
        return n.id;
      },
      E(type, a, b, label = '') { const e = M.addElement(d, type, a, b); e.label = label; return e.id; },
      S(node, type, angle = -90) { d.supports.push({ id: TM.uid('s'), node, type, angle }); },
      F(node, angle, label, o = {}) {
        d.loads.push({ id: TM.uid('l'), type: 'force', node, angle, label, value: 10, len: 55, tip: true, angRef: 'none', angLabel: 'α', ...o });
      },
      Mo(node, label, o = {}) { d.loads.push({ id: TM.uid('l'), type: 'moment', node, label, value: 10, ccw: true, r: 20, gap: -90, ...o }); },
      Q(el, label, qa = 1, qb = 1, o = {}) {
        d.loads.push({ id: TM.uid('l'), type: 'lineload', el, label, value: 5, qa, qb, h: 28, side: 1, dir: 'perp', ...o });
      },
      D(type, a, b, off, label = '') { d.dims.push({ id: TM.uid('d'), type, a, b, off, label }); },
      W(v, a, b, label, o = {}) { d.dims.push({ id: TM.uid('d'), type: 'angle', v, a, b, label, r: 30, flip: false, ...o }); },
    };
    return api;
  }

  const examples = [
    function () {
      const b = builder(), d = b.d;
      const A = b.N(0, 0, 'A', -16, -18), K = b.N(2, 0), B = b.N(4, 0, 'B', 14, -18), C = b.N(6, 0, 'C', 14, -18);
      b.E('beam', A, K); b.E('beam', K, B); const e3 = b.E('beam', B, C);
      b.S(A, 'fest'); b.S(B, 'los');
      b.F(K, -60, 'F', { angRef: 'h', angLabel: 'α', value: 20 });
      b.Q(e3, 'q_0', 1, 1, { value: 4 });
      b.D('h', A, K, -1.3, 'a'); b.D('h', K, B, -1.3, 'a'); b.D('h', B, C, -1.3, 'a');
      d.meta.title = 'Balken mit Kragarm';
      d.meta.text = 'Der skizzierte Balken ist in A gelenkig und in B verschieblich gelagert. Er wird durch die Kraft F und die konstante Streckenlast q_0 belastet.\n\nGegeben: F, q_0, a, α\nGesucht: Lagerreaktionen in A und B.';
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const A = b.N(0, 0, 'A', 8, 20), B = b.N(5, 0, 'B', 16, -8), C = b.N(0, 3, 'C', 16, -4), K = b.N(2.5, 0);
      b.E('beam', A, K); b.E('beam', K, B); b.E('rope', C, B);
      b.S(A, 'fest', 180); b.S(C, 'clamp', 180);
      b.F(K, -90, 'F', { value: 12 });
      b.D('h', A, K, -1.2, 'l/2'); b.D('h', K, B, -1.2, 'l/2');
      b.W(B, A, C, 'α', { r: 40 });
      d.meta.title = 'Balken mit Seil';
      d.meta.text = 'Ein Balken ist in A gelenkig an einer Wand gelagert und wird in B durch ein Seil gehalten.\n\nGegeben: F, l, α\nGesucht: Seilkraft S und Lagerreaktionen in A.';
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const A = b.N(0, 0, 'A', -18, -10), Bk = b.N(0, 3), G = b.N(3, 3, 'G', 0, 20), Dk = b.N(6, 3), C = b.N(6, 0, 'B', 18, -10);
      b.E('beam', A, Bk); b.E('beam', Bk, G); const e = b.E('beam', G, Dk); b.E('beam', Dk, C);
      d.nodes.find((n) => n.id === G).hinge = true;
      b.S(A, 'fest'); b.S(C, 'fest');
      b.F(Bk, 0, 'F', { tip: true });
      b.Q(e, 'q_0');
      b.D('h', Bk, G, 1.7, 'a'); b.D('h', G, Dk, 1.7, 'a'); b.D('v', C, Dk, 1.2, 'h');
      d.meta.title = 'Dreigelenkrahmen';
      d.meta.text = 'Der Dreigelenkrahmen ist in A und B gelenkig gelagert und in G gelenkig verbunden.\n\nGegeben: F, q_0, a, h\nGesucht: Lager- und Gelenkreaktionen.';
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const A = b.N(0, 0, 'A', -20, -8), B = b.N(4, 0, 'B', 0, 20), C = b.N(2, 2, 'C', -20, -6), Dn = b.N(6, 2, 'D', 20, -6), E = b.N(8, 0, 'E', 20, -8);
      b.E('rod', A, B, '1'); b.E('rod', A, C, '2'); b.E('rod', C, B, '3'); b.E('rod', C, Dn, '4'); b.E('rod', B, Dn, '5');
      b.E('rod', B, E, '6'); b.E('rod', Dn, E, '7');
      d.elements.forEach((e) => (e.labelSide = 1));
      b.S(A, 'fest'); b.S(E, 'los');
      b.F(C, -90, 'F'); b.F(Dn, -90, '2F', { value: 20 });
      b.D('h', A, B, -1.3, '2a'); b.D('h', B, E, -1.3, '2a'); b.D('v', E, Dn, 1.3, 'a');
      d.meta.title = 'Ebenes Fachwerk';
      d.meta.text = 'Bestimmen Sie die Lagerreaktionen und alle Stabkräfte des skizzierten Fachwerks.\n\nGegeben: F, a';
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const T = b.N(0, 3, 'T', -22, -18), m1 = b.N(-0.5, 0, '', 0, 0), Fp = b.N(0.5, 1.5, '', 0, 0);
      d.nodes.find((n) => n.id === T).pulley = { r: 0.5, mode: 'friction', mu: 0.3, heavy: null };
      const r1 = b.E('rope', m1, T), r2 = b.E('rope', T, Fp);
      d.nodes.find((n) => n.id === T).pulley.heavy = r2;
      b.S(T, 'clamp', 90);
      d.loads.push({ id: TM.uid('l'), type: 'mass', node: m1, value: 100, label: 'm', showG: true, gLabel: 'G' });
      b.F(Fp, -90, 'F', { unknown: true, len: 50, tip: false, lox: 48, loy: -10 });
      d.meta.title = 'Seilreibung an einer Trommel';
      d.meta.text = 'Eine Masse m hängt an einem Seil, das um eine feststehende Trommel geschlungen ist (Haftreibungskoeffizient μ = 0,3).\n\nGesucht: Kraft F, mit der die Masse gerade noch hochgezogen werden kann.';
      void r1;
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const A = b.N(0, 0, 'A', -16, -20), G = b.N(3, 0, 'G', 0, -22), K = b.N(4.5, 0), B = b.N(6, 0, 'B', 16, -18);
      b.E('beam', A, G); b.E('beam', G, K); b.E('beam', K, B);
      TM.model.setJoint(d, d.nodes.find((n) => n.id === G), 'parallel');
      b.S(A, 'clamp', 180); b.S(B, 'los');
      b.F(K, -90, 'F_1', { value: 10 });
      b.D('h', A, G, -1.2, 'a'); b.D('h', G, K, -1.2, 'a/2'); b.D('h', K, B, -1.2, 'a/2');
      d.meta.title = 'Balken mit Parallelführung';
      d.meta.text = 'Der Balken ist in A eingespannt, in G durch eine Parallelführung (Querkraftgelenk) verbunden und in B verschieblich gelagert.\n\nGesucht: Lagerreaktionen sowie Verlauf von Q und M.';
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const A = b.N(0, 0, 'A', -18, -14), K = b.N(1, 2), B = b.N(2, 4, 'B', -16, -10);
      b.E('beam', A, K); b.E('beam', K, B);
      d.supports.push({ id: TM.uid('s'), node: A, type: 'contact', angle: -90, mu: 0.3, fmode: 'check', slip: 1 });
      d.supports.push({ id: TM.uid('s'), node: B, type: 'contact', angle: 0, mu: 0, fmode: 'check', slip: 1 });
      b.F(K, -90, 'G', { value: 0.8 });
      b.D('h', A, B, -1.2, 'a'); b.D('v', A, B, -1.2, '2a');
      d.meta.title = 'Leiter an einer Wand';
      d.meta.text = 'Eine Leiter (Gewicht G) lehnt an einer glatten Wand und steht auf einem rauen Boden (Haftreibungszahl μ_0 = 0,3).\n\nGesucht: Kontaktkräfte in A und B. Rutscht die Leiter?';
      return d;
    },
    function () {
      const b = builder(), d = b.d;
      const K = b.N(0, 0, '', 0, 0);
      d.supports.push({ id: TM.uid('s'), node: K, type: 'contact', angle: -90, mu: 0.3, fmode: 'limit', slip: -1 });
      d.loads.push({ id: TM.uid('l'), type: 'mass', node: K, value: 100, label: 'm', showG: false, gLabel: 'G' });
      b.F(K, 30, 'F', { unknown: true, tip: false, len: 60, angRef: 'h', angLabel: 'α', angShow: 'both' });
      d.meta.title = 'Klotz mit Haftreibung';
      d.meta.text = 'Ein Klotz der Masse m liegt auf einer rauen Unterlage (Haftreibungszahl μ_0 = 0,3) und wird unter dem Winkel α gezogen.\n\nGesucht: Kraft F, bei der der Klotz gerade zu rutschen beginnt.';
      return d;
    },
  ];

  TM.examples = examples.map((f) => () => M.normalize(f()));
})(window.TM);
