/* Первый экран статичен — интерактивной логики пока нет. */

/* Карточка 01/02/03 «Кейсы»: раскрывающиеся кейсы (Психологическая практика,
   ASPEX, DE'LONGHI, …) под секцией. На странице одновременно может быть
   открыт только один кейс — перед открытием нового закрываются все прочие. */
(function () {
  var entries = [];

  document.querySelectorAll('[data-case-trigger]').forEach(function (trigger) {
    var panel = document.getElementById('case-' + trigger.getAttribute('data-case-trigger'));
    if (!panel) return;
    entries.push({
      trigger: trigger,
      panel: panel,
      closeBtn: panel.querySelector('[data-case-close]')
    });
  });

  function openCase(entry) {
    entry.panel.classList.add('is-open');
    entry.trigger.setAttribute('aria-expanded', 'true');
    window.setTimeout(function () {
      entry.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function closeCase(entry, scrollBack) {
    entry.panel.classList.remove('is-open');
    entry.trigger.setAttribute('aria-expanded', 'false');
    if (scrollBack) {
      /* Один и тот же кейс открывается двумя кнопками — десктопной и
         мобильной; вторая скрыта. Возвращаемся к той, что сейчас видна. */
      var target = entry.trigger;
      entries.forEach(function (other) {
        if (other.panel === entry.panel && other.trigger.offsetParent !== null) {
          target = other.trigger;
        }
      });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function closeAllExcept(current) {
    entries.forEach(function (entry) {
      if (entry !== current && entry.panel.classList.contains('is-open')) {
        closeCase(entry, false);
      }
    });
  }

  entries.forEach(function (entry) {
    entry.trigger.addEventListener('click', function (e) {
      e.preventDefault();
      if (entry.panel.classList.contains('is-open')) {
        closeCase(entry, false);
      } else {
        closeAllExcept(entry);
        openCase(entry);
      }
    });

    if (entry.closeBtn) {
      entry.closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeCase(entry, true);
      });
    }
  });
})();

/* Единая шапка: подставляем под неё цвет бумаги того экрана, над которым
   она сейчас находится. Подложки экранов отличаются оттенком (#E7DFD9 …
   #F3EEE9), и без этого на стыке полосы с бумагой была бы видна ступенька. */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-paper]'));
  if (!sections.length) return;

  var ticking = false;

  function update() {
    ticking = false;
    var probe = header.offsetHeight / 2;
    var paper = '';
    for (var i = 0; i < sections.length; i++) {
      var box = sections[i].getBoundingClientRect();
      if (box.top <= probe && box.bottom > probe) {
        paper = sections[i].getAttribute('data-paper');
        break;
      }
    }
    header.style.setProperty('--header-paper', paper);
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
})();

/* Мобильное меню (<=700px): бургер открывает панель с четырьмя пунктами.
   Закрывается выбором пункта, тапом вне панели и клавишей Esc.
   Плюс автоскрытие шапки: вниз — уезжает, вверх — возвращается,
   в самом верху страницы всегда видна. */
(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var panel  = document.getElementById('site-nav');
  if (!header || !toggle || !panel) return;

  var scrim = document.createElement('div');
  scrim.className = 'nav-scrim';
  document.body.appendChild(scrim);

  function isMobile() {
    return window.matchMedia('(max-width: 700px)').matches;
  }

  /* Пока меню открыто, страница под ним не должна прокручиваться.
     position: fixed на body надёжнее, чем overflow: hidden: последний
     не удерживает прокрутку на iOS. Позицию запоминаем и возвращаем. */
  var savedY = 0;
  var locked = false;

  function lockPage() {
    if (locked) return;
    savedY = window.scrollY;
    /* Зафиксированная страница перестаёт прокручиваться, и полоса
       прокрутки исчезает. Там, где она занимает место (Windows), окно
       становится шире, контент перевёрстывается и «прыгает». Возвращаем
       эту ширину отступом — и странице, и шапке. */
    var gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = 'fixed';
    document.body.style.top = -savedY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    if (gutter > 0) {
      document.body.style.paddingRight = gutter + 'px';
      header.style.paddingRight = gutter + 'px';
    }
    locked = true;
  }

  function unlockPage() {
    if (!locked) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.paddingRight = '';
    header.style.paddingRight = '';
    locked = false;
    window.scrollTo({ top: savedY, behavior: 'instant' });
  }

  function setOpen(open) {
    panel.classList.toggle('is-open', open);
    scrim.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      header.classList.remove('is-hidden');   // пока меню открыто, шапка видна
      if (isMobile()) lockPage();
    } else {
      unlockPage();
    }
  }

  function close() { setOpen(false); }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  scrim.addEventListener('click', close);

  panel.addEventListener('click', function (e) {
    if (e.target.closest('a')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') close();
  });

  window.addEventListener('resize', function () {
    if (!isMobile()) close();
  });

  /* ---- Автоскрытие шапки ---------------------------------------------- */
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.scrollY;

    if (!isMobile() || panel.classList.contains('is-open')) {
      header.classList.remove('is-hidden');
      lastY = y;
      return;
    }

    if (y <= 8) {
      header.classList.remove('is-hidden');           // самый верх — всегда видна
    } else if (y > lastY + 6) {
      header.classList.add('is-hidden');              // вниз — прячем
    } else if (y < lastY - 6) {
      header.classList.remove('is-hidden');           // вверх — показываем
    }
    lastY = y;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScroll);
  }, { passive: true });
})();

/* Подложки мобильных экранов подключаются, когда экран подходит к окну.
   Фрагменты подложек выводятся через CSS background-image, а фоны
   не подчиняются loading="lazy": браузер запрашивает их сразу, как
   только элемент отрисован. Поэтому адрес картинки держим в переменной
   --plate, а класс is-near ставим наблюдателем за видимостью.
   Размеры всех фрагментов заданы через aspect-ratio, так что появление
   картинки не меняет высоту блоков и не сдвигает страницу. */
(function () {
  var screens = document.querySelectorAll('.m-screen');
  if (!screens.length) return;

  function showAll() {
    Array.prototype.forEach.call(screens, function (s) { s.classList.add('is-near'); });
  }

  if (!('IntersectionObserver' in window)) { showAll(); return; }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-near');
      io.unobserve(e.target);
    });
  }, { rootMargin: '700px 0px' });

  Array.prototype.forEach.call(screens, function (s) { io.observe(s); });
})();
