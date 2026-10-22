/* app.js — интерфейс веб-утилиты «Электропривод: ЛР 1–6» */
(function () {
  'use strict';
  const D = window.LABDATA, L = window.LABS, NC = window.NC, G = window.MATGEN, CH = window.CHARTS, DG = window.DIAG;
  const fnum = L.fnum;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const LABS_META = [
    { id: 'data', no: '0', short: 'Данные', t: 'Исходные данные', s: 'Параметры, элементы, методика, отчёт' },
    { id: 'lr1', no: '1', short: 'Элементы', t: 'Выбор и расчёт элементов ЭП', s: 'Двигатель, ТП, ТГ, ВТ' },
    { id: 'lr2', no: '2', short: 'Нескорр. КС', t: 'Нескорректированный контур скорости', s: 'Установившиеся ошибки' },
    { id: 'lr3', no: '3', short: 'ПИД РС', t: 'Оптимизация контура скорости', s: 'ПИД-регулятор, оптимум по модулю' },
    { id: 'lr4', no: '4', short: 'Цифровой РС', t: 'Цифровой регулятор скорости', s: 'bilinear, tf2ss, ЛПЧХ, CoDeSys' },
    { id: 'lr5', no: '5', short: 'Аналог. РП', t: 'Синтез регулятора положения', s: 'Графоаналитический метод, ν = 2 и 1' },
    { id: 'lr6', no: '6', short: 'Цифровой РП', t: 'Программная реализация РП', s: 'Аналитический синтез, ЦАСУЭП' }
  ];
  const TITLES = {
    lr1: 'Выбор и расчёт элементов электропривода', lr2: 'Исследование нескорректированного контура скорости',
    lr3: 'Оптимизация контура скорости', lr4: 'Программная реализация цифрового регулятора скорости и моделирование контура скорости',
    lr5: 'Синтез аналогового регулятора положения (графоаналитический метод)', lr6: 'Программная реализация регулятора положения'
  };

  /* ---------------- состояние ---------------- */
  const S = { P: null, R: null, sims: {}, tab: 'data', err: null, T: null };
  const T_DEF = {
    org: 'МИНОБРНАУКИ РОССИИ\nФедеральное государственное бюджетное образовательное учреждение\nвысшего образования\n«Казанский национальный исследовательский технологический университет»\n(ФГБОУ ВО «КНИТУ»)',
    dept: '', discipline: 'Системы автоматизированного проектирования', kind: 'лабораторной работе', kindPlural: 'лабораторным работам',
    group: '741-15', student: '', teacher: 'Малев Н. А.', city: 'Казань', year: String(new Date().getFullYear()),
    logo: true, explain: true, listings: false, readable: true, watermark: true, codePlain: true, eqNum: false, line1: false
  };
  function loadT() { let t = null; try { t = JSON.parse(localStorage.getItem('ep-title') || 'null'); } catch (e) { t = null; } S.T = Object.assign({}, T_DEF, t || {}); if (S.T.discipline === 'Системы управления электроприводов' || S.T.discipline === 'Конструирование роботов и робототехнических систем') S.T.discipline = T_DEF.discipline; }
  function saveT() { try { localStorage.setItem('ep-title', JSON.stringify(S.T)); } catch (e) { /* ignore */ } autoSave(); }
  function save() { try { localStorage.setItem('ep-lr-state', JSON.stringify({ P: S.P, tab: S.tab })); } catch (e) { /* хранилище недоступно */ } autoSave(); }
  /* автосохранение: снимок после каждого изменения (с задержкой); загрузка слота его не перезаписывает */
  let autoTimer = null;
  function autoSave(now) {
    if (S.skipAuto) { S.skipAuto = false; return; }
    clearTimeout(autoTimer);
    const run = () => {
      if (!S.P || !S.T) return;
      try { localStorage.setItem('ep-autosave', JSON.stringify({ name: 'Автосохранение', at: Date.now(), mo: S.R && S.R.lr1 ? S.R.lr1.mo.type : '', tab: S.tab, P: S.P, T: S.T })); } catch (e) { return; }
      const row = $('#slot-auto'); if (row) row.outerHTML = autoRowHtml(), bindAuto();
    };
    if (now) run(); else autoTimer = setTimeout(run, 1200);
  }
  function load() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem('ep-lr-state') || 'null'); } catch (e) { st = null; }
    const h = (location.hash || '').match(/^#v(\d+)(?:-(lr\d|data))?(?:&s=([\w-]+))?$/);
    if (h && h[3]) {   // ссылка «поделиться»: вариант + все правки
      const v = Math.min(222, Math.max(1, +h[1]));
      let diff = {}; try { diff = JSON.parse(decodeURIComponent(escape(atob(h[3].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { diff = {}; }
      S.P = Object.assign(L.fromVariant(v), diff); S.tab = h[2] || 'data'; S.shared = true;
    } else if (h) {
      const v = Math.min(222, Math.max(1, +h[1]));
      S.P = (st && st.P && st.P.variant === v) ? Object.assign(L.defaults(), st.P) : L.fromVariant(v);
      S.tab = h[2] || (st && st.tab) || 'data';
    } else if (st && st.P) { S.P = Object.assign(L.defaults(), st.P); S.tab = st.tab || 'data'; }
    else { S.P = L.fromVariant(1); S.tab = 'data'; }
  }
  function setHash() { try { history.replaceState(null, '', '#v' + S.P.variant + '-' + S.tab); } catch (e) { /* ignore */ } }

  function recompute() {
    try { S.R = L.compute(S.P); S.err = null; }
    catch (e) { console.error(e); S.err = e; }
    S.sims = {};
    save(); setHash();
    renderTop();
    renderTab();
  }

  /* ---------------- KaTeX ---------------- */
  function texify(s) { return String(s).replace(/_\{(max|min)\}/g, '_{\\mathrm{$1}}').replace(/([А-Яа-яЁё][А-Яа-яЁё.]*)/g, '\\text{$1}'); }
  function tex(s, display) {
    try { return katex.renderToString(texify(s), { displayMode: !!display, throwOnError: false, strict: 'ignore', output: 'html' }); }
    catch (e) { return '<code>' + esc(s) + '</code>'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  const pw = v => String(v === undefined || v === null ? '' : v).replace(/·10\^(-?\d+)/g, (m, e) => '·10<sup>' + e.replace('-', '−') + '</sup>');
  function cell(c) { c = pw(c); return /[_^{\\]/.test(c) && !/</.test(c) ? tex(c.replace(/Ω/g, '\\Omega').replace(/ε/g, '\\varepsilon').replace(/η/g, '\\eta').replace(/Δα/g, '\\Delta\\alpha').replace(/α/g, '\\alpha')) : c; }

  /* ---------------- шапка ---------------- */
  function renderTop() {
    const sel = $('#var-sel');
    if (sel.options.length !== 222) sel.innerHTML = D.variants.map(v => `<option value="${v.no}">${v.no}</option>`).join('');
    sel.value = S.P.variant;
    $$('nav.rail a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === S.tab ? 'page' : 'false'));
    const R = S.R;
    const foot = $('#rail-foot');
    if (R && foot) foot.innerHTML = `<b>Вариант ${S.P.variant}</b><br>${R.lr1.mo.type}, ${fnum(R.lr1.mo.P)} кВт, ${R.lr1.mo.U} В<br>i = ${fnum(R.lr1.i)} · случай <b>${R.lr1.caseA ? '«а»' : '«б»'}</b><br>T<sub>м</sub> = ${fnum(R.lr1.Tm)} с, T<sub>э</sub> = ${fnum(R.lr1.Te)} с`;
  }
  function stamp(labNo) {
    const R = S.R;
    return `<table class="stamp" aria-label="Штамп"><tr><td class="k">Работа</td><td class="v">${labNo ? 'ЛР № ' + labNo : 'Данные'}</td><td class="k">Лист</td><td class="v">${labNo} / 6</td></tr>
      <tr><td class="k">Вариант</td><td class="v">${S.P.variant}${isEdited() ? '*' : ''}</td><td class="k">Случай</td><td class="v">${R.lr1.caseA ? 'Tм ≥ 4Tэ' : 'Tм < 4Tэ'}</td></tr>
      <tr><td class="k">Двигатель</td><td class="v" colspan="3">${R.lr1.mo.type} ${fnum(R.lr1.mo.P)} кВт, ${R.lr1.mo.U} В</td></tr>
      <tr><td class="k">Редуктор</td><td class="v" colspan="3">i = ${fnum(R.lr1.i)}</td></tr></table>`;
  }
  function isEdited() {
    const v = L.fromVariant(S.P.variant);
    return ['Jn', 'Mc', 'W', 'E', 'M', 'eta', 'dAW', 'dAE'].some(k => +v[k] !== +S.P[k]);
  }

  /* ---------------- вкладки ---------------- */
  function renderTab() {
    const main = $('#main');
    if (S.err) { main.innerHTML = `<div class="sheet"><div class="sheet-body"><div class="note bad" style="margin-top:20px">Ошибка расчёта: ${esc(S.err.message)}. Проверьте исходные данные.</div></div></div>`; return; }
    if (S.tab === 'data') renderData(main);
    else renderLab(main, S.tab);
    $$('nav.rail a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === S.tab ? 'page' : 'false'));
    buildToc();
  }

  /* ---------- навигация по разделам текущей вкладки ---------- */
  function tocItems() {
    const out = [];
    $$('#main .sheet-body h2, #main .files').forEach((el, k) => {
      if (!el.id) el.id = 'sec-' + S.tab + '-' + k;
      const t = el.classList.contains('files') ? 'Файлы для MATLAB' : el.textContent.trim().replace(/\s+/g, ' ');
      const m = t.match(/^(\d+(?:\.\d+)?)\.?\s+(.*)$/);
      out.push({ id: el.id, no: m ? m[1] : '', t: m ? m[2] : t, el });
    });
    return out;
  }
  let tocList = [];
  function buildToc() {
    $$('.rail-toc').forEach(x => x.remove());
    tocList = tocItems();
    const fab = $('#toc-fab'); if (fab) fab.remove();
    const pop = $('#toc-pop'); if (pop) pop.remove();
    if (!tocList.length) return;
    const links = tocList.map(it => `<a href="#${it.id}" data-toc="${it.id}"><span class="tn">${it.no || (it.el.classList.contains('files') ? '↓' : '·')}</span><span>${esc(it.t)}</span></a>`).join('');
    const cur = $(`nav.rail a[data-tab="${S.tab}"]`);
    if (cur) cur.insertAdjacentHTML('afterend', `<div class="rail-toc" aria-label="Разделы">${links}</div>`);
    // мобильная кнопка «Разделы»
    document.body.insertAdjacentHTML('beforeend', `<button class="toc-fab" id="toc-fab" aria-expanded="false" aria-controls="toc-pop"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>Разделы</button><div class="toc-pop" id="toc-pop" hidden><div class="toc-pop-h">Разделы<button class="toc-top" data-top>↑ В начало</button></div>${links}</div>`);
    const f = $('#toc-fab'), p = $('#toc-pop');
    f.onclick = () => { const open = p.hidden; p.hidden = !open; f.setAttribute('aria-expanded', String(open)); };
    $('[data-top]', p).onclick = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); p.hidden = true; f.setAttribute('aria-expanded', 'false'); };
    $$('[data-toc]').forEach(a => a.onclick = e => {
      e.preventDefault();
      const el = document.getElementById(a.dataset.toc); if (!el) return;
      const off = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 64) + (window.innerWidth <= 960 ? 60 : 16);
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
      tocLock = a.dataset.toc; markToc(tocLock);
      p.hidden = true; f.setAttribute('aria-expanded', 'false');
    });
    spy();
  }
  // выбранный в оглавлении пункт остаётся подсвеченным, пока пользователь сам не прокрутит страницу
  let tocLock = null;
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(ev => window.addEventListener(ev, e => { if (tocLock && !(e.target.closest && e.target.closest('[data-toc]'))) { tocLock = null; } }, { passive: true }));
  function markToc(act) {
    $$('[data-toc]').forEach(a => a.classList.toggle('on', a.dataset.toc === act));
  }
  function spy() {
    if (!tocList.length) return;
    if (tocLock) { markToc(tocLock); return; }
    const lim = window.innerWidth <= 960 ? 150 : 110;
    let act = tocList[0].id;
    for (const it of tocList) { if (it.el.getBoundingClientRect().top - lim <= 0) act = it.id; else break; }
    // внизу страницы короткие последние разделы не могут дойти до верха — берём последний видимый заголовок
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      for (const it of tocList) { const r = it.el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.6 && !it.el.classList.contains('files')) act = it.id; }
    }
    markToc(act);
    const on = $('.rail-toc a.on'), box = $('nav.rail');
    if (on && box && box.scrollHeight > box.clientHeight) { const r = on.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) on.scrollIntoView({ block: 'nearest' }); }
  }
  let spyRaf = 0;
  window.addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; spy(); }); }, { passive: true });
  document.addEventListener('click', e => { const p = $('#toc-pop'); if (p && !p.hidden && !e.target.closest('#toc-pop, #toc-fab')) { p.hidden = true; const f = $('#toc-fab'); if (f) f.setAttribute('aria-expanded', 'false'); } });

  /* ---------- вкладка «Исходные данные» ---------- */
  const FIELDS = [
    ['Jn', 'J<sub>н</sub>', 'Момент инерции нагрузки', 'кг·м²'],
    ['Mc', 'M<sub>c0</sub>', 'Момент сопротивления', 'Н·м'],
    ['W', 'Ω<sub>max</sub>', 'Макс. скорость нагрузки', 'град/с'],
    ['E', 'ε<sub>max</sub>', 'Макс. ускорение нагрузки', 'град/с²'],
    ['M', 'M', 'Показатель колебательности', ''],
    ['eta', 'η', 'КПД редуктора', ''],
    ['dAW', 'Δα<sub>Ω</sub>', 'Ошибка по скорости', 'угл. мин'],
    ['dAE', 'Δα<sub>ε</sub>', 'Ошибка по ускорению', 'угл. мин'],
    ['alphaMax', 'α<sub>max</sub>', 'Макс. угол поворота вала', 'град']
  ];
  const ADV = [
    ['Uz', 'U<sub>з</sub>', 'Задание контура скорости', 'В'], ['dUw', 'ΔU<sub>Ω</sub>', 'Вход ТП (Kтп = Uном/ΔUΩ)', 'В'],
    ['Uos', 'U<sub>ос</sub>', 'Сигнал ОС по скорости', 'В'], ['Ua', 'U<sub>α</sub>', 'Сигнал ВТ при αmax', 'В'],
    ['f', 'f', 'Частота сети', 'Гц'], ['mph', 'm', 'Число фаз', ''], ['p', 'p', 'Число пульсаций', ''],
    ['gamma', 'γ', 'Угол отпирания', 'град'], ['kId', 'I<sub>d,гр</sub>/I<sub>ном</sub>', 'Граничный ток (0,1…0,2)', ''],
    ['p1', 'p<sub>(1)</sub>%', 'Допустимая 1-я гармоника', '%'], ['KI', 'K<sub>I</sub>', 'Перегрузка по току', ''],
    ['Kv', 'K<sub>в</sub>', 'Коэф. среднего тока вентиля', ''], ['Rd1', 'R<sub>д1</sub>', 'Резистор делителя', 'Ом'],
    ['Tf0', 'T<sub>ф</sub>', 'Предварительная Tф', 'с'], ['Nr', 'N', 'Отношение Tрс2/Tрс3', ''],
    ['T0', 'T<sub>0</sub>', 'Период квантования', 'с'], ['T1zh', 'T<sub>1ж</sub>', 'Для ν = 1 («auto» или число)', 'с']
  ];
  function fld(key, sym, label, unit, val, changed, hint) {
    return `<div class="fld${changed ? ' changed' : ''}"><label for="f-${key}"><span>${label}</span><span class="sym">${sym}</span></label>
      <div class="inp${unit ? " has-u" : ""}"><input id="f-${key}" data-key="${key}" inputmode="decimal" value="${esc(typeof val === "number" ? String(val).replace(".", ",") : val)}" autocomplete="off">${unit ? `<span class="unit">${unit}</span>` : ''}</div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  }
  /* единые элементы настроек: строка «название + пояснение | переключатель» */
  function optRow(title, desc, ctl) {
    const key = (ctl.match(/data-t?key="(\w+)"/) || [])[1];
    const ex = key && PV[key] ? `<div class="opt-ex" data-pv="${key}">${exHtml(key)}</div>` : '';
    return `<div class="opt${ctl.startsWith('<div class="seg"') ? ' has-seg' : ''}"><div class="opt-t"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="opt-c">${ctl}</div>${ex}</div>`;
  }
  /* «что меняется»: оба варианта настройки рядом, текущий выделен */
  function exHtml(key) {
    const d = PV[key]();
    const box = (lbl, body, on) => `<div class="ex${on ? ' on' : ''}"><div class="ex-h">${lbl}${on ? '<span>сейчас</span>' : ''}</div><div class="ex-b">${body}</div></div>`;
    if (d.table) return `<div class="ex on ex-wide"><div class="ex-b">${d.table}</div></div>`;
    if (d.items) return `<div class="ex-multi" style="--n:${d.items.length}">${d.items.map(it => box(it.l, it.body, it.on)).join('')}</div>`;
    return box(d.la, d.a, !d.b_on) + box(d.lb, d.b, d.b_on) + (d.note ? `<p class="ex-note">${d.note}</p>` : '');
  }
  function altR(patch) { try { return L.compute(Object.assign({}, S.P, patch)); } catch (e) { return S.R; } }
  const F = (t) => `<div class="ex-f">${t}</div>`;
  const TX = (t) => `<p class="ex-p">${t}</p>`;
  const PV = {
    dec() {
      const o = S.R.lr1, cur = S.P.dec === undefined ? -1 : +S.P.dec;
      const w = k => k === 1 ? 'знак' : k < 5 ? 'знака' : 'знаков';
      const f = (x, k) => k < 0 ? L.fauto(x) : L.fdec(x, k);
      const cols = [['P<sub>тр</sub>, Вт', o.Ptr], ['Ω<sub>ном</sub>, рад/с', o.me.Wn], ['R<sub>д2</sub>, Ом', o.Rd2], ['C<sub>u</sub>, В·с/рад', o.Cu]];
      return { table: `<table class="ex-tbl"><thead><tr><th>Режим</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${[-1, 1, 2, 3, 4, 5, 6].map(k => `<tr class="${k === cur ? 'on' : ''}"><td>${k < 0 ? 'Авто' : k + ' ' + w(k)}${k === cur ? ' <span>сейчас</span>' : ''}</td>${cols.map(c => `<td>${f(c[1], k)}</td>`).join('')}</tr>`).join('')}</tbody></table>` };
    },
    deg57() {
      const on = !!S.P.deg57, Ra = on ? altR({ deg57: 0 }) : S.R, Rb = on ? S.R : altR({ deg57: 57 }), W = S.P.W, E = S.P.E;
      const body = (k, r) => F(`Ω<sub>max</sub> = ${k ? W + '/57' : W + '·π/180'} = ${fnum(r.lr1.Wm, 4)} рад/с`) + F(`ε<sub>max</sub> = ${k ? E + '/57' : E + '·π/180'} = ${fnum(r.lr1.Em, 4)} рад/с²`) + TX(`Дальше: P<sub>тр</sub> = ${fnum(r.lr1.Ptr, 4)} Вт, двигатель ${r.lr1.mo.type} (${fnum(r.lr1.mo.P)} кВт)`);
      return { la: 'Точно, ×π/180', a: body(0, Ra), lb: 'Делением на 57', b: body(1, Rb), b_on: on };
    },
    roundManual() {
      const on = !!S.P.roundManual, Ra = on ? altR({ roundManual: false }) : S.R, Rb = on ? S.R : altR({ roundManual: true });
      const v = (x, r) => r ? fnum(x) : String(+x.toPrecision(6)).replace('.', ',');
      const body = (r, rr) => F(`c = ${v(r.lr1.c, rr)} В·с/рад`) + F(`T<sub>м</sub> = ${v(r.lr1.Tm, rr)} с,&nbsp; T<sub>э</sub> = ${v(r.lr1.Te, rr)} с`) + F(`K<sub>ос</sub> = ${v(r.lr1.Kos, rr)} В·с/рад`);
      return { la: 'Полная точность', a: body(Ra, false), lb: 'Округлять (как в методичке)', b: body(Rb, true), b_on: on };
    },
    roundGear() {
      const on = !!S.P.roundGear, Ra = on ? altR({ roundGear: false }) : S.R, Rb = on ? S.R : altR({ roundGear: true });
      const g = x => String(+x.toPrecision(6)).replace('.', ',');
      const ma = Ra.lr1.me, mb = Rb.lr1.me;
      const mark = (x, y) => Math.abs(x - y) > 1e-9 * Math.max(1, Math.abs(x)) ? `<mark>${g(x)}</mark>` : g(x);
      const body = (r, o) => { const me = r.lr1.me, mo = o.lr1.me; return F(`i<sub>о</sub> = ${mark(me.i0, mo.i0)}`) + (me.speedOk ? '' : F(`i<sub>1</sub> = ${mark(me.i, mo.i)}`)) + TX(`Дальше: T<sub>м</sub> = ${mark(r.lr1.Tm, o.lr1.Tm)} с, M<sub>вр</sub> = ${mark(me.Mvr, mo.Mvr)} Н·м`); };
      const iA = Ra.lr1.i, iB = Rb.lr1.i;
      const note = Math.abs(iA - iB) < 1e-6
        ? `В этом варианте принятое передаточное число i = ${g(iB)} ${ma.speedOk ? '' : '(i<sub>1</sub> = Ω<sub>ном</sub>/Ω<sub>max</sub>) '}и так целое, поэтому дальше расчёт не меняется — округляется только i<sub>о</sub>: ${g(ma.i0)} → ${g(mb.i0)}. Заметная разница появляется, когда i получается дробным (например, при переводе градусов делением на 57: i = 95,5 → 96).`
        : `Принятое i меняется: ${g(iA)} → ${g(iB)} (${(iB / iA - 1) * 100 >= 0 ? '+' : ''}${String(+((iB / iA - 1) * 100).toFixed(2)).replace('.', ',')} %), вместе с ним — T<sub>м</sub> и M<sub>вр</sub> и все последующие расчёты.`;
      return { la: 'Как рассчитано', a: body(Ra, Rb), lb: 'До целого', b: body(Rb, Ra), b_on: on, note };
    },
    eqNum() {
      const page = on => `<div class="ex-paper"><p>Коэффициент противо-ЭДС из уравнения электрического равновесия:</p><div class="ex-math">c = (U<sub>ном</sub> − I<sub>ном</sub>R)/Ω<sub>ном</sub> = 2,273 В·с/рад${on ? '<span class="ex-no">(3)</span>' : ''}</div></div>`;
      return { la: 'Без номеров (как в методичке)', a: page(false), lb: 'С номерами', b: page(true), b_on: !!S.T.eqNum };
    },
    line1() {
      const t = 'Электропривод рассчитывается по паспортным данным двигателя и параметрам нагрузки: сначала выбираются двигатель и редуктор, затем настраиваются контуры регулирования тока, скорости и положения.';
      return { la: 'Интервал 1,5', a: `<div class="ex-paper lh15"><p>${t}</p></div>`, lb: 'Интервал 1,0', b: `<div class="ex-paper lh10"><p>${t}</p></div>`, b_on: !!S.T.line1 };
    },
    logo() {
      const page = l => `<div class="ex-paper title">${l ? '<b class="ex-logo">КНИТУ</b>' : ''}<p>МИНОБРНАУКИ РОССИИ</p><p>Федеральное государственное бюджетное образовательное учреждение высшего образования</p><p>«Казанский национальный исследовательский технологический университет»</p></div>`;
      return { la: 'Без логотипа', a: page(false), lb: 'С логотипом', b: page(true), b_on: !!S.T.logo };
    },
    explain() {
      const page = e => `<div class="ex-paper">${e ? '<p>Коэффициент противо-ЭДС из уравнения электрического равновесия при номинальном режиме:</p>' : ''}<div class="ex-math">c = (U<sub>ном</sub> − I<sub>ном</sub>R)/Ω<sub>ном</sub> = 2,273 В·с/рад</div>${e ? '<p>Электромеханическая постоянная времени с учётом момента инерции нагрузки:</p>' : ''}<div class="ex-math">T<sub>м</sub> = (J<sub>дв</sub> + J<sub>н</sub>/i²)R/c² = 0,059 с</div></div>`;
      return { la: 'Только формулы', a: page(false), lb: 'С пояснениями', b: page(true), b_on: !!S.T.explain };
    },
    listings() {
      const page = l => `<div class="ex-paper">${l ? '<p class="h">Программы MATLAB</p><p class="cap">Листинг 1.1 — LR1_raschet.m</p><pre>Jn = 161;  Mc0 = 210;\nWmax = 50*pi/180;\nPtr = 2*(Jn*Emax + Mc0/eta)*Wmax;</pre>' : ''}<p class="h">Вывод</p><p>Выбран двигатель, рассчитаны параметры ТП, датчиков скорости и положения…</p></div>`;
      return { la: 'Без листингов', a: page(false), lb: 'С листингами', b: page(true), b_on: !!S.T.listings };
    },
    codePlain() {
      const code = 'x1 := 2.8788*x12 − 2.7609*x22 + dU;\nUr := −0.8017*x12 + 13.175*dU;\nout := Ur;';
      return { la: 'Courier New', a: `<div class="ex-paper"><pre class="mono">${code}</pre></div>`, lb: 'Times New Roman', b: `<div class="ex-paper"><pre class="serif">${code}</pre></div>`, b_on: !!S.T.codePlain };
    },
    watermark() {
      const fig = w => `<div class="ex-paper fig"><svg viewBox="0 0 300 110" preserveAspectRatio="none"><path d="M30 8V100H295" fill="none" stroke="#7d8996"/><path d="M30 100 L48 35 Q62 4 80 22 T120 30 T170 27 L295 27" fill="none" stroke="#0072BD" stroke-width="2"/></svg>${w ? '<div class="ex-wm"><b>Замените рисунком из MATLAB</b><span>Что вставить: переходная характеристика контура скорости.</span><span>Откуда: модель LR3_model.slx — Scope «Omega».</span></div>' : ''}<p class="cap">Рисунок 3.2 — Переходная характеристика</p></div>`;
      return { la: 'Без подложки', a: fig(false), lb: 'С подложкой', b: fig(true), b_on: !!S.T.watermark };
    },
    readable() {
      const brk = '<div class="ex-brk"><span>разрыв страницы</span></div>';
      const off = `<div class="ex-paper"><p>…конец предыдущего расчёта.</p><p class="cap">Листинг 6.1 — PLC_PRG_RP2.st</p><pre class="mono">PROGRAM PLC_PRG_RP2\nVAR_INPUT in: REAL; END_VAR</pre>${brk}<pre class="mono">x12 := x1;\nout := Ur;</pre></div>`;
      const on = `<div class="ex-paper"><p>…конец предыдущего расчёта.</p><p class="gap">свободное место</p>${brk}<p class="cap">Листинг 6.1 — PLC_PRG_RP2.st</p><pre class="mono">PROGRAM PLC_PRG_RP2\nVAR_INPUT in: REAL; END_VAR\nx12 := x1;\nout := Ur;</pre></div>`;
      return { la: 'Обычный перенос', a: off, lb: 'Блок целиком', b: on, b_on: !!S.T.readable };
    }
  };
  function refreshPv(key) { const el = $(`.opt-ex[data-pv="${key}"]`); if (el && PV[key]) el.innerHTML = exHtml(key); }
  function seg(scope, key, cur, opts, kind) {
    return `<div class="seg" role="radiogroup" data-scope="${scope}" data-key="${key}" data-kind="${kind}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" data-val="${v}">${l}</button>`).join('')}</div>`;
  }
  function sw(key) {
    return `<label class="sw"><input type="checkbox" data-tkey="${key}" ${S.T[key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">вкл.</span></label>`;
  }
  /* ---------- подсказка над блоками ССДМ ---------- */
  (function () {
    let tip = null;
    const show = (g, x, y) => {
      if (!tip) { tip = document.createElement('div'); tip.className = 'tipbox'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      const [nm, d] = g.dataset.tip.split('|');
      tip.innerHTML = `<small>Блок в Simulink</small><b>${esc(nm)}</b>${d ? `<span>${esc(d)}</span>` : ''}`;
      tip.style.display = 'block';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
      tip.style.top = (y - h - 12 < 8 ? y + 18 : y - h - 12) + 'px';
    };
    const hide = () => { if (tip) tip.style.display = 'none'; };
    document.addEventListener('mousemove', e => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) show(g, e.clientX, e.clientY); else hide(); });
    document.addEventListener('focusin', e => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) { const r = g.getBoundingClientRect(); show(g, r.left + r.width / 2, r.top); } });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
  })();
  /* ---------- ссылка «поделиться» ---------- */
  function shareUrl() {
    const base = L.fromVariant(S.P.variant), diff = {};
    for (const k of Object.keys(S.P)) if (k !== 'variant' && JSON.stringify(S.P[k]) !== JSON.stringify(base[k])) diff[k] = S.P[k];
    let h = '#v' + S.P.variant + '-' + S.tab;
    if (Object.keys(diff).length) h += '&s=' + btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.href.split('#')[0] + h;
  }
  function share() {
    const url = shareUrl();
    copyText(url, 'Ссылка скопирована: по ней откроется этот же расчёт');
  }
  /* ---------- слоты сохранений ---------- */
  const SLOT_KEY = 'ep-slots', SLOT_N = 5;
  function getSlots() { let a = null; try { a = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null'); } catch (e) { a = null; } a = Array.isArray(a) ? a : []; while (a.length < SLOT_N) a.push(null); return a.slice(0, SLOT_N); }
  function putSlots(a) { try { localStorage.setItem(SLOT_KEY, JSON.stringify(a)); return true; } catch (e) { toast('Браузер не разрешает сохранять данные на этой странице'); return false; } }
  function slotMeta(sl) {
    const d = new Date(sl.at), pad = x => String(x).padStart(2, '0');
    const mo = sl.mo ? ' · ' + esc(sl.mo) : '';
    return `Вариант ${sl.P.variant}${mo}${sl.T && sl.T.student ? ' · ' + esc(sl.T.student) : ''} · ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function getAuto() { try { return JSON.parse(localStorage.getItem('ep-autosave') || 'null'); } catch (e) { return null; } }
  function autoRowHtml() {
    const sl = getAuto();
    return `<div class="opt slot auto" id="slot-auto"><div class="opt-t"><b><i class="slot-no">А</i>Автосохранение</b><span>${sl ? slotMeta(sl) + ' · обновляется само после каждого изменения; загрузка слота его не затирает' : 'Появится после первого изменения'}</span></div><div class="opt-c slot-act">${sl ? '<button class="btn primary" id="slot-auto-load">Загрузить</button>' : ''}</div></div>`;
  }
  function bindAuto() {
    const b = $('#slot-auto-load'); if (!b) return;
    b.onclick = () => { const sl = getAuto(); if (!sl) return; S.P = Object.assign(L.defaults(), sl.P); S.T = Object.assign({}, T_DEF, sl.T || {}); S.skipAuto = true; saveT(); S.skipAuto = true; recompute(); toast('Загружено автосохранение'); };
  }
  function slotsHtml() {
    return autoRowHtml() + getSlots().map((sl, k) => `<div class="opt slot${sl ? '' : ' empty'}"><div class="opt-t"><b><i class="slot-no">${k + 1}</i>${sl ? esc(sl.name) : 'Пустой слот'}</b><span>${sl ? slotMeta(sl) : 'Сохраните сюда текущее состояние'}</span></div><div class="opt-c slot-act">
      <button class="btn" data-slot-save="${k}">${sl ? 'Перезаписать' : 'Сохранить'}</button>${sl ? `<button class="btn primary" data-slot-load="${k}">Загрузить</button><button class="btn icon-x" data-slot-del="${k}" title="Удалить" aria-label="Удалить слот ${k + 1}">✕</button>` : ''}</div></div>`).join('');
  }
  function bindSlots() {
    const box = $('#slots'); if (!box) return;
    const redraw = () => { box.innerHTML = slotsHtml(); bindSlots(); };
    bindAuto();
    $$('[data-slot-save]', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.slotSave, a = getSlots();
      const def = a[k] ? a[k].name : 'Вариант ' + S.P.variant + (S.T.student ? ' — ' + S.T.student : '');
      const name = prompt('Название сохранения', def); if (name === null) return;
      a[k] = { name: name.trim() || def, at: Date.now(), mo: S.R && S.R.lr1 ? S.R.lr1.mo.type : '', P: JSON.parse(JSON.stringify(S.P)), T: JSON.parse(JSON.stringify(S.T)) };
      if (putSlots(a)) { toast('Сохранено в слот ' + (k + 1)); redraw(); }
    });
    $$('[data-slot-load]', box).forEach(b => b.onclick = () => {
      const sl = getSlots()[+b.dataset.slotLoad]; if (!sl) return;
      autoSave(true);   // зафиксировать текущую работу перед загрузкой
      S.P = Object.assign(L.defaults(), sl.P); S.T = Object.assign({}, T_DEF, sl.T || {}); S.skipAuto = true; saveT();
      S.skipAuto = true; recompute(); toast('Загружено: ' + sl.name);
    });
    $$('[data-slot-del]', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.slotDel, a = getSlots(); if (!a[k] || !confirm('Удалить сохранение «' + a[k].name + '»?')) return;
      a[k] = null; if (putSlots(a)) redraw();
    });
    const ex = $('#slots-exp'); if (ex) ex.onclick = () => downloadText('electroprivod-sohraneniya.json', JSON.stringify({ app: 'ep-lr', ver: 1, current: { P: S.P, T: S.T }, slots: getSlots() }, null, 1));
    const im = $('#slots-imp-f'); if (im) im.onchange = () => {
      const f = im.files && im.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result); if (!j || j.app !== 'ep-lr' || !Array.isArray(j.slots)) throw new Error('fmt');
          const a = getSlots(); let n = 0;
          j.slots.forEach(sl => { if (!sl || !sl.P) return; let k = a.findIndex(x => !x); if (k < 0) return; a[k] = sl; n++; });
          if (putSlots(a)) { toast(n ? 'Импортировано сохранений: ' + n : 'Нет свободных слотов или пустой файл'); redraw(); }
        } catch (e) { toast('Это не файл сохранений утилиты'); }
        im.value = '';
      };
      rd.readAsText(f);
    };
  }
  function renderData(main) {
    const P = S.P, R = S.R, V = L.fromVariant(P.variant);
    const motorOpts = ['<option value="auto">Автоматически — ' + esc(D.motors[R.motorAuto].type + ' ' + fnum(D.motors[R.motorAuto].P) + ' кВт, ' + D.motors[R.motorAuto].U + ' В') + '</option>']
      .concat(D.motors.map(mo => { const e = L.evalMotor(mo, P); const ok = mo.P * 1000 >= R.lr1.Ptr && e.ok; return `<option value="${mo.id}">${ok ? '✓' : '·'} ${esc(mo.type)} — ${fnum(mo.P)} кВт, ${mo.U} В, ${mo.n} об/мин</option>`; }));
    const capOpts = () => ['<option value="auto">Автоматически</option>'].concat(D.caps.map(c => `<option value="${c}">${fnum(c)} мкФ</option>`)).join('');
    const vrows = D.variants.map(v => `<tr data-v="${v.no}" class="${v.no === P.variant ? 'on' : ''}"><td class="num">${v.no}</td><td class="num">${v.Jn}</td><td class="num">${v.Mc}</td><td class="num">${v.W}</td><td class="num">${v.E}</td><td class="num">${fnum(v.M)}</td><td class="num">${fnum(v.eta)}</td><td class="num">${v.dAW}</td><td class="num">${v.dAE}</td></tr>`).join('');
    const sel = (key, label, sym, opts) => `<div class="fld"><label for="f-${key}"><span>${label}</span>${sym ? `<span class="sym">${sym}</span>` : ''}</label><select id="f-${key}" data-key="${key}">${opts}</select></div>`;
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">Система исходных данных · табл. П.8</div><h1>Вариант ${P.variant}</h1>
        <p class="lead">Выберите вариант вверху страницы — все шесть работ пересчитаются автоматически. Любое значение можно изменить: изменённые поля подсвечиваются.</p></div>
        ${stamp(0)}
      </header>
      <div class="sheet-body rep data-page">
        <section class="dsec">
          <h2>1. Параметры варианта</h2>
          <div class="form-grid fg4">${FIELDS.map(f => fld(f[0], f[1], f[2], f[3], P[f[0]], f[0] in V && +V[f[0]] !== +P[f[0]] || (f[0] === 'alphaMax' && +P.alphaMax !== 20))).join('')}</div>
          <p class="dhint">α<sub>max</sub> в табл. П.8 нет: в примерах методички принято 20° и 10°. Если угол задан преподавателем — введите его.</p>
          <div class="dact"><button class="btn" id="reset-var">Сбросить к варианту ${P.variant}</button><button class="btn" id="go-lr1">Перейти к ЛР № 1 →</button></div>
          <details class="adv"><summary>Таблица П.8 — все 222 варианта (щелчок по строке выбирает вариант)</summary><div class="in"><div class="tbl var-table"><table><thead><tr><th class="num">№</th><th class="num">Jн</th><th class="num">Mc</th><th class="num">Ωmax</th><th class="num">εmax</th><th class="num">M</th><th class="num">η</th><th class="num">ΔαΩ</th><th class="num">Δαε</th></tr></thead><tbody>${vrows}</tbody></table></div></div></details>
        </section>
        <section class="dsec">
          <h2>2. Выбор элементов</h2>
          <p class="dlead">По умолчанию элементы подбираются по методике автоматически. Выберите вручную, если нужно совпасть с примером методички или с расчётом преподавателя. Знак ✓ — двигатель проходит все проверки.</p>
          <div class="form-grid fg3">
            ${sel('motor', 'Двигатель', 'табл. П.1', motorOpts.join(''))}
            ${sel('tach', 'Тахогенератор', 'табл. П.4', D.tachs.map((t, k) => `<option value="${k}">${t.name} — ${fnum(t.Cu)} мВ/(об/мин), ${t.n} об/мин</option>`).join(''))}
            ${sel('vt', 'Вращающийся трансформатор', 'табл. П.7', D.vts.map((t, k) => `<option value="${k}">${t.name} — ${t.U} В, ${t.f} Гц</option>`).join(''))}
            ${sel('C2', 'Конденсатор C2 регулятора', 'T<sub>рс1</sub> = R3·C2', capOpts())}
            ${sel('C1', 'Конденсатор C1 регулятора', 'T<sub>рс2</sub> = R2·C1', capOpts())}
          </div>
        </section>
        <section class="dsec set set-calc" data-set="настройки расчёта">
          <h2>3. Методика расчёта</h2>
          <p class="dlead">Как переводить и округлять величины. Вариант «как в методичке» воспроизводит её приближённые числа, точный — даёт полную точность.</p>
          <div class="opts">
            ${optRow('Точность вывода чисел', '«Авто» — 4 значащие цифры, целая часть не округляется (114,3; 0,06162; 12356). Цифра — фиксированное число знаков после запятой. На сам расчёт не влияет.', seg('P', 'dec', P.dec === undefined ? -1 : +P.dec, [[-1, 'Авто'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], 'num'))}
            ${optRow('Перевод градусов в радианы', 'Для Ω<sub>max</sub>, ε<sub>max</sub>, α<sub>max</sub> и пересчёта ошибок в угловые минуты.', seg('P', 'deg57', P.deg57 ? 57 : 0, [[0, 'Точно, ×π/180'], [57, 'Делением на 57']], 'num'))}
            ${optRow('Промежуточные параметры', 'c, T<sub>м</sub>, T<sub>э</sub>, T<sub>тп</sub>, K<sub>ос</sub>, T<sub>ф</sub>… — до 0,001; параметры регуляторов — до 3 значащих цифр.', seg('P', 'roundManual', !!P.roundManual, [[false, 'Полная точность'], [true, 'Округлять']], 'bool'))}
            ${optRow('Передаточное число редуктора', 'В примерах методички округляется до целого: i = 69, i = 882.', seg('P', 'roundGear', !!P.roundGear, [[false, 'Как рассчитано'], [true, 'До целого']], 'bool'))}
          </div>
          <details class="adv"><summary>Константы методики (ТП, датчики, регуляторы)</summary><div class="in"><div class="form-grid">${ADV.map(f => fld(f[0], f[1], f[2], f[3], P[f[0]], +L.defaults()[f[0]] !== +P[f[0]] && !(f[0] === 'T1zh' && P.T1zh === 'auto'))).join('')}</div>
            <p class="dhint">По умолчанию — значения из примеров методички: γ = 30°, I<sub>d,гр</sub> = 0,2·I<sub>ном</sub>, p<sub>(1)</sub> = 10 %, K<sub>I</sub> = 2,5, K<sub>в</sub> = 0,33, R<sub>д1</sub> = 10 кОм, T<sub>ф</sub> = 0,01 с, N = 10, T<sub>0</sub> = 0,001 с.</p></div></details>
        </section>
        <section class="dsec set set-rep" data-set="настройки отчёта">
          <h2>4. Отчёт и файлы</h2>
          <h3>Титульный лист</h3>
          <div class="form-grid fg4">
            ${tfld('student', 'Студент (Ф. И. О.)', 'Иванов И. И.')}${tfld('group', 'Группа', '741-15')}${tfld('teacher', 'Проверил', 'Малев Н. А.')}${tfld('discipline', 'Дисциплина', '')}
            ${tfld('dept', 'Институт / кафедра', 'необязательно')}${tfld('city', 'Город', 'Казань')}${tfld('year', 'Год', '')}
          </div>
          <div class="fld"><label for="t-org"><span>Шапка титульного листа (каждая строка — отдельный абзац)</span></label><textarea id="t-org" data-tkey="org" rows="5">${esc(S.T.org)}</textarea></div>
          <div class="opts">${optRow('Логотип КНИТУ', 'Над шапкой титульного листа.', sw('logo'))}</div>
          <h3>Содержание и оформление</h3>
          <div class="opts">
            ${optRow('Пояснения к формулам', 'Перед каждой формулой — что считается и зачем.', sw('explain'))}
            ${optRow('Листинги программ MATLAB', 'Скрипты работы в конце раздела «Ход работы».', sw('listings'))}
            ${optRow('Шрифт программного кода', 'Листинги MATLAB и CoDeSys.', seg('T', 'codePlain', !!S.T.codePlain, [[true, 'Times New Roman'], [false, 'Courier New']], 'bool'))}
            ${optRow('Подложка на рисунках', '«Замените рисунком из MATLAB» — что и откуда вставить.', sw('watermark'))}
            ${optRow('Номера формул', 'Сквозные номера (1), (2)… у правого края строки — не путаются со ссылками на формулы методички вида (1.11). Выключено — без номеров, как в методичке.', sw('eqNum'))}
            ${optRow('Межстрочный интервал', 'Основной текст отчёта; титульный лист не меняется.', seg('T', 'line1', !!S.T.line1, [[false, '1,5'], [true, '1,0']], 'bool'))}
            ${optRow('Улучшение читаемости', 'Не разрывать абзацы, списки, листинги и пояснение с формулой между страницами.', sw('readable'))}
          </div>
          <h3>Скачать</h3>
          <div class="dl-grid"><button class="btn primary dl-all" data-docx="all">${dlIcon()} Единый отчёт по ЛР 1–6 (.docx)</button>${[1, 2, 3, 4, 5, 6].map(k => `<button class="btn" data-docx="lr${k}">${dlIcon()} ЛР № ${k}</button>`).join('')}</div>
          <p class="dhint">Единый отчёт — общий титульный лист, каждая работа с новой страницы; отдельные — по одному на работу.</p>
          <div class="dact"><button class="btn" id="zip-all">${dlIcon()} Архив ЛР 1–6 (.zip)</button></div>
          <p class="dhint">Архив: все скрипты MATLAB и программы CoDeSys по работам, отчёты Word (отдельные и единый), полный расчёт в HTML, графики PNG и данные CSV.</p>
        </section>
        <section class="dsec set set-saves" data-set="сохранения">
          <h2>5. Сохранения</h2>
          <p class="dlead">Текущее состояние запоминается автоматически и восстанавливается при следующем открытии сайта; отдельно ведётся автосохранение — к нему можно вернуться, если загрузили не тот слот. Чтобы держать несколько наборов (например, свой вариант и вариант одногруппника), сохраните их в слоты: в слот попадают все параметры, выбранные элементы, методика расчёта и данные отчёта.</p>
          <div class="opts slots" id="slots">${slotsHtml()}</div>
          <div class="dact"><button class="btn" id="share2">${LINK_ICON} Скопировать ссылку на расчёт</button><button class="btn" id="slots-exp">${dlIcon()} Экспорт в файл</button><label class="btn" for="slots-imp-f">Импорт из файла</label><input type="file" id="slots-imp-f" accept=".json,application/json" hidden></div>
          <p class="dhint">Ссылка содержит вариант и все ваши правки (элементы, методику, константы) — по ней одногруппник откроет ровно этот расчёт; данные титульного листа в ссылку не попадают. Та же кнопка есть в шапке сайта. Слоты хранятся только в этом браузере на этом устройстве. Чтобы перенести их на другое устройство или не потерять при очистке браузера, сохраните файл экспорта.</p>
        </section>
      </div></article>`;
    bindSlots();
    $('#zip-all').onclick = e => zipAll(e.currentTarget);
    $('#share2').onclick = share;
    $('#f-motor').value = String(P.motor); $('#f-tach').value = String(P.tach); $('#f-vt').value = String(P.vt);
    $('#f-C1').value = String(P.C1); $('#f-C2').value = String(P.C2);
    $$('#main input[data-key], #main select[data-key]').forEach(el => el.addEventListener('change', onField));
    $$('#main .seg button').forEach(b => b.onclick = () => {
      const g = b.parentElement, raw = b.dataset.val, v = g.dataset.kind === 'bool' ? raw === 'true' : +raw;
      $$('button', g).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      if (g.dataset.scope === 'P') { S.P[g.dataset.key] = v; recompute(); } else { S.T[g.dataset.key] = v; saveT(); refreshPv(g.dataset.key); }
    });
    $('#reset-var').onclick = () => { S.P = L.fromVariant(S.P.variant); recompute(); };
    $('#go-lr1').onclick = () => go('lr1');
    $$('#main [data-tkey]').forEach(el => el.addEventListener('change', () => { S.T[el.dataset.tkey] = el.type === 'checkbox' ? el.checked : el.value; saveT(); refreshPv(el.dataset.tkey); }));
    $$('#main [data-docx]').forEach(b => b.onclick = () => makeDocx(b.dataset.docx === 'all' ? ['lr1', 'lr2', 'lr3', 'lr4', 'lr5', 'lr6'] : [b.dataset.docx], b));
    $$('.var-table tr[data-v]').forEach(tr => tr.onclick = () => setVariant(+tr.dataset.v));
  }
  function tfld(key, label, ph) {
    return `<div class="fld"><label for="t-${key}"><span>${label}</span></label><input id="t-${key}" data-tkey="${key}" value="${esc(S.T[key] || '')}" placeholder="${esc(ph)}" autocomplete="off" class="txt"></div>`;
  }
  function onField(e) {
    const el = e.target, k = el.dataset.key;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.tagName === 'SELECT') v = el.value === 'auto' ? 'auto' : +el.value;
    else {
      const raw = el.value.trim().replace(',', '.');
      if (k === 'T1zh' && (raw === '' || raw.toLowerCase() === 'auto' || raw.toLowerCase() === 'авто')) v = 'auto';
      else { v = parseFloat(raw); if (!isFinite(v)) { toast('Введите число'); el.value = S.P[k]; return; } }
      if (k === 'M' && v <= 1) { toast('Показатель колебательности должен быть больше 1'); el.value = S.P[k]; return; }
      if (k === 'eta' && (v <= 0 || v > 1)) { toast('КПД должен быть в пределах 0…1'); el.value = S.P[k]; return; }
      if (v <= 0 && !['xa'].includes(k)) { toast('Значение должно быть положительным'); el.value = S.P[k]; return; }
    }
    S.P[k] = v;
    recompute();
  }
  function setVariant(v) { v = Math.min(222, Math.max(1, v)); const keep = {}; ['roundManual', 'roundGear', 'deg57', 'dec'].forEach(k => keep[k] = S.P[k]); S.P = Object.assign(L.fromVariant(v), keep); recompute(); }

  /* ---------- вкладки ЛР ---------- */
  function kpis(tab) {
    const R = S.R, o = R.lr1;
    const k = (a, b, u) => `<div class="kpi"><div class="k">${a}</div><div class="v">${pw(b)}${u ? ' <small>' + u + '</small>' : ''}</div></div>`;
    switch (tab) {
      case 'lr1': return k('Pтр', fnum(o.Ptr / 1000), 'кВт') + k('Двигатель', o.mo.type.replace('УХЛ4', '')) + k('i', fnum(o.i)) + k('c', fnum(o.c), 'В·с/рад') + k('Tм / Tэ', fnum(o.Tm) + ' / ' + fnum(o.Te), 'с') + k('Kтп / Tтп', fnum(o.Ktp) + ' / ' + fnum(o.Ttp)) + k('Kос / Tф', fnum(o.Kos) + ' / ' + fnum(o.Tf)) + k('Kвт', fnum(o.Kvt), 'В/рад');
      case 'lr2': return k('Δu<sub>уст</sub><sup>u</sup>', fnum(R.lr2.du_u), 'В') + k('Δu<sub>уст</sub><sup>Mc</sup>', fnum(R.lr2.du_M), 'В') + k('Δu<sub>уст</sub>', fnum(R.lr2.du_u + R.lr2.du_M), 'В') + k('Ω<sub>уст</sub>', fnum(R.lr2.Wss0), 'рад/с');
      case 'lr3': return k('Kрс', fnum(R.lr3.Krc)) + k('Tрс1 / Tрс2', fnum(R.lr3.Trc1) + ' / ' + fnum(R.lr3.Trc2), 'с') + k('Tрс3', fnum(R.lr3.Trc3), 'с') + k('TΣ', fnum(R.lr3.TS), 'с') + k('θз', fnum(R.lr3.mg3.Pm, 3), '°') + k('Lз', fnum(R.lr3.mg3.Gm, 3), 'дБ');
      case 'lr4': return k('T0', fnum(S.P.T0), 'с') + k('d1, d2', R.lr4.bz.den.slice(1).map(v => fnum(v, 5)).join('; ')) + k('θз (ЛПЧХ)', fnum(R.lr4.mg4.Pm, 3), '°') + k('Lз (ЛПЧХ)', fnum(R.lr4.mg4.Gm, 3), 'дБ');
      case 'lr5': return k('Kε', fnum(R.lr5.Ke), 'с⁻²') + k('KΩ', fnum(R.lr5.KW), 'с⁻¹') + k('ω0', fnum(R.lr5.w0), 'с⁻¹') + k('Kрп (ν = 2)', fnum(R.lr5.ap2.K)) + k('Kрп (ν = 1)', fnum(R.lr5.ap1.K)) + k('T1ж (ν = 1)', fnum(R.lr5.T1zh1), 'с');
      case 'lr6': return k('T0', fnum(S.P.T0), 'с') + k('Порядок Wрп(z)', '3 / 3') + k('D (ν = 2)', fnum(R.lr6.ss62.D[0][0], 5)) + k('D (ν = 1)', fnum(R.lr6.ss61.D[0][0], 5));
    }
    return '';
  }
  function renderItems(items, tab) {
    let h = '', fig = 0; const seen = {};
    for (const it of items) {
      switch (it.k) {
        case 'h': h += `<h2>${esc(it.t)}</h2>`; break;
        case 'p': h += `<p>${pw(it.t)}</p>`; break;
        case 'note': h += `<div class="note ${it.kind}">${pw(it.t)}</div>`; break;
        case 'tex': h += calcCard(it.t, window.EXPLAIN ? EXPLAIN.texDesc(it.t) : ''); break;
        case 'eq': {
          let s = it.lhs;
          if (it.formula) s += '=' + it.formula;
          if (it.subst) s += '=' + it.subst;
          s += '=' + L.n(it.val, it.sig) + (it.unit ? '\\ \\text{' + it.unit + '}' : '');
          let d = window.EXPLAIN ? EXPLAIN.eqDesc(it.lhs) : '';
          if (it.lhs === 'R_2' && /U_\{вых\}/.test(it.formula)) d = 'Сопротивление R2 стабилизатора LM317/LM337, задающее выходное напряжение ±15 В для питания операционных усилителей.';
          const n = seen[it.lhs] = (seen[it.lhs] || 0) + 1, ck = tab + '|' + it.lhs + '|' + n;
          CHKIDX[ck] = { tab, lhs: it.lhs, n, val: it.val, unit: it.unit || '', order: Object.keys(CHKIDX).length };
          h += calcCard(s, d, ck); break;
        }
        case 'check': h += `<div class="check ${it.ok ? '' : 'bad'}"><span class="mark">${it.ok ? '✓' : '!'}</span><div class="body">${tex(it.tex, false)}<div class="ct">${it.t || ''}</div></div></div>`; break;
        case 'table': h += `<div class="tbl"><table>${it.caption ? `<caption>${esc(it.caption)}</caption>` : ''}<thead><tr>${it.head.map(c => `<th>${cell(c)}</th>`).join('')}</tr></thead><tbody>${it.rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; break;
        case 'code': h += codeBlock(it.t, it.title, it.lang); break;
        case 'plot': fig++; h += `<figure class="fig"><div class="plot" id="p-${it.id}"><div class="plot-wait"><span><span class="spinner"></span>Моделирование…</span></div></div><figcaption><span><b>Рис. ${tab.slice(2)}.${fig}.</b> ${esc(it.title)}</span></figcaption></figure>` + (it.id === 'lr5_bode_pid' ? approxForm('pid') : it.id === 'lr5_bode_id' ? approxForm('id') : ''); break;
        case 'diagram': h += `<div class="diagram" id="d-${it.id}"><p class="dcap">${esc(it.title)}<span class="dhint-r">наведите на блок — его имя в Simulink</span></p>${diagramSvg(it.id)}</div>`; break;
        case 'simres': h += `<div class="tbl" id="s-${it.id}"><table><caption>${esc(it.title)}</caption><tbody><tr><td><span class="spinner"></span>Идёт моделирование…</td></tr></tbody></table></div>`; break;
      }
    }
    return h;
  }
  const LINK_ICON = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  let calcSeq = 0;
  const CALC = {};
  const ICON_COPY = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  function calcCard(src, desc, ck) {
    const id = 'f' + (++calcSeq); CALC[id] = src;
    const chk = ck && CHK.on ? chkRow(ck) : '';
    return `<div class="calc"><div class="calc-math">${tex(src, true)}</div><div class="calc-tools"><button class="calc-btn" data-mml="${id}" title="Копировать формулу для Word (MathML)" aria-label="Копировать формулу для Word">${ICON_COPY}</button><button class="calc-btn tx" data-tex="${id}" title="Копировать как LaTeX" aria-label="Копировать как LaTeX">TeX</button></div>${desc ? `<div class="calc-desc">${esc(desc)}</div>` : ''}${chk}</div>`;
  }
  /* ---------- сверка с ручным расчётом ---------- */
  const CHKIDX = {};
  const CHK = (() => { let c = null; try { c = JSON.parse(localStorage.getItem('ep-check') || 'null'); } catch (e) { c = null; } return Object.assign({ on: false, vals: {} }, c || {}); })();
  function saveChk() { try { localStorage.setItem('ep-check', JSON.stringify(CHK)); } catch (e) { /* ignore */ } }
  const chkKey = ck => S.P.variant + '|' + ck;
  function chkRow(ck) {
    const v = CHK.vals[chkKey(ck)];
    return `<div class="chk-row" data-ck="${esc(ck)}"><label><span>Ваше значение</span><input inputmode="decimal" autocomplete="off" value="${v === undefined ? '' : esc(String(v).replace('.', ','))}" placeholder="из тетради">${CHKIDX[ck] && CHKIDX[ck].unit ? `<em>${esc(CHKIDX[ck].unit)}</em>` : ''}</label><div class="chk-v"></div></div>`;
  }
  const relDev = (u, v) => Math.abs(u - v) / Math.max(Math.abs(v), 1e-12);
  const TOL = 0.006;   // 0,6 % — разница округления
  const altCache = new Map();
  function altItemVal(patch, ck) {
    const key = JSON.stringify(patch);
    let R = altCache.get(key);
    if (R === undefined) { try { R = L.compute(Object.assign({}, S.P, patch)); } catch (e) { R = null; } altCache.set(key, R); }
    if (!R) return undefined;
    const c = CHKIDX[ck]; let n = 0;
    for (const it of R['L' + c.tab.slice(2)].items) if (it.k === 'eq' && it.lhs === c.lhs && ++n === c.n) return it.val;
    return undefined;
  }
  function scenarios() {
    const P = S.P, R = S.R, out = [];
    out.push({ t: P.deg57 ? 'перевести градусы точно (π/180), а не делением на 57' : 'перевести градусы делением на 57', p: { deg57: P.deg57 ? 0 : 57 } });
    out.push({ t: P.roundManual ? 'не округлять промежуточные параметры' : 'округлять промежуточные параметры до 0,001', p: { roundManual: !P.roundManual } });
    out.push({ t: P.roundGear ? 'не округлять передаточное число до целого' : 'округлить передаточное число до целого', p: { roundGear: !P.roundGear } });
    out.push({ t: 'перевести градусы делением на 57 и не округлять передаточное число', p: { deg57: P.deg57 ? 0 : 57, roundGear: !P.roundGear } });
    const cur = R.motorId, Ptr = R.lr1.Ptr;
    D.motors.forEach((mo, k) => {
      if (k === cur || mo.P * 1000 < Ptr * 0.95 || mo.P > R.lr1.mo.P * 3) return;
      const nm = `${mo.type} (${fnum(mo.P)} кВт, ${mo.U} В, ${mo.n} об/мин)`;
      out.push({ t: 'взять двигатель ' + nm, p: { motor: k }, mo: true });
      out.push({ t: 'взять двигатель ' + nm + ' и перевести градусы ' + (P.deg57 ? 'точно' : 'делением на 57'), p: { motor: k, deg57: P.deg57 ? 0 : 57 }, mo: true });
    });
    return out;
  }
  let chkRun = 0;
  async function verdict(ck, row) {
    const out = $('.chk-v', row), c = CHKIDX[ck];
    const raw = CHK.vals[chkKey(ck)];
    row.classList.remove('ok', 'warn', 'bad');
    if (raw === undefined || raw === '') { out.innerHTML = ''; return; }
    const u = +raw, v = c.val;
    if (!isFinite(u)) { out.textContent = 'Введите число'; row.classList.add('warn'); return; }
    const dv = relDev(u, v), pc = x => String(+(x * 100).toFixed(x < 0.01 ? 2 : 1)).replace('.', ',') + ' %';
    if (dv <= TOL) { row.classList.add('ok'); out.innerHTML = '✓ Совпадает' + (dv > 0.0005 ? ` (разница ${pc(dv)} — округление)` : ''); return 'ok'; }
    for (const k of [1e3, 1e-3, 1e6, 1e-6]) if (relDev(u * k, v) <= TOL) { row.classList.add('warn'); out.innerHTML = `≈ Совпадает с точностью до единиц измерения: проверьте приставку (×${k >= 1 ? fnum(k) : '1/' + fnum(1 / k)}) — утилита считает в ${esc(c.unit || 'основных единицах')}.`; return 'warn'; }
    // обрезание вместо округления (0,008675 → 0,008)
    for (let k = 1; k <= 4; k++) {
      const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - k + 1), tr = Math.trunc(v / e) * e, rn = Math.round(v / e) * e;
      if (Math.abs(u - tr) < e * 1e-6 && Math.abs(tr - rn) > e * 0.5) { row.classList.add('warn'); out.innerHTML = `≈ Похоже, значение обрезано, а не округлено: ${fnum(v)} ≈ ${String(+rn.toPrecision(k)).replace('.', ',')}, а не ${String(+tr.toPrecision(k)).replace('.', ',')}.`; return 'warn'; }
    }
    const entered = Object.entries(CHKIDX).filter(([k, x]) => k !== ck && x.tab === c.tab && CHK.vals[chkKey(k)] !== undefined && CHK.vals[chkKey(k)] !== '');
    const prev = entered.filter(([k, x]) => x.order < c.order && relDev(+CHK.vals[chkKey(k)], x.val) > 0.025);
    const okOthers = entered.filter(([k, x]) => relDev(+CHK.vals[chkKey(k)], x.val) <= TOL);
    row.classList.add('bad');
    out.innerHTML = `✗ Расхождение ${pc(dv)} (утилита: ${fnum(v)}). <span class="spinner"></span> Ищу причину…`;
    const run = ++chkRun; row.dataset.run = run;
    for (const sc of scenarios()) {
      if (row.dataset.run !== String(run)) return;
      const av = altItemVal(sc.p, ck);
      await new Promise(r => setTimeout(r, 0));
      if (av === undefined || relDev(u, av) > TOL) continue;
      // объяснение должно согласовываться с остальными вашими совпавшими значениями
      if (okOthers.some(([k]) => { const a = altItemVal(sc.p, k); return a === undefined || relDev(+CHK.vals[chkKey(k)], a) > TOL; })) continue;
      row.classList.remove('bad'); row.classList.add('warn');
      out.innerHTML = `≈ Ваше значение получается, если ${esc(sc.t)} (${fnum(av)}). Расчёт сам по себе верный — отличаются исходные допущения.${sc.mo ? ' Выбрать этот двигатель можно на вкладке «Данные».' : ' Переключить можно в разделе «Методика расчёта» на вкладке «Данные».'}`;
      return 'warn';
    }
    if (row.dataset.run !== String(run)) return;
    if (dv <= 0.025) { row.classList.remove('bad'); row.classList.add('warn'); out.innerHTML = `≈ Близко: расхождение ${pc(dv)} (утилита: ${fnum(v)}). Обычно так бывает, когда промежуточные величины округлены сильнее — например, коэффициент взят с двумя знаками. Ошибкой это не считается.`; return 'warn'; }
    out.innerHTML = `✗ Расхождение ${pc(dv)} (утилита: ${fnum(v)}). ` + (prev.length
      ? `Возможно, это следствие расхождения выше: ${prev.map(([, x]) => tex(x.lhs, false)).join(', ')}. Начните сверку с первого несовпадающего значения.`
      : 'Предыдущие значения совпадают — вероятна арифметическая ошибка в этой формуле. Сверьте подстановку чисел с формулой выше.');
    return 'bad';
  }
  function chkSummary() {
    const box = $('#chk-sum'); if (!box) return;
    const rows = $$('.chk-row'), n = rows.filter(r => CHK.vals[chkKey(r.dataset.ck)] !== undefined && CHK.vals[chkKey(r.dataset.ck)] !== '').length;
    const ok = rows.filter(r => r.classList.contains('ok')).length, w = rows.filter(r => r.classList.contains('warn')).length, b = rows.filter(r => r.classList.contains('bad')).length;
    box.innerHTML = n ? `Сверено: ${n} из ${rows.length} · <b class="c-ok">✓ ${ok}</b> · <b class="c-warn">≈ ${w}</b> · <b class="c-bad">✗ ${b}</b>` : `Впишите свои значения в поля под формулами — утилита сравнит их и подскажет причину расхождения.`;
  }
  function bindChk(root) {
    const sw = $('#chk-on', root);
    if (sw) sw.onchange = () => { CHK.on = sw.checked; saveChk(); const y = window.scrollY; renderTab(); window.scrollTo(0, y); };
    const clr = $('#chk-clr', root);
    if (clr) clr.onclick = () => { const pre = S.P.variant + '|' + S.tab + '|'; Object.keys(CHK.vals).forEach(k => { if (k.startsWith(pre)) delete CHK.vals[k]; }); saveChk(); const y = window.scrollY; renderTab(); window.scrollTo(0, y); };
    if (!CHK.on) return;
    altCache.clear();
    const rows = $$('.chk-row', root);
    const upd = async row => { await verdict(row.dataset.ck, row); chkSummary(); };
    rows.forEach(row => {
      const inp = $('input', row);
      inp.addEventListener('change', () => {
        const t = inp.value.trim().replace(/\s/g, '').replace(',', '.');
        const k = chkKey(row.dataset.ck);
        if (t === '') delete CHK.vals[k]; else CHK.vals[k] = t;
        saveChk(); upd(row);
        // зависимые значения ниже пересматриваются
        rows.filter(r => CHKIDX[r.dataset.ck].order > CHKIDX[row.dataset.ck].order && CHK.vals[chkKey(r.dataset.ck)] !== undefined).forEach(upd);
      });
    });
    (async () => { for (const r of rows) if (CHK.vals[chkKey(r.dataset.ck)] !== undefined) await verdict(r.dataset.ck, r); chkSummary(); })();
    chkSummary();
  }
  function mathml(src) {
    let h = katex.renderToString(texify(src), { displayMode: true, output: 'mathml', throwOnError: false, strict: 'ignore' });
    const a = h.indexOf('<math'), b = h.lastIndexOf('</math>');
    h = h.slice(a, b + 7);
    h = h.replace(/<annotation[\s\S]*?<\/annotation>/g, '').replace(/<\/?semantics>/g, '');
    h = h.replace(/^<math[^>]*>/, '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
    h = h.replace(/<mi>([\u0370-\u03ff])<\/mi>/g, '<mi mathvariant="normal">$1</mi>');   // ГОСТ 2.304: греческие буквы прямым шрифтом
    return h;
  }
  function bindCalc(root) {
    $$('[data-mml]', root).forEach(b => b.onclick = () => copyText(mathml(CALC[b.dataset.mml]), 'Формула скопирована — вставьте в Word (Ctrl+V)'));
    $$('[data-tex]', root).forEach(b => b.onclick = () => copyText(texify(CALC[b.dataset.tex]), 'LaTeX скопирован'));
  }
  function diagramSvg(id) {
    const R = S.R;
    try {
      if (id === 'd_lr2') return DG.lr2(R).svg();
      if (id === 'd_lr3') return DG.speedChain(R, false).svg();
      if (id === 'd_lr4') return DG.speedChain(R, true).svg();
      if (id === 'd_lr5_pid') return DG.pos(R, 'pid', false).svg();
      if (id === 'd_lr5_id') return DG.pos(R, 'id', false).svg();
      if (id === 'd_lr6_pid') return DG.pos(R, 'pid', true).svg();
      if (id === 'd_lr6_id') return DG.pos(R, 'id', true).svg();
    } catch (e) { console.error(e); }
    return '';
  }
  function approxForm(kind) {
    const a = kind === 'pid' ? S.R.lr5.ap2 : S.R.lr5.ap1;
    const ws = kind === 'pid' ? [1 / a.T1, 1 / a.T2, 1 / a.T3] : [1 / a.T1, 1 / a.T2, 1 / a.T3, 1 / a.T4];
    const f = (k, lab, v) => `<div class="fld"><label for="ap-${kind}-${k}"><span>${lab}</span></label><input id="ap-${kind}-${k}" inputmode="decimal" value="${String(+v.toPrecision(5)).replace(".", ",")}"></div>`;
    return `<div class="approx"><h4>Параметры аппроксимации ЛАЧХ ${kind === 'pid' ? '(ПИД)' : '(интегро-дифференцирующий)'}</h4>
      <p>${a.manual ? 'Заданы вручную.' : 'Определены автоматически по ЛАЧХ.'} Можно снять значения с графика самостоятельно (наведите курсор на ЛАЧХ) и пересчитать модель.</p>
      <div class="form-grid">${f('K', 'K<sub>рп</sub>', a.K)}${ws.map((w, k) => f('w' + (k + 1), 'ω<sub>' + (k + 1) + '</sub>, с⁻¹', w)).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-apply="${kind}">Применить</button>${S.P.lr5mode === 'manual' ? '<button class="btn sm ghost" data-auto="1">Вернуть автоматические</button>' : ''}</div></div>`;
  }
  function bindApprox() {
    $$('[data-apply]').forEach(b => b.onclick = () => {
      const R = S.R, a2 = R.lr5.ap2, a1 = R.lr5.ap1;
      const g = (kind, k) => { const el = $('#ap-' + kind + '-' + k); return el ? parseFloat(el.value.replace(',', '.')) : NaN; };
      const pid = { K: g('pid', 'K'), T1: 1 / g('pid', 'w1'), T2: 1 / g('pid', 'w2'), T3: 1 / g('pid', 'w3') };
      const idr = { K: g('id', 'K'), T1: 1 / g('id', 'w1'), T2: 1 / g('id', 'w2'), T3: 1 / g('id', 'w3'), T4: 1 / g('id', 'w4') };
      const bad = o => Object.values(o).some(v => !(v > 0) || !isFinite(v));
      if (bad(pid) || bad(idr)) { toast('Проверьте значения: нужны положительные числа'); return; }
      S.P.lr5mode = 'manual'; S.P.pid = pid; S.P.idr = idr;
      recompute(); toast('Аппроксимация применена');
    });
    $$('[data-auto]').forEach(b => b.onclick = () => { S.P.lr5mode = 'auto'; delete S.P.pid; delete S.P.idr; recompute(); });
  }

  function renderLab(main, tab) {
    const R = S.R, no = tab.slice(2);
    const rep = R['L' + no];
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">Лабораторная работа № ${no}</div><h1>${esc(TITLES[tab])}</h1><p class="lead">${leadText(tab)}</p></div>${stamp(no)}</header>
      <div class="sheet-body rep"><div class="kpis">${kpis(tab)}</div><p class="calc-hint">${ICON_COPY} у каждой формулы копирует её в формате MathML — в Word вставляется как редактируемое уравнение (Ctrl+V). Если вставилось текстом, используйте «Специальная вставка → Только текст». Кнопка «TeX» копирует LaTeX.</p>
        <div class="opts chk-bar"><div class="opt"><div class="opt-t"><b>Сверка с ручным расчётом</b><span id="chk-sum">${CHK.on ? '' : 'Под каждой формулой появится поле для вашего значения: утилита сравнит его и подскажет причину расхождения — округление, перевод градусов, другой двигатель или ошибка в подстановке.'}</span></div><div class="opt-c" style="display:flex;gap:10px;align-items:center">${CHK.on ? '<button class="btn" id="chk-clr">Очистить</button>' : ''}<label class="sw"><input type="checkbox" id="chk-on" ${CHK.on ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">Сверка</span></label></div>${CHK.on || !window.SUITE || !SUITE.chkEx ? '' : SUITE.chkEx('c = (U<sub>ном</sub> − I<sub>ном</sub>R)/Ω<sub>ном</sub> = 2,273 В·с/рад', '2,27')}</div></div>${renderItems(rep.items, tab)}${simHints(tab)}${filesPanel(tab)}
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:22px;flex-wrap:wrap">${+no > 1 ? `<button class="btn" data-go="lr${+no - 1}">← ЛР № ${+no - 1}</button>` : '<span></span>'}${+no < 6 ? `<button class="btn" data-go="lr${+no + 1}">ЛР № ${+no + 1} →</button>` : ''}</div>
      </div></article>`;
    $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    bindFiles(main);
    bindCalc(main);
    bindChk(main);
    bindApprox();
    drawStatic(tab);
    runSims(tab);
  }
  function leadText(tab) {
    return {
      lr1: 'Выбор двигателя по требуемой мощности, расчёт передаточного числа редуктора, дросселей и тиристоров ТП, датчика скорости с RC-фильтром и датчика положения.',
      lr2: 'Установившиеся ошибки по заданию и по моменту сопротивления (теорема о конечном значении) и их проверка моделированием ССДМ.',
      lr3: 'Синтез ПИД-регулятора скорости для настройки на оптимум по модулю, RC-элементы схемы, ЛЧХ и переходные характеристики.',
      lr4: 'Дискретная аппроксимация регулятора по формуле трапеций, уравнения состояния, ЛПЧХ, моделирование и программа для ПЛК.',
      lr5: 'Желаемые ЛАЧХ по критерию динамической точности, ЛАЧХ регулятора и её асимптотическая аппроксимация, моделирование следящего ЭП.',
      lr6: 'Аналитический синтез регулятора положения, его цифровая реализация и моделирование цифро-аналогового следящего ЭП.'
    }[tab];
  }

  /* ---------- графики без моделирования ---------- */
  function drawStatic(tab) {
    const R = S.R;
    try {
      if (tab === 'lr3') {
        const w = NC.logspace(-1, 4.3, 700);
        const bd = NC.bodeData(x => NC.freq(R.lr3.Wks, x), w);
        CH.bode($('#p-lr3_bode'), [{ w, mag: bd.mag, ph: bd.ph, name: 'Wкс(jω)' }], R.lr3.mg3);
      }
      if (tab === 'lr4') {
        const w = NC.logspace(-1, 4.6, 700);
        const bd = NC.bodeData(R.lr4.Wol4, w);
        CH.bode($('#p-lr4_bode'), [{ w, mag: bd.mag, ph: bd.ph, name: 'Wкс(jωυ)' }], R.lr4.mg4, { xl: 'ωυ, с⁻¹' });
        const wn = NC.logspace(0, 5, 1500); const nb = NC.bodeData(R.lr4.Wol4, wn);
        CH.nyquist($('#p-lr4_nyq'), nb.re, nb.im);
        // реакция регулятора на единичный скачок
        const ss = R.lr4.ss4; let x = ss.A.map(() => 0); const tt = [], yy = [];
        const N = Math.min(80, Math.round(0.05 / S.P.T0));
        for (let k = 0; k <= N; k++) { let y = ss.D[0][0]; ss.C[0].forEach((c, j) => y += c * x[j]); tt.push(k * S.P.T0); yy.push(y); x = ss.A.map((r, i) => r.reduce((s, a, j) => s + a * x[j], 0) + ss.B[i][0]); }
        CH.stem($('#p-lr4_reg'), tt, yy, 't = kT0, с', 'uрс(kT0)');
      }
      if (tab === 'lr5') {
        drawForbidden(); drawRegBode('pid'); drawRegBode('id');
      }
    } catch (e) { console.error(e); }
  }
  function drawForbidden(el, opts) {
    const R = S.R, P = S.P, l5 = R.lr5;
    const KWp = P.W * 60 / P.dAW, Kep = P.E * 60 / P.dAE;
    const w = NC.logspace(-2, 3, 400);
    const bound = w.map(x => Math.min(20 * Math.log10(KWp / x), 20 * Math.log10(Kep / (x * x))));
    const ymin = -60;
    const zone = { x: w.concat(w.slice().reverse()), y: bound.concat(w.map(() => ymin)) };
    const wk = Kep / KWp, Lk = 20 * Math.log10(KWp / wk);
    const c2 = NC.bodeData(x => NC.freq(l5.Wzh2, x), w), c1 = NC.bodeData(x => NC.freq(l5.Wzh1, x), w);
    CH.forbidden(el || $('#p-lr5_zh'), { zone, Ak: [wk, Lk], curves: [{ w, mag: c2.mag, name: 'Wж(s), ν = 2' }, { w, mag: c1.mag, name: 'Wж(s), ν = 1', dash: 'dash' }], yr: [ymin, Math.max(...c2.mag.slice(0, 5), 80) + 5] }, opts);
  }
  function asym(kind, a, w) {
    const mx = (x) => Math.max(1, x);
    return kind === 'pid' ? 20 * Math.log10(a.K * mx(w * a.T1) * mx(w * a.T2) / (w * a.T1 * mx(w * a.T3)))
      : 20 * Math.log10(a.K * mx(w * a.T2) * mx(w * a.T3) / (mx(w * a.T1) * mx(w * a.T4)));
  }
  function drawRegBode(kind, el, opts) {
    const R = S.R, l5 = R.lr5;
    const sys = kind === 'pid' ? l5.Wrp2x : l5.Wrp1x, a = kind === 'pid' ? l5.ap2 : l5.ap1;
    const w = NC.logspace(-2, 4, 700);
    const bd = NC.bodeData(x => NC.freq(sys, x), w);
    const as = w.map(x => asym(kind, a, x));
    const brk = kind === 'pid' ? [1 / a.T1, 1 / a.T2, 1 / a.T3] : [1 / a.T1, 1 / a.T2, 1 / a.T3, 1 / a.T4];
    const ann = brk.map((b, k) => ({ x: Math.log10(b), y: asym(kind, a, b), xref: 'x', yref: 'y', text: 'ω' + (k + 1) + '=' + (+b.toPrecision(3)).toString().replace('.', ','), showarrow: true, arrowhead: 0, ax: 0, ay: k % 2 ? 26 : -26 }));
    const lo = Math.min(...bd.mag.filter((v, k) => w[k] < 3000)), hi = Math.max(...bd.mag.filter((v, k) => w[k] < 3000));
    CH.bode(el || $('#p-lr5_bode_' + kind), [{ w, mag: bd.mag, name: 'Wрп(s) = Wж/Wн (точная)' }, { w, mag: as, name: 'асимптотическая аппроксимация', dash: 'dash' }], null, Object.assign({ h: 360, annotations: ann, yrange: [lo - 8, Math.min(hi, lo + 80) + 6] }, opts || {}));
  }

  /* ---------- моделирование ---------- */
  async function getSim(key) {
    if (S.sims[key]) return S.sims[key];
    await sleep(0);
    const R = S.R; let r;
    switch (key) {
      case 'lr2': r = L.simLR2(R); break;
      case 'lr3': r = L.simSpeed(R, false); break;
      case 'lr4': r = L.simSpeed(R, true); break;
      case 'lr5pid': r = L.simPos(R, 'pid', false); break;
      case 'lr5id': r = L.simPos(R, 'id', false); break;
      case 'lr6pid': r = L.simPos(R, 'pid', true); break;
      case 'lr6id': r = L.simPos(R, 'id', true); break;
    }
    S.sims[key] = r; return r;
  }
  const am = x => x * (S.P && S.P.deg57 ? 57 : 180 / Math.PI) * 60;
  function simTableHtml(cap, rows) {
    return `<table>${cap ? '<caption>' + esc(cap) + '</caption>' : ''}<thead><tr><th>Показатель</th><th class="num">Моделирование</th><th class="num">Расчёт / требование</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="num">${pw(r[1])}</td><td class="num">${pw(r[2] || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  function simTable(id, rows) {
    const el = $('#s-' + id); if (!el) return;
    const cap = el.querySelector('caption') ? el.querySelector('caption').textContent : '';
    el.innerHTML = simTableHtml(cap, rows);
  }
  function rowsLR2(r) {
    const R = S.R;
    return [
      ['Ω<sub>уст</sub> без нагрузки, рад/с', fnum(r.Wbefore), fnum(R.lr2.Wss0)],
      ['Ω<sub>уст</sub> после наброса M<sub>c</sub>, рад/с', fnum(r.Wafter), ''],
      ['Δu<sub>уст</sub><sup>u</sup> (Display до наброса), В', fnum(r.eBefore), fnum(R.lr2.du_u)],
      ['Δu<sub>уст</sub><sup>Mc</sup>, В', fnum(r.eAfter - r.eBefore), fnum(R.lr2.du_M)],
      ['Δu<sub>уст</sub> (Display в конце), В', fnum(r.eAfter), fnum(R.lr2.du_u + R.lr2.du_M)],
      ['Перерегулирование σ, %', fnum(r.info.sigma, 3), ''],
      ['Время переходного процесса (5 %), с', fnum(r.info.ts, 3), ''],
      ['Число колебаний N', r.info.N, '']];
  }
  function rowsSpeed(r, ana) {
    const R = S.R, TS = R.lr3.TS;
    const rows = [
      ['Ω<sub>уст</sub>, рад/с', fnum(r.info.yfinal), fnum(S.P.Uz / R.lr1.Kos) + ' (Uз/Kос)'],
      ['Ω<sub>max</sub>, рад/с', fnum(r.info.ymax), ''],
      ['Перерегулирование σ, %', fnum(r.info.sigma, 3), '4,3 (ОМ)'],
      ['Время нарастания t<sub>н</sub>, с', fnum(r.info.tr, 3), fnum(4.7 * TS, 3) + ' (4,7TΣ)'],
      ['Время переходного процесса (5 %), с', fnum(r.info.ts, 3), ''],
      ['Макс. отклонение ΔΩ при M<sub>c</sub> = −M<sub>c0</sub>, рад/с', fnum(r.pk, 3), ''],
      ['Время восстановления (5 % от ΔΩmax), с', fnum(r.trec, 3), 'ошибка → 0 (И-составляющая)']];
    if (ana) rows.splice(3, 0, ['σ аналогового РС (ЛР3), %', fnum(ana.info.sigma, 3), '']);
    return rows;
  }
  function rowsPos(kind, r) {
    const P = S.P, spec = kind === 'pid' ? P.dAE : P.dAW, eArc = am(r.errEnd);
    return [
      ['Перерегулирование σ, %', fnum(r.info.sigma, 3), 'M = ' + fnum(P.M)],
      ['Время регулирования (5 %), с', fnum(r.info.ts, 3), ''],
      ['Число колебаний N', r.info.N, ''],
      [kind === 'pid' ? 'Ошибка Δα<sub>ε уст</sub> при ε<sub>max</sub>t²/2' : 'Ошибка Δα<sub>Ω уст</sub> при Ω<sub>max</sub>t', fnum(r.errEnd, 4) + ' рад = ' + fnum(eArc, 3) + '′', '≤ ' + spec + '′ ' + (Math.abs(eArc) <= spec ? '<span class="pill ok">выполнено</span>' : '<span class="pill bad">не выполнено</span>')],
      ['Моментная составляющая Δα<sup>м</sup> (t = 4 с)', fnum(r.mcEnd, 3) + ' рад = ' + fnum(am(r.mcEnd), 3) + '′', '']];
  }
  async function runSims(tab) {
    const token = S.R;
    const alive = () => S.R === token && S.tab === tab;
    try {
      if (tab === 'lr2') {
        const r = await getSim('lr2'); if (!alive()) return;
        drawLR2(r);
      }
      if (tab === 'lr3') { const r = await getSim('lr3'); if (!alive()) return; drawSpeed(r, null, 'lr3'); }
      if (tab === 'lr4') { const r = await getSim('lr4'); if (!alive()) return; const a = await getSim('lr3'); if (!alive()) return; drawSpeed(r, a, 'lr4'); }
      if (tab === 'lr5' || tab === 'lr6') {
        for (const kind of ['pid', 'id']) { const r = await getSim(tab + kind); if (!alive()) return; drawPos(tab, kind, r); }
      }
    } catch (e) {
      console.error(e);
      $$('.plot-wait').forEach(p => p.innerHTML = '<span>Ошибка моделирования: ' + esc(e.message) + '</span>');
    }
  }
  function drawLR2(r, opts, els) {
    const R = S.R, s = r.sim; els = els || {};
    CH.time(els.w || $('#p-lr2_w'), [{ x: s.t, y: s.W, name: 'Ωдв(t)' }], 't, с', 'Ωдв, рад/с', Object.assign({ shapes: [{ type: 'line', x0: 1, x1: 1, yref: 'paper', y0: 0, y1: 1 }], annotations: [{ x: 1, y: 0.06, yref: 'paper', xanchor: 'left', text: ' наброс Mc' }] }, opts));
    CH.time(els.e || $('#p-lr2_e'), [{ x: s.t, y: s.e, name: 'Δu(t)' }], 't, с', 'Δu, В', opts);
    if (!els.w) simTable('sr_lr2', rowsLR2(r));
  }
  function drawSpeed(r, ana, tab, opts, els) {
    const R = S.R; els = els || {};
    const ser = [{ x: r.a.t, y: r.a.W, name: tab === 'lr4' ? 'цифровой РС' : 'Ω(t)', shape: tab === 'lr4' ? 'linear' : 'linear' }];
    if (ana) ser.push({ x: ana.a.t, y: ana.a.W, name: 'аналоговый РС (ЛР3)', dash: 'dash' });
    const yf = r.info.yfinal;
    CH.time(els.step || $('#p-' + tab + '_step'), ser, 't, с', 'Ω(t), рад/с', Object.assign({ shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: yf, y1: yf }] }, opts));
    const ser2 = [{ x: r.b.t, y: r.b.W, name: tab === 'lr4' ? 'цифровой РС' : 'ΔΩ(t)' }];
    if (ana) ser2.push({ x: ana.b.t, y: ana.b.W, name: 'аналоговый РС (ЛР3)', dash: 'dash' });
    CH.time(els.dist || $('#p-' + tab + '_dist'), ser2, 't, с', 'Ω(t), рад/с', opts);
    if (els.step) return;
    simTable('sr_' + tab, rowsSpeed(r, ana));
  }
  function drawPos(tab, kind, r, opts, els) {
    const P = S.P; els = els || {};
    CH.time(els.step || $('#p-' + tab + '_step_' + kind), [{ x: r.s1.t, y: r.s1.alpha, name: 'α(t)' }], 't, с', 'α(t), рад', Object.assign({ shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 1, y1: 1 }] }, opts));
    CH.time(els.err || $('#p-' + tab + '_err_' + kind), [{ x: r.s2.t, y: r.s2.ea, name: 'Δα(t)' }], 't, с', 'Δα, рад', opts);
    CH.time(els.mc || $('#p-' + tab + '_mc_' + kind), [{ x: r.s3.t, y: r.s3.ea, name: 'Δαм(t)' }], 't, с', 'Δαм, рад', opts);
    if (els.step) return;
    simTable('sr_' + tab + '_' + kind, rowsPos(kind, r));
  }

  /* ---------------- код и файлы ---------------- */
  function hl(src, lang) {
    const e = esc(src);
    if (lang === 'st') return e.replace(/(\(\*[\s\S]*?\*\))/g, '<span class="c">$1</span>').replace(/\b(PROGRAM|VAR_INPUT|VAR_OUTPUT|VAR|END_VAR|REAL)\b/g, '<span class="k">$1</span>');
    return e.split('\n').map(line => {
      // строки в одинарных кавычках и комментарии %
      let out = '', i = 0, inS = false, prev = '';
      while (i < line.length) {
        const ch = line[i];
        if (!inS && ch === '%') { out += '<span class="c">' + line.slice(i) + '</span>'; break; }
        if (ch === "'" && !inS && !/[\w)\]}.']/.test(prev)) { inS = true; out += '<span class="s">' + ch; }
        else if (ch === "'" && inS) { inS = false; out += ch + '</span>'; }
        else out += ch;
        if (ch !== ' ') prev = ch; i++;
      }
      if (inS) out += '</span>';
      return out.replace(/\b(function|end|if|else|elseif|for|while|return)\b(?![^<]*<\/span>)/g, '<span class="k">$1</span>');
    }).join('\n');
  }
  let codeSeq = 0;
  const CODE = {};
  function codeBlock(src, name, lang) {
    const id = 'code' + (++codeSeq); CODE[id] = { src, name };
    return `<div class="code"><div class="code-head"><span class="fn">${esc(name)}</span><span class="acts"><button class="btn sm" data-copy="${id}">Копировать</button><button class="btn sm" data-dl="${id}">Скачать</button></span></div><pre class="src">${hl(src, lang)}</pre></div>`;
  }
  function labFiles(tab) {
    const R = S.R;
    const f = (path, desc, gen, lang) => ({ path, desc, gen, lang: lang || 'matlab' });
    switch (tab) {
      case 'lr1': return [f('LR1/lr1_raschet.m', 'Расчёт двигателя, ТП, тахогенератора и ВТ (вывод в Command Window)', () => G.lr1(R))];
      case 'lr2': return [f('LR2/lr2_raschet.m', 'Ошибки по формулам (2.1)–(2.2), Ω(t) средствами Control System Toolbox', () => G.lr2(R)), f('LR2/lr2_model.m', 'Строит и запускает модель Simulink рис. 2.1 (lr2_model.slx), выводит значения Display', () => G.lr2model(R))];
      case 'lr3': return [f('LR3/lr3_raschet.m', 'Регулятор скорости, ЛЧХ sys5 с запасами, переходные процессы, RC-элементы', () => G.lr3(R)), f('LR3/lr3_model.m', 'Модель Simulink рис. 3.10: Ω(t) по заданию и по моменту', () => G.lr3model(R))];
      case 'lr4': return [f('LR4/lr4_raschet.m', 'bilinear, tf2ss, ЛПЧХ и АФЧХ (c2d + d2c tustin), реакция регулятора', () => G.lr4(R)), f('LR4/lr4_model.m', 'Модель Simulink рис. 4.7 с блоком Discrete State-Space', () => G.lr4model(R)), f('LR4/PLC_PRG.st', 'Программа цифрового регулятора скорости для CoDeSys (ПЛК154)', () => R.lr4.st4, 'st')];
      case 'lr5': return [f('LR5/lr5_raschet.m', 'Желаемые ЛАЧХ, Wрп = Wж/Wн, аппроксимация, проверка (ν = 2 и ν = 1)', () => G.lr5(R)), f('LR5/lr5_model_pid.m', 'Модель Simulink рис. 5.5 (ПИД-РП): 3 опыта — шаг, εmax·t²/2, момент', () => G.lr5model(R, 'pid')), f('LR5/lr5_model_id.m', 'Модель Simulink рис. 5.10 (интегро-дифференцирующий РП)', () => G.lr5model(R, 'id'))];
      case 'lr6': return [f('LR6/lr6_raschet.m', 'Аналитический синтез: minreal, bilinear, tf2ss (ν = 2 и ν = 1)', () => G.lr6(R)), f('LR6/lr6_model_pid.m', 'Модель Simulink рис. 6.1: цифровые РП и РС', () => G.lr6model(R, 'pid')), f('LR6/lr6_model_id.m', 'Модель Simulink рис. 6.5', () => G.lr6model(R, 'id')), f('LR6/PLC_PRG_RP2.st', 'CoDeSys: цифровой ПИД-регулятор положения (ν = 2)', () => R.lr6.st62, 'st'), f('LR6/PLC_PRG_RP1.st', 'CoDeSys: цифровой регулятор положения (ν = 1)', () => R.lr6.st61, 'st')];
    }
    return [];
  }
  /* что запустить и какие рисунки сайта получатся для каждого файла */
  const FILEMETA = {
    'lr1_raschet.m': { result: 'Параметры двигателя, ТП, тахогенератора и ВТ — в Command Window; сверьте с расчётом выше.' },
    'lr2_raschet.m': { figs: ['lr2_w', 'lr2_e'], result: 'Ошибки Δu и Ω(t) по формулам и средствами Control System Toolbox.' },
    'lr2_model.m': { figs: ['lr2_w', 'lr2_e'], result: 'Модель lr2_model.slx; значения блока Display — в Command Window.' },
    'lr3_raschet.m': { figs: ['lr3_bode', 'lr3_step', 'lr3_dist'], result: 'Регулятор скорости, запасы устойчивости, переходные процессы, RC-элементы.' },
    'lr3_model.m': { figs: ['lr3_step', 'lr3_dist'], result: 'Модель lr3_model.slx: Ω(t) по заданию и по моменту, σ и tн — в Command Window.' },
    'lr4_raschet.m': { figs: ['lr4_reg', 'lr4_bode', 'lr4_nyq'], result: 'Цифровой регулятор, ЛПЧХ и АФЧХ, запасы устойчивости.' },
    'lr4_model.m': { figs: ['lr4_step', 'lr4_dist'], result: 'Модель lr4_model.slx с блоком Discrete State-Space.' },
    'PLC_PRG.st': { run: 'вставить в PLC_PRG проекта CoDeSys', result: 'Рабочая программа цифрового регулятора скорости для ПЛК154.' },
    'lr5_raschet.m': { figs: ['lr5_zh', 'lr5_bode_pid', 'lr5_step_pid', 'lr5_err_pid', 'lr5_bode_id', 'lr5_step_id', 'lr5_err_id'], result: 'Желаемые ЛАЧХ, регуляторы положения и их проверка для ν = 2 и ν = 1.' },
    'lr5_model_pid.m': { figs: ['lr5_step_pid', 'lr5_err_pid', 'lr5_mc_pid'], result: 'Модель рис. 5.5: три опыта — шаг, εmax·t²/2, момент.' },
    'lr5_model_id.m': { figs: ['lr5_step_id', 'lr5_err_id', 'lr5_mc_id'], result: 'Модель рис. 5.10: три опыта — шаг, Ωmax·t, момент.' },
    'lr6_raschet.m': { result: 'Коэффициенты цифровых регуляторов положения (сверьте с «ожидаемыми» в комментариях) и ЛАЧХ регуляторов.' },
    'lr6_model_pid.m': { figs: ['lr6_step_pid', 'lr6_err_pid', 'lr6_mc_pid'], result: 'Модель рис. 6.1 с цифровыми РП и РС.' },
    'lr6_model_id.m': { figs: ['lr6_step_id', 'lr6_err_id', 'lr6_mc_id'], result: 'Модель рис. 6.5.' },
    'PLC_PRG_RP2.st': { run: 'вставить в PLC_PRG проекта CoDeSys', result: 'Цифровой ПИД-регулятор положения (ν = 2).' },
    'PLC_PRG_RP1.st': { run: 'вставить в PLC_PRG проекта CoDeSys', result: 'Цифровой регулятор положения (ν = 1).' }
  };
  function figNo(tab, id) {
    const rep = S.R['L' + tab.slice(2)]; if (!rep) return '';
    const k = rep.items.filter(it => it.k === 'plot' && !it.repOnly).findIndex(it => it.id === id);
    return k < 0 ? '' : tab.slice(2) + '.' + (k + 1);
  }
  /* ---------- подсказка: что вписать в блоки Simulink ---------- */
  // вычисление простых выражений MATLAB (числа, матрицы, + - * / ^, pi) по переменным скрипта
  function mToJs(e) {
    e = e.trim().replace(/\bpi\b/g, 'Math.PI').replace(/\^/g, '**');
    let out = '', i = 0;
    const mat = () => {   // e[i] === '['
      i++; const rows = [[]]; let cur = '', dep = 0;
      const push = () => { if (cur.trim()) rows[rows.length - 1].push(mToJs(cur)); cur = ''; };
      for (; i < e.length; i++) {
        const ch = e[i];
        if (ch === '[' && dep === 0) { cur += mat(); continue; }
        if (ch === '(') dep++; else if (ch === ')') dep--;
        if (dep === 0 && ch === ']') { push(); break; }
        if (dep === 0 && ch === ';') { push(); rows.push([]); continue; }
        if (dep === 0 && (ch === ',' || /\s/.test(ch))) {
          // пробел перед унарным минусом/плюсом — разделитель, иначе (a - b) — оператор
          if (/\s/.test(ch)) { const rest = e.slice(i).replace(/^\s+/, ''); const prev = cur.trim(); if (/^[+\-]\s/.test(rest) || /[+\-*\/^]$/.test(prev) || !prev) continue; }
          push(); continue;
        }
        cur += ch;
      }
      const rr = rows.filter(r => r.length);
      return rr.length === 1 ? '[' + rr[0].join(',') + ']' : '[' + rr.map(r => '[' + r.join(',') + ']').join(',') + ']';
    };
    for (; i < e.length; i++) { if (e[i] === '[') { out += mat(); } else out += e[i]; }
    return out;
  }
  function mEval(expr, env) {
    const js = mToJs(expr);
    if (/[^\w\s.+\-*\/(),\[\]]/.test(js.replace(/Math\.PI/g, ''))) return undefined;
    const ids = (js.match(/[A-Za-z_]\w*/g) || []).filter(x => x !== 'Math' && x !== 'PI');
    if (ids.some(x => !(x in env))) return undefined;
    try { return Function(...Object.keys(env), '"use strict";return (' + js + ')')(...Object.values(env)); } catch (e) { return undefined; }
  }
  function scriptEnv(code) {
    const env = {};
    code.split('\n').forEach(line => {
      line = line.replace(/%.*$/, '');
      const sts = []; let cur = '', d = 0; for (const ch of line) { if (ch === '[' || ch === '(') d++; else if (ch === ']' || ch === ')') d--; if (ch === ';' && d === 0) { sts.push(cur); cur = ''; } else cur += ch; } sts.push(cur);
      sts.forEach(st => { const m = st.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*$/); if (!m || /==/.test(st)) return; const v = mEval(m[2], env); if (v !== undefined) env[m[1]] = v; });
    });
    return env;
  }
  const mNum = x => { if (typeof x !== 'number') return String(x); const s = String(+x.toPrecision(6)); return s.includes('e') ? x.toExponential(4).replace(/\.?0+e/, 'e') : s; };
  const mVal = v => Array.isArray(v) ? (Array.isArray(v[0]) ? '[' + v.map(r => r.map(mNum).join(' ')).join('; ') + ']' : '[' + v.map(mNum).join(' ') + ']') : mNum(v);
  const PNAME = { Numerator: 'Числитель', Denominator: 'Знаменатель', Gain: 'Усиление (Gain)', After: 'Конечное значение', Time: 'Время шага', Inputs: 'Знаки входов', A: 'A', B: 'B', C: 'C', D: 'D', SampleTime: 'Шаг дискретизации' };
  const BTYPE = { tf: 'Transfer Fcn', gain: 'Gain', sum: 'Sum', step: 'Step', dss: 'Discrete State-Space', zoh: 'Zero-Order Hold', prod: 'Product', clock: 'Clock' };
  let SIMHINT = {};
  function simHints(tab) {
    let ms = []; try { ms = G.models(S.R).filter(x => x.tab === tab); } catch (e) { console.error(e); return ''; }
    if (!ms.length) return '';
    SIMHINT = {};
    const blocks = ms.map((x, mi) => {
      const env = scriptEnv(x.code);
      const rows = [];
      for (const b of x.md.b) {
        const type = Object.keys(BTYPE).find(k => b.lib.endsWith('/' + BTYPE[k])) ; if (!type) continue;
        const ps = Object.entries(b.params).filter(([k]) => PNAME[k]);
        if (!ps.length) continue;
        ps.forEach(([k, v], pi) => {
          let val;
          const q = String(v).match(/^'(.*)'$/);
          if (q) val = q[1];
          else { const inner = String(v).replace(/^(num2str|mat2str)\((.*?)(,\s*\d+)?\)$/, '$2'); const r = mEval(inner, env); val = r === undefined ? v : mVal(r); }
          const id = 'sh' + mi + '_' + rows.length; SIMHINT[id] = val;
          rows.push(`<tr>${pi === 0 ? `<td rowspan="${ps.length}"><b>${esc(b.nm)}</b>${b.nm.replace(/\d+$/, '') !== BTYPE[type] ? `<span>${BTYPE[type]}</span>` : ''}</td>` : ''}<td>${PNAME[k]}</td><td><div class="sv"><code>${esc(val)}</code><button class="calc-btn" data-sh="${id}" title="Копировать" aria-label="Копировать значение">${ICON_COPY}</button></div></td></tr>`);
        });
      }
      return `<details class="adv sh"><summary>${esc(x.file)}.slx${ms.length > 1 ? ' — ' + (x.file.endsWith('_pid') ? 'ν = 2, ПИД-регулятор положения' : 'ν = 1, интегро-дифференцирующий регулятор') : ''}</summary><div class="in"><div class="tbl sh-tbl"><table><thead><tr><th>Блок</th><th>Параметр</th><th>Значение</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div></details>`;
    }).join('');
    const P = S.P, f = fnum;
    const note = { lr2: `Step задаёт U<sub>з</sub> = ${f(P.Uz)} В при t = 0, Step1 — наброс момента M<sub>c0</sub> = ${f(P.Mc)} Н·м при t = 1 с.`,
      lr3: `Значения Step/Step1 даны для переходной характеристики по заданию. Для характеристики по моменту сопротивления: Step → 0, Step1 → −M<sub>c0</sub> = −${f(P.Mc)}.`,
      lr4: `Значения Step/Step1 даны для переходной характеристики по заданию. Для характеристики по моменту сопротивления: Step → 0, Step1 → −M<sub>c0</sub> = −${f(P.Mc)}.` }[tab];
    return `<h2>Блоки модели Simulink</h2><p>Если собираете модель вручную, впишите в блоки эти значения (копируются кнопкой). Имена блоков — как в скрипте <code>*_model.m</code>, который строит ту же модель автоматически.</p>${note ? `<div class="note">${note}</div>` : ''}${blocks}`;
  }
  /* файлы работы — шагами, в том же виде, что во всех утилитах: шаг → «Запустить / Результат» → текст файла; в конце — итог с архивом */
  function fileName(f) { return f.path.split('/')[1]; }
  function runCmd(f) { const name = fileName(f), meta = FILEMETA[name] || {}; return meta.run || name.replace(/\.m$/, ''); }
  function filesPanel(tab) {
    const files = labFiles(tab);
    const items = files.map((f, k) => {
      const name = fileName(f), meta = FILEMETA[name] || {}, run = runCmd(f);
      const figs = (meta.figs || []).map(id => figNo(tab, id)).filter(Boolean).map((no, j) => `<button class="fig-link" data-fig="${meta.figs[j]}">Рис. ${no}</button>`).join(' ');
      return `<li class="step">
        <div class="step-top"><span class="step-no">${k + 1}</span><div class="step-t"><div class="step-sec">${/\.st$/.test(name) ? 'Программа CoDeSys' : 'Скрипт MATLAB'}</div><h4 class="mono">${esc(name)}</h4></div><button class="btn primary sm" data-fdl="${k}">${dlIcon()} Скачать</button></div>
        <dl class="step-kv">
          <dt>Назначение</dt><dd>${esc(f.desc)}</dd>
          <dt>${meta.run ? 'Что сделать' : 'Запустить'}</dt><dd>${meta.run ? esc(meta.run) : `<code class="run">${esc(run)}</code><button class="calc-btn" data-run="${k}" title="Копировать команду" aria-label="Копировать команду">${ICON_COPY}</button>`}</dd>
          <dt>Результат</dt><dd>${figs ? figs + ' — ' : ''}${esc(meta.result || f.desc)}</dd>
        </dl>
        <details class="step-files"><summary>Текст файла</summary><div class="file-row"><div><div class="fn">${esc(name)}</div><div class="fd">${esc(f.desc)}</div></div><div class="acts"><button class="btn sm" data-fview="${k}">Показать</button><button class="btn sm" data-fcopy="${k}">Копировать</button><button class="btn sm" data-fdl="${k}">Скачать</button></div><div class="file-view" hidden></div></div></details>
      </li>`;
    }).join('');
    const fin = `<div class="step-fin"><div class="step-top"><span class="step-no all" aria-hidden="true">✓</span><div class="step-t"><div class="step-sec">Итог</div><h4>ЛР № ${tab.slice(2)} целиком</h4></div><button class="btn sm" data-zip="${tab}">${dlIcon()} ZIP работы</button></div>
        <p class="fd">Все файлы работы в одной папке. В архиве также README и отчёт Word по этой работе.</p>
        <div class="fchips">${files.map(f => `<span class="fchip" title="${esc(f.desc)}">${esc(fileName(f))}</span>`).join('')}</div></div>`;
    return `<section class="files" aria-label="Файлы для MATLAB"><div class="files-head"><div><h3>Файлы для MATLAB по шагам</h3><p>Запускайте по порядку; каждый файл самодостаточен — параметры варианта записаны внутри. Рисунки открываются с теми же номерами, что на этой странице, и сохраняются в PNG в папку <code>figures</code> рядом со скриптом (отключить: <code>save_figs = false</code> в начале файла).</p></div><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-docx="${tab}">${dlIcon()} Отчёт Word</button></span></div>
      <ol class="steps">${items}</ol>${fin}</section>`;
  }
  function bindFiles(root) {
    const files = labFiles(S.tab);
    $$('[data-copy]', root).forEach(b => b.onclick = () => copyText(CODE[b.dataset.copy].src));
    $$('[data-sh]', root).forEach(b => b.onclick = () => copyText(SIMHINT[b.dataset.sh], 'Значение скопировано'));
    $$('[data-dl]', root).forEach(b => b.onclick = () => downloadText(CODE[b.dataset.dl].name, CODE[b.dataset.dl].src));
    $$('[data-fcopy]', root).forEach(b => b.onclick = () => copyText(files[+b.dataset.fcopy].gen()));
    $$('[data-fdl]', root).forEach(b => b.onclick = () => { const f = files[+b.dataset.fdl]; downloadText(fileName(f), f.gen()); });
    $$('[data-run]', root).forEach(b => b.onclick = () => copyText(runCmd(files[+b.dataset.run]), 'Команда скопирована'));
    $$('[data-fview]', root).forEach(b => b.onclick = () => {
      const row = b.closest('.file-row'), v = row.querySelector('.file-view'), f = files[+b.dataset.fview];
      if (v.hidden) { v.innerHTML = `<pre class="src">${hl(f.gen(), f.lang)}</pre>`; v.hidden = false; b.textContent = 'Скрыть'; }
      else { v.hidden = true; v.innerHTML = ''; b.textContent = 'Показать'; }
    });
    $$('[data-zip]', root).forEach(b => b.onclick = () => zipLab(b.dataset.zip, b));
    $$('[data-docx]', root).forEach(b => b.onclick = () => makeDocx([b.dataset.docx], b));
    $$('[data-fig]', root).forEach(b => b.onclick = () => { const el = $('#p-' + b.dataset.fig); if (el) { const fg = el.closest('figure') || el; fg.scrollIntoView({ behavior: 'smooth', block: 'center' }); fg.classList.remove('flash'); void fg.offsetWidth; fg.classList.add('flash'); } });
  }
  function dlIcon() { return '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 12v2.5h12V12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  function copyText(t, msg) {
    const done = () => toast(msg || 'Скопировано в буфер обмена');
    try {
      navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
    } catch (e) { fallbackCopy(t, done); }
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
    ta.remove();
  }
  function downloadBlob(name, blob) {
    if (window.SUITE && SUITE.save) return SUITE.save(name, blob);   // общий механизм (suite.js): сайт или артефакт claude.ai
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function downloadText(name, text) { downloadBlob(name, new Blob([text], { type: 'text/plain;charset=utf-8' })); toast('Файл ' + name + ' сохранён'); }

  /* ---------- ZIP ---------- */
  function addLabFiles(zip, tab, root) {
    for (const f of labFiles(tab)) zip.file(root + f.path, f.gen());
  }
  async function zipLab(tab, btn) {
    const zip = new JSZip(), root = 'Variant_' + S.P.variant + '/';
    addLabFiles(zip, tab, root);
    zip.file(root + 'README.txt', G.readme(S.R));
    btn && (btn.disabled = true);
    const old = btn ? btn.innerHTML : '';
    try { zip.file(root + tab.toUpperCase() + '/' + docxName([tab]), await buildDocxBlob([tab], t => { if (btn) btn.innerHTML = '<span class="spinner"></span>' + t; })); } catch (e) { console.error(e); }
    if (btn) btn.innerHTML = old;
    const blob = await zip.generateAsync({ type: 'blob' });
    btn && (btn.disabled = false);
    downloadBlob('Variant_' + S.P.variant + '_' + tab.toUpperCase() + '.zip', blob);
    toast('Архив ' + tab.toUpperCase() + ' сформирован');
  }
  async function zipAll(btn) {
    const R = S.R;
    btn.disabled = true; const old = btn.innerHTML;
    const prog = t => { btn.innerHTML = '<span class="spinner"></span>' + t; };
    try {
      const zip = new JSZip(), root = 'Variant_' + S.P.variant + '/';
      for (const t of ['lr1', 'lr2', 'lr3', 'lr4', 'lr5', 'lr6']) addLabFiles(zip, t, root);
      zip.file(root + 'README.txt', G.readme(R));
      const keys = ['lr2', 'lr3', 'lr4', 'lr5pid', 'lr5id', 'lr6pid', 'lr6id'];
      for (let k = 0; k < keys.length; k++) { prog(' Моделирование ' + (k + 1) + '/' + keys.length); await getSim(keys[k]); await sleep(10); if (S.R !== R) throw new Error('Данные изменились во время экспорта'); }
      prog(' Графики…');
      const imgs = await renderAllPng(R);
      for (const [name, data] of Object.entries(imgs)) zip.file(root + 'Report/img/' + name + '.png', data.split(',')[1], { base64: true });
      prog(' Данные…');
      for (const [name, csv] of Object.entries(allCsv())) zip.file(root + 'Report/data/' + name + '.csv', csv);
      zip.file(root + 'Report/report.html', reportHtml(R, Object.keys(imgs)));
      for (const t of ['lr1', 'lr2', 'lr3', 'lr4', 'lr5', 'lr6']) { prog(' Отчёт ' + t.toUpperCase() + '…'); zip.file(root + t.toUpperCase() + '/' + docxName([t]), await buildDocxBlob([t])); }
      prog(' Единый отчёт…');
      zip.file(root + 'Report/' + docxName(['lr1', 'lr2', 'lr3', 'lr4', 'lr5', 'lr6']), await buildDocxBlob(['lr1', 'lr2', 'lr3', 'lr4', 'lr5', 'lr6']));
      prog(' Упаковка…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      downloadBlob('Variant_' + S.P.variant + '_LR1-6.zip', blob);
      toast('Полный архив сформирован');
    } catch (e) { console.error(e); toast('Ошибка экспорта: ' + e.message); }
    btn.disabled = false; btn.innerHTML = old;
  }
  /* ---------- отчёт Word ---------- */
  const SIMKEY = { lr2: ['lr2'], lr3: ['lr3'], lr4: ['lr3', 'lr4'], lr5: ['lr5pid', 'lr5id'], lr6: ['lr6pid', 'lr6id'], lr1: [] };
  function drawById(id, d, ex) {
    const R = S.R, s = S.sims;
    switch (id) {
      case 'lr2_w': return CH.time(d, [{ x: s.lr2.sim.t, y: s.lr2.sim.W }], 't, с', 'Ωдв, рад/с', ex);
      case 'lr2_e': return CH.time(d, [{ x: s.lr2.sim.t, y: s.lr2.sim.e }], 't, с', 'Δu, В', ex);
      case 'lr3_bode': { const w = NC.logspace(-1, 4.3, 700); const bd = NC.bodeData(x => NC.freq(R.lr3.Wks, x), w); return CH.bode(d, [{ w, mag: bd.mag, ph: bd.ph }], R.lr3.mg3, ex); }
      case 'lr3_step': return CH.time(d, [{ x: s.lr3.a.t, y: s.lr3.a.W }], 't, с', 'Ω(t), рад/с', ex);
      case 'lr3_dist': return CH.time(d, [{ x: s.lr3.b.t, y: s.lr3.b.W }], 't, с', 'Ω(t), рад/с', ex);
      case 'lr4_reg': { const ss = R.lr4.ss4; let x = ss.A.map(() => 0); const tt = [], yy = []; const N = Math.min(80, Math.round(0.05 / S.P.T0)); for (let k = 0; k <= N; k++) { let y = ss.D[0][0]; ss.C[0].forEach((c, j) => y += c * x[j]); tt.push(k * S.P.T0); yy.push(y); x = ss.A.map((r, i) => r.reduce((q, a, j) => q + a * x[j], 0) + ss.B[i][0]); } return CH.stem(d, tt, yy, 't = kT0, с', 'uрс(kT0)', ex); }
      case 'lr4_bode': { const w = NC.logspace(-1, 4.6, 700); const bd = NC.bodeData(R.lr4.Wol4, w); return CH.bode(d, [{ w, mag: bd.mag, ph: bd.ph }], R.lr4.mg4, Object.assign({ xl: 'ωυ, с⁻¹' }, ex)); }
      case 'lr4_nyq': { const wn = NC.logspace(0, 5, 1500); const nb = NC.bodeData(R.lr4.Wol4, wn); return CH.nyquist(d, nb.re, nb.im, ex); }
      case 'lr4_step': return CH.time(d, [{ x: s.lr4.a.t, y: s.lr4.a.W, name: 'цифровой РС' }, { x: s.lr3.a.t, y: s.lr3.a.W, name: 'аналоговый РС', dash: 'dash' }], 't, с', 'Ω(t), рад/с', ex);
      case 'lr4_dist': return CH.time(d, [{ x: s.lr4.b.t, y: s.lr4.b.W, name: 'цифровой РС' }, { x: s.lr3.b.t, y: s.lr3.b.W, name: 'аналоговый РС', dash: 'dash' }], 't, с', 'Ω(t), рад/с', ex);
      case 'lr5_zh': return drawForbidden(d, ex);
      case 'lr5_bode_pid': return drawRegBode('pid', d, ex);
      case 'lr5_bode_id': return drawRegBode('id', d, ex);
    }
    const m = id.match(/^(lr[56])_(step|err|mc)_(pid|id)$/);
    if (m) {
      const r = s[m[1] + m[3]];
      if (m[2] === 'step') return CH.time(d, [{ x: r.s1.t, y: r.s1.alpha }], 't, с', 'α(t), рад', ex);
      if (m[2] === 'err') return CH.time(d, [{ x: r.s2.t, y: r.s2.ea }], 't, с', 'Δα, рад', ex);
      return CH.time(d, [{ x: r.s3.t, y: r.s3.ea }], 't, с', 'Δαм, рад', ex);
    }
  }
  const PNG_H = { lr3_bode: 520, lr4_bode: 520, lr4_nyq: 520, lr5_zh: 440, lr5_bode_pid: 420, lr5_bode_id: 420 };
  async function plotPng(id) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;';
    document.body.appendChild(host);
    const h = PNG_H[id] || 380;
    try {
      await drawById(id, host, { export: true, h });
      const url = await Plotly.toImage(host, { format: 'png', width: 900, height: h, scale: 2 });
      return { data: url.split(',')[1], w: 900, h };
    } finally { try { Plotly.purge(host); } catch (e) { /* ignore */ } host.remove(); }
  }
  const SVG_STYLE = '<style>.wire{fill:none;stroke:#000;stroke-width:1.2}.arrowhead{fill:#000}.blk{fill:#fff;stroke:#000;stroke-width:1.2}.blk.acc{fill:#fff;stroke:#000;stroke-width:1.6}.blk.dsh{stroke-dasharray:5 3;fill:#fff}.bt{font:12px "Times New Roman",serif;fill:#000}.frac{stroke:#000;stroke-width:1}.cap{font:10.5px "Times New Roman",serif;fill:#333}.sum{fill:#fff;stroke:#000;stroke-width:1.2}.sumx{stroke:#000;stroke-width:.8}.sg{font:600 12px "Times New Roman",serif;fill:#000}.lbl{font:italic 13px "Times New Roman",serif;fill:#000}.dot{fill:#000}</style>';
  function svgPng(id) {
    return new Promise((res, rej) => {
      let svg = diagramSvg(id);
      if (!svg) return res(null);
      const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/); const w = +m[1], h = +m[2];
      svg = svg.replace(/(<svg[^>]*>)/, '$1' + SVG_STYLE);
      const img = new Image(), k = 3;
      img.onload = () => { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/png').split(',')[1], w, h }); };
      img.onerror = () => rej(new Error('Не удалось отрисовать схему ' + id));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  /* метка-заглушка на рисунках отчёта: что заменить снимком из MATLAB */
  function watermark(im, lines) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const W = c.width, H = c.height, u = W / 900;
        // лёгкая вуаль, чтобы метка читалась поверх графика
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 0, W, H);
        // уголки-«кадрирование»
        const L = 34 * u, m = 10 * u;
        g.strokeStyle = '#0A5AA8'; g.lineWidth = 3 * u; g.lineCap = 'round';
        [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke(); });
        // карточка: заголовок + описание с переносом строк (карточка растёт по содержимому)
        const f1 = 22 * u, f2 = 15 * u, lh2 = f2 * 1.35, pad = 18 * u, gap = 8 * u, ic = 30 * u;
        const sans = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
        const maxCard = W - 60 * u, maxText = maxCard - ic - pad * 2.8;
        g.font = `400 ${f2}px ${sans}`;
        const wrap = [];
        for (const para of lines.slice(1)) {
          let cur = '';
          for (const word of String(para).split(' ')) {
            const t = cur ? cur + ' ' + word : word;
            if (g.measureText(t).width > maxText && cur) { wrap.push(cur); cur = word; } else cur = t;
          }
          if (cur) wrap.push(cur);
        }
        const w2 = Math.max(0, ...wrap.map(l => g.measureText(l).width));
        g.font = `600 ${f1}px ${sans}`; const w1 = g.measureText(lines[0]).width;
        const cw = Math.min(maxCard, Math.max(w1, w2) + ic + pad * 2.8), ch = pad * 2 + f1 + gap + wrap.length * lh2;
        const x0 = (W - cw) / 2, y0 = Math.max(8 * u, (H - ch) / 2), r = 12 * u;
        g.save(); g.shadowColor = 'rgba(15,30,50,0.25)'; g.shadowBlur = 24 * u; g.shadowOffsetY = 6 * u;
        g.fillStyle = 'rgba(255,255,255,0.97)';
        g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + cw, y0, x0 + cw, y0 + ch, r); g.arcTo(x0 + cw, y0 + ch, x0, y0 + ch, r); g.arcTo(x0, y0 + ch, x0, y0, r); g.arcTo(x0, y0, x0 + cw, y0, r); g.closePath(); g.fill();
        g.restore();
        g.strokeStyle = 'rgba(10,90,168,0.25)'; g.lineWidth = 1.5 * u; g.stroke();
        const ix = x0 + pad, iy = y0 + pad;
        g.fillStyle = '#0A5AA8'; g.beginPath(); g.arc(ix + ic / 2, iy + ic / 2, ic / 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2.2 * u; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(ix + ic * 0.25, iy + ic * 0.68); g.lineTo(ix + ic * 0.45, iy + ic * 0.45); g.lineTo(ix + ic * 0.6, iy + ic * 0.6); g.lineTo(ix + ic * 0.76, iy + ic * 0.36); g.stroke();
        const tx = ix + ic + pad * 0.8;
        g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        g.fillStyle = '#14202c'; g.font = `600 ${f1}px ${sans}`; g.fillText(lines[0], tx, y0 + pad + f1 * 0.85);
        g.fillStyle = '#4a5765'; g.font = `400 ${f2}px ${sans}`;
        wrap.forEach((l, k) => g.fillText(l, tx, y0 + pad + f1 + gap + k * lh2 + f2 * 0.9));
        res({ data: c.toDataURL('image/png').split(',')[1], w: im.w, h: im.h });
      };
      img.onerror = () => res(im);
      img.src = 'data:image/png;base64,' + im.data;
    });
  }
  function figSource(id) {
    const M = {
      d_lr2: 'модель lr2_model.slx — её строит скрипт lr2_model.m (папка LR2); снимок окна модели Simulink',
      d_lr3: 'модель lr3_model.slx — её строит скрипт lr3_model.m (папка LR3); снимок окна модели Simulink',
      d_lr4: 'модель lr4_model.slx — её строит скрипт lr4_model.m (папка LR4); снимок окна модели Simulink',
      d_lr5_pid: 'модель lr5_model_pid.slx — скрипт lr5_model_pid.m (папка LR5); снимок окна модели Simulink',
      d_lr5_id: 'модель lr5_model_id.slx — скрипт lr5_model_id.m (папка LR5); снимок окна модели Simulink',
      d_lr6_pid: 'модель lr6_model_pid.slx — скрипт lr6_model_pid.m (папка LR6); снимок окна модели Simulink',
      d_lr6_id: 'модель lr6_model_id.slx — скрипт lr6_model_id.m (папка LR6); снимок окна модели Simulink',
      lr2_w: 'скрипт lr2_model.m → окно figure «ЛР2: Ω(t)» (или блок Scope модели lr2_model.slx)',
      lr2_e: 'модель lr2_model.slx → сигнал рассогласования (блоки Display; переменная e_lr2 — plot(e_lr2.time, e_lr2.signals.values))',
      lr3_bode: 'скрипт lr3_raschet.m → окно figure «ЛР3: ЛЧХ» (margin(sys5))',
      lr3_step: 'скрипт lr3_model.m → окно figure «ЛР3: рис. 3.11» (Step = Uз, Step1 = 0)',
      lr3_dist: 'скрипт lr3_model.m → окно figure «ЛР3: рис. 3.12» (Step = 0, Step1 = −Mc0)',
      lr4_reg: 'скрипт lr4_raschet.m → окно figure «ЛР4: регулятор» (step(Wrz))',
      lr4_bode: 'скрипт lr4_raschet.m → окно figure «ЛР4: ЛПЧХ» (margin(Wv))',
      lr4_nyq: 'скрипт lr4_raschet.m → окно figure «ЛР4: АФЧХ» (nyquist(Wv))',
      lr4_step: 'скрипт lr4_model.m → окно figure «ЛР4: рис. 4.11»',
      lr4_dist: 'скрипт lr4_model.m → окно figure «ЛР4: рис. 4.12»',
      lr5_zh: 'скрипт lr5_raschet.m → окно figure «ЛР5: запретная область»',
      lr5_bode_pid: 'скрипт lr5_raschet.m → окно figure «ЛР5: ЛАЧХ РП (ν=2)»',
      lr5_bode_id: 'скрипт lr5_raschet.m → окно figure «ЛР5: ЛАЧХ РП (ν=1)»'
    };
    if (M[id]) return M[id];
    const m = id.match(/^lr([56])_(step|err|mc)_(pid|id)$/);
    if (m) {
      const nu = m[3] === 'pid' ? 2 : 1, n = m[1];
      const fig = { step: `«ЛР${n}: α(t) ν=${nu}» (опыт 1 — ступенчатое задание αз = 1 рад)`, err: `«ЛР${n}: ошибка ν=${nu}» (опыт 2 — ${nu === 2 ? 'квадратично' : 'линейно'} возрастающее задание)`, mc: `«ЛР${n}: моментная ошибка ν=${nu}» (опыт 3 — ${nu === 2 ? 'квадратично' : 'линейно'} возрастающий момент)` }[m[2]];
      return `скрипт lr${n}_model_${m[3]}.m → окно figure ${fig}`;
    }
    return 'соответствующий скрипт MATLAB';
  }
  function t2(id) { const m = id.match(/lr(\d)/); return m ? 'lr' + m[1] : 'lr1'; }
  function omml(src, inline, size) {
    const h = katex.renderToString(texify(src), { displayMode: !inline, output: 'mathml', throwOnError: false, strict: 'ignore' });
    const a = h.indexOf('<math'), b = h.lastIndexOf('</math>');
    let mm = h.slice(a, b + 7).replace(/^<math[^>]*>/, '<math xmlns="http://www.w3.org/1998/Math/MathML">');
    return OMML.convert(mm, { size: size || 28 });
  }
  const TEXCELL = c => { c = String(c === undefined || c === null ? '' : c); return /[_^{\\]/.test(c) && !/</.test(c); };
  const cellTex = c => String(c).replace(/Ω/g, '\\Omega').replace(/ε/g, '\\varepsilon').replace(/η/g, '\\eta').replace(/Δα/g, '\\Delta\\alpha').replace(/α/g, '\\alpha');
  async function buildDocxBlob(tabs, prog) {
    for (const t of tabs) for (const k of SIMKEY[t]) { prog && prog('Моделирование…'); await getSim(k); await sleep(5); }
    const png = {};
    const ids = [];
    for (const t of tabs) for (const it of S.R['L' + t.slice(2)].items) if (it.k === 'plot' || it.k === 'diagram') ids.push(it);
    for (let k = 0; k < ids.length; k++) {
      prog && prog('Рисунки ' + (k + 1) + '/' + ids.length);
      const it = ids[k];
      const im = it.k === 'diagram' ? await svgPng(it.id) : await plotPng(it.id);
      png[it.id] = im && S.T.watermark ? await watermark(im, [it.k === 'diagram' ? 'Замените схемой из MATLAB Simulink' : 'Замените рисунком из MATLAB', 'Что вставить: ' + it.title + '.', 'Откуда: ' + figSource(it.id)]) : im;
    }
    prog && prog('Сборка документа…');
    const simRows = id => {
      const sk = { sr_lr2: 'lr2', sr_lr3: 'lr3', sr_lr4: 'lr4', sr_lr5_pid: 'lr5pid', sr_lr5_id: 'lr5id', sr_lr6_pid: 'lr6pid', sr_lr6_id: 'lr6id' }[id];
      const r = S.sims[sk]; if (!r) return null;
      return sk === 'lr2' ? rowsLR2(r) : sk === 'lr3' ? rowsSpeed(r, null) : sk === 'lr4' ? rowsSpeed(r, S.sims.lr3) : rowsPos(sk.slice(3), r);
    };
    const meas = document.createElement('div'); meas.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden;white-space:nowrap;font-size:18.67px';
    document.body.appendChild(meas);
    const measure = t => { meas.innerHTML = katex.renderToString(texify(t), { displayMode: true, throwOnError: false, strict: 'ignore' }); const k = meas.querySelector('.katex'); return k ? k.getBoundingClientRect().width : 0; };
    const ctx = { S, L, omml, png, simRows, simLines: true, isTexCell: TEXCELL, cellTex, labFiles, measure };
    try { return await REPORT.build(ctx, tabs, S.T, { explain: S.T.explain, listings: S.T.listings, readable: S.T.readable, codePlain: S.T.codePlain, eqNum: !!S.T.eqNum, line1: !!S.T.line1 }); } finally { meas.remove(); }
  }
  function docxName(tabs) { return 'Otchet_' + (tabs.length > 1 ? 'LR1-6' : tabs[0].toUpperCase()) + '_var' + S.P.variant + '.docx'; }
  async function makeDocx(tabs, btn) {
    const old = btn.innerHTML; btn.disabled = true;
    try {
      const blob = await buildDocxBlob(tabs, t => { btn.innerHTML = '<span class="spinner"></span>' + t; });
      downloadBlob(docxName(tabs), blob);
      toast('Отчёт ' + docxName(tabs) + ' сформирован');
    } catch (e) { console.error(e); toast('Ошибка формирования отчёта: ' + e.message); }
    btn.disabled = false; btn.innerHTML = old;
  }
  window.__docxTest = tabs => buildDocxBlob(tabs).then(b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); }));
  async function renderAllPng(R) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;';
    document.body.appendChild(host);
    const out = {};
    const mk = () => { const d = document.createElement('div'); d.style.width = '900px'; host.appendChild(d); return d; };
    const snap = async (name, fn, h) => { const d = mk(); await fn(d); out[name] = await Plotly.toImage(d, { format: 'png', width: 900, height: h || 420, scale: 1.5 }); Plotly.purge(d); d.remove(); };
    const ex = { export: true };
    const s = S.sims;
    await snap('lr2_w', d => drawLR2(s.lr2, ex, { w: d, e: mk() }));
    await snap('lr2_e', d => CH.time(d, [{ x: s.lr2.sim.t, y: s.lr2.sim.e }], 't, с', 'Δu, В', ex));
    await snap('lr3_bode', d => { const w = NC.logspace(-1, 4.3, 700); const bd = NC.bodeData(x => NC.freq(R.lr3.Wks, x), w); return CH.bode(d, [{ w, mag: bd.mag, ph: bd.ph }], R.lr3.mg3, ex); }, 520);
    await snap('lr3_step', d => CH.time(d, [{ x: s.lr3.a.t, y: s.lr3.a.W }], 't, с', 'Ω(t), рад/с', ex));
    await snap('lr3_dist', d => CH.time(d, [{ x: s.lr3.b.t, y: s.lr3.b.W }], 't, с', 'Ω(t), рад/с', ex));
    await snap('lr4_reg', d => { const ss = R.lr4.ss4; let x = ss.A.map(() => 0); const tt = [], yy = []; const N = Math.min(80, Math.round(0.05 / S.P.T0)); for (let k = 0; k <= N; k++) { let y = ss.D[0][0]; ss.C[0].forEach((c, j) => y += c * x[j]); tt.push(k * S.P.T0); yy.push(y); x = ss.A.map((r, i) => r.reduce((q, a, j) => q + a * x[j], 0) + ss.B[i][0]); } return CH.stem(d, tt, yy, 't = kT0, с', 'uрс(kT0)', ex); });
    await snap('lr4_bode', d => { const w = NC.logspace(-1, 4.6, 700); const bd = NC.bodeData(R.lr4.Wol4, w); return CH.bode(d, [{ w, mag: bd.mag, ph: bd.ph }], R.lr4.mg4, Object.assign({ xl: 'ωυ, с⁻¹' }, ex)); }, 520);
    await snap('lr4_nyq', d => { const wn = NC.logspace(0, 5, 1500); const nb = NC.bodeData(R.lr4.Wol4, wn); return CH.nyquist(d, nb.re, nb.im, ex); }, 520);
    await snap('lr4_step', d => CH.time(d, [{ x: s.lr4.a.t, y: s.lr4.a.W, name: 'цифровой РС' }, { x: s.lr3.a.t, y: s.lr3.a.W, name: 'аналоговый РС', dash: 'dash' }], 't, с', 'Ω(t), рад/с', ex));
    await snap('lr4_dist', d => CH.time(d, [{ x: s.lr4.b.t, y: s.lr4.b.W, name: 'цифровой РС' }, { x: s.lr3.b.t, y: s.lr3.b.W, name: 'аналоговый РС', dash: 'dash' }], 't, с', 'Ω(t), рад/с', ex));
    await snap('lr5_zh', d => drawForbidden(d, ex));
    await snap('lr5_bode_pid', d => drawRegBode('pid', d, ex));
    await snap('lr5_bode_id', d => drawRegBode('id', d, ex));
    for (const t of ['lr5', 'lr6']) for (const kind of ['pid', 'id']) {
      const r = s[t + kind];
      await snap(t + '_step_' + kind, d => CH.time(d, [{ x: r.s1.t, y: r.s1.alpha }], 't, с', 'α(t), рад', ex));
      await snap(t + '_err_' + kind, d => CH.time(d, [{ x: r.s2.t, y: r.s2.ea }], 't, с', 'Δα, рад', ex));
      await snap(t + '_mc_' + kind, d => CH.time(d, [{ x: r.s3.t, y: r.s3.ea }], 't, с', 'Δαм, рад', ex));
    }
    host.remove();
    return out;
  }
  function csvOf(cols) {
    const keys = Object.keys(cols); const n = cols[keys[0]].length;
    let s = keys.join(';') + '\n';
    for (let i = 0; i < n; i++) s += keys.map(k => (+cols[k][i]).toPrecision(8)).join(';') + '\n';
    return s;
  }
  function allCsv() {
    const s = S.sims, o = {};
    if (s.lr2) o.lr2_W_e = csvOf({ t: s.lr2.sim.t, Omega: s.lr2.sim.W, du: s.lr2.sim.e });
    if (s.lr3) { o.lr3_step = csvOf({ t: s.lr3.a.t, Omega: s.lr3.a.W }); o.lr3_load = csvOf({ t: s.lr3.b.t, Omega: s.lr3.b.W }); }
    if (s.lr4) { o.lr4_step = csvOf({ t: s.lr4.a.t, Omega: s.lr4.a.W }); o.lr4_load = csvOf({ t: s.lr4.b.t, Omega: s.lr4.b.W }); }
    for (const k of ['lr5pid', 'lr5id', 'lr6pid', 'lr6id']) if (s[k]) {
      o[k + '_step'] = csvOf({ t: s[k].s1.t, alpha: s[k].s1.alpha });
      o[k + '_error'] = csvOf({ t: s[k].s2.t, dalpha: s[k].s2.ea });
      o[k + '_load'] = csvOf({ t: s[k].s3.t, dalpha_m: s[k].s3.ea });
    }
    return o;
  }
  function reportHtml(R, imgs) {
    const parts = [];
    for (const no of [1, 2, 3, 4, 5, 6]) {
      const tab = 'lr' + no; let fig = 0;
      let h = `<section><h1>Лабораторная работа № ${no}. ${esc(TITLES[tab])}</h1>`;
      for (const it of R['L' + no].items) {
        if (it.k === 'plot') { fig++; h += imgs.includes(it.id) ? `<figure><img src="img/${it.id}.png" alt=""><figcaption>Рис. ${no}.${fig}. ${esc(it.title)}</figcaption></figure>` : ''; }
        else if (it.k === 'diagram') h += `<figure class="dg">${diagramSvg(it.id)}<figcaption>${esc(it.title)}</figcaption></figure>`;
        else if (it.k === 'simres') {
          const sk = { sr_lr2: 'lr2', sr_lr3: 'lr3', sr_lr4: 'lr4', sr_lr5_pid: 'lr5pid', sr_lr5_id: 'lr5id', sr_lr6_pid: 'lr6pid', sr_lr6_id: 'lr6id' }[it.id];
          const r = S.sims[sk];
          if (r) {
            const rows = sk === 'lr2' ? rowsLR2(r) : sk === 'lr3' ? rowsSpeed(r, null) : sk === 'lr4' ? rowsSpeed(r, S.sims.lr3) : rowsPos(sk.slice(3), r);
            h += simTableHtml(it.title, rows);
          }
        }
        else h += renderItems([it], tab);
      }
      parts.push(h + '</section>');
    }
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Вариант ${S.P.variant} — ЛР 1–6</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>body{font:15px/1.5 "IBM Plex Sans","Segoe UI",Arial,sans-serif;color:#1a222b;max-width:1000px;margin:0 auto;padding:24px}
h1{font-size:22px;border-bottom:2px solid #1a222b;padding-bottom:6px;margin-top:48px}h2{font-size:17px;margin-top:26px}
table{border-collapse:collapse;margin:10px 0;font-size:13px}td,th{border:1px solid #aab4bf;padding:4px 8px;text-align:left}caption{text-align:left;font-weight:600;padding:4px 0}
.eq,.tex{overflow-x:auto}.katex-display{text-align:left;margin:4px 0}.katex-display>.katex{text-align:left}
.check{padding:6px 10px;border:1px solid #9cc7ab;background:#eef8f1;margin:6px 0}.check.bad{border-color:#e0a49d;background:#fbeceb}.mark{font-weight:700;margin-right:8px}
.note{padding:6px 10px;border-left:3px solid #0a5aa8;background:#eef4fb;margin:8px 0}.note.warn{border-color:#9a6512;background:#fbf4e6}.note.bad{border-color:#b8352a;background:#fbeceb}
figure{margin:14px 0}figure img{max-width:100%;border:1px solid #ccd4dd}figcaption{font-size:13px;color:#5a6776}
pre{background:#f4f6f8;padding:10px;overflow:auto;font-size:12px}.code-head{font-family:monospace;font-size:12px;background:#e9edf1;padding:4px 8px}.acts,button,.approx{display:none!important}
svg.ssdm .wire{fill:none;stroke:#1a222b;stroke-width:1.2}svg.ssdm .arrowhead{fill:#1a222b}svg.ssdm .blk{fill:#fff;stroke:#1a222b;stroke-width:1.2}svg.ssdm .blk.acc{fill:#dce9f7;stroke:#0a5aa8}svg.ssdm .blk.dsh{stroke-dasharray:5 3;fill:#f2f5f8}
svg.ssdm .bt{font:12px monospace;fill:#1a222b}svg.ssdm .frac{stroke:#1a222b}svg.ssdm .cap{font:10.5px sans-serif;fill:#5a6776}svg.ssdm .sum{fill:#fff;stroke:#1a222b}svg.ssdm .sumx{stroke:#1a222b;stroke-width:.8}svg.ssdm .sg{font:600 12px monospace;fill:#1a222b}svg.ssdm .lbl{font:italic 12.5px sans-serif;fill:#c9531a}svg.ssdm .dot{fill:#1a222b}
.calc{border:1.5px dashed #a9b4c0;background:#f3f5f8;padding:6px 12px;margin:8px 0;border-radius:6px}.calc-math{overflow-x:auto}.calc-tools{display:none}.calc-desc{font-size:13px;color:#5a6776;border-top:1px dashed #ccd4dd;padding-top:4px}.dg{overflow-x:auto}.pill{font-weight:600}.pill.ok{color:#2b7a4b}.pill.bad{color:#b8352a}
@media print{h1{page-break-before:always}section:first-child h1{page-break-before:avoid}pre{max-height:none}}</style></head><body>
<p><b>Вариант ${S.P.variant}</b> · J<sub>н</sub> = ${S.P.Jn} кг·м², M<sub>c</sub> = ${S.P.Mc} Н·м, Ω<sub>max</sub> = ${S.P.W} град/с, ε<sub>max</sub> = ${S.P.E} град/с², M = ${S.P.M}, η = ${S.P.eta}, Δα<sub>Ω</sub> = ${S.P.dAW}′, Δα<sub>ε</sub> = ${S.P.dAE}′, α<sub>max</sub> = ${S.P.alphaMax}°</p>
${parts.join('\n')}</body></html>`;
  }
  /* ---------------- прочее ---------------- */
  let toastT = null;
  function toast(t) {
    let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2800);
  }
  function go(tab) { S.tab = tab; S.skipAuto = true; save(); setHash(); renderTab(); window.scrollTo({ top: 0 }); }
  function themeToggle() {
    const r = document.documentElement;
    const cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', nx);
    try { localStorage.setItem('suite-theme', nx); } catch (e) { /* ignore */ }
    if (S.tab !== 'data') renderTab();
  }

  function init() {
    try { const th = localStorage.getItem('suite-theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) { /* ignore */ }
    $('#rail').innerHTML = LABS_META.map(m => `<a href="#" data-tab="${m.id}"><span class="no" data-short="${m.short}">${m.no === '0' ? '◦' : m.no}</span><span class="t">${m.t}</span><span class="s">${m.s}</span></a>`).join('') + '<div class="rail-foot" id="rail-foot"></div>';
    $$('nav.rail a').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.tab); });
    $('#var-sel').onchange = e => setVariant(+e.target.value);
    $('#var-prev').onclick = () => setVariant(S.P.variant - 1);
    $('#var-next').onclick = () => setVariant(S.P.variant + 1);
    $('#share').onclick = share;
    $('#theme').onclick = themeToggle;
    window.addEventListener('suite:style', () => { if (S.tab !== 'data') renderTab(); });   // новый стиль — перерисовать графики в его цветах и шрифтах
    const setTopH = () => document.documentElement.style.setProperty('--top-h', $('.top').offsetHeight + 'px');
    window.addEventListener('resize', setTopH); setTopH();
    load(); loadT();
    const au = getAuto();
    if (S.shared) { S.skipAuto = true; recompute(); toast('Открыт расчёт по ссылке'); }
    else if (au && au.P && !/^#v\d/.test(location.hash || '')) {   // ссылка с вариантом открывается сразу, без вопроса об автосохранении
      // начинаем с чистого состояния и предлагаем вернуться к автосохранению
      S.P = L.fromVariant(1); S.T = Object.assign({}, T_DEF); S.tab = 'data';
      S.skipAuto = true; recompute();
      askResume(au);
    } else { S.skipAuto = true; recompute(); }
  }
  function askResume(au) {
    const d = document.createElement('div');
    d.className = 'modal-back';
    d.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rs-t"><h2 id="rs-t">Продолжить с того места?</h2>
      <p>Найдено автосохранение:</p><div class="modal-card"><b>${au.T && au.T.student ? esc(au.T.student) : 'Последняя работа'}</b><span>${slotMeta(au)}</span></div>
      <p class="dhint">«Начать заново» сбросит параметры и настройки к значениям по умолчанию. Автосохранение при этом не удаляется — к нему можно вернуться в разделе «Сохранения», пока вы не начнёте вносить изменения.</p>
      <div class="modal-act"><button class="btn" id="rs-new">Начать заново</button><button class="btn primary" id="rs-go">Продолжить</button></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    $('#rs-go', d).onclick = () => {
      S.P = Object.assign(L.defaults(), au.P); S.T = Object.assign({}, T_DEF, au.T || {});
      if (au.tab) S.tab = au.tab;
      S.skipAuto = true; saveT(); S.skipAuto = true; close(); recompute();
    };
    $('#rs-new', d).onclick = () => { S.skipAuto = true; saveT(); close(); toast('Начато заново'); };
    setTimeout(() => $('#rs-go', d).focus(), 30);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
