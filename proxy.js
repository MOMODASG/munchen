import { rewrite } from '@vercel/functions';
import { tenants } from './data/tenants.js';

const tenant = tenants[0];
const defaultLanguage = tenant.defaultLanguage;
const languagePages = {
  [defaultLanguage]: defaultLanguage === 'en' ? 'index.html' : `index-${defaultLanguage}.html`,
};
const adminPages = new Map([
  ['login.php', 'login'],
  ['setup.php', 'setup'],
  ['settings.php', 'settings'],
  ['logout.php', 'logout'],
]);

function tenantForHost(hostname) {
  const host = hostname.toLowerCase();
  const canonicalHost = host.startsWith('www.') ? host.slice(4) : host;
  if (canonicalHost === tenant.domain.toLowerCase()) return tenant;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) return tenant;
  return null;
}

function redirectToLanguage(url, language) {
  const destination = new URL(url);
  destination.pathname = `/${language}/`;
  destination.searchParams.delete('lang');
  return Response.redirect(destination, 308);
}

export default function proxy(request) {
  const url = new URL(request.url);
  const site = tenantForHost(url.hostname);
  if (!site) return new Response('Unknown site.', { status: 404 });

  if (url.pathname === '/' || url.pathname === '/index.php') {
    const requestedLanguage = url.searchParams.get('lang') || defaultLanguage;
    const language = Object.hasOwn(languagePages, requestedLanguage) ? requestedLanguage : defaultLanguage;
    return redirectToLanguage(url, language);
  }

  const languagePath = url.pathname.match(/^\/([a-z]{2})\/?$/);
  if (languagePath) {
    const language = languagePath[1];
    if (!Object.hasOwn(languagePages, language)) return redirectToLanguage(url, defaultLanguage);
    if (url.pathname !== `/${language}/` || url.searchParams.has('lang')) return redirectToLanguage(url, language);
    url.pathname = `/${languagePages[language]}`;
    url.searchParams.delete('lang');
    return rewrite(url);
  }

  if (url.pathname.startsWith('/admin/')) {
    const page = adminPages.get(url.pathname.slice('/admin/'.length));
    if (!page) return new Response('Not found.', { status: 404 });
    url.pathname = '/api/admin';
    url.searchParams.set('page', page);
    return rewrite(url);
  }

  return new Response('Not found.', { status: 404 });
}
