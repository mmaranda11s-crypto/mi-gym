// app.js — Mi Gym v2 · interfaz (usa data.js, anim.js y store.js)
(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const leerNum = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
const E = () => Store.estado;
const ICO = { piernas: '🦵', push: '💪', pull: '🧲', core: '🎯', cardio: '❤️' };
const UNI = { peso: 'reps', reps: 'reps', seg: 'seg', min: 'min' };
const LBL = { peso: 'Reps', reps: 'Reps', seg: 'Seg', min: 'Min' };
const EMOS = ['Ansiedad', 'Estrés', 'Tristeza', 'Aburrimiento', 'Cansancio', 'Enojo', 'Soledad', 'Otra'];
const TABS = [['entrenar', '🏋️', 'Entrenar'], ['rutinas', '📋', 'Rutinas'], ['progreso', '📈', 'Progreso'], ['guias', '📖', 'Guías'], ['lectura', '🧠', 'Lectura']];
const TITULOS = { entrenar: 'Entrenar', rutinas: 'Rutinas', editar: 'Editar rutina', progreso: 'Progreso', guias: 'Guías', lectura: 'Lectura', ajustes: 'Ajustes', resumen: 'Resumen' };
let VISTA = 'entrenar', PREV = 'entrenar', TIMER = null, TIV = null, WL = null, AC = null;
const UI = { filtro: 'todos', busca: '', rutinaEd: null, ejProg: null, calent: new Set(), borrar: null, sesAbierta: null,
  ocultarBackup: false, v1: null, resumen: null, emo: '', mForm: { sit: '', acc: '', int: 5 }, pick: null, paso: 0 };

// ── utilidades ──
const nomEj = (id, nom) => EJ[id] ? EJ[id].n : (nom || id);
const tipoEj = id => (EJ[id] && EJ[id].t) || 'peso';
const fFecha = f => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const fCorta = f => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fDesc = d => d >= 60 ? (d % 60 ? mmss(d) : d / 60 + ' min') : d + ' s';
const vacio = (i, t, d) => `<div class="empty"><div class="e-ico">${i}</div><div class="neg" style="color:var(--tx)">${esc(t)}</div><div class="peq" style="margin-top:4px">${esc(d)}</div></div>`;
const txtSet = (id, x) => tipoEj(id) === 'peso' ? `${x.kg ?? '—'}×${x.reps}` : `${x.reps} ${UNI[tipoEj(id)]}`;
function guardar() { if (!Store.guardar()) { toast('⚠ No se pudo guardar: almacenamiento lleno'); return false; } return true; }
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('ver'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('ver'), 2800); }
function irA(id) { setTimeout(() => { const el = $(id); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30); }
// Botones "tocá de nuevo para confirmar" (borrar, cancelar).
function confirmar2(clave) {
  if (UI.borrar === clave) { UI.borrar = null; return true; }
  UI.borrar = clave; clearTimeout(confirmar2.t);
  confirmar2.t = setTimeout(() => { UI.borrar = null; render(); }, 3500);
  render(); return false;
}

// ── navegación ──
function ir(v) { if (v !== VISTA) PREV = VISTA; VISTA = v; Anim.detenerTodo(); render(); window.scrollTo(0, 0); }
function render() {
  const enTab = k => VISTA === k || (k === 'rutinas' && VISTA === 'editar') || (k === 'entrenar' && VISTA === 'resumen');
  $('nav').innerHTML = TABS.map(([k, i, l]) => `<button type="button" data-a="ir" data-v="${k}" class="${enTab(k) ? 'on' : ''}" ${enTab(k) ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${i}</span>${l}</button>`).join('');
  $('hdr-titulo').textContent = VISTA === 'entrenar' && E().activa ? (E().activa.rutinaNombre || 'Entrenando') : (TITULOS[VISTA] || 'Mi Gym');
  avisos();
  const f = { entrenar: rEntrenar, rutinas: rRutinas, editar: rEditar, progreso: rProgreso, guias: rGuias, lectura: rLectura, ajustes: rAjustes, resumen: rResumen }[VISTA] || rEntrenar;
  $('app').innerHTML = f();
  if (VISTA === 'lectura') cargarDocs();
}
function avisos() {
  let h = '';
  if (Store.problema) h += `<div class="aviso rd">${esc(Store.problema)} <button type="button" class="btn chico ghost" data-a="okProblema">Entendido</button></div>`;
  if (UI.v1) h += `<div class="aviso">📦 Encontré datos de la versión anterior en este iPhone: ${UI.v1.sesiones.length} entrenamientos${UI.v1.momentos.length ? ` y ${UI.v1.momentos.length} registros` : ''}.
    <div class="row" style="margin-top:8px"><button type="button" class="btn chico pri" data-a="v1Si">Importar</button><button type="button" class="btn chico" data-a="v1No">No, gracias</button></div></div>`;
  else if (!E().activa && !UI.ocultarBackup) {
    const s = E().sesiones.length, nuevos = s - E().sesionesAlBackup;
    const dias = E().ultimoBackup ? diasEntre(E().ultimoBackup, Store.hoy()) : 999;
    if (s >= 3 && nuevos > 0 && (nuevos >= 5 || dias >= 14)) h += `<div class="aviso">💾 Tenés ${nuevos} entrenamientos sin copia de seguridad. Si se borran los datos de Safari, se pierden.
      <div class="row" style="margin-top:8px"><button type="button" class="btn chico pri" data-a="exportar">Exportar ahora</button><button type="button" class="btn chico" data-a="backupLuego">Después</button></div></div>`;
  }
  $('aviso').innerHTML = h;
}

// ── ENTRENAR ──
function sugeridaHoy() {
  const fuerza = E().rutinas.filter(r => !r.cardio && r.items.length);
  if (!fuerza.length) return { id: null, txt: 'Armá una rutina en la pestaña Rutinas.' };
  const ids = fuerza.map(r => r.id);
  const ult = [...E().sesiones].reverse().find(s => ids.includes(s.rutinaId));
  if (ult && ult.fecha === Store.hoy()) return { id: null, txt: 'Hoy ya entrenaste fuerza 💪 Si querés moverte, el cardio suave es buena opción.' };
  const sig = ult ? fuerza[(ids.indexOf(ult.rutinaId) + 1) % fuerza.length] : fuerza[0];
  return { id: sig.id, txt: `Sugerido hoy: ${sig.nombre}${ult ? ` (la última vez hiciste ${ult.rutinaNombre})` : ''}.` };
}
function rEntrenar() {
  if (E().activa) return rWorkout();
  const sg = sugeridaHoy();
  let h = `<div class="sec"><div class="tit">¿Qué toca hoy?</div><div class="sub">${esc(sg.txt)}</div>`;
  if (!E().rutinas.length) h += vacio('📋', 'No tenés rutinas', 'Agregá las del libro desde Rutinas → 📚 Plantillas.');
  for (const r of E().rutinas) {
    const ult = [...E().sesiones].reverse().find(s => s.rutinaId === r.id);
    const hace = ult ? diasEntre(ult.fecha, Store.hoy()) : null, es = sg.id === r.id;
    h += `<div class="cd" ${es ? 'style="border-color:var(--ac)"' : ''}>
      <div class="row between"><div><div class="neg" style="font-size:17px">${r.cardio ? '❤️' : '🏋️'} ${esc(r.nombre)}</div><div class="peq mu">${esc(r.sub || '')}</div></div>${es ? '<span class="tag ac">Sugerido</span>' : ''}</div>
      <div class="peq" style="margin:8px 0;line-height:1.5">${r.items.map(it => `${esc(nomEj(it.ej))} <span class="mu">${it.s}×${esc(it.r)}</span>`).join(' · ') || '<span class="mu">Sin ejercicios</span>'}</div>
      ${r.n ? `<div class="peq mu" style="margin-bottom:8px">📌 ${esc(r.n)}</div>` : ''}
      <div class="row between"><span class="peq mu">${hace == null ? 'Todavía no la hiciste' : hace === 0 ? 'Hecha hoy' : hace === 1 ? 'Última vez: ayer' : `Última vez: hace ${hace} días`}</span>
      <button type="button" class="btn chico ${es ? 'pri' : ''}" data-a="iniciar" data-id="${esc(r.id)}" ${r.items.length ? '' : 'disabled'}>Empezar</button></div></div>`;
  }
  return h + '</div>';
}
function crearEj(it) {
  const sg = Store.sugerir(it), rg = Store.rango(it.r), t = tipoEj(it.ej);
  return { id: it.ej, s: it.s, r: it.r, d: it.d, n: it.n || '', molestia: 'no', nota: '',
    sets: Array.from({ length: it.s }, () => ({ kg: t === 'peso' ? (sg && sg.kg) || null : null, reps: rg ? rg[1] : null, ok: false, ts: 0 })) };
}
function iniciar(id) {
  const r = E().rutinas.find(x => x.id === id);
  if (!r) return;
  E().activa = { id: Store.uid('s'), rutinaId: r.id, rutinaNombre: r.nombre, inicio: Date.now(), idx: 0, notas: '', ej: r.items.map(crearEj) };
  UI.calent.clear(); guardar(); Store.persistir(); pedirPantalla(); render(); window.scrollTo(0, 0);
}
const exHecho = e => e.sets.length > 0 && e.sets.every(s => s.ok);
function rWorkout() {
  const a = E().activa, n = a.ej.length;
  a.idx = Math.min(Math.max(0, a.idx), n - 1);
  const hechos = a.ej.filter(exHecho).length;
  let h = `<div class="sec"><div class="row between"><div class="peq mu">⏱ <span id="reloj">${mmss((Date.now() - a.inicio) / 1000)}</span> · ${hechos}/${n} ejercicios</div>
    <button type="button" class="btn chico ${UI.borrar === 'cancelar' ? 'peligro' : ''}" data-a="cancelar">${UI.borrar === 'cancelar' ? '¿Descartar? Tocá de nuevo' : 'Cancelar'}</button></div>
    <div class="prog">${a.ej.map(e => `<i class="${exHecho(e) ? 'on' : ''}"></i>`).join('')}</div>`;
  a.ej.forEach((e, i) => { h += i === a.idx ? cardEj(e, i, n) : filaEj(e, i); });
  h += `<label class="lbl" for="notas-ses">Notas del entrenamiento</label><textarea id="notas-ses" class="inp" data-in="notasSes" placeholder="Cómo te sentiste, qué cambiar…">${esc(a.notas)}</textarea>
    <button type="button" class="btn ok full" style="margin-top:14px" data-a="terminar">Terminar entrenamiento ✓</button></div>`;
  return h;
}
function filaEj(e, i) {
  const ok = e.sets.filter(s => s.ok).length, g = (EJ[e.id] || {}).g;
  return `<div class="cd" id="ej-${i}" style="padding:4px 14px;scroll-margin-top:70px"><button type="button" class="item" data-a="abrirEj" data-i="${i}">
    <span class="ico">${exHecho(e) ? '✅' : ICO[g] || '🏋️'}</span><span class="txt"><span class="t1" style="display:block">${esc(nomEj(e.id))}</span>
    <span class="t2" style="display:block">${e.s}×${esc(e.r)} · ${ok}/${e.sets.length} series</span></span><span class="mu">›</span></button></div>`;
}
function cardEj(e, i, n) {
  const ej = EJ[e.id] || { n: e.id, eq: '' }, t = tipoEj(e.id), sg = Store.sugerir({ ej: e.id, s: e.s, r: e.r });
  let h = `<div class="cd" id="ej-${i}" style="scroll-margin-top:70px;border-color:var(--ac)"><div class="ej-head"><div>
    <div class="ej-nom">${esc(ej.n)}</div><div class="presc">${e.s}×${esc(e.r)} ${UNI[t]}${e.d ? ` · descanso ${fDesc(e.d)}` : ''}</div></div>
    <div class="row"><button type="button" class="btn chico" data-a="tecnica" data-id="${esc(e.id)}" aria-label="Ver técnica">📖</button>
    <button type="button" class="btn chico" data-a="cambiar" data-i="${i}" aria-label="Cambiar ejercicio">⇄</button></div></div>`;
  if (e.n) h += `<div class="peq mu" style="margin-top:6px">📌 ${esc(e.n)}</div>`;
  if (sg) h += `<div class="sug ${sg.tipo === 'molestia' || sg.tipo === 'baja' ? 'wa' : ''}">${esc(sg.texto)}</div>`;
  if (t === 'peso' && ej.eq === 'Barra') {
    const cal = Store.calentamiento(e.sets[0] && e.sets[0].kg, E().prefs.barra);
    if (cal.length) {
      h += `<button type="button" class="btn chico ghost" data-a="calent" data-i="${i}">${UI.calent.has(i) ? 'Ocultar' : 'Ver'} calentamiento</button>`;
      if (UI.calent.has(i)) h += `<div class="warmup">${cal.map(c => `<div><span>${c.kg} kg</span><span class="mu">${c.n > 1 ? c.n + ' × ' : ''}${c.reps} reps</span></div>`).join('')}</div>`;
    }
  }
  h += `<div class="set-row hd"><span>#</span><span>${t === 'peso' ? 'Kg' : ''}</span><span>${LBL[t]}</span><span>✓</span></div>`;
  e.sets.forEach((s, j) => {
    h += `<div class="set-row ${s.ok ? 'ok' : ''}"><span class="set-n">${j + 1}</span>
      ${t === 'peso' ? `<input class="inp" type="text" inputmode="decimal" value="${s.kg ?? ''}" placeholder="kg" aria-label="Serie ${j + 1}, kilos" data-in="kg" data-i="${i}" data-j="${j}">` : '<span></span>'}
      <input class="inp" type="text" inputmode="numeric" value="${s.reps ?? ''}" placeholder="—" aria-label="Serie ${j + 1}, ${LBL[t]}" data-in="reps" data-i="${i}" data-j="${j}">
      <button type="button" class="tick ${s.ok ? 'on' : ''}" data-a="tick" data-i="${i}" data-j="${j}" aria-label="Serie ${j + 1} hecha" aria-pressed="${s.ok}">${s.ok ? '✓' : ''}</button></div>`;
  });
  h += `<div class="row" style="margin-top:6px"><button type="button" class="btn chico" data-a="masSerie" data-i="${i}">+ Serie</button>
    ${e.sets.length > 1 ? `<button type="button" class="btn chico" data-a="menosSerie" data-i="${i}" aria-label="Quitar última serie">− Serie</button>` : ''}</div>
    <div class="lbl" style="margin-top:14px">¿Molestia en alguna articulación?</div><div class="seg3">
    ${[['no', 'No'], ['leve', 'Leve'], ['moderada', 'Moderada']].map(([m, l]) => `<button type="button" class="btn chico ${e.molestia === m ? (m === 'moderada' ? 'peligro' : 'pri') : ''}" aria-pressed="${e.molestia === m}" data-a="molestia" data-i="${i}" data-m="${m}">${l}</button>`).join('')}</div>
    ${e.molestia === 'moderada' ? '<div class="peq mu" style="margin-top:6px">La próxima vez no te va a sugerir subir peso. Si se repite, consultalo.</div>' : ''}
    <input class="inp" style="margin-top:10px" placeholder="Nota del ejercicio…" value="${esc(e.nota)}" aria-label="Nota del ejercicio" data-in="nota" data-i="${i}">`;
  h += i < n - 1
    ? `<button type="button" class="btn pri full" style="margin-top:12px" data-a="irEj" data-i="${i + 1}">Siguiente → ${esc(nomEj(E().activa.ej[i + 1].id))}</button>`
    : `<button type="button" class="btn ok full" style="margin-top:12px" data-a="terminar">Terminar ✓</button>`;
  return h + '</div>';
}
function tick(i, j) {
  const e = E().activa.ej[i], s = e.sets[j], t = tipoEj(e.id);
  if (!s.ok && !(s.reps > 0)) { toast(t === 'seg' || t === 'min' ? 'Anotá el tiempo antes de marcar' : 'Anotá las repeticiones antes de marcar'); return; }
  s.ok = !s.ok; s.ts = s.ok ? Date.now() : 0; guardar();
  if (s.ok && e.d > 0) iniciarTimer(e.d);
  render();
}
function terminar() {
  const a = E().activa;
  let pend = 0;
  for (const e of a.ej) for (const s of e.sets) if (!s.ok && s.reps > 0) pend++;
  const ejs = a.ej.map(e => ({ id: e.id, sets: e.sets.filter(s => s.ok && s.reps > 0).map(s => ({ kg: s.kg, reps: s.reps, ok: true })), molestia: e.molestia, nota: e.nota })).filter(e => e.sets.length);
  if (!ejs.length) { toast('Marcá con ✓ al menos una serie para guardar'); return; }
  if (pend && !confirm(`Hay ${pend} serie(s) sin marcar con ✓ que no se van a guardar. ¿Terminar igual?`)) return;
  const ses = { id: a.id, fecha: Store.ymd(new Date(a.inicio)), rutinaId: a.rutinaId, rutinaNombre: a.rutinaNombre, ej: ejs, dur: Math.round((Date.now() - a.inicio) / 60000), notas: a.notas || '' };
  const prs = [];
  for (const e of ejs) {
    if (tipoEj(e.id) !== 'peso') continue;
    const antes = Math.max(0, ...Store.historial(e.id).flatMap(x => x.sets.filter(s => s.ok).map(s => s.kg || 0)));
    const ahora = Math.max(0, ...e.sets.map(s => s.kg || 0));
    if (antes > 0 && ahora > antes) prs.push({ id: e.id, kg: ahora });
  }
  UI.resumen = { ses, prs }; cerrarTimer(); ir('resumen');
}
function rResumen() {
  const R = UI.resumen;
  if (!R) return rEntrenar();
  const s = R.ses;
  let series = 0, vol = 0;
  for (const e of s.ej) for (const x of e.sets) { series++; if (tipoEj(e.id) === 'peso' && x.kg) vol += x.kg * x.reps; }
  let h = `<div class="sec"><div class="cd" style="text-align:center"><div style="font-size:34px">💪</div><div class="tit">¡Entrenamiento completo!</div>
    <div class="peq mu">${esc(s.rutinaNombre)} · ${fFecha(s.fecha)}</div>
    <div class="stats" style="margin-top:14px"><div class="stat"><div class="stat-n">${s.dur}</div><div class="stat-l">minutos</div></div>
    <div class="stat"><div class="stat-n">${series}</div><div class="stat-l">series</div></div>
    <div class="stat"><div class="stat-n">${vol ? (vol >= 1000 ? (vol / 1000).toFixed(1) : Math.round(vol)) : '—'}</div><div class="stat-l">${vol >= 1000 ? 'toneladas movidas' : 'kg movidos'}</div></div></div>
    ${R.prs.map(p => `<div class="tag ac" style="margin:3px">🏆 Récord: ${esc(nomEj(p.id))} ${p.kg} kg</div>`).join('')}</div>`;
  h += `<div class="cd">${s.ej.map(e => `<div style="padding:6px 0"><div class="neg peq">${esc(nomEj(e.id))}${e.molestia !== 'no' ? ` <span class="tag ${e.molestia === 'moderada' ? 'rd' : 'wa'}">molestia ${e.molestia}</span>` : ''}</div><div class="peq mu">${e.sets.map(x => txtSet(e.id, x)).join(' · ')}</div></div>`).join('')}</div>
    <button type="button" class="btn pri full" data-a="guardarSes">Guardar ✓</button>
    <button type="button" class="btn ghost full" style="margin-top:8px" data-a="ir" data-v="entrenar">← Volver al entrenamiento</button></div>`;
  return h;
}
function guardarSesion() {
  const R = UI.resumen; if (!R) return;
  const prevSes = E().sesiones, prevAct = E().activa;
  E().sesiones = [...prevSes.filter(s => s.id !== R.ses.id), R.ses].sort((a, b) => a.fecha.localeCompare(b.fecha));
  E().activa = null;
  if (!Store.guardar()) { E().sesiones = prevSes; E().activa = prevAct; toast('⚠ No se pudo guardar: almacenamiento lleno'); return; }
  UI.resumen = null; soltarPantalla(); ir('entrenar'); toast('Guardado 💪');
}

// ── temporizador de descanso (reloj real: no se atrasa con la pantalla bloqueada) ──
function initAC() { try { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === 'suspended') AC.resume(); } catch (e) {} }
function beep() {
  try {
    if (!AC) return;
    const t0 = AC.currentTime;
    [0, 0.25, 0.5].forEach((d, k) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.frequency.value = k === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(0.4, t0 + d + 0.02); g.gain.linearRampToValueAtTime(0, t0 + d + 0.18);
      o.connect(g); g.connect(AC.destination); o.start(t0 + d); o.stop(t0 + d + 0.2);
    });
  } catch (e) {}
}
function alarma() { if (E().prefs.sonido) beep(); if (E().prefs.vibrar && navigator.vibrate) navigator.vibrate([300, 150, 300]); }
function iniciarTimer(seg) {
  TIMER = { fin: Date.now() + seg * 1000, listo: false };
  $('timer').innerHTML = `<div class="timer-pill" role="timer"><span class="peq mu">Descanso</span><b id="t-txt"></b>
    <button type="button" class="btn chico" data-a="timer30">+30s</button><button type="button" class="btn chico" data-a="timerX" aria-label="Cerrar temporizador">✕</button></div>`;
  clearInterval(TIV); TIV = setInterval(tickTimer, 500); tickTimer();
}
function tickTimer() {
  if (!TIMER) return;
  const r = Math.ceil((TIMER.fin - Date.now()) / 1000), pill = document.querySelector('.timer-pill');
  if (r <= 0 && !TIMER.listo) { TIMER.listo = true; alarma(); if (pill) pill.classList.add('fin'); }
  if (r < -120) { cerrarTimer(); return; }
  const t = $('t-txt'); if (t) t.textContent = r > 0 ? mmss(r) : '¡Listo!';
}
function cerrarTimer() { TIMER = null; clearInterval(TIV); TIV = null; $('timer').innerHTML = ''; }
// Pantalla encendida durante el entrenamiento
async function pedirPantalla() {
  try { if (!E().prefs.pantalla || !('wakeLock' in navigator) || WL || !E().activa) return; WL = await navigator.wakeLock.request('screen'); WL.addEventListener('release', () => { WL = null; }); } catch (e) { WL = null; }
}
function soltarPantalla() { try { if (WL) WL.release(); } catch (e) {} WL = null; }

