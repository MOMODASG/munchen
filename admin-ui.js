(() => {
  'use strict';

  const body = document.body;
  const menuButtons = [...document.querySelectorAll('[data-admin-menu-toggle]')];
  const menuButton = menuButtons[0];
  const mobileMenu = document.querySelector('[data-admin-mobile-menu]');
  const mobileBackdrop = document.querySelector('[data-admin-menu-backdrop]');
  const toastStack = document.querySelector('[data-admin-toast-stack]');
  const confirmLayer = document.querySelector('[data-admin-confirm]');
  const confirmTitle = confirmLayer?.querySelector('[data-confirm-title]');
  const confirmMessage = confirmLayer?.querySelector('[data-confirm-message]');
  const confirmAccept = confirmLayer?.querySelector('[data-confirm-accept]');
  const confirmCancel = confirmLayer?.querySelector('[data-confirm-cancel]');
  let confirmResolver = null;

  const setMenu = (open) => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    mobileMenu.hidden = !open;
    if (mobileBackdrop) mobileBackdrop.hidden = !open;
    body.classList.toggle('admin-menu-open', open);
  };

  menuButtons.forEach((button) => button.addEventListener('click', () => setMenu(menuButton?.getAttribute('aria-expanded') !== 'true')));
  mobileBackdrop?.addEventListener('click', () => setMenu(false));
  mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));

  const toast = (message, type = 'success', duration = 3600) => {
    if (!toastStack || !message) return;
    const item = document.createElement('div');
    item.className = `admin-toast is-${type}`;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    item.innerHTML = `
      <span class="admin-toast-icon" aria-hidden="true">
        ${type === 'error'
          ? '<svg viewBox="0 0 24 24"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="9"/></svg>'}
      </span>
      <span>${String(message).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character])}</span>
      <button type="button" aria-label="Fermer la notification"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button>`;
    toastStack.append(item);
    requestAnimationFrame(() => item.classList.add('is-visible'));
    const remove = () => {
      item.classList.remove('is-visible');
      window.setTimeout(() => item.remove(), 220);
    };
    const timer = window.setTimeout(remove, duration);
    item.querySelector('button')?.addEventListener('click', () => {
      window.clearTimeout(timer);
      remove();
    });
  };

  const queueToast = (message, type = 'success') => {
    try { sessionStorage.setItem('skush_admin_toast', JSON.stringify({ message, type })); } catch (error) {}
  };

  const closeConfirm = (answer) => {
    if (!confirmLayer || confirmLayer.hidden) return;
    confirmLayer.classList.remove('is-open');
    body.classList.remove('admin-modal-open');
    window.setTimeout(() => { confirmLayer.hidden = true; }, 220);
    const resolver = confirmResolver;
    confirmResolver = null;
    resolver?.(answer);
  };

  const confirmAction = ({
    title = 'Confirmer l’action',
    message = 'Voulez-vous continuer ?',
    confirmLabel = 'Confirmer'
  } = {}) => new Promise((resolve) => {
    if (!confirmLayer || !confirmTitle || !confirmMessage || !confirmAccept) {
      resolve(false);
      return;
    }
    if (confirmResolver) confirmResolver(false);
    confirmResolver = resolve;
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmAccept.textContent = confirmLabel;
    confirmLayer.hidden = false;
    body.classList.add('admin-modal-open');
    requestAnimationFrame(() => {
      confirmLayer.classList.add('is-open');
      confirmCancel?.focus({ preventScroll: true });
    });
  });

  confirmAccept?.addEventListener('click', () => closeConfirm(true));
  confirmCancel?.addEventListener('click', () => closeConfirm(false));
  confirmLayer?.addEventListener('click', (event) => {
    if (event.target === confirmLayer) closeConfirm(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (confirmLayer && !confirmLayer.hidden) closeConfirm(false);
    else setMenu(false);
  });

  document.querySelectorAll('[data-admin-toast]').forEach((notice) => {
    toast(notice.textContent.trim(), notice.classList.contains('error') ? 'error' : 'success');
    notice.hidden = true;
  });

  try {
    const queued = JSON.parse(sessionStorage.getItem('skush_admin_toast') || 'null');
    if (queued?.message) toast(queued.message, queued.type || 'success');
    sessionStorage.removeItem('skush_admin_toast');
  } catch (error) {}

  window.SkushAdmin = { toast, queueToast, confirm: confirmAction };
})();
