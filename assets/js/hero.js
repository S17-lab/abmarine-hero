/* ══════════════════════════════════════════════════════════════
   AB MARINE — первый экран
   Судно приходит кадром в разрезе (assets/ship/hero-vessel.webp).
   Вся интерактивная геометрия задана в координатах кадра 1995 × 825:
   меняется рендер — правятся только SPOTS / BUS, вёрстка не трогается.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.AB_HERO_PLATE = window.AB_HERO_PLATE || null;   // URL картинки (для Tilda)

  const PL = { w: 1995, h: 825 };   // система координат кадра
  const BUS = 528;                  // высота главной энергошины под палубой

  /* Узлы судна: точка на машине (x, y), якорь подписи (cx, cy — низ плашки). */
  const SPOTS = [
    {
      no: '01', x: 370, y: 624, cx: 358, cy: 430,
      t: 'Пропульсивные комплексы',
      full: 'Пропульсивные комплексы и редукторы',
      d: 'Гребные электродвигатели, валолинии и редукторы. Подбираем под обводы корпуса, ледовый класс и режимы хода.',
      tags: ['ГЭД', 'редукторы', 'валолиния']
    },
    {
      no: '02', x: 648, y: 610, cx: 668, cy: 430,
      t: 'Главные двигатели',
      full: 'Судовые главные двигатели',
      d: 'Главные и вспомогательные двигатели с обвязкой: подбор мощности, монтаж, пуско-наладка и сервис.',
      tags: ['мощность', 'обвязка', 'пуско-наладка']
    },
    {
      no: '03', x: 1110, y: 638, cx: 1098, cy: 348,
      t: 'Системы накопления энергии',
      full: 'Судовые системы накопления электроэнергии (СНЭ)',
      d: 'Аккумуляторные системы для пиковых нагрузок, тихого хода и резерва. Расчёт ёмкости под профиль рейса.',
      tags: ['СНЭ', 'пиковые нагрузки', 'резерв']
    },
    {
      no: '04', x: 1468, y: 650, cx: 1452, cy: 348,
      t: 'ГРЩ и электрооборудование',
      full: 'Судовое электротехническое оборудование',
      d: 'Главные распределительные щиты, преобразователи и системы управления энергетикой судна.',
      tags: ['ГРЩ', 'преобразователи', 'управление']
    }
  ];

  /* Трассы энергии: шина и отводы к машинам. */
  const ROUTES = [
    { id: 'bus',  d: 'M 330 ' + BUS + ' H 1530' },
    { id: 'prop', d: 'M 370 ' + BUS + ' V 614' },
    { id: 'main', d: 'M 648 ' + BUS + ' V 600' },
    { id: 'ess',  d: 'M 1110 ' + BUS + ' V 628' },
    { id: 'grd',  d: 'M 1468 ' + BUS + ' V 640' }
  ];
  const ROUTE_OF = ['prop', 'main', 'ess', 'grd'];

  const ns = 'http://www.w3.org/2000/svg';
  const $ = (s, r) => (r || document).querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ══════════════ инициализация ══════════════ */
  const root = document.getElementById('abmHero') || document.body;
  const hero = $('#abmHero-sec');
  if (!hero) return;
  const plate = $('#abmPlate');
  const img = $('#abmPlateImg');
  if (window.AB_HERO_PLATE) img.src = window.AB_HERO_PLATE;
  img.addEventListener('error', () => {
    hero.classList.add('is-noplate');
    console.warn('[AB Marine] Кадр судна не загружен: ' + img.getAttribute('src'));
  });

  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(ns, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* ══════════════ энергоконтур ══════════════ */
  const fx = $('#abmFx');
  const svg = el('svg', { viewBox: '0 0 ' + PL.w + ' ' + PL.h, preserveAspectRatio: 'none' }, fx);
  const flows = {};
  ROUTES.forEach(r => {
    el('path', { class: 'bus', d: r.d }, svg);
    flows[r.id] = el('path', { class: 'flow', d: r.d, style: '--flow-d:' + (r.id === 'bus' ? '0s' : '-1.2s') }, svg);
  });

  /* узлы + выноски к подписям — одна группа на направление,
     чтобы подсвечивать её целиком при наведении */
  const pinfx = SPOTS.map((s, i) => {
    const g = el('g', { class: 'pinfx' }, svg);
    el('path', { class: 'lead-line', d: 'M ' + s.cx + ' ' + (s.cy + 8) + ' L ' + s.x + ' ' + s.y }, g);
    el('circle', { class: 'node__ring', cx: s.x, cy: s.y, r: 9 }, g);
    el('circle', { class: 'node__core', cx: s.x, cy: s.y, r: 4.6 }, g);
    return g;
  });

  /* ══════════════ подписи узлов: живой HTML ══════════════ */
  const pinsHost = $('#abmPins');
  const pins = [], openers = [];
  let pinned = -1;
  const TARGETS = SPOTS.map(s => ({ x: s.x / PL.w, y: s.y / PL.h, t: s.t }));

  SPOTS.forEach((s, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'pin';
    wrap.style.setProperty('--cx', (s.cx / PL.w * 100).toFixed(3) + '%');
    wrap.style.setProperty('--cy', (s.cy / PL.h * 100).toFixed(3) + '%');
    wrap.innerHTML =
      `<button class="pin__btn" type="button" aria-expanded="false">
         <span class="pin__no">${s.no}</span>
         <span class="pin__t">${s.t}</span>
       </button>
       <div class="pin__card" role="note">
         <p class="pin__no-b">НАПРАВЛЕНИЕ ${s.no}</p>
         <p class="pin__h">${s.full}</p>
         <p class="pin__d">${s.d}</p>
         <ul class="pin__tags">${s.tags.map(t => `<li>${t}</li>`).join('')}</ul>
       </div>`;
    pinsHost.appendChild(wrap);
    pins.push(wrap);

    const b = wrap.querySelector('.pin__btn');
    const card = wrap.querySelector('.pin__card');
    const open = (v) => {
      if (v) pins.forEach((o, k) => {
        o.classList.remove('is-open');
        o.querySelector('.pin__btn').setAttribute('aria-expanded', 'false');
        pinfx[k].classList.remove('is-on');
        const f = flows[ROUTE_OF[k]]; if (f) f.classList.remove('flow--hot');
      });
      wrap.classList.toggle('is-open', v);
      b.setAttribute('aria-expanded', String(v));
      pinfx[i].classList.toggle('is-on', v);
      const f = flows[ROUTE_OF[i]];
      if (f) f.classList.toggle('flow--hot', v);
      if (v) fit(card);
    };
    if (!COARSE) {
      wrap.addEventListener('mouseenter', () => { if (pinned < 0) open(true); });
      wrap.addEventListener('mouseleave', () => { if (pinned < 0) open(false); });
    }
    b.addEventListener('click', e => { e.stopPropagation(); setPin(pinned === i ? -1 : i); });
    card.addEventListener('click', e => e.stopPropagation());
    b.addEventListener('focus', () => { if (pinned < 0) open(true); });
    b.addEventListener('keydown', e => { if (e.key === 'Escape') { setPin(-1); open(false); b.blur(); } });
    openers.push(open);
  });

  /* ─── ряд направлений: узкие экраны, где выноски не помещаются ─── */
  (function () {
    const cta = $('.cta');
    if (!cta) return;
    const row = document.createElement('div');
    row.className = 'chiprow';
    row.innerHTML = '<div class="chiprow__list" role="tablist" aria-label="Направления"></div>' +
                    '<div class="chiprow__card" id="abmChipCard" role="tabpanel"></div>';
    cta.parentNode.insertBefore(row, cta.nextSibling);
    const list = row.querySelector('.chiprow__list');
    const card = row.querySelector('.chiprow__card');
    const btns = SPOTS.map((s, i) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === 0));
      b.textContent = s.t;
      list.appendChild(b);
      return b;
    });
    const show = i => {
      const s = SPOTS[i];
      card.innerHTML = `<p class="pin__no-b">НАПРАВЛЕНИЕ ${s.no}</p>` +
                       `<p class="pin__h">${s.full}</p><p class="pin__d">${s.d}</p>`;
      btns.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    };
    btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
    show(0);
  })();

  /* карточка не должна уезжать за край окна */
  function fit(card) {
    card.style.setProperty('--dx', '0px');
    requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const pad = 14;
      let dx = 0;
      if (r.right > innerWidth - pad) dx = innerWidth - pad - r.right;
      if (r.left + dx < pad) dx = pad - r.left;
      card.style.setProperty('--dx', dx.toFixed(0) + 'px');
    });
  }
  addEventListener('resize', () => pins.forEach(w => {
    if (w.classList.contains('is-open')) fit(w.querySelector('.pin__card'));
  }));
  document.addEventListener('click', () => { setPin(-1); closeAll(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && pinned >= 0) { setPin(-1); closeAll(); } });
  function closeAll() {
    pins.forEach((w, k) => {
      w.classList.remove('is-open');
      w.querySelector('.pin__btn').setAttribute('aria-expanded', 'false');
      pinfx[k].classList.remove('is-on');
    });
    Object.values(flows).forEach(f => f.classList.remove('flow--hot'));
  }

  /* ══════════════ параллакс, линза, курсор ══════════════ */
  const cursor = $('#abmCursor');
  let tX = 0, tY = 0, cX = 0, cY = 0;
  let lensT = { x: .5, y: .72 }, lensC = { x: .5, y: .72 };
  let live = false, lensR = 0, lensRT = 0, scanning = false, locked = -1;
  const ptr = { x: -1, y: -1 };
  const lensTag = $('.lens__tag');

  function measure() {
    if (!scanning) lensRT = clamp(plate.offsetWidth * 0.042, 50, 92);
    if (!lensR) lensR = lensRT;
  }
  measure();
  addEventListener('resize', measure);

  if (!COARSE && !RM) {
    addEventListener('pointermove', e => {
      tX = (e.clientX / innerWidth - .5) * 22;
      tY = (e.clientY / innerHeight - .5) * 12;
      if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
      ptr.x = e.clientX; ptr.y = e.clientY;
      const r = plate.getBoundingClientRect();
      lensT.x = clamp((e.clientX - r.left) / r.width, -.3, 1.3);
      lensT.y = clamp((e.clientY - r.top) / r.height, -.3, 1.3);
    }, { passive: true });

    hero.addEventListener('pointerenter', () => hero.classList.add('is-cursor'));
    hero.addEventListener('pointerleave', () => hero.classList.remove('is-cursor'));
    plate.addEventListener('pointerenter', () => { live = true; plate.classList.add('is-live'); });
    plate.addEventListener('pointerleave', () => {
      live = false; plate.classList.remove('is-live');
      if (pinned < 0) setLock(-1);
    });
    hero.querySelectorAll('a,button').forEach(n => {
      n.addEventListener('pointerenter', () => cursor && cursor.classList.add('is-big'));
      n.addEventListener('pointerleave', () => cursor && cursor.classList.remove('is-big'));
    });
  }

  /* ─── захват цели: прицел притягивается к ближайшей машине ─── */
  function nearest() {
    if (locked >= 0) {                       // курсор ушёл читать карточку — захват держим
      const c = pins[locked].querySelector('.pin__card').getBoundingClientRect();
      if (ptr.x >= c.left - 10 && ptr.x <= c.right + 10 &&
          ptr.y >= c.top - 10 && ptr.y <= c.bottom + 10) return locked;
    }
    const pw = plate.offsetWidth, ph = plate.offsetHeight;
    const snap = pw * 0.075;
    let best = -1, bd = Infinity;
    TARGETS.forEach((s, i) => {
      const d = Math.hypot((s.x - lensT.x) * pw, (s.y - lensT.y) * ph);
      if (d < bd) { bd = d; best = i; }
    });
    if (bd > snap) return -1;
    lensT.x = lerp(lensT.x, TARGETS[best].x, .32);
    lensT.y = lerp(lensT.y, TARGETS[best].y, .32);
    return best;
  }
  /* ─── клик по подписи закрепляет карточку ─── */
  function setPin(i) {
    if (i === pinned) return;
    const prev = pinned;
    pinned = i;
    if (prev >= 0) pins[prev].classList.remove('is-pin');
    if (i >= 0) {
      openers[i](true);
      pins[i].classList.add('is-pin');
      locked = i;
      plate.classList.add('is-lock');
      lensT.x = TARGETS[i].x; lensT.y = TARGETS[i].y;
      if (lensTag) lensTag.textContent = TARGETS[i].t;
    } else if (prev >= 0) {
      openers[prev](false);
      locked = -1;
      plate.classList.remove('is-lock');
      if (lensTag) lensTag.textContent = 'наведите на узел';
    }
  }
  function setLock(i) {
    if (i === locked) return;
    if (locked >= 0 && openers[locked]) openers[locked](false);
    locked = i;
    plate.classList.toggle('is-lock', i >= 0);
    if (i >= 0 && openers[i]) openers[i](true);
    if (lensTag) lensTag.textContent = i >= 0 ? TARGETS[i].t : 'наведите на узел';
  }

  let t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    if (!RM) {
      cX = lerp(cX, tX, .07); cY = lerp(cY, tY, .07);
      plate.style.setProperty('--px', cX.toFixed(2) + 'px');
      plate.style.setProperty('--py', (cY + Math.sin(t * .5) * 2.4).toFixed(2) + 'px');

      if (pinned >= 0) {                            // карточка закреплена — прицел стоит на ней
        lensT.x = TARGETS[pinned].x; lensT.y = TARGETS[pinned].y;
      } else if (!live) {                           // курсор вне судна — прицел дрейфует
        lensT.x = .5 + Math.sin(t * .26) * .3;
        lensT.y = .72 + Math.cos(t * .19) * .09;
        setLock(-1);
      } else if (!scanning) {
        setLock(nearest());                         // захват ближайшей машины
      }
      lensC.x = lerp(lensC.x, lensT.x, .12);
      lensC.y = lerp(lensC.y, lensT.y, .12);
      lensR = lerp(lensR, lensRT, scanning ? .16 : .1);
      plate.style.setProperty('--lx', (lensC.x * 100).toFixed(2) + '%');
      plate.style.setProperty('--ly', (lensC.y * 100).toFixed(2) + '%');
      plate.style.setProperty('--lr', lensR.toFixed(1) + 'px');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* риски прицела */
  const ticks = $('#abmLensTicks');
  if (ticks) {
    for (let i = 0; i < 4; i++) {
      const a = i * 90 + 45;
      const r1 = 70, r2 = 86;
      const rad = a * Math.PI / 180;
      el('line', {
        x1: 100 + Math.cos(rad) * r1, y1: 100 + Math.sin(rad) * r1,
        x2: 100 + Math.cos(rad) * r2, y2: 100 + Math.sin(rad) * r2
      }, ticks);
    }
    el('path', { d: 'M 100 78 V 92 M 100 108 V 122 M 78 100 H 92 M 108 100 H 122' }, ticks);
  }

  /* ══════════════ реакция энергосистемы на CTA ══════════════ */
  let surgeT = 0;
  function surge() {
    plate.classList.add('is-surge');
    scanning = true;
    lensRT = plate.offsetWidth * 0.85;
    clearTimeout(surgeT);
    surgeT = setTimeout(() => {
      plate.classList.remove('is-surge');
      scanning = false;
      measure();
    }, 1600);
  }
  document.querySelectorAll('.js-cta').forEach(b => {
    b.addEventListener('pointerenter', () => plate.classList.add('is-charge'));
    b.addEventListener('pointerleave', () => plate.classList.remove('is-charge'));
    b.addEventListener('click', () => { if (!RM) surge(); });
  });

  /* ══════════════ шапка и мобильное меню ══════════════ */
  const hdr = $('#abmHdr');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('is-stuck', scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  const burger = $('#abmBurger');
  if (burger) {
    const mnav = document.createElement('nav');
    mnav.className = 'mnav';
    mnav.innerHTML =
      `<a href="#about">О компании</a><a href="#catalog">Каталог</a>
       <a href="#footer">Контакты</a><a href="#formblock">Оставить заявку</a>
       <div class="mnav__c"><a href="tel:+78126434211">8 812 643-42-11</a>
       <a href="mailto:info@abmspb.ru">info@abmspb.ru</a></div>`;
    root.appendChild(mnav);
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      mnav.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mnav.addEventListener('click', e => {
      if (e.target.tagName === 'A') {
        burger.setAttribute('aria-expanded', 'false');
        mnav.classList.remove('is-open'); document.body.style.overflow = '';
      }
    });
  }


  /* ══════════════ вода ══════════════
     Полоса моря под корпусом рисуется в WebGL: зыбь задаётся
     процедурно (две бегущие волны с перспективой к горизонту),
     поверх идёт симуляция волнового уравнения — ping-pong по двух
     half-float текстурам. Курсор оставляет расходящиеся круги,
     клик — всплеск. Нет WebGL или reduce-motion — слой не создаётся,
     остаётся CSS-градиент .hero__sea.                                */
  const SEA = {
    sim:   COARSE ? 192 : 320,   // сетка симуляции по длинной стороне
    steps: 2,                    // шагов за кадр = скорость волны
    damp:  0.9955,               // затухание
    dropR: 0.045,                // радиус капли от курсора
    dropS: 0.05,                 // сила капли
    spec:  2.2,                  // блик от интерактивной ряби
    swell: 1.0,                  // амплитуда фоновой зыби
    rain:  3200,                 // холостая капля раз в N мс (0 — выкл)
    dpr:   COARSE ? 1.25 : 1.75,
  };

  const SEA_VS = `attribute vec2 p;varying vec2 vUv;
    void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}`;

  /* шаг симуляции: h(t+1) = (сумма соседей)/2 − h(t−1), с затуханием */
  const SEA_SIM = `precision highp float;varying vec2 vUv;
    uniform sampler2D uPrev;uniform vec2 uTexel,uDrop,uAspect;
    uniform float uDropR,uDropS,uDamp;
    void main(){
      vec4 c=texture2D(uPrev,vUv);
      float sum=texture2D(uPrev,vUv+vec2(uTexel.x,0.0)).r
               +texture2D(uPrev,vUv-vec2(uTexel.x,0.0)).r
               +texture2D(uPrev,vUv+vec2(0.0,uTexel.y)).r
               +texture2D(uPrev,vUv-vec2(0.0,uTexel.y)).r;
      float h=(sum*0.5-c.g)*uDamp;
      if(uDrop.x>=0.0) h+=uDropS*smoothstep(uDropR,0.0,length((vUv-uDrop)*uAspect));
      gl_FragColor=vec4(h,c.r,0.0,1.0);
    }`;

  /* отрисовка: цвет воды + зыбь + блик от ряби. vUv.y = 0 внизу кадра */
  const SEA_DRAW = `precision highp float;varying vec2 vUv;
    uniform sampler2D uSim;uniform vec2 uTexel;
    uniform float uTime,uSpec,uSwell;
    void main(){
      float hx=texture2D(uSim,vUv+vec2(uTexel.x,0.0)).r-texture2D(uSim,vUv-vec2(uTexel.x,0.0)).r;
      float hy=texture2D(uSim,vUv+vec2(0.0,uTexel.y)).r-texture2D(uSim,vUv-vec2(0.0,uTexel.y)).r;

      float d=1.0-vUv.y;                      // 0 у горизонта, 1 у нижней кромки
      float persp=1.0/(d*0.9+0.085);          // полосы сгущаются к горизонту
      float wob=sin(vUv.x*5.0+uTime*0.4)*1.4; // лёгкая кривизна гребней
      float p=persp*9.0+hy*45.0;              // рябь поднимает и опускает полосы
      float w=sin(p+wob+uTime*1.1)*0.6
             +sin(p*0.55-vUv.x*3.0-uTime*0.7)*0.4;
      float band=smoothstep(0.0,0.35,d);

      vec3 near=vec3(0.24,0.37,0.52);         // вода у нижней кромки
      vec3 far =vec3(0.74,0.81,0.88);         // вода у горизонта
      vec3 col=mix(far,near,smoothstep(0.0,0.85,d));
      col+=w*uSwell*0.05*band;                // зыбь
      col+=pow(max(0.0,w),10.0)*0.22*band;    // блики на гребнях
      col+=uSpec*(hx+hy)*2.0;                 // интерактивная рябь
      gl_FragColor=vec4(col,1.0);
    }`;

  function initSea() {
    if (RM) return;
    const host = $('.hero__sea', root);
    if (!host) return;

    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const opts = { alpha: false, antialias: false, depth: false };
    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl) { canvas.remove(); return; }

    const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    let type, internal;
    if (gl2) {
      if (!gl.getExtension('EXT_color_buffer_float') &&
          !gl.getExtension('EXT_color_buffer_half_float')) { canvas.remove(); return; }
      type = gl.HALF_FLOAT; internal = gl.RGBA16F;
    } else {
      const ext = gl.getExtension('OES_texture_half_float');
      if (!ext) { canvas.remove(); return; }
      gl.getExtension('OES_texture_half_float_linear');
      type = ext.HALF_FLOAT_OES; internal = gl.RGBA;
    }

    const shader = (kind, src) => {
      const s = gl.createShader(kind);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const build = fs => {
      const v = shader(gl.VERTEX_SHADER, SEA_VS), f = shader(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      const p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f);
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    const pSim = build(SEA_SIM), pDraw = build(SEA_DRAW);
    if (!pSim || !pDraw) { canvas.remove(); return; }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    let SW = SEA.sim, SH = SEA.sim;
    const surface = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, SW, SH, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok ? { t, fb } : null;
    };
    let a = surface(), b = surface();
    if (!a || !b) { canvas.remove(); return; }

    const resizeSim = ratio => {
      const w = ratio >= 1 ? SEA.sim : Math.max(64, Math.round(SEA.sim * ratio));
      const h = ratio >= 1 ? Math.max(64, Math.round(SEA.sim / ratio)) : SEA.sim;
      if (w === SW && h === SH) return;
      SW = w; SH = h;
      [a, b].forEach(s => { gl.deleteTexture(s.t); gl.deleteFramebuffer(s.fb); });
      a = surface(); b = surface();
    };

    const uS = {
      prev:   gl.getUniformLocation(pSim, 'uPrev'),
      texel:  gl.getUniformLocation(pSim, 'uTexel'),
      drop:   gl.getUniformLocation(pSim, 'uDrop'),
      aspect: gl.getUniformLocation(pSim, 'uAspect'),
      r:      gl.getUniformLocation(pSim, 'uDropR'),
      s:      gl.getUniformLocation(pSim, 'uDropS'),
      damp:   gl.getUniformLocation(pSim, 'uDamp'),
    };
    const uD = {
      sim:   gl.getUniformLocation(pDraw, 'uSim'),
      texel: gl.getUniformLocation(pDraw, 'uTexel'),
      time:  gl.getUniformLocation(pDraw, 'uTime'),
      spec:  gl.getUniformLocation(pDraw, 'uSpec'),
      swell: gl.getUniformLocation(pDraw, 'uSwell'),
    };

    let cw = 1, ch = 1;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, SEA.dpr);
      const r = host.getBoundingClientRect();
      cw = Math.max(1, Math.round(r.width * dpr));
      ch = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      resizeSim(cw / ch);
    };
    resize();
    addEventListener('resize', resize, { passive: true });

    /* ─── капли: курсор, клик, холостые ─── */
    const queue = [];
    const push = (x, y, s, r) => {
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      queue.push([x, y, s, r]);
      if (queue.length > 4) queue.shift();
    };
    const at = e => {
      const r = host.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    };
    const sec = $('#abmHero-sec', root) || host.parentNode;
    let px = null, py = null;
    sec.addEventListener('pointermove', e => {
      const [x, y] = at(e);
      const v = px === null ? 0 : Math.hypot(x - px, y - py);
      px = x; py = y;
      push(x, y, SEA.dropS * Math.min(1, .3 + v * 14), SEA.dropR);
    }, { passive: true });
    sec.addEventListener('pointerdown', e => {
      const [x, y] = at(e);
      push(x, y, SEA.dropS * 3, SEA.dropR * 1.8);
    }, { passive: true });

    let vis = true;
    if (window.IntersectionObserver) {
      new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(host);
    }
    if (SEA.rain) {
      setInterval(() => {
        if (vis) push(Math.random(), Math.random() * .7, SEA.dropS * 1.5, SEA.dropR * .9);
      }, SEA.rain);
    }

    const step = drop => {
      gl.useProgram(pSim);
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
      gl.viewport(0, 0, SW, SH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, a.t);
      gl.uniform1i(uS.prev, 0);
      gl.uniform2f(uS.texel, 1 / SW, 1 / SH);
      gl.uniform2f(uS.aspect, SW >= SH ? SW / SH : 1, SH > SW ? SH / SW : 1);
      gl.uniform1f(uS.damp, SEA.damp);
      gl.uniform2f(uS.drop, drop ? drop[0] : -1, drop ? drop[1] : -1);
      gl.uniform1f(uS.s, drop ? drop[2] : 0);
      gl.uniform1f(uS.r, drop ? drop[3] : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const t = a; a = b; b = t;
    };

    const t0 = performance.now();
    const tick = () => {
      if (!vis) return;
      resize();

      const drop = queue.length ? queue.shift() : null;
      if (queue.length > 2) queue.length = 0;
      for (let i = 0; i < SEA.steps; i++) step(i === 0 ? drop : null);

      gl.useProgram(pDraw);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, a.t);
      gl.uniform1i(uD.sim, 0);
      gl.uniform2f(uD.texel, 1 / SW, 1 / SH);
      gl.uniform1f(uD.time, (performance.now() - t0) / 1000);
      gl.uniform1f(uD.spec, SEA.spec);
      gl.uniform1f(uD.swell, SEA.swell);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      host.classList.add('is-on');
    };

    const frame = () => { requestAnimationFrame(frame); tick(); };
    requestAnimationFrame(frame);
  }

  initSea();

})();
