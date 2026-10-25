(() => {
  'use strict';

  const isValidUrl = (value, hosts) => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && hosts.includes(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  };

  fetch('/api/public-settings', { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Contact settings request failed (${response.status}).`);
      return response.json();
    })
    .then((settings) => {
      const telegram = isValidUrl(settings.telegram_url, ['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me'])
        ? settings.telegram_url
        : '';
      const whatsapp = isValidUrl(settings.whatsapp_url, ['wa.me', 'www.wa.me', 'api.whatsapp.com', 'www.api.whatsapp.com'])
        ? settings.whatsapp_url
        : '';

      document.querySelectorAll('.telegram-card, .telegram-button, .contact-bubble--telegram').forEach((link) => {
        if (telegram) link.href = telegram;
      });

      document.querySelectorAll('.whatsapp-card, .whatsapp-button').forEach((link) => {
        if (whatsapp) {
          link.href = whatsapp;
          link.removeAttribute('aria-disabled');
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        } else {
          link.href = '#';
          link.setAttribute('aria-disabled', 'true');
          link.removeAttribute('target');
          link.removeAttribute('rel');
        }
      });

      document.querySelectorAll('.contact-bubble--whatsapp').forEach((link) => {
        if (link.tagName === 'A' && whatsapp) {
          link.href = whatsapp;
          link.classList.remove('is-unavailable');
          link.removeAttribute('aria-disabled');
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        } else if (link.tagName !== 'A' && whatsapp) {
          const replacement = document.createElement('a');
          replacement.className = 'contact-bubble contact-bubble--whatsapp';
          replacement.href = whatsapp;
          replacement.target = '_blank';
          replacement.rel = 'noopener noreferrer';
          replacement.setAttribute('aria-label', link.getAttribute('aria-label') || 'WhatsApp');
          replacement.setAttribute('title', link.getAttribute('title') || 'WhatsApp');
          replacement.innerHTML = link.innerHTML;
          link.replaceWith(replacement);
        }
      });

      document.querySelectorAll('footer a').forEach((link) => {
        if (/telegram/i.test(link.textContent) && telegram) link.href = telegram;
        if (/whatsapp/i.test(link.textContent)) {
          link.href = whatsapp || '#';
          if (whatsapp) {
            link.removeAttribute('aria-disabled');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          } else {
            link.setAttribute('aria-disabled', 'true');
            link.removeAttribute('target');
            link.removeAttribute('rel');
          }
        }
      });
    })
    .catch((error) => {
      console.error('Unable to load this site’s public contact settings.', error);
    });
})();
