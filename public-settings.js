import { tenantForRequest } from '../lib/tenants.js';
import { sendJson } from '../lib/http.js';
import { loadTenantSettings } from '../lib/supabase.js';

export default async function publicSettings(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const tenant = tenantForRequest(request);
  if (!tenant) return sendJson(response, 404, { error: 'Unknown site.' });

  try {
    const settings = await loadTenantSettings(tenant);
    return sendJson(response, 200, {
      telegram_url: settings.telegram_url,
      whatsapp_url: settings.whatsapp_url,
    }, 'no-store');
  } catch (error) {
    console.error(`Could not load public settings for tenant ${tenant.slug}.`, error);
    return sendJson(response, 503, { error: 'Contact settings are temporarily unavailable.' });
  }
};
