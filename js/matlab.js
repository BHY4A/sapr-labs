/* =====================================================================
 * matlab.js — генерация файлов для MATLAB R2022 (скрипты расчёта на
 * Control System Toolbox и скрипты построения моделей Simulink),
 * а также программ CoDeSys (.st).
 * ===================================================================== */
(function (root) {
  'use strict';
  const LABS = root.LABS || (typeof require !== 'undefined' ? require('./labs.js') : null);
  const m = LABS.m, mvec = LABS.mvec, mmat = LABS.mmat;

  function header(title, R, noFigs) {
    return `%% ${title}
% Вариант ${R.P.variant}. Файл сформирован веб-утилитой «Электропривод: ЛР 1–6».
% Методика: Погодицкий О.В. и др. «Расчёт и моделирование электроприводов
% с регуляторами различной конфигурации», КГЭУ, 2014.
% Требуется MATLAB R2022 (Control System Toolbox; для bilinear/tf2ss —
% Signal Processing Toolbox, при его отсутствии используются встроенные замены).
clear; clc; close all;
${noFigs ? '' : 'save_figs = true;   % true — сохранять рисунки в PNG (папка figures рядом со скриптом)\n'}`;
  }
  /* сохранение всех окон Figure в PNG: имя файла — <скрипт>_Ris_<этап>_<номер>, как рисунки на сайте */
  const savePng = `
%% Сохранение рисунков в PNG (папка figures)
if save_figs
    if ~exist('figures', 'dir'), mkdir('figures'); end
    fl = findobj(0, 'Type', 'figure'); [~, ix] = sort([fl.Number]); fl = fl(ix);
    scr = mfilename; if isempty(scr), scr = 'lr'; end
    for k = 1:numel(fl)
        tk = regexp(get(fl(k), 'Name'), 'Рис\\. (\\d+)\\.(\\d+)', 'tokens', 'once');
        if isempty(tk), nm = sprintf('%s_fig%d', scr, k); else, nm = sprintf('%s_Ris_%s_%s', scr, tk{1}, tk{2}); end
        f = fullfile('figures', [nm '.png']);
        drawnow;
        try
            exportgraphics(fl(k), f, 'Resolution', 200);   % R2020a и новее
        catch
            set(fl(k), 'PaperPositionMode', 'auto'); print(fl(k), f, '-dpng', '-r200');
        end
        fprintf('Рисунок сохранён: %s\\n', f);
    end
end
`;
  // общий блок параметров (одинаковый во всех скриптах — каждый файл самодостаточен)
  function params(R) {
    const P = R.P, o = R.lr1, l2 = R.lr2, l3 = R.lr3;
    return `
%% Исходные данные (табл. П.8, вариант ${P.variant})
Jn   = ${m(P.Jn)};      % момент инерции нагрузки, кг*м^2
Mc0  = ${m(P.Mc)};      % момент сопротивления нагрузки, Н*м
Wmax_deg = ${m(P.W)};   % макс. угловая скорость нагрузки, град/с
Emax_deg = ${m(P.E)};   % макс. угловое ускорение нагрузки, град/с^2
Mk   = ${m(P.M)};       % показатель колебательности M
eta  = ${m(P.eta)};     % КПД редуктора
dAW  = ${m(P.dAW)};     % ошибка по скорости, угл. мин
dAE  = ${m(P.dAE)};     % ошибка по ускорению, угл. мин
Wmax = Wmax_deg${P.deg57 ? '/57' : '*pi/180'}; % рад/с
Emax = Emax_deg${P.deg57 ? '/57' : '*pi/180'}; % рад/с^2

%% Параметры элементов (ЛР №1)
% Двигатель ${o.mo.type}: ${o.mo.P} кВт, ${o.mo.U} В, ${o.mo.n} об/мин
Unom = ${m(o.mo.U)};  nnom = ${m(o.mo.n)};
R    = ${m(o.Rr)};    % Rя + Rд.п., Ом
c    = ${m(o.c)};     % коэффициент противо-ЭДС, В*с/рад
Kdv  = ${m(l2.Kdv)};  % 1/c
Tm   = ${m(o.Tm)};    % электромеханическая постоянная, с
Te   = ${m(o.Te)};    % электромагнитная постоянная, с
i    = ${m(o.i)};     % передаточное число редуктора
Ktp  = ${m(o.Ktp)};   % коэффициент передачи ТП
Ttp  = ${m(o.Ttp)};   % постоянная времени ТП, с
Kos  = ${m(o.Kos)};   % коэффициент обратной связи по скорости, В*с/рад
Tf   = ${m(o.Tf)};    % постоянная времени фильтра ТГ, с
Kdp  = ${m(o.Kvt)};   % коэффициент передачи ВТ (датчика положения), В/рад
Uz   = ${m(P.Uz)};    % задающее напряжение контура скорости, В
`;
  }
  function regParams(R) {
    const l3 = R.lr3, o = R.lr1;
    let s = `
%% Регулятор скорости (ЛР №3, настройка на оптимум по модулю)
Trc1 = ${m(l3.Trc1)}; Trc2 = ${m(l3.Trc2)}; Trc3 = ${m(l3.Trc3)};
TS   = ${m(l3.TS)};   % суммарная малая постоянная времени КС, с
Krc  = ${m(l3.Krc)};
`;
    if (o.caseA) s += `num_rc = [Krc*Trc1*Trc2 (Trc1+Trc2)*Krc Krc];
den_rc = [Trc1*Trc3 Trc1 0];
`;
    else s += `K2 = 2*Ktp*Kdv*Kos*TS;           % Tм < 4Tэ: Tрс1 = Tм, Tрс2 = Tэ
num_rc = [Tm*Te Tm 1];
den_rc = [K2*Trc3 K2 0];
`;
    s += `KMc  = ${m(l3.kMc)};  % R/(i*c^2*eta) — канал момента сопротивления
`;
    return s;
  }
  const fallbacks = `
%% ---- вспомогательные функции (замены bilinear/tf2ss при отсутствии Signal Processing Toolbox)
function [nz, dz] = bilin(n, d, fs)
    if exist('bilinear', 'file')
        [nz, dz] = bilinear(n, d, fs);
    else
        [nz, dz] = tfdata(c2d(tf(n, d), 1/fs, 'tustin'), 'v');
        nz = nz/dz(1); dz = dz/dz(1);
    end
end
function [A, B, C, D] = tf2ss_mat(n, d)
    if exist('tf2ss', 'file')
        [A, B, C, D] = tf2ss(n, d);
    else
        n = n/d(1); d = d/d(1); k = numel(d)-1;
        n = [zeros(1, k+1-numel(n)) n];
        A = [-d(2:end); eye(k-1, k)]; B = [1; zeros(k-1, 1)];
        C = n(2:end) - n(1)*d(2:end); D = n(1);
    end
end
`;
  const plotStyle = `set(groot, 'defaultAxesXGrid', 'on', 'defaultAxesYGrid', 'on', 'defaultLineLineWidth', 1.2);
`;

  /* ---------------- ЛР1 ---------------- */
  function lr1(R) {
    const P = R.P, o = R.lr1;
    return header('ЛР №1. Выбор и расчёт элементов электропривода', R, true) + `
Jn = ${m(P.Jn)}; Mc0 = ${m(P.Mc)}; eta = ${m(P.eta)};
Wmax = ${m(P.W)}${P.deg57 ? '/57' : '*pi/180'};  Emax = ${m(P.E)}${P.deg57 ? '/57' : '*pi/180'};

%% 1. Требуемая мощность
Ptr = 2*(Jn*Emax + Mc0/eta)*Wmax;            % Вт
fprintf('Ptr = %.4g Вт\\n', Ptr);

%% 2. Выбранный двигатель (табл. П.1): ${o.mo.type}
Pnom = ${m(o.mo.P * 1000)}; Unom = ${m(o.mo.U)}; nnom = ${m(o.mo.n)}; etan = ${m(o.mo.eta / 100)};
Ra = ${m(o.mo.Ra)}; Rdp = ${m(o.mo.Rdp)}; La = ${m(o.mo.La / 1000)}; Jdv = ${m(o.mo.J * 1e-4)};

%% 3. Оптимальное передаточное число редуктора
i0 = sqrt((Jn*Emax*eta + Mc0)/(Jdv*Emax*eta));
fprintf('i0 = %.4g\\n', i0);
%% 4. Номинальный момент
Wnom = pi*nnom/30;  Mnom = Pnom/Wnom;
fprintf('Wnom = %.4g рад/с, Mnom = %.4g Н*м\\n', Wnom, Mnom);
%% 5. Проверка по скорости
i = ${m(o.i)};   % принятое передаточное число${o.me.speedOk ? ' (i = i0)' : ' (i1 = Wnom/Wmax — требование по скорости при i0 не выполняется)'}
fprintf('i0*Wmax = %.4g рад/с, Wnom = %.4g рад/с\\n', round(i0)*Wmax, Wnom);
%% 6–7. Требуемый момент и проверки
Mvr = (Jdv + Jn/i^2)*i*Emax + Mc0/(i*eta);
fprintf('Mvr = %.4g Н*м, Mvr/Mnom = %.3g (<=2), Mc0/(i*eta) = %.4g Н*м (<= Mnom)\\n', Mvr, Mvr/Mnom, Mc0/(i*eta));
%% 8–11. Ток, противо-ЭДС, постоянные времени
Inom = Pnom/(Unom*etan);  R = Ra + Rdp;
c  = (Unom - Inom*R)/Wnom;
Tm = (Jdv + Jn/i^2)*R/c^2;
fprintf('Inom = %.4g А, R = %.4g Ом, c = %.4g В*с/рад, Tm = %.4g с\\n', Inom, R, c, Tm);

%% Тиристорный преобразователь
f = ${m(P.f)}; m = ${m(P.mph)}; p = ${m(P.p)}; gam = ${m(P.gamma)}*pi/180; k = 1;
U2l = sqrt(3)*Unom;  Idgr = ${m(P.kId)}*Inom;
Ld1 = 1/(2*pi*f)*(0.126*U2l/Idgr*sin(gam) - 2*${m(P.xa)});
Udnm = Unom*2*cos(gam)/(k^2*p^2-1)*sqrt(1 + k^2*p^2*tan(gam)^2);
Ld2 = 100*Udnm/(sqrt(2)*k*p*2*pi*f*${m(P.p1)}*Inom);
fprintf('Ld1 = %.4g Гн, Ld2 = %.4g Гн, Lя = %.4g Гн\\n', Ld1, Ld2, La);
Lch = ${m(o.Lch)};   % индуктивность выбранного дросселя${o.choke ? ' (' + o.choke.name + (o.nCh > 1 ? ' x' + o.nCh : '') + ')' : ' (не требуется)'}
Te = (La + Lch)/R;
fprintf('Te = %.4g с;  Tm >= 4Te ? %d\\n', Te, Tm >= 4*Te);
Imax = ${m(P.KI)}*${m(P.Kv)}*Inom;
fprintf('Imax = %.4g А -> тиристор ${o.thy.name} (%g А, %g В)\\n', Imax, ${o.thy.I}, ${o.thy.U});
tau = 1/(2*pi*f);  Tt = 1/(2*pi*f*m);  Ttp = tau + Tt;  Ktp = Unom/${m(P.dUw)};
fprintf('tau = %.4g с, Tt = %.4g с, Ttp = %.4g с, Ktp = %.4g\\n', tau, Tt, Ttp, Ktp);
Wtp = tf(Ktp, [${m(o.Ttp)} 1])

%% Тахогенератор ${o.tg.name}
Cu = ${m(o.tg.Cu)}*1e-3*60/(2*pi);  Wtg = pi*${m(o.tg.n)}/30;  Km = Wtg/Wnom;
Kos = ${m(P.Uos)}/Wnom;  Kd = Kos/(Cu*Km);
Rd1 = ${m(P.Rd1)};  Rd2 = Kd*Rd1/(1-Kd);
fprintf('Cu = %.4g В*с/рад, Km = %.4g, Kos = %.4g, Kd = %.4g, Rd2 = %.4g Ом\\n', Cu, Km, Kos, Kd, Rd2);
Rd2n = ${m(o.Rd2n)};  Cf = ${m(o.Cf)};      % номиналы (E192, Panasonic NHG)
Tf = Rd1*Rd2n/(Rd1+Rd2n)*Cf;
fprintf('Tf = %.4g с\\n', Tf);
Wos = tf(${m(o.Kos)}, [${m(o.Tf)} 1])

%% Вращающийся трансформатор ${o.vt.name}
amax = ${m(P.alphaMax)}${P.deg57 ? '/57' : '*pi/180'};  Kvt = ${m(P.Ua)}/amax;
fprintf('Kvt = %.4g В/рад\\n', Kvt);
`;
  }

  /* ---------------- ЛР2 ---------------- */
  function lr2(R) {
    const o = R.lr1;
    return header('ЛР №2. Нескорректированный контур скорости — расчёт ошибок', R) + params(R) + `
%% Установившиеся ошибки (2.1), (2.2)
du_u = Uz/(1 + Ktp*Kos/c);
du_M = R*Kdv*Kos*Mc0/(c*i*eta*(Kdv*Ktp*Kos + 1));
fprintf('du_u = %.4g В, du_M = %.4g В, du = %.4g В\\n', du_u, du_M, du_u + du_M);

%% Передаточные функции
Wdv = tf(1/c, [Te*Tm Tm 1]);
Wtp = tf(Ktp, [Ttp 1]);
Wos = tf(Kos, [Tf 1]);
W   = Wdv*Wtp*Wos                    % разомкнутый контур
Phi = feedback(Wdv*Wtp, Wos)         % Ω(s)/Uз(s)
pole(Phi)

%% Переходный процесс по заданию (Control System Toolbox)
${plotStyle}t = (0:1e-4:2)';
u = Uz*ones(size(t));
w_u = lsim(Phi, u, t);
% ПФ по моменту для схемы рис. 2.1: Ω/Mc = -(1/(i*c*eta))*G2/(1 + G2*G1*(c + Wtp*Wos))
G1 = tf(1/R, [Te 1]);  G2 = tf(R/(c*Tm), [1 0]);
Wmc = -(1/(i*c*eta))*feedback(G2, G1*(c + Wtp*Wos));
mc = Mc0*(t >= 1);
w = w_u + lsim(Wmc, mc, t);
e = Uz - lsim(Wos, w, t);                        % сигнал рассогласования (блок Display)
k1 = find(t >= 0.99, 1);
fprintf('Моделирование: du_u = %.4g В, du = %.4g В, du_Mc = %.4g В\\n', e(k1), e(end), e(end) - e(k1));
figure('Name', 'Рис. 2.1. Угловая скорость Ωдв(t)'); plot(t, w); xlabel('t, c'); ylabel('\\Omega_{дв}, рад/с');
title('Нескорректированный контур скорости (Mc приложен при t = 1 c)');
figure('Name', 'Рис. 2.2. Сигнал рассогласования Δu(t)'); plot(t, e); xlabel('t, c'); ylabel('\\Deltau, В');
title('Сигнал рассогласования (блок Display)');
S = stepinfo(w_u(t<1), t(t<1), 'SettlingTimeThreshold', 0.05);
fprintf('Перерегулирование %.2f %%, время переходного процесса %.3f с\\n', S.Overshoot, S.SettlingTime);
fprintf('Ωуст (без нагрузки) = %.4g рад/с, после наброса Mc = %.4g рад/с\\n', w_u(end), w(end));

% Модель Simulink (рис. 2.15/2.17) строится скриптом lr2_model.m
` + savePng;
  }

  /* ---------- построитель моделей Simulink ---------- */
  const MODELREG = [];
  function Model(name) { this.name = name; this.b = []; this.l = []; MODELREG.push(this); }
  Model.prototype.add = function (nm, lib, col, row, params, opt) {
    opt = opt || {};
    const w = opt.w || 70, h = opt.h || 36;
    const x = 30 + col * 120, y = 40 + row * 90;
    this.b.push({ nm, lib, pos: [x, y, x + w, y + h], params: params || {}, opt });
    return this;
  };
  Model.prototype.ln = function (src, dst) { this.l.push([src, dst]); return this; };
  Model.prototype.code = function () {
    let s = `mdl = '${this.name}';
if bdIsLoaded(mdl), close_system(mdl, 0); end
if exist([mdl '.slx'], 'file'), delete([mdl '.slx']); end
new_system(mdl); open_system(mdl);
`;
    for (const b of this.b) {
      const pr = Object.entries(b.params).map(([k, v]) => `, '${k}', ${typeof v === 'string' ? v : "'" + v + "'"}`).join('');
      const orient = b.opt.left ? `, 'Orientation', 'left'` : '';
      s += `add_block('${b.lib}', [mdl '/${b.nm}'], 'Position', [${b.pos.join(' ')}]${orient}${pr});\n`;
    }
    for (const [a, c] of this.l) s += `add_line(mdl, '${a}', '${c}', 'autorouting', 'on');\n`;
    return s;
  };
  // строковое значение параметра MATLAB из числа/вектора
  const q = v => (Array.isArray(v) ? `mat2str(${mvec(v)}, 10)` : `num2str(${m(v)}, 10)`);
  const qx = expr => expr;   // уже MATLAB-выражение, возвращающее строку

  const LIB = {
    step: 'simulink/Sources/Step', clock: 'simulink/Sources/Clock', tf: 'simulink/Continuous/Transfer Fcn',
    gain: 'simulink/Math Operations/Gain', sum: 'simulink/Math Operations/Sum', prod: 'simulink/Math Operations/Product',
    scope: 'simulink/Sinks/Scope', disp: 'simulink/Sinks/Display', tows: 'simulink/Sinks/To Workspace',
    dss: 'simulink/Discrete/Discrete State-Space', zoh: 'simulink/Discrete/Zero-Order Hold'
  };
  const toWs = v => ({ VariableName: `'${v}'`, SaveFormat: `'Structure With Time'`, MaxDataPoints: `'inf'` });

  // общий фрагмент: контур скорости (вход — сигнал в порт Sum_e/1)
  function speedLoop(md, R, opt) {
    // opt.digital, opt.row0
    const o = R.lr1, r0 = opt.row0 || 1, c0 = opt.col0 || 1;
    md.add('Sum_e', LIB.sum, c0, r0, { Inputs: `'+-'` }, { w: 30, h: 36 });
    let col = c0 + 1;
    if (opt.digital) {
      md.add('Discrete State-Space', LIB.dss, col, r0, { A: 'mat2str(A_rc, 12)', B: 'mat2str(B_rc, 12)', C: 'mat2str(C_rc, 12)', D: 'mat2str(D_rc, 12)', SampleTime: 'num2str(T0)' }, { w: 110 });
      md.add('Zero-Order Hold', LIB.zoh, col + 1, r0, { SampleTime: 'num2str(T0)' });
      md.ln('Sum_e/1', 'Discrete State-Space/1').ln('Discrete State-Space/1', 'Zero-Order Hold/1');
      md._rcOut = 'Zero-Order Hold/1'; col += 2;
    } else if (o.caseA) {
      md.add('Gain', LIB.gain, col, r0, { Gain: 'num2str(Krc, 10)' });
      md.add('Transfer Fcn1', LIB.tf, col, r0 + 1, { Numerator: 'num2str(Krc, 10)', Denominator: 'mat2str([Trc1 0], 10)' }, { w: 90 });
      md.add('Sum_pi', LIB.sum, col + 1, r0, { Inputs: `'++'` }, { w: 30 });
      md.add('Transfer Fcn', LIB.tf, col + 2, r0, { Numerator: 'mat2str([Trc2 1], 10)', Denominator: 'mat2str([Trc3 1], 10)' }, { w: 90 });
      md.ln('Sum_e/1', 'Gain/1').ln('Sum_e/1', 'Transfer Fcn1/1').ln('Gain/1', 'Sum_pi/1').ln('Transfer Fcn1/1', 'Sum_pi/2').ln('Sum_pi/1', 'Transfer Fcn/1');
      md._rcOut = 'Transfer Fcn/1'; col += 3;
    } else {
      md.add('W_rc', LIB.tf, col, r0, { Numerator: 'mat2str(num_rc, 10)', Denominator: 'mat2str(den_rc, 10)' }, { w: 120 });
      md.ln('Sum_e/1', 'W_rc/1'); md._rcOut = 'W_rc/1'; col += 1;
    }
    md.add('Transfer Fcn2', LIB.tf, col, r0, { Numerator: 'num2str(Ktp, 10)', Denominator: 'mat2str([Ttp 1], 10)' }, { w: 80 });
    md.add('Gain1', LIB.gain, col + 1, r0, { Gain: 'num2str(Kdv, 10)' });
    md.add('Sum_m', LIB.sum, col + 2, r0, { Inputs: `'+-'` }, { w: 30 });
    md.add('Transfer Fcn3', LIB.tf, col + 3, r0, { Numerator: "'1'", Denominator: 'mat2str([Te*Tm Tm 1], 10)' }, { w: 120 });
    md.add('Gain2', LIB.gain, col + 1, r0 + 2, { Gain: 'num2str(KMc, 10)' });
    md.add('Transfer Fcn5', LIB.tf, col + 2, r0 + 2, { Numerator: 'mat2str([Te 1], 10)', Denominator: 'mat2str([0.1*Te 1], 10)' }, { w: 80 });
    md.add('Transfer Fcn4', LIB.tf, col + 1, r0 + 3, { Numerator: 'num2str(Kos, 10)', Denominator: 'mat2str([Tf 1], 10)' }, { w: 80, left: true });
    md.ln(md._rcOut, 'Transfer Fcn2/1').ln('Transfer Fcn2/1', 'Gain1/1').ln('Gain1/1', 'Sum_m/1')
      .ln('Gain2/1', 'Transfer Fcn5/1').ln('Transfer Fcn5/1', 'Sum_m/2').ln('Sum_m/1', 'Transfer Fcn3/1')
      .ln('Transfer Fcn3/1', 'Transfer Fcn4/1').ln('Transfer Fcn4/1', 'Sum_e/2');
    md._W = 'Transfer Fcn3/1'; md._colEnd = col + 4;
  }

  function simRun(vars, stop) {
    return `set_param(mdl, 'StopTime', '${stop}', 'Solver', 'ode45', 'MaxStep', '1e-3', 'RelTol', '1e-6');
save_system(mdl);
`;
  }

  /* ---------------- модель ЛР2 ---------------- */
  function lr2model(R) {
    const md = new Model('lr2_model');
    md.add('Step', LIB.step, 0, 1, { Time: "'0'", After: 'num2str(Uz)' }, { w: 40 });
    md.add('Sum', LIB.sum, 1, 1, { Inputs: `'+-'` }, { w: 30 });
    md.add('Transfer Fcn', LIB.tf, 2, 1, { Numerator: 'num2str(Ktp, 10)', Denominator: 'mat2str([Ttp 1], 10)' }, { w: 80 });
    md.add('Sum1', LIB.sum, 3, 1, { Inputs: `'+-'` }, { w: 30 });
    md.add('Transfer Fcn2', LIB.tf, 4, 1, { Numerator: 'num2str(1/R, 10)', Denominator: 'mat2str([Te 1], 10)' }, { w: 80 });
    md.add('Sum2', LIB.sum, 5, 1, { Inputs: `'+-'` }, { w: 30 });
    md.add('Transfer Fcn1', LIB.tf, 6, 1, { Numerator: 'num2str(R/(c*Tm), 10)', Denominator: "'[1 0]'" }, { w: 80 });
    md.add('Gain', LIB.gain, 4, 0, { Gain: 'num2str(c, 10)' }, { left: true });
    md.add('Step1', LIB.step, 3, 2, { Time: "'1'", After: 'num2str(Mc0)' }, { w: 40 });
    md.add('Gain1', LIB.gain, 4, 2, { Gain: 'num2str(1/(i*c*eta), 10)' });
    md.add('Transfer Fcn3', LIB.tf, 4, 3, { Numerator: 'num2str(Kos, 10)', Denominator: 'mat2str([Tf 1], 10)' }, { w: 80, left: true });
    md.add('Scope', LIB.scope, 8, 1, {}, { w: 30 });
    md.add('Display', LIB.disp, 2, 0, {}, { w: 80 });
    md.add('w_out', LIB.tows, 8, 2, toWs('w_lr2'), { w: 60 });
    md.add('e_out', LIB.tows, 2, -1 + 3, toWs('e_lr2'), { w: 60 });
    md.ln('Step/1', 'Sum/1').ln('Sum/1', 'Transfer Fcn/1').ln('Transfer Fcn/1', 'Sum1/1').ln('Gain/1', 'Sum1/2')
      .ln('Sum1/1', 'Transfer Fcn2/1').ln('Transfer Fcn2/1', 'Sum2/1').ln('Step1/1', 'Gain1/1').ln('Gain1/1', 'Sum2/2')
      .ln('Sum2/1', 'Transfer Fcn1/1').ln('Transfer Fcn1/1', 'Gain/1').ln('Transfer Fcn1/1', 'Transfer Fcn3/1')
      .ln('Transfer Fcn3/1', 'Sum/2').ln('Transfer Fcn1/1', 'Scope/1').ln('Transfer Fcn1/1', 'w_out/1')
      .ln('Sum/1', 'Display/1').ln('Sum/1', 'e_out/1');
    return header('ЛР №2. Модель Simulink нескорректированного контура скорости (рис. 2.1)', R) + params(R) + `
%% Построение модели
` + md.code() + simRun(null, 2) + `
out = sim(mdl);
w = out.get('w_lr2');  e = out.get('e_lr2');
t = w.time; W = w.signals.values; E = e.signals.values;
k1 = find(t >= 0.99, 1);
fprintf('Ошибка по заданию   du_u  = %.4g В (Display до наброса Mc)\\n', E(k1));
fprintf('Суммарная ошибка    du    = %.4g В (Display в конце)\\n', E(end));
fprintf('Моментная ошибка    du_Mc = %.4g В\\n', E(end) - E(k1));
fprintf('Ωуст = %.4g рад/с -> %.4g рад/с после наброса Mc\\n', W(k1), W(end));
${plotStyle}figure('Name', 'Рис. 2.1. Угловая скорость Ωдв(t)'); plot(t, W); xlabel('t, c'); ylabel('\\Omega_{дв}, рад/с');
title('Зависимость угловой скорости от времени (рис. 2.16/2.18)');
figure('Name', 'Рис. 2.2. Сигнал рассогласования Δu(t)'); plot(t, E); xlabel('t, c'); ylabel('\\Deltau, В');
title('Сигнал рассогласования (блок Display)');
` + savePng;
  }

  /* ---------------- ЛР3 ---------------- */
  function lr3(R) {
    const o = R.lr1, l3 = R.lr3;
    let s = header('ЛР №3. Оптимизация контура скорости (ПИД-регулятор, ОМ)', R) + params(R) + `
%% Расчёт параметров регулятора скорости
`;
    if (o.caseA) s += `% Tм >= 4Tэ
Trc1 = 2*Te/(1 - sqrt(1 - 4*Te/Tm));
Trc2 = 2*Te/(1 + sqrt(1 - 4*Te/Tm));
`; else s += `% Tм < 4Tэ — комплексные нули: Tрс1 = Tм, Tрс2 = Tэ
Trc1 = Tm;  Trc2 = Te;
`;
    s += `Trc3 = Trc2/${m(R.P.Nr)};
TS   = Ttp + Tf + Trc3;
Krc  = Trc1/(2*Ktp*Kdv*Kos*TS);
fprintf('Trc1 = %.4g c, Trc2 = %.4g c, Trc3 = %.4g c, TS = %.4g c, Krc = %.4g\\n', Trc1, Trc2, Trc3, TS, Krc);
` + (R.P.roundManual ? '% значения, принятые в расчёте (с округлением, как в методичке):\n' : '') + regParams(R) + `
%% ЛЧХ разомкнутого контура скорости (как в методичке: sys1..sys5)
sys1 = tf(num_rc, den_rc);          % W_рс(s)
sys2 = tf(Ktp, [Ttp 1]);            % W_тп(s)
sys3 = tf(Kdv, [Te*Tm Tm 1]);       % W_дв(s)
sys4 = tf(Kos, [Tf 1]);             % W_ос(s)
sys5 = sys1*sys2*sys3*sys4          % W_кс(s)
${plotStyle}figure('Name', 'Рис. 3.1. ЛАЧХ и ЛФЧХ разомкнутого контура скорости'); margin(sys5); grid on;
[Gm, Pm, Wcg, Wcp] = margin(sys5);
fprintf('Запас по амплитуде %.3g дБ (w = %.4g), запас по фазе %.3g град (wc = %.4g)\\n', 20*log10(Gm), Wcg, Pm, Wcp);

%% Переходные характеристики (CST)
Phi = feedback(sys1*sys2*sys3, sys4);           % Ω/Uкс
figure('Name', 'Рис. 3.2. Ω(t) по сигналу задания'); step(Uz*Phi, 0.5); grid on;
S = stepinfo(Uz*Phi, 'SettlingTimeThreshold', 0.05);
fprintf('sigma = %.2f %%, t_н (по 4.7TΣ) = %.4g c\\n', S.Overshoot, 4.7*TS);
% по моменту сопротивления: Mc0 = -${m(R.P.Mc)} Н*м, Uкс = 0
Wd  = tf(KMc*[Te 1], [0.1*Te 1]);
Wmc = -Wd*feedback(tf(1, [Te*Tm Tm 1]), sys1*sys2*Kdv*sys4);   % Ω/Mc
figure('Name', 'Рис. 3.3. Ω(t) по моменту сопротивления'); step(-Mc0*Wmc, 1); grid on;
`;
    if (o.caseA && l3.rc && l3.rc.R1 > 0) {
      const rc = l3.rc;
      s += `
%% RC-элементы ПИД-регулятора (рис. 3.9)
C2 = ${m(rc.C2)}; C1 = ${m(rc.C1)};          % Ф (табл. П.6)
R3 = Trc1/C2;  R2 = Trc2/C1;
R2n = ${m(rc.R2)}; R3n = ${m(rc.R3)};  % номиналы E192
R1 = (R3n - R2n*Krc)/Krc;              % по номиналам R2, R3 — чтобы Kрс сохранился
fprintf('R3 = %.4g Ом, R2 = %.4g Ом, R1 = %.4g Ом\\n', R3, R2, R1);
R1n = ${m(rc.R1)};
fprintf('Krc по номиналам = %.4g\\n', R3n/(R1n+R2n));
`;
    }
    return s + savePng;
  }
  function lr3model(R) {
    const md = new Model('lr3_model');
    md.add('Step', LIB.step, 0, 1, { Time: "'0'", After: 'num2str(Uz_step)' }, { w: 40 });
    md.add('Step1', LIB.step, 0, 3, { Time: "'0'", After: 'num2str(Mc_step)' }, { w: 40 });
    speedLoop(md, R, { row0: 1, col0: 1 });
    md.add('Scope', LIB.scope, md._colEnd, 1, {}, { w: 30 });
    md.add('w_out', LIB.tows, md._colEnd, 2, toWs('w_lr3'), { w: 60 });
    md.ln('Step/1', 'Sum_e/1').ln('Step1/1', 'Gain2/1').ln(md._W, 'Scope/1').ln(md._W, 'w_out/1');
    return header('ЛР №3. Модель Simulink контура скорости с аналоговым регулятором (рис. 3.10)', R) + params(R) + regParams(R) + `
Uz_step = Uz; Mc_step = 0;
` + md.code() + simRun(null, 0.5) + `
${plotStyle}% 1) по сигналу задания
set_param([mdl '/Step'], 'After', num2str(Uz));  set_param([mdl '/Step1'], 'After', '0');
out = sim(mdl, 'StopTime', '0.5');  w = out.get('w_lr3');
t1 = w.time; W1 = w.signals.values;
Wust = W1(end); [Wm, km] = max(W1);
sigma = (Wm - Wust)/Wust*100;  tn = t1(find(W1 >= Wust, 1));
fprintf('Ωmax = %.4g, Ωуст = %.4g рад/с, sigma = %.2f %%, t_н = %.4g c (4.7TΣ = %.4g c)\\n', Wm, Wust, sigma, tn, 4.7*${m(R.lr3.TS)});
figure('Name', 'Рис. 3.2. Ω(t) по сигналу задания (модель)'); plot(t1, W1); xlabel('t, c'); ylabel('\\Omega(t), рад/с'); title('По сигналу задания');
% 2) по моменту сопротивления (Uкс = 0, Mc0 = -${m(R.P.Mc)})
set_param([mdl '/Step'], 'After', '0');  set_param([mdl '/Step1'], 'After', num2str(-Mc0));
out = sim(mdl, 'StopTime', '1');  w = out.get('w_lr3');
figure('Name', 'Рис. 3.3. Ω(t) по моменту сопротивления (модель)'); plot(w.time, w.signals.values); xlabel('t, c'); ylabel('\\Omega(t), рад/с'); title('По моменту сопротивления');
set_param([mdl '/Step'], 'After', num2str(Uz));  set_param([mdl '/Step1'], 'After', '0');
save_system(mdl);
` + savePng;
  }

  /* ---------------- ЛР4 ---------------- */
  function lr4(R) {
    const l4 = R.lr4, P = R.P;
    return header('ЛР №4. Цифровой регулятор скорости', R) + params(R) + regParams(R) + `
T0 = ${m(P.T0)};  fs = 1/T0;

%% Дискретная аппроксимация регулятора (формула трапеций)
num = num_rc;  den = den_rc;
[numd, dend] = bilin(num, den, fs)
% ожидаемый результат: numd = ${mvec(l4.bz.num)}
%                      dend = ${mvec(l4.bz.den)}

%% Уравнения состояния цифрового регулятора (tf2ss)
[A, B, C, D] = tf2ss_mat(numd, dend)

%% ЛПЧХ разомкнутого цифрового контура скорости
Gs  = tf(Ktp, [Ttp 1]) * tf(Kdv, [Te*Tm Tm 1]) * tf(Kos, [Tf 1]);
Gz  = c2d(Gs, T0, 'zoh');            % непрерывная часть с экстраполятором нулевого порядка
Wrz = tf(numd, dend, T0);            % цифровой регулятор W_рс(z)
Wz  = Wrz*Gz                         % W_кс(z)
Wv  = d2c(Wz, 'tustin');             % υ-преобразование -> абсолютная псевдочастота
${plotStyle}figure('Name', 'Рис. 4.2. ЛПЧХ разомкнутого цифрового контура скорости'); margin(Wv); grid on;
[Gm, Pm, Wcg, Wcp] = margin(Wv);
fprintf('Lз = %.3g дБ (ωπ = %.4g), θз = %.3g град (ωс = %.4g)\\n', 20*log10(Gm), Wcg, Pm, Wcp);
figure('Name', 'Рис. 4.3. АФЧХ (псевдочастотная)'); nyquist(Wv); grid on;

%% Вариант методички (рис. 4.13): bilinear всей разомкнутой ПФ W_кс(s)
% sys5 = tf(num_rc, den_rc)*tf(Ktp,[Ttp 1])*tf(Kdv,[Te*Tm Tm 1])*tf(Kos,[Tf 1]);
% [n5, d5] = tfdata(sys5, 'v');  [nd, dd] = bilinear(n5, d5, fs);
% syms a b; a = (1+b)/(1-b);   % υ-подстановка (требуется Symbolic Math Toolbox)
% Wb = simplify(poly2sym(nd, a)/poly2sym(dd, a));

%% Переходная характеристика цифрового регулятора (рис. 4.16)
figure('Name', 'Рис. 4.1. Переходная характеристика цифрового регулятора'); step(Wrz, 0.05); grid on; title('Реакция W_{рс}(z) на единичный скачок');

%% Рабочая программа для CoDeSys — см. файл PLC_PRG.st
` + savePng + fallbacks;
  }
  function lr4model(R) {
    const md = new Model('lr4_model');
    md.add('Step', LIB.step, 0, 1, { Time: "'0'", After: 'num2str(Uz)' }, { w: 40 });
    md.add('Step1', LIB.step, 0, 3, { Time: "'0'", After: "'0'" }, { w: 40 });
    speedLoop(md, R, { row0: 1, col0: 1, digital: true });
    md.add('Scope', LIB.scope, md._colEnd, 1, {}, { w: 30 });
    md.add('w_out', LIB.tows, md._colEnd, 2, toWs('w_lr4'), { w: 60 });
    md.ln('Step/1', 'Sum_e/1').ln('Step1/1', 'Gain2/1').ln(md._W, 'Scope/1').ln(md._W, 'w_out/1');
    const ss = R.lr4.ss4;
    return header('ЛР №4. Модель Simulink контура скорости с цифровым регулятором (рис. 4.7)', R) + params(R) + regParams(R) + `
T0 = ${m(R.P.T0)};
A_rc = ${mmat(ss.A)};
B_rc = ${mmat(ss.B)};
C_rc = ${mmat(ss.C)};
D_rc = ${mmat(ss.D)};
% Блок Discrete State-Space сам выполняет квантование сигнала с периодом T0,
% поэтому модель квантователя (Switch + Pulse Generator) из методички не обязательна.
` + md.code() + simRun(null, 0.5) + `
${plotStyle}out = sim(mdl, 'StopTime', '0.5');  w = out.get('w_lr4');
t1 = w.time; W1 = w.signals.values;
Wust = W1(end); Wm = max(W1); sigma = (Wm - Wust)/Wust*100; tn = t1(find(W1 >= Wust, 1));
fprintf('Ωmax = %.4g, Ωуст = %.4g рад/с, sigma = %.2f %%, t_н = %.4g c\\n', Wm, Wust, sigma, tn);
figure('Name', 'Рис. 4.4. Ω(t) по сигналу задания (цифровой РС)'); plot(t1, W1); xlabel('t, c'); ylabel('\\Omega(t), рад/с'); title('По сигналу задания (цифровой РС)');
set_param([mdl '/Step'], 'After', '0');  set_param([mdl '/Step1'], 'After', num2str(-Mc0));
out = sim(mdl, 'StopTime', '1');  w = out.get('w_lr4');
figure('Name', 'Рис. 4.5. Ω(t) по моменту сопротивления (цифровой РС)'); plot(w.time, w.signals.values); xlabel('t, c'); ylabel('\\Omega(t), рад/с'); title('По моменту сопротивления');
set_param([mdl '/Step'], 'After', num2str(Uz));  set_param([mdl '/Step1'], 'After', '0');
save_system(mdl);
` + savePng;
  }

  /* ---------------- ЛР5 ---------------- */
  function lr5(R) {
    const l5 = R.lr5, P = R.P;
    const a2 = l5.ap2, a1 = l5.ap1;
    return header('ЛР №5. Синтез аналогового регулятора положения (графоаналитический метод)', R) + params(R) + regParams(R) + `
%% Желаемые ЛАЧХ
Ke = sqrt(2)*Emax_deg*60/dAE;   KW = sqrt(2)*Wmax_deg*60/dAW;   w0 = sqrt(Ke);
Ta = 1/w0*sqrt(Mk/(Mk-1));      Tb = sqrt(Mk*(Mk-1))/(w0*(Mk+1));
h = (Mk+1)/(Mk-1);  wM = 1/(Tb*sqrt(h));
fprintf('Ke = %.5g, KW = %.5g, w0 = %.4g, Ta = %.4g c, Tb = %.4g c, wм = %.4g\\n', Ke, KW, w0, Ta, Tb, wM);
T1zh = ${m(l5.T1zh1)};   % для ν = 1 (T1ж >> 1/ωм)

%% Неизменяемая часть: Wн(s) = Фкс(s)*Kдп/(i*s)  (как в примере 5.1)
sys1 = tf(num_rc, den_rc);  sys2 = tf(Ktp, [Ttp 1]);  sys3 = tf(Kdv, [Te*Tm Tm 1]);
sys4 = sys1*sys2*sys3;
sys5 = tf(Kos, [Tf 1]);
sys6 = feedback(sys4, sys5);
sys7 = tf(Kdp, [i 0]);
sys8 = sys6*sys7                    % W_н(s)

${plotStyle}%% ===== ν = 2: ПИД-регулятор положения =====
Wzh2 = tf([Ke*Ta Ke], [Tb 1 0 0])
Wrp2 = Wzh2/sys8                    % точная ПФ регулятора
% Аппроксимация ЛАЧХ асимптотами (параметры из веб-утилиты):
Krp2 = ${m(a2.K)}; T1 = ${m(a2.T1)}; T2 = ${m(a2.T2)}; T3 = ${m(a2.T3)};
Wrp2a = tf(Krp2*conv([T1 1], [T2 1]), conv([T1 0], [T3 1]))
figure('Name', 'Рис. 5.2. ЛАЧХ регулятора положения, ν = 2'); bodemag(Wrp2, Wrp2a, {1e-2, 1e4}); grid on;
legend('W_{рп}(s) точная', 'аппроксимация'); title('ЛАЧХ регулятора положения, ν = 2');
L2 = Wrp2a*sys8;  Phi2 = feedback(L2, 1);
figure('Name', 'Рис. 5.3. α(t), ν = 2'); step(Phi2, 4); grid on; title('Переходная характеристика по заданию, ν = 2');
S2 = stepinfo(Phi2, 'SettlingTimeThreshold', 0.05); fprintf('ν=2: sigma = %.1f %%, tп (5 %%) = %.3g c\\n', S2.Overshoot, S2.SettlingTime);
t = (0:1e-3:4)';
e2 = lsim(feedback(1, L2), Emax*t.^2/2, t);
fprintf('ν=2: ошибка при Emax*t^2/2: %.4g рад = %.3g угл.мин (треб. <= %g)\\n', e2(end), e2(end)*${P.deg57 ? '57' : '180/pi'}*60, dAE);
figure('Name', 'Рис. 5.4. Ошибка при εmax·t²/2'); plot(t, e2); xlabel('t, c'); ylabel('\\Delta\\alpha, рад'); title('Ошибка при квадратично возрастающем задании');
[GmA, PmA] = margin(L2); fprintf('ν=2: Lз = %.3g дБ, θз = %.3g град\\n', 20*log10(GmA), PmA);

%% ===== ν = 1: интегро-дифференцирующий регулятор =====
Wzh1 = tf([KW*Ta KW], conv(conv([T1zh 1], [Tb 1]), [1 0]))

%% Запретная область и желаемые ЛАЧХ (рис. 5.1)
wv  = logspace(-2, 3, 600);
KWp = Wmax_deg*60/dAW;  Kep = Emax_deg*60/dAE;          % без множителя sqrt(2): граница области
Lb  = min(20*log10(KWp./wv), 20*log10(Kep./wv.^2));     % отрезки -20 и -40 дБ/дек
Lmin = -60;
m2 = squeeze(bode(Wzh2, wv));  m1 = squeeze(bode(Wzh1, wv));
wk = Kep/KWp;  Lk = 20*log10(KWp/wk);                   % контрольная точка A_к
figure('Name', 'Рис. 5.1. Запретная область и желаемые ЛАЧХ');
fill([wv fliplr(wv)], [Lb Lmin*ones(size(wv))], [1 0.88 0.88], 'EdgeColor', [0.75 0.2 0.2], 'LineWidth', 1.2); hold on;
plot(wv, 20*log10(m2), 'Color', [0 0.447 0.741], 'LineWidth', 1.5);
plot(wv, 20*log10(m1), '--', 'Color', [0.85 0.325 0.098], 'LineWidth', 1.5);
plot(wk, Lk, 'ko', 'MarkerFaceColor', 'k'); text(wk, Lk, '  A_к', 'VerticalAlignment', 'bottom');
yline(0, ':');
set(gca, 'XScale', 'log'); grid on; ylim([Lmin, max(20*log10(m2(1)), 80) + 5]);
xlabel('\\omega, с^{-1}'); ylabel('L(\\omega), дБ');
legend('Запретная область', 'W_ж(s), \\nu = 2', 'W_ж(s), \\nu = 1', 'A_к', 'Location', 'southwest');
title('Запретная область и желаемые ЛАЧХ');
hold off;

Wrp1 = Wzh1/sys8
Krp1 = ${m(a1.K)}; T1i = ${m(a1.T1)}; T2i = ${m(a1.T2)}; T3i = ${m(a1.T3)}; T4i = ${m(a1.T4)};
Wrp1a = tf(Krp1*conv([T2i 1], [T3i 1]), conv([T1i 1], [T4i 1]))
figure('Name', 'Рис. 5.6. ЛАЧХ регулятора положения, ν = 1'); bodemag(Wrp1, Wrp1a, {1e-2, 1e4}); grid on;
legend('W_{рп}(s) точная', 'аппроксимация'); title('ЛАЧХ регулятора положения, ν = 1');
L1 = Wrp1a*sys8;  Phi1 = feedback(L1, 1);
figure('Name', 'Рис. 5.7. α(t), ν = 1'); step(Phi1, 2); grid on; title('Переходная характеристика по заданию, ν = 1');
S1 = stepinfo(Phi1, 'SettlingTimeThreshold', 0.05); fprintf('ν=1: sigma = %.1f %%, tп (5 %%) = %.3g c\\n', S1.Overshoot, S1.SettlingTime);
e1 = lsim(feedback(1, L1), Wmax*t, t);
fprintf('ν=1: ошибка при Wmax*t: %.4g рад = %.3g угл.мин (треб. <= %g)\\n', e1(end), e1(end)*${P.deg57 ? '57' : '180/pi'}*60, dAW);
figure('Name', 'Рис. 5.8. Ошибка при Ωmax·t'); plot(t, e1); xlabel('t, c'); ylabel('\\Delta\\alpha, рад'); title('Ошибка при линейно возрастающем задании');

% Полные модели Simulink (рис. 5.5 и 5.10) — скрипты lr5_model_pid.m и lr5_model_id.m
` + savePng;
  }
  function posModel(R, kind, digital) {
    const name = (digital ? 'lr6' : 'lr5') + '_model_' + kind;
    const md = new Model(name);
    // входные воздействия
    md.add('Step', LIB.step, 0, 0, { Time: "'0'", After: "'1'" }, { w: 40 });
    md.add('k_step', LIB.gain, 1, 0, { Gain: "'1'" }, { w: 50 });
    md.add('Clock', LIB.clock, 0, 1, {}, { w: 40 });
    if (kind === 'pid') {
      md.add('Product', LIB.prod, 1, 1, { Inputs: "'2'" }, { w: 40 });
      md.add('k_in', LIB.gain, 2, 1, { Gain: "'0'" }, { w: 50 });
      md.ln('Clock/1', 'Product/1').ln('Clock/1', 'Product/2').ln('Product/1', 'k_in/1');
    } else {
      md.add('k_in', LIB.gain, 2, 1, { Gain: "'0'" }, { w: 50 });
      md.ln('Clock/1', 'k_in/1');
    }
    md.add('Sum_az', LIB.sum, 3, 0, { Inputs: `'++'` }, { w: 30 });
    md.add('Sum_a', LIB.sum, 4, 0, { Inputs: `'+-'` }, { w: 30 });
    md.add('Gain4', LIB.gain, 5, 0, { Gain: 'num2str(Kdp, 10)' });
    md.ln('Step/1', 'k_step/1').ln('k_step/1', 'Sum_az/1').ln('k_in/1', 'Sum_az/2').ln('Sum_az/1', 'Sum_a/1').ln('Sum_a/1', 'Gain4/1');
    let rpOut;
    if (digital) {
      md.add('Discrete State-Space1', LIB.dss, 6, 0, { A: 'mat2str(A_rp, 12)', B: 'mat2str(B_rp, 12)', C: 'mat2str(C_rp, 12)', D: 'mat2str(D_rp, 12)', SampleTime: 'num2str(T0)' }, { w: 110 });
      md.add('Zero-Order Hold1', LIB.zoh, 7, 0, { SampleTime: 'num2str(T0)' });
      md.ln('Gain4/1', 'Discrete State-Space1/1').ln('Discrete State-Space1/1', 'Zero-Order Hold1/1');
      rpOut = 'Zero-Order Hold1/1';
    } else if (kind === 'pid') {
      md.add('Gain3', LIB.gain, 6, 0, { Gain: 'num2str(Krp, 10)' });
      md.add('Transfer Fcn7', LIB.tf, 6, 1, { Numerator: 'num2str(Krp/T1, 10)', Denominator: "'[1 0]'" }, { w: 70 });
      md.add('Sum_rp', LIB.sum, 7, 0, { Inputs: `'++'` }, { w: 30 });
      md.add('Transfer Fcn6', LIB.tf, 8, 0, { Numerator: 'mat2str([T2 1], 10)', Denominator: 'mat2str([T3 1], 10)' }, { w: 90 });
      md.ln('Gain4/1', 'Gain3/1').ln('Gain4/1', 'Transfer Fcn7/1').ln('Gain3/1', 'Sum_rp/1').ln('Transfer Fcn7/1', 'Sum_rp/2').ln('Sum_rp/1', 'Transfer Fcn6/1');
      rpOut = 'Transfer Fcn6/1';
    } else {
      md.add('Gain3', LIB.gain, 6, 0, { Gain: 'num2str(Krp, 10)' });
      md.add('Transfer Fcn7', LIB.tf, 7, 0, { Numerator: 'mat2str([T2 1], 10)', Denominator: 'mat2str([T1 1], 10)' }, { w: 90 });
      md.add('Transfer Fcn6', LIB.tf, 8, 0, { Numerator: 'mat2str([T3 1], 10)', Denominator: 'mat2str([T4 1], 10)' }, { w: 90 });
      md.ln('Gain4/1', 'Gain3/1').ln('Gain3/1', 'Transfer Fcn7/1').ln('Transfer Fcn7/1', 'Transfer Fcn6/1');
      rpOut = 'Transfer Fcn6/1';
    }
    speedLoop(md, R, { row0: 3, col0: 1, digital });
    md.ln(rpOut, 'Sum_e/1');
    md.add('Transfer Fcn8', LIB.tf, md._colEnd, 3, { Numerator: "'1'", Denominator: 'mat2str([i 0], 10)' }, { w: 70 });
    md.ln(md._W, 'Transfer Fcn8/1').ln('Transfer Fcn8/1', 'Sum_a/2');
    // возмущение
    if (kind === 'pid') {
      md.add('k_mc', LIB.gain, 2, 6, { Gain: "'0'" }, { w: 50 });
      md.ln('Product/1', 'k_mc/1');
    } else {
      md.add('k_mc', LIB.gain, 2, 6, { Gain: "'0'" }, { w: 50 });
      md.ln('Clock/1', 'k_mc/1');
    }
    md.ln('k_mc/1', 'Gain2/1');
    md.add('Scope', LIB.scope, md._colEnd + 1, 3, {}, { w: 30 });
    md.add('a_out', LIB.tows, md._colEnd + 1, 4, toWs('a_pos'), { w: 60 });
    md.add('e_out', LIB.tows, 5, 1, toWs('e_pos'), { w: 60 });
    md.add('Display', LIB.disp, 5, 2, {}, { w: 90 });
    md.ln('Transfer Fcn8/1', 'Scope/1').ln('Transfer Fcn8/1', 'a_out/1').ln('Sum_a/1', 'e_out/1').ln('Sum_a/1', 'Display/1');
    return md;
  }
  function lr5model(R, kind) {
    const P = R.P, a = kind === 'pid' ? R.lr5.ap2 : R.lr5.ap1;
    const md = posModel(R, kind, false);
    const nu = kind === 'pid' ? 2 : 1;
    const inGain = kind === 'pid' ? 'Emax/2' : 'Wmax';
    const mcGain = kind === 'pid' ? 'Mc0/2' : 'Mc0';
    const regp = kind === 'pid' ? `Krp = ${m(a.K)}; T1 = ${m(a.T1)}; T2 = ${m(a.T2)}; T3 = ${m(a.T3)};   % ПИД-регулятор положения` :
      `Krp = ${m(a.K)}; T1 = ${m(a.T1)}; T2 = ${m(a.T2)}; T3 = ${m(a.T3)}; T4 = ${m(a.T4)};   % интегро-дифференцирующий регулятор`;
    return header(`ЛР №5. Модель Simulink следящего ЭП, ν = ${nu} (рис. ${kind === 'pid' ? '5.5' : '5.10'})`, R) + params(R) + regParams(R) + `
${regp}
` + md.code() + simRun(null, 4) + runsPos(kind, inGain, mcGain, 'ЛР5', R.P);
  }
  function runsPos(kind, inGain, mcGain, tag, P) {
    const nu = kind === 'pid' ? 2 : 1;
    const lr = tag === 'ЛР5' ? 5 : 6, f0 = lr === 5 ? (nu === 2 ? 3 : 7) : (nu === 2 ? 1 : 4);
    return `
${plotStyle}% 1) ступенчатое задание αз = 1 рад
set_param([mdl '/k_step'], 'Gain', '1'); set_param([mdl '/k_in'], 'Gain', '0'); set_param([mdl '/k_mc'], 'Gain', '0');
out = sim(mdl, 'StopTime', '4'); a = out.get('a_pos');
t = a.time; A = a.signals.values;
[Am, km] = max(A); sigma = (Am - 1)*100;
ts = t(find(abs(A - 1) > 0.05, 1, 'last'));
fprintf('${tag}, ν=${nu}: sigma = %.1f %%, время регулирования (5%%) = %.3g c\\n', sigma, ts);
figure('Name', 'Рис. ${lr}.${f0}. α(t), ν = ${nu}'); plot(t, A); xlabel('t, c'); ylabel('\\alpha(t), рад'); title('Переходная характеристика по задающему воздействию');
% 2) ${kind === 'pid' ? 'квадратично возрастающее задание εmax*t^2/2' : 'линейно возрастающее задание Ωmax*t'}
set_param([mdl '/k_step'], 'Gain', '0'); set_param([mdl '/k_in'], 'Gain', num2str(${inGain}, 10));
out = sim(mdl, 'StopTime', '4'); e = out.get('e_pos');
fprintf('${tag}, ν=${nu}: установившаяся ошибка = %.4g рад = %.3g угл. мин\\n', e.signals.values(end), e.signals.values(end)*${P.deg57 ? '57' : '180/pi'}*60);
figure('Name', 'Рис. ${lr}.${f0 + 1}. Ошибка, ν = ${nu}'); plot(e.time, e.signals.values); xlabel('t, c'); ylabel('\\Delta\\alpha, рад'); title('Ошибка при ${kind === 'pid' ? 'квадратично' : 'линейно'} возрастающем задании');
% 3) ${kind === 'pid' ? 'квадратично' : 'линейно'} возрастающий момент сопротивления
set_param([mdl '/k_in'], 'Gain', '0'); set_param([mdl '/k_mc'], 'Gain', num2str(${mcGain}, 10));
out = sim(mdl, 'StopTime', '4'); e = out.get('e_pos');
fprintf('${tag}, ν=${nu}: моментная составляющая ошибки = %.4g рад = %.3g угл. мин\\n', e.signals.values(end), e.signals.values(end)*${P.deg57 ? '57' : '180/pi'}*60);
figure('Name', 'Рис. ${lr}.${f0 + 2}. Моментная составляющая ошибки, ν = ${nu}'); plot(e.time, e.signals.values); xlabel('t, c'); ylabel('\\Delta\\alpha^м, рад'); title('Моментная составляющая ошибки');
set_param([mdl '/k_step'], 'Gain', '1'); set_param([mdl '/k_mc'], 'Gain', '0');
save_system(mdl);
` + savePng;
  }

  /* ---------------- ЛР6 ---------------- */
  function lr6(R) {
    const l5 = R.lr5, l6 = R.lr6, P = R.P;
    return header('ЛР №6. Программная реализация регулятора положения (аналитический синтез)', R) + params(R) + regParams(R) + `
T0 = ${m(P.T0)}; fs = 1/T0;
Ke = sqrt(2)*Emax_deg*60/dAE;   KW = sqrt(2)*Wmax_deg*60/dAW;   w0 = sqrt(Ke);
Ta = 1/w0*sqrt(Mk/(Mk-1));      Tb = sqrt(Mk*(Mk-1))/(w0*(Mk+1));
T1zh = ${m(l5.T1zh1)};

%% Неизменяемая часть (КС настроен на ОМ)
Phi_om = tf([Tf 1]/Kos, [2*TS^2 2*TS 1]);
Wn = Phi_om*tf(Kdp, [i 0])

%% ===== ν = 2 =====
Wzh2 = tf([Ke*Ta Ke], [Tb 1 0 0]);
sys3 = Wzh2/Wn;
Wrp2 = minreal(sys3)
[num2, den2] = tfdata(Wrp2, 'v');
[numd2, dend2] = bilin(num2, den2, fs)
[A2, B2, C2, D2] = tf2ss_mat(numd2, dend2)
% ожидаемые коэффициенты: numd = ${mvec(l6.bz62.num)}
%                         dend = ${mvec(l6.bz62.den)}

%% ===== ν = 1 =====
Wzh1 = tf([KW*Ta KW], conv(conv([T1zh 1], [Tb 1]), [1 0]));
sys3 = Wzh1/Wn;
Wrp1 = minreal(sys3)
[num1, den1] = tfdata(Wrp1, 'v');
[numd1, dend1] = bilin(num1, den1, fs)
[A1, B1, C1, D1] = tf2ss_mat(numd1, dend1)
% ожидаемые коэффициенты: numd = ${mvec(l6.bz61.num)}
%                         dend = ${mvec(l6.bz61.den)}

${plotStyle}figure('Name', 'ЛР6: ЛАЧХ регуляторов'); bode(Wrp2, Wrp1); grid on; legend('ν = 2 (ПИД)', 'ν = 1 (ИД)');
% Модели Simulink (рис. 6.1 и 6.5) — lr6_model_pid.m и lr6_model_id.m
% Программы CoDeSys — PLC_PRG_RP2.st и PLC_PRG_RP1.st
` + savePng + fallbacks;
  }
  function lr6model(R, kind) {
    const l6 = R.lr6, ss4 = R.lr4.ss4;
    const ss = kind === 'pid' ? l6.ss62 : l6.ss61;
    const md = posModel(R, kind, true);
    const nu = kind === 'pid' ? 2 : 1;
    const inGain = kind === 'pid' ? 'Emax/2' : 'Wmax';
    const mcGain = kind === 'pid' ? 'Mc0/2' : 'Mc0';
    return header(`ЛР №6. Модель Simulink цифро-аналогового следящего ЭП, ν = ${nu} (рис. ${kind === 'pid' ? '6.1' : '6.5'})`, R) + params(R) + regParams(R) + `
T0 = ${m(R.P.T0)};
% цифровой регулятор скорости (ЛР4)
A_rc = ${mmat(ss4.A)};
B_rc = ${mmat(ss4.B)};
C_rc = ${mmat(ss4.C)};
D_rc = ${mmat(ss4.D)};
% цифровой регулятор положения
A_rp = ${mmat(ss.A)};
B_rp = ${mmat(ss.B)};
C_rp = ${mmat(ss.C)};
D_rp = ${mmat(ss.D)};
` + md.code() + simRun(null, 4) + runsPos(kind, inGain, mcGain, 'ЛР6', R.P);
  }

  /* ---------------- README ---------------- */
  function readme(R) {
    const P = R.P;
    return `ЭЛЕКТРОПРИВОД: ЛАБОРАТОРНЫЕ РАБОТЫ 1–6. ВАРИАНТ ${P.variant}
=====================================================

Порядок работы в MATLAB R2022:
 1. Распакуйте архив, в MATLAB перейдите в папку нужной лабораторной
    (Current Folder) — каждый скрипт самодостаточен, все параметры
    варианта записаны в начале файла.
 2. Скрипты lrN_raschet.m — расчёты по методичке (Control System
    Toolbox): передаточные функции, ЛЧХ, запасы устойчивости, переходные
    процессы. Запуск: F5 или команда в Command Window, например  lr3_raschet
 3. Скрипты lrN_model*.m — автоматически строят структурную схему
    динамической модели в Simulink (файл .slx сохраняется рядом),
    запускают моделирование с теми же воздействиями, что в методичке,
    и строят графики. Готовую модель можно открыть и править вручную.
 4. Файлы *.st — рабочие программы цифровых регуляторов для CoDeSys
    (ПЛК154): создайте POU «PLC_PRG» на языке ST и вставьте текст.
 5. Окна с графиками подписаны номерами рисунков сайта («Рис. 3.2. …»)
    и автоматически сохраняются в PNG (200 dpi) в папку figures рядом
    со скриптом: lr3_model_Ris_3_2.png и т. п. Отключить: в начале
    скрипта поставить save_figs = false.

Состав:
  LR1/lr1_raschet.m          выбор двигателя, ТП, ТГ, ВТ
  LR2/lr2_raschet.m          установившиеся ошибки, Ω(t)
  LR2/lr2_model.m            модель рис. 2.1 (Display — ошибки)
  LR3/lr3_raschet.m          ПИД-регулятор скорости, ЛЧХ, RC-элементы
  LR3/lr3_model.m            модель рис. 3.10
  LR4/lr4_raschet.m          bilinear, tf2ss, ЛПЧХ, АФЧХ
  LR4/lr4_model.m            модель рис. 4.7 (Discrete State-Space)
  LR4/PLC_PRG.st             программа цифрового РС
  LR5/lr5_raschet.m          желаемые ЛАЧХ, синтез РП (ν = 2 и ν = 1)
  LR5/lr5_model_pid.m        модель рис. 5.5 (ПИД-РП)
  LR5/lr5_model_id.m         модель рис. 5.10 (интегро-дифф. РП)
  LR6/lr6_raschet.m          аналитический синтез, bilinear, tf2ss
  LR6/lr6_model_pid.m        модель рис. 6.1
  LR6/lr6_model_id.m         модель рис. 6.5
  LR6/PLC_PRG_RP2.st, PLC_PRG_RP1.st
  LRn/Otchet_LRn_varN.docx   отчёт Word по каждой работе (ГОСТ 7.32/2.105)
  Report/Otchet_LR1-6_varN.docx  единый отчёт по всем работам
  Report/                    полный расчёт (HTML), графики PNG, данные CSV

Примечания:
${P.deg57 ? ' * Угловые величины переводятся в радианы, как в методичке, делением на 57.' : ' * Угловые величины переводятся в радианы точно (π/180).'}
 * Канал момента сопротивления в моделях ЛР3–ЛР6: K = R/(i·c²·η),
   звено (Tэs+1)/(0,1Tэs+1) — как блок Transfer Fcn5 методички.
 * Если в MATLAB нет Signal Processing Toolbox, вместо bilinear/tf2ss
   используются эквивалентные функции, встроенные в скрипты.
`;
  }

  /* модели как данные (для подсказки «что вписать в блоки») */
  function models(R) {
    const out = [];
    const gen = [['lr2', 'lr2_model', () => lr2model(R)], ['lr3', 'lr3_model', () => lr3model(R)], ['lr4', 'lr4_model', () => lr4model(R)],
      ['lr5', 'lr5_model_pid', () => lr5model(R, 'pid')], ['lr5', 'lr5_model_id', () => lr5model(R, 'id')],
      ['lr6', 'lr6_model_pid', () => lr6model(R, 'pid')], ['lr6', 'lr6_model_id', () => lr6model(R, 'id')]];
    for (const [tab, file, f] of gen) { MODELREG.length = 0; const code = f(); const md = MODELREG[MODELREG.length - 1]; if (md) out.push({ tab, file, md, code }); }
    return out;
  }
  const api = { models, lr1, lr2, lr2model, lr3, lr3model, lr4, lr4model, lr5, lr5model, lr6, lr6model, readme };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MATGEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