// ── RUTINAS ──
function rRutinas() {
  let h = `<div class="sec"><div class="tit">Rutinas</div><div class="sub">Tocá una rutina para editar series, repeticiones y descansos.</div>`;
  if (!E().rutinas.length) h += vacio('📋', 'No tenés rutinas', 'Usá 📚 Plantillas para cargar las del libro.');
  for (const r of E().rutinas) h += `<div class="cd" style="padding:4px 14px 12px"><button type="button" class="item" data-a="editar" data-id="${esc(r.id)}">
    <span class="ico">${r.cardio ? '❤️' : '🏋️'}</span><span class="txt"><span class="t1" style="display:block">${esc(r.nombre)}</span>
    <span class="t2" style="display:block">${esc(r.sub || '')}${r.sub ? ' · ' : ''}${r.items.length} ejercicios</span></span><span class="mu">›</span></button>
    <div class="peq mu" style="margin-top:6px;line-height:1.5">${r.items.map(it => esc(nomEj(it.ej)) + ' ' + it.s + '×' + esc(it.r)).join(' · ')}</div></div>`;
  return h + `<div class="grid2"><button type="button" class="btn" data-a="nuevaRutina">+ Nueva rutina</button><button type="button" class="btn" data-a="plantillas">📚 Plantillas</button></div></div>`;
}
function rEditar() {
  const r = E().rutinas.find(x => x.id === UI.rutinaEd);
  if (!r) return rRutinas();
  let h = `<div class="sec"><button type="button" class="btn chico ghost" data-a="ir" data-v="rutinas">‹ Rutinas</button>
    <label class="lbl" for="r-nom">Nombre</label><input id="r-nom" class="inp" value="${esc(r.nombre)}" data-in="rNom">
    <label class="lbl" for="r-sub">Descripción</label><input id="r-sub" class="inp" value="${esc(r.sub)}" data-in="rSub">
    <label class="lbl" for="r-n">Nota</label><textarea id="r-n" class="inp" data-in="rN">${esc(r.n)}</textarea><div class="lbl">Ejercicios</div>`;
  r.items.forEach((it, k) => {
    const t = tipoEj(it.ej);
    h += `<div class="cd"><div class="row between"><div class="neg">${esc(nomEj(it.ej))}</div><div class="row">
      <button type="button" class="btn chico" data-a="itemUp" data-k="${k}" aria-label="Subir" ${k ? '' : 'disabled'}>↑</button>
      <button type="button" class="btn chico" data-a="itemDown" data-k="${k}" aria-label="Bajar" ${k < r.items.length - 1 ? '' : 'disabled'}>↓</button>
      <button type="button" class="btn chico peligro" data-a="itemDel" data-k="${k}" aria-label="Quitar ${esc(nomEj(it.ej))}">✕</button></div></div>
      <div class="grid3" style="margin-top:8px"><label class="peq mu">Series<input class="inp" type="text" inputmode="numeric" value="${it.s}" data-in="itS" data-k="${k}"></label>
      <label class="peq mu">${{ peso: 'Reps', reps: 'Reps', seg: 'Segundos', min: 'Minutos' }[t]}<input class="inp" value="${esc(it.r)}" data-in="itR" data-k="${k}"></label>
      <label class="peq mu">Descanso (s)<input class="inp" type="text" inputmode="numeric" value="${it.d}" data-in="itD" data-k="${k}"></label></div>
      <input class="inp" style="margin-top:8px" placeholder="Nota (opcional)" aria-label="Nota" value="${esc(it.n)}" data-in="itN" data-k="${k}"></div>`;
  });
  if (!r.items.length) h += `<div class="peq mu" style="margin-bottom:10px">Todavía no tiene ejercicios.</div>`;
  return h + `<button type="button" class="btn full" data-a="agregarEj">+ Agregar ejercicio</button>
    <button type="button" class="btn peligro full" style="margin-top:24px" data-a="borrarRutina">${UI.borrar === 'rutina' ? '¿Seguro? Tocá de nuevo' : 'Eliminar rutina'}</button></div>`;
}
function rutinaEd() { return E().rutinas.find(x => x.id === UI.rutinaEd); }
function modalPlantillas() {
  let h = `<div class="modal-top"><div class="tit" style="font-size:19px">Plantillas</div><button type="button" class="btn chico" data-a="cerrarModal">Cerrar</button></div>`;
  for (const [k, p] of Object.entries(PLANTILLAS)) h += `<div class="cd"><div class="neg">${esc(p.nombre)}</div>
    <div class="peq mu" style="margin:4px 0 8px">${esc(p.desc)}</div><div class="peq">${p.rutinas.map(r => esc(r.nombre)).join(' · ')}</div>
    <div class="grid2" style="margin-top:10px"><button type="button" class="btn chico pri" data-a="plantAgregar" data-k="${k}">Agregar</button>
    <button type="button" class="btn chico" data-a="plantReemplazar" data-k="${k}">Reemplazar las mías</button></div></div>`;
  abrirModal(h);
}
// Selector de ejercicios (agregar a rutina o cambiar en el entrenamiento)
function filtrarEj(f, q) { const n = norm(q); return Object.keys(EJ).filter(id => (f === 'todos' || EJ[id].g === f) && (!n || norm(EJ[id].n + ' ' + EJ[id].m).includes(n))); }
function filaPick(id, accion) {
  return `<button type="button" class="item" data-a="${accion}" data-id="${id}"><span class="ico">${ICO[EJ[id].g]}</span><span class="txt">
    <span class="t1" style="display:block">${esc(EJ[id].n)}${EJ[id].libro ? ' <span class="tag ac">Libro</span>' : ''}</span>
    <span class="t2" style="display:block">${esc(EJ[id].m)} · ${esc(EJ[id].eq)}</span></span></button>`;
}
function abrirPicker(modo, i) {
  const g = modo === 'cambiar' ? (EJ[E().activa.ej[i].id] || {}).g || 'todos' : 'todos';
  UI.pick = { modo, i, filtro: g, busca: '' }; pintarPicker();
}
function pintarPicker() {
  const p = UI.pick;
  const ch = ['todos', ...Object.keys(GRUPOS)].map(k => `<button type="button" class="chip ${p.filtro === k ? 'on' : ''}" data-a="pickFiltro" data-k="${k}">${k === 'todos' ? 'Todos' : GRUPOS[k]}</button>`).join('');
  abrirModal(`<div class="modal-top"><div class="tit" style="font-size:19px">${p.modo === 'cambiar' ? 'Cambiar ejercicio' : 'Agregar ejercicio'}</div><button type="button" class="btn chico" data-a="cerrarModal">Cerrar</button></div>
    <input class="inp" type="search" placeholder="Buscar…" value="${esc(p.busca)}" data-in="pBusca" aria-label="Buscar ejercicio"><div class="chips" style="margin-top:10px">${ch}</div><div id="pick-lista">${listaPicker()}</div>`);
}
function listaPicker() {
  const p = UI.pick;
  let ids = filtrarEj(p.filtro, p.busca), rec = [];
  if (p.modo === 'cambiar') { const cur = E().activa.ej[p.i].id; rec = ((EJ[cur] || {}).alt || []).filter(x => EJ[x]); ids = ids.filter(x => x !== cur && !rec.includes(x)); }
  let h = rec.length && !p.busca ? `<div class="lbl">Recomendadas</div>${rec.map(id => filaPick(id, 'pickElegir')).join('')}<div class="lbl">Otras</div>` : '';
  return h + (ids.map(id => filaPick(id, 'pickElegir')).join('') || '<div class="empty">Sin resultados</div>');
}
function elegir(id) {
  const p = UI.pick, t = tipoEj(id);
  if (p.modo === 'agregar') {
    const r = rutinaEd();
    if (r) r.items.push({ ej: id, s: t === 'min' ? 1 : 3, r: t === 'peso' ? '8-12' : t === 'seg' ? '30' : t === 'min' ? '20' : '10', d: t === 'min' ? 0 : 90, n: '' });
  } else {
    const a = E().activa, e = a && a.ej[p.i];
    if (e) a.ej[p.i] = crearEj({ ej: id, s: e.s, r: e.r, d: e.d, n: '' });
  }
  guardar(); cerrarModal(); render();
}

