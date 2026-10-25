import { rewrite } from '@vercel/functions';
import { tenants } from './data/tenants.js';

const tenant = tenants[0];
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

export default function proxy(request) {
  const url = new URL(request.url);
  const site = tenantForHost(url.hostname);
  if (!site) return new Response('Unknown site.', { status: 404 });

  if (url.pathname === '/' || url.pathname === '/index.php') {
    const requestedLanguage = url.searchParams.get('lang') || 'en';
    const language = ['en', 'fr', 'de'].includes(requestedLanguage) ? requestedLanguage : 'en';
    url.pathname = language === 'en' ? '/index.html' : `/index-${language}.html`;
    url.search = '';
    return rewrite(url);
  }

  if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') {
    const file = url.pathname === '/robots.txt' ? 'robots.txt' : 'sitemap.xml';
    url.pathname = `/generated/seo/${site.slug}-${file}`;
    url.search = '';
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
