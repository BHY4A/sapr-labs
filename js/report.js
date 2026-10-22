/* report.js — генерация отчёта по лабораторным работам в формате Word (.docx) */
(function (root) {
  'use strict';
  const LOGO = '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';
  const META = {
    lr1: { title: 'Выбор и расчёт элементов электропривода',
      goal: 'Выбор и расчёт элементов неизменяемой части следящего электропривода: двигателя постоянного тока с якорным управлением, тиристорного преобразователя, датчика скорости (тахогенератора) и датчика положения (вращающегося трансформатора).',
      tasks: ['Выбрать и рассчитать двигатель постоянного тока, определить передаточное число редуктора и параметры передаточной функции двигателя.', 'Рассчитать и выбрать дроссели и тиристоры тиристорного преобразователя, определить его передаточную функцию.', 'Выбрать тахогенератор, рассчитать RC-элементы фильтра и передаточную функцию датчика скорости.', 'Выбрать вращающийся трансформатор и рассчитать его коэффициент передачи.'] },
    lr2: { title: 'Исследование нескорректированного контура скорости',
      goal: 'Исследование точностных характеристик нескорректированного контура скорости и оценка качества его переходных процессов.',
      tasks: ['Рассчитать установившиеся ошибки относительно задающего воздействия и момента сопротивления на основании теоремы о конечном значении.', 'Составить ССДМ нескорректированного контура скорости в среде MatLab Simulink, получить зависимость Ωдв(t) и определить установившиеся ошибки моделированием.'] },
    lr3: { title: 'Оптимизация контура скорости',
      goal: 'Синтез аналогового ПИД-регулятора скорости, обеспечивающего настройку контура скорости на оптимум по модулю.',
      tasks: ['Рассчитать параметры структурной схемы динамической модели контура скорости.', 'Рассчитать параметры аналогового регулятора скорости.', 'Разработать электрическую схему регулятора скорости и выбрать RC-элементы.', 'Составить ССДМ контура скорости в среде MatLab Simulink.', 'Получить и проанализировать зависимости угловой скорости от времени по сигналу задания и по моменту сопротивления.', 'Построить и проанализировать ЛЧХ разомкнутого контура скорости.'] },
    lr4: { title: 'Программная реализация цифрового регулятора скорости и моделирование контура скорости',
      goal: 'Дискретная аппроксимация ПИД-регулятора скорости, получение алгоритма его работы в виде разностных уравнений и моделирование цифро-аналогового контура скорости.',
      tasks: ['Получить передаточную функцию цифрового регулятора скорости с применением формулы трапеций.', 'Составить структурную схему непосредственного программирования и векторно-матричные уравнения цифрового регулятора.', 'Составить ССДМ контура скорости с цифровым регулятором и получить зависимости угловой скорости от времени по сигналу задания и моменту сопротивления.', 'Выполнить z- и υ-преобразование передаточной функции разомкнутого контура скорости, построить и проанализировать логарифмические псевдочастотные характеристики.', 'Записать рабочую программу цифрового регулятора скорости в среде CoDeSys.'] },
    lr5: { title: 'Синтез аналогового регулятора положения (графоаналитический метод)',
      goal: 'Синтез аналоговых регуляторов положения для систем с астатизмом первого и второго порядка с применением логарифмических частотных характеристик на основе критерия динамической точности.',
      tasks: ['Рассчитать параметры желаемых передаточных функций и построить запретную область.', 'Получить ЛАЧХ ПИД-регулятора положения (ν = 2) и аппроксимировать её асимптотами.', 'Получить ЛАЧХ интегро-дифференцирующего регулятора положения (ν = 1) и аппроксимировать её асимптотами.', 'Составить ССДМ следящих позиционных электроприводов с синтезированными регуляторами.', 'Получить и проанализировать переходные характеристики и ошибки при отработке управляющих и возмущающих воздействий.'] },
    lr6: { title: 'Программная реализация регулятора положения',
      goal: 'Исследование качества процесса управления цифро-аналоговых следящих электроприводов с регуляторами положения, синтезированными аналитическим способом.',
      tasks: ['Синтезировать регуляторы положения для систем с астатизмом второго и первого порядка аналитическим способом.', 'Выполнить дискретную аппроксимацию регуляторов положения и получить их векторно-матричные модели.', 'Составить ССДМ цифро-аналоговых следящих электроприводов с цифровыми регуляторами положения и скорости.', 'Получить и проанализировать переходные характеристики и ошибки при отработке управляющих и возмущающих воздействий.', 'Записать рабочие программы цифровых регуляторов положения в среде CoDeSys.'] }
  };

  function titlePage(doc, T, tabs, P) {
    const c = { align: 'center', indent: 0, spacing: { line: 240 } };
    if (T.logo) doc.image(LOGO, 'jpeg', 1.0, 0.93, { spacing: { before: 0, after: 60, line: 240 }, keepNext: false });
    String(T.org || '').split('\n').forEach(l => doc.p(l, c));
    if (T.dept) String(T.dept).split('\n').forEach((l, k) => doc.p(l, Object.assign({}, c, k === 0 ? { spacing: { before: 240, line: 240 } } : {})));
    doc.p([{ t: 'ОТЧЁТ', b: true, size: 40 }], { align: 'center', indent: 0, spacing: { before: 1900, after: 120, line: 240 } });
    if (tabs.length === 1) {
      const no = tabs[0].slice(2);
      doc.p('по ' + (T.kind || 'лабораторной работе') + ' № ' + no, c);
      doc.p('«' + META[tabs[0]].title + '»', Object.assign({}, c, { spacing: { before: 60, line: 240 } }), { b: true });
    } else {
      doc.p('по ' + (T.kindPlural || 'лабораторным работам') + ' № ' + tabs.map(t => t.slice(2)).join(', '), c);
    }
    doc.p('по дисциплине', Object.assign({}, c, { spacing: { before: 120, line: 240 } }));
    doc.p('«' + (T.discipline || '') + '»', c);
    const r = { align: 'right', indent: 0, spacing: { line: 240 } };
    doc.p('Выполнил:', Object.assign({}, r, { spacing: { before: 1600, line: 240 } }));
    if (T.group) doc.p('ст. гр. ' + T.group, r);
    doc.p(T.student || '______________', r);
    doc.p('Проверил:', Object.assign({}, r, { spacing: { before: 360, line: 240 } }));
    doc.p(T.teacher || '______________', r);
    doc.p((T.city || 'Казань') + ' ' + (T.year || new Date().getFullYear()), { align: 'center', indent: 0, spacing: { before: 1700, line: 240 } });
  }

  function inputList(doc, P, ctx) {
    const items = [
      ['J_{н}', P.Jn, 'кг·м²', 'момент инерции нагрузки'], ['M_{c0}', P.Mc, 'Н·м', 'момент сопротивления нагрузки'],
      ['\\Omega_{max}', P.W, 'град/с', 'максимальная угловая скорость нагрузки'], ['\\varepsilon_{max}', P.E, 'град/с²', 'максимальное угловое ускорение нагрузки'],
      ['M', P.M, '', 'показатель колебательности'], ['\\eta', P.eta, '', 'КПД редуктора'],
      ['\\Delta\\alpha_\\Omega', P.dAW, 'угл. мин', 'ошибка по скорости'], ['\\Delta\\alpha_\\varepsilon', P.dAE, 'угл. мин', 'ошибка по ускорению'],
      ['\\alpha_{max}', P.alphaMax, 'град', 'максимальный угол поворота исполнительного вала']
    ];
    for (const [sym, v, u, d] of items) {
      const om = ctx.omml(sym + '=' + ctx.L.n(+v) + (u ? '\\ \\text{' + u + '}' : ''), true);
      doc.raw(`<w:p>${doc.pPr({ indent: 709 })}${om}${doc.runs(' — ' + d + (sym === '\\alpha_{max}' ? '.' : ';'))}</w:p>`);
    }
  }

  function addItems(doc, items, no, ctx, opt, cnt) {
    for (const it0 of items) {
      if (it0.web) continue;
      let it = it0;
      if (it0.rep !== undefined) it = Object.assign({}, it0, it0.k === 'note' ? { k: 'p', t: it0.rep } : { t: it0.rep });
      switch (it.k) {
        case 'h': doc.p(it.t.replace(/^(\d+(?:\.\d+)*)\.\s+/, '$1 ').replace(/\.$/, ''), { style: 'Heading2' }); break;
        case 'p': it.t.split(/<br\s*\/?>/).forEach(part => { const x = part.replace(/^\s*•\s*/, ''); if (x.trim()) doc.html(x, /:\s*$/.test(x) ? { keepNext: true } : undefined); }); break;
        case 'note': break;   // примечания утилиты в отчёт не попадают (кроме заданных через .rep — они уже стали абзацами)
        case 'tex': {
          const d = opt.explain && root.EXPLAIN ? EXPLAIN.texDesc(it.t) : '';
          if (d) doc.html(symHtml(d.replace(/\.$/, ':')), { keepNext: true });
          emitMath(doc, it.t, ctx, opt.eqNum ? String(opt._eq = (opt._eq || 0) + 1) : null); break;
        }
        case 'eq': {
          let s = it.lhs;
          if (it.formula) s += '=' + it.formula;
          if (it.subst) s += '=' + it.subst;
          s += '=' + ctx.L.n(it.val, it.sig) + (it.unit ? '\\ \\text{' + it.unit + '}' : '');
          let d = opt.explain && root.EXPLAIN ? EXPLAIN.eqDesc(it.lhs) : '';
          if (it.lhs === 'R_2' && /U_\{вых\}/.test(it.formula || '')) d = 'Сопротивление R2 стабилизатора, задающее выходное напряжение ±15 В для питания операционных усилителей.';
          if (d) doc.html(symHtml(d.replace(/\.$/, ':')), { keepNext: true });
          emitMath(doc, s, ctx, opt.eqNum ? String(opt._eq = (opt._eq || 0) + 1) : null); break;
        }
        case 'check':
          doc.raw(`<w:p>${doc.pPr({ indent: 709 })}${doc.runs('Проверка: ')}${ctx.omml(it.tex, true)}${doc.runs(' — ' + lc(it.t || (it.ok ? 'выполняется' : 'не выполняется')).replace(/\.?$/, '.'))}</w:p>`); break;
        case 'table': {
          const plain = c => String(c === undefined || c === null ? '' : c);
          const cellH = c => ctx.isTexCell(c) ? null : plain(c);
          if (it.head[0] === 'Параметр' && it.head[1] === 'Обозначение') break;   // исходные данные уже приведены списком
          const lead = it.caption ? it.caption.replace(/\.$/, '') + ':' : 'Получены следующие значения:';
          const lines = [];
          if (it.head[0] === 'Двигатель') {
            it.rows.forEach(r => lines.push(`${r[0]}: <i>i</i><sub>о</sub> = ${r[1]}, Ω<sub>ном</sub> &gt; <i>i</i><sub>о</sub>Ω<sub>max</sub> — ${r[2]}, <i>M</i><sub>вр</sub>/<i>M</i><sub>ном</sub> = ${r[3]}, <i>M</i><sub>c0</sub>/(<i>i</i>η) и <i>M</i><sub>ном</sub>: ${r[4]} Н·м — ${String(r[5]).replace(/[✓✗]\s*/, '').replace('✗', 'не проходит') || 'не проходит'}`));
          } else if (it.rows.length === 1) {
            it.head.forEach((h, k) => {
              const hh = plain(h), v = plain(it.rows[0][k]).replace(/(\d)\.(\d)/g, '$1,$2'), mu = hh.match(/^(.*?),\s*([^,]+)$/);
              if (mu && /·10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$/.test(mu[1])) { const pw = mu[1].match(/·10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$/)[0]; lines.push(`${mu[1].replace(pw, '')} = ${v}${pw} ${mu[2]}`); }
              else lines.push(mu ? `${lc(mu[1])} = ${v} ${mu[2]}` : `${lc(hh)} — ${v}`);
            });
          } else if (it.head.length === 2 && it.head[1] === 'Значение') {
            it.rows.forEach(r => lines.push(`${plain(r[0])} = ${plain(r[1])}`));
          } else if (it.head[1] === 'Значение') {
            it.rows.forEach(r => lines.push(`${lc(plain(r[0]))} — ${plain(r[1])}` + (plain(r[2]) ? ` (${lc(plain(it.head[2]))}: ${plain(r[2])})` : '')));
          } else {
            it.rows.forEach(r => {
              const first = plain(r[0]);
              const rest = r.slice(1).map((v, k) => [it.head[k + 1], v]).filter(x => plain(x[1]).trim() !== '' && plain(x[1]) !== '—');
              if (rest.length === 1) lines.push(`${lc(first)} — ${plain(rest[0][1])}`);
              else lines.push(`${lc(first)}: ` + rest.map(x => `${lc(plain(x[0]))} — ${plain(x[1])}`).join(', '));
            });
          }
          doc.p(lead, { keepNext: true });
          listOut(doc, lines);
          break;
        }
        case 'code':
          codeOut(doc, 'Листинг ' + no + '.' + (++cnt.lst) + ' — ' + (it.title || ''), it.t);
          doc.p('', {});
          break;
        case 'plot': case 'diagram': {
          const img = ctx.png[it.id];
          if (!img) break;
          const n = no + '.' + (cnt.fig + 1);
          const ld = LEAD[it.id] || (it.k === 'diagram' ? 'Структурная схема динамической модели представлена на рисунке {n}.' : 'Результат представлен на рисунке {n}.');
          doc.html(symHtml(ld.replace('{n}', n).replace('{Uz}', ctx.L.fnum(ctx.S.P.Uz))), { keepNext: true });
          const w = 16, h = Math.min(w * img.h / img.w, 12);
          doc.image(img.data, 'png', h === 12 ? 12 * img.w / img.h : w, h);
          doc.p('Рисунок ' + n + ' — ' + it.title.replace(/\s*\(рис\. [\d.]+\)/g, '').replace(/\.$/, ''), { style: 'Caption' });
          doc.p('', { indent: 0 });   // пустая строка после подписи рисунка
          cnt.fig++;
          break;
        }
        case 'simres': {
          const lines = ctx.simLines ? simLines(it.id, ctx) : null;
          if (!lines || !lines.length) break;
          doc.p('По результатам моделирования' + (/ν = \d/.test(it.title) ? ' (' + it.title.match(/ν = \d/)[0] + ')' : '') + ' получено:', { keepNext: true });
          listOut(doc, lines);
          break;
        }
      }
    }
  }

  function lc(t) { t = String(t); return /^[А-ЯЁ][а-яё]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  /* перечисление по ГОСТ 2.105: дефис, строчная буква, «;» и «.» в конце */
  let READ = false;   // «улучшение читаемости»: блоки не разрываются между страницами
  /* какие строки блока из n строк держать со следующей: короткий блок — целиком,
     длинный — не меньше head строк в начале страницы и tail строк в конце блока */
  function keepIdx(k, n, max, head, tail) {
    if (k >= n - 1) return false;
    if (!READ) return false;
    if (n <= max) return true;
    return k < head - 1 || k >= n - tail - 1;
  }
  function listOut(doc, lines) {
    lines.forEach((l, k) => { l = String(l).replace(/[;.]\s*$/, ''); if (!/</.test(l)) l = symHtml(l); doc.html('– ' + l + (k === lines.length - 1 ? '.' : ';'), keepIdx(k, lines.length, 10, 3, 3) ? { keepNext: true } : undefined); });
  }
  function codeOut(doc, caption, src) {
    const ls = src.split('\n'); while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
    doc.p(caption, { style: 'TableCaption' });
    ls.forEach((l, k) => doc.p(l.replace(/\t/g, '    ') || ' ', Object.assign({ style: 'Code' }, keepIdx(k, ls.length, 50, 6, 6) ? { keepNext: true } : {})));
  }
  const LEAD = {
    d_lr2: 'Структурная схема динамической модели нескорректированного контура скорости, по которой составлена модель в среде MatLab Simulink, представлена на рисунке {n}.',
    lr2_w: 'Зависимость угловой скорости от времени, полученная моделированием (наброс момента сопротивления при t = 1 с), представлена на рисунке {n}.',
    lr2_e: 'Изменение сигнала рассогласования (значения выводятся блоком Display) показано на рисунке {n}.',
    d_lr3: 'ССДМ контура скорости с аналоговым ПИД-регулятором, реализованная в среде MatLab Simulink, представлена на рисунке {n}.',
    lr3_bode: 'Логарифмические частотные характеристики разомкнутого контура скорости представлены на рисунке {n}.',
    lr3_step: 'Для получения переходной характеристики по управляющему воздействию в блоке Step задаём Uкс = {Uz} В, в блоке Step1 — Mc = 0. Полученный график представлен на рисунке {n}.',
    lr3_dist: 'Для построения переходной характеристики по моменту сопротивления задаём Uкс = 0 и Mc = −Mc0. Полученная зависимость представлена на рисунке {n}.',
    lr4_reg: 'Реакция цифрового регулятора скорости на единичный скачок показана на рисунке {n}.',
    lr4_bode: 'Логарифмические псевдочастотные характеристики разомкнутого контура скорости представлены на рисунке {n}.',
    lr4_nyq: 'Амплитудно-фазовая псевдочастотная характеристика приведена на рисунке {n}.',
    d_lr4: 'ССДМ контура скорости с цифровым регулятором скорости в среде MatLab Simulink представлена на рисунке {n}.',
    lr4_step: 'Зависимость угловой скорости от времени по сигналу задания (Uкс = {Uz} В, Mc = 0) в сравнении с аналоговым регулятором представлена на рисунке {n}.',
    lr4_dist: 'Зависимость угловой скорости от времени по моменту сопротивления (Uкс = 0, Mc = −Mc0) представлена на рисунке {n}.',
    lr5_zh: 'Запретная область и желаемые ЛАЧХ систем с астатизмом второго и первого порядка построены на рисунке {n}.',
    lr5_bode_pid: 'ЛАЧХ регулятора положения, полученная по программе, и её аппроксимация асимптотами представлены на рисунке {n}.',
    lr5_bode_id: 'ЛАЧХ регулятора положения и её аппроксимация пятью асимптотами представлены на рисунке {n}.',
    d_lr5_pid: 'С учётом рассчитанных параметров составлена ССДМ электропривода с ПИД-регулятором положения, представленная на рисунке {n}.',
    d_lr5_id: 'ССДМ электропривода с интегро-дифференцирующим регулятором положения представлена на рисунке {n}.',
    d_lr6_pid: 'ССДМ цифро-аналогового следящего электропривода с цифровыми регуляторами положения и скорости представлена на рисунке {n}.',
    d_lr6_id: 'ССДМ цифро-аналогового следящего электропривода для системы с астатизмом первого порядка представлена на рисунке {n}.'
  };
  for (const t of ['lr5', 'lr6']) {
    LEAD[t + '_step_pid'] = LEAD[t + '_step_id'] = 'Переходная характеристика системы по задающему воздействию αз = 1 рад представлена на рисунке {n}.';
    LEAD[t + '_err_pid'] = 'График ошибки системы при квадратично возрастающем задающем воздействии εmax·t²/2 представлен на рисунке {n}.';
    LEAD[t + '_err_id'] = 'График ошибки системы при линейно возрастающем задающем воздействии Ωmax·t представлен на рисунке {n}.';
    LEAD[t + '_mc_pid'] = 'График моментной составляющей ошибки при квадратично возрастающем моменте сопротивления представлен на рисунке {n}.';
    LEAD[t + '_mc_id'] = 'График моментной составляющей ошибки при линейно возрастающем моменте сопротивления представлен на рисунке {n}.';
  }
  /* ---------- перенос длинных формул (ГОСТ 2.105: перенос на знаке «=» с его повторением) ---------- */
  const LIMIT = 560;   // px при 14 пт ≈ ширина строки 16,5 см с запасом на шрифт Cambria Math
  function splitTop(t, ch) {
    const out = []; let depth = 0, cur = '';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '{') depth++; else if (c === '}') depth--;
      if (c === ch && depth === 0 && t[i - 1] !== '\\') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out;
  }
  // часть вида \dfrac{P}{Q} целиком -> {num, den}
  function wholeFrac(t) {
    t = t.trim();
    if (!t.startsWith('\\dfrac{')) return null;
    let i = 6, depth = 0, a = -1, b = -1;
    for (; i < t.length; i++) { if (t[i] === '{') { depth++; if (depth === 1 && a < 0) a = i; } else if (t[i] === '}') { depth--; if (depth === 0) { b = i; break; } } }
    const num = t.slice(a + 1, b);
    if (t[b + 1] !== '{') return null;
    let j = b + 1, c = -1; depth = 0;
    for (; j < t.length; j++) { if (t[j] === '{') depth++; else if (t[j] === '}') { depth--; if (depth === 0) { c = j; break; } } }
    const den = t.slice(b + 2, c), rest = t.slice(c + 1).trim();
    if (rest) return null;
    return { num, den };
  }
  function fitMath(tex, ctx) {
    const W = x => ctx.measure(x);
    if (W(tex) <= LIMIT) return [{ t: tex }];
    const parts = splitTop(tex, '=');
    const lines = [], extra = [];
    let cur = parts[0];
    for (let k = 1; k < parts.length; k++) {
      let p = parts[k];
      const fr = wholeFrac(p);
      if (fr && W('=' + p) > LIMIT) {
        const v = /z/.test(fr.num + fr.den) && !/s/.test(fr.num + fr.den) ? 'z' : 's';
        p = '\\dfrac{B(' + v + ')}{A(' + v + ')}';
        extra.push('B(' + v + ')=' + fr.num, 'A(' + v + ')=' + fr.den);
      }
      const cand = cur + '=' + p;
      if (W(cand) <= LIMIT || cur === parts[0] && k === 1 && W(cand) <= LIMIT) cur = cand;
      else { lines.push(cur); cur = '=' + p; }
    }
    lines.push(cur);
    const out = lines.map(t => ({ t, size: W(t) > LIMIT ? Math.max(18, Math.floor(28 * LIMIT / W(t))) : 28 }));
    if (extra.length) {
      out.push({ where: true });
      extra.forEach(t => out.push({ t, size: 28, poly: true }));
    }
    return out;
  }
  /* num — сквозной номер формулы у правого края последней строки основной формулы; null — без номера */
  function emitMath(doc, tex, ctx, num) {
    const lines = fitMath(tex, ctx);
    const wi = lines.findIndex(l => l.where), lastMain = (wi < 0 ? lines.length : wi) - 1;
    lines.forEach((l, k) => {
      if (l.where) { doc.p('где', { indent: 0, keepNext: true }); return; }
      const om = ctx.omml(l.t, false, l.size || 28), keep = k < lines.length - 1;
      if (num && k === lastMain) doc.mathNum(om, num, keep); else doc.math(om, keep ? { keepNext: true } : {});
    });
  }
  /* результаты моделирования связным текстом-перечислением */
  function simLines(id, ctx) {
    const S = ctx.S, R = S.R, P = S.P, f = ctx.L.fnum, am = x => x * (P.deg57 ? 57 : 180 / Math.PI) * 60;
    const key = { sr_lr2: 'lr2', sr_lr3: 'lr3', sr_lr4: 'lr4', sr_lr5_pid: 'lr5pid', sr_lr5_id: 'lr5id', sr_lr6_pid: 'lr6pid', sr_lr6_id: 'lr6id' }[id];
    const r = S.sims[key]; if (!r) return null;
    if (key === 'lr2') return [
      `установившаяся скорость без нагрузки Ω<sub>уст</sub> = ${f(r.Wbefore)} рад/с, после наброса момента сопротивления — ${f(r.Wafter)} рад/с`,
      `ошибка по задающему воздействию (блок Display до наброса момента) Δ<i>u</i><sup>u</sup><sub>уст</sub> = ${f(r.eBefore)} В, расчётное значение — ${f(R.lr2.du_u)} В`,
      `моментная составляющая ошибки Δ<i>u</i><sup>Mc</sup><sub>уст</sub> = ${f(r.eAfter - r.eBefore)} В, расчётное значение — ${f(R.lr2.du_M)} В`,
      `суммарная установившаяся ошибка Δ<i>u</i><sub>уст</sub> = ${f(r.eAfter)} В`,
      `перерегулирование σ = ${f(r.info.sigma, 3)} %, время переходного процесса ${f(r.info.ts, 3)} с, число колебаний <i>N</i> = ${r.info.N}`];
    if (key === 'lr3' || key === 'lr4') {
      const a = key === 'lr4' ? S.sims.lr3 : null;
      const L = [
        `максимальное значение угловой скорости Ω<sub>max</sub> = ${f(r.info.ymax)} рад/с, установившееся Ω<sub>уст</sub> = ${f(r.info.yfinal)} рад/с`,
        `перерегулирование σ = (Ω<sub>max</sub> − Ω<sub>уст</sub>)/Ω<sub>уст</sub>·100 % = ${f(r.info.sigma, 3)} % (при настройке на оптимум по модулю — 4,3 %)` + (a ? `; для аналогового регулятора — ${f(a.info.sigma, 3)} %` : ''),
        `время нарастания <i>t</i><sub>н</sub> = ${f(r.info.tr, 3)} с при расчётном 4,7<i>T</i><sub>Σ</sub> = ${f(4.7 * R.lr3.TS, 3)} с`,
        `время переходного процесса ${f(r.info.ts, 3)} с`,
        `при набросе момента сопротивления максимальное отклонение скорости ΔΩ = ${f(r.pk, 3)} рад/с; примерно через ${f(r.trec, 2)} с моментная составляющая ошибки становится практически равной нулю`];
      return L;
    }
    const kind = key.slice(3), spec = kind === 'pid' ? P.dAE : P.dAW, e = Math.abs(am(r.errEnd));
    return [
      `перерегулирование σ = ${f(r.info.sigma, 3)} %, время регулирования ${f(r.info.ts, 3)} с, число колебаний <i>N</i> = ${r.info.N}`,
      `установившаяся ошибка при ${kind === 'pid' ? 'квадратично возрастающем задании ε<sub>max</sub><i>t</i>²/2' : 'линейно возрастающем задании Ω<sub>max</sub><i>t</i>'} Δα = ${f(Math.abs(r.errEnd), 4)} рад = ${f(e, 3)}′, что ${e <= spec ? 'не превышает' : 'превышает'} допустимого значения ${spec}′`,
      `моментная составляющая ошибки Δα<sup>м</sup> = ${f(Math.abs(r.mcEnd), 3)} рад = ${f(Math.abs(am(r.mcEnd)), 3)}′`];
  }
  /* обозначения величин в тексте: латинская буква курсивом, индекс прямым (ГОСТ 2.105) */
  const SYMS = ['Pтр', 'Tм', 'Tэ', 'Tтп', 'Tф', 'TΣ', 'Tрс1', 'Tрс2', 'Tрс3', 'Kтп', 'Kос', 'Kрс', 'Kвт', 'Lз', 'tн', 'T0', 'θз'];
  function symHtml(t) {
    let s = t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    s = s.replace(/(^|[^A-Za-zА-Яа-яЁё0-9])([A-Za-zθσηεΩαγτ])((?:[а-яё]{1,4}(?:\.[а-яё]{1,3})*\.?|Σ)\d?)(?=[^а-яёА-ЯЁA-Za-z]|$)/g, (m0, a, l, ix) => a + (/[θσηεΩαγτ]/.test(l) ? l : '<i>' + l + '</i>') + '<sub>' + ix + '</sub>');
    if (false) for (const y of SYMS) s = s.split(y).join('<i>' + y[0] + '</i><sub>' + y.slice(1) + '</sub>');
    s = s.replace(/(^|[\s(])(c|i|N) = /g, '$1<i>$2</i> = ').replace(/Δu = /g, 'Δ<i>u</i> = ');
    return s.replace(/<i>θ<\/i>/g, 'θ');
  }
  /* ---------- выводы ---------- */
  function conclusions(tab, R, S, f) {
    const o = R.lr1, P = R.P, am = x => x * (P.deg57 ? 57 : 180 / Math.PI) * 60;
    switch (tab) {
      case 'lr1': return [
        `По требуемой мощности Pтр = ${f(o.Ptr / 1000)} кВт выбран двигатель ${o.mo.type} (${f(o.mo.P)} кВт, ${o.mo.U} В, ${o.mo.n} об/мин); передаточное число редуктора i = ${f(o.i)}. Проверки по скорости и моменту ${o.me.ok ? 'выполняются' : 'не выполняются'}.`,
        `Параметры двигателя: c = ${f(o.c)} В·с/рад, Tм = ${f(o.Tm)} с, Tэ = ${f(o.Te)} с. Так как ${o.caseA ? 'Tм ≥ 4Tэ, передаточная функция двигателя — апериодическое звено второго порядка' : 'Tм < 4Tэ, передаточная функция двигателя имеет комплексно-сопряжённые корни (колебательное звено)'}.`,
        `${o.choke ? 'Для ограничения прерывистых токов выбран дроссель ' + o.choke.name + (o.nCh > 1 ? ' (' + o.nCh + ' шт.)' : '') : 'Индуктивности якоря достаточно, дополнительные дроссели не требуются'}; тиристоры ${o.thy.name}. ТП: Kтп = ${f(o.Ktp)}, Tтп = ${f(o.Ttp)} с.`,
        `Датчик скорости — тахогенератор ${o.tg.name}: Kос = ${f(o.Kos)} В·с/рад, Tф = ${f(o.Tf)} с. Датчик положения — СКВТ ${o.vt.name}, Kвт = ${f(o.Kvt)} В/рад.`];
      case 'lr2': { const r = S.lr2; return [
        `Расчётные установившиеся ошибки нескорректированного контура скорости: по заданию Δu = ${f(R.lr2.du_u)} В, по моменту сопротивления Δu = ${f(R.lr2.du_M)} В, суммарная ${f(R.lr2.du_u + R.lr2.du_M)} В.` + (r ? ` Моделирование дало ${f(r.eBefore)} В и ${f(r.eAfter)} В, что подтверждает правильность расчётов.` : ''),
        r ? `Переходный процесс ${r.info.sigma > 1 ? 'колебательный' : 'апериодический'}: перерегулирование ${f(r.info.sigma, 3)} %, время переходного процесса ${f(r.info.ts, 3)} с, число колебаний N = ${r.info.N}. Велика статическая ошибка и момент нагрузки снижает скорость, поэтому контур необходимо оптимизировать применением ПИД-регулятора.` : ''].filter(Boolean); }
      case 'lr3': { const r = S.lr3, l3 = R.lr3; return [
        `Синтезирован ПИД-регулятор скорости: Kрс = ${f(l3.Krc)}, Tрс1 = ${f(l3.Trc1)} с, Tрс2 = ${f(l3.Trc2)} с, Tрс3 = ${f(l3.Trc3)} с; суммарная малая постоянная TΣ = ${f(l3.TS)} с.`,
        `Запасы устойчивости разомкнутого контура: по фазе θз = ${f(l3.mg3.Pm, 3)}°, по амплитуде Lз = ${f(l3.mg3.Gm, 3)} дБ, что соответствует настройке на оптимум по модулю.`,
        r ? `По результатам моделирования перерегулирование σ = ${f(r.info.sigma, 3)} % (при ОМ 4,3 %; отличие обусловлено постоянной времени фильтра Tф), время нарастания tн = ${f(r.info.tr, 3)} с (4,7TΣ = ${f(4.7 * l3.TS, 3)} с). Моментная составляющая ошибки затухает до нуля благодаря интегральной составляющей регулятора — механическая характеристика стала абсолютно жёсткой.` : ''].filter(Boolean); }
      case 'lr4': { const r = S.lr4, a = S.lr3; return [
        `Методом трапеций получена передаточная функция цифрового регулятора скорости при T0 = ${f(P.T0)} с и его векторно-матричная модель, по которой составлена рабочая программа для ПЛК154 в среде CoDeSys.`,
        `По логарифмическим псевдочастотным характеристикам запас по фазе θз = ${f(R.lr4.mg4.Pm, 3)}°, запас по амплитуде Lз = ${f(R.lr4.mg4.Gm, 3)} дБ — цифро-аналоговый контур устойчив.`,
        r ? `Перерегулирование цифрового контура σ = ${f(r.info.sigma, 3)} %${a ? ' (аналогового — ' + f(a.info.sigma, 3) + ' %)' : ''}, время нарастания ${f(r.info.tr, 3)} с. Цифровой регулятор обеспечивает качество, близкое к настройке на оптимум по модулю; моментная ошибка устраняется интегральной составляющей.` : ''].filter(Boolean); }
      case 'lr5': case 'lr6': {
        const out = [];
        const dig = tab === 'lr6';
        for (const kind of ['pid', 'id']) {
          const r = S[tab + kind]; if (!r) continue;
          const spec = kind === 'pid' ? P.dAE : P.dAW, e = Math.abs(am(r.errEnd));
          out.push(`${kind === 'pid' ? 'Система с астатизмом второго порядка (' + (dig ? 'цифровой ' : '') + 'ПИД-регулятор положения)' : 'Система с астатизмом первого порядка (' + (dig ? 'цифровой ' : '') + 'интегро-дифференцирующий регулятор)'} отрабатывает ступенчатое воздействие с перерегулированием σ = ${f(r.info.sigma, 3)} % за ${f(r.info.ts, 3)} с (число колебаний N = ${r.info.N}). Установившаяся ошибка при ${kind === 'pid' ? 'квадратично' : 'линейно'} возрастающем задании составляет ${f(e, 3)}′ при допустимой ${spec}′ — требование ${e <= spec ? 'выполняется' : 'не выполняется'}. Моментная составляющая ошибки ${f(Math.abs(am(r.mcEnd)), 3)}′.`);
        }
        out.push(dig ? 'Цифровые регуляторы положения, синтезированные аналитическим способом, обеспечивают заданные точностные характеристики при периоде квантования T0 = ' + f(P.T0) + ' с.' : 'Синтезированные графоаналитическим методом регуляторы положения обеспечивают заданные показатели точности; ПИД-регулятор устраняет статическую и скоростную ошибки, интегро-дифференцирующий регулятор устраняет статическую ошибку.');
        return out;
      }
    }
    return [];
  }

  async function build(ctx, tabs, T, opt) {
    READ = opt.readable !== false;
    const doc = new DOCX.Doc({ readable: READ, italVars: true, codePlain: !!opt.codePlain, line: opt.line1 ? 240 : 360 });
    const P = ctx.S.P, R = ctx.S.R;
    titlePage(doc, T, tabs, P);
    tabs.forEach((tab, k) => {
      const no = tab.slice(2), m = META[tab];
      if (tabs.length > 1) { doc.p('Лабораторная работа № ' + no, { style: 'Heading1', pageBreakBefore: true }); doc.p(m.title, { align: 'center', indent: 0, spacing: { after: 240 } }, { b: true }); }
      doc.p('Цель работы', { style: 'Heading2', pageBreakBefore: tabs.length === 1 });
      doc.p(m.goal);
      doc.p('Задачи работы', { style: 'Heading2' });
      m.tasks.forEach((t, i) => doc.p((i + 1) + ') ' + t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, i === m.tasks.length - 1 ? '.' : ';')));
      doc.p('Ход работы', { style: 'Heading2' });
      if (k === 0 || tabs.length === 1) {
        doc.p('Согласно варианту № ' + P.variant + ' системы исходных данных (табл. П.8) приняты следующие значения:', { keepNext: true });
        inputList(doc, P, ctx);
      }
      const cnt = { fig: 0, tab: 0, lst: 0, eq: 0 };
      addItems(doc, R['L' + no].items, no, ctx, opt, cnt);
      if (opt.listings) {
        doc.p('Программы MATLAB', { style: 'Heading2' });
        for (const f of ctx.labFiles(tab).filter(x => x.lang === 'matlab')) {
          codeOut(doc, 'Листинг ' + no + '.' + (++cnt.lst) + ' — ' + f.path.split('/')[1], f.gen());
          doc.p('', {});
        }
      }
      doc.p('Вывод', { style: 'Heading2' });
      conclusions(tab, R, ctx.S.sims, ctx.L.fnum).forEach(t => doc.html(symHtml(t)));
    });
    return doc.build({ title: 'Отчёт, вариант ' + P.variant, author: T.student || '' });
  }
  root.REPORT = { build, META };
})(typeof window !== 'undefined' ? window : globalThis);
