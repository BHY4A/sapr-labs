/* =====================================================================
 * labs.js — расчёты лабораторных работ №1–6 по методике практикума
 * «Расчёт и моделирование электроприводов с регуляторами различной
 *  конфигурации» (Погодицкий О.В. и др., КГЭУ, 2014).
 * ===================================================================== */
(function (root) {
  'use strict';
  const NC = root.NC || (typeof require !== 'undefined' ? require('./core.js') : null);
  const D = root.LABDATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const PI = Math.PI, d2r = PI / 180;
  /* перевод град → рад: точно (π/180) или как в методичке — делением на 57 */
  const D2R = P => P && P.deg57 ? 1 / 57 : d2r;

  /* ---------- форматирование ---------- */
  let DIG = -1;  // точность вывода: −1 — авто (4 значащие цифры без округления целой части), иначе знаков после запятой (P.dec)
  /* число знаков после запятой; у малых чисел — не меньше двух значащих цифр */
  function fdec(x, N) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-4) return fnum(x, N + 1);
    let s = ax < Math.pow(10, 1 - N) ? x.toPrecision(2) : x.toFixed(N);
    s = parseFloat(s).toString();
    return s.replace('.', ',');
  }
  /* авто: 4 значащие цифры, но целая часть никогда не округляется */
  function fauto(x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-4) return fnum(x, 4);
    const d = Math.floor(Math.log10(ax)) + 1;
    const s = d >= 4 ? String(Math.round(x)) : parseFloat(x.toPrecision(4)).toString();
    return s.replace('.', ',');
  }
  function fnum(x, sig) {
    if (!sig) return DIG < 0 ? fauto(x) : fdec(x, DIG);
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e5 || ax < 1e-4) {
      const e = Math.floor(Math.log10(ax));
      let m = x / Math.pow(10, e);
      let ms = parseFloat(m.toPrecision(sig)).toString();
      if (ms === '10' || ms === '-10') { m /= 10; ms = parseFloat(m.toPrecision(sig)).toString(); return ms.replace('.', ',') + '·10^' + (e + 1); }
      return ms.replace('.', ',') + '·10^' + e;
    }
    let s;
    if (ax >= 1000) { const d = Math.floor(Math.log10(ax)) + 1; s = d > sig ? String(Math.round(x / Math.pow(10, d - sig)) * Math.pow(10, d - sig)) : parseFloat(x.toFixed(sig - d)).toString(); }
    else s = parseFloat(x.toPrecision(sig)).toString();
    return s.replace('.', ',');
  }
  // для LaTeX
  function n(x, sig) {
    const s = fnum(x, sig);
    if (s.indexOf('·10^') >= 0) { const [m, e] = s.split('·10^'); return m.replace(',', '{,}') + '\\cdot 10^{' + e + '}'; }
    return s.replace(',', '{,}').replace('−', '-');
  }
  // для MATLAB
  function m(x) {
    if (!isFinite(x)) return x > 0 ? 'Inf' : '-Inf';
    if (x === 0) return '0';
    const s = parseFloat(x.toPrecision(10)).toString();
    return s.replace('e+', 'e');
  }
  function mvec(a) { return '[' + a.map(m).join(' ') + ']'; }
  function mmat(A) { return '[' + A.map(r => r.map(m).join(' ')).join('; ') + ']'; }
  // округление «как в методичке»: 3 знака после запятой (если получился 0 — 3 значащие цифры)
  function r3(x) { const r = Math.round(x * 1000) / 1000; return r === 0 ? parseFloat(x.toPrecision(3)) : r; }
  function s3(x) { return parseFloat(x.toPrecision(3)); }

  /* ---------- построитель отчёта ---------- */
  function Report() { this.items = []; }
  Report.prototype.h = function (t) { this.items.push({ k: 'h', t }); return this; };
  Report.prototype.p = function (t) { this.items.push({ k: 'p', t }); return this; };
  Report.prototype.note = function (t, kind) { this.items.push({ k: 'note', t, kind: kind || 'info' }); return this; };
  Report.prototype.eq = function (lhs, formula, subst, val, unit, sig) {
    this.items.push({ k: 'eq', lhs, formula, subst, val, unit: unit || '', sig: sig || 4 }); return this;
  };
  Report.prototype.tex = function (t) { this.items.push({ k: 'tex', t }); return this; };
  Report.prototype.check = function (tex, ok, text) { this.items.push({ k: 'check', tex, ok, t: text }); return this; };
  Report.prototype.table = function (head, rows, caption) { this.items.push({ k: 'table', head, rows, caption }); return this; };
  Report.prototype.code = function (t, lang, title) { this.items.push({ k: 'code', t, lang: lang || 'matlab', title }); return this; };
  // пометки для отчёта Word: элемент только для сайта / иной текст в отчёте
  Report.prototype.webOnly = function () { this.items[this.items.length - 1].web = true; return this; };
  Report.prototype.rep = function (t) { this.items[this.items.length - 1].rep = t; return this; };
  Report.prototype.plot = function (id, title) { this.items.push({ k: 'plot', id, title }); return this; };
  Report.prototype.simres = function (id, title) { this.items.push({ k: 'simres', id, title }); return this; };
  Report.prototype.diagram = function (id, title) { this.items.push({ k: 'diagram', id, title }); return this; };

  function polyTex(p, v) {
    v = v || 's';
    const deg = p.length - 1; const parts = [];
    p.forEach((c, i) => {
      if (Math.abs(c) < 1e-300) return;
      const pw = deg - i;
      const ac = Math.abs(c);
      let cs = (pw > 0 && Math.abs(ac - 1) < 1e-12) ? '' : n(ac, 4);
      let t = cs + (pw > 0 ? (cs ? '\\,' : '') + v + (pw > 1 ? '^{' + pw + '}' : '') : '');
      parts.push({ neg: c < 0, t });
    });
    if (!parts.length) return '0';
    return parts.map((q, i) => (i === 0 ? (q.neg ? '-' : '') : (q.neg ? ' - ' : ' + ')) + q.t).join('');
  }
  function tfTex(sys, v) { return '\\dfrac{' + polyTex(sys.num, v) + '}{' + polyTex(sys.den, v) + '}'; }

  /* ---------- исходные данные по умолчанию ---------- */
  function defaults() {
    return {
      variant: 1,
      Jn: 142, Mc: 250, W: 10, E: 6, M: 1.1, eta: 0.8, dAW: 10, dAE: 35,
      alphaMax: 20,      // максимальный угол поворота исполнительного вала, град (в табл. П.8 отсутствует)
      Uz: 10, dUw: 10, Uos: 10, Ua: 10,
      f: 50, mph: 3, p: 6, gamma: 30, kId: 0.2, xa: 0, p1: 10, KI: 2.5, Kv: 0.33,
      Rd1: 10000, Tf0: 0.01, Nr: 10, T0: 0.001, T1zh: 'auto',
      roundManual: true, roundGear: true, deg57: 57, dec: -1,
      motor: 'auto', tach: 3, vt: 6, C1: 'auto', C2: 'auto',
      lr5mode: 'auto'
    };
  }
  function fromVariant(no) {
    const v = D.variants.find(x => x.no === +no);
    const d = defaults();
    return Object.assign(d, { variant: v.no, Jn: v.Jn, Mc: v.Mc, W: v.W, E: v.E, M: v.M, eta: v.eta, dAW: v.dAW, dAE: v.dAE });
  }

  /* ---------- выбор двигателя ---------- */
  function evalMotor(mo, P) {
    const Wm = P.W * D2R(P), Em = P.E * D2R(P);
    const Jd = mo.J * 1e-4, Wn = PI * mo.n / 30, Mn = mo.P * 1000 / Wn;
    const i0raw = Math.sqrt((P.Jn * Em * P.eta + P.Mc) / (Jd * Em * P.eta));
    const i0 = P.roundGear ? Math.round(i0raw) : i0raw;
    const speedOk = Wn > i0 * Wm;
    const i1raw = Wn / Wm;
    const i = speedOk ? i0 : (P.roundGear ? Math.round(i1raw) : i1raw);
    const Mvr = (Jd + P.Jn / (i * i)) * i * Em + P.Mc / (i * P.eta);
    const Mci = P.Mc / (i * P.eta);
    const ok1 = Mvr / Mn <= 2, ok2 = Mci <= Mn;
    return { Jd, Wn, Mn, i0raw, i0, speedOk, i1raw, i, Mvr, Mci, ok1, ok2, ok: ok1 && ok2 };
  }
  function autoMotor(P, Ptr) {
    const order = D.motors.slice().sort((a, b) => a.P - b.P || a.id - b.id);
    for (const mo of order) { if (mo.P * 1000 < Ptr) continue; const e = evalMotor(mo, P); if (e.ok) return mo.id; }
    return order[order.length - 1].id;
  }

  /* =================================================================
   * ГЛАВНЫЙ РАСЧЁТ
   * ================================================================= */
  function compute(P) {
    DIG = P.dec === undefined || +P.dec < 0 ? -1 : Math.min(6, +P.dec);
    const R = {}; R.P = P;
    const rp = P.roundManual ? r3 : (x => x);
    const rs = P.roundManual ? s3 : (x => x);
    const warn = [];

    /* ======================= ЛР1 ======================= */
    const L1 = new Report();
    const Wm = P.W * D2R(P), Em = P.E * D2R(P);
    L1.h('1.1. Исходные данные (вариант ' + P.variant + ', табл. П.8)').webOnly();
    L1.table(['Параметр', 'Обозначение', 'Значение'], [
      ['Момент инерции нагрузки', 'J_н', fnum(P.Jn) + ' кг·м²'],
      ['Момент сопротивления нагрузки', 'M_{c0}', fnum(P.Mc) + ' Н·м'],
      ['Макс. угловая скорость нагрузки', 'Ω_{max}', fnum(P.W) + ' град/с = ' + fnum(Wm) + ' рад/с'],
      ['Макс. угловое ускорение нагрузки', 'ε_{max}', fnum(P.E) + ' град/с² = ' + fnum(Em) + ' рад/с²'],
      ['Показатель колебательности', 'M', fnum(P.M)],
      ['КПД редуктора', 'η', fnum(P.eta)],
      ['Ошибка по скорости', 'Δα_Ω', fnum(P.dAW) + ' угл. мин'],
      ['Ошибка по ускорению', 'Δα_ε', fnum(P.dAE) + ' угл. мин'],
      ['Макс. угол поворота вала (для ВТ)', 'α_{max}', fnum(P.alphaMax) + ' град']
    ]);
    const degTex = v => P.deg57 ? `\\dfrac{${n(v)}}{57}` : `${n(v)}\\cdot\\dfrac{\\pi}{180}`;
    L1.p('Переводим угловую скорость и ускорение нагрузки в радианную меру' + (P.deg57 ? ' (1 рад ≈ 57°):' : ':'));
    L1.eq('\\Omega_{max}', null, degTex(P.W), Wm, 'рад/с');
    L1.eq('\\varepsilon_{max}', null, degTex(P.E), Em, 'рад/с²');

    L1.h('1.2. Двигатель постоянного тока');
    const Ptr = 2 * (P.Jn * Em + P.Mc / P.eta) * Wm;
    L1.eq('P_{тр}', '2\\left(J_н\\varepsilon_{max}+\\dfrac{M_{c0}}{\\eta}\\right)\\Omega_{max}',
      `2\\left(${n(P.Jn)}\\cdot ${n(Em)}+\\dfrac{${n(P.Mc)}}{${n(P.eta)}}\\right)\\cdot ${n(Wm)}`, Ptr, 'Вт');
    const autoId = autoMotor(P, Ptr);
    const mid = P.motor === 'auto' ? autoId : +P.motor;
    const mo = D.motors[mid];
    const me = evalMotor(mo, P);
    R.motorAuto = autoId; R.motorId = mid;
    {
      const rows = D.motors.filter(x => x.P * 1000 >= Ptr).sort((a, b) => a.P - b.P || a.id - b.id).slice(0, 8).map(x => {
        const e = evalMotor(x, P);
        return [x.type + ' (' + fnum(x.P) + ' кВт, ' + x.U + ' В, ' + x.n + ' об/мин)', fnum(e.i0), e.speedOk ? 'да' : 'нет → i₁ = ' + fnum(e.i), fnum(e.Mvr / e.Mn, 3), fnum(e.Mci, 3) + ' / ' + fnum(e.Mn, 3), e.ok ? '✓ проходит' : '✗'];
      });
      L1.table(['Двигатель', 'i<sub>о</sub>', 'Ω<sub>ном</sub> > i<sub>о</sub>·Ω<sub>max</sub>', 'M<sub>вр</sub>/M<sub>ном</sub> ≤ 2', 'M<sub>c0</sub>/(iη) ≤ M<sub>ном</sub>', 'Итог'], rows, 'Проверка ближайших по мощности двигателей табл. П.1 (P ≥ Pтр)').webOnly();
    }
    L1.p(`Выбираем по табл. П.1 двигатель с P<sub>ном</sub> ≥ P<sub>тр</sub> = ${fnum(Ptr / 1000)} кВт, удовлетворяющий проверкам по скорости и моменту: <b>${mo.type}</b> (${fnum(mo.P)} кВт, ${mo.U} В, ${mo.n} об/мин)` + (P.motor === 'auto' ? ' — выбран автоматически (наименьшая мощность, проходящая все проверки).' : ' — выбран вручную.'));
    L1.rep(`Выбираем по табл. П.1 двигатель с P<sub>ном</sub> ≥ P<sub>тр</sub> = ${fnum(Ptr / 1000)} кВт, удовлетворяющий проверкам по скорости и моменту, — <b>${mo.type}</b> (${fnum(mo.P)} кВт, ${mo.U} В, ${mo.n} об/мин).`);
    L1.table(['Тип', 'P<sub>ном</sub>, кВт', 'U<sub>ном</sub>, В', 'n<sub>ном</sub>, мин⁻¹', 'η<sub>ном</sub>, %', 'R<sub>я</sub>, Ом', 'R<sub>д.п.</sub>, Ом', 'L<sub>я</sub>, мГн', 'J<sub>дв</sub>·10⁻⁴, кг·м²'],
      [[mo.type, fnum(mo.P), mo.U, mo.n, fnum(mo.eta), fnum(mo.Ra), fnum(mo.Rdp), fnum(mo.La), mo.J]], 'Технические характеристики выбранного двигателя');
    if (mo.P * 1000 < Ptr) L1.note('Мощность выбранного двигателя меньше требуемой!', 'bad');
    L1.eq('i_о', '\\sqrt{\\dfrac{J_н\\varepsilon_{max}\\eta+M_{c0}}{J_{дв}\\varepsilon_{max}\\eta}}',
      `\\sqrt{\\dfrac{${n(P.Jn)}\\cdot ${n(Em)}\\cdot ${n(P.eta)}+${n(P.Mc)}}{${n(me.Jd)}\\cdot ${n(Em)}\\cdot ${n(P.eta)}}}`, me.i0raw, '');
    if (P.roundGear) L1.p('Принимаем i<sub>о</sub> = ' + fnum(me.i0) + ' (округление до целого).');
    L1.eq('\\Omega_{ном}', '\\dfrac{\\pi n_{ном}}{30}', `\\dfrac{\\pi\\cdot ${n(mo.n)}}{30}`, me.Wn, 'рад/с');
    L1.eq('M_{ном}', '\\dfrac{P_{ном}}{\\Omega_{ном}}', `\\dfrac{${n(mo.P * 1000)}}{${n(me.Wn)}}`, me.Mn, 'Н·м');
    L1.eq('i_о\\Omega_{max}', '', `${n(me.i0)}\\cdot ${n(Wm)}`, me.i0 * Wm, 'рад/с');
    L1.check(`\\Omega_{ном}=${n(me.Wn)} ${me.speedOk ? '>' : '\\le'} i_о\\Omega_{max}=${n(me.i0 * Wm)}`, me.speedOk,
      me.speedOk ? 'Требование по скорости выполняется, i = iо.' : 'Требование по скорости не выполняется — рассчитываем новое передаточное число.');
    if (!me.speedOk) {
      L1.eq('i_1', '\\dfrac{\\Omega_{ном}}{\\Omega_{max}}', `\\dfrac{${n(me.Wn)}}{${n(Wm)}}`, me.i1raw, '');
      if (P.roundGear) L1.p('Принимаем i<sub>1</sub> = ' + fnum(me.i) + '.');
    }
    const i = me.i;
    L1.eq('M_{вр}', '\\left(J_{дв}+\\dfrac{J_н}{i^2}\\right)i\\varepsilon_{max}+\\dfrac{M_{c0}}{i\\eta}',
      `\\left(${n(me.Jd)}+\\dfrac{${n(P.Jn)}}{${n(i)}^2}\\right)\\cdot ${n(i)}\\cdot ${n(Em)}+\\dfrac{${n(P.Mc)}}{${n(i)}\\cdot ${n(P.eta)}}`, me.Mvr, 'Н·м');
    L1.check(`\\dfrac{M_{вр}}{M_{ном}}=\\dfrac{${n(me.Mvr)}}{${n(me.Mn)}}=${n(me.Mvr / me.Mn)} \\le 2`, me.ok1, me.ok1 ? 'Выполняется' : 'Не выполняется — нужен более мощный двигатель');
    L1.check(`\\dfrac{M_{c0}}{i\\eta}=${n(me.Mci)}\\ \\text{Н·м} \\le M_{ном}=${n(me.Mn)}\\ \\text{Н·м}`, me.ok2, me.ok2 ? 'Выполняется' : 'Не выполняется — нужен более мощный двигатель');
    const Inom = mo.P * 1000 / (mo.U * mo.eta / 100);
    L1.eq('I_{ном}', '\\dfrac{P_{ном}}{U_{ном}\\eta_{ном}}', `\\dfrac{${n(mo.P * 1000)}}{${n(mo.U)}\\cdot ${n(mo.eta / 100)}}`, Inom, 'А');
    const Rr = mo.Ra + mo.Rdp;
    L1.eq('R', 'R_я+R_{д.п.}', `${n(mo.Ra)}+${n(mo.Rdp)}`, Rr, 'Ом');
    const c_raw = (mo.U - Inom * Rr) / me.Wn; const c = rp(c_raw);
    L1.eq('c', '\\dfrac{U_{ном}-I_{ном}R}{\\Omega_{ном}}', `\\dfrac{${n(mo.U)}-${n(Inom)}\\cdot ${n(Rr)}}{${n(me.Wn)}}`, c_raw, 'В·с/рад');
    const Jsum = me.Jd + P.Jn / (i * i);
    const Tm_raw = Jsum * Rr / (c * c); const Tm = rp(Tm_raw);
    L1.eq('T_м', '\\dfrac{\\left(J_{дв}+\\dfrac{J_н}{i^2}\\right)R}{c^2}', `\\dfrac{\\left(${n(me.Jd)}+\\dfrac{${n(P.Jn)}}{${n(i)}^2}\\right)\\cdot ${n(Rr)}}{${n(c)}^2}`, Tm_raw, 'с');
    const La = mo.La / 1000;
    L1.eq('T_э', '\\dfrac{L_я}{R}', `\\dfrac{${n(La)}}{${n(Rr)}}`, La / Rr, 'с');
    L1.note('Tэ будет уточнена после выбора дросселей (п. 1.3).');

    /* --- ТП --- */
    L1.h('1.3. Тиристорный преобразователь');
    const g = P.gamma * d2r;
    const U2l = Math.sqrt(3) * mo.U;
    const Idgr = P.kId * Inom;
    L1.p(`Трёхфазная мостовая схема: p = ${fnum(P.p)}, γ = ${fnum(P.gamma)}°, x<sub>а.ф.</sub> = ${fnum(P.xa)}, f = ${fnum(P.f)} Гц, I<sub>d,гр</sub> = ${fnum(P.kId)}·I<sub>ном</sub>, U<sub>2л</sub> = √3·U<sub>ном</sub> = ${fnum(U2l)} В.`);
    const Ld1 = (0.126 * U2l / Idgr * Math.sin(g) - 2 * P.xa) / (2 * PI * P.f);
    L1.eq('L_{d1}', '\\dfrac{1}{2\\pi f}\\left(0{,}126\\dfrac{U_{2л}}{I_{d,гр}}\\sin\\gamma-2x_{а.ф.}\\right)',
      `\\dfrac{1}{2\\pi\\cdot ${P.f}}\\left(0{,}126\\cdot\\dfrac{${n(U2l)}}{${n(Idgr)}}\\sin ${P.gamma}^\\circ-2\\cdot ${P.xa}\\right)`, Ld1, 'Гн');
    const k = 1, pp = P.p, w = 2 * PI * P.f;
    const Udnm = mo.U * 2 * Math.cos(g) / (k * k * pp * pp - 1) * Math.sqrt(1 + k * k * pp * pp * Math.tan(g) ** 2);
    L1.eq('U_{d,n,m}', 'U_{d0}\\dfrac{2\\cos\\gamma}{k^2p^2-1}\\sqrt{1+k^2p^2\\,\\mathrm{tg}^2\\gamma}',
      `${mo.U}\\cdot\\dfrac{2\\cos ${P.gamma}^\\circ}{1^2\\cdot ${pp}^2-1}\\sqrt{1+1^2\\cdot ${pp}^2\\,\\mathrm{tg}^2 ${P.gamma}^\\circ}`, Udnm, 'В');
    const Ld2 = 100 * Udnm / (Math.SQRT2 * k * pp * w * P.p1 * Inom);
    L1.eq('L_{d2}', '\\dfrac{100\\,U_{d,n,m}}{\\sqrt2\\,k p\\omega p_{(1)}\\%\\,I_{d,н}}',
      `\\dfrac{100\\cdot ${n(Udnm)}}{\\sqrt2\\cdot 1\\cdot ${pp}\\cdot ${n(w)}\\cdot ${P.p1}\\cdot ${n(Inom)}}`, Ld2, 'Гн');
    const Lreq = Math.max(Ld1, Ld2) - La;
    let choke = null, nCh = 0, Lch = 0;
    L1.check(`\\max(L_{d1},L_{d2})=${n(Math.max(Ld1, Ld2))}\\ \\text{Гн} ${Lreq > 0 ? '>' : '\\le'} L_я=${n(La)}\\ \\text{Гн}`, Lreq <= 0,
      Lreq <= 0 ? 'Индуктивности якоря достаточно — дополнительные дроссели не нужны, L = Lя.' : 'Требуется дроссель с индуктивностью Lдр ≥ ' + fnum(Lreq * 1000) + ' мГн.');
    if (Lreq > 0) {
      const cand = D.chokes.filter(c0 => c0.L / 1000 >= Lreq);
      if (cand.length) { choke = cand[0]; nCh = 1; }
      else { choke = D.chokes[D.chokes.length - 1]; nCh = Math.ceil(Lreq / (choke.L / 1000)); }
      Lch = nCh * choke.L / 1000;
      L1.eq('L_{др}', '\\max(L_{d1},L_{d2})-L_я', `${n(Math.max(Ld1, Ld2))}-${n(La)}`, Lreq, 'Гн');
      L1.p(`По табл. П.2 выбираем дроссель <b>${choke.name}</b>${nCh > 1 ? ' — ' + nCh + ' шт. последовательно' : ''}: L = ${fnum(choke.L)} мГн, R = ${fnum(choke.R)} Ом, I = ${fnum(choke.I)} А.`);
      L1.table(['Наименование', 'L, мГн', 'Точность, %', 'Тест. частота, кГц', 'R пост. току, Ом', 'Пост. ток, А'], [[choke.name + (nCh > 1 ? ' ×' + nCh : ''), choke.L, choke.acc, choke.f, choke.R, choke.I]]);
      if (choke.I < Inom) L1.note(`Допустимый ток дросселя (${fnum(choke.I)} А) меньше I<sub>ном</sub> = ${fnum(Inom)} А. В методичке проверка по току не выполняется; при оформлении можно указать параллельное включение или дроссель на больший ток.`, 'warn').webOnly();
    }
    const Ltot = La + Lch;
    const Te_raw = Ltot / Rr; const Te = rp(Te_raw);
    L1.eq('L', Lch > 0 ? 'L_я+L_{др}' : 'L_я', Lch > 0 ? `${n(La)}+${n(Lch)}` : n(La), Ltot, 'Гн');
    L1.eq('T_э', '\\dfrac{L}{R}', `\\dfrac{${n(Ltot)}}{${n(Rr)}}`, Te_raw, 'с');
    const caseA = Tm >= 4 * Te;
    L1.check(`T_м=${n(Tm)}\\ \\text{с} ${caseA ? '\\ge' : '<'} 4T_э=${n(4 * Te)}\\ \\text{с}`, true,
      caseA ? 'Случай «а» (Tм ≥ 4Tэ): ПФ двигателя — апериодическое звено 2-го порядка.' : 'Случай «б» (Tм < 4Tэ): ПФ двигателя — колебательное звено (комплексно-сопряжённые корни).');
    const Imax = P.KI * P.Kv * Inom;
    L1.eq('I_{max}', 'K_I K_в I_{ном}', `${n(P.KI)}\\cdot ${n(P.Kv)}\\cdot ${n(Inom)}`, Imax, 'А');
    const Uobr = Math.SQRT2 * U2l;
    L1.eq('U_{м.обр}', '\\sqrt2\\,U_{2л}', `\\sqrt2\\cdot ${n(U2l)}`, Uobr, 'В');
    const thy = D.thyristors.filter(t => t.I >= Imax && t.U >= Uobr).sort((a, b) => a.I - b.I || a.U - b.U)[0] || D.thyristors[D.thyristors.length - 1];
    L1.p(`По табл. П.3 выбираем тиристор <b>${thy.name}</b> (I<sub>п</sub> = ${fnum(thy.I)} А ≥ I<sub>max</sub>; U<sub>п</sub> = ${fnum(thy.U)} В ≥ U<sub>м.обр</sub>).`);
    L1.table(['Наименование', 'Uмакс в закрытом состоянии, В', 'Средний ток в открытом состоянии, А', 'Корпус'], [[thy.name, thy.U, thy.I, thy.pkg]]);
    const tau = rp(1 / (2 * PI * P.f)), Tt = rp(1 / (2 * PI * P.f * P.mph));
    L1.eq('\\tau', '\\dfrac{1}{2\\pi f}', `\\dfrac{1}{2\\pi\\cdot ${n(P.f)}}`, 1 / (2 * PI * P.f), 'с');
    L1.eq('T_т', '\\dfrac{1}{2\\pi f m}', `\\dfrac{1}{2\\pi\\cdot ${n(P.f)}\\cdot ${n(P.mph)}}`, 1 / (2 * PI * P.f * P.mph), 'с');
    const Ttp = rp(tau + Tt);
    L1.eq('T_{тп}', 'T_т+\\tau', `${n(Tt)}+${n(tau)}`, Ttp, 'с');
    const Ktp = mo.U / P.dUw;
    L1.eq('K_{тп}', '\\dfrac{U_{ном}}{\\Delta U_\\Omega}', `\\dfrac{${n(mo.U)}}{${n(P.dUw)}}`, Ktp, '');
    L1.tex(`W_{тп}(s)=\\dfrac{K_{тп}}{T_{тп}s+1}=\\dfrac{${n(Ktp)}}{${n(Ttp)}s+1}`);

    /* --- ТГ --- */
    L1.h('1.4. Тахогенератор (датчик скорости)');
    const tg = D.tachs[+P.tach];
    L1.p(`По табл. П.4 выбираем тахогенератор <b>${tg.name}</b>: C<sub>u</sub> = ${fnum(tg.Cu)} мВ/(об/мин), R<sub>нг</sub> = ${fnum(tg.Rn)} кОм, n<sub>тг</sub> = ${tg.n} об/мин.`);
    const Cu = tg.Cu * 1e-3 * 60 / (2 * PI);
    L1.eq('C_u', `${n(tg.Cu)}\\cdot\\dfrac{10^{-3}\\cdot 60}{2\\pi}`, null, Cu, 'В·с/рад');
    const Wtg = PI * tg.n / 30;
    L1.eq('\\Omega_{тг}', '\\dfrac{\\pi n_{тг}}{30}', `\\dfrac{\\pi\\cdot ${n(tg.n)}}{30}`, Wtg, 'рад/с');
    const Km = Wtg / me.Wn;
    L1.eq('K_м', '\\dfrac{\\Omega_{тг}}{\\Omega_{ном}}', `\\dfrac{${n(Wtg)}}{${n(me.Wn)}}`, Km, '');
    const Kos_raw = P.Uos / me.Wn; const Kos = rp(Kos_raw);
    L1.eq('K_{ос}', '\\dfrac{U_{ос}}{\\Omega_{ном}}', `\\dfrac{${n(P.Uos)}}{${n(me.Wn)}}`, Kos_raw, 'В·с/рад');
    const Kd = Kos / (Cu * Km);
    L1.eq('K_д', '\\dfrac{K_{ос}}{C_uK_м}', `\\dfrac{${n(Kos)}}{${n(Cu)}\\cdot ${n(Km)}}`, Kd, '');
    let Rd2 = NaN, Rd2n = NaN, Cfc = NaN, Cf = NaN, Tf_raw = P.Tf0;
    if (Kd < 1) {
      Rd2 = Kd * P.Rd1 / (1 - Kd);
      L1.eq('R_{д2}', '\\dfrac{K_дR_{д1}}{1-K_д}', `\\dfrac{${n(Kd)}\\cdot ${n(P.Rd1)}}{1-${n(Kd)}}`, Rd2, 'Ом');
      Rd2n = NC.nearestInSeries(Rd2, D.E192);
      L1.p(`Приводим к номиналу ряда E192 (табл. П.5): R<sub>д2</sub> = ${fnum(Rd2n / 1000)} кОм.`);
      Cfc = P.Tf0 * (P.Rd1 + Rd2n) / (P.Rd1 * Rd2n);
      L1.eq('C_ф', '\\dfrac{T_ф(R_{д1}+R_{д2})}{R_{д1}R_{д2}}', `\\dfrac{${n(P.Tf0)}\\cdot(${n(P.Rd1)}+${n(Rd2n)})}{${n(P.Rd1)}\\cdot ${n(Rd2n)}}`, Cfc, 'Ф');
      Cf = NC.nearestInList(Cfc * 1e6, D.caps) * 1e-6;
      L1.p(`Приводим к номиналу по табл. П.6 (Panasonic NHG, 50 В): C<sub>ф</sub> = ${fnum(Cf * 1e6)} мкФ.`);
      Tf_raw = P.Rd1 * Rd2n / (P.Rd1 + Rd2n) * Cf;
      L1.eq('T_ф', '\\dfrac{R_{д1}R_{д2}}{R_{д1}+R_{д2}}C_ф', `\\dfrac{${n(P.Rd1)}\\cdot ${n(Rd2n)}}{${n(P.Rd1)}+${n(Rd2n)}}\\cdot ${n(Cf)}`, Tf_raw, 'с');
    } else {
      L1.note('K<sub>д</sub> ≥ 1 — делитель не реализуем: выберите тахогенератор с большей крутизной. Принято T<sub>ф</sub> = ' + P.Tf0 + ' с.', 'bad');
      warn.push('Kд ≥ 1 для выбранного тахогенератора');
    }
    const Tf = rp(Tf_raw);
    L1.tex(`W_{ос}(s)=\\dfrac{K_{ос}}{T_ф s+1}=\\dfrac{${n(Kos)}}{${n(Tf)}s+1}`);

    /* --- ВТ --- */
    L1.h('1.5. Вращающийся трансформатор (датчик положения)');
    const vt = D.vts[+P.vt];
    L1.p(`По табл. П.7 выбираем СКВТ <b>${vt.name}</b>: U<sub>п</sub> = ${fnum(vt.U)} В, f<sub>п</sub> = ${fnum(vt.f)} Гц, K<sub>т</sub> = ${fnum(vt.Kt)}${vt.n ? ', n = ' + vt.n + ' об/мин' : ''}.`);
    const amax = P.alphaMax * D2R(P);
    L1.eq('\\alpha_{max}', P.deg57 ? `\\dfrac{${n(P.alphaMax)}}{57}` : `${n(P.alphaMax)}\\cdot\\dfrac{\\pi}{180}`, null, amax, 'рад');
    const Kvt_raw = P.Ua / amax; const Kvt = rp(Kvt_raw);
    L1.eq('K_{вт}', '\\dfrac{U_\\alpha}{\\alpha_{max}}', `\\dfrac{${n(P.Ua)}}{${n(amax)}}`, Kvt_raw, 'В/рад');

    /* --- БП --- */
    L1.h('1.6. Блок питания операционных усилителей');
    const R2bp = 240 * 15 / 1.25 - 240;
    L1.eq('R_2', '\\dfrac{R_1U_{вых}}{1{,}25}-R_1', '\\dfrac{240\\cdot 15}{1{,}25}-240', R2bp, 'Ом');
    L1.p('Резистор MPR2400 номиналом 2,64 кОм (ряд E192). Стабилизаторы LM317/LM337, C3, C4 = 0,1…4,7 мкФ.');
    R.L1 = L1;
    R.lr1 = { Ptr, mo, me, i, Inom, Rr, c, Tm, Te, La, Ltot, Ld1, Ld2, Udnm, choke, nCh, Lch, thy, Imax, tau, Tt, Ttp, Ktp, tg, Cu, Km, Kos, Kd, Rd2, Rd2n, Cf, Tf, vt, Kvt, caseA, Wm, Em, U2l, Idgr, Uobr };

    /* ======================= ЛР2 ======================= */
    const L2 = new Report();
    const Kdv = rp(1 / c);
    L2.h('2.1. Параметры нескорректированного контура скорости');
    L2.table(['Параметр', 'Значение'], [
      ['U<sub>з</sub><sup>0</sup>', P.Uz + ' В'], ['K<sub>тп</sub>', fnum(Ktp)], ['T<sub>тп</sub>', fnum(Ttp) + ' с'],
      ['K<sub>ос</sub>', fnum(Kos) + ' В·с/рад'], ['T<sub>ф</sub>', fnum(Tf) + ' с'], ['c', fnum(c) + ' В·с/рад'],
      ['K<sub>дв</sub> = 1/c', fnum(Kdv) + ' рад/(В·с)'], ['R', fnum(Rr) + ' Ом'], ['T<sub>э</sub>', fnum(Te) + ' с'], ['T<sub>м</sub>', fnum(Tm) + ' с'],
      ['i', fnum(i)], ['η', fnum(P.eta)], ['M<sub>c</sub><sup>0</sup>', fnum(P.Mc) + ' Н·м']
    ]);
    L2.diagram('d_lr2', 'Структурная схема динамической модели нескорректированного контура скорости (рис. 2.1)');
    L2.tex(`W(s)=\\dfrac{1/c}{T_эT_мs^2+T_мs+1}\\cdot\\dfrac{K_{тп}}{T_{тп}s+1}\\cdot\\dfrac{K_{ос}}{T_фs+1}`);
    L2.h('2.2. Установившиеся ошибки (теорема о конечном значении)');
    const du_u = P.Uz / (1 + Ktp * Kos / c);
    L2.eq('\\Delta u^u_{уст}', '\\dfrac{U_з^0}{1+\\dfrac{K_{тп}K_{ос}}{c}}', `\\dfrac{${n(P.Uz)}}{1+\\dfrac{${n(Ktp)}\\cdot ${n(Kos)}}{${n(c)}}}`, du_u, 'В');
    const du_M = Rr * Kdv * Kos * P.Mc / (c * i * P.eta * (Kdv * Ktp * Kos + 1));
    L2.eq('\\Delta u^{M_c}_{уст}', '\\dfrac{RK_{дв}K_{ос}M_c^0}{ci\\eta(K_{дв}K_{тп}K_{ос}+1)}',
      `\\dfrac{${n(Rr)}\\cdot ${n(Kdv)}\\cdot ${n(Kos)}\\cdot ${n(P.Mc)}}{${n(c)}\\cdot ${n(i)}\\cdot ${n(P.eta)}\\cdot(${n(Kdv)}\\cdot ${n(Ktp)}\\cdot ${n(Kos)}+1)}`, du_M, 'В');
    L2.eq('\\Delta u_{уст}', '\\Delta u^u_{уст}+\\Delta u^{M_c}_{уст}', `${n(du_u)}+${n(du_M)}`, du_u + du_M, 'В');
    const Wss0 = (P.Uz - du_u) / Kos;
    L2.eq('\\Omega_{уст}', '\\dfrac{U_з^0-\\Delta u^u_{уст}}{K_{ос}}', `\\dfrac{${n(P.Uz)}-${n(du_u)}}{${n(Kos)}}`, Wss0, 'рад/с');
    const kMc2 = 1 / (i * c * P.eta);
    L2.h('2.3. Моделирование (ССДМ рис. 2.1, наброс Mc при t = 1 с)');
    L2.p(`Коэффициент блока Gain1 (канал момента): 1/(icη) = ${fnum(kMc2)}. Ступенчатое задание U<sub>з</sub> = ${fnum(P.Uz)} В подаётся при t = 0, момент M<sub>c</sub><sup>0</sup> = ${fnum(P.Mc)} Н·м — при t = 1 с.`);
    L2.plot('lr2_w', 'Зависимость угловой скорости от времени Ωдв(t)');
    L2.plot('lr2_e', 'Сигнал рассогласования Δu(t) (блок Display)');
    L2.simres('sr_lr2', 'Результаты моделирования');
    R.L2 = L2;
    R.lr2 = { Kdv, du_u, du_M, Wss0, kMc2 };

    /* ======================= ЛР3 ======================= */
    const L3 = new Report();
    L3.h('3.1. Синтез ПИД-регулятора скорости (настройка на оптимум по модулю)');
    L3.tex(`W_{рс}(s)=\\dfrac{T_мT_эs^2+T_мs+1}{2K_{тп}K_{дв}K_{ос}T_\\Sigma s\\,(T_{рс3}s+1)}`);
    let Trc1, Trc2;
    if (caseA) {
      const disc = Math.sqrt(1 - 4 * Te / Tm);
      Trc1 = rs(2 * Te / (1 - disc)); Trc2 = rs(2 * Te / (1 + disc));
      L3.p('Так как T<sub>м</sub> ≥ 4T<sub>э</sub>, числитель раскладывается на вещественные множители: W<sub>рс</sub>(s) = K<sub>рс</sub>(T<sub>рс1</sub>s+1)(T<sub>рс2</sub>s+1) / (T<sub>рс1</sub>s(T<sub>рс3</sub>s+1)).');
      L3.eq('T_{рс1}', '\\dfrac{2T_э}{1-\\sqrt{1-\\dfrac{4T_э}{T_м}}}', `\\dfrac{2\\cdot ${n(Te)}}{1-\\sqrt{1-\\dfrac{4\\cdot ${n(Te)}}{${n(Tm)}}}}`, 2 * Te / (1 - disc), 'с');
      L3.eq('T_{рс2}', '\\dfrac{2T_э}{1+\\sqrt{1-\\dfrac{4T_э}{T_м}}}', `\\dfrac{2\\cdot ${n(Te)}}{1+\\sqrt{1-\\dfrac{4\\cdot ${n(Te)}}{${n(Tm)}}}}`, 2 * Te / (1 + disc), 'с');
    } else {
      Trc1 = Tm; Trc2 = Te;
      L3.p('Так как T<sub>м</sub> < 4T<sub>э</sub>, корни числителя комплексно-сопряжённые; принимаем T<sub>рс1</sub> = T<sub>м</sub>, T<sub>рс2</sub> = T<sub>э</sub> (как в примере 4.1).');
      L3.eq('T_{рс1}', 'T_м', null, Trc1, 'с');
      L3.eq('T_{рс2}', 'T_э', null, Trc2, 'с');
    }
    const Trc3 = rs(Trc2 / P.Nr);
    L3.eq('T_{рс3}', '\\dfrac{T_{рс2}}{N}', `\\dfrac{${n(Trc2)}}{${n(P.Nr)}}`, Trc3, 'с');
    const TS = Ttp + Tf + Trc3;
    L3.eq('T_\\Sigma', 'T_{тп}+T_ф+T_{рс3}', `${n(Ttp)}+${n(Tf)}+${n(Trc3)}`, TS, 'с');
    const KKK = 2 * Ktp * Kdv * Kos * TS;
    const Krc = rs(Trc1 / KKK);
    if (caseA) L3.eq('K_{рс}', '\\dfrac{T_{рс1}}{2K_{тп}K_{дв}K_{ос}T_\\Sigma}', `\\dfrac{${n(Trc1)}}{2\\cdot ${n(Ktp)}\\cdot ${n(Kdv)}\\cdot ${n(Kos)}\\cdot ${n(TS)}}`, Trc1 / KKK, '');
    else L3.eq('2K_{тп}K_{дв}K_{ос}T_\\Sigma', '', `2\\cdot ${n(Ktp)}\\cdot ${n(Kdv)}\\cdot ${n(Kos)}\\cdot ${n(TS)}`, KKK, 'с');
    let Wrc;
    if (caseA) Wrc = NC.tf([Krc * Trc1 * Trc2, Krc * (Trc1 + Trc2), Krc], [Trc1 * Trc3, Trc1, 0]);
    else Wrc = NC.tf([Tm * Te, Tm, 1], [KKK * Trc3, KKK, 0]);
    L3.tex('W_{рс}(s)=' + tfTex(Wrc));
    const Wtp = NC.tf([Ktp], [Ttp, 1]);
    const Wdv = NC.tf([Kdv], [Te * Tm, Tm, 1]);
    const Wos = NC.tf([Kos], [Tf, 1]);
    const Wks = NC.series(Wrc, Wtp, Wdv, Wos);
    L3.diagram('d_lr3', 'ССДМ контура скорости с аналоговым регулятором (рис. 3.10)');
    L3.h('3.2. ПФ разомкнутого контура скорости');
    L3.tex('W_{кс}(s)=W_{рс}(s)\\,W_{тп}(s)\\,W_{дв}(s)\\,W_{ос}(s)=' + tfTex(Wks));
    const mg3 = NC.margins(w0 => NC.freq(Wks, w0), 1e-2, 1e6);
    L3.table(['Показатель', 'Значение', 'Требование ОМ'], [
      ['Запас по фазе θз', fnum(mg3.Pm, 3) + '°', '≈ 63…65°'],
      ['Частота среза ωс', fnum(mg3.wcp, 4) + ' рад/с', '≈ 1/(2TΣ) = ' + fnum(1 / (2 * TS), 4)],
      ['Запас по амплитуде Lз', fnum(mg3.Gm, 3) + ' дБ', '≤ 20 дБ'],
      ['Частота ω<sub>π</sub>', fnum(mg3.wcg, 4) + ' рад/с', '']
    ]);
    L3.plot('lr3_bode', 'ЛАЧХ и ЛФЧХ разомкнутого контура скорости');
    L3.eq('t_н^{кс}', '4{,}7T_\\Sigma', `4{,}7\\cdot ${n(TS)}`, 4.7 * TS, 'с');
    L3.plot('lr3_step', 'Ω(t) по сигналу задания');
    L3.plot('lr3_dist', 'Ω(t) по моменту сопротивления (Uкс = 0, Mc = −Mc⁰)');
    L3.simres('sr_lr3', 'Показатели качества по результатам моделирования');
    // RC-элементы
    let rc = null;
    if (caseA) {
      L3.h('3.3. Электрическая схема и RC-элементы ПИД-регулятора (рис. 3.9)');
      L3.tex('T_{рс1}=R_3C_2;\\quad T_{рс2}=R_2C_1;\\quad T_{рс3}=\\dfrac{R_1R_2C_1}{R_1+R_2};\\quad K_{рс}=\\dfrac{R_3}{R_1+R_2}');
      rc = designRC(Trc1, Trc2, Krc, P);
      L3.p(`Задаём C<sub>2</sub> = ${fnum(rc.C2 * 1e6)} мкФ` + (P.C2 === 'auto' ? ' (подобрана автоматически)' : '') + ` и C<sub>1</sub> = ${fnum(rc.C1 * 1e6)} мкФ` + (P.C1 === 'auto' ? ' (подобрана автоматически)' : '') + ' из табл. П.6.');
      L3.rep(`Задаём из табл. П.6 ёмкости C<sub>2</sub> = ${fnum(rc.C2 * 1e6)} мкФ и C<sub>1</sub> = ${fnum(rc.C1 * 1e6)} мкФ (конденсаторы Panasonic NHG на 50 В).`);
      L3.eq('R_3', '\\dfrac{T_{рс1}}{C_2}', `\\dfrac{${n(Trc1)}}{${n(rc.C2)}}`, rc.R3c, 'Ом');
      L3.eq('R_2', '\\dfrac{T_{рс2}}{C_1}', `\\dfrac{${n(Trc2)}}{${n(rc.C1)}}`, rc.R2c, 'Ом');
      L3.p(`По ряду E192: R<sub>3</sub> = ${fnum(rc.R3 / 1000)} кОм, R<sub>2</sub> = ${fnum(rc.R2 / 1000)} кОм.`);
      L3.eq('R_1', '\\dfrac{R_3-R_2K_{рс}}{K_{рс}}', `\\dfrac{${n(rc.R3)}-${n(rc.R2)}\\cdot ${n(Krc)}}{${n(Krc)}}`, rc.R1c, 'Ом');
      if (rc.R1c > 0) {
        L3.p(`По ряду E192: R<sub>1</sub> = ${fnum(rc.R1 / 1000)} кОм.`);
        L3.eq('K_{рс}', '\\dfrac{R_3}{R_1+R_2}', `\\dfrac{${n(rc.R3)}}{${n(rc.R1)}+${n(rc.R2)}}`, rc.Kact, '');
        const dev = Math.abs(rc.Kact - Krc) / Krc * 100;
        L3.check(`\\delta K_{рс}=${n(dev, 3)}\\%`, dev < 2, dev < 2 ? 'Отклонение мало — подстройка R3 не требуется.' : 'Отклонение заметно — R3 выполняется переменным для подстройки Kрс.');
        L3.table(['Элемент', 'Расчёт', 'Номинал'], [
          ['R1', fnum(rc.R1c) + ' Ом', fnum(rc.R1 / 1000) + ' кОм (MPR24, E192)'],
          ['R2', fnum(rc.R2c) + ' Ом', fnum(rc.R2 / 1000) + ' кОм (MPR24, E192)'],
          ['R3', fnum(rc.R3c) + ' Ом', fnum(rc.R3 / 1000) + ' кОм (переменный, для подстройки)'],
          ['C1', '—', fnum(rc.C1 * 1e6) + ' мкФ (Panasonic NHG 50 В)'],
          ['C2', '—', fnum(rc.C2 * 1e6) + ' мкФ (Panasonic NHG 50 В)']
        ], 'Номиналы RC-элементов регулятора скорости');
        L3.p('Операционный усилитель — с двуполярным питанием ±15 В (блок питания из п. 1.6).');
      } else L3.note('R1 получилось отрицательным при выбранных ёмкостях — выберите другие C1/C2.', 'bad');
    } else {
      L3.h('3.3. Схемная реализация');
      L3.note('При T<sub>м</sub> < 4T<sub>э</sub> нули регулятора комплексно-сопряжённые и не реализуются схемой рис. 3.9 (она даёт только вещественные постоянные времени R3C2 и R2C1). Такой регулятор реализуется программно — см. ЛР №4 (цифровой ПИД-регулятор).', 'warn');
    }
    const kMc = Rr / (i * c * c * P.eta);
    L3.h('3.4. Канал момента сопротивления в ССДМ');
    L3.eq('K_{M_c}', '\\dfrac{R}{i\\,c^2\\eta}', `\\dfrac{${n(Rr)}}{${n(i)}\\cdot ${n(c)}^2\\cdot ${n(P.eta)}}`, kMc, '');
    L3.p('Звено (T<sub>э</sub>s+1)/(0,1T<sub>э</sub>s+1) — реализуемая форма форсирующего звена (как блок Transfer Fcn5 на рис. 3.10). Коэффициент получен из уравнений (1.4)–(1.5) для схемы, где сумматор стоит после K<sub>дв</sub>.');
    R.L3 = L3;
    R.lr3 = { Trc1, Trc2, Trc3, TS, Krc, KKK, Wrc, Wtp, Wdv, Wos, Wks, mg3, rc, kMc };

    /* ======================= ЛР4 ======================= */
    const L4 = new Report();
    const fs = 1 / P.T0;
    L4.h('4.1. Дискретная аппроксимация регулятора скорости (формула трапеций)');
    L4.tex(`s=\\dfrac{2}{T_0}\\cdot\\dfrac{z-1}{z+1},\\qquad T_0=${n(P.T0)}\\ с,\\quad f_s=\\dfrac{1}{T_0}=${n(fs)}\\ Гц`);
    L4.tex('W_{рс}(s)=' + tfTex(Wrc));
    const bz = NC.bilinear(Wrc.num, Wrc.den, fs);
    L4.tex('W_{рс}(z)=' + tfTex(NC.tf(bz.num, bz.den), 'z'));
    const ss4 = NC.tf2ss(bz.num, bz.den);
    L4.h('4.2. Уравнения состояния цифрового регулятора (непосредственное программирование)');
    L4.tex('x[(k+1)T_0]=\\mathbf{A}\\,x(kT_0)+\\mathbf{B}\\,\\Delta u_\\Omega(kT_0);\\qquad u_{рс}(kT_0)=\\mathbf{C}\\,x(kT_0)+\\mathbf{D}\\,\\Delta u_\\Omega(kT_0)');
    L4.tex(matTex('A', ss4.A) + ';\\quad ' + matTex('B', ss4.B) + ';\\quad ' + matTex('C', ss4.C) + ';\\quad ' + matTex('D', ss4.D));
    L4.plot('lr4_reg', 'Переходная характеристика цифрового регулятора скорости');
    // псевдочастотные характеристики
    const Gp = NC.series(Wtp, Wdv, Wos);
    const Gss = NC.tf2ss(Gp.num, Gp.den);
    const Gd = NC.c2dzoh(Gss, P.T0);
    const WrzF = z => NC.C.div(NC.cpolyval(bz.num, z), NC.cpolyval(bz.den, z));
    const lamToZ = lam => { const a = [1, lam * P.T0 / 2], b = [1, -lam * P.T0 / 2]; return NC.C.div(a, b); };
    const Wol4 = lam => { const z = lamToZ(lam); return NC.C.mul(WrzF(z), NC.ssEval(Gd, z)); };
    const mg4 = NC.margins(Wol4, 1e-2, 1e6);
    L4.h('4.3. Логарифмические псевдочастотные характеристики (υ-преобразование)');
    L4.tex('z=\\dfrac{1+\\upsilon}{1-\\upsilon},\\quad \\upsilon=j\\dfrac{T_0}{2}\\omega_\\upsilon,\\qquad W_{кс}(z)=W_{рс}(z)\\cdot Z\\left\\{\\dfrac{1-e^{-sT_0}}{s}W_{тп}(s)W_{дв}(s)W_{ос}(s)\\right\\}');
    L4.table(['Показатель', 'Цифровой КС (по ЛПЧХ)', 'Аналоговый КС (ЛР3)'], [
      ['Запас по фазе θз', fnum(mg4.Pm, 3) + '°', fnum(mg3.Pm, 3) + '°'],
      ['Частота среза ω<sub>с</sub>', fnum(mg4.wcp, 4) + ' с⁻¹', fnum(mg3.wcp, 4) + ' с⁻¹'],
      ['Запас по амплитуде Lз', fnum(mg4.Gm, 3) + ' дБ', fnum(mg3.Gm, 3) + ' дБ'],
      ['Частота ω<sub>π</sub>', fnum(mg4.wcg, 4) + ' с⁻¹', fnum(mg3.wcg, 4) + ' с⁻¹']
    ]);
    L4.note('Непрерывная часть дискретизирована с экстраполятором нулевого порядка (c2d, \'zoh\'), затем выполнен переход к абсолютной псевдочастоте (d2c, \'tustin\'). Это корректная форма υ-преобразования; в методичке ЛПЧХ строится через bilinear всей разомкнутой ПФ и символьную подстановку — такой вариант тоже приведён в скрипте MATLAB (закомментирован).');
    L4.rep('Для построения ЛПЧХ непрерывная часть контура дискретизирована с экстраполятором нулевого порядка, после чего выполнен переход к абсолютной псевдочастоте ωυ.');
    L4.plot('lr4_bode', 'ЛПЧХ разомкнутого цифрового контура скорости');
    L4.plot('lr4_nyq', 'АФЧХ (псевдочастотная)');
    L4.h('4.4. Моделирование контура скорости с цифровым регулятором');
    L4.diagram('d_lr4', 'ССДМ контура скорости с цифровым регулятором (рис. 4.7)');
    L4.plot('lr4_step', 'Ω(t) по сигналу задания (цифровой РС)');
    L4.plot('lr4_dist', 'Ω(t) по моменту сопротивления (цифровой РС)');
    L4.simres('sr_lr4', 'Показатели качества: цифровой и аналоговый регуляторы');
    L4.h('4.5. Рабочая программа цифрового регулятора скорости (CoDeSys, ПЛК154)');
    const st4 = codesys(ss4, 'PLC_PRG', 'Цифровой ПИД-регулятор скорости');
    L4.code(st4, 'st', 'PLC_PRG.st');
    R.L4 = L4;
    R.lr4 = { bz, ss4, Gd, mg4, Wol4, st4 };

    /* ======================= ЛР5 ======================= */
    const L5 = new Report();
    const Kdp = Kvt;
    const Ke = Math.SQRT2 * P.E * 60 / P.dAE;
    const KW = Math.SQRT2 * P.W * 60 / P.dAW;
    const w0 = Math.sqrt(Ke);
    const M = P.M;
    const Ta = 1 / w0 * Math.sqrt(M / (M - 1));
    const Tb = Math.sqrt(M * (M - 1)) / (w0 * (M + 1));
    const h = (M + 1) / (M - 1);
    const wM = 1 / (Tb * Math.sqrt(h));
    // T1ж: по методичке принимается 2 с (T1ж >> 1/ωм); если при этом частота среза желаемой ЛАЧХ
    // ωс ≈ KΩ·T2ж/T1ж выходит за полосу контура скорости, T1ж увеличивается
    const wcLim = Math.min(0.1 / P.T0, 1.5 / R.lr3.TS);
    let T1zhAuto = Math.max(2, KW * Ta / wcLim);
    if (T1zhAuto > 2) T1zhAuto = Math.ceil(T1zhAuto * 2) / 2;
    let T1zh1 = P.T1zh === 'auto' || P.T1zh === '' || P.T1zh == null ? T1zhAuto : +P.T1zh;
    L5.h('5.1. Желаемые ЛАЧХ и запретная область');
    L5.eq('K_\\varepsilon', '\\sqrt2\\,\\dfrac{\\varepsilon_{max}}{\\Delta\\alpha_\\varepsilon}', `\\sqrt2\\cdot\\dfrac{${n(P.E)}\\cdot 60}{${n(P.dAE)}}`, Ke, 'с⁻²');
    L5.eq('\\omega_0', '\\sqrt{K_\\varepsilon}', `\\sqrt{${n(Ke)}}`, w0, 'с⁻¹');
    L5.eq('K_\\Omega', '\\sqrt2\\,\\dfrac{\\Omega_{max}}{\\Delta\\alpha_\\Omega}', `\\sqrt2\\cdot\\dfrac{${n(P.W)}\\cdot 60}{${n(P.dAW)}}`, KW, 'с⁻¹');
    const wk = (P.E) / (P.W);
    L5.eq('\\omega_к', '\\dfrac{\\varepsilon_{max}}{\\Omega_{max}}', `\\dfrac{${n(P.E)}}{${n(P.W)}}`, wk, 'с⁻¹');
    L5.p('Угловые ошибки переведены в градусы делением на 60, поэтому в формулах K<sub>ε</sub>, K<sub>Ω</sub> присутствует множитель 60.');
    L5.eq('L(\\omega_к)', '20\\lg\\dfrac{\\Omega^2_{max}}{\\varepsilon_{max}\\Delta\\alpha_\\varepsilon}', `20\\lg\\dfrac{${n(P.W)}^2\\cdot 60}{${n(P.E)}\\cdot ${n(P.dAE)}}`, 20 * Math.log10(P.W * P.W * 60 / (P.E * P.dAE)), 'дБ');
    L5.plot('lr5_zh', 'Запретная область и желаемые ЛАЧХ (ν = 2 и ν = 1)');
    L5.h('5.2. Астатизм второго порядка (ν = 2) — ПИД-регулятор положения');
    L5.tex('W_ж(s)=\\dfrac{K_\\varepsilon(T_{1ж}s+1)}{s^2(T_{2ж}s+1)}');
    L5.eq('T_{1ж}', '\\dfrac{1}{\\omega_0}\\sqrt{\\dfrac{M}{M-1}}', `\\dfrac{1}{${n(w0)}}\\sqrt{\\dfrac{${n(M)}}{${n(M)}-1}}`, Ta, 'с');
    L5.eq('T_{2ж}', '\\dfrac{\\sqrt{M(M-1)}}{\\omega_0(M+1)}', `\\dfrac{\\sqrt{${n(M)}(${n(M)}-1)}}{${n(w0)}(${n(M)}+1)}`, Tb, 'с');
    const Wzh2 = NC.tf([Ke * Ta, Ke], [Tb, 1, 0, 0]);
    L5.tex('W_ж(s)=\\dfrac{' + n(Ke) + '(' + n(Ta) + 's+1)}{s^2(' + n(Tb) + 's+1)}');
    const Phi = NC.feedback(NC.series(Wrc, Wtp, Wdv), Wos);
    const Wn5 = NC.series(Phi, NC.tf([Kdp], [i, 0]));
    L5.p('Неизменяемая часть: W<sub>н</sub>(s) = Ф<sub>кс</sub>(s)·K<sub>дп</sub>/(is), где Ф<sub>кс</sub>(s) = W(s)/([1+W(s)]W<sub>ос</sub>(s)) — замкнутый контур скорости из ЛР3 (feedback), K<sub>дп</sub> = K<sub>вт</sub> = ' + fnum(Kdp) + ' В/рад.');
    L5.tex('W_н(s)=' + tfTex(normTf(Wn5)));
    const Wrp2x = NC.tfdiv(Wzh2, Wn5);
    L5.tex('W_{рп}(s)=\\dfrac{W_ж(s)}{W_н(s)}=' + tfTex(normTf(Wrp2x)));
    const ap2 = approxPID(Wrp2x, Ta, Tb, Ke, i, Kos, Kdp, TS, P);
    L5.plot('lr5_bode_pid', 'ЛАЧХ регулятора положения (ν = 2) и её асимптотическая аппроксимация');
    L5.p('ЛАЧХ регулятора аппроксимируем четырьмя асимптотами с наклонами −20, 0, +20 и 0 дБ/дек — это ПИД-регулятор' + (ap2.manual ? ' (параметры аппроксимации заданы вручную).' : '. Порядок построения асимптот:'));
    if (ap2.manual) L5.rep('ЛАЧХ регулятора аппроксимируем четырьмя асимптотами с наклонами −20, 0, +20 и 0 дБ/дек — это ПИД-регулятор.');
    if (!ap2.manual) {
      L5.p(`• низкочастотная асимптота −20 дБ/дек проводится через точку ЛАЧХ на частоте ω = ${fnum(ap2.wref, 3)} с⁻¹: L = ${fnum(ap2.Lref, 4)} дБ;<br>• горизонтальная асимптота — по минимуму ЛАЧХ: L<sub>min</sub> = ${fnum(ap2.Lmin, 4)} дБ при ω = ${fnum(ap2.wmin, 4)} с⁻¹;<br>• ω<sub>1</sub> — пересечение первых двух асимптот; ω<sub>2</sub> — частота, где ЛАЧХ поднимается на 3 дБ над L<sub>min</sub>; ω<sub>3</sub> = N·ω<sub>2</sub> (N = ${fnum(P.Nr)}) — ограничение дифференцирующей составляющей.`);
      L5.eq('\\dfrac{K_{рп}}{T_1}', '\\omega\\cdot 10^{L(\\omega)/20}', `${n(ap2.wref)}\\cdot 10^{${n(ap2.Lref)}/20}`, ap2.K / ap2.T1, 'с⁻¹');
      L5.eq('K_{рп}', '10^{L_{min}/20}', `10^{${n(ap2.Lmin)}/20}`, ap2.K, '');
      L5.eq('\\omega_1', '\\dfrac{K_{рп}/T_1}{K_{рп}}', `\\dfrac{${n(ap2.K / ap2.T1)}}{${n(ap2.K)}}`, 1 / ap2.T1, 'с⁻¹');
    }
    L5.tex(`\\omega_1=${n(1 / ap2.T1)};\\quad \\omega_2=${n(1 / ap2.T2)};\\quad \\omega_3=${n(1 / ap2.T3)}\\ с^{-1}`);
    L5.tex(`T_1=\\dfrac{1}{\\omega_1}=${n(ap2.T1)}\\ с;\\quad T_2=\\dfrac{1}{\\omega_2}=${n(ap2.T2)}\\ с;\\quad T_3=\\dfrac{1}{\\omega_3}=${n(ap2.T3)}\\ с`);
    L5.eq('K_{рп}', 'T_1\\cdot\\dfrac{K_{рп}}{T_1}', `${n(ap2.T1)}\\cdot ${n(ap2.K / ap2.T1)}`, ap2.K, '');
    L5.tex(`W_{рп}(s)=\\dfrac{K_{рп}(T_1s+1)(T_2s+1)}{T_1s(T_3s+1)}=\\dfrac{${n(ap2.K)}(${n(ap2.T1)}s+1)(${n(ap2.T2)}s+1)}{${n(ap2.T1)}s(${n(ap2.T3)}s+1)}=\\left(${n(ap2.K)}+\\dfrac{${n(ap2.K / ap2.T1)}}{s}\\right)\\dfrac{${n(ap2.T2)}s+1}{${n(ap2.T3)}s+1}`);
    L5.diagram('d_lr5_pid', 'ССДМ следящего ЭП с ПИД-регулятором положения (рис. 5.5)');
    L5.plot('lr5_step_pid', 'Переходная характеристика α(t) (ν = 2)');
    L5.plot('lr5_err_pid', 'Ошибка при квадратично возрастающем задании εmax·t²/2');
    L5.plot('lr5_mc_pid', 'Моментная составляющая ошибки при Mc = M̈c⁰·t²/2');
    L5.simres('sr_lr5_pid', 'Результаты моделирования, ν = 2');

    L5.h('5.3. Астатизм первого порядка (ν = 1) — интегро-дифференцирующий регулятор');
    L5.tex('W_ж(s)=\\dfrac{K_\\Omega(T_{2ж}s+1)}{s(T_{1ж}s+1)(T_{3ж}s+1)}');
    L5.eq('T_{2ж}', '\\dfrac{1}{\\omega_0}\\sqrt{\\dfrac{M}{M-1}}', null, Ta, 'с');
    L5.eq('T_{3ж}', '\\dfrac{\\sqrt{M(M-1)}}{\\omega_0(M+1)}', null, Tb, 'с');
    L5.eq('h', '\\dfrac{M+1}{M-1}', `\\dfrac{${n(M)}+1}{${n(M)}-1}`, h, '');
    L5.eq('\\omega_м', '\\dfrac{1}{T_{3ж}\\sqrt h}', `\\dfrac{1}{${n(Tb)}\\sqrt{${n(h)}}}`, wM, 'с⁻¹');
    L5.p(`Условие T<sub>1ж</sub> ≫ 1/ω<sub>м</sub> = ${fnum(1 / wM)} с. Принимаем T<sub>1ж</sub> = ${fnum(T1zh1)} с` + ((P.T1zh === 'auto' && T1zh1 > 2) ? ` (вместо 2 с, принятых в методичке: при T<sub>1ж</sub> = 2 с частота среза K<sub>Ω</sub>T<sub>2ж</sub>/T<sub>1ж</sub> = ${fnum(KW * Ta / 2, 3)} с⁻¹ превысила бы допустимую ${fnum(wcLim, 3)} с⁻¹ для контура скорости и периода T<sub>0</sub>).` : '.'));
    L5.rep(`Из условия T<sub>1ж</sub> ≫ 1/ω<sub>м</sub> = ${fnum(1 / wM)} с принимаем T<sub>1ж</sub> = ${fnum(T1zh1)} с` + (T1zh1 > 2 ? `, при этом частота среза желаемой ЛАЧХ не превышает ${fnum(wcLim, 3)} с⁻¹ и остаётся в пределах полосы пропускания контура скорости.` : '.'));
    L5.eq('\\omega_с', '\\dfrac{K_\\Omega T_{2ж}}{T_{1ж}}', `\\dfrac{${n(KW)}\\cdot ${n(Ta)}}{${n(T1zh1)}}`, KW * Ta / T1zh1, 'с⁻¹');
    if (T1zh1 < 5 / wM) L5.note('T<sub>1ж</sub> выбрана недостаточно большой по сравнению с 1/ω<sub>м</sub>.', 'warn');
    const Wzh1 = NC.tf([KW * Ta, KW], NC.convMany([[T1zh1, 1], [Tb, 1], [1, 0]]));
    L5.tex(`W_ж(s)=\\dfrac{${n(KW)}(${n(Ta)}s+1)}{s(${n(T1zh1)}s+1)(${n(Tb)}s+1)}=` + tfTex(Wzh1));
    const Wrp1x = NC.tfdiv(Wzh1, Wn5);
    L5.tex('W_{рп}(s)=\\dfrac{W_ж(s)}{W_н(s)}=' + tfTex(normTf(Wrp1x)));
    const ap1 = approxID(Wrp1x, Ta, Tb, T1zh1, KW, i, Kos, Kdp, TS, P);
    L5.plot('lr5_bode_id', 'ЛАЧХ регулятора положения (ν = 1) и её асимптотическая аппроксимация');
    L5.p('ЛАЧХ аппроксимируем пятью асимптотами с наклонами 0, −20, 0, +20, 0 дБ/дек — интегро-дифференцирующий регулятор' + (ap1.manual ? ' (параметры аппроксимации заданы вручную).' : '. Порядок построения:'));
    if (ap1.manual) L5.rep('ЛАЧХ аппроксимируем пятью асимптотами с наклонами 0, −20, 0, +20, 0 дБ/дек — интегро-дифференцирующий регулятор.');
    if (!ap1.manual) {
      L5.p(`• низкочастотная асимптота — уровень L<sub>0</sub> = 20lg K<sub>рп</sub> = ${fnum(ap1.L0, 4)} дБ (K<sub>рп</sub> = K<sub>Ω</sub>iK<sub>ос</sub>/K<sub>дп</sub>);<br>• ω<sub>1</sub> — частота, где ЛАЧХ опускается на 3 дБ ниже L<sub>0</sub>;<br>• средняя горизонтальная асимптота — по минимуму ЛАЧХ L<sub>min</sub> = ${fnum(ap1.Lmin, 4)} дБ (ω = ${fnum(ap1.wmin, 4)} с⁻¹), ω<sub>2</sub> = ω<sub>1</sub>·10<sup>(L<sub>0</sub>−L<sub>min</sub>)/20</sup>;<br>• ω<sub>3</sub> — подъём ЛАЧХ на 3 дБ над L<sub>min</sub>; ω<sub>4</sub> = N·ω<sub>3</sub>.`);
      L5.eq('K_{рп}', '\\dfrac{K_\\Omega\\,i\\,K_{ос}}{K_{дп}}', `\\dfrac{${n(KW)}\\cdot ${n(i)}\\cdot ${n(Kos)}}{${n(Kdp)}}`, ap1.K, '');
      L5.eq('\\omega_2', '\\omega_1\\cdot 10^{(L_0-L_{min})/20}', `${n(1 / ap1.T1)}\\cdot 10^{(${n(ap1.L0)}-${n(ap1.Lmin)})/20}`, 1 / ap1.T2, 'с⁻¹');
    } else L5.eq('K_{рп}', '', null, ap1.K, '');
    L5.tex(`\\omega_1=${n(1 / ap1.T1)};\\quad \\omega_2=${n(1 / ap1.T2)};\\quad \\omega_3=${n(1 / ap1.T3)};\\quad \\omega_4=${n(1 / ap1.T4)}\\ с^{-1}`);
    L5.tex(`T_1=\\dfrac1{\\omega_1}=${n(ap1.T1)}\\ с;\\quad T_2=\\dfrac1{\\omega_2}=${n(ap1.T2)}\\ с;\\quad T_3=\\dfrac1{\\omega_3}=${n(ap1.T3)}\\ с;\\quad T_4=\\dfrac1{\\omega_4}=${n(ap1.T4)}\\ с`);
    L5.tex(`W_{рп}(s)=\\dfrac{K_{рп}(T_2s+1)(T_3s+1)}{(T_1s+1)(T_4s+1)}=\\dfrac{${n(ap1.K)}(${n(ap1.T2)}s+1)(${n(ap1.T3)}s+1)}{(${n(ap1.T1)}s+1)(${n(ap1.T4)}s+1)}`);
    L5.diagram('d_lr5_id', 'ССДМ следящего ЭП с интегро-дифференцирующим регулятором (рис. 5.10)');
    L5.plot('lr5_step_id', 'Переходная характеристика α(t) (ν = 1)');
    L5.plot('lr5_err_id', 'Ошибка при линейно возрастающем задании Ωmax·t');
    L5.plot('lr5_mc_id', 'Моментная составляющая ошибки при Mc = Ṁc⁰·t');
    L5.simres('sr_lr5_id', 'Результаты моделирования, ν = 1');
    R.L5 = L5;
    R.lr5 = { Kdp, Ke, KW, w0, Ta, Tb, h, wM, T1zh1, T1zhAuto, wcLim, wk, Wzh2, Wzh1, Phi, Wn5, Wrp2x, Wrp1x, ap2, ap1 };

    /* ======================= ЛР6 ======================= */
    const L6 = new Report();
    L6.h('6.1. Неизменяемая часть (КС настроен на ОМ)');
    L6.tex('\\Phi^{ом}_{кс}(s)=\\dfrac{(1/K_{ос})(T_фs+1)}{2(T_\\Sigma s)^2+2T_\\Sigma s+1}=\\dfrac{' + n(1 / Kos) + '(' + n(Tf) + 's+1)}{' + n(2 * TS * TS) + 's^2+' + n(2 * TS) + 's+1}');
    const Kn6 = Kdp / (i * Kos);
    L6.eq('\\dfrac{K_{дп}}{iK_{ос}}', '', `\\dfrac{${n(Kdp)}}{${n(i)}\\cdot ${n(Kos)}}`, Kn6, '');
    L6.tex(`W_н(s)=\\Phi^{ом}_{кс}(s)\\dfrac{K_{дп}}{is}=\\dfrac{${n(Kn6)}(${n(Tf)}s+1)}{s(${n(2 * TS * TS)}s^2+${n(2 * TS)}s+1)}`);
    const q2 = [2 * TS * TS, 2 * TS, 1];
    // ν = 2
    const K62 = Ke / Kn6;
    let num62 = NC.pscale(NC.conv([Ta, 1], q2), K62);
    let den62 = NC.convMany([[Tb, 1], [Tf, 1], [1, 0]]);
    const l62 = den62[0]; num62 = num62.map(v => v / l62); den62 = den62.map(v => v / l62);
    const Wrp62 = NC.tf(num62, den62);
    L6.h('6.2. ν = 2: аналитический синтез и цифровой ПИД-регулятор положения');
    L6.tex(`W_ж(s)=\\dfrac{${n(Ke)}(${n(Ta)}s+1)}{s^2(${n(Tb)}s+1)}`);
    L6.tex(`W_{рп}(s)=\\dfrac{W_ж(s)}{W_н(s)}=\\dfrac{K_\\varepsilon iK_{ос}}{K_{дп}}\\cdot\\dfrac{(T_{1ж}s+1)(2T_\\Sigma^2s^2+2T_\\Sigma s+1)}{s(T_{2ж}s+1)(T_фs+1)}`);
    L6.tex('W_{рп}(s)\\ (\\mathrm{minreal})=' + tfTex(Wrp62));
    const bz62 = NC.bilinear(Wrp62.num, Wrp62.den, fs);
    L6.tex('W_{рп}(z)=' + tfTex(NC.tf(bz62.num, bz62.den), 'z'));
    const ss62 = NC.tf2ss(bz62.num, bz62.den);
    L6.tex(matTex('A', ss62.A) + ';\\ ' + matTex('B', ss62.B));
    L6.tex(matTex('C', ss62.C) + ';\\ ' + matTex('D', ss62.D));
    L6.diagram('d_lr6_pid', 'ССДМ цифро-аналогового следящего ЭП (рис. 6.1)');
    L6.plot('lr6_step_pid', 'α(t) цифро-аналогового ЭП (ν = 2)');
    L6.plot('lr6_err_pid', 'Ошибка при εmax·t²/2 (ν = 2)');
    L6.plot('lr6_mc_pid', 'Моментная составляющая ошибки (ν = 2)');
    L6.simres('sr_lr6_pid', 'Результаты моделирования, ν = 2');
    const st62 = codesys(ss62, 'PLC_PRG_RP2', 'Цифровой ПИД-регулятор положения (ν = 2)');
    L6.code(st62, 'st', 'PLC_PRG_RP2.st');
    // ν = 1
    const K61 = KW / Kn6;
    let num61 = NC.pscale(NC.conv([Ta, 1], q2), K61);
    let den61 = NC.convMany([[T1zh1, 1], [Tb, 1], [Tf, 1]]);
    const l61 = den61[0]; num61 = num61.map(v => v / l61); den61 = den61.map(v => v / l61);
    const Wrp61 = NC.tf(num61, den61);
    L6.h('6.3. ν = 1: аналитический синтез и цифровой интегро-дифференцирующий регулятор');
    L6.tex(`W_ж(s)=\\dfrac{${n(KW)}(${n(Ta)}s+1)}{s(${n(T1zh1)}s+1)(${n(Tb)}s+1)}`);
    L6.tex(`W_{рп}(s)=\\dfrac{K_\\Omega iK_{ос}}{K_{дп}}\\cdot\\dfrac{(T_{2ж}s+1)(2T_\\Sigma^2s^2+2T_\\Sigma s+1)}{(T_{1ж}s+1)(T_{3ж}s+1)(T_фs+1)}`);
    L6.tex('W_{рп}(s)\\ (\\mathrm{minreal})=' + tfTex(Wrp61));
    const bz61 = NC.bilinear(Wrp61.num, Wrp61.den, fs);
    L6.tex('W_{рп}(z)=' + tfTex(NC.tf(bz61.num, bz61.den), 'z'));
    const ss61 = NC.tf2ss(bz61.num, bz61.den);
    L6.tex(matTex('A', ss61.A) + ';\\ ' + matTex('B', ss61.B));
    L6.tex(matTex('C', ss61.C) + ';\\ ' + matTex('D', ss61.D));
    L6.diagram('d_lr6_id', 'ССДМ цифро-аналогового следящего ЭП (рис. 6.5)');
    L6.plot('lr6_step_id', 'α(t) цифро-аналогового ЭП (ν = 1)');
    L6.plot('lr6_err_id', 'Ошибка при Ωmax·t (ν = 1)');
    L6.plot('lr6_mc_id', 'Моментная составляющая ошибки (ν = 1)');
    L6.simres('sr_lr6_id', 'Результаты моделирования, ν = 1');
    const st61 = codesys(ss61, 'PLC_PRG_RP1', 'Цифровой регулятор положения (ν = 1)');
    L6.code(st61, 'st', 'PLC_PRG_RP1.st');
    R.L6 = L6;
    R.lr6 = { Kn6, Wrp62, bz62, ss62, Wrp61, bz61, ss61, st62, st61 };
    R.warn = warn;
    R.fmt = { fnum, n, m, mvec, mmat };
    return R;
  }

  function normTf(s) { const l = s.den[0]; return NC.tf(s.num.map(v => v / l), s.den.map(v => v / l)); }
  function matTex(name, A) { return '\\mathbf{' + name + '}=\\begin{bmatrix}' + A.map(r => r.map(v => n(v, 6)).join(' & ')).join('\\\\') + '\\end{bmatrix}'; }

  /* ---------- подбор RC ---------- */
  function designRC(Trc1, Trc2, Krc, P) {
    const caps = D.caps.map(c => c * 1e-6);
    let best = null;
    const C1list = P.C1 === 'auto' ? caps : [P.C1 * 1e-6];
    const C2list = P.C2 === 'auto' ? caps : [P.C2 * 1e-6];
    for (const C2 of C2list) for (const C1 of C1list) {
      const R3 = Trc1 / C2, R2 = Trc2 / C1, R1 = (R3 - R2 * Krc) / Krc;
      if (R1 <= 0) { if (!best) best = { C1, C2, score: 1e9 }; continue; }
      const sc = [R1, R2, R3].reduce((s, r) => s + Math.pow(Math.log10(r / 10000), 2) + (r < 1000 ? 4 : 0) + (r > 1e6 ? 4 : 0), 0);
      if (!best || sc < best.score) best = { C1, C2, score: sc };
    }
    const { C1, C2 } = best;
    const R3c = Trc1 / C2, R2c = Trc2 / C1;
    const R3 = NC.nearestInSeries(R3c, D.E192), R2 = NC.nearestInSeries(R2c, D.E192);
    const R1c = (R3 - R2 * Krc) / Krc;
    const R1 = R1c > 0 ? NC.nearestInSeries(R1c, D.E192) : NaN;
    return { C1, C2, R3c, R2c, R1c, R1, R2, R3, Kact: R3 / (R1 + R2) };
  }

  /* ---------- аппроксимация ЛАЧХ регулятора положения ---------- */
  function magDb(sys, w) { return 20 * Math.log10(NC.C.abs(NC.freq(sys, w))); }
  // минимум ЛАЧХ (среднечастотный «пол») на интервале [wa, wb]
  function findMin(sys, wa, wb) {
    const ws = NC.logspace(Math.log10(wa), Math.log10(wb), 1200);
    let best = { L: Infinity, w: wa };
    for (const w of ws) { const L = magDb(sys, w); if (L < best.L) best = { L, w }; }
    // уточнение золотым сечением в лог. масштабе
    let a = Math.log(best.w / 1.02), b = Math.log(best.w * 1.02);
    for (let k = 0; k < 60; k++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if (magDb(sys, Math.exp(m1)) < magDb(sys, Math.exp(m2))) b = m2; else a = m1; }
    const w = Math.exp((a + b) / 2); return { w, L: magDb(sys, w) };
  }
  // частота, на которой ЛАЧХ достигает уровня L (поиск от w0 вверх или вниз)
  function findLevel(sys, L, w0, dir, wlim) {
    const ws = dir > 0 ? NC.logspace(Math.log10(w0), Math.log10(wlim), 2000) : NC.logspace(Math.log10(w0), Math.log10(wlim), 2000);
    let prev = ws[0], fprev = magDb(sys, prev) - L;
    for (let k = 1; k < ws.length; k++) {
      const w = ws[k], fw = magDb(sys, w) - L;
      if ((fprev <= 0) !== (fw <= 0)) {
        let a = prev, b = w;
        for (let it = 0; it < 60; it++) { const mm = Math.sqrt(a * b); if (((magDb(sys, mm) - L) <= 0) === (fprev <= 0)) a = mm; else b = mm; }
        return Math.sqrt(a * b);
      }
      prev = w; fprev = fw;
    }
    return NaN;
  }
  function approxPID(Wx, T1zh, T2zh, Ke, i, Kos, Kdp, TS, P) {
    const KIexact = Ke * i * Kos / Kdp;            // точная НЧ-асимптота K/T1
    const wref = Math.min(1, 0.6 / T1zh);
    const Lref = magDb(Wx, wref);
    const KI = Math.pow(10, Lref / 20) * wref;     // как в методичке: по ЛАЧХ на частоте ω = 1
    const mn = findMin(Wx, wref, 1e4);
    const Kp = Math.pow(10, mn.L / 20);
    const w1 = KI / Kp;
    const w2 = findLevel(Wx, mn.L + 3, mn.w, 1, 1e6);
    const w3 = P.Nr * w2;
    const auto = { K: Kp, T1: 1 / w1, T2: 1 / w2, T3: 1 / w3, wref, Lref, Lmin: mn.L, wmin: mn.w, KI, KIexact };
    if (P.lr5mode === 'manual' && P.pid) return Object.assign({}, auto, P.pid, { manual: true, auto });
    return Object.assign(auto, { auto: Object.assign({}, auto) });
  }
  function approxID(Wx, T2zh, T3zh, T1zh, KW, i, Kos, Kdp, TS, P) {
    const K0 = KW * i * Kos / Kdp;                 // точное значение НЧ-асимптоты
    const L0 = 20 * Math.log10(K0);
    const mn = findMin(Wx, 0.5 / T1zh, 1e4);
    const w1 = findLevel(Wx, L0 - 3, 1e-3 / T1zh, 1, mn.w);
    const w2 = w1 * Math.pow(10, (L0 - mn.L) / 20);
    const w3 = findLevel(Wx, mn.L + 3, mn.w, 1, 1e6);
    const w4 = P.Nr * w3;
    const auto = { K: K0, T1: 1 / w1, T2: 1 / w2, T3: 1 / w3, T4: 1 / w4, L0, Lmin: mn.L, wmin: mn.w };
    if (P.lr5mode === 'manual' && P.idr) return Object.assign({}, auto, P.idr, { manual: true, auto });
    return Object.assign(auto, { auto: Object.assign({}, auto) });
  }

  /* ---------- CoDeSys ---------- */
  function codesys(ss, name, title) {
    const nx = ss.A.length;
    const f = v => (+v.toPrecision(10)).toString();
    const sgn = (v, first) => { const s = f(Math.abs(v)); return (v < 0 ? '-' : (first ? '' : '+')) + s; };
    let s = `(* ${title} *)\n(* Метод непосредственного программирования, T0 — период вызова задачи *)\nPROGRAM ${name}\nVAR_INPUT\n\tin: REAL;\nEND_VAR\nVAR_OUTPUT\n\tout: REAL;\nEND_VAR\nVAR\n`;
    const xs = [], xo = [];
    for (let k = 1; k <= nx; k++) { xs.push('x' + k); xo.push('x' + k + '2'); }
    s += '\t' + xs.concat(xo).map(v => v + ': REAL := 0;').join(' ') + '\n\tUr: REAL := 0; dU: REAL := 0;\nEND_VAR\n\n';
    s += '(* Считывание сигнала рассогласования с входа контроллера *)\ndU := in;\n(* Вычисление уравнений состояния *)\n';
    for (let r = 0; r < nx; r++) {
      let e = ''; let first = true;
      for (let c0 = 0; c0 < nx; c0++) { const a = ss.A[r][c0]; if (a === 0) continue; e += (first ? (a < 0 ? '-' : '') : (a < 0 ? '-' : '+')) + (Math.abs(a) === 1 ? '' : f(Math.abs(a)) + '*') + xo[c0]; first = false; }
      const b = ss.B[r][0]; if (b !== 0) { e += (first ? (b < 0 ? '-' : '') : (b < 0 ? '-' : '+')) + (Math.abs(b) === 1 ? '' : f(Math.abs(b)) + '*') + 'dU'; first = false; }
      if (first) e = '0';
      s += `${xs[r]} := ${e};\n`;
    }
    s += '(* Вычисление уравнения выхода *)\nUr := ';
    let first = true;
    for (let c0 = 0; c0 < nx; c0++) { const cc = ss.C[0][c0]; s += sgn(cc, first) + '*' + xo[c0]; first = false; }
    s += sgn(ss.D[0][0], first) + '*dU;\n';
    s += '(* Запись сигнала управления на выход контроллера *)\nout := Ur;\n';
    for (let k = 0; k < nx; k++) s += `${xo[k]} := ${xs[k]};\n`;
    return s;
  }

  /* =================================================================
   * МОДЕЛИРОВАНИЕ (ленивые вычисления)
   * ================================================================= */
  function speedLoopBlocks(R, opt) {
    // opt: {Uz:fn, Mc:fn, digital:bool, input: id of uks (если задано — Uкс берётся с этого сигнала)}
    const l1 = R.lr1, l3 = R.lr3;
    const bl = [];
    if (!opt.uksId) bl.push({ id: 'Uz', type: 'src', f: opt.Uz });
    bl.push({ id: 'Mc', type: 'src', f: opt.Mc });
    const uks = opt.uksId || 'Uz';
    bl.push({ id: 'e', type: 'sum', ins: [[uks, 1], ['Uos', -1]] });
    if (opt.digital) {
      const ss = R.lr4.ss4;
      bl.push({ id: 'rc', type: 'dss', in: 'e', A: ss.A, B: ss.B, C: ss.C, D: ss.D, T: R.P.T0 });
      bl.push({ id: 'urc', type: 'zoh', in: 'rc', T: R.P.T0 });
    } else if (l1.caseA) {
      bl.push({ id: 'gp', type: 'gain', in: 'e', k: l3.Krc });
      bl.push({ id: 'gi', type: 'tf', in: 'e', num: [l3.Krc], den: [l3.Trc1, 0] });
      bl.push({ id: 'pi', type: 'sum', ins: [['gp', 1], ['gi', 1]] });
      bl.push({ id: 'urc', type: 'tf', in: 'pi', num: [l3.Trc2, 1], den: [l3.Trc3, 1] });
    } else {
      bl.push({ id: 'urc', type: 'tf', in: 'e', num: l3.Wrc.num, den: l3.Wrc.den });
    }
    bl.push({ id: 'utp', type: 'tf', in: 'urc', num: [l1.Ktp], den: [l1.Ttp, 1] });
    bl.push({ id: 'kdv', type: 'gain', in: 'utp', k: R.lr2.Kdv });
    bl.push({ id: 'mcg', type: 'gain', in: 'Mc', k: l3.kMc });
    bl.push({ id: 'mcf', type: 'tf', in: 'mcg', num: [l1.Te, 1], den: [0.1 * l1.Te, 1] });
    bl.push({ id: 's2', type: 'sum', ins: [['kdv', 1], ['mcf', -1]] });
    bl.push({ id: 'W', type: 'tf', in: 's2', num: [1], den: [l1.Te * l1.Tm, l1.Tm, 1] });
    bl.push({ id: 'Uos', type: 'tf', in: 'W', num: [l1.Kos], den: [l1.Tf, 1] });
    return bl;
  }
  const step = (t0, v) => t => (t >= t0 ? v : 0);

  function simLR2(R) {
    const l1 = R.lr1, l2 = R.lr2;
    const bl = [
      { id: 'Uz', type: 'src', f: step(0, R.P.Uz) },
      { id: 'Mc', type: 'src', f: step(1, R.P.Mc) },
      { id: 'e', type: 'sum', ins: [['Uz', 1], ['Uos', -1]] },
      { id: 'utp', type: 'tf', in: 'e', num: [l1.Ktp], den: [l1.Ttp, 1] },
      { id: 'E', type: 'gain', in: 'W', k: l1.c },
      { id: 'ue', type: 'sum', ins: [['utp', 1], ['E', -1]] },
      { id: 'I', type: 'tf', in: 'ue', num: [1 / l1.Rr], den: [l1.Te, 1] },
      { id: 'mcg', type: 'gain', in: 'Mc', k: l2.kMc2 },
      { id: 'dI', type: 'sum', ins: [['I', 1], ['mcg', -1]] },
      { id: 'W', type: 'tf', in: 'dI', num: [l1.Rr / (l1.c * l1.Tm)], den: [1, 0] },
      { id: 'Uos', type: 'tf', in: 'W', num: [l1.Kos], den: [l1.Tf, 1] }
    ];
    const s = NC.simulate(bl, { Tend: 2, record: ['W', 'e', 'I'], points: 3000 });
    const info = NC.stepInfo(s.t, s.W, { t1: 0.99 });
    const k1 = s.t.findIndex(t => t >= 0.99);
    return { sim: s, info, eBefore: s.e[k1], eAfter: s.e[s.e.length - 1], Wbefore: s.W[k1], Wafter: s.W[s.W.length - 1] };
  }
  function simSpeed(R, digital) {
    const T = 0.5;
    const a = NC.simulate(speedLoopBlocks(R, { Uz: step(0, R.P.Uz), Mc: () => 0, digital }), { Tend: T, record: ['W', 'e', 'urc'], points: 2500 });
    const b = NC.simulate(speedLoopBlocks(R, { Uz: () => 0, Mc: step(0, -R.P.Mc), digital }), { Tend: 1, record: ['W'], points: 2500 });
    const info = NC.stepInfo(a.t, a.W);
    let pk = 0, tp = 0; b.W.forEach((v, k) => { if (Math.abs(v) > Math.abs(pk)) { pk = v; tp = b.t[k]; } });
    // время восстановления (|ΔΩ| < 5% от пика)
    let trec = 0; b.W.forEach((v, k) => { if (Math.abs(v) > 0.05 * Math.abs(pk)) trec = b.t[k]; });
    return { a, b, info, pk, tp, trec };
  }
  function posBlocks(R, kind, inp, digital) {
    // kind: 'pid' | 'id' ; inp: {az: fn, Mc: fn}
    const l5 = R.lr5, l1 = R.lr1;
    const bl = [
      { id: 'az', type: 'src', f: inp.az },
      { id: 'ea', type: 'sum', ins: [['az', 1], ['alpha', -1]] },
      { id: 'edp', type: 'gain', in: 'ea', k: l5.Kdp }
    ];
    if (digital) {
      const ss = kind === 'pid' ? R.lr6.ss62 : R.lr6.ss61;
      bl.push({ id: 'rpd', type: 'dss', in: 'edp', A: ss.A, B: ss.B, C: ss.C, D: ss.D, T: R.P.T0 });
      bl.push({ id: 'urp', type: 'zoh', in: 'rpd', T: R.P.T0 });
    } else if (kind === 'pid') {
      const a = l5.ap2;
      bl.push({ id: 'rp1', type: 'gain', in: 'edp', k: a.K });
      bl.push({ id: 'rp2', type: 'tf', in: 'edp', num: [a.K / a.T1], den: [1, 0] });
      bl.push({ id: 'rps', type: 'sum', ins: [['rp1', 1], ['rp2', 1]] });
      bl.push({ id: 'urp', type: 'tf', in: 'rps', num: [a.T2, 1], den: [a.T3, 1] });
    } else {
      const a = l5.ap1;
      bl.push({ id: 'rp1', type: 'gain', in: 'edp', k: a.K });
      bl.push({ id: 'rp2', type: 'tf', in: 'rp1', num: [a.T2, 1], den: [a.T1, 1] });
      bl.push({ id: 'urp', type: 'tf', in: 'rp2', num: [a.T3, 1], den: [a.T4, 1] });
    }
    const sl = speedLoopBlocks(R, { Mc: inp.Mc, digital, uksId: 'urp' });
    bl.push(...sl);
    bl.push({ id: 'alpha', type: 'tf', in: 'W', num: [1], den: [l1.i, 0] });
    return bl;
  }
  function simPos(R, kind, digital) {
    const P = R.P;
    const Tstep = 4, Terr = 4;
    const E = P.E * D2R(P), Wm = P.W * D2R(P);
    const s1 = NC.simulate(posBlocks(R, kind, { az: step(0, 1), Mc: () => 0 }, digital), { Tend: Tstep, record: ['alpha', 'ea'], points: 2500 });
    const azf = kind === 'pid' ? (t => E * t * t / 2) : (t => Wm * t);
    const s2 = NC.simulate(posBlocks(R, kind, { az: azf, Mc: () => 0 }, digital), { Tend: Terr, record: ['ea'], points: 2500 });
    const mcf = kind === 'pid' ? (t => P.Mc * t * t / 2) : (t => P.Mc * t);
    const s3 = NC.simulate(posBlocks(R, kind, { az: () => 0, Mc: mcf }, digital), { Tend: Terr, record: ['ea'], points: 2500 });
    const info = NC.stepInfo(s1.t, s1.alpha, { yfinal: 1 });
    const errEnd = s2.ea[s2.ea.length - 1], mcEnd = s3.ea[s3.ea.length - 1];
    return { s1, s2, s3, info, errEnd, mcEnd };
  }

  const api = { compute, defaults, fromVariant, fnum, fdec, fauto, n, m, mvec, mmat, simLR2, simSpeed, simPos, polyTex, tfTex, evalMotor, step };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LABS = api;
})(typeof window !== 'undefined' ? window : globalThis);
