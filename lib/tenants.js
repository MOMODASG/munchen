import { tenants } from '../data/tenants.js';

const tenant = tenants[0];
const tenantsByHost = new Map([[tenant.domain.toLowerCase(), tenant]]);
const tenantsBySlug = new Map([[tenant.slug, tenant]]);

function requestHost(request) {
  const host = String(request.headers.host || '').trim().toLowerCase();
  return host.replace(/:\d+$/, '');
}

function tenantForRequest(request) {
  const host = requestHost(request);
  const canonicalHost = host.startsWith('www.') ? host.slice(4) : host;
  const exactTenant = tenantsByHost.get(canonicalHost);
  if (exactTenant) return exactTenant;
  if (host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1') return tenant;
  return null;
}

export { tenantForRequest, tenantsBySlug };
