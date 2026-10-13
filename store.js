// store.js — Mi Gym v2 · datos (localStorage), progresión y documentos (IndexedDB)
// Forma de los datos:
//  sesiones: [{id, fecha, rutinaId, rutinaNombre, dur, notas,
//              ej:[{id, nom?, sets:[{kg, reps, ok}], molestia:'no'|'leve'|'moderada', nota}]}]
//    (nom sólo existe en ejercicios importados de la V1 que no están en la biblioteca)
//  activa: entrenamiento en curso {id, rutinaId, rutinaNombre, inicio, idx, notas,
//          ej:[{id, s, r, d, n, sets:[{kg, reps, ok, ts}], molestia, nota}]}
const Store = (() => {
  const KEY = 'migym-v2';
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoy = () => ymd(new Date());
  const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clon = o => JSON.parse(JSON.stringify(o));
  const nuevo = () => ({ v: 2, rutinas: clon(RUTINAS_BASE), sesiones: [], activa: null, momentos: [],
    prefs: { barra: 20, sonido: true, vibrar: true, pantalla: true }, ultimoBackup: null, sesionesAlBackup: 0, migradoV1: false });
  let estado = nuevo(), problema = null;

  // ── Validación: sólo entra a la app lo que tiene la forma correcta ──
  const num = v => { if (v === '' || v == null || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
  const fechaOk = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T12:00:00'));
  const idOk = v => typeof v === 'string' && /^[\w.-]{1,80}$/.test(v);
  const txt = (v, n = 500) => typeof v === 'string' ? v.slice(0, n) : '';
  const MOL = m => ['leve', 'moderada'].includes(m) ? m : 'no';

  function vSesion(s) {
    if (!s || typeof s !== 'object' || !idOk(s.id) || !fechaOk(s.fecha) || !Array.isArray(s.ej)) return null;
    const ej = [];
    for (const e of s.ej) {
      if (!e || !idOk(e.id) || !Array.isArray(e.sets)) continue;
      const o = { id: e.id, sets: e.sets.map(x => ({ kg: num(x && x.kg), reps: num(x && x.reps), ok: !!(x && x.ok) })), molestia: MOL(e.molestia), nota: txt(e.nota, 300) };
      if (e.nom) o.nom = txt(e.nom, 60);
      ej.push(o);
    }
    if (!ej.length) return null;
    return { id: s.id, fecha: s.fecha, rutinaId: idOk(s.rutinaId) ? s.rutinaId : null, rutinaNombre: txt(s.rutinaNombre, 40), ej, dur: num(s.dur), notas: txt(s.notas, 1000) };
  }
  function vRutina(r) {
    if (!r || typeof r !== 'object' || !idOk(r.id) || !Array.isArray(r.items)) return null;
    const items = r.items.filter(i => i && EJ[i.ej]).map(i => ({
      ej: i.ej, s: Math.min(10, Math.max(1, Math.round(num(i.s) || 3))),
      r: txt(String(i.r ?? '5'), 12) || '5', d: Math.min(600, Math.round(num(i.d) ?? 90)), n: txt(i.n, 200) }));
    return { id: r.id, nombre: txt(r.nombre, 30) || 'Rutina', sub: txt(r.sub, 60), n: txt(r.n, 300), cardio: !!r.cardio, items };
  }
  function vMomento(m) {
    if (!m || typeof m !== 'object' || !idOk(m.id) || !fechaOk(m.fecha)) return null;
    return { id: m.id, fecha: m.fecha, hora: txt(m.hora, 5), situacion: txt(m.situacion), emocion: txt(m.emocion, 60),
      intensidad: Math.min(10, Math.max(0, Math.round(num(m.intensidad) || 0))), accion: txt(m.accion) };
  }
  function vActiva(a) {
    if (!a || typeof a !== 'object' || !idOk(a.id) || !(num(a.inicio) > 0) || !Array.isArray(a.ej)) return null;
    const ej = a.ej.filter(e => e && idOk(e.id) && Array.isArray(e.sets)).map(e => ({
      id: e.id, s: num(e.s) || e.sets.length, r: txt(String(e.r ?? ''), 12), d: num(e.d) ?? 90, n: txt(e.n, 200),
      sets: e.sets.map(x => ({ kg: num(x && x.kg), reps: num(x && x.reps), ok: !!(x && x.ok), ts: num(x && x.ts) || 0 })),
      molestia: MOL(e.molestia), nota: txt(e.nota, 300) }));
    return ej.length ? { id: a.id, rutinaId: idOk(a.rutinaId) ? a.rutinaId : null, rutinaNombre: txt(a.rutinaNombre, 40),
      inicio: num(a.inicio), idx: Math.max(0, Math.round(num(a.idx) || 0)), notas: txt(a.notas, 1000), ej } : null;
  }
  function normalizar(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('formato');
    const E = nuevo(); let desc = 0;
    const lista = (arr, fn) => {
      if (arr == null) return [];
      if (!Array.isArray(arr)) { desc++; return []; }
      const m = new Map();
      for (const x of arr) { const v = fn(x); if (v) m.set(v.id, v); else desc++; }
      return [...m.values()];
    };
    E.sesiones = lista(d.sesiones, vSesion).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (Array.isArray(d.rutinas)) { const r = lista(d.rutinas, vRutina); if (r.length) E.rutinas = r; }
    E.momentos = lista(d.momentos, vMomento).sort((a, b) => a.fecha.localeCompare(b.fecha));
    E.activa = d.activa ? vActiva(d.activa) : null;
    if (d.prefs && typeof d.prefs === 'object') {
      const p = d.prefs;
      E.prefs = { barra: num(p.barra) || 20, sonido: p.sonido !== false, vibrar: p.vibrar !== false, pantalla: p.pantalla !== false };
    }
    if (fechaOk(d.ultimoBackup)) E.ultimoBackup = d.ultimoBackup;
    E.sesionesAlBackup = num(d.sesionesAlBackup) || 0;
    E.migradoV1 = !!d.migradoV1;
    return { E, desc };
  }

  // ── Cargar / guardar ──
  function rescatar(raw) { try { localStorage.setItem(KEY + '-rescate', raw); } catch (e) {} }
  function cargar() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) { estado = nuevo(); return; }
    try {
      const { E, desc } = normalizar(JSON.parse(raw));
      estado = E;
      if (desc) { rescatar(raw); problema = `Se omitieron ${desc} registros dañados. La copia original está en Ajustes → Copia de rescate.`; }
    } catch (e) {
      rescatar(raw); estado = nuevo();
      problema = 'Los datos guardados no se pudieron leer. Guardé una copia de rescate (Ajustes) y la app arrancó vacía. Podés importar tu última copia.';
    }
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(estado)); return true; } catch (e) { return false; } }
  function reiniciar() { estado = nuevo(); return guardar(); }
  function persistir() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} }
  function hayRescate() { try { return !!localStorage.getItem(KEY + '-rescate'); } catch (e) { return false; } }

  // ── Exportar / importar ──
  function descargar(texto, nombre) {
    const b = new Blob([texto], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 15000);
  }
  function exportar() {
    estado.ultimoBackup = hoy(); estado.sesionesAlBackup = estado.sesiones.length; guardar();
    descargar(JSON.stringify(estado, null, 1), `mi-gym-copia-${hoy()}.json`);
  }
  function descargarRescate() { try { const r = localStorage.getItem(KEY + '-rescate'); if (r) descargar(r, `mi-gym-rescate-${hoy()}.json`); } catch (e) {} }

  // Fusiona sobre una copia y sólo la adopta si se pudo guardar (nunca queda a medias).
  function fusionar(partes, conRutinas) {
    const prev = estado, W = clon(estado);
    const unir = (lista, nuevos) => { const m = new Map(lista.map(x => [x.id, x])); let n = 0; for (const x of nuevos) { if (!m.has(x.id)) n++; m.set(x.id, x); } return [[...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), n]; };
    const [ses, n] = unir(W.sesiones, partes.sesiones || []);
    const [mom, nm] = unir(W.momentos, partes.momentos || []);
    W.sesiones = ses; W.momentos = mom;
    if (conRutinas && partes.rutinas && partes.rutinas.length) {
      const m = new Map(W.rutinas.map(r => [r.id, r])); for (const r of partes.rutinas) m.set(r.id, r); W.rutinas = [...m.values()];
    }
    estado = W;
    if (!guardar()) { estado = prev; return null; }
    return { n, nm };
  }
  async function importar(file) {
    let d;
    try { d = JSON.parse(await file.text()); } catch (e) { return { ok: false, msg: 'El archivo no es una copia válida. No se cambió nada.' }; }
    if (d && d.v === 2) {
      let r; try { r = normalizar(d); } catch (e) { return { ok: false, msg: 'El archivo está dañado. No se cambió nada.' }; }
      const res = fusionar(r.E, true);
      if (!res) return { ok: false, msg: 'No se pudo guardar: el almacenamiento está lleno.' };
      return { ok: true, msg: `Importado: ${res.n} entrenamientos nuevos${r.desc ? ` · ${r.desc} registros dañados omitidos` : ''}.` };
    }
    const v1 = leerV1(d);
    if (!v1.sesiones.length && !v1.momentos.length) return { ok: false, msg: 'No reconocí el formato de este archivo. No se cambió nada.' };
    const res = aplicarV1(v1);
    return res ? { ok: true, msg: `Importado de la versión anterior: ${res.n} entrenamientos y ${res.nm} registros.` }
      : { ok: false, msg: 'No se pudo guardar: el almacenamiento está lleno.' };
  }

  // ── Lector de la V1: busca entrenamientos y registros con nombres de campo comunes ──
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const numL = v => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const IDX = (() => { const m = {}; for (const [id, e] of Object.entries(EJ)) { m[norm(e.n)] = id; m[norm(id)] = id; } return m; })();
  const idEj = x => typeof x === 'string' ? (EJ[x] ? x : IDX[norm(x)] || null) : null;
  function fechaDe(o) {
    for (const k of ['fecha', 'date', 'dia', 'day', 'inicio', 'start', 'ts', 'timestamp', 'creado']) {
      const v = o[k];
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      if (typeof v === 'number' && v > 1e12) return ymd(new Date(v));
    }
    return null;
  }
  function listaEj(o) {
    for (const k of ['ejercicios', 'exercises', 'ex', 'ej', 'items', 'registros']) if (Array.isArray(o[k])) return o[k];
    if (o.log && typeof o.log === 'object' && !Array.isArray(o.log)) return Object.entries(o.log).map(([id, v]) => ({ id, ...(v || {}) }));
    if (Array.isArray(o.log)) return o.log;
    return null;
  }
  function setsDe(e) {
    const base = e.kg ?? e.peso ?? e.wt ?? e.weight;
    const arr = e.series || e.sets;
    if (Array.isArray(arr)) return arr.map(s => s && typeof s === 'object'
      ? { kg: numL(s.kg ?? s.peso ?? s.weight ?? s.w ?? base), reps: numL(s.reps ?? s.repeticiones ?? s.r), ok: s.ok !== false && s.hecho !== false }
      : { kg: numL(base), reps: numL(s), ok: true }).filter(s => s.reps);
    if (Array.isArray(e.reps)) return e.reps.map((r, i) => ({ kg: numL(Array.isArray(e.pesos) ? e.pesos[i] : base), reps: numL(r), ok: true })).filter(s => s.reps);
    return [];
  }
  function convSesion(o) {
    const fecha = fechaDe(o), lista = listaEj(o);
    if (!fecha || !lista) return null;
    const ej = [];
    for (const e of lista) {
      if (!e || typeof e !== 'object') continue;
      const raw = e.id ?? e.ej ?? e.ejercicio ?? e.nombre ?? e.name, id = idEj(raw), sets = setsDe(e);
      if (!sets.length) continue;
      ej.push(id ? { id, sets, molestia: 'no', nota: '' }
        : { id: ('v1_' + norm(raw).replace(/ /g, '_')).slice(0, 60) || 'v1_ejercicio', nom: String(raw || 'Ejercicio').slice(0, 60), sets, molestia: 'no', nota: '' });
    }
    if (!ej.length) return null;
    return { id: 'v1-' + fecha + '-' + hash(JSON.stringify(o)), fecha, rutinaId: null,
      rutinaNombre: String(o.rutinaNombre ?? o.rutina ?? o.nombre ?? 'Versión anterior').slice(0, 40), ej,
      dur: numL(o.dur ?? o.duracion ?? o.duration), notas: typeof o.notas === 'string' ? o.notas.slice(0, 1000) : '' };
  }
  function convMomento(o) {
    const emo = o.emocion ?? o.emotion ?? o.sentimiento, fecha = fechaDe(o);
    if (!emo || !fecha) return null;
    return vMomento({ id: 'v1m-' + hash(JSON.stringify(o)), fecha, hora: String(o.hora || '').slice(0, 5),
      situacion: String(o.situacion ?? o.contexto ?? o.que ?? ''), emocion: String(emo),
      intensidad: numL(o.intensidad ?? o.nivel) || 0, accion: String(o.accion ?? o.respuesta ?? o.hice ?? '') });
  }
  function leerV1(d) {
    const ses = new Map(), mom = new Map(), visto = new Set();
    const recorrer = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 4 || visto.has(x)) return;
      visto.add(x);
      if (Array.isArray(x)) {
        let hits = 0;
        for (const it of x) {
          if (!it || typeof it !== 'object') continue;
          const s = convSesion(it); if (s) { ses.set(s.id, s); hits++; continue; }
          const m = convMomento(it); if (m) { mom.set(m.id, m); hits++; }
        }
        if (!hits) for (const it of x) recorrer(it, prof + 1);
        return;
      }
      for (const v of Object.values(x)) recorrer(v, prof + 1);
    };
    recorrer(d, 0);
    return { sesiones: [...ses.values()].map(vSesion).filter(Boolean), momentos: [...mom.values()] };
  }
  // Busca datos de la V1 guardados en este mismo iPhone (mismo dominio github.io).
  function buscarV1() {
    const out = { sesiones: [], momentos: [], claves: [] };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.startsWith(KEY)) continue;
        let d; try { d = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
        const r = leerV1(d);
        if (r.sesiones.length || r.momentos.length) { out.sesiones.push(...r.sesiones); out.momentos.push(...r.momentos); out.claves.push(k); }
      }
    } catch (e) {}
    return out;
  }
  function aplicarV1(datos) {
    const res = fusionar(datos, false);
    if (res) { estado.migradoV1 = true; guardar(); }
    return res;
  }

  // ── Progresión (estilo Starting Strength) ──
  function historial(ejId) {
    const out = [];
    for (const s of estado.sesiones) for (const e of s.ej) if (e.id === ejId) out.push({ fecha: s.fecha, ...e });
    return out;
  }
  // Peso de trabajo = el menor peso entre las series hechas (lo que sostuviste en todas).
  function pesoTrabajo(e) {
    const kgs = (e.sets || []).filter(s => s.ok && s.reps > 0 && s.kg > 0).map(s => s.kg);
    return kgs.length ? Math.min(...kgs) : null;
  }
  function rango(r) {
    const m = String(r).match(/(\d+)\s*(?:-|–|a)\s*(\d+)/);
    if (m) return [+m[1], +m[2]];
    const n = parseInt(r, 10);
    return isNaN(n) ? null : [n, n];
  }
  const redondear = (x, ej) => ej && ej.eq === 'Barra' ? Math.round(x / 2.5) * 2.5 : Math.round(x * 2) / 2;
  const UNIDAD = { reps: 'reps', seg: 'seg', min: 'min' };
  function sugerir(item) {
    const e = EJ[item.ej];
    if (!e) return null;
    const tipo = e.t || 'peso', h = historial(item.ej), ult = h[h.length - 1];
    if (!ult) return { tipo: 'nuevo', kg: null, texto: tipo === 'peso' ? 'Primera vez: empezá liviano y priorizá la técnica.' : 'Primera vez: registrá lo que hagas.' };
    const hechas = ult.sets.filter(s => s.ok && s.reps > 0);
    if (tipo !== 'peso') return { tipo: 'mantiene', kg: null, texto: `La última vez: ${hechas.map(s => s.reps).join(' · ') || '—'} ${UNIDAD[tipo]}. Intentá sumar un poco.` };
    const work = pesoTrabajo(ult);
    if (!work) return { tipo: 'nuevo', kg: null, texto: 'Sin peso registrado la última vez.' };
    if (ult.molestia === 'moderada') return { tipo: 'molestia', kg: work, texto: `Mantené ${work} kg: la última vez marcaste molestia moderada. Si sigue, consultalo con tu entrenador.` };
    const rg = rango(item.r);
    if (!rg) return { tipo: 'mantiene', kg: work, texto: `La última vez: ${work} kg.` };
    const [mn, mx] = rg;
    const cumple = (ses, obj) => { const ok = ses.sets.filter(x => x.ok && x.reps > 0); return ok.length >= item.s && ok.slice(0, item.s).every(x => x.reps >= obj); };
    if (cumple(ult, mx)) {
      const nuevo = redondear(work + (e.inc || 2.5), e);
      return { tipo: 'sube', kg: nuevo, texto: `Completaste ${item.s}×${mx} con ${work} kg → probá ${nuevo} kg.` };
    }
    let fallos = 0;
    for (let i = h.length - 1; i >= 0; i--) { if (pesoTrabajo(h[i]) !== work || cumple(h[i], mn)) break; fallos++; }
    if (fallos >= 3) {
      const b = redondear(work * 0.9, e);
      return { tipo: 'baja', kg: b, texto: `3 sesiones sin completar ${item.s}×${mn} con ${work} kg. El libro sugiere bajar ~10% (${b} kg) y volver a subir.` };
    }
    if (mx > mn && cumple(ult, mn)) return { tipo: 'mantiene', kg: work, texto: `Mantené ${work} kg y sumá repeticiones hasta ${item.s}×${mx}.` };
    return { tipo: 'mantiene', kg: work, texto: `Repetí ${work} kg e intentá completar ${item.s}×${mx}${fallos ? ` (intento ${fallos + 1} de 3)` : ''}.` };
  }
  // Calentamiento del libro: barra vacía 2×5 y saltos hasta el peso de trabajo.
  function calentamiento(kg, barra = 20) {
    if (!kg || kg <= barra + 5) return [];
    const r = x => Math.max(barra, Math.round(x / 2.5) * 2.5), out = [{ kg: barra, reps: 5, n: 2 }];
    for (const [f, reps] of [[0.4, 5], [0.6, 3], [0.8, 2]]) { const w = r(kg * f); if (w > barra && w < kg && !out.some(o => o.kg === w)) out.push({ kg: w, reps, n: 1 }); }
    return out;
  }
  const e1rm = (kg, reps) => kg && reps ? Math.round(kg * (1 + Math.min(reps, 12) / 30) * 10) / 10 : 0;

  return {
    get estado() { return estado; }, get problema() { return problema; }, limpiarProblema() { problema = null; },
    cargar, guardar, reiniciar, persistir, exportar, importar, descargarRescate, hayRescate,
    buscarV1, aplicarV1, historial, pesoTrabajo, sugerir, calentamiento, e1rm, rango, hoy, uid, ymd
  };
})();