// ── PROGRESO ──
function calendario() {
  const hoy = new Date(), dow = (hoy.getDay() + 6) % 7, ini = new Date(hoy);
  ini.setDate(hoy.getDate() - dow - 77);
  const mapa = {};
  for (const s of E().sesiones) { const card = s.ej.every(e => (EJ[e.id] || {}).g === 'cardio'); if (!mapa[s.fecha] || mapa[s.fecha] === 'c') mapa[s.fecha] = card ? 'c' : 'f'; }
  const ht = Store.hoy();
  let h = `<div class="hm" style="margin-bottom:4px">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="mu" style="text-align:center;font-size:10px;font-weight:700">${d}</div>`).join('')}</div><div class="hm">`;
  for (let i = 0; i < 84; i++) {
    const d = new Date(ini); d.setDate(ini.getDate() + i);
    const f = Store.ymd(d);
    if (f > ht) { h += '<div></div>'; continue; }
    h += `<div class="hm-c ${mapa[f] || ''} ${f === ht ? 'hoy' : ''}" title="${f}">${d.getDate()}</div>`;
  }
  return h + `</div><div class="row peq mu" style="margin-top:10px;gap:14px"><span><span class="tag ac">■</span> Fuerza</span><span><span class="tag ok">■</span> Cardio</span></div>`;
}
function balance() {
  const desde = Store.ymd(new Date(Date.now() - 27 * 864e5)), c = { piernas: 0, push: 0, pull: 0, core: 0 };
  for (const s of E().sesiones) { if (s.fecha < desde) continue; for (const e of s.ej) { const g = (EJ[e.id] || {}).g; if (g in c) c[g] += e.sets.filter(x => x.ok).length; } }
  const mx = Math.max(1, ...Object.values(c));
  return Object.entries(c).map(([g, v]) => `<div class="bar-row"><div class="bar-top"><span>${ICO[g]} ${GRUPOS[g]}</span><span class="neg">${v} series</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / mx * 100)}%"></div></div></div>`).join('');
}
function grafico(pts, titulo) {
  if (pts.length < 2) return '<div class="peq mu" style="text-align:center;padding:14px">Con 2 o más sesiones vas a ver el gráfico.</div>';
  const W = 340, H = 170, pl = 36, pr = 12, pt = 24, pb = 26, w = W - pl - pr, hh = H - pt - pb;
  let mn = Math.min(...pts.map(p => p.v)), mx = Math.max(...pts.map(p => p.v));
  if (mx === mn) { mn -= 1; mx += 1; }
  const pad = (mx - mn) * 0.1; mn = Math.max(0, mn - pad); mx += pad;
  const X = i => pl + i / (pts.length - 1) * w, Y = v => pt + hh - (v - mn) / (mx - mn) * hh;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}: de ${pts[0].v} a ${pts[pts.length - 1].v}">`;
  for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3, y = Y(v); s += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" style="stroke:var(--bd)"/><text x="${pl - 5}" y="${y + 3}" text-anchor="end" style="fill:var(--mu);font-size:9px">${Math.round(v * 10) / 10}</text>`; }
  s += `<polyline points="${pts.map((p, i) => X(i) + ',' + Y(p.v)).join(' ')}" style="fill:none;stroke:var(--ac);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round"/>`;
  pts.forEach((p, i) => { s += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="3.5" style="fill:var(--ac);stroke:var(--cd);stroke-width:2"><title>${esc(p.l)}: ${p.v}</title></circle>`; });
  const paso = Math.ceil(pts.length / 6);
  pts.forEach((p, i) => { if (i % paso === 0) s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" style="fill:var(--mu);font-size:9px">${esc(p.l)}</text>`; });
  return `<div class="chart">${s}<text x="${W / 2}" y="14" text-anchor="middle" style="fill:var(--tx);font-size:11px;font-weight:700">${esc(titulo)}</text></svg></div>`;
}
function rProgreso() {
  const ss = E().sesiones;
  let h = `<div class="sec"><div class="tit">Progreso</div>`;
  if (!ss.length) return h + vacio('📈', 'Todavía no hay entrenamientos', 'Cuando guardes el primero, acá vas a ver tu calendario, tus récords y la evolución de cada ejercicio.') + '</div>';
  const mes = Store.hoy().slice(0, 7), delMes = ss.filter(s => s.fecha.startsWith(mes));
  const nSeries = l => l.reduce((t, s) => t + s.ej.reduce((u, e) => u + e.sets.filter(x => x.ok).length, 0), 0);
  h += `<div class="stats"><div class="stat"><div class="stat-n">${ss.length}</div><div class="stat-l">entrenamientos</div></div>
    <div class="stat"><div class="stat-n">${delMes.length}</div><div class="stat-l">este mes</div></div>
    <div class="stat"><div class="stat-n">${nSeries(delMes)}</div><div class="stat-l">series este mes</div></div></div>
    <div class="lbl">Últimas 12 semanas</div><div class="cd">${calendario()}</div>
    <div class="lbl">Series por grupo · últimos 28 días</div><div class="cd">${balance()}<div class="peq mu">Sirve para ver si algún grupo queda de lado. No es una meta.</div></div>`;
  const ids = [], nomDe = {};
  for (let q = ss.length - 1; q >= 0; q--) for (const e of ss[q].ej) { if (!ids.includes(e.id)) ids.push(e.id); nomDe[e.id] = nomEj(e.id, e.nom); }
  if (!UI.ejProg || !ids.includes(UI.ejProg)) UI.ejProg = ids[0];
  const id = UI.ejProg, t = tipoEj(id), hist = Store.historial(id);
  h += `<div class="lbl">Por ejercicio</div><div class="cd"><select class="inp" data-in="ejProg" aria-label="Elegí un ejercicio">${ids.map(x => `<option value="${esc(x)}" ${x === id ? 'selected' : ''}>${esc(nomDe[x])}</option>`).join('')}</select>`;
  const pts = hist.slice(-20).map(e => ({ v: t === 'peso' ? (Store.pesoTrabajo(e) || 0) : Math.max(0, ...e.sets.filter(x => x.ok).map(x => x.reps || 0)), l: fCorta(e.fecha) })).filter(p => p.v > 0);
  h += `<div style="margin-top:10px">${grafico(pts, t === 'peso' ? 'Peso de trabajo (kg)' : `Mejor serie (${UNI[t]})`)}</div>`;
  if (t === 'peso') {
    const sets = hist.flatMap(e => e.sets.filter(x => x.ok && x.kg > 0));
    const maxKg = sets.length ? Math.max(...sets.map(x => x.kg)) : 0, e1 = sets.length ? Math.max(...sets.map(x => Store.e1rm(x.kg, x.reps))) : 0;
    h += `<div class="grid3" style="margin-top:10px"><div class="stat"><div class="stat-n">${maxKg || '—'}</div><div class="stat-l">kg máximo</div></div>
      <div class="stat"><div class="stat-n">${e1 || '—'}</div><div class="stat-l">1RM estimado</div></div><div class="stat"><div class="stat-n">${hist.length}</div><div class="stat-l">sesiones</div></div></div>
      <div class="peq mu" style="margin-top:8px">El 1RM estimado sale del peso y las repeticiones: es orientativo, no un máximo probado.</div>`;
  }
  h += `</div><div class="lbl">Historial</div>`;
  for (const s of [...ss].reverse().slice(0, 25)) {
    const ab = UI.sesAbierta === s.id;
    h += `<div class="cd" style="padding:4px 14px"><button type="button" class="item" data-a="sesToggle" data-id="${esc(s.id)}" aria-expanded="${ab}">
      <span class="ico">${s.ej.every(e => (EJ[e.id] || {}).g === 'cardio') ? '❤️' : '🏋️'}</span><span class="txt"><span class="t1" style="display:block">${esc(s.rutinaNombre || 'Entrenamiento')}</span>
      <span class="t2" style="display:block">${fFecha(s.fecha)}${s.dur ? ` · ${s.dur} min` : ''} · ${s.ej.length} ejercicios</span></span><span class="mu">${ab ? '▴' : '▾'}</span></button>`;
    if (ab) {
      h += s.ej.map(e => `<div style="padding:8px 0;border-top:1px solid var(--bd)"><div class="neg peq">${esc(nomEj(e.id, e.nom))}${e.molestia !== 'no' ? ` <span class="tag ${e.molestia === 'moderada' ? 'rd' : 'wa'}">molestia ${e.molestia}</span>` : ''}</div>
        <div class="peq mu">${e.sets.filter(x => x.ok).map(x => txtSet(e.id, x)).join(' · ')}${e.nota ? ' — ' + esc(e.nota) : ''}</div></div>`).join('');
      if (s.notas) h += `<div class="peq mu" style="padding-top:6px">📝 ${esc(s.notas)}</div>`;
      h += `<button type="button" class="btn chico peligro" style="margin:8px 0" data-a="sesBorrar" data-id="${esc(s.id)}">${UI.borrar === 'ses-' + s.id ? '¿Seguro? Tocá de nuevo' : 'Borrar'}</button>`;
    }
    h += '</div>';
  }
  return h + '</div>';
}

