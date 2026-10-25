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
  /* tip — назначение блока (строка) или { d: назначение, p: [[поле окна параметров, что ввести, откуда значение]] } */
  Scheme.prototype.blk = function (id, t, x, y, view, m, tip, opt) {
    const tp = typeof tip === 'string' ? { d: tip, p: [] } : Object.assign({ p: [] }, tip);
    const o = Object.assign({}, view || {}, opt || {}, { tip: tp });
    if (t === 'sum') {
      // порты в порядке Simulink: сверху, слева, снизу
      const ord = { t: 0, l: 1, b: 2 }, ix = o.ports.map((p, k) => k).sort((a, b) => ord[o.ports[a]] - ord[o.ports[b]]);
      o.ports = ix.map(k => view.ports[k]); o.signs = ix.map(k => view.signs[k]).join('');
      const ins = sumInputs(o.ports, o.signs);
      m = Object.assign({ IconShape: q('round'), Inputs: q(ins) }, m || {});
      tp.p = [['Icon shape', 'round', 'круглый сумматор, как на схеме методички'], ['List of signs', ins, 'три позиции: сверху, слева, снизу; «|» — нет входа']].concat(tp.p);
    }
    const b = this.add(id, t, x, y, o);
    b.lib = LIB[t]; b.mp = m || {}; b.libPath = (LIB[t] || '').replace(/^simulink\//, '');
    return b;
  };
  /* вход сумматора по стороне ('l', 'b', 't') → номер порта */
  Scheme.prototype.sp = function (id, side) { return this.b[id].o.ports.indexOf(side) + 1; };
  /* вспомогательный блок только для модели (To Workspace): на рисунке не показывается */
  Scheme.prototype.hidden = function (id, t, m, src, sk) { (this.extra = this.extra || []).push({ id, lib: LIB[t], mp: m, src, sk }); return this; };

  /* ---------- подсказки: что ввести в окне параметров блока и откуда это значение ---------- */
  const mat = a => '[' + a.map(num).join(' ') + ']';
  const mtx = A => '[' + A.map(r => r.map(num).join(' ')).join('; ') + ']';
  const fc = x => num(x).replace('.', ',');
  const TF = (d, nm, dn, wn, wd) => ({ d, p: [['Numerator coefficients', mat(nm), wn], ['Denominator coefficients', mat(dn), wd]] });
  const GN = (d, v, w) => ({ d, p: [['Gain', num(v), w]] });
  const STEP = (d, t, fin, w) => ({ d, p: [['Step time', t, 'момент скачка, с'], ['Initial value', '0', ''], ['Final value', fin, w]] });
  const RAMP = (d, w) => ({ d, p: [['Slope', '0', w], ['Start time', '0', ''], ['Initial output', '0', '']] });
  const SCOPE = d => ({ d, p: [['Number of input ports', '1', 'один сигнал на осциллографе']] });
  const DSS = (d, ss, T0, nm) => ({ d, p: [['A', mtx(ss.A), 'tf2ss(' + nm + ')'], ['B', mtx(ss.B), ''], ['C', mtx(ss.C), ''], ['D', mtx(ss.D), ''], ['Sample time', num(T0), 'период квантования T0, с']] });
  const ZOH = T0 => ({ d: 'экстраполятор нулевого порядка (ЦАП): держит выход регулятора до следующего такта', p: [['Sample time', num(T0), 'T0, с']] });
  const SW = d => ({ d, p: [['Criteria for passing first input', 'u2 > Threshold', 'вход 1 проходит, пока идёт импульс'], ['Threshold', '0.5', 'середина между 0 и 1 импульса']] });
  const PULSE = (d, T0) => ({ d, p: [['Pulse type', 'Time based', ''], ['Amplitude', '1', ''], ['Period (secs)', num(T0), 'T0 — период квантования, с'], ['Pulse Width (% of period)', '50', ''], ['Phase delay (secs)', '0', '']] });
  const GROUND = { d: 'нулевой сигнал на нижний вход Switch: между импульсами квантователь выдаёт 0', p: [] };
  const radOf = (P, deg) => deg * (P.deg57 ? 1 / 57 : Math.PI / 180);

  /* ---------------- ЛР2: рис. 2.1 / 2.15 ---------------- */
  function lr2(R) {
    const o = R.lr1, P = R.P, d = new Scheme(), y = 120;
    d.blk('Step', 'step', 30, y, {}, { Time: q('0'), After: 'num2str(Uz)' }, STEP('задающее напряжение Uз (скачок при t = 0)', '0', num(P.Uz), 'Uз = ' + fc(P.Uz) + ' В'));
    d.blk('Sum', 'sum', 95, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'рассогласование ΔU = Uз − Uос');
    d.blk('Transfer Fcn', 'tf', 175, y, { num: num(o.Ktp), den: poly([o.Ttp, 1]) }, { Numerator: 'num2str(Ktp, 10)', Denominator: 'mat2str([Ttp 1], 10)' },
      TF('тиристорный преобразователь Kтп/(Tтп s+1)', [o.Ktp], [o.Ttp, 1], 'Kтп = ' + fc(o.Ktp), 'Tтп = ' + fc(o.Ttp) + ' с'));
    d.blk('Sum1', 'sum', 265, y, { ports: ['l', 't'], signs: '+-' }, {}, 'Uтп − E: вычитание противо-ЭДС');
    d.blk('Transfer Fcn2', 'tf', 350, y, { num: num(1 / o.Rr), den: poly([o.Te, 1]) }, { Numerator: 'num2str(1/R, 10)', Denominator: 'mat2str([Te 1], 10)' },
      TF('якорная цепь (1/R)/(Tэ s+1), выход — ток I', [1 / o.Rr], [o.Te, 1], '1/R, R = ' + fc(o.Rr) + ' Ом', 'Tэ = ' + fc(o.Te) + ' с'));
    d.blk('Sum2', 'sum', 440, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'I − Mc/(icη): ток минус приведённый момент нагрузки');
    d.blk('Transfer Fcn1', 'tf', 525, y, { num: num(o.Rr / (o.c * o.Tm)), den: 's' }, { Numerator: 'num2str(R/(c*Tm), 10)', Denominator: q('[1 0]') },
      TF('механическая часть R/(c Tм s), выход — Ωдв', [o.Rr / (o.c * o.Tm)], [1, 0], 'R/(c·Tм) = ' + fc(o.Rr) + '/(' + fc(o.c) + '·' + fc(o.Tm) + ')', 's — интегратор'));
    d.blk('Scope', 'scope', 650, y, {}, {}, SCOPE('осциллограф Ωдв(t)'));
    d.blk('Gain', 'gain', 395, 45, { val: num(o.c), flip: true }, { Gain: 'num2str(c, 10)' }, GN('коэффициент противо-ЭДС, E = c·Ωдв; блок развёрнут (Rotate/Flip → Flip Block)', o.c, 'c = ' + fc(o.c) + ' В·с/рад'));
    d.blk('Step1', 'step', 275, 190, {}, { Time: q('1'), After: 'num2str(Mc0)' }, STEP('наброс момента сопротивления при t = 1 с', '1', num(P.Mc), 'Mc0 = ' + fc(P.Mc) + ' Н·м'));
    d.blk('Gain1', 'gain', 370, 190, { val: num(1 / (o.i * o.c * P.eta)) }, { Gain: 'num2str(1/(i*c*eta), 10)' }, GN('приведение момента нагрузки к току якоря', 1 / (o.i * o.c * P.eta), '1/(i·c·η) = 1/(' + fc(o.i) + '·' + fc(o.c) + '·' + fc(P.eta) + ')'));
    d.blk('Transfer Fcn3', 'tf', 330, 265, { num: num(o.Kos), den: poly([o.Tf, 1]), flip: true }, { Numerator: 'num2str(Kos, 10)', Denominator: 'mat2str([Tf 1], 10)' },
      TF('тахогенератор с фильтром Kос/(Tф s+1); блок развёрнут (Flip Block)', [o.Kos], [o.Tf, 1], 'Kос = ' + fc(o.Kos) + ' В·с/рад', 'Tф = ' + fc(o.Tf) + ' с'));
    d.blk('Display', 'display', 175, 50, { val: num(R.lr2.du_u + R.lr2.du_M) }, {}, { d: 'установившаяся ошибка Δuуст, В (показание в конце моделирования)', p: [['Format', 'short', '']] });
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

  /* квантователь (рис. 4.7, 6.1): Switch пропускает сигнал в моменты импульсов Pulse Generator, между ними — Ground.
   * xs — центр Switch, y — ось входного сигнала (вход 1 Switch); выход Switch — на оси y + 14 */
  function quantizer(d, sfx, xs, y, T0, what) {
    d.blk('Switch' + sfx, 'switch', xs, y + 14, {}, { Criteria: q('u2 > Threshold'), Threshold: q('0.5') }, SW('квантователь: пропускает ' + what + ' в моменты импульсов Pulse Generator' + sfx + ', иначе 0'));
    d.blk('Pulse Generator' + sfx, 'pulse', xs - 110, y + 64, {}, { Period: 'num2str(T0)', PulseWidth: q('50'), Amplitude: q('1'), PhaseDelay: q('0') }, PULSE('импульсы квантования на управляющий вход Switch' + sfx, T0));
    d.blk('Ground' + sfx, 'ground', xs - 110, y + 112, { name: false }, {}, GROUND);
    d.ln('Pulse Generator' + sfx, 1, 'Switch' + sfx, 2, { mx: xs - 40 });
    d.ln('Ground' + sfx, 1, 'Switch' + sfx, 3, { mx: xs - 30 });
  }

  /* ---------------- контур скорости: рис. 3.10 (аналоговый РС) и 4.7 (цифровой РС) ----------------
   * x0, y — левый край и ось прямой цепи; opt.src — откуда приходит Uкс ([id, порт]) — иначе блок Step;
   * opt.mc(d, x, ym) — строит источник момента правее линии обратной связи и возвращает [id, порт] — иначе блок Step1;
   * opt.digital — цифровой регулятор */
  function speedLoop(d, R, x0, y, opt) {
    const o = R.lr1, l3 = R.lr3, P = R.P;
    let x = x0;
    if (!opt.src) { d.blk('Step', 'step', x, y, {}, { Time: q('0'), After: 'num2str(Uz_step)' }, STEP('задание контура скорости Uкс; в опыте по моменту (рис. 3.12) — 0', '0', num(P.Uz), 'Uз = ' + fc(P.Uz) + ' В')); x += 60; }
    d.blk('Sum', 'sum', x, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'рассогласование ΔuΩ = Uкс − Uос'); const xSum = x; x += 28;
    const xe = x + 14; x += 28;
    let rcOut;
    if (opt.digital) {
      x += 90;   // место под Pulse Generator, чтобы он не заходил под линию обратной связи
      quantizer(d, '', x + 18, y, P.T0, 'ошибку ΔuΩ');
      x += 36 + 32;
      const ss = R.lr4.ss4;
      d.blk('Discrete State-Space', 'dss', x + 70, y + 14, { text: 'x(n+1)=Ax(n)+Bu(n)\ny(n)=Cx(n)+Du(n)', accent: true }, { A: 'mat2str(A_rc, 12)', B: 'mat2str(B_rc, 12)', C: 'mat2str(C_rc, 12)', D: 'mat2str(D_rc, 12)', SampleTime: 'num2str(T0)' },
        DSS('цифровой регулятор скорости в пространстве состояний (ЛР4)', ss, P.T0, 'Wрс(z)'));
      x += 140 + 34;
      d.blk('Zero-Order Hold', 'zoh', x + 16, y + 14, {}, { SampleTime: 'num2str(T0)' }, ZOH(P.T0));
      d.ln('Sum', 1, 'Switch', 1);
      d.ln('Switch', 1, 'Discrete State-Space', 1);
      d.ln('Discrete State-Space', 1, 'Zero-Order Hold', 1);
      rcOut = 'Zero-Order Hold'; x += 32 + 34;
      // выход ZOH на оси y+14 — опускаем ось прямой цепи к ней
      y += 14;
    } else if (o.caseA) {
      d.blk('Gain', 'gain', x + 20, y, { val: num(l3.Krc) }, { Gain: 'num2str(Krc, 10)' }, GN('пропорциональная часть регулятора скорости', l3.Krc, 'Kрс = ' + fc(l3.Krc)));
      d.blk('Transfer Fcn1', 'tf', x + 20, y + 62, { num: num(l3.Krc), den: poly([l3.Trc1, 0]) }, { Numerator: 'num2str(Krc, 10)', Denominator: 'mat2str([Trc1 0], 10)' },
        TF('интегральная часть Kрс/(Tрс1 s)', [l3.Krc], [l3.Trc1, 0], 'Kрс = ' + fc(l3.Krc), 'Tрс1 = ' + fc(l3.Trc1) + ' с'));
      // оба звена ровно под друг другом, правее точки ветвления xe
      const mw = Math.max(d.b.Gain.w, d.b['Transfer Fcn1'].w), cx = xe + 24 + mw / 2;
      d.b.Gain.x = d.b['Transfer Fcn1'].x = cx;
      x = cx + mw / 2 + 34 + 12;
      d.blk('Sum1', 'sum', x, y, { ports: ['l', 'b'], signs: '++' }, {}, 'ПИ-часть: Kрс + Kрс/(Tрс1 s)');
      x += 12 + 34;
      const w = Math.max(poly([l3.Trc2, 1]).length, poly([l3.Trc3, 1]).length) * 6.9 + 18;
      d.blk('Transfer Fcn', 'tf', x + w / 2, y, { num: poly([l3.Trc2, 1]), den: poly([l3.Trc3, 1]) }, { Numerator: 'mat2str([Trc2 1], 10)', Denominator: 'mat2str([Trc3 1], 10)' },
        TF('дифференциальная часть (Tрс2 s+1)/(Tрс3 s+1)', [l3.Trc2, 1], [l3.Trc3, 1], 'Tрс2 = ' + fc(l3.Trc2) + ' с', 'Tрс3 = Tрс2/N = ' + fc(l3.Trc3) + ' с'));
      d.ln('Sum', 1, 'Gain', 1);
      d.ln('Sum', 1, 'Transfer Fcn1', 1, { from: [xe, y], via: [[xe, y + 62]] });
      d.ln('Gain', 1, 'Sum1', 1);
      d.ln('Transfer Fcn1', 1, 'Sum1', 2);
      d.ln('Sum1', 1, 'Transfer Fcn', 1);
      rcOut = 'Transfer Fcn'; x += w + 34;
    } else {
      const nm = poly(l3.Wrc.num), dn = poly(l3.Wrc.den), w = Math.max(nm.length, dn.length) * 6.9 + 18;
      d.blk('Transfer Fcn', 'tf', x + w / 2, y, { num: nm, den: dn, accent: true }, { Numerator: 'mat2str(num_rc, 10)', Denominator: 'mat2str(den_rc, 10)' },
        TF('регулятор скорости Wрс(s) (3.20) одним звеном: комплексные нули', l3.Wrc.num, l3.Wrc.den, 'числитель Wрс(s), Tрс1 = Tм, Tрс2 = Tэ', 'знаменатель Wрс(s)'));
      d.ln('Sum', 1, 'Transfer Fcn', 1);
      rcOut = 'Transfer Fcn'; x += w + 34;
    }
    const wt = Math.max(num(o.Ktp).length, poly([o.Ttp, 1]).length) * 6.9 + 18;
    d.blk('Transfer Fcn2', 'tf', x + wt / 2, y, { num: num(o.Ktp), den: poly([o.Ttp, 1]) }, { Numerator: 'num2str(Ktp, 10)', Denominator: 'mat2str([Ttp 1], 10)' },
      TF('тиристорный преобразователь Kтп/(Tтп s+1)', [o.Ktp], [o.Ttp, 1], 'Kтп = ' + fc(o.Ktp), 'Tтп = ' + fc(o.Ttp) + ' с'));
    x += wt + 36;
    const gw = d.add('__g', 'gain', 0, 0, { val: num(R.lr2.Kdv) }).w; delete d.b.__g; d.order.pop();
    d.blk('Gain1', 'gain', x + gw / 2, y, { val: num(R.lr2.Kdv) }, { Gain: 'num2str(Kdv, 10)' }, GN('коэффициент двигателя по напряжению', R.lr2.Kdv, 'Kдв = 1/c = 1/' + fc(o.c)));
    x += gw + 34;
    const xSm = x + 12;
    d.blk('Sum2', 'sum', xSm, y, { ports: ['l', 'b'], signs: '+-' }, {}, 'вычитание моментной составляющей (нагрузка)');
    x += 24 + 34;
    const dn3 = poly([o.Te * o.Tm, o.Tm, 1]), w3 = dn3.length * 6.9 + 18;
    d.blk('Transfer Fcn3', 'tf', x + w3 / 2, y, { num: '1', den: dn3 }, { Numerator: q('1'), Denominator: 'mat2str([Te*Tm Tm 1], 10)' },
      TF('двигатель 1/(TэTм s² + Tм s + 1), выход — Ωдв', [1], [o.Te * o.Tm, o.Tm, 1], '', 'Tэ·Tм = ' + fc(o.Te) + '·' + fc(o.Tm) + ', Tм = ' + fc(o.Tm) + ' с'));
    x += w3;
    const xb = x + 26;
    // канал момента сопротивления
    const ym = y + (opt.digital ? 136 : 110) + (opt.mc ? 30 : 0);
    const w5 = Math.max(poly([o.Te, 1]).length, poly([0.1 * o.Te, 1]).length) * 6.9 + 18;
    d.blk('Transfer Fcn5', 'tf', xSm - 40 - w5 / 2, ym, { num: poly([o.Te, 1]), den: poly([0.1 * o.Te, 1]) }, { Numerator: 'mat2str([Te 1], 10)', Denominator: 'mat2str([0.1*Te 1], 10)' },
      TF('форсирующее звено канала момента (Tэ s+1)/(0,1Tэ s+1)', [o.Te, 1], [0.1 * o.Te, 1], 'Tэ = ' + fc(o.Te) + ' с', '0,1·Tэ — малая постоянная, чтобы звено было реализуемым'));
    const g2w = d.add('__g', 'gain', 0, 0, { val: num(l3.kMc) }).w; delete d.b.__g; d.order.pop();
    d.blk('Gain2', 'gain', d.b['Transfer Fcn5'].x - w5 / 2 - 34 - g2w / 2, ym, { val: num(l3.kMc) }, { Gain: 'num2str(KMc, 10)' }, GN('приведение момента сопротивления к входу двигателя', l3.kMc, 'R/(i·c²·η) = ' + fc(o.Rr) + '/(' + fc(o.i) + '·' + fc(o.c) + '²·' + fc(P.eta) + ')'));
    const xG2 = d.b['Gain2'].x - g2w / 2;
    if (!opt.mc) { d.blk('Step1', 'step', xG2 - 50, ym, {}, { Time: q('0'), After: 'num2str(Mc_step)' }, STEP('момент сопротивления Mc; 0 в опыте по заданию, −Mc0 в опыте по моменту (рис. 3.12)', '0', '0', 'скрипт ставит −Mc0 = ' + fc(-P.Mc) + ' Н·м')); d.ln('Step1', 1, 'Gain2', 1, { label: 'Mc' }); }
    else { const src = opt.mc(d, xSum, ym, xG2); d.ln(src[0], src[1], 'Gain2', 1, { label: 'Mc' }); }
    d.ln('Gain2', 1, 'Transfer Fcn5', 1);
    d.ln('Transfer Fcn5', 1, 'Sum2', d.sp('Sum2', 'b'));
    // обратная связь
    const yf = ym + 76;
    d.blk('Transfer Fcn4', 'tf', (xSum + xb) / 2, yf, { num: num(o.Kos), den: poly([o.Tf, 1]), flip: true }, { Numerator: 'num2str(Kos, 10)', Denominator: 'mat2str([Tf 1], 10)' },
      TF('тахогенератор с фильтром Kос/(Tф s+1); блок развёрнут (Flip Block)', [o.Kos], [o.Tf, 1], 'Kос = ' + fc(o.Kos) + ' В·с/рад', 'Tф = ' + fc(o.Tf) + ' с'));
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
    d.blk('Scope', 'scope', r.xb + 50, r.y, {}, {}, SCOPE('осциллограф Ωдв(t)'));
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
    const Emax = radOf(P, P.E), Wmax = radOf(P, P.W);
    // задающие воздействия: ступенька и ν = 2 — εmax·t²/2 = Ramp·Ramp1, ν = 1 — Ωmax·t = Ramp
    d.blk('Step', 'step', 30, y0, {}, { Time: q('0'), After: q('1') }, STEP('ступенчатое задание αз = 1 рад (опыт 1); скрипт ставит 0 в опытах 2 и 3', '0', '1', 'αз = 1 рад'));
    if (kind === 'pid') {
      d.blk('Ramp', 'ramp', 30, y0 + 60, {}, { slope: q('1'), start: q('0') }, { d: 'линейный сигнал t: первый сомножитель εmax·t²/2', p: [['Slope', '1', 'всегда 1'], ['Start time', '0', ''], ['Initial output', '0', '']] });
      d.blk('Ramp1', 'ramp', 30, y0 + 116, {}, { slope: q('0'), start: q('0') }, RAMP('второй сомножитель (εmax/2)·t: вместе с Ramp даёт квадратичное задание εmax·t²/2', 'в опыте 2 скрипт ставит εmax/2 = ' + fc(Emax / 2) + ' рад/с², иначе 0'));
      d.blk('Product', 'prod', 95, y0 + 88, {}, { Inputs: q('2') }, { d: 'произведение t·(εmax/2)·t = εmax·t²/2', p: [['Number of inputs', '2', '']] });
      d.ln('Ramp', 1, 'Product', 1); d.ln('Ramp1', 1, 'Product', 2);
    } else {
      d.blk('Ramp', 'ramp', 30, y0 + 60, {}, { slope: q('0'), start: q('0') }, RAMP('линейно возрастающее задание Ωmax·t', 'в опыте 2 скрипт ставит Ωmax = ' + fc(Wmax) + ' рад/с, иначе 0'));
    }
    d.blk('Sum3', 'sum', 150, y0, { ports: ['l', 'b'], signs: '++' }, {}, 'задающее воздействие αз: ступенька + возрастающий сигнал');
    d.ln('Step', 1, 'Sum3', 1);
    if (kind === 'pid') d.ln('Product', 1, 'Sum3', d.sp('Sum3', 'b'));
    else d.ln('Ramp', 1, 'Sum3', d.sp('Sum3', 'b'));
    d.blk('Sum4', 'sum', 205, y0, { ports: ['l', 'b'], signs: '+-' }, {}, 'ошибка Δα = αз − α');
    d.ln('Sum3', 1, 'Sum4', 1, { label: 'αз' });
    const gk = d.add('__g', 'gain', 0, 0, { val: num(o.Kvt) }).w; delete d.b.__g; d.order.pop();
    d.blk('Gain3', 'gain', 240 + gk / 2 + 20, y0, { val: num(o.Kvt) }, { Gain: 'num2str(Kdp, 10)' }, GN('датчик положения (вращающийся трансформатор)', o.Kvt, 'Kдп = Uα/αmax'));
    d.ln('Sum4', 1, 'Gain3', 1, { label: 'Δα' });
    let x = 240 + gk + 20 + 36, rpOut;
    if (digital) {
      x += 90;
      const xs = x + 18;
      quantizer(d, '1', xs, y0, P.T0, 'сигнал ошибки');
      d.ln('Gain3', 1, 'Switch1', 1);
      x += 36 + 34;
      const ss = kind === 'pid' ? R.lr6.ss62 : R.lr6.ss61;
      d.blk('Discrete State-Space1', 'dss', x + 70, y0 + 14, { text: 'x(n+1)=Ax(n)+Bu(n)\ny(n)=Cx(n)+Du(n)', accent: true }, { A: 'mat2str(A_rp, 12)', B: 'mat2str(B_rp, 12)', C: 'mat2str(C_rp, 12)', D: 'mat2str(D_rp, 12)', SampleTime: 'num2str(T0)' },
        DSS('цифровой регулятор положения в пространстве состояний (ЛР6)', ss, P.T0, 'Wрп(z)'));
      x += 140 + 34;
      d.blk('Zero-Order Hold1', 'zoh', x + 16, y0 + 14, {}, { SampleTime: 'num2str(T0)' }, ZOH(P.T0));
      d.ln('Switch1', 1, 'Discrete State-Space1', 1); d.ln('Discrete State-Space1', 1, 'Zero-Order Hold1', 1);
      rpOut = 'Zero-Order Hold1'; x += 32;
    } else if (kind === 'pid') {
      const xe = x - 18;
      const g4 = d.add('__g', 'gain', 0, 0, { val: num(a.K) }).w; delete d.b.__g; d.order.pop();
      d.blk('Gain4', 'gain', x + g4 / 2 + 10, y0, { val: num(a.K) }, { Gain: 'num2str(Krp, 10)' }, GN('пропорциональная часть регулятора положения', a.K, 'Kрп = ' + fc(a.K) + ' (по ЛАЧХ)'));
      d.blk('Transfer Fcn6', 'tf', x + g4 / 2 + 10, y0 + 62, { num: num(a.K / a.T1), den: 's' }, { Numerator: 'num2str(Krp/T1, 10)', Denominator: q('[1 0]') },
        TF('интегральная часть (Kрп/T1)/s', [a.K / a.T1], [1, 0], 'Kрп/T1 = ' + fc(a.K) + '/' + fc(a.T1), 's — интегратор'));
      x += g4 + 20 + 34;
      d.blk('Sum5', 'sum', x + 12, y0, { ports: ['l', 'b'], signs: '++' }, {}, 'ПИ-часть: Kрп + (Kрп/T1)/s');
      d.ln('Gain3', 1, 'Gain4', 1);
      d.ln('Gain3', 1, 'Transfer Fcn6', 1, { from: [xe, y0], via: [[xe, y0 + 62]] });
      d.ln('Gain4', 1, 'Sum5', 1); d.ln('Transfer Fcn6', 1, 'Sum5', 2);
      x += 24 + 34;
      const w7 = Math.max(poly([a.T2, 1]).length, poly([a.T3, 1]).length) * 6.9 + 18;
      d.blk('Transfer Fcn7', 'tf', x + w7 / 2, y0, { num: poly([a.T2, 1]), den: poly([a.T3, 1]) }, { Numerator: 'mat2str([T2 1], 10)', Denominator: 'mat2str([T3 1], 10)' },
        TF('дифференциальная часть (T2 s+1)/(T3 s+1)', [a.T2, 1], [a.T3, 1], 'T2 = 1/ω2 = ' + fc(a.T2) + ' с', 'T3 = 1/ω3 = ' + fc(a.T3) + ' с'));
      d.ln('Sum5', 1, 'Transfer Fcn7', 1);
      rpOut = 'Transfer Fcn7'; x += w7;
    } else {
      const g4 = d.add('__g', 'gain', 0, 0, { val: num(a.K) }).w; delete d.b.__g; d.order.pop();
      d.blk('Gain4', 'gain', x + g4 / 2, y0, { val: num(a.K) }, { Gain: 'num2str(Krp, 10)' }, GN('коэффициент регулятора положения', a.K, 'Kрп = ' + fc(a.K) + ' (по ЛАЧХ)'));
      x += g4 + 34;
      const w6 = Math.max(poly([a.T2, 1]).length, poly([a.T1, 1]).length) * 6.9 + 18;
      d.blk('Transfer Fcn6', 'tf', x + w6 / 2, y0, { num: poly([a.T2, 1]), den: poly([a.T1, 1]) }, { Numerator: 'mat2str([T2 1], 10)', Denominator: 'mat2str([T1 1], 10)' },
        TF('интегро-дифференцирующее звено (T2 s+1)/(T1 s+1)', [a.T2, 1], [a.T1, 1], 'T2 = 1/ω2 = ' + fc(a.T2) + ' с', 'T1 = 1/ω1 = ' + fc(a.T1) + ' с'));
      x += w6 + 34;
      const w7 = Math.max(poly([a.T3, 1]).length, poly([a.T4, 1]).length) * 6.9 + 18;
      d.blk('Transfer Fcn7', 'tf', x + w7 / 2, y0, { num: poly([a.T3, 1]), den: poly([a.T4, 1]) }, { Numerator: 'mat2str([T3 1], 10)', Denominator: 'mat2str([T4 1], 10)' },
        TF('форсирующее звено (T3 s+1)/(T4 s+1)', [a.T3, 1], [a.T4, 1], 'T3 = 1/ω3 = ' + fc(a.T3) + ' с', 'T4 = 1/ω4 = ' + fc(a.T4) + ' с'));
      d.ln('Gain3', 1, 'Gain4', 1); d.ln('Gain4', 1, 'Transfer Fcn6', 1); d.ln('Transfer Fcn6', 1, 'Transfer Fcn7', 1);
      rpOut = 'Transfer Fcn7'; x += w7;
    }
    // момент сопротивления: ν = 2 — Mc0·t²/2 = Ramp2·Ramp3, ν = 1 — Mc0·t = Ramp1; источники стоят правее линии обратной связи контура скорости
    const ys = y0 + 200;
    const mc = (dd, xSum, ym) => {
      const xa = xSum + 46;
      if (kind === 'pid') {
        dd.blk('Ramp2', 'ramp', xa, ym - 26, {}, { slope: q('1'), start: q('0') }, { d: 'линейный сигнал t: первый сомножитель Mc0·t²/2', p: [['Slope', '1', 'всегда 1'], ['Start time', '0', ''], ['Initial output', '0', '']] });
        dd.blk('Ramp3', 'ramp', xa, ym + 26, {}, { slope: q('0'), start: q('0') }, RAMP('второй сомножитель (Mc0/2)·t: вместе с Ramp2 даёт момент Mc0·t²/2', 'в опыте 3 скрипт ставит Mc0/2 = ' + fc(P.Mc / 2) + ' Н·м/с², иначе 0'));
        dd.blk('Product1', 'prod', xa + 64, ym, {}, { Inputs: q('2') }, { d: 'произведение t·(Mc0/2)·t = Mc0·t²/2', p: [['Number of inputs', '2', '']] });
        dd.ln('Ramp2', 1, 'Product1', 1); dd.ln('Ramp3', 1, 'Product1', 2);
        return ['Product1', 1];
      }
      dd.blk('Ramp1', 'ramp', xa, ym, {}, { slope: q('0'), start: q('0') }, RAMP('линейно возрастающий момент сопротивления Mc0·t', 'в опыте 3 скрипт ставит Mc0 = ' + fc(P.Mc) + ' Н·м/с, иначе 0'));
      return ['Ramp1', 1];
    };
    const xr = x + 24;
    const x0s = 290;
    const r = speedLoop(d, R, x0s, ys, { digital, src: [rpOut, 1], srcOpt: { via: [[xr, d.outP(rpOut, 1)[1]], [xr, ys - 40], [x0s - 30, ys - 40], [x0s - 30, ys]] }, mc });
    const xt = r.xb + 40;
    d.blk('Transfer Fcn8', 'tf', xt + 30, r.y, { num: '1', den: num(o.i) + 's' }, { Numerator: q('1'), Denominator: 'mat2str([i 0], 10)' },
      TF('редуктор с интегрированием: α = Ωдв/(i s)', [1], [o.i, 0], '', 'i = ' + fc(o.i) + ' — передаточное число'));
    d.ln('Transfer Fcn3', 1, 'Transfer Fcn8', 1, { label: 'Ωдв' });
    const xa = d.b['Transfer Fcn8'].x + d.b['Transfer Fcn8'].w / 2 + 26;
    d.blk('Scope', 'scope', xa + 50, r.y, {}, {}, SCOPE('осциллограф α(t)'));
    d.ln('Transfer Fcn8', 1, 'Scope', 1, { label: 'α' });
    const yfb = r.yEnd + 44;
    d.ln('Transfer Fcn8', 1, 'Sum4', d.sp('Sum4', 'b'), { from: [xa, r.y], via: [[xa, yfb], [205, yfb]] });
    d.blk('Display', 'display', 300, y0 - 55, { val: '…' }, {}, { d: 'ошибка Δα, рад — показание в конце каждого опыта', p: [['Format', 'short', '']] });
    d.ln('Sum4', 1, 'Display', 1, { from: [228, y0], via: [[228, y0 - 55]] });
    d.hidden('a_out', 'tows', toWs('a_pos'), 'Transfer Fcn8', 1).hidden('e_out', 'tows', toWs('e_pos'), 'Sum4', 1);
    return d;
  }

  const api = { lr2, speedChain, pos, poly, num, LIB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DIAG = api;
})(typeof window !== 'undefined' ? window : globalThis);