// ── Documentos de la pestaña Lectura (se guardan sólo en este iPhone) ──
const Docs = (() => {
  const DB = 'migym-docs', ST = 'docs';
  const abrirDB = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const pedir = (modo, fn) => abrirDB().then(db => new Promise((res, rej) => {
    const t = db.transaction(ST, modo), q = fn(t.objectStore(ST));
    t.oncomplete = () => res(q && 'result' in q ? q.result : undefined); t.onerror = () => rej(t.error);
  }));
  async function listar() {
    const todos = await pedir('readonly', s => s.getAll());
    return (todos || []).map(d => ({ id: d.id, nombre: d.nombre, fecha: d.fecha, tam: d.tam })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  async function guardarDoc(id, nombre, tipo, datos) {
    await pedir('readwrite', s => s.put({ id, nombre, tipo, datos, tam: datos.byteLength, fecha: Store.hoy() }));
  }
  async function agregar(file) { await guardarDoc(Store.uid('d'), file.name, file.type || 'application/pdf', await file.arrayBuffer()); }
  async function abrir(id) {
    const d = await pedir('readonly', s => s.get(id));
    if (!d) return false;
    const u = URL.createObjectURL(new Blob([d.datos], { type: d.tipo }));
    const a = document.createElement('a');
    a.href = u; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
    return true;
  }
  const borrar = id => pedir('readwrite', s => s.delete(id));
  // Copia documentos que la V1 haya guardado en otra base de este mismo dominio.
  async function importarV1() {
    if (!indexedDB.databases) return 0;
    let n = 0;
    for (const info of await indexedDB.databases()) {
      if (!info.name || info.name === DB) continue;
      const db = await new Promise(res => {
        const r = indexedDB.open(info.name);
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
        r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} };
      });
      if (!db) continue;
      for (const st of [...db.objectStoreNames]) {
        const regs = await new Promise(res => {
          try { const q = db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }
          catch (e) { res([]); }
        });
        for (const r of regs) {
          const dat = r && (r.blob || r.archivo || r.file || r.data || r.datos);
          if (!dat) continue;
          let buf = null, tipo = r.tipo || r.type || 'application/pdf';
          if (dat instanceof Blob) { buf = await dat.arrayBuffer(); tipo = dat.type || tipo; }
          else if (dat instanceof ArrayBuffer) buf = dat;
          if (!buf) continue;
          const nombre = String(r.nombre || r.name || r.titulo || 'Documento');
          await guardarDoc('v1-' + nombre.replace(/[^\w.-]/g, '_').slice(0, 40) + '-' + buf.byteLength, nombre, tipo, buf);
          n++;
        }
      }
      db.close();
    }
    return n;
  }
  return { listar, agregar, abrir, borrar, importarV1 };
})();
