(() => {
  const gate = document.querySelector('#ageGate');
  if (!gate) return;

  const panel = gate.querySelector('.age-gate-panel');
  const confirmButton = gate.querySelector('[data-age-confirm]');
  const leaveButton = gate.querySelector('[data-age-leave]');
  const backButton = gate.querySelector('[data-age-back]');

  let verified = false;
  try {
    verified = localStorage.getItem('skushdrop_age_verified') === 'yes';
  } catch (error) {
    verified = false;
  }

  if (verified) {
    gate.hidden = true;
    document.documentElement.dataset.ageVerified = 'true';
    return;
  }

  document.documentElement.dataset.ageVerified = 'false';
  window.setTimeout(() => confirmButton?.focus(), 80);

  confirmButton?.addEventListener('click', () => {
    try {
      localStorage.setItem('skushdrop_age_verified', 'yes');
    } catch (error) {}
    gate.classList.add('is-leaving');
    window.setTimeout(() => {
      gate.hidden = true;
      document.documentElement.dataset.ageVerified = 'true';
      document.querySelector('.nav a, main a, main button')?.focus();
    }, 320);
  });

  leaveButton?.addEventListener('click', () => {
    gate.classList.add('is-denied');
    backButton?.focus();
  });

  backButton?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
  });

  gate.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button:not([hidden]),a[href]:not([hidden])')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();

