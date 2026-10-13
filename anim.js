// anim.js — Mi Gym v2 · animaciones de técnica en SVG (lee ANIMS de data.js)
// Uso: const c = Anim.montar(elemento, 'sentadilla');  …  c.parar();
const Anim = (() => {
  const L = { sh: 34, th: 36, tr: 44, ua: 26, fa: 23, ma: 8, cab: 9 }, PISO = 186;
  const ANG = ['t', 'th', 'sh', 'th2', 'sh2', 'ua', 'fa', 'ua2', 'fa2', 'ma'];
  const DEF = { t: 0, th: 180, sh: 180, ua: 180, fa: 180, dy: 0 };
  const activos = new Set();
  const R = Math.PI / 180;
  const dir = (a, l) => [Math.sin(a * R) * l, -Math.cos(a * R) * l];
  const mas = (p, v) => [p[0] + v[0], p[1] + v[1]];
  const menos = (p, v) => [p[0] - v[0], p[1] - v[1]];
  const r1 = n => Math.round(n * 10) / 10;

  function completa(p) {
    const q = { ...DEF, ...p };
    for (const k of ['th', 'sh', 'ua', 'fa']) if (q[k + '2'] == null) q[k + '2'] = q[k];
    return q;
  }
  // Mezcla dos poses. Los ángulos toman el camino más corto (350° → 20° pasa por 0°).
  function mezcla(A, B, k) {
    const a = completa(A), b = completa(B), o = { ...a };
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key], y = b[key];
      if (typeof x === 'number' && typeof y === 'number') {
        if (ANG.includes(key)) { const d = ((y - x) % 360 + 540) % 360 - 180; o[key] = x + d * k; }
        else o[key] = x + (y - x) * k;
      } else if (Array.isArray(x) && Array.isArray(y)) {
        o[key] = [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k];
      }
    }
    return o;
  }
  // Brazo de dos tramos que llega a un punto (para barras que viajan en línea recta).
  function ik(S, T, codo) {
    const a = L.ua, b = L.fa, dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 0.01;
    const dc = Math.min(a + b - 0.5, Math.max(Math.abs(a - b) + 0.5, d));
    const phi = Math.atan2(dy, dx);
    const al = Math.acos(Math.max(-1, Math.min(1, (a * a + dc * dc - b * b) / (2 * a * dc))));
    const ang = phi + (codo < 0 ? -al : al);
    return [[S[0] + a * Math.cos(ang), S[1] + a * Math.sin(ang)], [S[0] + dx / d * dc, S[1] + dy / d * dc]];
  }
  function brazo(S, p, lejos) {
    if (p.mano) {
      const T = lejos ? [p.mano[0] - 3, p.mano[1]] : p.mano;
      const [E, W] = ik(S, T, p.codo || 1);
      const v = [W[0] - E[0], W[1] - E[1]], n = Math.hypot(v[0], v[1]) || 1;
      return { E, W, H: [W[0] + v[0] / n * L.ma, W[1] + v[1] / n * L.ma] };
    }
    const ua = lejos ? p.ua2 : p.ua, fa = lejos ? p.fa2 : p.fa;
    const E = mas(S, dir(ua, L.ua)), W = mas(E, dir(fa, L.fa));
    return { E, W, H: mas(W, dir(p.ma != null && !lejos ? p.ma : fa, L.ma)) };
  }
  function esqLado(p) {
    let hip, knee, ank;
    if (p.raiz === 'cad') { hip = [p.hx, p.hy]; knee = mas(hip, dir(p.th, L.th)); ank = mas(knee, dir(p.sh, L.sh)); }
    else { ank = [p.x, PISO + (p.dy || 0)]; knee = menos(ank, dir(p.sh, L.sh)); hip = menos(knee, dir(p.th, L.th)); }
    const knee2 = mas(hip, dir(p.th2, L.th)), ank2 = mas(knee2, dir(p.sh2, L.sh));
    const sho = mas(hip, dir(p.t, L.tr)), cab = mas(sho, dir(p.t, L.cab + 5));
    const pie = p.raiz === 'pie' ? [p.x + 12, PISO] : mas(ank, dir(p.sh - 90, 10));
    const pie2 = mas(ank2, dir(p.sh2 - 90, 10));
    return { hip, knee, ank, knee2, ank2, sho, cab, pie, pie2, b1: brazo(sho, p, false), b2: brazo(sho, p, true) };
  }
  function esqFrente(p) {
    const yA = PISO + (p.dy || 0), cx = p.x;
    const hipC = [cx, yA - L.sh - L.th], shoC = mas(hipC, dir(p.t, L.tr)), perp = dir(p.t + 90, 13);
    const shR = mas(shoC, perp), shL = menos(shoC, perp);
    const arm = (S, s) => { const E = mas(S, dir(s * p.ua, L.ua)), W = mas(E, dir(s * p.fa, L.fa)); return { E, W, H: mas(W, dir(s * p.fa, L.ma)) }; };
    return {
      t: p.t, hipC, shoC, shR, shL, cab: mas(shoC, dir(p.t, L.cab + 6)), aR: arm(shR, 1), aL: arm(shL, -1),
      legs: [[[cx + 8, hipC[1]], [cx + 9, hipC[1] + L.th], [cx + 10, yA], 1], [[cx - 8, hipC[1]], [cx - 9, hipC[1] + L.th], [cx - 10, yA], -1]]
    };
  }
  // ── dibujo ──
  const linea = (a, b, w, col, op) =>
    `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" style="stroke:${col};stroke-width:${w};stroke-linecap:round${op != null ? ';opacity:' + op : ''}"/>`;
  function parte(a, b, w, nombre, act, lejos) {
    const on = act.includes(nombre);
    const col = on ? 'var(--musc)' : lejos ? 'var(--fig2)' : 'var(--fig)';
    return linea(a, b, w + 3, 'var(--cd)') + linea(a, b, w, col, on && lejos ? 0.6 : null);
  }
  const circulo = (c, r, estilo) => `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r}" style="${estilo}"/>`;
  const placa = (c, r) => circulo(c, r, 'fill:var(--cd2);stroke:var(--tx);stroke-width:2;opacity:.95') + circulo(c, 2, 'fill:var(--tx)');
  const cabeza = c => circulo(c, L.cab, 'fill:var(--fig);stroke:var(--cd);stroke-width:2.5');

  function puntoCarga(j, def) {
    switch (def.carga) {
      case 'hombro': return mas(j.sho, [-3, -3]);
      case 'muneca': return j.b1.W;
      case 'mano': return j.b1.H;
      case 'cadera': return mas(j.hip, [0, -6]);
      case 'tobillo': return j.ank;
      default: return null;
    }
  }
  function dibLado(j, def) {
    const a = def.act || [];
    let s = parte(j.sho, j.b2.E, 8, 'brazo', a, 1) + parte(j.b2.E, j.b2.W, 6.5, 'antebrazo', a, 1) + parte(j.b2.W, j.b2.H, 5, 'x', a, 1);
    s += parte(j.hip, j.knee2, 12, 'muslo', a, 1) + parte(j.knee2, j.ank2, 9, 'pierna', a, 1) + parte(j.ank2, j.pie2, 5, 'x', a, 1);
    s += parte(j.hip, j.sho, 16, 'tronco', a, 0);
    s += parte(j.hip, j.knee, 12, 'muslo', a, 0) + parte(j.knee, j.ank, 9, 'pierna', a, 0) + parte(j.ank, j.pie, 5, 'x', a, 0);
    s += cabeza(j.cab);
    if (def.cable) s += linea(def.cable, j.b1.H, 1.5, 'var(--mu)');
    s += parte(j.sho, j.b1.E, 8, 'brazo', a, 0) + parte(j.b1.E, j.b1.W, 6.5, 'antebrazo', a, 0) + parte(j.b1.W, j.b1.H, 5, 'x', a, 0);
    const c = puntoCarga(j, def);
    if (c) s += placa(c, def.tipo === 'mancuerna' ? 7 : def.carga === 'tobillo' ? 13 : 16);
    return s;
  }
  function dibFrente(j, def) {
    const a = def.act || [];
    const pp = dir(j.t + 90, 15), hR = [j.hipC[0] + 10, j.hipC[1]], hL = [j.hipC[0] - 10, j.hipC[1]];
    const sR = mas(j.shoC, pp), sL = menos(j.shoC, pp);
    const col = a.includes('tronco') ? 'var(--musc)' : 'var(--fig)';
    let s = `<polygon points="${[hL, hR, sR, sL].map(p => r1(p[0]) + ',' + r1(p[1])).join(' ')}" style="fill:${col};stroke:var(--cd);stroke-width:2.5;stroke-linejoin:round"/>`;
    for (const g of j.legs) s += parte(g[0], g[1], 12, 'muslo', a, 0) + parte(g[1], g[2], 9, 'pierna', a, 0) + parte(g[2], [g[2][0] + g[3] * 7, g[2][1]], 5, 'x', a, 0);
    s += cabeza(j.cab);
    for (const [S, b] of [[j.shR, j.aR], [j.shL, j.aL]]) s += parte(S, b.E, 8, 'brazo', a, 0) + parte(b.E, b.W, 6.5, 'antebrazo', a, 0) + parte(b.W, b.H, 5, 'x', a, 0);
    if (def.carga === 'muneca') for (const w of [j.aR.W, j.aL.W]) s += placa(w, def.tipo === 'mancuerna' ? 6 : 14);
    return s;
  }

  function montar(cont, clave) {
    const def = (typeof ANIMS !== 'undefined') && ANIMS[clave];
    if (!def) { cont.innerHTML = '<div class="empty">Sin animación para este ejercicio</div>'; return { parar() {} }; }
    cont.innerHTML = `<div class="anim-box"><svg viewBox="0 0 200 200" role="img" aria-label="Animación de la técnica"><g class="fijo"></g><g class="fig"></g></svg>
      <div class="anim-fase"></div>
      <div class="anim-ctrl"><button type="button" class="btn chico" data-a="pausa">⏸ Pausa</button><button type="button" class="btn chico" data-a="lento">🐢 Lento</button></div></div>`;
    const svg = cont.querySelector('svg'), gF = svg.querySelector('.fijo'), gB = svg.querySelector('.fig');
    const fase = cont.querySelector('.anim-fase'), bP = cont.querySelector('[data-a=pausa]'), bL = cont.querySelector('[data-a=lento]');
    const frente = def.modo === 'frente';
    const calc = k => { const p = mezcla(def.A, def.B, k); return frente ? esqFrente(p) : esqLado(p); };

    // Capa fija: piso, bancos, barra fija, polea y recorrido de la carga (línea punteada)
    let fijo = '';
    if (def.piso !== false) fijo += linea([8, PISO + 4], [192, PISO + 4], 2, 'var(--bd)');
    for (const b of def.banco || []) fijo += linea([b[0], b[1]], [b[2], b[3]], 6, 'var(--mu)', 0.55);
    if (def.barraFija) { const f = def.barraFija; fijo += linea([f.x1, f.y], [f.x2, f.y], 4, 'var(--tx)', 0.8); }
    if (def.cable) fijo += circulo(def.cable, 4, 'fill:var(--mu)');
    if (def.carga && !frente) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const c = puntoCarga(calc(i / 40), def); if (c) pts.push(r1(c[0]) + ',' + r1(c[1])); }
      fijo += `<polyline points="${pts.join(' ')}" style="fill:none;stroke:var(--ac);stroke-width:1.6;stroke-dasharray:3 4;opacity:.75"/>`;
    }
    gF.innerHTML = fijo;

    const pausa = def.pausa ?? 0.12, dur = (def.ritmo || 3.2) * 1000, m = (1 - 2 * pausa) / 2;
    const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
    const estado = u => u < m ? [ease(u / m), def.f1] : u < m + pausa ? [1, def.f1]
      : u < 2 * m + pausa ? [1 - ease((u - m - pausa) / m), def.f2] : [0, def.f2];
    let reducido = false;
    try { reducido = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    let pausado = reducido, vel = 1, tiempo = 0, ult = null, raf = null, vivo = true, txt = null, sucio = true;

    function pintar() {
      const [k, t] = estado((tiempo % dur) / dur);
      gB.innerHTML = frente ? dibFrente(calc(k), def) : dibLado(calc(k), def);
      if (t !== txt) { txt = t; fase.textContent = t || ''; }
    }
    function paso(ts) {
      if (!vivo) return;
      if (!svg.isConnected) { parar(); return; }
      if (ult != null && !pausado) { tiempo += (ts - ult) * vel; sucio = true; }
      ult = ts;
      if (sucio) { pintar(); sucio = false; }
      raf = requestAnimationFrame(paso);
    }
    function parar() { vivo = false; if (raf) cancelAnimationFrame(raf); activos.delete(ctrl); }
    bP.onclick = () => { pausado = !pausado; bP.textContent = pausado ? '▶ Seguir' : '⏸ Pausa'; };
    bL.onclick = () => { vel = vel === 1 ? 0.4 : 1; bL.textContent = vel === 1 ? '🐢 Lento' : '🐇 Normal'; };
    if (pausado) bP.textContent = '▶ Seguir';
    const ctrl = { parar };
    activos.add(ctrl);
    raf = requestAnimationFrame(paso);
    return ctrl;
  }
  function detenerTodo() { for (const c of [...activos]) c.parar(); }
  return { montar, detenerTodo };
})();
