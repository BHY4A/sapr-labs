/* diagrams.js — структурные схемы динамических моделей в виде моделей Simulink (рис. 2.15, 3.10, 4.7, 5.5, 5.10, 6.1, 6.5).
 * Одна и та же схема рисуется на сайте (SVG) и строится скриптами *_model.m: у каждого блока есть
 * библиотечный путь Simulink и параметры (o.m), позиция в модели совпадает с позицией на рисунке. */
(function (root) {
  'use strict';
  const SL = root.SLSVG || (typeof require !== 'undefined' ? require('./slsvg.js') : null);

  function num(x) {
    if (!isFinite(x)) return '?';
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return x.toExponential(3).replace('+', '');
    return (+x.toPrecision(4)).toString();
  }
  const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
  function poly(p, v) {
    v = v || 's';
    const n = p.length - 1; let s = '';
    p.forEach((c, i) => {
      if (c === 0) return;
      const pw = n - i, a = Math.abs(c);
      const cs = (pw > 0 && Math.abs(a - 1) < 1e-12) ? '' : num(a);
      const term = cs + (pw > 0 ? v + (pw > 1 ? SUP[pw] || '^' + pw : '') : '');
      s += (s === '' ? (c < 0 ? '−' : '') : (c < 0 ? '−' : '+')) + term;
    });
    return s || '0';
  }

  /* библиотека Simulink */
  const LIB = {
    step: 'simulink/Sources/Step', ramp: 'simulink/Sources/Ramp', pulse: 'simulink/Sources/Pulse Generator', ground: 'simulink/Sources/Ground',
    tf: 'simulink/Continuous/Transfer Fcn', gain: 'simulink/Math Operations/Gain', sum: 'simulink/Math Operations/Sum',
    prod: 'simulink/Math Operations/Product', scope: 'simulink/Sinks/Scope', display: 'simulink/Sinks/Display',
    tows: 'simulink/Sinks/To Workspace', dss: 'simulink/Discrete/Discrete State-Space', zoh: 'simulink/Discrete/Zero-Order Hold',
    switch: 'simulink/Signal Routing/Switch'
  };
  const q = s => `'${s}'`;
  const toWs = v => ({ VariableName: q(v), SaveFormat: q('Structure With Time'), MaxDataPoints: q('inf') });
  /* строка Inputs круглого сумматора Simulink: позиции сверху, слева, снизу */
  function sumInputs(ports, signs) {
    const slot = { t: 0, l: 1, b: 2 }, a = ['|', '|', '|'];
    ports.forEach((p, k) => { a[slot[p]] = signs[k]; });
    return a.join('');   // три позиции нужны всегда: «-+|» — сверху и слева
  }

  function Scheme() { SL.Diagram.call(this); }
  Scheme.prototype = Object.create(SL.Diagram.prototype);
  /* блок: id — имя в Simulink, m — параметры MATLAB, view — отображение на рисунке */
  Scheme.prototype.blk = function (id, t, x, y, view, m, tip, opt) {
    const o = Object.assign({}, view || {}, opt || {}, { tip });
    if (t === 'sum') {
      // порты в порядке Simulink: сверху, слева, снизу
      const ord = { t: 0, l: 1, b: 2 }, ix = o.ports.map((p, k) => k).sort((a, b) => ord[o.ports[a]] - ord[o.ports[b]]);
      o.ports = ix.map(k => view.ports[k]); o.signs = ix.map(k => view.signs[k]).join('');
      m = Object.assign({ IconShape: q('round'), Inputs: q(sumInputs(o.ports, o.signs)) }, m || {});
    }
    const b = this.add(id, t, x, y, o);
    b.lib = LIB[t]; b.mp = m || {};
    return b;
  };
  /* вход сумматора по стороне ('l', 'b', 't') → номер порта */
  Scheme.prototype.sp = function (id, side) { return this.b[id].o.ports.indexOf(side) + 1; };
  /* вспомогательный блок только для модели (To Workspace): на рисунке не показывается */
  Scheme.prototype.hidden = function (id, t, m, src, sk) { (this.extra = this.extra || []).push({ id, lib: LIB[t], mp: m, src, sk }); return this; };

  /* ---------------- ЛР2: рис. 2.1 / 2.15 ---------------- */
  function lr2(R) {
    const o = R.lr1, P = R.P, d = new Scheme(), y = 120;
    d.blk('Step', 'step', 30, y, {}, { Time: q('0'), After: 'num2str(Uz)' }, 'Uз = ' + num(P.Uz) + ' В при t = 0');
    d.blk('Sum', 'sum', 95, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'рассогласование ΔU = Uз − Uос');
    d.blk('Transfer Fcn', 'tf', 175, y, { num: num(o.Ktp), den: poly([o.Ttp, 1]) }, { Numerator: 'num2str(Ktp, 10)', Denominator: 'mat2str([Ttp 1], 10)' }, 'тиристорный преобразователь Kтп/(Tтп s+1)');
    d.blk('Sum1', 'sum', 265, y, { ports: ['l', 't'], signs: '+-' }, {}, 'Uтп − E: вычитание противо-ЭДС');
    d.blk('Transfer Fcn2', 'tf', 350, y, { num: num(1 / o.Rr), den: poly([o.Te, 1]) }, { Numerator: 'num2str(1/R, 10)', Denominator: 'mat2str([Te 1], 10)' }, 'якорная цепь (1/R)/(Tэ s+1), выход — ток I');
    d.blk('Sum2', 'sum', 440, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'I − Mc/(icη)');
    d.blk('Transfer Fcn1', 'tf', 525, y, { num: num(o.Rr / (o.c * o.Tm)), den: 's' }, { Numerator: 'num2str(R/(c*Tm), 10)', Denominator: q('[1 0]') }, 'механическая часть R/(c Tм s), выход — Ωдв');
    d.blk('Scope', 'scope', 650, y, {}, {}, 'осциллограф Ωдв(t)');
    d.blk('Gain', 'gain', 395, 45, { val: num(o.c), flip: true }, { Gain: 'num2str(c, 10)' }, 'коэффициент противо-ЭДС c, E = cΩдв');
    d.blk('Step1', 'step', 275, 190, {}, { Time: q('1'), After: 'num2str(Mc0)' }, 'наброс момента Mc0 = ' + num(P.Mc) + ' Н·м при t = 1 с');
    d.blk('Gain1', 'gain', 370, 190, { val: num(1 / (o.i * o.c * P.eta)) }, { Gain: 'num2str(1/(i*c*eta), 10)' }, '1/(icη) — приведение момента к току');
    d.blk('Transfer Fcn3', 'tf', 330, 265, { num: num(o.Kos), den: poly([o.Tf, 1]), flip: true }, { Numerator: 'num2str(Kos, 10)', Denominator: 'mat2str([Tf 1], 10)' }, 'тахогенератор с фильтром Kос/(Tф s+1)');
    d.blk('Display', 'display', 175, 50, { val: num(R.lr2.du_u + R.lr2.du_M) }, {}, 'установившаяся ошибка Δuуст, В');
    const xb = 595;
    d.ln('Step', 1, 'Sum', 1, { label: 'Uкс' });
    d.ln('Sum', 1, 'Transfer Fcn', 1);
    d.ln('Transfer Fcn', 1, 'Sum1', d.sp('Sum1', 'l'), { label: 'Uтп' });
    d.ln('Sum1', 1, 'Transfer Fcn2', 1);
    d.ln('Transfer Fcn2', 1, 'Sum2', d.sp('Sum2', 'l'), { label: 'I' });
    d.ln('Sum2', 1, 'Transfer Fcn1', 1);
    d.ln('Transfer Fcn1', 1, 'Scope', 1, { label: 'Ωдв' });
    d.ln('Transfer Fcn1', 1, 'Gain', 1, { from: [xb, y], via: [[xb, 45]] });
    d.ln('Gain', 1, 'Sum1', d.sp('Sum1', 't'), { label: 'E' });
    d.ln('Step1', 1, 'Gain1', 1, { label: 'Mc' });
    d.ln('Gain1', 1, 'Sum2', d.sp('Sum2', 'b'));
    d.ln('Transfer Fcn1', 1, 'Transfer Fcn3', 1, { from: [xb, y], via: [[xb, 265]] });
    d.ln('Transfer Fcn3', 1, 'Sum', d.sp('Sum', 'b'), { label: 'Uос' });
    d.ln('Sum', 1, 'Display', 1, { from: [130, y], via: [[130, 50]] });
    d.hidden('w_out', 'tows', toWs('w_lr2'), 'Transfer Fcn1', 1).hidden('e_out', 'tows', toWs('e_lr2'), 'Sum', 1);
    return d;
  }

  /* ---------------- контур скорости: рис. 3.10 (аналоговый РС) и 4.7 (цифровой РС) ----------------
   * x0, y — левый край и ось прямой цепи; opt.src — откуда приходит Uкс ([id, порт]) — иначе блок Step;
   * opt.mc — источник момента ([id, порт]) — иначе блок Step1; opt.digital — цифровой регулятор */
  function speedLoop(d, R, x0, y, opt) {
    const o = R.lr1, l3 = R.lr3, P = R.P;
    let x = x0;
    if (!opt.src) { d.blk('Step', 'step', x, y, {}, { Time: q('0'), After: 'num2str(Uz_step)' }, 'задание контура скорости Uкс'); x += 60; }
    d.blk('Sum', 'sum', x, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'рассогласование ΔuΩ = Uкс − Uос'); const xSum = x; x += 28;
    const xe = x + 14; x += 28;
    let rcOut;
    if (opt.digital) {
      x += 40;   // место под Pulse Generator, чтобы он не заходил под линию обратной связи
      d.blk('Switch', 'switch', x + 18, y + 14, {}, { Criteria: q('u2 > Threshold'), Threshold: q('0.5') }, 'квантователь: пропускает ΔuΩ в моменты импульсов Pulse Generator');
      d.blk('Pulse Generator', 'pulse', x - 34, y + 62, {}, { Period: 'num2str(T0)', PulseWidth: q('50'), Amplitude: q('1'), PhaseDelay: q('0') }, 'импульсы с периодом квантования T0 = ' + num(P.T0) + ' с');
      d.blk('Ground', 'ground', x - 34, y + 104, { name: false }, {}, 'нулевой сигнал между импульсами');
      x += 36 + 32;
      d.blk('Discrete State-Space', 'dss', x + 70, y + 14, { text: 'x(n+1)=Ax(n)+Bu(n)\ny(n)=Cx(n)+Du(n)', accent: true }, { A: 'mat2str(A_rc, 12)', B: 'mat2str(B_rc, 12)', C: 'mat2str(C_rc, 12)', D: 'mat2str(D_rc, 12)', SampleTime: 'num2str(T0)' }, 'цифровой регулятор скорости: матрицы A, B, C, D (tf2ss)');
      x += 140 + 34;
      d.blk('Zero-Order Hold', 'zoh', x + 16, y + 14, {}, { SampleTime: 'num2str(T0)' }, 'экстраполятор нулевого порядка (ЦАП)');
      d.ln('Sum', 1, 'Switch', 1, { via: [[xe, y], [xe, d.inP('Switch', 1)[1]]] });
      d.ln('Pulse Generator', 1, 'Switch', 2);
      d.ln('Ground', 1, 'Switch', 3);
      d.ln('Switch', 1, 'Discrete State-Space', 1);
      d.ln('Discrete State-Space', 1, 'Zero-Order Hold', 1);
      rcOut = 'Zero-Order Hold'; x += 32 + 34;
      // выход ZOH на оси y+14 — опускаем ось прямой цепи к ней
      y += 14;
    } else if (o.caseA) {
      d.blk('Gain', 'gain', x + 20, y, { val: num(l3.Krc) }, { Gain: 'num2str(Krc, 10)' }, 'пропорциональная часть Kрс');
      d.blk('Transfer Fcn1', 'tf', x + 20, y + 62, { num: num(l3.Krc), den: poly([l3.Trc1, 0]) }, { Numerator: 'num2str(Krc, 10)', Denominator: 'mat2str([Trc1 0], 10)' }, 'интегральная часть Kрс/(Tрс1 s)');
      x += 40 + 36;
      d.blk('Sum1', 'sum', x, y, { ports: ['l', 'b'], signs: '++' }, {}, 'Kрс + Kрс/(Tрс1 s)');
      x += 11 + 34;
      const w = Math.max(poly([l3.Trc2, 1]).length, poly([l3.Trc3, 1]).length) * 6.9 + 16;
      d.blk('Transfer Fcn', 'tf', x + w / 2, y, { num: poly([l3.Trc2, 1]), den: poly([l3.Trc3, 1]) }, { Numerator: 'mat2str([Trc2 1], 10)', Denominator: 'mat2str([Trc3 1], 10)' }, 'дифференциальная часть (Tрс2 s+1)/(Tрс3 s+1)');
      d.ln('Sum', 1, 'Gain', 1);
      d.ln('Sum', 1, 'Transfer Fcn1', 1, { from: [xe, y], via: [[xe, y + 62]] });
      d.ln('Gain', 1, 'Sum1', 1);
      d.ln('Transfer Fcn1', 1, 'Sum1', 2);
      d.ln('Sum1', 1, 'Transfer Fcn', 1);
      rcOut = 'Transfer Fcn'; x += w + 34;
    } else {
      const nm = poly(l3.Wrc.num), dn = poly(l3.Wrc.den), w = Math.max(nm.length, dn.length) * 6.9 + 16;
      d.blk('Transfer Fcn', 'tf', x + w / 2, y, { num: nm, den: dn, accent: true }, { Numerator: 'mat2str(num_rc, 10)', Denominator: 'mat2str(den_rc, 10)' }, 'регулятор скорости Wрс(s) (3.20): комплексные нули, одним звеном');
      d.ln('Sum', 1, 'Transfer Fcn', 1);
      rcOut = 'Transfer Fcn'; x += w + 34;
    }
    const wt = Math.max(num(o.Ktp).length, poly([o.Ttp, 1]).length) * 6.9 + 16;
    d.blk('Transfer Fcn2', 'tf', x + wt / 2, y, { num: num(o.Ktp), den: poly([o.Ttp, 1]) }, { Numerator: 'num2str(Ktp, 10)', Denominator: 'mat2str([Ttp 1], 10)' }, 'тиристорный преобразователь Kтп/(Tтп s+1)');
    x += wt + 36;
    const gw = Math.max(34, num(R.lr2.Kdv).length * 6.9 + 26);
    d.blk('Gain1', 'gain', x + gw / 2, y, { val: num(R.lr2.Kdv) }, { Gain: 'num2str(Kdv, 10)' }, 'Kдв = 1/c');
    x += gw + 34;
    const xSm = x + 11;
    d.blk('Sum2', 'sum', xSm, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'вычитание моментной составляющей');
    x += 22 + 34;
    const dn3 = poly([o.Te * o.Tm, o.Tm, 1]), w3 = dn3.length * 6.9 + 16;
    d.blk('Transfer Fcn3', 'tf', x + w3 / 2, y, { num: '1', den: dn3 }, { Numerator: q('1'), Denominator: 'mat2str([Te*Tm Tm 1], 10)' }, 'двигатель 1/(TэTм s²+Tм s+1)');
    x += w3;
    const xb = x + 26;
    // канал момента сопротивления
    const ym = y + (opt.digital ? 96 : 120);
    const w5 = Math.max(poly([o.Te, 1]).length, poly([0.1 * o.Te, 1]).length) * 6.9 + 16;
    d.blk('Transfer Fcn5', 'tf', xSm - 40 - w5 / 2, ym, { num: poly([o.Te, 1]), den: poly([0.1 * o.Te, 1]) }, { Numerator: 'mat2str([Te 1], 10)', Denominator: 'mat2str([0.1*Te 1], 10)' }, 'форсирующее звено канала момента (Tэ s+1)/(0,1Tэ s+1)');
    const g2w = Math.max(34, num(l3.kMc).length * 6.9 + 26);
    d.blk('Gain2', 'gain', d.b['Transfer Fcn5'].x - w5 / 2 - 34 - g2w / 2, ym, { val: num(l3.kMc) }, { Gain: 'num2str(KMc, 10)' }, 'R/(i c² η) — приведение момента сопротивления');
    if (!opt.mc) { d.blk('Step1', 'step', d.b['Gain2'].x - g2w / 2 - 50, ym, {}, { Time: q('0'), After: 'num2str(Mc_step)' }, 'момент сопротивления Mc'); d.ln('Step1', 1, 'Gain2', 1, { label: 'Mc' }); }
    else d.ln(opt.mc[0], opt.mc[1], 'Gain2', 1, Object.assign({ label: 'Mc' }, opt.mcOpt || {}));
    d.ln('Gain2', 1, 'Transfer Fcn5', 1);
    d.ln('Transfer Fcn5', 1, 'Sum2', d.sp('Sum2', 'b'));
    // обратная связь
    const yf = ym + 72, w4 = Math.max(num(o.Kos).length, poly([o.Tf, 1]).length) * 6.9 + 16;
    d.blk('Transfer Fcn4', 'tf', (xSum + xb) / 2, yf, { num: num(o.Kos), den: poly([o.Tf, 1]), flip: true }, { Numerator: 'num2str(Kos, 10)', Denominator: 'mat2str([Tf 1], 10)' }, 'тахогенератор с фильтром Kос/(Tф s+1)');
    d.ln(rcOut, 1, 'Transfer Fcn2', 1, { label: 'uрс' });
    d.ln('Transfer Fcn2', 1, 'Gain1', 1, { label: 'uтп' });
    d.ln('Gain1', 1, 'Sum2', d.sp('Sum2', 'l'));
    d.ln('Sum2', 1, 'Transfer Fcn3', 1);
    d.ln('Transfer Fcn3', 1, 'Transfer Fcn4', 1, { from: [xb, y], via: [[xb, yf]] });
    d.ln('Transfer Fcn4', 1, 'Sum', d.sp('Sum', 'b'), { label: 'uос' });
    if (!opt.src) d.ln('Step', 1, 'Sum', 1, { label: 'Uкс' });
    else d.ln(opt.src[0], opt.src[1], 'Sum', 1, Object.assign({ label: 'Uкс' }, opt.srcOpt || {}));
    return { xb, y, xEnd: xb, yEnd: yf };
  }
  function speedChain(R, digital) {
    const d = new Scheme();
    const r = speedLoop(d, R, 30, 60, { digital });
    d.blk('Scope', 'scope', r.xb + 50, r.y, {}, {}, 'осциллограф Ω(t)');
    d.ln('Transfer Fcn3', 1, 'Scope', 1, { label: 'Ωдв' });
    d.hidden('w_out', 'tows', toWs(digital ? 'w_lr4' : 'w_lr3'), 'Transfer Fcn3', 1);
    d.mdlVars = { Uz_step: 'Uz', Mc_step: '0' };
    return d;
  }

  /* ---------------- контур положения: рис. 5.5, 5.10 (аналоговый) и 6.1, 6.5 (цифро-аналоговый) ---------------- */
  function pos(R, kind, digital) {
    const o = R.lr1, P = R.P, d = new Scheme();
    const a = kind === 'pid' ? R.lr5.ap2 : R.lr5.ap1;
    const y0 = 60;
    // задающие воздействия: ступенька и ν = 2 — εmax·t²/2 = Ramp·Ramp1, ν = 1 — Ωmax·t = Ramp
    d.blk('Step', 'step', 30, y0, {}, { Time: q('0'), After: q('1') }, 'ступенчатое задание αз = 1 рад');
    if (kind === 'pid') {
      d.blk('Ramp', 'ramp', 30, y0 + 60, {}, { slope: q('1'), start: q('0') }, 'линейный сигнал t (наклон 1)');
      d.blk('Ramp1', 'ramp', 30, y0 + 115, {}, { slope: q('0'), start: q('0') }, 'наклон εmax/2 — для квадратичного задания εmax·t²/2');
      d.blk('Product', 'prod', 95, y0 + 88, {}, { Inputs: q('2') }, 'εmax·t²/2 = t·(εmax/2)·t');
      d.ln('Ramp', 1, 'Product', 1); d.ln('Ramp1', 1, 'Product', 2);
    } else {
      d.blk('Ramp', 'ramp', 30, y0 + 60, {}, { slope: q('0'), start: q('0') }, 'линейно возрастающее задание Ωmax·t');
    }
    d.blk('Sum3', 'sum', 150, y0, { ports: ['l', 'b'], signs: '++' }, {}, 'выбор задающего воздействия: ступенька или возрастающий сигнал');
    d.ln('Step', 1, 'Sum3', 1);
    if (kind === 'pid') d.ln('Product', 1, 'Sum3', d.sp('Sum3', 'b'));
    else d.ln('Ramp', 1, 'Sum3', d.sp('Sum3', 'b'));
    d.blk('Sum4', 'sum', 205, y0, { ports: ['l', 'b'], signs: '+-' }, {}, 'ошибка Δα = αз − α');
    d.ln('Sum3', 1, 'Sum4', 1, { label: 'αз' });
    const gk = Math.max(34, num(o.Kvt).length * 6.9 + 26);
    d.blk('Gain3', 'gain', 240 + gk / 2 + 20, y0, { val: num(o.Kvt) }, { Gain: 'num2str(Kdp, 10)' }, 'Kдп — датчик положения (ВТ)');
    d.ln('Sum4', 1, 'Gain3', 1, { label: 'Δα' });
    let x = 240 + gk + 20 + 36, rpOut;
    if (digital) {
      const xs = x + 18;
      d.blk('Switch1', 'switch', xs, y0 + 14, {}, { Criteria: q('u2 > Threshold'), Threshold: q('0.5') }, 'квантователь сигнала ошибки');
      d.blk('Pulse Generator1', 'pulse', xs - 50, y0 + 58, {}, { Period: 'num2str(T0)', PulseWidth: q('50'), Amplitude: q('1'), PhaseDelay: q('0') }, 'импульсы с периодом T0');
      d.blk('Ground1', 'ground', xs - 50, y0 + 100, { name: false }, {}, 'нулевой сигнал');
      d.ln('Gain3', 1, 'Switch1', 1, { via: [[x - 18, y0], [x - 18, d.inP('Switch1', 1)[1]]] });
      d.ln('Pulse Generator1', 1, 'Switch1', 2);
      d.ln('Ground1', 1, 'Switch1', 3);
      x += 36 + 34;
      d.blk('Discrete State-Space1', 'dss', x + 70, y0 + 14, { text: 'x(n+1)=Ax(n)+Bu(n)\ny(n)=Cx(n)+Du(n)', accent: true }, { A: 'mat2str(A_rp, 12)', B: 'mat2str(B_rp, 12)', C: 'mat2str(C_rp, 12)', D: 'mat2str(D_rp, 12)', SampleTime: 'num2str(T0)' }, 'цифровой регулятор положения (tf2ss)');
      x += 140 + 34;
      d.blk('Zero-Order Hold1', 'zoh', x + 16, y0 + 14, {}, { SampleTime: 'num2str(T0)' }, 'экстраполятор нулевого порядка');
      d.ln('Switch1', 1, 'Discrete State-Space1', 1); d.ln('Discrete State-Space1', 1, 'Zero-Order Hold1', 1);
      rpOut = 'Zero-Order Hold1'; x += 32;
    } else if (kind === 'pid') {
      const xe = x - 18;
      const g4 = Math.max(34, num(a.K).length * 6.9 + 26);
      d.blk('Gain4', 'gain', x + g4 / 2 + 10, y0, { val: num(a.K) }, { Gain: 'num2str(Krp, 10)' }, 'пропорциональная часть Kрп');
      d.blk('Transfer Fcn6', 'tf', x + g4 / 2 + 10, y0 + 62, { num: num(a.K / a.T1), den: 's' }, { Numerator: 'num2str(Krp/T1, 10)', Denominator: q('[1 0]') }, 'интегральная часть (Kрп/T1)/s');
      x += g4 + 20 + 34;
      d.blk('Sum5', 'sum', x + 11, y0, { ports: ['l', 'b'], signs: '++' }, {}, 'Kрп + (Kрп/T1)/s');
      d.ln('Gain3', 1, 'Gain4', 1);
      d.ln('Gain3', 1, 'Transfer Fcn6', 1, { from: [xe, y0], via: [[xe, y0 + 62]] });
      d.ln('Gain4', 1, 'Sum5', 1); d.ln('Transfer Fcn6', 1, 'Sum5', 2);
      x += 22 + 34;
      const w7 = Math.max(poly([a.T2, 1]).length, poly([a.T3, 1]).length) * 6.9 + 16;
      d.blk('Transfer Fcn7', 'tf', x + w7 / 2, y0, { num: poly([a.T2, 1]), den: poly([a.T3, 1]) }, { Numerator: 'mat2str([T2 1], 10)', Denominator: 'mat2str([T3 1], 10)' }, 'дифференциальная часть (T2 s+1)/(T3 s+1)');
      d.ln('Sum5', 1, 'Transfer Fcn7', 1);
      rpOut = 'Transfer Fcn7'; x += w7;
    } else {
      const g4 = Math.max(34, num(a.K).length * 6.9 + 26);
      d.blk('Gain4', 'gain', x + g4 / 2, y0, { val: num(a.K) }, { Gain: 'num2str(Krp, 10)' }, 'коэффициент передачи Kрп');
      x += g4 + 34;
      const w6 = Math.max(poly([a.T2, 1]).length, poly([a.T1, 1]).length) * 6.9 + 16;
      d.blk('Transfer Fcn6', 'tf', x + w6 / 2, y0, { num: poly([a.T2, 1]), den: poly([a.T1, 1]) }, { Numerator: 'mat2str([T2 1], 10)', Denominator: 'mat2str([T1 1], 10)' }, '(T2 s+1)/(T1 s+1)');
      x += w6 + 34;
      const w7 = Math.max(poly([a.T3, 1]).length, poly([a.T4, 1]).length) * 6.9 + 16;
      d.blk('Transfer Fcn7', 'tf', x + w7 / 2, y0, { num: poly([a.T3, 1]), den: poly([a.T4, 1]) }, { Numerator: 'mat2str([T3 1], 10)', Denominator: 'mat2str([T4 1], 10)' }, '(T3 s+1)/(T4 s+1)');
      d.ln('Gain3', 1, 'Gain4', 1); d.ln('Gain4', 1, 'Transfer Fcn6', 1); d.ln('Transfer Fcn6', 1, 'Transfer Fcn7', 1);
      rpOut = 'Transfer Fcn7'; x += w7;
    }
    // момент сопротивления: ν = 2 — Mc0·t²/2 = Ramp2·Ramp3, ν = 1 — Mc0·t = Ramp1
    const ys = y0 + 200;
    const xL = 30;
    let mc;
    if (kind === 'pid') {
      d.blk('Ramp2', 'ramp', xL, ys + 115, {}, { slope: q('1'), start: q('0') }, 'линейный сигнал t');
      d.blk('Ramp3', 'ramp', xL, ys + 170, {}, { slope: q('0'), start: q('0') }, 'наклон Mc0/2 — для момента Mc0·t²/2');
      d.blk('Product1', 'prod', xL + 60, ys + 142, {}, { Inputs: q('2') }, 'Mc0·t²/2');
      d.ln('Ramp2', 1, 'Product1', 1); d.ln('Ramp3', 1, 'Product1', 2);
      mc = ['Product1', 1];
    } else {
      d.blk('Ramp1', 'ramp', xL + 30, ys + 120, {}, { slope: q('0'), start: q('0') }, 'линейно возрастающий момент Mc0·t');
      mc = ['Ramp1', 1];
    }
    const xr = x + 24;
    const x0s = xL + 260;
    const r = speedLoop(d, R, x0s, ys, { digital, src: [rpOut, 1], srcOpt: { via: [[xr, d.outP(rpOut, 1)[1]], [xr, ys - 40], [x0s - 30, ys - 40], [x0s - 30, ys]] }, mc });
    const xt = r.xb + 40;
    d.blk('Transfer Fcn8', 'tf', xt + 30, r.y, { num: '1', den: num(o.i) + 's' }, { Numerator: q('1'), Denominator: 'mat2str([i 0], 10)' }, 'редуктор 1/(i s)');
    d.ln('Transfer Fcn3', 1, 'Transfer Fcn8', 1, { label: 'Ωдв' });
    const xa = d.b['Transfer Fcn8'].x + d.b['Transfer Fcn8'].w / 2 + 26;
    d.blk('Scope', 'scope', xa + 50, r.y, {}, {}, 'осциллограф α(t)');
    d.ln('Transfer Fcn8', 1, 'Scope', 1, { label: 'α' });
    const yfb = r.yEnd + 40;
    d.ln('Transfer Fcn8', 1, 'Sum4', d.sp('Sum4', 'b'), { from: [xa, r.y], via: [[xa, yfb], [205, yfb]] });
    d.blk('Display', 'display', 300, y0 - 55, { val: '…' }, {}, 'ошибка Δα, рад');
    d.ln('Sum4', 1, 'Display', 1, { from: [225, y0], via: [[225, y0 - 55]] });
    d.hidden('a_out', 'tows', toWs('a_pos'), 'Transfer Fcn8', 1).hidden('e_out', 'tows', toWs('e_pos'), 'Sum4', 1);
    return d;
  }

  const api = { lr2, speedChain, pos, poly, num, LIB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DIAG = api;
})(typeof window !== 'undefined' ? window : globalThis);
