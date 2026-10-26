/* ==========================================================================
   Прототип анимации экранов 01–02 — «Оживший редакционный коллаж»
   и переход «Сквозь взгляд».

   Без библиотек: один обработчик прокрутки с requestAnimationFrame,
   IntersectionObserver для появлений. Пишем только transform, opacity,
   filter и CSS-переменные маски — вёрстка не пересчитывается.

   Параметры адреса (для проверки):
     ?lite      — облегчённый режим        ?full    — полный режим
     ?static    — статичная версия         ?nointro — без интро
     ?y=1200    — сразу прокрутить к позиции (для скриншотов)
     ?t=900     — остановить интро на 900-й миллисекунде (для скриншотов)
   ========================================================================== */
(function () {
  var doc = document.documentElement;
  var params = new URLSearchParams(location.search);
  var badge = document.querySelector('.proto-badge');

  function setBadge() {
    if (!badge) return;
    var mode = doc.classList.contains('motion-static') ? 'статичная версия' :
               doc.classList.contains('motion-lite') ? 'облегчённый режим' : 'полный режим';
    badge.textContent = 'Прототип анимации · ' + mode;
  }

  /* Пользователь включил «уменьшить движение» на ходу — перезагружаемся
     в статичную версию (и обратно). */
  if (window.matchMedia) {
    var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    var onReduce = function () { location.reload(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce);
    else if (mqReduce.addListener) mqReduce.addListener(onReduce);
  }

  if (!doc.classList.contains('motion-on')) { setBadge(); return; }
  doc.classList.add('motion-ready');
  setBadge();

  /* ---- Элементы ---------------------------------------------------------- */
  function $(s) { return document.querySelector(s); }
  var cine     = $('.cine');
  var hero     = $('.hero');
  var stage    = $('.hero-stage');
  var cam      = $('.cam');
  var fg       = $('.fg');
  var lift     = $('.lift');
  var liftShadow = $('.f-lift-struct-shadow');
  var eyeHd    = $('.f-eye-hd');
  var vignette = $('.cine-vignette');
  var next     = $('.cine-next');
  var nextStage = $('.cine-next-stage');
  var nextPlate = $('.cine-next-plate');
  var rim      = $('.cine-rim');
  var problem  = $('.problem');
  var pStage   = $('.problem-stage');
  var pPlate   = $('.problem-plate');
  var pFinal   = $('.p2-final');
  var mVisual  = $('.m-hero-visual');
  var mImg     = mVisual && mVisual.querySelector('img');
  var mCollage = $('.m-collage-02');
  var mZoom    = mCollage && mCollage.querySelector('.m-zoom');
  if (!cine || !hero || !stage || !cam || !fg || !problem) return;

  var mqMobile = matchMedia('(max-width: 700px)');

  /* Точки в координатах подложки 1536x1024 */
  var PUPIL  = { x: 780, y: 825, r: 11 };       // зрачок на экране 01
  var STRUCT = { x: 995, y: 878 };              // центр «структура вместо шума»
  var WATCH  = { x: 1004, y: 352 };             // глаз на карточке «наблюдение», экран 02
  /* Плотность фрагмента fragments/hero-eye-hd.webp: 1040 px на 260 px
     подложки — 4 пикселя картинки на пиксель подложки. */
  var EYE_HD_DENSITY = 4;
  var HERO_PAPER = hero.getAttribute('data-paper');
  var NEXT_PAPER = problem.getAttribute('data-paper');

  /* ---- Математика -------------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) {
    var t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  /* Мягкий разгон и мягкая остановка — как у операторской тележки */
  function easeInOutSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1)); }
  function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }

  /* ---- Текстуры перехода: рваный край бумаги и зерно ---------------------
     Рисуются один раз на canvas из чистого кода — без файлов и сервисов.
     Случайность с фиксированным зерном: разрыв всегда одинаковый. */
  var TEX_N = 1024;              // сторона картинки маски и края
  var TEX_R = TEX_N * 0.34;      // номинальный радиус разрыва в ней
  var tex = null;

  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function makeTextures() {
    if (tex) return tex;
    tex = { minK: 0.8 };
    var rnd = rng(20261018);
    var N = TEX_N, C = N / 2, R = TEX_R, i;

    /* Контур разрыва: низкие гармоники дают неровную форму, высокие —
       зубцы, шум на каждой вершине — волокна. */
    var harm = [[2, 0.045], [3, 0.05], [5, 0.035], [8, 0.024], [13, 0.016], [23, 0.01], [41, 0.006], [73, 0.004]];
    harm.forEach(function (h) { h.push(rnd() * Math.PI * 2); });
    var STEPS = 960, hole = [], band = [], minK = 2;
    for (i = 0; i < STEPS; i++) {
      var a = i / STEPS * Math.PI * 2, k = 1;
      harm.forEach(function (h) { k += h[1] * Math.sin(h[0] * a + h[2]); });
      k += (rnd() - 0.5) * 0.012;
      minK = Math.min(minK, k);
      hole.push([C + Math.cos(a) * R * k, C + Math.sin(a) * R * k]);
      /* Светлая полоса оторванного края: ширина неровная */
      var w = R * (0.016 + 0.034 * Math.pow(Math.abs(Math.sin(a * 3.7 + harm[2][2]) * Math.sin(a * 11 + harm[4][2])), 0.8) + rnd() * 0.008);
      band.push([C + Math.cos(a) * (R * k + w), C + Math.sin(a) * (R * k + w)]);
    }
    tex.minK = minK;

    function path(ctx, pts) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
    }
    function canvas(n) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }

    /* 1. Маска: внутри разрыва непрозрачно, край чуть смягчён */
    var cm = canvas(N), m = cm.getContext('2d');
    m.filter = 'blur(1.2px)';
    m.fillStyle = '#000';
    m.beginPath(); path(m, hole); m.fill();

    /* 2. Край: тень слоя внутрь разрыва + светлая сердцевина бумаги
          с волокнами + тонкая тёмная кромка лицевой стороны */
    var cr = canvas(N), r = cr.getContext('2d');
    r.save();
    r.beginPath(); path(r, hole); r.clip();
    r.shadowColor = 'rgba(28, 14, 10, 0.62)';
    r.shadowBlur = 56;
    r.shadowOffsetY = 10;
    r.fillStyle = '#000';
    r.beginPath(); r.rect(-N, -N, N * 3, N * 3); path(r, hole); r.fill('evenodd');
    r.restore();

    r.fillStyle = 'rgba(238, 230, 218, 0.94)';
    r.beginPath(); path(r, band); path(r, hole); r.fill('evenodd');

    for (i = 0; i < 2600; i++) {
      var j = Math.floor(rnd() * STEPS);
      var p0 = rnd() < 0.7 ? band[j] : hole[j];
      var ang = j / STEPS * Math.PI * 2 + (rnd() - 0.5) * 1.1;
      var len = R * (0.004 + rnd() * rnd() * 0.03) * (rnd() < 0.7 ? 1 : -0.6);
      r.strokeStyle = 'rgba(246, 240, 231,' + (0.35 + rnd() * 0.5).toFixed(2) + ')';
      r.lineWidth = 0.5 + rnd() * 1.1;
      r.beginPath();
      r.moveTo(p0[0], p0[1]);
      r.lineTo(p0[0] + Math.cos(ang) * len, p0[1] + Math.sin(ang) * len);
      r.stroke();
    }
    r.filter = 'blur(1.5px)';
    r.strokeStyle = 'rgba(70, 45, 35, 0.22)';
    r.lineWidth = 2.5;
    r.beginPath(); path(r, band); r.stroke();

    /* 3. Зерно бумаги экрана 02 (видно, пока коллаж не проявился) */
    var G = 240, cg = canvas(G), gc = cg.getContext('2d');
    var img = gc.createImageData(G, G), d = img.data;
    for (i = 0; i < d.length; i += 4) {
      var v = rnd();
      var dark = v < 0.5;
      d[i]     = dark ? 92 : 252;
      d[i + 1] = dark ? 70 : 248;
      d[i + 2] = dark ? 58 : 240;
      d[i + 3] = Math.round((dark ? 0.5 - v : v - 0.5) * 2 * 26);
    }
    gc.putImageData(img, 0, 0);
    for (i = 0; i < 90; i++) {      // редкие волокна
      gc.strokeStyle = 'rgba(120, 95, 80,' + (0.05 + rnd() * 0.08).toFixed(3) + ')';
      gc.lineWidth = 0.6;
      gc.beginPath();
      var fx = rnd() * G, fy = rnd() * G, fa = rnd() * Math.PI;
      gc.moveTo(fx, fy);
      gc.quadraticCurveTo(fx + 6 * Math.cos(fa + 1), fy + 6 * Math.sin(fa + 1), fx + 14 * Math.cos(fa), fy + 14 * Math.sin(fa));
      gc.stroke();
    }

    hero.style.setProperty('--hole-mask', 'url(' + cm.toDataURL('image/png') + ')');
    hero.style.setProperty('--hole-rim', 'url(' + cr.toDataURL('image/png') + ')');
    if (nextStage) nextStage.style.setProperty('--grain', 'url(' + cg.toDataURL('image/png') + ')');
    return tex;
  }

  /* ---- Геометрия --------------------------------------------------------- */
  var g = {};

  function isLite() { return doc.classList.contains('motion-lite'); }

  function measure() {
    g.mobile = mqMobile.matches;
    g.V = window.innerHeight;
    g.lite = isLite();

    if (!g.mobile) {
      g.Sw = stage.offsetWidth;
      g.Sh = stage.offsetHeight;
      g.k = g.Sw / 1536;
      g.ky = g.Sh / 1024;
      g.heroW = hero.offsetWidth;
      g.stageLeft = stage.offsetLeft;
      /* Окно выше сцены (например, 1920x1080) — первый экран вытягивается
         до высоты окна, чтобы переход закрывал весь кадр. */
      hero.style.minHeight = g.V > g.Sh ? g.V + 'px' : '';
      g.Hh = hero.offsetHeight;
      /* Сцена выше окна — закрепляем её нижним краем по низу окна,
         чтобы глаз (нижняя треть сцены) был в кадре. */
      g.pinTop = Math.min(0, g.V - g.Hh);
      g.pinStart = Math.max(0, g.Hh - g.V);
      /* Длина перехода в пикселях прокрутки: длинная — чтобы камера
         шла плавно и без рывков при обычной прокрутке колесом. */
      g.Z = Math.round(g.V * (g.lite ? 1.25 : 2.0));
      g.yEnd = g.pinStart + g.Z;

      hero.style.top = g.pinTop + 'px';
      /* Закрепление длится ровно Z. Экран 02 поднят на V, поэтому
         в конце закрепления его верх стоит ровно у верха окна —
         там же, где слой .cine-next. Именно height, не padding:
         sticky-элемент движется только внутри области содержимого. */
      cine.style.height = (g.Hh + g.Z) + 'px';
      problem.style.marginTop = (-g.V) + 'px';

      /* Предел наезда — по качеству изображения, а не «сколько влезет»:
         не больше ~1.15 экранного пикселя на пиксель фрагмента глаза
         (с учётом плотности экрана), но не меньше, чем нужно, чтобы
         глаз занял кадр. */
      var dpr = window.devicePixelRatio || 1;
      g.Smax = clamp(EYE_HD_DENSITY * 1.15 / (g.k * dpr), 3.2, 4.8);
      /* Экран 02: отъезд от глаза «наблюдения». Подложка экрана 02 — без
         запаса разрешения, поэтому старт не крупнее 1.7 и в расфокусе. */
      g.S2 = 1.7;

      g.Px = PUPIL.x * g.k;
      g.Py = PUPIL.y * g.ky;
      cam.style.transformOrigin = g.Px + 'px ' + g.Py + 'px';
      fg.style.transformOrigin = g.Px + 'px ' + g.Py + 'px';
      if (lift) lift.style.transformOrigin = (STRUCT.x * g.k) + 'px ' + (STRUCT.y * g.ky) + 'px';

      /* Разворот экрана 02 внутри перехода — там, где в конце окажется
         настоящая .problem-stage (верх окна, по центру). */
      if (nextStage) {
        nextStage.style.left = g.stageLeft + 'px';
        nextStage.style.top = (-g.pinTop) + 'px';
        nextStage.style.width = g.Sw + 'px';
        nextStage.style.height = g.Sh + 'px';
        g.Ox = WATCH.x * g.k;
        g.Oy = WATCH.y * g.ky;
        nextStage.style.transformOrigin = g.Ox + 'px ' + g.Oy + 'px';
      }
      if (pPlate) pPlate.loading = 'eager';
      g.state = null;
    } else {
      hero.style.top = '';
      hero.style.minHeight = '';
      cine.style.height = '';
      problem.style.marginTop = '';
      resetDesktop();
      if (mImg) {
        /* Где глаз внутри кадра: img с object-fit: cover и
           object-position: 62% 50% (как в основном style.css). */
        var w = mImg.clientWidth, h = mImg.clientHeight;
        var k = Math.max(w / 1536, h / 1024);
        var ex = (w - 1536 * k) * 0.62 + PUPIL.x * k;
        var ey = (h - 1024 * k) * 0.5 + PUPIL.y * k;
        mImg.style.transformOrigin = ex + 'px ' + ey + 'px';
      }
    }
    g.last = null;
  }

  function resetDesktop() {
    [cam, fg, lift, nextStage].forEach(function (el) { if (el) el.style.transform = ''; });
    cam.style.willChange = '';
    fg.style.willChange = '';
    fg.style.opacity = '';
    stage.style.filter = '';
    if (vignette) vignette.style.opacity = '0';
    if (next) { next.style.visibility = ''; next.classList.remove('is-open'); }
    if (rim) rim.style.visibility = '';
    if (nextPlate) { nextPlate.style.opacity = ''; nextPlate.style.filter = ''; }
    if (eyeHd) eyeHd.style.opacity = '';
    if (liftShadow) liftShadow.style.opacity = '';
    hero.setAttribute('data-paper', HERO_PAPER);
    hero.style.visibility = '';
    problem.classList.remove('is-waiting');
    setRevealed(true);
  }

  /* ---- Экран 02: живой текст -------------------------------------------- */
  var unrevealTimer = 0;
  function setRevealed(on) {
    clearTimeout(unrevealTimer);
    if (on) {
      if (pStage) pStage.classList.add('is-revealed');
      return;
    }
    /* Назад: экран 02 сначала гаснет (переход в CSS), затем текст
       сбрасывается — при следующем проходе он снова встанет на место. */
    unrevealTimer = setTimeout(function () {
      if (pStage) pStage.classList.remove('is-revealed');
      if (pFinal) pFinal.classList.remove('is-revealed');
    }, 260);
  }

  /* ---- Кадр: компьютер --------------------------------------------------- */
  function desktopFrame() {
    var y = -cine.getBoundingClientRect().top;
    var p = clamp((y - g.pinStart) / g.Z, 0, 1);
    var done = y >= g.yEnd - 0.5;

    /* Экран 02 на месте: показываем его вместо слоя перехода и даём
       тексту занять позиции. Финальная фраза — когда видна. */
    if (done !== g.state) {
      g.state = done;
      problem.classList.toggle('is-waiting', !done);
      /* Экран 01 целиком закрыт экраном 02; на окнах выше сцены его
         низ иначе выглядывал бы между экранами 02 и 03. */
      hero.style.visibility = done ? 'hidden' : '';
      setRevealed(done);
    }
    if (done && pFinal && !pFinal.classList.contains('is-revealed') &&
        pFinal.getBoundingClientRect().top < g.V * 0.9) {
      pFinal.classList.add('is-revealed');
    }

    var key = p.toFixed(4);
    if (key === g.last) return;
    g.last = key;

    var wc = p > 0 && p < 1 ? 'transform' : '';
    if (cam.style.willChange !== wc) { cam.style.willChange = wc; fg.style.willChange = wc; }

    /* Фазы (p — доля закрепления):
         0.00–0.60  камера подходит к глазу: плавный разгон и остановка;
         0.34–1.00  камера продолжает медленно идти вперёд — «сквозь» бумагу;
         0.40–0.84  из зрачка рвётся бумажный слой экрана 01;
         0.40–0.96  в разрыве — разворот 02: сначала бумага, затем коллаж
                    проявляется и встаёт в фокус, камера отъезжает от глаза
                    «наблюдения»;
         1.00       настоящий экран 02 занимает место слоя, текст встаёт. */
    var e = easeInOutSine(p / 0.6);
    var push = Math.exp(Math.log(1.16) * smooth(0.34, 1, p));
    var s = Math.pow(g.Smax, e) * push;
    var sx = g.stageLeft + g.Px;             // зрачок в координатах .hero
    var sy = g.Py;
    var dx = (g.heroW / 2 - sx) * e;
    var dy = (-g.pinTop + g.V / 2 - sy) * e;
    cam.style.transform = p > 0 ?
      'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')' : '';

    /* Передний план (живой текст) ближе к камере: растёт быстрее
       и уходит из кадра, пока коллаж ещё читается. */
    var fo = 1 - smooth(0.02, 0.24, p);
    fg.style.opacity = fo < 1 ? fo.toFixed(3) : '';
    fg.style.transform = p > 0 ?
      'translate3d(' + (dx * 1.25).toFixed(1) + 'px,' + (dy * 1.25).toFixed(1) + 'px,0) scale(' + Math.pow(s, 1.3).toFixed(4) + ')' : '';

    /* Бумажка «структура вместо шума» отрывается от стола (масштаб
       только вверх — оригинал под ней всегда закрыт). */
    var lk = smooth(0, 0.4, p);
    if (lift) lift.style.transform = lk > 0 ? 'scale(' + (1 + 0.07 * lk).toFixed(4) + ')' : '';
    if (liftShadow && !g.introRunning) liftShadow.style.opacity = lk > 0 ? (0.95 * lk).toFixed(3) : '';

    if (eyeHd) eyeHd.style.opacity = clamp((s - 1.25) / 0.6, 0, 1).toFixed(3);

    /* Глубина резкости и виньетка — только в полном режиме: бумага
       экрана 01 подходит к самому объективу и уходит в расфокус. */
    if (!g.lite) {
      var b = 3.5 * smooth(0.36, 0.8, p);
      stage.style.filter = b > 0.05 ? 'blur(' + b.toFixed(2) + 'px)' : '';
      if (vignette) vignette.style.opacity = (0.8 * smooth(0.08, 0.5, p)).toFixed(3);
    }

    /* Шапка: js/main.js берёт цвет из data-paper секции под ней.
       Когда кадр в основном стал разворотом 02 — подставляем его цвет. */
    var paper = p > 0.72 ? NEXT_PAPER : HERO_PAPER;
    if (hero.getAttribute('data-paper') !== paper) hero.setAttribute('data-paper', paper);

    /* Разрыв из зрачка */
    var ix = sx + dx, iy = sy + dy;
    if (vignette) {
      vignette.style.setProperty('--ix', ix.toFixed(1) + 'px');
      vignette.style.setProperty('--iy', iy.toFixed(1) + 'px');
    }
    var th = (p - 0.4) / (0.84 - 0.4);
    var open = th > 0;
    if (next) next.style.visibility = open ? 'visible' : '';
    if (rim) rim.style.visibility = open && th < 1 ? 'visible' : '';
    if (!open) return;
    var t = makeTextures();

    var r0 = PUPIL.r * g.k * s * 0.85;                // ровно по краю зрачка
    var far = Math.max(Math.hypot(ix, iy - (-g.pinTop)), Math.hypot(g.heroW - ix, iy - (-g.pinTop)),
                       Math.hypot(ix, -g.pinTop + g.V - iy), Math.hypot(g.heroW - ix, -g.pinTop + g.V - iy));
    var r1 = far / t.minK * 1.06;                      // разрыв закрыл кадр
    /* Рост в логарифмической шкале: равномерная часть не даёт движению
       провиснуть, пока камера тормозит у глаза. */
    var hr = r0 * Math.pow(r1 / r0, 0.55 * clamp(th, 0, 1) + 0.45 * easeInOutSine(th));
    var hd = hr * TEX_N / TEX_R;
    next.classList.toggle('is-open', th >= 1);
    [next, rim].forEach(function (el) {
      el.style.setProperty('--hd', hd.toFixed(1) + 'px');
      el.style.setProperty('--hx', (ix - hd / 2).toFixed(1) + 'px');
      el.style.setProperty('--hy', (iy - hd / 2).toFixed(1) + 'px');
    });

    /* Разворот 02 в разрыве: глаз «наблюдения» стоит там, где был
       зрачок, камера отъезжает и разворот встаёт на своё место. */
    var v = easeInOutSine((p - 0.4) / (0.96 - 0.4));
    var s2 = Math.pow(g.S2, 1 - v);
    var ox = g.stageLeft + g.Ox, oy = -g.pinTop + g.Oy;
    var tx = (ix - ox) * (1 - v), ty = (iy - oy) * (1 - v);
    nextStage.style.transform = v < 1 ?
      'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) scale(' + s2.toFixed(4) + ')' : '';
    /* Сначала только бумага, затем проявляется коллаж (и наводится
       резкость) */
    var po = smooth(0.42, 0.8, p);
    nextPlate.style.opacity = po < 1 ? po.toFixed(3) : '1';
    if (!g.lite) {
      var b2 = 8 * (1 - smooth(0.44, 0.92, p));
      nextPlate.style.filter = b2 > 0.05 ? 'blur(' + b2.toFixed(2) + 'px)' : '';
    }
  }

  /* ---- Кадр: телефон ----------------------------------------------------- */
  function mobileFrame() {
    var V = g.V, key = '';
    var mv = 0, cq = 1;
    if (mImg) {
      var r = mVisual.getBoundingClientRect();
      mv = clamp((V * 0.3 - r.top) / (r.height * 0.85), 0, 1);
    }
    if (mZoom) {
      var rc = mCollage.getBoundingClientRect();
      cq = clamp((V - rc.top) / (V * 0.6), 0, 1);
    }
    key = mv.toFixed(4) + '|' + cq.toFixed(4);
    if (key === g.last) return;
    g.last = key;

    /* Короткий наезд на глаз внутри кадра коллажа */
    if (mImg) {
      var s = 1 + (g.lite ? 0.9 : 1.5) * Math.pow(mv, 1.6);
      mImg.style.transform = mv > 0 ? 'scale(' + s.toFixed(4) + ')' : '';
    }
    /* …и ответный отъезд от глаза на карточке «наблюдение» */
    if (mZoom) {
      var s2 = 1 + (g.lite ? 0.45 : 0.8) * (1 - easeOut3(cq));
      mZoom.style.transform = cq < 1 ? 'scale(' + s2.toFixed(4) + ')' : '';
    }
  }

  /* ---- Цикл -------------------------------------------------------------- */
  var ticking = false;
  function frame() {
    ticking = false;
    if (g.mobile) mobileFrame(); else desktopFrame();
  }
  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () { measure(); schedule(); });
  if (mImg && !mImg.complete) mImg.addEventListener('load', function () { measure(); schedule(); });

  /* ---- Появление текста экрана 02 на телефоне ---------------------------- */
  function revealOnce(nodes, margin) {
    nodes = Array.prototype.filter.call(nodes, Boolean);
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-revealed');
        io.unobserve(en.target);
      });
    }, { rootMargin: margin });
    nodes.forEach(function (n) { io.observe(n); });
  }
  /* Текст экрана 02 на компьютере ведёт desktopFrame. */
  revealOnce(document.querySelectorAll('.m-problem > *'), '0px 0px -12% 0px');

  /* ---- Экраны 03–08: элементы раскладываются по столу (компьютер) --------
     (03, 04 — цепочки этапов; 05 — плашка и услуги; 06 — карточки кейсов;
     07 — «до / после»; 08 — карточки вокруг руки с маркером)
     Отдельный обработчик прокрутки: переход 01 → 02 он не трогает.
     Состояния (классы на сцене — см. motion.css):
       idle → загрузка слоёв (.is-near) → ждём, пока экран окажется целиком
       ниже окна → .is-armed (стол без цепочки, текст спрятан) →
       верх экрана в кадре: .is-text → цепочка в кадре: .is-play →
       всё легло: классы сняты, видна сама подложка.
     Повтор — только если экран снова ушёл целиком вниз (прокрутили
     назад выше него). Слои грузятся сразу после загрузки страницы; если
     они всё же не готовы, а экран давно в кадре, он остаётся статичным,
     как в оригинале. */
  var chainParam = params.has('ct') ? +params.get('ct') || 0 : null;

  /* playAt — доля высоты сцены, на которой низ раскладываемых карточек:
     цепочка запускается, когда он в кадре. */
  function chainScreen(stage, playAt) {
    var chain = stage && stage.querySelector('.chain');
    if (!chain) return null;
    var plateImg = stage.querySelector('img');
    var st = { stage: stage, state: 'idle' };

    function cls(armed, text, play) {
      stage.classList.toggle('is-armed', armed);
      stage.classList.toggle('is-text', text);
      stage.classList.toggle('is-play', play);
    }

    st.load = function () {
      if (st.state !== 'idle') return;
      st.state = 'loading';
      stage.classList.add('is-near');
      if (plateImg) plateImg.loading = 'eager';
      /* Все слои сцены: цепочка и (на экране 06) бумага карточек */
      var waits = Array.prototype.map.call(stage.querySelectorAll('.frag'), function (el) {
        var m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage);
        if (!m) return Promise.reject();
        var im = new Image();
        im.src = m[1];
        return im.decode ? im.decode() : new Promise(function (res, rej) { im.onload = res; im.onerror = rej; });
      });
      if (plateImg) waits.push(plateImg.decode ? plateImg.decode() : Promise.resolve());
      Promise.all(waits).then(function () {
        st.state = 'loaded';
        /* Слои пришли сразу после открытия страницы (например, после
           перезагрузки посреди страницы или по ссылке ?y=) — стол можно
           подготовить, даже если экран уже в кадре: страница только что
           появилась, подмены никто не заметит. */
        st.early = (window.performance ? performance.now() : 0) < 4000;
        scheduleChains();
      }, function () { st.state = 'failed'; });
    };

    function finish() {
      var anims = stage.getAnimations ? stage.getAnimations({ subtree: true }) : [];
      var all = anims.length ? Promise.all(anims.map(function (a) { return a.finished; })) :
        new Promise(function (res) { setTimeout(res, 6000); });
      var token = st.token = {};
      all.then(function () {
        if (st.token !== token || st.state !== 'play') return;
        st.state = 'done';
        cls(false, false, false);
      }, function () {});
    }

    st.frame = function (V) {
      if (st.state === 'idle' || st.state === 'loading' || st.state === 'failed') return;
      var r = stage.getBoundingClientRect();
      var below = r.top > V;
      if (below || (st.state === 'loaded' && (st.early || chainParam !== null))) {
        /* Экран целиком ниже окна (или страница только открылась,
           или режим проверки) — готовим стол */
        if (st.state !== 'armed') { st.state = 'armed'; st.text = false; st.token = null; cls(true, false, false); }
        if (below) return;
      }
      if (st.state !== 'armed' && st.state !== 'text') return;
      /* Текст — когда верх экрана хорошо в кадре; цепочка — когда карточки
         почти целиком в кадре (их низ — 81% высоты сцены): раньше запуск
         шёл по середине карточек, и на ноутбуке они ложились наполовину
         за нижним краем окна. */
      if (!st.text && r.top < V * 0.72) {
        st.text = true;
        stage.classList.add('is-text');
        st.state = 'text';
      }
      if (st.text && (r.top + r.height * playAt < V || r.top < 0)) {
        st.state = 'play';
        stage.classList.add('is-play');
        if (chainParam !== null && stage.getAnimations) {
          /* Режим проверки: остановить анимацию на заданной миллисекунде */
          requestAnimationFrame(function () {
            stage.getAnimations({ subtree: true }).forEach(function (a) { a.pause(); a.currentTime = chainParam; });
          });
          return;
        }
        finish();
      }
    };
    return st;
  }

  var chains = [chainScreen($('.system-stage'), 0.78), chainScreen($('.process-stage'), 0.78),
                chainScreen($('.services-stage'), 0.82), chainScreen($('.cases-stage'), 0.8),
                chainScreen($('.system-effect-stage'), 0.8), chainScreen($('.what-i-do-stage'), 0.8)].filter(Boolean);
  var chainTick = false;
  function chainFrame() {
    chainTick = false;
    if (mqMobile.matches) return;
    var V = window.innerHeight;
    chains.forEach(function (c) { c.frame(V); });
  }
  function scheduleChains() {
    if (chainTick) return;
    chainTick = true;
    requestAnimationFrame(chainFrame);
  }
  if (chains.length) {
    if ('IntersectionObserver' in window) {
      /* Слои грузим заранее — за полтора экрана до подхода */
      var nearIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting || mqMobile.matches) return;
          chains.forEach(function (c) { if (c.stage === en.target) c.load(); });
        });
      }, { rootMargin: '150% 0px 150% 0px' });
      chains.forEach(function (c) { nearIo.observe(c.stage); });
    } else {
      chains.forEach(function (c) { c.load(); });
    }
    /* …и в любом случае сразу после загрузки страницы: иначе при быстрой
       прокрутке, переходе по ссылке меню или открытии страницы посреди
       экран оказывался в кадре раньше, чем слои готовы, и оставался
       статичным. Слои — локальные файлы, ~330 КБ на экран. */
    window.addEventListener('load', function () {
      if (mqMobile.matches) return;
      chains.forEach(function (c) { c.load(); });
    });
    window.addEventListener('scroll', scheduleChains, { passive: true });
    window.addEventListener('resize', scheduleChains);
  }

  /* ---- Экраны 03 и 04 на телефоне ----------------------------------------
     Пункты цепочки проявляются по мере прокрутки; если в кадр вошло
     сразу несколько, они встают по очереди с небольшой задержкой. */
  function revealSeq(nodes, margin, step) {
    nodes = Array.prototype.filter.call(nodes, Boolean);
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-revealed'); });
      return;
    }
    var queue = [], timer = 0;
    function pump() {
      timer = 0;
      var n = queue.shift();
      if (!n) return;
      n.classList.add('is-revealed');
      if (queue.length) timer = setTimeout(pump, step);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        queue.push(en.target);
      });
      queue.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      if (!timer) pump();
    }, { rootMargin: margin });
    nodes.forEach(function (n) { io.observe(n); });
  }
  revealOnce(document.querySelectorAll('.m-system > :not(.m-chain), .m-process > :not(.m-chain)'), '0px 0px -12% 0px');
  revealSeq(document.querySelectorAll('.m-chain-item, .m-step-item'), '0px 0px -10% 0px', 140);

  /* ---- Экраны 05 и 06 на телефоне: плашка и тексты — при прокрутке,
     услуги и карточки кейсов — по очереди. */
  revealOnce(document.querySelectorAll('.m-services > :not(.m-chain), .m-cases > :not(.m-card)'), '0px 0px -12% 0px');
  revealSeq(document.querySelectorAll('.m-svc-item'), '0px 0px -10% 0px', 140);
  revealSeq(document.querySelectorAll('.m-cases > .m-card'), '0px 0px -8% 0px', 220);

  /* ---- Экраны 07 и 08 на телефоне. Контактный блок не трогаем. */
  revealOnce(document.querySelectorAll('.m-effect > :not(.m-vs), .m-effect > .m-vs > :not(.m-vs-list), .m-whatido > :not(.m-do)'), '0px 0px -12% 0px');
  revealSeq(document.querySelectorAll('.m-vs-do .m-vs-list li'), '0px 0px -8% 0px', 110);
  revealSeq(document.querySelectorAll('.m-vs-posle .m-vs-list li'), '0px 0px -8% 0px', 160);
  revealSeq(document.querySelectorAll('.m-do-item'), '0px 0px -10% 0px', 140);

  /* ---- Интро ------------------------------------------------------------- */
  function startIntro() {
    if (!doc.classList.contains('intro-pending') || doc.classList.contains('intro-play')) return;
    /* Если страницу открыли уже прокрученной — интро не нужно. */
    if (window.scrollY > window.innerHeight * 0.5) {
      doc.classList.remove('intro-pending');
      return;
    }
    g.introRunning = true;
    doc.classList.add('intro-play');
    if (params.has('t') && document.getAnimations) {
      /* Режим проверки: остановить интро на заданной миллисекунде. */
      var t = +params.get('t') || 0;
      document.getAnimations().forEach(function (a) { a.pause(); a.currentTime = t; });
      return;
    }
    setTimeout(function () { g.introRunning = false; g.last = null; schedule(); }, 3400);
    watchFps();
  }

  /* Если кадры идут заметно медленнее 30 в секунду — переключаемся
     в облегчённый режим (без размытия, короче переход). */
  function watchFps() {
    if (params.has('full') || isLite()) return;
    var times = [], prev = 0;
    function tick(t) {
      if (prev) times.push(t - prev);
      prev = t;
      if (times.length < 50) { requestAnimationFrame(tick); return; }
      times.sort(function (a, b) { return a - b; });
      if (times[25] > 34) {
        doc.classList.add('motion-lite');
        setBadge();
        measure();
        resetDesktop();
        schedule();
      }
    }
    requestAnimationFrame(tick);
  }

  var plate = $('.hero-plate');
  var ready = [];
  var visiblePlate = g.mobile ? mImg : plate;
  if (visiblePlate && visiblePlate.decode) ready.push(visiblePlate.decode().catch(function () {}));
  if (document.fonts && document.fonts.ready) ready.push(document.fonts.ready);
  Promise.race([
    Promise.all(ready),
    new Promise(function (res) { setTimeout(res, 1500); })
  ]).then(startIntro);

  /* ---- Старт ------------------------------------------------------------- */
  measure();

  /* Текстуры разрыва готовим заранее, в свободное время после загрузки,
     чтобы в момент перехода не было задержки. */
  if (!mqMobile.matches) {
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 600); };
    window.addEventListener('load', function () { idle(makeTextures, { timeout: 2000 }); });
  }

  if (params.has('y')) {
    /* Режим проверки: сразу к нужной позиции, всё грузим сразу. */
    document.querySelectorAll('img[loading="lazy"]').forEach(function (i) { i.loading = 'eager'; });
    document.querySelectorAll('.m-screen').forEach(function (s) { s.classList.add('is-near'); });
    window.scrollTo({ top: +params.get('y') || 0, behavior: 'instant' });
  }
  frame();
  window.addEventListener('load', function () { measure(); g.last = null; schedule(); });
})();
