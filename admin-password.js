(() => {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const control = button.closest('.password-control');
      const input = control?.querySelector('input');
      if (!input) return;

      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
      button.setAttribute('aria-label', shouldShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      input.focus({preventScroll:true});
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
})();

