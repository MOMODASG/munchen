(() => {
  const trigger = document.querySelector('[data-admin-trigger]');
  if (!trigger) return;

  let clicks = 0;
  let timer = 0;
  const originalUrl = trigger.href;
  const adminUrl = trigger.dataset.adminUrl;
  if (!adminUrl) return;

  trigger.addEventListener('click', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    clicks += 1;
    window.clearTimeout(timer);

    if (clicks >= 3) {
      clicks = 0;
      window.location.assign(adminUrl);
      return;
    }

    timer = window.setTimeout(() => {
      clicks = 0;
      window.location.assign(originalUrl);
    }, 1500);
  });
})();
