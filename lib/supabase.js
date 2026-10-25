function configuration() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase server configuration is missing.');
  }

  return { url: url.replace(/\/+$/, ''), serviceKey };
}

async function supabaseRequest(path, options = {}) {
  const { url, serviceKey } = configuration();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Supabase request failed (${response.status}): ${detail.slice(0, 500)}`);
    throw new Error('Supabase request failed.');
  }

  const responseBody = await response.text();
  return responseBody ? JSON.parse(responseBody) : null;
}

async function loadAdmin() {
  const rows = await supabaseRequest('admin_users?username=eq.admin&select=id,username,password_hash&limit=1');
  return rows[0] || null;
}

async function loadTenantSettings(tenant) {
  const slug = encodeURIComponent(tenant.slug);
  const rows = await supabaseRequest(
    `tenant_site_settings?tenant_slug=eq.${slug}&select=setting_key,setting_value`,
  );
  const settings = { ...tenant.defaultSettings };
  if (rows.length === 0) {
    const legacyRows = await supabaseRequest('site_settings?select=setting_key,setting_value');
    for (const row of legacyRows) {
      if (row.setting_key === 'telegram_url' || row.setting_key === 'whatsapp_url') {
        settings[row.setting_key] = row.setting_value;
      }
    }
  }
  for (const row of rows) {
    if (row.setting_key === 'telegram_url' || row.setting_key === 'whatsapp_url') {
      settings[row.setting_key] = row.setting_value;
    }
  }
  return settings;
}

async function saveTenantSettings(tenant, settings) {
  const rows = ['telegram_url', 'whatsapp_url'].map((settingKey) => ({
    tenant_slug: tenant.slug,
    setting_key: settingKey,
    setting_value: settings[settingKey],
  }));
  await supabaseRequest('tenant_site_settings?on_conflict=tenant_slug%2Csetting_key', {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

async function createAdmin(passwordHash) {
  await supabaseRequest('admin_users', {
    method: 'POST',
    body: { username: 'admin', password_hash: passwordHash },
    prefer: 'return=minimal',
  });
}

async function loadLoginAttempts(tenantSlug, ipHash, windowStart) {
  const params = new URLSearchParams({
    tenant_slug: `eq.${tenantSlug}`,
    ip_hash: `eq.${ipHash}`,
    window_started_at: `gt.${windowStart}`,
    select: 'attempts',
    limit: '1',
  });
  const rows = await supabaseRequest(`admin_login_attempts?${params.toString()}`);
  return Number(rows[0]?.attempts || 0);
}

async function recordLoginAttempt(tenantSlug, ipHash) {
  await supabaseRequest('rpc/record_admin_login_attempt', {
    method: 'POST',
    body: { p_tenant_slug: tenantSlug, p_ip_hash: ipHash },
  });
}

async function clearLoginAttempts(tenantSlug, ipHash) {
  const params = new URLSearchParams({
    tenant_slug: `eq.${tenantSlug}`,
    ip_hash: `eq.${ipHash}`,
  });
  await supabaseRequest(`admin_login_attempts?${params.toString()}`, { method: 'DELETE' });
}

export {
  clearLoginAttempts,
  createAdmin,
  loadAdmin,
  loadLoginAttempts,
  loadTenantSettings,
  recordLoginAttempt,
  saveTenantSettings,
};