// ── GUÍAS ──
function listaGuias() { return filtrarEj(UI.filtro, UI.busca).map(id => filaPick(id, 'tecnica')).join('') || '<div class="empty">Sin resultados</div>'; }
function rGuias() {
  const ch = ['todos', ...Object.keys(GRUPOS)].map(k => `<button type="button" class="chip ${UI.filtro === k ? 'on' : ''}" data-a="gFiltro" data-k="${k}">${k === 'todos' ? 'Todos' : GRUPOS[k]}</button>`).join('');
  return `<div class="sec"><div class="tit">Guías</div><div class="sub">${Object.keys(EJ).length} ejercicios con animación, claves y errores comunes.</div>
    <input class="inp" type="search" placeholder="Buscar ejercicio…" value="${esc(UI.busca)}" data-in="gBusca" aria-label="Buscar ejercicio">
    <div class="chips" style="margin-top:10px">${ch}</div><div class="cd" style="padding:4px 14px" id="g-lista">${listaGuias()}</div></div>`;
}
function abrirTecnica(id) {
  const e = EJ[id]; if (!e) return;
  const lista = arr => `<ul style="padding-left:20px;line-height:1.55">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const alt = (e.alt || []).filter(a => EJ[a]);
  abrirModal(`<div class="modal-top"><div><div class="tit" style="font-size:19px">${esc(e.n)}</div><div class="peq mu">${esc(e.m)} · ${esc(e.eq)}${e.libro ? ' · <span class="tag ac">Libro</span>' : ''}</div></div>
    <button type="button" class="btn chico" data-a="cerrarModal">Cerrar</button></div><div id="anim-cont"></div>
    <div class="lbl">Claves</div>${lista(e.c)}<div class="lbl">Errores comunes</div>${lista(e.e)}
    ${alt.length ? `<div class="lbl">Alternativas</div><div class="row wrap">${alt.map(a => `<button type="button" class="btn chico" data-a="tecnica" data-id="${a}">${esc(EJ[a].n)}</button>`).join('')}</div>` : ''}
    <p class="peq mu" style="margin-top:14px">En naranja, los músculos que más trabajan. La línea punteada muestra el recorrido de la barra o la mancuerna.</p>`);
  Anim.detenerTodo(); Anim.montar($('anim-cont'), e.a);
}
function abrirModal(html) { $('modal').innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; document.body.style.overflow = 'hidden'; }
function cerrarModal() { Anim.detenerTodo(); $('modal').innerHTML = ''; document.body.style.overflow = ''; }

// ── LECTURA ──
function rLectura() {
  const f = UI.mForm, ms = [...E().momentos].reverse().slice(0, 15);
  let h = `<div class="sec"><div class="tit">Lectura y pausa</div><div class="sub">Tus documentos y herramientas para los momentos difíciles.</div>
    <div class="cd"><div class="neg" style="font-size:17px">🫁 Pausa guiada</div><div class="peq mu" style="margin:4px 0 10px">5 pasos para cuando aparecen las ganas de comer sin hambre o la ansiedad sube.</div>
    <button type="button" class="btn pri full" data-a="pausa">Empezar pausa</button></div>
    <div class="lbl">Registro de momentos</div><div class="cd">
    <label class="lbl" style="margin-top:0" for="m-sit">¿Qué estaba pasando?</label><textarea id="m-sit" class="inp" data-in="mSit">${esc(f.sit)}</textarea>
    <div class="lbl">¿Qué sentías?</div><div class="row wrap">${EMOS.map(x => `<button type="button" class="chip ${UI.emo === x ? 'on' : ''}" aria-pressed="${UI.emo === x}" data-a="emo" data-k="${x}">${x}</button>`).join('')}</div>
    <label class="lbl" for="m-int">Intensidad: <b id="m-int-v">${f.int}</b>/10</label><input id="m-int" type="range" min="0" max="10" value="${f.int}" data-in="mInt" style="width:100%">
    <label class="lbl" for="m-acc">¿Qué hiciste o qué te ayudó?</label><textarea id="m-acc" class="inp" data-in="mAcc">${esc(f.acc)}</textarea>
    <button type="button" class="btn pri full" style="margin-top:12px" data-a="guardarMomento">Guardar</button></div>`;
  for (const m of ms) h += `<div class="cd"><div class="row between"><span class="peq mu">${fFecha(m.fecha)}${m.hora ? ' · ' + esc(m.hora) : ''}</span>
    <span>${m.emocion ? `<span class="tag ac">${esc(m.emocion)}</span>` : ''} <span class="tag">${m.intensidad}/10</span></span></div>
    ${m.situacion ? `<div class="peq" style="margin-top:6px">${esc(m.situacion)}</div>` : ''}${m.accion ? `<div class="peq mu" style="margin-top:4px">→ ${esc(m.accion)}</div>` : ''}
    <button type="button" class="btn chico ghost" style="margin-top:4px" data-a="momBorrar" data-id="${esc(m.id)}">${UI.borrar === 'mom-' + m.id ? '¿Seguro? Tocá de nuevo' : 'Borrar'}</button></div>`;
  return h + `<div class="lbl">Documentos</div><div class="cd"><div id="docs" class="peq mu">Cargando…</div>
    <label class="btn full" style="margin-top:10px">+ Agregar documento (PDF)<input type="file" accept="application/pdf,.pdf" class="sr" data-in="docAdd"></label>
    <div class="peq mu" style="margin-top:8px">Se guardan sólo en este iPhone: no se suben a GitHub ni a ningún lado.</div></div>
    <p class="peq mu" style="margin-top:14px">Si sentís que te desborda, hablalo con tu psicóloga/o o con alguien de confianza. No tenés que resolverlo sin ayuda.</p></div>`;
}
function cargarDocs() {
  Docs.listar().then(ds => {
    const box = $('docs'); if (!box) return;
    box.innerHTML = ds.length ? ds.map(d => `<div class="item" style="cursor:default"><span class="ico">📄</span><span class="txt">
      <span class="t1" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.nombre)}</span>
      <span class="t2" style="display:block">${(d.tam / 1048576).toFixed(1)} MB · ${fCorta(d.fecha)}</span></span>
      <button type="button" class="btn chico" data-a="docAbrir" data-id="${esc(d.id)}">Abrir</button>
      <button type="button" class="btn chico peligro" data-a="docBorrar" data-id="${esc(d.id)}" aria-label="Borrar ${esc(d.nombre)}">${UI.borrar === 'doc-' + d.id ? '¿Seguro?' : '✕'}</button></div>`).join('')
      : 'Todavía no agregaste documentos.';
  }).catch(() => { const box = $('docs'); if (box) box.textContent = 'No se pudieron leer los documentos en este navegador.'; });
}
function pintarPausa() {
  const i = UI.paso, p = PAUSA[i];
  abrirModal(`<div class="modal-top"><div class="peq mu">Paso ${i + 1} de ${PAUSA.length}</div><button type="button" class="btn chico" data-a="cerrarModal">Cerrar</button></div>
    <div class="tit" style="font-size:21px">${esc(p.t)}</div><p style="margin:8px 0;line-height:1.55">${esc(p.d)}</p>
    ${i === 1 ? '<div class="respira" aria-hidden="true">Respirá</div>' : ''}
    <div class="grid2" style="margin-top:16px"><button type="button" class="btn" data-a="pasoAnt" ${i ? '' : 'disabled'}>‹ Anterior</button>
    ${i < PAUSA.length - 1 ? '<button type="button" class="btn pri" data-a="pasoSig">Siguiente ›</button>' : '<button type="button" class="btn pri" data-a="pausaAnotar">Anotar el momento</button>'}</div>`);
}
function guardarMomento() {
  const f = UI.mForm;
  if (!UI.emo && !f.sit.trim()) { toast('Anotá al menos qué estaba pasando o qué sentías'); return; }
  const d = new Date();
  E().momentos.push({ id: Store.uid('m'), fecha: Store.hoy(), hora: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
    situacion: f.sit.trim(), emocion: UI.emo, intensidad: f.int, accion: f.acc.trim() });
  if (guardar()) { UI.mForm = { sit: '', acc: '', int: 5 }; UI.emo = ''; render(); toast('Anotado 💛'); }
}

// ── AJUSTES ──
function rAjustes() {
  const p = E().prefs;
  const tog = (k, txt, sub) => `<div class="row between" style="padding:6px 0;gap:12px"><div><div>${txt}</div>${sub ? `<div class="peq mu">${sub}</div>` : ''}</div>
    <button type="button" class="btn chico ${p[k] ? 'pri' : ''}" role="switch" aria-checked="${!!p[k]}" aria-label="${txt}" data-a="pref" data-k="${k}">${p[k] ? 'Sí' : 'No'}</button></div>`;
  return `<div class="sec"><button type="button" class="btn chico ghost" data-a="ir" data-v="${['ajustes', 'resumen'].includes(PREV) ? 'entrenar' : PREV}">‹ Volver</button>
    <div class="lbl">Copia de seguridad</div><div class="cd"><div class="peq mu" style="margin-bottom:10px">${E().ultimoBackup ? 'Última copia: ' + fFecha(E().ultimoBackup) + '.' : 'Todavía no hiciste ninguna copia.'} Los datos viven sólo en este iPhone: si se borran los datos de Safari, se pierden.</div>
    <div class="grid2"><button type="button" class="btn pri" data-a="exportar">⬇ Exportar</button><label class="btn">⬆ Importar<input type="file" accept=".json,application/json" class="sr" data-in="importar"></label></div>
    ${Store.hayRescate() ? '<button type="button" class="btn chico ghost" style="margin-top:8px" data-a="rescate">Descargar copia de rescate</button>' : ''}</div>
    <div class="lbl">Versión anterior</div><div class="cd"><div class="peq mu" style="margin-bottom:10px">Busca entrenamientos, registros y documentos de la V1 guardados en este iPhone. Si ya los importaste, no se duplican.</div>
    <button type="button" class="btn full" data-a="buscarV1">🔎 Buscar datos de la V1</button></div>
    <div class="lbl">Entrenamiento</div><div class="cd">
    <label class="row between" style="padding:6px 0"><span>Peso de la barra (kg)</span><input class="inp mini" type="text" inputmode="decimal" value="${p.barra}" data-in="barra"></label>
    ${tog('sonido', 'Sonido al terminar el descanso', 'No suena si el iPhone está en silencio')}
    ${tog('vibrar', 'Vibración', 'Sólo en teléfonos que lo permiten')}
    ${tog('pantalla', 'Pantalla encendida mientras entrenás', 'Usa un poco más de batería')}</div>
    <div class="lbl">Acerca de</div><div class="cd peq mu">Mi Gym v${APP_VERSION} · ${E().sesiones.length} entrenamientos guardados. Las sugerencias de peso siguen la progresión lineal de Starting Strength; tu entrenador siempre tiene la última palabra.</div>
    <div class="lbl">Zona peligrosa</div><button type="button" class="btn peligro full" data-a="borrarTodo">${UI.borrar === 'todo' ? '¿Seguro? Se borra TODO. Tocá de nuevo' : 'Borrar todos los datos'}</button></div>`;
}
async function importarV1(f) {
  const r = (f.sesiones.length || f.momentos.length) ? Store.aplicarV1(f) : { n: 0, nm: 0 };
  let n = 0;
  try { n = await Docs.importarV1(); } catch (e) {}
  if (!r) { alert('No se pudo guardar: el almacenamiento está lleno.'); render(); return; }
  E().migradoV1 = true; guardar();
  alert(r.n || r.nm || n ? `Listo: ${r.n} entrenamientos, ${r.nm} registros y ${n} documentos importados.`
    : 'No encontré datos nuevos de la V1 en este iPhone. Podés importar la copia exportada con ⬆ Importar.');
  render();
}

// ── eventos (un solo escuchador para toda la app) ──
document.addEventListener('click', ev => {
  if (ev.target.classList && ev.target.classList.contains('modal-bg')) { cerrarModal(); return; }
  const b = ev.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const d = b.dataset, a = E().activa, i = Number(d.i), k = Number(d.k);
  switch (d.a) {
    case 'ir': ir(d.v); break;
    case 'okProblema': Store.limpiarProblema(); render(); break;
    case 'v1Si': { const f = UI.v1; UI.v1 = null; importarV1(f); break; }
    case 'v1No': UI.v1 = null; E().migradoV1 = true; guardar(); render(); break;
    case 'exportar': Store.exportar(); render(); toast('Copia lista: guardala en Archivos o mandátela'); break;
    case 'backupLuego': UI.ocultarBackup = true; render(); break;
    case 'iniciar': iniciar(d.id); break;
    case 'abrirEj': case 'irEj': if (a) { a.idx = i; guardar(); render(); irA('ej-' + i); } break;
    case 'tecnica': abrirTecnica(d.id); break;
    case 'cambiar': abrirPicker('cambiar', i); break;
    case 'calent': UI.calent.has(i) ? UI.calent.delete(i) : UI.calent.add(i); render(); break;
    case 'tick': tick(i, Number(d.j)); break;
    case 'masSerie': { const e = a.ej[i], u = e.sets[e.sets.length - 1] || {}; e.sets.push({ kg: u.kg ?? null, reps: u.reps ?? null, ok: false, ts: 0 }); guardar(); render(); break; }
    case 'menosSerie': if (a.ej[i].sets.length > 1) { a.ej[i].sets.pop(); guardar(); render(); } break;
    case 'molestia': a.ej[i].molestia = d.m; guardar(); render(); break;
    case 'cancelar': if (confirmar2('cancelar')) { E().activa = null; guardar(); cerrarTimer(); soltarPantalla(); UI.calent.clear(); render(); } break;
    case 'terminar': terminar(); break;
    case 'guardarSes': guardarSesion(); break;
    case 'timer30': if (TIMER) { TIMER.fin += 30000; if (TIMER.fin > Date.now()) { TIMER.listo = false; const p = document.querySelector('.timer-pill'); if (p) p.classList.remove('fin'); } tickTimer(); } break;
    case 'timerX': cerrarTimer(); break;
    case 'editar': UI.rutinaEd = d.id; ir('editar'); break;
    case 'nuevaRutina': { const id = Store.uid('r'); E().rutinas.push({ id, nombre: 'Nueva rutina', sub: '', n: '', cardio: false, items: [] }); guardar(); UI.rutinaEd = id; ir('editar'); break; }
    case 'plantillas': modalPlantillas(); break;
    case 'plantAgregar': {
      const nuevas = JSON.parse(JSON.stringify(PLANTILLAS[d.k].rutinas));
      for (const r of nuevas) if (E().rutinas.some(x => x.id === r.id)) r.id = r.id + '-' + Store.uid('').slice(-5);
      E().rutinas.push(...nuevas); guardar(); cerrarModal(); ir('rutinas'); toast('Rutinas agregadas'); break;
    }
    case 'plantReemplazar':
      if (confirm('Se reemplazan todas tus rutinas por esta plantilla. Tu historial no se toca. ¿Seguir?')) {
        E().rutinas = JSON.parse(JSON.stringify(PLANTILLAS[d.k].rutinas)); guardar(); cerrarModal(); ir('rutinas'); toast('Rutinas reemplazadas');
      } break;
    case 'itemUp': case 'itemDown': {
      const r = rutinaEd(), m = d.a === 'itemUp' ? k - 1 : k + 1;
      if (r && r.items[m]) { [r.items[k], r.items[m]] = [r.items[m], r.items[k]]; guardar(); render(); } break;
    }
    case 'itemDel': { const r = rutinaEd(); if (r) { r.items.splice(k, 1); guardar(); render(); } break; }
    case 'agregarEj': abrirPicker('agregar'); break;
    case 'borrarRutina': if (confirmar2('rutina')) { E().rutinas = E().rutinas.filter(r => r.id !== UI.rutinaEd); guardar(); ir('rutinas'); } break;
    case 'pickFiltro': UI.pick.filtro = d.k; pintarPicker(); break;
    case 'pickElegir': elegir(d.id); break;
    case 'cerrarModal': cerrarModal(); break;
    case 'gFiltro': UI.filtro = d.k; render(); break;
    case 'sesToggle': UI.sesAbierta = UI.sesAbierta === d.id ? null : d.id; render(); break;
    case 'sesBorrar': if (confirmar2('ses-' + d.id)) { E().sesiones = E().sesiones.filter(s => s.id !== d.id); guardar(); render(); toast('Entrenamiento borrado'); } break;
    case 'pausa': UI.paso = 0; pintarPausa(); break;
    case 'pasoSig': UI.paso = Math.min(PAUSA.length - 1, UI.paso + 1); pintarPausa(); break;
    case 'pasoAnt': UI.paso = Math.max(0, UI.paso - 1); pintarPausa(); break;
    case 'pausaAnotar': cerrarModal(); ir('lectura'); setTimeout(() => { const el = $('m-sit'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 60); break;
    case 'emo': UI.emo = UI.emo === d.k ? '' : d.k; render(); break;
    case 'guardarMomento': guardarMomento(); break;
    case 'momBorrar': if (confirmar2('mom-' + d.id)) { E().momentos = E().momentos.filter(m => m.id !== d.id); guardar(); render(); } break;
    case 'docAbrir': Docs.abrir(d.id).then(ok => { if (!ok) toast('No encontré el documento'); }).catch(() => toast('No se pudo abrir')); break;
    case 'docBorrar': if (confirmar2('doc-' + d.id)) Docs.borrar(d.id).then(() => { cargarDocs(); toast('Documento borrado'); }); break;
    case 'rescate': Store.descargarRescate(); break;
    case 'buscarV1': importarV1(Store.buscarV1()); break;
    case 'pref': E().prefs[d.k] = !E().prefs[d.k]; guardar(); if (d.k === 'pantalla') E().prefs.pantalla ? pedirPantalla() : soltarPantalla(); render(); break;
    case 'borrarTodo': if (confirmar2('todo')) { Store.reiniciar(); cerrarTimer(); soltarPantalla(); UI.resumen = null; ir('entrenar'); toast('Datos borrados'); } break;
  }
});
document.addEventListener('input', ev => {
  const el = ev.target, key = el.dataset && el.dataset.in;
  if (!key) return;
  const a = E().activa, i = Number(el.dataset.i), j = Number(el.dataset.j), k = Number(el.dataset.k), r = rutinaEd();
  switch (key) {
    case 'kg': case 'reps': {
      const e = a && a.ej[i]; if (!e || !e.sets[j]) return;
      const val = el.value.trim() === '' ? null : leerNum(el.value);
      if (key === 'kg') {
        const old = e.sets[j].kg; e.sets[j].kg = val;
        // Copia el peso a las series siguientes que no tocaste
        for (let m = j + 1; m < e.sets.length; m++) {
          const s = e.sets[m];
          if (!s.ok && (s.kg === old || s.kg == null)) { s.kg = val; const inp = document.querySelector(`[data-in="kg"][data-i="${i}"][data-j="${m}"]`); if (inp) inp.value = val ?? ''; }
        }
      } else e.sets[j].reps = val;
      guardar(); break;
    }
    case 'nota': if (a && a.ej[i]) { a.ej[i].nota = el.value; guardar(); } break;
    case 'notasSes': if (a) { a.notas = el.value; guardar(); } break;
    case 'rNom': if (r) { r.nombre = el.value.slice(0, 30) || 'Rutina'; guardar(); } break;
    case 'rSub': if (r) { r.sub = el.value.slice(0, 60); guardar(); } break;
    case 'rN': if (r) { r.n = el.value.slice(0, 300); guardar(); } break;
    case 'itS': { const v = parseInt(el.value, 10); if (r && r.items[k] && v >= 1 && v <= 10) { r.items[k].s = v; guardar(); } break; }
    case 'itR': if (r && r.items[k] && el.value.trim()) { r.items[k].r = el.value.trim().slice(0, 12); guardar(); } break;
    case 'itD': { const v = parseInt(el.value, 10); if (r && r.items[k] && v >= 0 && v <= 600) { r.items[k].d = v; guardar(); } break; }
    case 'itN': if (r && r.items[k]) { r.items[k].n = el.value.slice(0, 200); guardar(); } break;
    case 'gBusca': UI.busca = el.value; $('g-lista').innerHTML = listaGuias(); break;
    case 'pBusca': UI.pick.busca = el.value; $('pick-lista').innerHTML = listaPicker(); break;
    case 'mSit': UI.mForm.sit = el.value; break;
    case 'mAcc': UI.mForm.acc = el.value; break;
    case 'mInt': UI.mForm.int = Number(el.value); $('m-int-v').textContent = el.value; break;
    case 'barra': { const v = leerNum(el.value); if (v > 0) { E().prefs.barra = v; guardar(); } break; }
  }
});
document.addEventListener('change', ev => {
  const el = ev.target, key = el.dataset && el.dataset.in;
  if (!key) return;
  if (key === 'ejProg') { UI.ejProg = el.value; render(); }
  else if (key === 'importar') {
    const f = el.files[0]; el.value = '';
    if (f) Store.importar(f).then(r => { alert(r.msg); render(); });
  } else if (key === 'docAdd') {
    const f = el.files[0]; el.value = '';
    if (f) Docs.agregar(f).then(() => { cargarDocs(); toast('Documento agregado'); }).catch(() => toast('No se pudo guardar el documento (¿falta espacio?)'));
  }
});
document.addEventListener('touchstart', initAC, { passive: true });
document.addEventListener('click', initAC);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pedirPantalla(); tickTimer(); } });
$('btn-ajustes').addEventListener('click', () => ir('ajustes'));
setInterval(() => { const r = $('reloj'); if (r && E().activa) r.textContent = mmss((Date.now() - E().activa.inicio) / 1000); }, 1000);

// ── arranque ──
Store.cargar();
if (!E().migradoV1) { const f = Store.buscarV1(); if (f.sesiones.length || f.momentos.length) UI.v1 = f; }
render();
if (E().activa) { pedirPantalla(); toast('Retomaste tu entrenamiento sin terminar'); }
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
