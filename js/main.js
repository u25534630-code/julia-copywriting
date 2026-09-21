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
      entry.trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
