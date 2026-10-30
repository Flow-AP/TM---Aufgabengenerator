'use strict';
/* Editor: Palette (Drag & Drop), Werkzeuge, Auswahl, Eigenschaften, Export. */
(function () {
  const { V, model: M, S } = TM;
  const $ = (s) => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('#canvas'), gView = $('#viewport'), gGrid = $('#grid'), gDraw = $('#drawing'), gOver = $('#overlay');
  const STORE = 'tm-aufgabengenerator-v1';

  const ed = {
    doc: null,
    sel: null,
    tool: { name: 'select' },
    view: { tx: 0, ty: 0, z: 1 },
    drag: null,
    hist: [],
    fut: [],
    space: false,
    follow: true, // abhängige Teile bei Maßänderungen mitbewegen
    hover: null,
    drop: null,
    mouse: null,
    mode: 'edit', // 'edit' | 'solve'
    res: null,
    sopt: { show: { N: true, Q: true, M: true }, layout: 'stack', scale: 1, freebody: true, couple: true, geometry: false, variants: 4 },
    syncers: [],
  };

  // ================================================================ Palette
  const ITEMS = {
    beam: { name: 'Balken', group: 'Tragwerk', hint: 'Balken zeichnen' },
    rod: { name: 'Stab', group: 'Tragwerk', hint: 'Stab (gelenkig angeschlossen) zeichnen' },
    rope: { name: 'Seil', group: 'Tragwerk', hint: 'Seil zeichnen' },
    spring: { name: 'Feder', group: 'Tragwerk', hint: 'Feder zeichnen' },
    fest: { name: 'Festlager', group: 'Lager' },
    los: { name: 'Loslager', group: 'Lager' },
    gleit: { name: 'Loslager (Rollen)', group: 'Lager' },
    clamp: { name: 'Einspannung', group: 'Lager' },
    schiebe: { name: 'Parallel­führung', group: 'Lager' },
    pendel: { name: 'Pendel­stütze', group: 'Lager' },
    hinge: { name: 'Gelenk', group: 'Verbindung' },
    sleeve: { name: 'Schiebe­hülse', group: 'Verbindung' },
    sleevepin: { name: 'Schiebehülse drehbar', group: 'Verbindung' },
    parallel: { name: 'Parallel­führung (Q = 0)', group: 'Verbindung' },
    pulley: { name: 'Rolle', group: 'Seil & Masse' },
    drum: { name: 'Feste Trommel (Reibung)', group: 'Seil & Masse' },
    mass: { name: 'Masse', group: 'Seil & Masse' },
    force: { name: 'Einzelkraft', group: 'Lasten' },
    moment: { name: 'Moment', group: 'Lasten' },
    qconst: { name: 'Strecken­last', group: 'Lasten' },
    qtri: { name: 'Dreiecks­last', group: 'Lasten' },
    dimh: { name: 'Maß horizontal', group: 'Bemaßung' },
    dimv: { name: 'Maß vertikal', group: 'Bemaßung' },
    dima: { name: 'Maß parallel', group: 'Bemaßung' },
    angle: { name: 'Winkel', group: 'Bemaßung' },
    text: { name: 'Text', group: 'Sonstiges' },
  };
  const DRAW_ITEMS = ['beam', 'rod', 'rope', 'spring'];
  const DIM_ITEMS = { dimh: 'h', dimv: 'v', dima: 'a' };

  function icon(item) {
    const k = '#111';
    let s = '';
    const sup = (t, x = 28, y = 12, rot = 0, off = 0) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})">${TM.supportShape(t, off)}</g>`;
    switch (item) {
      case 'beam': s = `<path d="M8 20H48" stroke="${k}" stroke-width="9"/><path d="M8 20H48" stroke="#fff" stroke-width="5"/>`; break;
      case 'rod': s = `<line x1="8" y1="20" x2="48" y2="20" stroke="${k}" stroke-width="2.2"/><circle cx="8" cy="20" r="3.8" fill="#fff" stroke="${k}" stroke-width="1.5"/><circle cx="48" cy="20" r="3.8" fill="#fff" stroke="${k}" stroke-width="1.5"/>`; break;
      case 'rope': s = `<path d="M6 30Q28 6 50 12" stroke="${k}" stroke-width="1.4" fill="none"/>`; break;
      case 'spring': s = `<path d="M6 20H14L17 14L21 26L25 14L29 26L33 14L37 26L40 20H50" stroke="${k}" stroke-width="1.5" fill="none"/>`; break;
      case 'fest': case 'los': case 'gleit': s = sup(item, 28, 8); break;
      case 'clamp': s = `<path d="M24 20H52" stroke="${k}" stroke-width="7"/><path d="M24 20H52" stroke="#fff" stroke-width="3.5"/>` + sup('clamp', 20, 20, 90, 0); break;
      case 'schiebe': s = `<path d="M30 20H52" stroke="${k}" stroke-width="7"/><path d="M30 20H52" stroke="#fff" stroke-width="3.5"/>` + sup('schiebe', 26, 20, 90, 0); break;
      case 'pendel': s = `<line x1="28" y1="4" x2="28" y2="20" stroke="${k}" stroke-width="2"/><circle cx="28" cy="4" r="3" fill="#fff" stroke="${k}" stroke-width="1.3"/>` + `<g transform="translate(28 20) scale(.8)">${TM.supportShape('fest')}</g>`; break;
      case 'sleeve': case 'sleevepin': s = `<path d="M6 20H50" stroke="${k}" stroke-width="7"/><path d="M6 20H50" stroke="#fff" stroke-width="3.5"/><rect x="18" y="12" width="20" height="16" fill="none" stroke="${k}" stroke-width="1.6"/>` + (item === 'sleevepin' ? `<circle cx="28" cy="20" r="3.6" fill="#fff" stroke="${k}" stroke-width="1.4"/>` : ''); break;
      case 'parallel': s = `<path d="M6 20H50" stroke="${k}" stroke-width="7"/><path d="M6 20H50" stroke="#fff" stroke-width="3.5"/><rect x="23" y="15" width="10" height="10" fill="#fff"/><line x1="23" y1="9" x2="23" y2="31" stroke="${k}" stroke-width="2"/><line x1="33" y1="9" x2="33" y2="31" stroke="${k}" stroke-width="2"/><line x1="23" y1="11" x2="33" y2="11" stroke="${k}" stroke-width="1.2"/><line x1="23" y1="29" x2="33" y2="29" stroke="${k}" stroke-width="1.2"/>`; break;
      case 'pulley': case 'drum': s = `<line x1="16" y1="20" x2="16" y2="38" stroke="${k}" stroke-width="1.3"/><line x1="40" y1="20" x2="40" y2="38" stroke="${k}" stroke-width="1.3"/><path d="M16 20A12 12 0 0 1 40 20" stroke="${k}" stroke-width="2" fill="none"/><circle cx="28" cy="20" r="12" fill="${item === 'drum' ? '#e4e4e4' : '#fff'}" stroke="${k}" stroke-width="1.6"/><circle cx="28" cy="20" r="2.4" fill="#fff" stroke="${k}"/>`; break;
      case 'mass': s = `<line x1="28" y1="2" x2="28" y2="12" stroke="${k}" stroke-width="1.3"/><rect x="15" y="12" width="26" height="22" fill="#eee" stroke="${k}" stroke-width="1.6"/><text x="28" y="27" font-size="13" text-anchor="middle" font-style="italic" font-family="serif">m</text>`; break;
      case 'hinge': s = `<path d="M6 20H50" stroke="${k}" stroke-width="7"/><path d="M6 20H50" stroke="#fff" stroke-width="3.5"/><circle cx="28" cy="20" r="4.5" fill="#fff" stroke="${k}" stroke-width="1.5"/>`; break;
      case 'force': s = TM.arrowSVG({ x: 20, y: 4 }, { x: 34, y: 34 }, { w: 2, hl: 10, hw: 4 }); break;
      case 'moment': s = `<path d="M22 30A11 11 0 1 1 36 29" stroke="${k}" stroke-width="2" fill="none"/><polygon points="37,30 32,25 30,33" fill="${k}"/>`; break;
      case 'qconst': case 'qtri': {
        const h = (x) => (item === 'qconst' ? 14 : 2 + (x - 8) * 0.35);
        s = `<path d="M6 32H50" stroke="${k}" stroke-width="5"/>`;
        for (let x = 8; x <= 48; x += 8) s += TM.arrowSVG({ x, y: 28 - h(x) }, { x, y: 29 }, { w: 1, hl: 5, hw: 2 });
        s += `<line x1="8" y1="${28 - h(8)}" x2="48" y2="${28 - h(48)}" stroke="${k}" stroke-width="1.1"/>`;
        break;
      }
      case 'dimh': s = `<line x1="10" y1="8" x2="10" y2="30" stroke="${k}" stroke-width=".8"/><line x1="46" y1="8" x2="46" y2="30" stroke="${k}" stroke-width=".8"/>` + TM.arrowSVG({ x: 28, y: 25 }, { x: 10, y: 25 }, { w: .9, hl: 6, hw: 2 }) + TM.arrowSVG({ x: 28, y: 25 }, { x: 46, y: 25 }, { w: .9, hl: 6, hw: 2 }) + `<text x="28" y="18" font-size="11" text-anchor="middle" font-style="italic" font-family="serif">a</text>`; break;
      case 'dimv': s = `<line x1="14" y1="4" x2="40" y2="4" stroke="${k}" stroke-width=".8"/><line x1="14" y1="36" x2="40" y2="36" stroke="${k}" stroke-width=".8"/>` + TM.arrowSVG({ x: 34, y: 20 }, { x: 34, y: 4 }, { w: .9, hl: 6, hw: 2 }) + TM.arrowSVG({ x: 34, y: 20 }, { x: 34, y: 36 }, { w: .9, hl: 6, hw: 2 }) + `<text x="24" y="24" font-size="11" text-anchor="middle" font-style="italic" font-family="serif">h</text>`; break;
      case 'dima': s = `<line x1="8" y1="34" x2="44" y2="8" stroke="${k}" stroke-width="2"/>` + TM.arrowSVG({ x: 32, y: 26 }, { x: 15, y: 38 }, { w: .9, hl: 6, hw: 2 }) + TM.arrowSVG({ x: 32, y: 26 }, { x: 50, y: 13 }, { w: .9, hl: 6, hw: 2 }); break;
      case 'angle': s = `<line x1="8" y1="34" x2="50" y2="34" stroke="${k}" stroke-width="2"/><line x1="8" y1="34" x2="42" y2="8" stroke="${k}" stroke-width="2"/><path d="M30 34A22 22 0 0 0 25.5 21" stroke="${k}" fill="none"/><text x="38" y="27" font-size="11" font-style="italic" font-family="serif">α</text>`; break;
      case 'text': s = `<text x="28" y="27" font-size="18" text-anchor="middle" font-style="italic" font-family="Times New Roman, serif">Aa</text>`; break;
    }
    return `<svg viewBox="0 0 56 40" xmlns="${NS}">${s}</svg>`;
  }

  function buildPalette() {
    const pal = $('#palette');
    const groups = {};
    for (const [key, it] of Object.entries(ITEMS)) (groups[it.group] ||= []).push(key);
    for (const [g, keys] of Object.entries(groups)) {
      const sec = document.createElement('div');
      sec.className = 'pal-sec';
      sec.innerHTML = `<h4>${g}</h4><div class="pal-grid"></div>`;
      const grid = sec.lastChild;
      for (const key of keys) {
        const d = document.createElement('div');
        d.className = 'pal-item';
        d.dataset.item = key;
        d.title = ITEMS[key].name + ' – ziehen zum Platzieren, klicken zum Aktivieren';
        d.innerHTML = icon(key) + `<span>${ITEMS[key].name}</span>`;
        d.addEventListener('pointerdown', (e) => paletteDown(e, key));
        grid.appendChild(d);
      }
      pal.appendChild(sec);
    }
  }

  function paletteDown(e, item) {
    if (e.button !== 0) return;
    e.preventDefault();
    const ghost = $('#ghost');
    const st = { x0: e.clientX, y0: e.clientY, moved: false };
    const move = (ev) => {
      if (!st.moved && Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) > 5) {
        st.moved = true;
        ghost.innerHTML = icon(item);
        ghost.style.display = 'block';
      }
      if (!st.moved) return;
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      if (overCanvas(ev)) {
        const p = clientToWorld(ev);
        ed.drop = { item, p, sn: snap(p) };
        ed.mouse = p;
      } else ed.drop = null;
      drawOverlay();
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.style.display = 'none';
      ed.drop = null;
      if (!st.moved) { activateTool(item); return; }
      if (overCanvas(ev)) {
        setTool('select');
        if (DIM_ITEMS[item] || item === 'angle') activateTool(item);
        else place(item, clientToWorld(ev));
      }
      drawOverlay();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function overCanvas(e) {
    const r = svg.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function activateTool(item) {
    if (DRAW_ITEMS.includes(item)) setTool('draw', { type: item });
    else if (DIM_ITEMS[item]) setTool('dim', { type: DIM_ITEMS[item] });
    else if (item === 'angle') setTool('angle');
    else setTool('place', { item });
  }

  function setTool(name, data = {}) {
    ed.tool = { name, ...data };
    svg.className.baseVal = name === 'select' ? '' : 'tool-' + name;
    const key = data.item || (name === 'draw' && data.type) || (name === 'dim' && { h: 'dimh', v: 'dimv', a: 'dima' }[data.type]) || (name === 'angle' && 'angle');
    document.querySelectorAll('.pal-item').forEach((el) => el.classList.toggle('active', el.dataset.item === key));
    updateHint();
    drawOverlay();
  }

  // ================================================================ Ansicht & Koordinaten
  function clientToWorld(e) {
    const r = svg.getBoundingClientRect();
    const X = (e.clientX - r.left - ed.view.tx) / ed.view.z;
    const Y = (e.clientY - r.top - ed.view.ty) / ed.view.z;
    return { x: X / S, y: -Y / S };
  }
  const tolW = (px) => px / (S * ed.view.z);
  const step = () => +ed.doc.meta.grid || 0.5;
  const snapOn = (e) => ed.doc.meta.snap !== false && !(e && e.altKey);

  function snap(p, o = {}) {
    const doc = ed.doc;
    const exN = o.exNodes ? new Set(o.exNodes) : null;
    const n = M.nodeAt(doc, p, tolW(11), exN);
    if (n) return { kind: 'node', node: n.id, x: n.x, y: n.y };
    const on = o.free ? false : snapOn(o.e);
    if (o.els !== false) {
      const h = M.elementAt(doc, p, tolW(8), o.exEls ? new Set(o.exEls) : null);
      if (h) {
        const A = M.node(doc, h.el.n1), B = M.node(doc, h.el.n2);
        const L = V.dist(A, B);
        let t = h.t;
        if (on && L > 0) t = Math.max(0, Math.min(1, (Math.round((t * L) / step()) * step()) / L));
        if (t < 1e-6 && !(exN && exN.has(A.id))) return { kind: 'node', node: A.id, x: A.x, y: A.y };
        if (t > 1 - 1e-6 && !(exN && exN.has(B.id))) return { kind: 'node', node: B.id, x: B.x, y: B.y };
        const q = V.lerp(A, B, t);
        return { kind: 'el', el: h.el.id, t, x: q.x, y: q.y };
      }
    }
    if (!on) return { kind: 'pt', x: p.x, y: p.y };
    const s = step();
    return { kind: 'pt', x: TM.clean(Math.round(p.x / s) * s), y: TM.clean(Math.round(p.y / s) * s) };
  }

  /** Macht aus einem Fangpunkt einen Knoten (teilt ggf. ein Element). */
  function resolve(sn) {
    const doc = ed.doc;
    if (sn.kind === 'node' && M.node(doc, sn.node)) return sn.node;
    const p = { x: sn.x, y: sn.y };
    const ex = M.nodeAt(doc, p, 1e-6);
    if (ex) return ex.id;
    const h = M.elementAt(doc, p, 1e-6);
    if (h && h.t > 1e-6 && h.t < 1 - 1e-6) return M.splitElement(doc, h.el, h.t).id;
    return M.addNode(doc, p.x, p.y).id;
  }

  // ================================================================ Historie
  const snapshot = () => JSON.stringify(ed.doc);
  function commit(before) {
    if (before === snapshot()) return false;
    ed.hist.push(before);
    if (ed.hist.length > 200) ed.hist.shift();
    ed.fut = [];
    persist();
    return true;
  }
  function mutate(fn, o = {}) {
    const before = snapshot();
    const r = fn();
    M.cleanup(ed.doc);
    validateSel();
    commit(before);
    redraw();
    if (o.props !== false) buildProps();
    return r;
  }
  function undo() {
    if (!ed.hist.length) return toast('Nichts rückgängig zu machen');
    ed.fut.push(snapshot());
    ed.doc = JSON.parse(ed.hist.pop());
    refreshAll();
  }
  function redo() {
    if (!ed.fut.length) return;
    ed.hist.push(snapshot());
    ed.doc = JSON.parse(ed.fut.pop());
    refreshAll();
  }
  function refreshAll() { validateSel(); persist(); redraw(); buildProps(); if (ed.mode === 'solve') buildSolvePanel(); }
  function persist() { try { localStorage.setItem(STORE, snapshot()); } catch (e) { /* ignorieren */ } }
  function validateSel() {
    if (!ed.sel) return;
    const k = ed.sel.kind === 'nlabel' ? 'node' : ed.sel.kind === 'llabel' ? 'load' : ed.sel.kind;
    if (!M.get(ed.doc, k, ed.sel.id)) ed.sel = null;
  }
  function setSel(s) {
    if (s && s.kind === 'nlabel') s = { kind: 'node', id: s.id };
    if (s && s.kind === 'llabel') s = { kind: 'load', id: s.id };
    ed.sel = s;
    redraw();
    buildProps();
  }
  function loadDoc(doc, fit = true) {
    ed.doc = M.normalize(doc);
    ed.sel = null;
    redraw();
    buildProps();
    if (fit) fitView();
  }

  // ================================================================ Zeichnen
  function redraw() {
    const { tx, ty, z } = ed.view;
    gView.setAttribute('transform', `translate(${tx} ${ty}) scale(${z})`);
    gGrid.innerHTML = gridSVG();
    let html;
    if (ed.mode === 'solve') {
      ed.res = TM.solve(ed.doc);
      const ok = ed.res && ed.res.members;
      const solved = ok ? new Map(ed.res.unknownLoads.map((x) => [x.l.id, x.v])) : null;
      html = TM.render(ed.doc, { edit: true, sel: ed.sel, z, hideSupports: ok && ed.sopt.freebody, solved });
      if (ok) html += `<g pointer-events="none">${TM.renderSolution(ed.doc, ed.res, ed.sopt)}</g>`;
    } else html = TM.render(ed.doc, { edit: true, sel: ed.sel, z });
    gDraw.innerHTML = html;
    drawOverlay();
    if (ed.mode === 'solve') updateSolveResults();
  }

  function gridSVG() {
    if (ed.doc.meta.showGrid === false) return '';
    const { tx, ty, z } = ed.view;
    const w = svg.clientWidth, h = svg.clientHeight;
    let st = step() * S;
    while (st * z < 9) st *= 2;
    const x0 = -tx / z, y0 = -ty / z, x1 = (w - tx) / z, y1 = (h - ty) / z;
    let minor = '', major = '';
    const unit = S;
    for (let X = Math.floor(x0 / st) * st; X <= x1; X += st) {
      const isMaj = Math.abs(X / unit - Math.round(X / unit)) < 1e-6;
      (isMaj ? (major += `M${X} ${y0}V${y1}`) : (minor += `M${X} ${y0}V${y1}`));
    }
    for (let Y = Math.floor(y0 / st) * st; Y <= y1; Y += st) {
      const isMaj = Math.abs(Y / unit - Math.round(Y / unit)) < 1e-6;
      (isMaj ? (major += `M${x0} ${Y}H${x1}`) : (minor += `M${x0} ${Y}H${x1}`));
    }
    const sw = 1 / z;
    return `<path d="${minor}" stroke="#eef1f5" stroke-width="${sw}"/><path d="${major}" stroke="#dfe4ec" stroke-width="${sw}"/>`;
  }

  function marker(sn) {
    if (!sn) return '';
    const z = ed.view.z, p = TM.P(sn), r = 6 / z, w = 1.5 / z;
    if (sn.kind === 'node') return `<rect class="pv" x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" stroke-width="${w}"/>`;
    if (sn.kind === 'el') return `<path class="pv" d="M${p.x} ${p.y - r}L${p.x + r} ${p.y}L${p.x} ${p.y + r}L${p.x - r} ${p.y}Z" stroke-width="${w}"/>`;
    return `<path class="pv" d="M${p.x - r} ${p.y}H${p.x + r}M${p.x} ${p.y - r}V${p.y + r}" stroke-width="${w}"/>`;
  }

  function drawOverlay() {
    const z = ed.view.z, doc = ed.doc;
    let s = '';
    const selNode = ed.sel && ed.sel.kind === 'node' ? ed.sel.id : null;
    for (const n of doc.nodes) {
      const p = TM.P(n);
      s += `<circle class="nh${n.id === selNode ? ' on' : ''}" cx="${p.x}" cy="${p.y}" r="${4.5 / z}" stroke-width="${1.2 / z}" data-kind="node" data-id="${n.id}"/>`;
    }
    if (ed.sel && ed.sel.kind === 'load') {
      const L = M.get(doc, 'load', ed.sel.id);
      if (L && L.type === 'force') {
        const fe = TM.forceEnds(doc, L);
        const h = L.tip !== false ? fe.tail : fe.tip;
        s += `<circle class="nh" cx="${h.x}" cy="${h.y}" r="${5.5 / z}" stroke-width="${1.4 / z}" data-kind="fhandle" data-id="${L.id}"><title>Ziehen: Richtung und Länge</title></circle>`;
      }
    }
    const t = ed.tool;
    const txt = (p, str) => `<text class="pvt" x="${p.x + 12 / z}" y="${p.y - 12 / z}" font-size="${12 / z}">${TM.esc(str)}</text>`;
    if (t.name === 'draw') {
      if (t.start && t.cur) {
        const a = TM.P(t.start), b = TM.P(t.cur);
        s += `<line class="pv" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${2 / z}" stroke-dasharray="${6 / z} ${4 / z}"/>`;
        const L = V.dist(t.start, t.cur), ang = V.ang(V.sub(t.cur, t.start));
        s += txt(b, `l = ${TM.fmtNum(L)}   φ = ${TM.fmtNum(ang, 1)}°`);
      }
      s += marker(t.cur || ed.hover) + marker(t.start);
    } else if (t.name === 'dim') {
      if (t.a) s += marker(t.a);
      if (t.a && (t.b || ed.hover)) {
        const B = t.b || ed.hover;
        if (V.dist(t.a, B) > 1e-9) {
          const d = { type: t.type, off: t.b ? dimOffset(t.type, t.a, t.b, ed.mouse) : 0, label: '' };
          s += `<g opacity=".6">${TM.dimSVG(d, t.a, B, doc.meta.unit)}</g>`;
        }
      }
      s += marker(ed.hover);
    } else if (t.name === 'angle') {
      if (t.first) {
        const e = M.el(doc, t.first.el);
        if (e) {
          const a = TM.P(M.node(doc, e.n1)), b = TM.P(M.node(doc, e.n2));
          s += `<line class="pv" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${4 / z}" opacity=".5"/>`;
        }
      }
    } else if (t.name === 'place') {
      s += marker(ed.hover);
    }
    if (ed.drop) s += marker(ed.drop.sn);
    if (ed.drag && ed.drag.type === 'node' && ed.drag.target && ed.drag.target.kind !== 'pt') {
      const p = TM.P(ed.drag.target);
      s += `<circle class="pv" cx="${p.x}" cy="${p.y}" r="${11 / z}" stroke-width="${2 / z}"/>`;
    }
    gOver.innerHTML = s;
  }

  function fitView() {
    const w = svg.clientWidth, h = svg.clientHeight;
    let bb;
    try { bb = gDraw.getBBox(); } catch (e) { bb = null; }
    if (!bb || bb.width + bb.height < 1) { ed.view = { tx: w / 2, ty: h / 2, z: 1.2 }; redraw(); return; }
    const m = 60;
    const z = Math.max(0.2, Math.min(3, Math.min((w - 2 * m) / bb.width, (h - 2 * m) / bb.height)));
    ed.view = { z, tx: w / 2 - (bb.x + bb.width / 2) * z, ty: h / 2 - (bb.y + bb.height / 2) * z };
    redraw();
  }

  // ================================================================ Platzieren
  function nextLabel(base) {
    const used = new Set(ed.doc.loads.map((l) => l.label));
    for (let k = 1; ; k++) if (!used.has(`${base}_${k}`)) return `${base}_${k}`;
  }

  function nextMassLabel() {
    const used = new Set(ed.doc.loads.filter((l) => l.type === 'mass').map((l) => l.label));
    if (!used.size) return 'm';
    for (let k = 1; ; k++) if (!used.has(`m_${k}`)) return `m_${k}`;
  }

  function defaultSupportAngle(nid, type) {
    if (type !== 'clamp' && type !== 'schiebe') return -90;
    const els = M.elementsAt(ed.doc, nid);
    if (els.length !== 1) return -90;
    const n = M.node(ed.doc, nid), o = M.node(ed.doc, M.other(els[0], nid));
    return Math.round(V.ang(V.sub(n, o)) * 1e6) / 1e6;
  }

  function place(item, p, e) {
    const doc = ed.doc;
    const sn = snap(p, { e });
    let out = null, err = null;
    mutate(() => {
      switch (item) {
        case 'beam': case 'rod': case 'rope': case 'spring': {
          const n1 = resolve(sn), A = M.node(doc, n1);
          const L = item === 'beam' ? 4 : 3;
          const end = { x: A.x + L, y: A.y };
          const ex = M.nodeAt(doc, end, 1e-6);
          const n2 = ex ? ex.id : M.addNode(doc, end.x, end.y).id;
          out = { kind: 'element', id: M.addElement(doc, item, n1, n2).id };
          break;
        }
        case 'fest': case 'los': case 'gleit': case 'clamp': case 'schiebe': {
          const nid = resolve(sn);
          let s = M.supportAt(doc, nid);
          if (!s) { s = { id: TM.uid('s'), node: nid, type: item, angle: -90 }; doc.supports.push(s); }
          s.type = item;
          s.angle = defaultSupportAngle(nid, item);
          out = { kind: 'support', id: s.id };
          break;
        }
        case 'pendel': {
          const top = resolve(sn), T = M.node(doc, top);
          const bot = M.addNode(doc, T.x, T.y - 2);
          M.addElement(doc, 'rod', top, bot.id);
          const s = { id: TM.uid('s'), node: bot.id, type: 'fest', angle: -90 };
          doc.supports.push(s);
          out = { kind: 'support', id: s.id };
          break;
        }
        case 'hinge': case 'sleeve': case 'sleevepin': case 'parallel': {
          if (sn.kind === 'pt') { err = 'Verbindung bitte auf einen Knoten oder ein Tragwerk ziehen.'; return; }
          const nid = resolve(sn);
          M.setJoint(doc, M.node(doc, nid), item === 'hinge' ? 'pin' : item);
          out = { kind: 'node', id: nid };
          break;
        }
        case 'pulley': case 'drum': {
          const nid = resolve(sn), n = M.node(doc, nid);
          n.pulley = { r: 0.4, mode: item === 'drum' ? 'friction' : 'free', mu: 0.3, heavy: null };
          if (!M.supportAt(doc, nid) && !M.elementsAt(doc, nid).length)
            doc.supports.push({ id: TM.uid('s'), node: nid, type: item === 'drum' ? 'clamp' : 'fest', angle: 90 });
          out = { kind: 'node', id: nid };
          break;
        }
        case 'mass': {
          const L = { id: TM.uid('l'), type: 'mass', node: resolve(sn), value: 50, label: nextMassLabel(), showG: false, gLabel: 'G' };
          doc.loads.push(L);
          out = { kind: 'load', id: L.id };
          break;
        }
        case 'force': {
          const L = { id: TM.uid('l'), type: 'force', node: resolve(sn), angle: -90, value: 10, len: 55, tip: true, label: nextLabel('F'), angRef: 'none', angLabel: 'α' };
          doc.loads.push(L);
          out = { kind: 'load', id: L.id };
          break;
        }
        case 'moment': {
          const L = { id: TM.uid('l'), type: 'moment', node: resolve(sn), value: 10, ccw: true, r: 20, gap: -90, label: nextLabel('M') };
          doc.loads.push(L);
          out = { kind: 'load', id: L.id };
          break;
        }
        case 'qconst': case 'qtri': {
          let el = null;
          if (sn.kind === 'el') el = M.el(doc, sn.el);
          if (!el) { const h = M.elementAt(doc, p, tolW(25)); el = h && h.el; }
          if (!el) { err = 'Streckenlast bitte auf einen Balken ziehen.'; return; }
          const L = { id: TM.uid('l'), type: 'lineload', el: el.id, value: 5, qa: item === 'qtri' ? 0 : 1, qb: 1, h: 28, side: 1, dir: 'perp', label: 'q_0' };
          doc.loads.push(L);
          out = { kind: 'load', id: L.id };
          break;
        }
        case 'text': {
          const t = { id: TM.uid('t'), x: sn.x, y: sn.y, text: 'Text', size: 16, italic: true };
          doc.texts.push(t);
          out = { kind: 'text', id: t.id };
          break;
        }
      }
    });
    if (err) toast(err);
    if (out) setSel(out);
    return out;
  }

  // ================================================================ Maus-Interaktion
  function dimOffset(type, A, B, m) {
    if (!m) return 0;
    let off;
    if (type === 'h') off = m.y - A.y;
    else if (type === 'v') off = m.x - A.x;
    else off = V.dot(V.sub(m, A), V.perp(V.norm(V.sub(B, A))));
    if (snapOn()) off = Math.round(off / (step() / 2)) * (step() / 2);
    return TM.clean(off);
  }

  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('pointerdown', (e) => {
    const p = clientToWorld(e);
    ed.mouse = p;
    if (e.button === 1 || (e.button === 0 && ed.space)) return startPan(e);
    if (e.button === 2) {
      if (ed.tool.name !== 'select') setTool('select');
      else startPan(e);
      return;
    }
    if (e.button !== 0) return;
    switch (ed.tool.name) {
      case 'select': return selectDown(e, p);
      case 'draw': return drawDown(e, p);
      case 'dim': return dimDown(e, p);
      case 'angle': return angleDown(e, p);
      case 'place': {
        const item = ed.tool.item;
        setTool('select');
        place(item, p, e);
        return;
      }
    }
  });

  function capture(e) { try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignorieren */ } }

  function startPan(e) {
    ed.drag = { type: 'pan', x0: e.clientX, y0: e.clientY, tx: ed.view.tx, ty: ed.view.ty };
    svg.classList.add('panning');
    capture(e);
  }

  function selectDown(e, p) {
    const hit = e.target.closest && e.target.closest('[data-kind]');
    if (!hit) { if (ed.sel) setSel(null); return startPan(e); }
    let kind = hit.dataset.kind;
    const id = hit.dataset.id;
    const before = snapshot();
    const rotHandle = kind === 'fhandle';
    if (rotHandle) kind = 'load';
    if (kind === 'llabel') {
      setSel({ kind: 'load', id });
      const L = M.get(ed.doc, 'load', id);
      ed.drag = { before, start: p, moved: false, type: 'llabel', id, ox: L.lox || 0, oy: L.loy || 0 };
      capture(e);
      return;
    }
    if (!(ed.sel && ed.sel.kind === kind && ed.sel.id === id)) setSel({ kind, id });
    const doc = ed.doc;
    const base = { before, start: p, moved: false };
    if (kind === 'node' || kind === 'support') {
      const nid = kind === 'node' ? id : M.get(doc, 'support', id).node;
      ed.drag = { ...base, type: 'node', id: nid };
    } else if (kind === 'element') {
      const el = M.el(doc, id);
      const ids = e.shiftKey ? [...M.component(doc, el.n1)] : [el.n1, el.n2];
      const orig = new Map(ids.map((i) => { const n = M.node(doc, i); return [i, { x: n.x, y: n.y }]; }));
      ed.drag = { ...base, type: 'elmove', ids, orig, anchor: el.n1 };
    } else if (kind === 'load') {
      const L = M.get(doc, 'load', id);
      if (L.type === 'force' && !rotHandle && !e.shiftKey && M.lineNode(doc, L.node)) ed.drag = { ...base, type: 'node', id: L.node, slideOnly: true };
      else ed.drag = { ...base, type: 'load', id };
    } else if (kind === 'dim') {
      ed.drag = { ...base, type: 'dim', id };
    } else if (kind === 'text') {
      const t = M.get(doc, 'text', id);
      ed.drag = { ...base, type: 'text', id, ox: t.x, oy: t.y };
    } else if (kind === 'nlabel') {
      ed.drag = { ...base, type: 'nlabel', id };
    }
    capture(e);
  }

  function drawDown(e, p) {
    const t = ed.tool;
    const sn = drawSnap(p, e);
    if (!t.start) {
      t.start = sn;
      t.cur = null;
      t.pressAt = { x: e.clientX, y: e.clientY };
      ed.drag = { type: 'draw' };
      capture(e);
    } else {
      finishDraw(sn, true);
    }
  }

  function drawSnap(p, e) {
    const t = ed.tool;
    let sn = snap(p, { e });
    if (t.start && e && e.shiftKey && sn.kind !== 'node') {
      const v = V.sub(p, t.start);
      const ang = Math.round(V.ang(v) / 15) * 15;
      let L = V.len(v);
      if (snapOn(e)) L = Math.round(L / step()) * step();
      const q = V.add(t.start, V.mul(V.dir(ang), L));
      sn = { kind: 'pt', x: TM.clean(q.x), y: TM.clean(q.y) };
    }
    return sn;
  }

  function finishDraw(sn, chain) {
    const t = ed.tool;
    if (!t.start || V.dist(t.start, sn) < 1e-6) return;
    const start = t.start;
    let elId = null, endId = null;
    mutate(() => {
      const n1 = resolve(start);
      const n2 = resolve(sn);
      if (n1 === n2) return;
      elId = M.addElement(ed.doc, t.type, n1, n2).id;
      endId = n2;
    });
    if (elId) setSel({ kind: 'element', id: elId });
    if (chain && endId) {
      const n = M.node(ed.doc, endId);
      t.start = { kind: 'node', node: endId, x: n.x, y: n.y };
    } else t.start = null;
    t.cur = null;
    drawOverlay();
  }

  function dimDown(e, p) {
    const t = ed.tool;
    const sn = snap(p, { e });
    if (!t.a) { t.a = sn; }
    else if (!t.b) {
      if (V.dist(t.a, sn) < 1e-9) return;
      t.b = sn;
    } else {
      const off = dimOffset(t.type, t.a, t.b, p);
      let id = null;
      mutate(() => {
        const a = resolve(t.a), b = resolve(t.b);
        if (a === b) return;
        const d = { id: TM.uid('d'), type: t.type, a, b, off, label: '' };
        ed.doc.dims.push(d);
        id = d.id;
      });
      t.a = t.b = null;
      if (id) setSel({ kind: 'dim', id });
    }
    updateHint();
    drawOverlay();
  }

  function forceAt(e) {
    const hit = e.target.closest && e.target.closest('[data-kind="load"],[data-kind="llabel"],[data-kind="fhandle"]');
    if (!hit) return null;
    const L = M.get(ed.doc, 'load', hit.dataset.id);
    return L && L.type === 'force' ? L : null;
  }

  function angleDown(e, p) {
    const t = ed.tool, doc = ed.doc;
    const F = forceAt(e);
    const h = F ? null : M.elementAt(doc, p, tolW(10));
    if (!t.first) {
      if (F) t.first = { force: F.id, p };
      else if (h) t.first = { el: h.el.id, p };
      else return toast('Bitte zuerst ein Element oder eine Kraft anklicken.');
      updateHint();
      drawOverlay();
      return;
    }
    const refTo = (vtx) => {
      const ref = Math.round(V.ang(V.sub(p, vtx)) / 90) * 90;
      return ((ref % 360) + 360) % 360;
    };
    let dim = null;
    const fail = (msg) => { toast(msg); t.first = null; drawOverlay(); updateHint(); };
    const F1 = t.first.force && M.get(doc, 'load', t.first.force);
    const e1 = t.first.el && M.el(doc, t.first.el);
    if (F1 || F) {
      // Winkel an einer Kraft: Schenkel A = Element, zweite Kraft oder Bezugsachse; Schenkel B = Kraft
      const Fb = F1 || F;
      const vtx = M.node(doc, Fb.node);
      const other = F1 ? (F && F.id !== F1.id ? { force: F } : h ? { el: h.el } : null) : { el: e1 };
      if (other && other.force) {
        if (other.force.node !== Fb.node) return fail('Die Kräfte greifen nicht im selben Punkt an.');
        dim = { v: vtx.id, fa: other.force.id, a: null, fb: Fb.id, b: null };
      } else if (other && other.el) {
        const el = other.el;
        if (el.n1 !== vtx.id && el.n2 !== vtx.id) return fail('Das Element geht nicht durch den Angriffspunkt der Kraft.');
        dim = { v: vtx.id, a: M.other(el, vtx.id), fb: Fb.id, b: null };
      } else {
        dim = { v: vtx.id, a: null, aRef: refTo(vtx), fb: Fb.id, b: null };
      }
    } else if (h && h.el.id !== e1.id) {
      const e2 = h.el;
      const shared = [e1.n1, e1.n2].find((n) => n === e2.n1 || n === e2.n2);
      if (!shared) return fail('Die beiden Elemente haben keinen gemeinsamen Knoten.');
      dim = { v: shared, a: M.other(e1, shared), b: M.other(e2, shared), aRef: 0 };
    } else {
      const A = M.node(doc, e1.n1), B = M.node(doc, e1.n2);
      const vtx = V.dist(t.first.p, A) <= V.dist(t.first.p, B) ? A : B;
      dim = { v: vtx.id, a: null, aRef: refTo(vtx), b: M.other(e1, vtx.id) };
    }
    let id = null;
    mutate(() => {
      const d = { id: TM.uid('d'), type: 'angle', label: 'α', r: 30, flip: false, ...dim };
      ed.doc.dims.push(d);
      id = d.id;
    });
    t.first = null;
    if (id) setSel({ kind: 'dim', id });
    updateHint();
  }

  /** Setzt den Wert eines Winkelmaßes: dreht die Kraft bzw. den zweiten Schenkel. */
  function setAngleDim(doc, d, v) {
    const g = TM.angleGeom(doc, d);
    const target = (Math.sign(g.sweep) || 1) * v;
    if (d.fb) {
      const L = M.get(doc, 'load', d.fb);
      const nb = V.rot(g.dirA, target);
      L.angle = TM.clean(norm180(V.ang(nb) + (L.tip !== false ? 180 : 0)));
    } else M.rotateAbout(doc, d.v, d.b, target - g.sweep, ed.follow, d.a);
  }

  svg.addEventListener('pointermove', (e) => {
    const p = clientToWorld(e);
    ed.mouse = p;
    showCoords(p);
    const d = ed.drag;
    if (d) return dragMove(e, p, d);
    const t = ed.tool;
    if (t.name === 'draw') { if (t.start) t.cur = drawSnap(p, e); ed.hover = snap(p, { e }); drawOverlay(); }
    else if (t.name === 'dim') { ed.hover = snap(p, { e }); drawOverlay(); }
    else if (t.name === 'place') { ed.hover = snap(p, { e }); drawOverlay(); }
  });

  function dragMove(e, p, d) {
    const doc = ed.doc;
    if (d.type === 'pan') {
      ed.view.tx = d.tx + e.clientX - d.x0;
      ed.view.ty = d.ty + e.clientY - d.y0;
      redraw();
      return;
    }
    if (d.type === 'draw') {
      ed.tool.cur = drawSnap(p, e);
      drawOverlay();
      return;
    }
    if (!d.moved && V.dist(p, d.start) < tolW(3)) return;
    d.moved = true;
    switch (d.type) {
      case 'node': {
        const n = M.node(doc, d.id);
        const ln = !e.ctrlKey && M.lineNode(doc, n.id);
        if (ln) {
          const L = V.dist(ln.a, ln.b), u = V.norm(V.sub(ln.b, ln.a));
          let sp = V.dot(V.sub(p, ln.a), u);
          if (snapOn(e)) sp = Math.round(sp / step()) * step();
          const lo = snapOn(e) ? Math.min(step(), L / 2) : L * 0.01;
          sp = Math.max(lo, Math.min(L - lo, sp));
          n.x = TM.clean(ln.a.x + u.x * sp); n.y = TM.clean(ln.a.y + u.y * sp);
          d.target = null;
          break;
        }
        if (d.slideOnly) break;
        const els = M.elementsAt(doc, n.id);
        const ex = [n.id, ...els.map((x) => M.other(x, n.id))];
        const sn = snap(p, { exNodes: ex, exEls: els.map((x) => x.id), e });
        n.x = sn.x; n.y = sn.y;
        d.target = sn;
        break;
      }
      case 'elmove': {
        const o = d.orig.get(d.anchor);
        let q = V.add(o, V.sub(p, d.start));
        if (snapOn(e)) { const s = step(); q = { x: Math.round(q.x / s) * s, y: Math.round(q.y / s) * s }; }
        const dl = V.sub(q, o);
        for (const [id, op] of d.orig) { const n = M.node(doc, id); n.x = TM.clean(op.x + dl.x); n.y = TM.clean(op.y + dl.y); }
        break;
      }
      case 'load': {
        const L = M.get(doc, 'load', d.id);
        if (L.type === 'force') {
          const n = M.node(doc, L.node);
          const v = V.sub(p, n);
          let ang = V.ang(v) + (L.tip !== false ? 180 : 0);
          if (!e.altKey) ang = Math.round(ang / 15) * 15;
          ang = ((ang + 180) % 360 + 360) % 360 - 180;
          L.angle = ang;
          L.len = Math.max(25, Math.min(220, Math.round((V.len(v) * S) / 5) * 5));
        } else if (L.type === 'moment') {
          const n = M.node(doc, L.node);
          let g = V.ang(V.sub(p, n)) + 180;
          if (!e.altKey) g = Math.round(g / 15) * 15;
          L.gap = ((g + 180) % 360 + 360) % 360 - 180;
        } else if (L.type === 'lineload') {
          const el = M.el(doc, L.el), A = M.node(doc, el.n1), B = M.node(doc, el.n2);
          const nrm = L.dir === 'vert' ? { x: 0, y: 1 } : TM.upNormal(A, B);
          const dd = V.dot(V.sub(p, A), nrm) * S;
          L.h = Math.max(8, Math.min(160, Math.round(Math.abs(dd))));
          L.side = dd >= 0 ? 1 : -1;
        }
        break;
      }
      case 'dim': {
        const dm = M.get(doc, 'dim', d.id);
        if (dm.type === 'angle') {
          const vn = M.node(doc, dm.v);
          dm.r = Math.max(12, Math.min(200, Math.round(V.dist(p, vn) * S)));
        } else {
          dm.off = dimOffset(dm.type, M.node(doc, dm.a), M.node(doc, dm.b), p);
        }
        break;
      }
      case 'text': {
        const t = M.get(doc, 'text', d.id);
        t.x = TM.clean(d.ox + p.x - d.start.x); t.y = TM.clean(d.oy + p.y - d.start.y);
        break;
      }
      case 'llabel': {
        const L = M.get(doc, 'load', d.id);
        L.lox = Math.round(d.ox + (p.x - d.start.x) * S);
        L.loy = Math.round(d.oy - (p.y - d.start.y) * S);
        break;
      }
      case 'nlabel': {
        const n = M.node(doc, d.id);
        n.lx = Math.round((p.x - n.x) * S); n.ly = Math.round(-(p.y - n.y) * S);
        break;
      }
    }
    redraw();
  }

  svg.addEventListener('pointerup', (e) => endDrag(e));
  svg.addEventListener('pointercancel', (e) => endDrag(e));
  function endDrag(e) {
    const d = ed.drag;
    ed.drag = null;
    svg.classList.remove('panning');
    if (!d) return;
    if (d.type === 'draw') {
      const t = ed.tool;
      const far = t.pressAt && Math.hypot(e.clientX - t.pressAt.x, e.clientY - t.pressAt.y) > 6;
      if (far && t.cur) finishDraw(t.cur, false);
      return;
    }
    if (d.type === 'pan' || !d.moved) return;
    const doc = ed.doc;
    if (d.type === 'node' && d.target && d.target.kind !== 'pt') {
      let keep = null;
      if (d.target.kind === 'node') keep = d.target.node;
      else if (d.target.kind === 'el') {
        const el = M.el(doc, d.target.el);
        if (el) keep = M.splitElement(doc, el, d.target.t).id;
      }
      if (keep) { M.mergeNodes(doc, keep, d.id); if (ed.sel && ed.sel.kind === 'node') ed.sel = { kind: 'node', id: keep }; }
    }
    M.cleanup(doc);
    validateSel();
    commit(d.before);
    redraw();
    buildProps();
  }

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    const z = Math.max(0.15, Math.min(6, ed.view.z * f));
    ed.view.tx = sx - ((sx - ed.view.tx) * z) / ed.view.z;
    ed.view.ty = sy - ((sy - ed.view.ty) * z) / ed.view.z;
    ed.view.z = z;
    redraw();
  }, { passive: false });

  window.addEventListener('resize', () => redraw());

  // ================================================================ Tastatur
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveJSON(); return; }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#fileIn').click(); return; }
    if (typing) return;
    if (e.key === ' ') { ed.space = true; e.preventDefault(); return; }
    if (e.key === 'Escape') {
      if (ed.tool.name !== 'select') setTool('select');
      else setSel(null);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && ed.sel) { e.preventDefault(); deleteSel(); return; }
    if (e.key === 'f' || e.key === 'F') { fitView(); return; }
    if ((e.key === 'r' || e.key === 'R') && ed.sel) { rotateSel(e.shiftKey ? -1 : 1); return; }
    if ((e.key === 'h' || e.key === 'H') && ed.sel && ed.sel.kind === 'node') {
      mutate(() => { const n = M.node(ed.doc, ed.sel.id); M.setJoint(ed.doc, n, n.hinge ? 'rigid' : 'pin'); });
    }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') ed.space = false; });

  function deleteSel() {
    const s = ed.sel;
    if (!s) return;
    mutate(() => M.remove(ed.doc, s.kind, s.id));
    ed.sel = null;
    buildProps();
  }

  function rotateSel(dir) {
    const s = ed.sel, doc = ed.doc;
    mutate(() => {
      if (s.kind === 'support') { const o = M.get(doc, 'support', s.id); o.angle = norm180((o.angle ?? -90) + 45 * dir); }
      else if (s.kind === 'load') {
        const o = M.get(doc, 'load', s.id);
        if (o.type === 'force') o.angle = norm180(o.angle + 15 * dir);
        else if (o.type === 'moment') o.gap = norm180(o.gap + 45 * dir);
        else if (o.type === 'lineload') o.side = -(o.side || 1);
      }
    });
  }
  const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

  // ================================================================ Eigenschaften
  function propsUI(box) {
    const row = (label, el, cls = '') => {
      const r = document.createElement('label');
      r.className = 'row ' + cls;
      const s = document.createElement('span');
      s.textContent = label;
      r.append(s, el);
      box.appendChild(r);
      return el;
    };
    /** Live-Bearbeitung; ein Undo-Schritt pro Feld-Bearbeitung. */
    const live = (inp, apply) => {
      let before = null;
      inp.addEventListener('focus', () => { before = snapshot(); });
      inp.addEventListener('input', () => { if (before === null) before = snapshot(); apply(); redraw(); });
      inp.addEventListener('change', () => { apply(); if (before !== null) commit(before); before = snapshot(); redraw(); });
    };
    const parse = (v) => parseFloat(String(v).replace(',', '.'));
    const api = {
      section(t) { const h = document.createElement('h4'); h.textContent = t; box.appendChild(h); },
      note(html) { const p = document.createElement('div'); p.className = 'note'; p.innerHTML = html; box.appendChild(p); },
      html(html) { const p = document.createElement('div'); p.innerHTML = html; box.appendChild(p); },
      text(label, get, set, o = {}) {
        const i = document.createElement(o.area ? 'textarea' : 'input');
        if (!o.area) i.type = 'text';
        i.value = get() ?? '';
        if (o.ph) i.placeholder = o.ph;
        live(i, () => set(i.value));
        return row(label, i, o.area ? 'wide' : '');
      },
      num(label, get, set, o = {}) {
        const i = document.createElement('input');
        i.type = 'number';
        i.step = o.step ?? 'any';
        const v = get();
        i.value = v == null ? '' : Math.round(v * 1e4) / 1e4;
        if (o.geom) {
          i.addEventListener('change', () => { const x = parse(i.value); if (isFinite(x)) mutate(() => set(x)); });
        } else live(i, () => { const x = parse(i.value); if (isFinite(x)) set(x); });
        return row(label, i);
      },
      select(label, get, set, options) {
        const s = document.createElement('select');
        for (const [v, t] of options) { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); }
        s.value = String(get());
        s.addEventListener('change', () => mutate(() => set(s.value)));
        return row(label, s);
      },
      check(label, get, set, o = {}) {
        const i = document.createElement('input');
        i.type = 'checkbox';
        i.checked = !!get();
        i.addEventListener('change', () => (o.noUndo ? (set(i.checked), redraw(), buildProps()) : mutate(() => set(i.checked))));
        return row(label, i, 'check');
      },
      buttons(list) {
        const d = document.createElement('div');
        d.className = 'btns';
        for (const [t, fn, cls] of list) {
          const b = document.createElement('button');
          b.textContent = t;
          if (cls) b.className = cls;
          b.addEventListener('click', fn);
          d.appendChild(b);
        }
        box.appendChild(d);
      },
    };
    return api;
  }

  function followCheck(ui) {
    ui.check('Angehängte Teile mitbewegen', () => ed.follow, (v) => (ed.follow = v), { noUndo: true });
  }

  function nodeSection(ui, n) {
    ui.section('Knoten');
    ui.text('Bezeichnung', () => n.label, (v) => (n.label = v), { ph: 'z. B. A' });
    ui.num('x', () => n.x, (v) => (n.x = v), { geom: true, step: step() });
    ui.num('y', () => n.y, (v) => (n.y = v), { geom: true, step: step() });
    ui.select('Verbindung', () => M.jointType(n), (v) => M.setJoint(ed.doc, n, v), [
      ['rigid', 'biegesteif'], ['pin', 'Gelenk (M = 0)'], ['sleeve', 'Schiebehülse (N = 0)'],
      ['sleevepin', 'Schiebehülse drehbar (N = 0, M = 0)'], ['parallel', 'Parallelführung (Q = 0)'],
    ]);
    if (n.joint) {
      ui.num('Führung [°]', () => n.jangle || 0, (v) => (n.jangle = v), { step: 15 });
      ui.note('Führungsrichtung der Verbindung (Gleitrichtung). Standard: Richtung des ersten angeschlossenen Elements.');
    }
    if (n.pulley) {
      const pl = n.pulley;
      ui.section(pl.mode === 'friction' ? 'Feste Trommel' : 'Rolle');
      ui.num('Radius', () => pl.r, (v) => { if (v > 0) pl.r = v; }, { step: 0.1 });
      ui.select('Art', () => pl.mode, (v) => (pl.mode = v), [['free', 'frei drehbar (reibungsfrei)'], ['friction', 'feststehend mit Seilreibung']]);
      if (pl.mode === 'friction') {
        ui.num('Reibung μ', () => pl.mu, (v) => (pl.mu = Math.max(0, v)), { step: 0.05 });
        const ropes = M.elementsAt(ed.doc, n.id).filter((e) => e.type === 'rope');
        if (ropes.length === 2) {
          const nm = (e) => { const o = M.node(ed.doc, M.other(e, n.id)); return (o.label ? `zu ${o.label}` : o.x < n.x ? 'links' : 'rechts') + ` (${TM.memberName(ed.doc, e)})`; };
          ui.select('Größere Seilkraft', () => pl.heavy || ropes[0].id, (v) => (pl.heavy = v), ropes.map((e) => [e.id, nm(e)]));
          ui.note('Grenzfall der Haftung (Euler-Eytelwein): S<sub>groß</sub> = S<sub>klein</sub> · e<sup>μα</sup>. Gewählt wird das Seil, in dessen Richtung das Seil zu rutschen droht. Die Trommel braucht eine Einspannung oder einen biegesteifen Anschluss.');
        }
      }
      ui.buttons([['Rolle entfernen', () => mutate(() => { delete n.pulley; })]]);
    }
    const sup = M.supportAt(ed.doc, n.id);
    const btns = [];
    if (M.elementsAt(ed.doc, n.id).length === 2)
      btns.push(['Knoten auflösen', () => { let err; mutate(() => { err = M.dissolveNode(ed.doc, n.id); }); if (err) toast(err); else setSel(null); }]);
    if (!sup) btns.push(['Festlager hier', () => addSupportAt(n.id, 'fest')]);
    if (!n.pulley) btns.push(['Rolle hier', () => mutate(() => { n.pulley = { r: 0.4, mode: 'free', mu: 0.3, heavy: null }; })]);
    btns.push(['Kraft hier', () => { const L = { id: TM.uid('l'), type: 'force', node: n.id, angle: -90, value: 10, len: 55, tip: true, label: nextLabel('F'), angRef: 'none', angLabel: 'α' }; mutate(() => ed.doc.loads.push(L)); setSel({ kind: 'load', id: L.id }); }]);
    ui.buttons(btns);
  }

  function unknownField(ui, L) {
    const unit = TM.loadUnit(ed.doc, L);
    ui.check('gesucht (unbekannt)', () => L.unknown, (v) => (L.unknown = v));
    if (!L.unknown) ui.num(`${L.type === 'mass' ? 'Masse' : 'Betrag'} [${unit}]`, () => L.value, (v) => (L.value = v), { step: 1 });
    else ui.note('Der Betrag wird beim Durchrechnen aus dem Gleichgewicht bestimmt (Richtung bleibt fest).');
  }

  function addSupportAt(nid, type) {
    const s = { id: TM.uid('s'), node: nid, type, angle: defaultSupportAngle(nid, type) };
    mutate(() => ed.doc.supports.push(s));
    setSel({ kind: 'support', id: s.id });
  }

  function buildProps() {
    const box = $('#props');
    box.innerHTML = '';
    const ui = propsUI(box);
    const doc = ed.doc, s = ed.sel;
    const obj = s && M.get(doc, s.kind, s.id);
    const title = $('#props-title');
    const del = () => ui.buttons([['Löschen', deleteSel, 'danger']]);
    if (ed.mode === 'solve') {
      const key = TM.quantities(doc).map((q) => q.kind + q.obj.id).join();
      if (key !== ed.solveKey) { ed.solveKey = key; buildSolvePanel(); }
    }
    if (!obj) { title.textContent = 'Aufgabe'; return docProps(ui); }

    if (s.kind === 'node') {
      title.textContent = 'Knoten';
      nodeSection(ui, obj);
      del();
    } else if (s.kind === 'element') {
      const e = obj, A = M.node(doc, e.n1), B = M.node(doc, e.n2);
      title.textContent = { beam: 'Balken', rod: 'Stab', rope: 'Seil', spring: 'Feder' }[e.type];
      ui.select('Typ', () => e.type, (v) => (e.type = v), [['beam', 'Balken'], ['rod', 'Stab'], ['rope', 'Seil'], ['spring', 'Feder']]);
      ui.section('Geometrie');
      ui.num('Länge', () => V.dist(A, B), (v) => { if (v > 0) M.setDistance(doc, A.id, B.id, V.norm(V.sub(B, A)), v, ed.follow); }, { geom: true, step: step() });
      ui.num('Winkel [°]', () => V.ang(V.sub(B, A)), (v) => M.rotateAbout(doc, A.id, B.id, v - V.ang(V.sub(B, A)), ed.follow), { geom: true, step: 15 });
      followCheck(ui);
      ui.note('Länge/Winkel verändern den Endknoten; angeschlossene Elemente wachsen mit.');
      ui.section('Beschriftung');
      ui.text('Text', () => e.label, (v) => (e.label = v), { ph: 'z. B. EI, l, 1' });
      ui.select('Seite', () => e.labelSide ?? 1, (v) => (e.labelSide = +v), [['1', 'oben / links'], ['-1', 'unten / rechts']]);
      ui.section('Aktionen');
      ui.buttons([
        ['Länge bemaßen', () => addDimFor(e)],
        ['In der Mitte teilen', () => { let nid; mutate(() => { nid = M.splitElement(doc, e, 0.5).id; }); setSel({ kind: 'node', id: nid }); }],
        ['Streckenlast', () => { const L = { id: TM.uid('l'), type: 'lineload', el: e.id, value: 5, qa: 1, qb: 1, h: 28, side: 1, dir: 'perp', label: 'q_0' }; mutate(() => doc.loads.push(L)); setSel({ kind: 'load', id: L.id }); }],
        ['Richtung umkehren', () => mutate(() => { [e.n1, e.n2] = [e.n2, e.n1]; for (const l of doc.loads) if (l.el === e.id) [l.qa, l.qb] = [l.qb, l.qa]; })],
      ]);
      del();
    } else if (s.kind === 'support') {
      const sp = obj;
      title.textContent = 'Lager';
      ui.select('Lagerart', () => sp.type, (v) => { sp.type = v; }, [
        ['fest', 'Festlager'], ['los', 'Loslager'], ['gleit', 'Loslager (Rollen)'], ['clamp', 'Einspannung'], ['schiebe', 'Parallelführung'],
      ]);
      ui.num('Richtung [°]', () => sp.angle ?? -90, (v) => (sp.angle = v), { step: 45 });
      ui.buttons([
        ['⟲ 45°', () => mutate(() => (sp.angle = norm180(sp.angle + 45)))],
        ['⟳ 45°', () => mutate(() => (sp.angle = norm180(sp.angle - 45)))],
        ['Boden unten', () => mutate(() => (sp.angle = -90))],
        ['Wand links', () => mutate(() => (sp.angle = 180))],
        ['Wand rechts', () => mutate(() => (sp.angle = 0))],
        ['Decke', () => mutate(() => (sp.angle = 90))],
      ]);
      ui.note('Richtung = Winkel vom Knoten zum Boden (−90° = Boden unten). Taste <kbd>R</kbd> dreht.');
      nodeSection(ui, M.node(doc, sp.node));
      ui.section('');
      del();
    } else if (s.kind === 'load') {
      const L = obj;
      if (L.type === 'force') {
        title.textContent = 'Einzelkraft';
        ui.text('Bezeichnung', () => L.label, (v) => (L.label = v), { ph: 'F, F_1, 2F …' });
        unknownField(ui, L);
        ui.num('Wirkrichtung [°]', () => L.angle, (v) => (L.angle = v), { step: 15 });
        ui.buttons([['↓', () => mutate(() => (L.angle = -90))], ['↑', () => mutate(() => (L.angle = 90))], ['→', () => mutate(() => (L.angle = 0))], ['←', () => mutate(() => (L.angle = 180))]]);
        ui.num('Pfeillänge [px]', () => L.len, (v) => (L.len = Math.max(15, v)), { step: 5 });
        ui.select('Angriff', () => (L.tip !== false ? '1' : '0'), (v) => (L.tip = v === '1'), [['1', 'Pfeilspitze am Punkt'], ['0', 'Pfeilende am Punkt']]);
        ui.section('Winkelangabe');
        ui.select('Bezug', () => L.angRef || 'none', (v) => (L.angRef = v), [['none', 'keine'], ['h', 'zur Horizontalen'], ['v', 'zur Vertikalen']]);
        ui.text('Winkel-Bez.', () => L.angLabel, (v) => (L.angLabel = v), { ph: 'α' });
        ui.note('Pfeil ziehen = Angriffspunkt entlang des Balkens verschieben. Runder Griff am Pfeilende = Richtung/Länge (15°-Raster, <kbd>Alt</kbd> frei). <kbd>Shift</kbd>+Ziehen am Pfeil dreht ebenfalls.');
      } else if (L.type === 'moment') {
        title.textContent = 'Moment';
        ui.text('Bezeichnung', () => L.label, (v) => (L.label = v), { ph: 'M_0' });
        unknownField(ui, L);
        ui.select('Drehsinn', () => (L.ccw !== false ? '1' : '0'), (v) => (L.ccw = v === '1'), [['1', 'gegen den Uhrzeigersinn ↺'], ['0', 'im Uhrzeigersinn ↻']]);
        ui.num('Radius [px]', () => L.r, (v) => (L.r = Math.max(8, v)), { step: 2 });
        ui.num('Öffnung [°]', () => L.gap, (v) => (L.gap = v), { step: 45 });
      } else if (L.type === 'mass') {
        title.textContent = 'Masse';
        ui.text('Bezeichnung', () => L.label, (v) => (L.label = v), { ph: 'm, m_1, 2m …' });
        unknownField(ui, L);
        ui.note(`Gewichtskraft G = m·g mit g = 9,81 m/s² (= ${TM.fmtNum(TM.gUnit(doc) * (+L.value || 0), 3)} ${TM.esc(TM.units(doc).F)}).`);
        ui.select('Lage', () => L.pos || 'auto', (v) => (L.pos = v === 'auto' ? null : v), [['auto', 'automatisch'], ['hang', 'hängend'], ['top', 'aufliegend']]);
        ui.check('Gewichtskraft zeichnen', () => L.showG, (v) => (L.showG = v));
        if (L.showG) ui.text('Bez. Gewicht', () => L.gLabel, (v) => (L.gLabel = v), { ph: 'G, mg' });
      } else {
        title.textContent = 'Streckenlast';
        ui.text('Bezeichnung', () => L.label, (v) => (L.label = v), { ph: 'q_0' });
        ui.num(`Größtwert [${TM.units(doc).q}]`, () => L.value, (v) => (L.value = v), { step: 0.5 });
        const shape = Math.abs(L.qa - L.qb) < 1e-9 ? 'const' : L.qa === 0 && L.qb > 0 ? 'up' : L.qb === 0 && L.qa > 0 ? 'down' : 'trap';
        ui.select('Verlauf', () => shape, (v) => {
          if (v === 'const') { L.qa = 1; L.qb = 1; } else if (v === 'up') { L.qa = 0; L.qb = 1; }
          else if (v === 'down') { L.qa = 1; L.qb = 0; } else { L.qa = 0.5; L.qb = 1; }
        }, [['const', 'konstant'], ['up', 'Dreieck steigend'], ['down', 'Dreieck fallend'], ['trap', 'Trapez']]);
        if (shape === 'trap') {
          ui.num('q Anfang', () => L.qa, (v) => (L.qa = v), { step: 0.1 });
          ui.num('q Ende', () => L.qb, (v) => (L.qb = v), { step: 0.1 });
        }
        ui.num('Höhe [px]', () => L.h, (v) => (L.h = Math.max(6, v)), { step: 2 });
        ui.select('Seite', () => String(L.side ?? 1), (v) => (L.side = +v), [['1', 'oben / links'], ['-1', 'unten / rechts']]);
        ui.select('Wirkrichtung', () => L.dir || 'perp', (v) => (L.dir = v), [['perp', 'senkrecht zum Element'], ['vert', 'vertikal']]);
        ui.note('Teilbereiche: Element vorher teilen (z. B. Knoten per Drag & Drop einfügen).');
      }
      del();
    } else if (s.kind === 'dim') {
      const d = obj;
      if (d.type === 'angle') {
        title.textContent = 'Winkelmaß';
        const get = () => TM.angleGeom(doc, d);
        ui.text('Bezeichnung', () => d.label, (v) => (d.label = v), { ph: 'leer = Zahlenwert' });
        ui.num('Winkel [°]', () => get().val, (v) => setAngleDim(doc, d, v), { geom: true, step: 5 });
        followCheck(ui);
        ui.num('Radius [px]', () => d.r, (v) => (d.r = Math.max(8, v)), { step: 2 });
        ui.check('Gegenwinkel (außen)', () => d.flip, (v) => (d.flip = v));
        if (!d.a && !d.fa) ui.select('Bezugsachse', () => String(d.aRef || 0), (v) => (d.aRef = +v), [['0', 'horizontal →'], ['180', 'horizontal ←'], ['90', 'vertikal ↑'], ['270', 'vertikal ↓']]);
        ui.note(d.fb ? 'Eine Winkeländerung dreht die Kraft.' : 'Eine Winkeländerung dreht den zweiten Schenkel um den Scheitelpunkt.');
      } else {
        title.textContent = 'Längenmaß';
        const A = M.node(doc, d.a), B = M.node(doc, d.b);
        ui.text('Bezeichnung', () => d.label, (v) => (d.label = v), { ph: 'leer = Zahlenwert, z. B. a, 2a, l/2' });
        ui.num('Maß (Geometrie)', () => TM.dimGeom(d, A, B).val, (v) => {
          if (v <= 0 && d.type === 'a') return;
          let u;
          if (d.type === 'h') u = { x: Math.sign(B.x - A.x) || 1, y: 0 };
          else if (d.type === 'v') u = { x: 0, y: Math.sign(B.y - A.y) || 1 };
          else u = V.norm(V.sub(B, A));
          M.setDistance(doc, A.id, B.id, u, v, ed.follow);
        }, { geom: true, step: step() });
        followCheck(ui);
        ui.select('Art', () => d.type, (v) => (d.type = v), [['h', 'horizontal'], ['v', 'vertikal'], ['a', 'parallel']]);
        ui.num('Abstand', () => d.off, (v) => (d.off = v), { step: step() / 2 });
        ui.buttons([['Festen Punkt tauschen', () => mutate(() => M.swapDim(doc, d))]]);
        ui.note('Beim Ändern des Maßes bleibt der erste Punkt fest; der zweite (und mit „mitbewegen“ alles dahinter) verschiebt sich – Balken, Stäbe und Seile wachsen mit.');
      }
      del();
    } else if (s.kind === 'text') {
      const t = obj;
      title.textContent = 'Text';
      ui.text('Text', () => t.text, (v) => (t.text = v));
      ui.num('Größe [px]', () => t.size, (v) => (t.size = Math.max(6, v)), { step: 1 });
      ui.check('Buchstaben kursiv', () => t.italic !== false, (v) => (t.italic = v));
      del();
    }
    ui.note('Formatierung: <code>F_1</code>, <code>q_{0}</code>, <code>x^2</code>, <code>\\alpha</code> → α');
  }

  function addDimFor(e) {
    const doc = ed.doc, A = M.node(doc, e.n1), B = M.node(doc, e.n2);
    const horiz = Math.abs(A.y - B.y) < 1e-9, vert = Math.abs(A.x - B.x) < 1e-9;
    const type = horiz ? 'h' : vert ? 'v' : 'a';
    const d = { id: TM.uid('d'), type, a: A.id, b: B.id, label: '', off: 0 };
    d.off = type === 'h' ? -1 : type === 'v' ? 1 : 0.8;
    if (type === 'v' && B.y < A.y) d.off = -1;
    mutate(() => doc.dims.push(d));
    setSel({ kind: 'dim', id: d.id });
  }

  function docProps(ui) {
    const m = ed.doc.meta;
    ui.text('Titel', () => m.title, (v) => (m.title = v), { ph: 'z. B. Aufgabe 1' });
    ui.text('Aufgabentext', () => m.text, (v) => (m.text = v), { area: true, ph: 'Gegeben: …\nGesucht: …' });
    ui.section('Darstellung');
    ui.text('Längeneinheit', () => m.unit, (v) => (m.unit = v), { ph: 'm' });
    ui.text('Krafteinheit', () => m.funit, (v) => (m.funit = v), { ph: 'kN' });
    ui.check('Zahlenwerte statt Bezeichnungen', () => m.showValues, (v) => (m.showValues = v));
    ui.select('Balken', () => m.beamStyle, (v) => (m.beamStyle = v), [['outline', 'Kontur (Lehrbuch)'], ['solid', 'Linie, gefüllt']]);
    ui.num('Rasterweite', () => m.grid, (v) => { if (v > 0) m.grid = v; }, { step: 0.25 });
    ui.check('Raster anzeigen', () => m.showGrid !== false, (v) => (m.showGrid = v));
    ui.check('Fangen am Raster', () => m.snap !== false, (v) => (m.snap = v));
    ui.buttons([['Knoten automatisch benennen', autoLabel]]);
    ui.section('Bedienung');
    ui.html(`<div class="help"><ul>
      <li>Bauteile aus der Palette auf die Zeichenfläche <b>ziehen</b> – oder anklicken und dann auf der Fläche klicken.</li>
      <li><b>Balken/Stab/Seil zeichnen:</b> Palette anklicken, Start- und Endpunkt klicken (Kette), oder auf der Fläche ziehen. <kbd>Shift</kbd> = 15°-Schritte.</li>
      <li>Lager, Gelenke und Lasten rasten an Knoten ein; auf einem Element fügen sie dort einen Knoten ein.</li>
      <li><b>Knoten ziehen:</b> alle angeschlossenen Elemente wachsen mit. Auf einen anderen Knoten/ein Element fallen lassen = verbinden.</li>
      <li><b>Element ziehen</b> verschiebt es; mit <kbd>Shift</kbd> das ganze Tragwerk.</li>
      <li><b>Maße:</b> zwei Punkte klicken, dann die Lage der Maßlinie. Zahlenwert im Eigenschaftsfeld ändern → Geometrie passt sich an.</li>
      <li><b>Winkel:</b> zwei Elemente mit gemeinsamem Knoten anklicken – oder ein Element und dann eine freie Stelle (Bezug horizontal/vertikal).</li>
      <li>Hintergrund ziehen / Mitteltaste / <kbd>Leertaste</kbd> = verschieben, Mausrad = Zoom.</li>
      <li><kbd>Entf</kbd> löschen, <kbd>R</kbd> drehen, <kbd>H</kbd> Gelenk, <kbd>F</kbd> einpassen, <kbd>Esc</kbd> Werkzeug beenden, <kbd>Strg+Z</kbd>/<kbd>Strg+Y</kbd>.</li>
    </ul></div>`);
  }

  function autoLabel() {
    const doc = ed.doc;
    mutate(() => {
      const used = new Set(doc.nodes.map((n) => n.label).filter(Boolean));
      const interesting = doc.nodes.filter((n) => {
        if (n.label) return false;
        const els = M.elementsAt(doc, n.id);
        if (M.supportAt(doc, n.id) || n.hinge || els.length === 1 || els.length > 2) return true;
        if (doc.loads.some((l) => l.node === n.id)) return true;
        if (els.length === 2) {
          const a = M.node(doc, M.other(els[0], n.id)), b = M.node(doc, M.other(els[1], n.id));
          return Math.abs(V.cross(V.sub(a, n), V.sub(b, n))) > 1e-6;
        }
        return false;
      });
      interesting.sort((p, q) => p.x - q.x || q.y - p.y);
      let code = 65;
      for (const n of interesting) {
        while (used.has(String.fromCharCode(code))) code++;
        n.label = String.fromCharCode(code++);
        used.add(n.label);
        n.lx = -14; n.ly = M.supportAt(doc, n.id) ? -18 : -18;
      }
    });
  }

  // ================================================================ Statuszeile
  function updateHint() {
    const t = ed.tool;
    let h;
    if (t.name === 'draw') h = `${ITEMS[t.type].name} zeichnen: ${t.start ? 'Endpunkt klicken (Esc/Rechtsklick beendet)' : 'Startpunkt klicken oder ziehen'} · Shift = 15°`;
    else if (t.name === 'dim') h = `Bemaßung: ${!t.a ? '1. Punkt klicken' : !t.b ? '2. Punkt klicken' : 'Lage der Maßlinie klicken'} · Esc beendet`;
    else if (t.name === 'angle') h = t.first ? 'Winkel: 2. Element bzw. Kraft (gemeinsamer Punkt) oder freie Stelle (Bezugsachse) klicken' : 'Winkel: 1. Element oder Kraft anklicken';
    else if (t.name === 'place') h = `${ITEMS[t.item].name}: auf Knoten, Element oder Fläche klicken · Esc bricht ab`;
    else h = 'Auswahl: Objekte anklicken und ziehen · Bauteile aus der Palette auf die Fläche ziehen';
    $('#hint').textContent = h;
  }
  function showCoords(p) {
    $('#coords').textContent = `x = ${TM.fmtNum(p.x)}   y = ${TM.fmtNum(p.y)}   Zoom ${Math.round(ed.view.z * 100)} %`;
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ================================================================ Export / Datei
  function fileName(ext) {
    const base = (ed.doc.meta.title || 'aufgabe').trim().replace(/[^\wäöüÄÖÜß\- ]+/g, '').replace(/\s+/g, '_') || 'aufgabe';
    return `${base}.${ext}`;
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /** o.solution: Freikörperbild + Schnittgrößen (alle, untereinander). */
  function exportSVGString(doc = ed.doc, o = {}) {
    let content;
    if (o.solution) {
      const res = o.res || TM.solve(doc);
      const ok = res && res.members;
      content = TM.render(doc, { edit: false, hideSupports: ok, solved: ok ? new Map(res.unknownLoads.map((x) => [x.l.id, x.v])) : null }) +
        (ok ? TM.renderSolution(doc, res, { show: { N: true, Q: true, M: true }, layout: 'stack', scale: ed.sopt.scale, freebody: true }) : '');
    } else content = TM.render(doc, { edit: false });
    const tmp = document.createElementNS(NS, 'svg');
    tmp.setAttribute('style', 'position:absolute;left:-10000px;top:0;width:10px;height:10px');
    document.body.appendChild(tmp);
    tmp.innerHTML = `<g>${content}</g>`;
    let bb;
    try { bb = tmp.firstChild.getBBox(); } finally { tmp.remove(); }
    const m = 14;
    const x = Math.floor(bb.x - m), y = Math.floor(bb.y - m), w = Math.ceil(bb.width + 2 * m), h = Math.ceil(bb.height + 2 * m);
    return { w, h, svg: `<svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${content}</svg>` };
  }

  function exportSVG() {
    if (!ed.doc.nodes.length && !ed.doc.texts.length) return toast('Die Zeichnung ist leer.');
    download(new Blob([exportSVGString().svg], { type: 'image/svg+xml' }), fileName('svg'));
  }

  function exportPNG() {
    if (!ed.doc.nodes.length && !ed.doc.texts.length) return toast('Die Zeichnung ist leer.');
    const { svg: str, w, h } = exportSVGString();
    const img = new Image();
    const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
    img.onload = () => {
      const k = 3, cv = document.createElement('canvas');
      cv.width = w * k; cv.height = h * k;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => download(b, fileName('png')), 'image/png');
    };
    img.src = url;
  }


  const richHTML = (TM.richHTML = (s) =>
    TM.parseRich(s).map((g) => {
      const t = TM.esc(g.t);
      return g.m === 1 ? `<sub>${t}</sub>` : g.m === -1 ? `<sup>${t}</sup>` : t;
    }).join(''));

  function givenHTML(doc) {
    const list = TM.givenList(doc);
    if (!list.length) return '';
    return `<p class="given"><b>Zahlenwerte:</b> ${list.map((g) => `<i>${richHTML(g.sym)}</i> = ${TM.fmtNum(g.value)}${g.unit === '°' ? '°' : '&nbsp;' + TM.esc(g.unit)}`).join(', &nbsp;')}</p>`;
  }

  function taskHTML(doc, sub) {
    const m = doc.meta;
    const fig = doc.nodes.length || doc.texts.length ? exportSVGString(doc).svg : '';
    const text = (m.text || '').split('\n').map((l) => richHTML(l)).join('<br>');
    return `<section>${m.title || sub ? `<h1>${TM.esc(m.title || 'Aufgabe')}${sub ? ` <small>${TM.esc(sub)}</small>` : ''}</h1>` : ''}
      <div class="fig">${fig}</div><div>${text}</div>${givenHTML(doc)}</section>`;
  }

  function solutionPageHTML(doc, sub) {
    const res = TM.solve(doc);
    const fig = exportSVGString(doc, { solution: true, res }).svg;
    return `<section class="sol"><h1>Lösung${doc.meta.title ? ': ' + TM.esc(doc.meta.title) : ''}${sub ? ` <small>${TM.esc(sub)}</small>` : ''}</h1>
      ${givenHTML(doc)}${solutionHTML(doc, res, true)}<div class="fig">${fig}</div></section>`;
  }

  function openPrint(title, body) {
    const w = window.open('', '_blank');
    if (!w) return toast('Pop-up wurde blockiert.');
    w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${TM.esc(title)}</title>
      <style>body{font-family:"Times New Roman",serif;max-width:17cm;margin:1.5cm auto;color:#111;font-size:12pt;line-height:1.45}
      h1{font-size:15pt;margin:0 0 12px}h1 small{font-weight:normal;color:#555;font-size:11pt}
      .fig{text-align:center;margin:12px 0 18px}.fig svg{max-width:100%;height:auto}
      section+section{break-before:page;page-break-before:always;margin-top:2cm}
      table.res{border-collapse:collapse;margin:6px 0 10px;font-size:11pt}table.res td{padding:2px 10px 2px 0;border-bottom:1px solid #ddd}
      table.res td.v{text-align:right}td.h{color:#555;font-size:10pt}.badge{font-weight:bold;margin:6px 0}.warnl{color:#a50e0e}
      h4{margin:12px 0 4px;font-size:12pt}.given{margin-top:10px}
      @media print{body{margin:0 auto}section+section{margin-top:0}}</style></head>
      <body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  }

  function printSheet(withSolution) {
    let body = taskHTML(ed.doc);
    if (withSolution) body += solutionPageHTML(ed.doc);
    openPrint(ed.doc.meta.title || 'Aufgabe', body);
  }

  function printVariants() {
    const n = Math.max(1, Math.min(30, ed.sopt.variants | 0));
    const docs = [];
    for (let i = 0; i < n; i++) docs.push(TM.randomize(JSON.parse(snapshot()), { geometry: ed.sopt.geometry }));
    const body = docs.map((d, i) => taskHTML(d, `Variante ${i + 1}`)).join('') + docs.map((d, i) => solutionPageHTML(d, `Variante ${i + 1}`)).join('');
    openPrint((ed.doc.meta.title || 'Aufgabe') + ' – Varianten', body);
  }

  function saveJSON() {
    download(new Blob([JSON.stringify(ed.doc, null, 1)], { type: 'application/json' }), fileName('json'));
  }

  $('#fileIn').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.nodes)) throw new Error('format');
        const before = snapshot();
        loadDoc(d);
        commit(before);
      } catch (err) { toast('Datei konnte nicht gelesen werden.'); }
    };
    r.readAsText(f);
    e.target.value = '';
  });

  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.act) {
      case 'new':
        if (ed.doc.nodes.length && !confirm('Neue Aufgabe beginnen? Die aktuelle Zeichnung wird verworfen (Rückgängig ist möglich).')) return;
        { const before = snapshot(); loadDoc(TM.newDoc(), false); commit(before); ed.view = { tx: svg.clientWidth / 3, ty: svg.clientHeight / 2, z: 1.2 }; redraw(); }
        break;
      case 'open': $('#fileIn').click(); break;
      case 'save': saveJSON(); break;
      case 'svg': exportSVG(); break;
      case 'png': exportPNG(); break;
      case 'print': printSheet(ed.mode === 'solve'); break;
      case 'solve': setMode('solve'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'fit': fitView(); break;
    }
  }));

  $('#examples').addEventListener('change', (e) => {
    const k = e.target.value;
    e.target.value = '';
    if (k === '') return;
    const before = snapshot();
    loadDoc(TM.examples[+k]());
    commit(before);
  });

  // ================================================================ Lösung
  function setMode(mode) {
    ed.mode = mode;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === mode));
    $('#pane-edit').hidden = mode !== 'edit';
    $('#pane-solve').hidden = mode !== 'solve';
    if (mode === 'solve') buildSolvePanel();
    redraw();
    if (mode === 'solve') requestAnimationFrame(fitView);
  }
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.tab)));

  const fmtV = (v) => TM.fmtNum(v, 2);
  const rh = (s) => richHTML(s);

  /** HTML der Ergebnisse (Panel und Druck). */
  function solutionHTML(doc, res, print) {
    const u = TM.units(doc);
    if (!res || res.empty) return '<div class="badge warn">Noch kein Tragwerk vorhanden.</div>';
    const st = res.status, cnt = st.count;
    let h = '';
    if (st.determinate) h += '<div class="badge ok">✓ statisch bestimmt</div>';
    else if (st.solvable) h += `<div class="badge warn">⚠ kinematisch verschieblich (${st.mobility} Freiheitsgrad${st.mobility > 1 ? 'e' : ''}), für diese Belastung aber im Gleichgewicht</div>`;
    else {
      const parts = [];
      if (st.kinematic) parts.push(`kinematisch verschieblich (${st.mobility} Freiheitsgrad${st.mobility > 1 ? 'e' : ''})`);
      if (st.indeterminate) parts.push(`${st.degree}-fach statisch unbestimmt`);
      h += `<div class="badge bad">✗ ${parts.join(' und ')}</div>`;
    }
    h += `<div class="note">Abzählkriterium: <i>a</i> = ${cnt.a}, <i>z</i> = ${cnt.z}, <i>p</i> = ${cnt.p} ⇒ <i>n</i> = <i>a</i> + <i>z</i> − 3<i>p</i> = ${cnt.n}`;
    const fsys = st.f;
    if (cnt.n !== fsys) h += `<br>Gleichungssystem: ${st.u} Unbekannte, ${st.g} Gleichungen (enthält ${fsys - cnt.n > 0 ? 'innere Unbestimmtheit geschlossener Rahmen' : 'Sonderfälle'})`;
    if (cnt.u) h += `<br>davon ${cnt.u} gesuchte Last${cnt.u > 1 ? 'en' : ''} als Unbekannte`;
    if (!st.solvable && cnt.n === 0) h += '<br>Das Abzählkriterium ist erfüllt, aber die Anordnung ist <b>Ausnahmefall</b> (z. B. Lagerkräfte schneiden sich in einem Punkt oder sind parallel).';
    if (st.kinematic && !st.indeterminate && cnt.n > 0) h += '<br>Teilweise verschieblich trotz n > 0.';
    h += `<br>Rang ${st.rank} · ${st.u} Unbekannte · ${st.g} Gleichungen</div>`;
    for (const w of [...new Set(res.warnings)]) h += `<div class="warnl">⚠ ${TM.esc(w)}</div>`;
    if (!st.solvable) {
      if (st.kinematic && !st.indeterminate && !print) h += '<div class="note">Die Belastung ist mit der Lagerung nicht im Gleichgewicht. Tipp: eine Last als „gesucht“ markieren.</div>';
      if (!print) h += '<div class="note">Für Lagerreaktionen und Schnittgrößen muss das System statisch bestimmt sein.</div>';
      return h;
    }
    const row = (name, v, unit, hint = '') => `<tr><td>${rh(name)}</td><td class="v">${fmtV(v)} ${TM.esc(unit)}</td><td class="h">${hint}</td></tr>`;
    if (res.unknownLoads.length) {
      h += '<h4>Gesuchte Lasten</h4><table class="res">';
      for (const { l, v } of res.unknownLoads) h += row(l.label || '?', v, TM.loadUnit(doc, l), v < -1e-9 ? 'entgegen der gezeichneten Richtung' : '');
      h += '</table>';
    }
    h += '<h4>Lagerreaktionen</h4><table class="res">';
    for (const r of res.reactions) for (const cp of r.comps) {
      const name = TM.reactionName(doc, r.s, cp);
      if (cp.m) h += row(name, cp.v, u.M, '↺ positiv');
      else if (cp.c === 'x') h += row(name, cp.v, u.F, '→ positiv');
      else if (cp.c === 'y') h += row(name, cp.v, u.F, '↑ positiv');
      else {
        const arrow = { '0': '→', '90': '↑', '180': '←', '-180': '←', '-90': '↓' }[String(Math.round(V.ang(cp.f)))];
        h += row(name, cp.v, u.F, arrow ? `${arrow} positiv` : `positiv in ${TM.fmtNum(V.ang(cp.f), 0)}°`);
      }
    }
    h += '</table>';
    const twoForce = res.members.filter((m) => m.e.type !== 'beam');
    if (twoForce.length) {
      h += '<h4>Stab- und Seilkräfte</h4><table class="res">';
      for (const m of twoForce) h += row(m.e.label ? `S_{${m.e.label}}` : `S (${TM.memberName(doc, m.e)})`, m.N[0], u.F, m.N[0] > 1e-9 ? 'Zug' : m.N[0] < -1e-9 ? 'Druck' : 'Nullstab');
      h += '</table>';
    }
    if (res.pulleys.length) {
      h += '<h4>Rollen und Trommeln</h4><table class="res">';
      res.pulleys.forEach((pq, i) => {
        const name = pq.node.label || `Rolle ${i + 1}`;
        h += `<tr><td>${rh(name)}</td><td class="v">α = ${TM.fmtNum(pq.alpha, 1)}°</td><td class="h">${pq.K !== 1 ? `e<sup>μα</sup> = ${TM.fmtNum(pq.K, 3)}` : 'reibungsfrei'}</td></tr>`;
        h += pq.K !== 1 ? row('S_{groß}', pq.Shi, u.F) + row('S_{klein}', pq.Slo, u.F) : row('S_{1}', pq.Shi, u.F) + row('S_{2}', pq.Slo, u.F);
      });
      h += '</table>';
    }
    const hinges = doc.nodes.filter((n) => n.hinge && M.elementsAt(doc, n.id).filter((e) => e.type === 'beam').length >= 2);
    if (hinges.length) {
      h += '<h4>Gelenkkräfte</h4><table class="res">';
      for (const n of hinges) {
        const els = M.elementsAt(doc, n.id).filter((e) => e.type === 'beam');
        const mid = (e) => (M.node(doc, e.n1).x + M.node(doc, e.n2).x) / 2;
        const e = els.sort((a, b) => mid(a) - mid(b))[0];
        const mm = res.members.find((m) => m.e === e);
        const f = e.n1 === n.id ? mm.f1 : mm.f2;
        const name = n.label || 'G';
        h += row(`${name}_{H}`, f.x, u.F, '→ auf linken Teil') + row(`${name}_{V}`, f.y, u.F, '↑ auf linken Teil');
      }
      h += '</table>';
    }
    const beams = res.members.filter((m) => m.e.type === 'beam');
    if (beams.length) {
      h += '<h4>Extremwerte</h4><table class="res">';
      for (const t of ['N', 'Q', 'M']) {
        let best = null;
        for (const m of beams) m[t].forEach((v, i) => { if (!best || Math.abs(v) > Math.abs(best.v) + 1e-9) best = { v, m, x: m.xs[i] }; });
        if (!best) continue;
        h += row(`${t === 'M' ? 'M' : t}_{max}`, best.v, t === 'M' ? u.M : u.F, `${TM.esc(TM.memberName(doc, best.m.e))}, x = ${TM.fmtNum(best.x)} ${TM.esc(u.L)}`);
      }
      h += '</table>';
      h += '<div class="note">Vorzeichen: N &gt; 0 Zug; Q, M bezogen auf die gestrichelte Faser (rechts der Elementrichtung Knoten 1 → 2). M wird auf der Zugseite aufgetragen.</div>';
    }
    return h;
  }

  function updateSolveResults() {
    const box = $('#solres');
    if (box) box.innerHTML = solutionHTML(ed.doc, ed.res);
    for (const f of ed.syncers) f();
  }

  function buildSolvePanel() {
    const pane = $('#pane-solve');
    pane.innerHTML = '';
    ed.syncers = [];
    ed.solveKey = TM.quantities(ed.doc).map((q) => q.kind + q.obj.id).join();
    const ui = propsUI(pane);
    const o = ed.sopt;
    const doc = ed.doc;
    const res = document.createElement('div');
    res.id = 'solres';
    pane.appendChild(res);

    ui.section('Darstellung');
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const t of ['N', 'Q', 'M']) {
      const l = document.createElement('label');
      l.style.color = TM.DIAG_COLORS[t];
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.checked = o.show[t];
      i.addEventListener('change', () => { o.show[t] = i.checked; redraw(); });
      l.append(i, document.createTextNode(t));
      chips.appendChild(l);
    }
    pane.appendChild(chips);
    const lay = document.createElement('select');
    lay.innerHTML = '<option value="stack">untereinander</option><option value="overlay">am Tragwerk</option>';
    lay.value = o.layout;
    lay.addEventListener('change', () => { o.layout = lay.value; redraw(); fitView(); });
    const lr = document.createElement('label');
    lr.className = 'row';
    lr.innerHTML = '<span>Anordnung</span>';
    lr.appendChild(lay);
    pane.appendChild(lr);
    const rng = document.createElement('input');
    rng.type = 'range'; rng.min = '0.3'; rng.max = '3'; rng.step = '0.1'; rng.value = o.scale;
    rng.addEventListener('input', () => { o.scale = +rng.value; redraw(); });
    const r = document.createElement('label');
    r.className = 'row';
    r.innerHTML = '<span>Skalierung</span>';
    r.appendChild(rng);
    pane.appendChild(r);
    ui.check('Freikörperbild (Lagerreaktionen)', () => o.freebody, (v) => (o.freebody = v), { noUndo: true });

    ui.section('Werte verändern');
    ui.note('Änderungen wirken sofort auf die Lösung. Kräfte lassen sich auf der Zeichenfläche entlang des Balkens ziehen, Knoten verschieben.');
    ui.check('Gleiche Grundgröße koppeln (F, 2F …)', () => o.couple, (v) => (o.couple = v), { noUndo: true });
    for (const q of TM.quantities(doc)) paramRow(pane, q);
    followCheck(ui);

    ui.section('Varianten');
    ui.check('Auch Längen und Winkel variieren', () => o.geometry, (v) => (o.geometry = v), { noUndo: true });
    ui.buttons([['🎲 Neue Zufallswerte', () => { mutate(() => TM.randomize(ed.doc, { geometry: o.geometry }), { props: false }); buildSolvePanel(); redraw(); }]]);
    ui.num('Anzahl Varianten', () => o.variants, (v) => (o.variants = v), { step: 1 });
    ui.section('Drucken / PDF');
    ui.buttons([
      ['Aufgabe', () => printSheet(false)],
      ['Aufgabe + Lösung', () => printSheet(true)],
      ['Variantenserie', () => printVariants()],
    ]);
    ui.note('Die Variantenserie enthält je Variante ein Aufgabenblatt und im Anhang die Lösungen.');
    updateSolveResults();
  }

  function paramRow(pane, q) {
    const doc = ed.doc;
    const r = document.createElement('label');
    r.className = 'row param';
    const sp = document.createElement('span');
    sp.innerHTML = q.label ? rh(q.label) : { load: 'Last', dim: 'Maß', angle: 'Winkel', fangle: 'Winkel' }[q.kind];
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;align-items:center';
    const i = document.createElement('input');
    i.type = 'number';
    i.step = q.kind === 'load' ? '1' : q.kind === 'dim' ? String(step()) : '5';
    const un = document.createElement('span');
    un.textContent = q.unit;
    un.style.cssText = 'color:var(--muted);font-size:12px;min-width:34px';
    wrap.append(i, un);
    r.append(sp, wrap);
    pane.appendChild(r);
    const cur = () => {
      const all = TM.quantities(ed.doc);
      const m = all.find((x) => x.obj.id === q.obj.id && x.kind === q.kind);
      return m ? m.value : NaN;
    };
    const show = () => { if (document.activeElement !== i) i.value = Math.round(cur() * 1000) / 1000; };
    show();
    ed.syncers.push(show);
    const parse = () => parseFloat(String(i.value).replace(',', '.'));
    if (q.kind === 'load') {
      let before = null;
      i.addEventListener('focus', () => { before = snapshot(); });
      i.addEventListener('input', () => {
        const v = parse();
        if (!isFinite(v)) return;
        if (before === null) before = snapshot();
        setLoadValue(q.obj.id, v);
        redraw();
      });
      i.addEventListener('change', () => { if (before !== null) commit(before); before = snapshot(); });
    } else {
      i.addEventListener('change', () => {
        const v = parse();
        if (!isFinite(v) || v <= 0) return;
        mutate(() => applyGeomValue(q, v), { props: false });
      });
    }
  }

  function setLoadValue(id, v) {
    const doc = ed.doc, L = M.get(doc, 'load', id);
    if (!L) return;
    L.value = v;
    const p = TM.parseSym(L.label);
    if (!ed.sopt.couple || !p) return;
    const base = v / p.coef;
    for (const o of doc.loads) {
      if (o === L) continue;
      const q = TM.parseSym(o.label);
      if (q && q.sym === p.sym && o.type === L.type) o.value = TM.clean(base * q.coef);
    }
  }

  function applyGeomValue(q, v) {
    const doc = ed.doc, d = M.get(doc, q.kind === 'fangle' ? 'load' : 'dim', q.obj.id);
    if (!d) return;
    if (q.kind === 'dim') {
      const A = M.node(doc, d.a), B = M.node(doc, d.b);
      let u;
      if (d.type === 'h') u = { x: Math.sign(B.x - A.x) || 1, y: 0 };
      else if (d.type === 'v') u = { x: 0, y: Math.sign(B.y - A.y) || 1 };
      else u = V.norm(V.sub(B, A));
      M.setDistance(doc, A.id, B.id, u, v, ed.follow);
    } else if (q.kind === 'angle') {
      setAngleDim(doc, d, v);
    } else if (q.kind === 'fangle') {
      const dd = V.dir(d.angle);
      const sx = Math.sign(dd.x) || 1, sy = Math.sign(dd.y) || -1;
      const h = d.angRef === 'v' ? 90 - v : v;
      d.angle = (Math.atan2(sy * Math.sin((h * Math.PI) / 180), sx * Math.cos((h * Math.PI) / 180)) * 180) / Math.PI;
    }
  }

  // ================================================================ Start
  buildPalette();
  let start = null;
  try { const s = localStorage.getItem(STORE); if (s) start = JSON.parse(s); } catch (e) { start = null; }
  ed.doc = M.normalize(start && Array.isArray(start.nodes) ? start : TM.examples[0]());
  setTool('select');
  redraw();
  buildProps();
  requestAnimationFrame(fitView);

  // für Tests/Debugging
  window.TMEditor = { ed, place, mutate, setSel, fitView, exportSVGString, setTool };
})();
