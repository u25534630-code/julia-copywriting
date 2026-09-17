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
