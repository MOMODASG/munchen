import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { escapeHtml, sendHtml, setSecurityHeaders } from '../lib/http.js';
import { tenantForRequest } from '../lib/tenants.js';
import {
  clearLoginAttempts,
  createAdmin,
  loadAdmin,
  loadLoginAttempts,
  loadTenantSettings,
  recordLoginAttempt,
  saveTenantSettings,
} from '../lib/supabase.js';

const SESSION_COOKIE = '__Host-keez_admin';
const SESSION_IDLE_SECONDS = 30 * 60;
const SESSION_MAX_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (Buffer.byteLength(secret) < 32) {
    throw new Error('ADMIN_SESSION_SECRET must contain at least 32 bytes.');
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function createSession(tenant, response) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    tenant: tenant.slug,
    iat: now,
    exp: now + SESSION_MAX_SECONDS,
    csrf: crypto.randomBytes(32).toString('base64url'),
    authenticated: false,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encoded}.${sign(encoded)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_SECONDS}`);
  return payload;
}

function updateSession(payload, response) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encoded}.${sign(encoded)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_SECONDS}`);
}

function readSession(request) {
  const cookieHeader = String(request.headers.cookie || '');
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;

  const token = cookie.slice(SESSION_COOKIE.length + 1);
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  const encoded = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1));
  const expectedSignature = Buffer.from(sign(encoded));
  if (suppliedSignature.length !== expectedSignature.length
    || !crypto.timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || payload.exp <= now || payload.iat > now
      || now - payload.iat > SESSION_MAX_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

function sessionForTenant(request, tenant) {
  const session = readSession(request);
  return session && session.tenant === tenant.slug ? session : null;
}

function requestIpHash(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const address = String(request.headers['x-real-ip'] || '').trim() || forwarded[0] || 'unknown';
  return crypto.createHmac('sha256', sessionSecret()).update(address).digest('hex');
}

function formValues(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    return Object.fromEntries(new URLSearchParams(request.body));
  }
  return {};
}

function verifyCsrf(session, form) {
  const supplied = Buffer.from(String(form.csrf || ''));
  const expected = Buffer.from(String(session?.csrf || ''));
  return expected.length > 0 && supplied.length === expected.length
    && crypto.timingSafeEqual(supplied, expected);
}

function redirect(response, location) {
  response.statusCode = 303;
  response.setHeader('Location', location);
  response.setHeader('Cache-Control', 'no-store');
  response.end();
}

function adminPageStart(title, tenant, cssPath = '/assets/css/admin.css?v=20261020-1') {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>${escapeHtml(title)} · ${escapeHtml(tenant.name)}</title>
<link rel="stylesheet" href="${cssPath}"></head>`;
}

function adminLogo(tenant) {
  return `<a class="admin-brand" href="/"><img src="/assets/images/${escapeHtml(tenant.slug)}weed-dark.svg" alt="${escapeHtml(tenant.name)}weed" width="360" height="56"></a>`;
}

function renderLogin(tenant, csrf, setupRequired, error = '') {
  const heading = setupRequired ? 'Créer votre accès' : 'Connexion';
  const intro = setupRequired
    ? 'Premier accès : définissez le mot de passe qui protégera l’administration.'
    : 'Saisissez votre mot de passe pour gérer les contacts publics du site.';
  const errorBlock = error ? `<div class="admin-alert error" role="alert">${escapeHtml(error)}</div>` : '';
  const form = setupRequired
    ? `<form method="post" action="/admin/login.php" autocomplete="off">
      <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
      <input type="hidden" name="action" value="setup">
      <label for="setup_token">Code de première configuration</label>
      <div class="password-control"><input id="setup_token" name="setup_token" type="password" required autocomplete="off"></div>
      <label for="password">Nouveau mot de passe (12 caractères minimum)</label>
      <div class="password-control"><input id="password" name="password" type="password" minlength="12" required autocomplete="new-password"><button class="password-toggle" type="button" data-password-toggle aria-label="Afficher le mot de passe" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.7 15.7 0 0 1-2.2 2.8M6.5 6.6C4 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div>
      <label for="password_confirmation">Confirmer le mot de passe</label>
      <div class="password-control"><input id="password_confirmation" name="password_confirmation" type="password" minlength="12" required autocomplete="new-password"><button class="password-toggle" type="button" data-password-toggle aria-label="Afficher le mot de passe" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.7 15.7 0 0 1-2.2 2.8M6.5 6.6C4 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div>
      <button type="submit">Créer l’accès</button></form>`
    : `<form method="post" action="/admin/login.php" autocomplete="off">
      <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
      <label for="password">Mot de passe</label>
      <div class="password-control"><input id="password" name="password" type="password" minlength="12" required autocomplete="current-password"><button class="password-toggle" type="button" data-password-toggle aria-label="Afficher le mot de passe" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6s-3.5 6-9.5 6c-1.5 0-2.8-.4-4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div>
      <button type="submit">Se connecter</button></form>`;
  return `${adminPageStart(setupRequired ? 'Créer l’accès administrateur' : 'Connexion administrateur', tenant)}
<body class="admin-login-page"><main class="admin-auth-card">${adminLogo(tenant)}
<p class="admin-kicker">Administration sécurisée</p><h1>${heading}</h1><p class="admin-intro">${intro}</p>
${errorBlock}${form}<a class="admin-back" href="/">Retour au site</a></main>
<script src="/assets/js/admin-password.js"></script></body></html>`;
}

function renderSettings(tenant, csrf, settings, saved = false, error = '') {
  const errorBlock = error ? `<div class="admin-alert error" role="alert">${escapeHtml(error)}</div>` : '';
  const successBlock = saved ? '<div class="admin-alert success" role="status">Les liens de contact ont été mis à jour.</div>' : '';
  return `${adminPageStart(`Réglages · Administration ${tenant.name}weed`, tenant, '/assets/css/admin.css?v=20261020-1')}
<body>
<header class="admin-topbar"><div class="admin-topbar-inner">
<a class="admin-brand" href="/admin/settings.php" aria-label="Contacts publics ${escapeHtml(tenant.name)}weed"><img src="/assets/images/${escapeHtml(tenant.slug)}weed-light.svg" alt="" width="360" height="56"> <small>Admin</small></a>
<nav class="admin-nav admin-nav-desktop" aria-label="Navigation principale de l’administration"><a href="/admin/settings.php" aria-current="page"><span>Contacts publics</span></a></nav>
<div class="admin-topbar-actions"><a class="admin-site-link" href="/" target="_blank" rel="noopener">Voir le site</a>
<form method="post" action="/admin/logout.php"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button class="admin-logout" type="submit" aria-label="Se déconnecter">Se déconnecter</button></form></div>
</div></header>
<main class="admin-shell settings-shell"><header class="admin-page-header"><div class="admin-heading"><h1>Réglages</h1><p>Modifiez les contacts Telegram et WhatsApp pour les questions générales et l’information de prévention.</p></div></header>
${successBlock}${errorBlock}
<form class="admin-settings-form" method="post" action="/admin/settings.php"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
<section class="admin-settings settings-section" aria-labelledby="contactSettingsTitle"><header class="settings-section-head"><span class="settings-section-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10h8M8 14h5"/><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-1-1.73V6a2 2 0 0 1 2-2Z"/></svg></span><div><h2 id="contactSettingsTitle">Contacts pour information générale</h2><p>Ces liens restent visibles sur l’accueil et dans le pied de page. Utilisez-les pour des questions générales et des ressources de prévention.</p></div></header>
<div class="admin-settings-grid"><div class="admin-field"><label for="telegram_url">Lien Telegram</label><p>Adresse de votre canal d’information ou du contact dédié aux questions générales.</p><input id="telegram_url" name="telegram_url" type="text" value="${escapeHtml(settings.telegram_url)}" required></div>
<div class="admin-field"><label for="whatsapp_url">Lien ou numéro WhatsApp</label><p>Laissez ce champ vide pour désactiver le lien WhatsApp.</p><input id="whatsapp_url" name="whatsapp_url" type="text" value="${escapeHtml(settings.whatsapp_url)}"></div></div></section>
<div class="admin-settings-savebar"><span>Réservez ces contacts à l’information générale et à la prévention.</span><button class="admin-save" type="submit">Enregistrer les réglages</button></div>
</form></main><script src="/assets/js/admin-ui.js?v=20260813-2" defer></script></body></html>`;
}

function normalizeContact(service, value) {
  const input = String(value || '').trim();
  if (!input) return service === 'whatsapp' ? '' : null;
  if (service === 'telegram' && /^@?[A-Za-z0-9_]{5,32}$/.test(input)) {
    return `https://t.me/${input.replace(/^@/, '')}`;
  }
  if (service === 'whatsapp' && /^\+?[0-9 ()-]{8,24}$/.test(input)) {
    const number = input.replace(/\D/g, '');
    return number ? `https://wa.me/${number}` : null;
  }
  try {
    const url = new URL(input);
    const hosts = service === 'telegram'
      ? ['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me']
      : ['wa.me', 'www.wa.me', 'api.whatsapp.com', 'www.api.whatsapp.com'];
    return ['http:', 'https:'].includes(url.protocol) && hosts.includes(url.hostname.toLowerCase())
      ? input
      : null;
  } catch {
    return null;
  }
}

async function sendLoginPage(request, response, tenant, error = '', status = 200) {
  const session = createSession(tenant, response);
  const admin = await loadAdmin();
  const setupRequired = !admin;
  setSecurityHeaders(response, true);
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  return sendHtml(response, status, renderLogin(tenant, session.csrf, setupRequired, error), true);
}

async function handleLogin(request, response, tenant) {
  if (request.method === 'GET') {
    const session = sessionForTenant(request, tenant);
    if (session?.authenticated) return redirect(response, '/admin/settings.php');
    return sendLoginPage(request, response, tenant);
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendHtml(response, 405, 'Method not allowed.', true);
  }

  const form = formValues(request);
  const session = sessionForTenant(request, tenant);
  if (!verifyCsrf(session, form)) return sendLoginPage(request, response, tenant, 'Session expirée. Rechargez la page puis réessayez.');
  const ipHash = requestIpHash(request);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  if (await loadLoginAttempts(tenant.slug, ipHash, windowStart) >= 10) {
    response.setHeader('Retry-After', '900');
    return sendLoginPage(request, response, tenant, 'Trop de tentatives. Réessayez dans 15 minutes.', 429);
  }

  if (form.action === 'setup') {
    const currentAdmin = await loadAdmin();
    const expectedToken = process.env.ADMIN_SETUP_TOKEN || '';
    const providedToken = String(form.setup_token || '');
    const expectedBytes = Buffer.from(expectedToken);
    const providedBytes = Buffer.from(providedToken);
    const tokenValid = expectedBytes.length >= 32 && expectedBytes.length === providedBytes.length
      && crypto.timingSafeEqual(expectedBytes, providedBytes);
    if (currentAdmin) return sendLoginPage(request, response, tenant, 'Le compte administrateur existe déjà. Connectez-vous.');
    if (!tokenValid) {
      await recordLoginAttempt(tenant.slug, ipHash);
      return sendLoginPage(request, response, tenant, 'Code de configuration incorrect.');
    }

    const password = String(form.password || '');
    if (password.length < 12 || password !== String(form.password_confirmation || '')) {
      return sendLoginPage(request, response, tenant, 'Le mot de passe doit contenir au moins 12 caractères et les deux champs doivent correspondre.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await createAdmin(passwordHash);
    await clearLoginAttempts(tenant.slug, ipHash);
    const authenticatedSession = {
      ...session,
      authenticated: true,
      lastActivity: Math.floor(Date.now() / 1000),
    };
    updateSession(authenticatedSession, response);
    return redirect(response, '/admin/settings.php');
  }

  const admin = await loadAdmin();
  if (!admin) return sendLoginPage(request, response, tenant, 'L’accès administrateur n’est pas encore configuré.');
  const storedHash = String(admin.password_hash || '').replace(/^\$2y\$/, '$2a$');
  const valid = await bcrypt.compare(String(form.password || ''), storedHash);
  if (!valid) {
    await recordLoginAttempt(tenant.slug, ipHash);
    return sendLoginPage(request, response, tenant, 'Mot de passe incorrect.');
  }

  await clearLoginAttempts(tenant.slug, ipHash);
  updateSession({
    ...session,
    authenticated: true,
    lastActivity: Math.floor(Date.now() / 1000),
  }, response);
  return redirect(response, '/admin/settings.php');
}

async function handleSettings(request, response, tenant) {
  const session = sessionForTenant(request, tenant);
  if (!session?.authenticated) return redirect(response, '/admin/login.php');
  const now = Math.floor(Date.now() / 1000);
  if (!session.lastActivity || now - session.lastActivity > SESSION_IDLE_SECONDS
    || now - session.iat > SESSION_MAX_SECONDS) {
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return redirect(response, '/admin/login.php');
  }
  session.lastActivity = now;
  updateSession(session, response);

  if (request.method === 'GET') {
    const settings = await loadTenantSettings(tenant);
    setSecurityHeaders(response, true);
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
    return sendHtml(response, 200, renderSettings(tenant, session.csrf, settings), true);
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendHtml(response, 405, 'Method not allowed.', true);
  }

  const form = formValues(request);
  if (!verifyCsrf(session, form)) {
    const settings = await loadTenantSettings(tenant);
    return sendHtml(response, 403, renderSettings(tenant, session.csrf, settings, false, 'Session expirée. Rechargez la page.'));
  }
  const telegram = normalizeContact('telegram', form.telegram_url);
  const whatsapp = normalizeContact('whatsapp', form.whatsapp_url);
  if (telegram === null || whatsapp === null) {
    const settings = await loadTenantSettings(tenant);
    return sendHtml(response, 400, renderSettings(tenant, session.csrf, {
      telegram_url: telegram ?? String(form.telegram_url || ''),
      whatsapp_url: whatsapp ?? String(form.whatsapp_url || ''),
    }, false, 'Vérifiez les liens Telegram et WhatsApp.'));
  }

  await saveTenantSettings(tenant, { telegram_url: telegram, whatsapp_url: whatsapp });
  return sendHtml(response, 200, renderSettings(tenant, session.csrf, {
    telegram_url: telegram,
    whatsapp_url: whatsapp,
  }, true), true);
}

async function handleLogout(request, response, tenant) {
  if (request.method !== 'POST') return redirect(response, '/admin/login.php');
  const session = sessionForTenant(request, tenant);
  const form = formValues(request);
  if (session?.authenticated && verifyCsrf(session, form)) {
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  }
  return redirect(response, '/admin/login.php');
}

export default async function admin(request, response) {
  const tenant = tenantForRequest(request);
  if (!tenant) return sendHtml(response, 404, 'Unknown site.', true);
  const page = String(request.query.page || '');

  try {
    if (page === 'login' || page === 'setup') return await handleLogin(request, response, tenant);
    if (page === 'settings') return await handleSettings(request, response, tenant);
    if (page === 'logout') return await handleLogout(request, response, tenant);
    return sendHtml(response, 404, 'Not found.', true);
  } catch (error) {
    console.error(`Admin request failed for tenant ${tenant.slug}.`, error);
    return sendHtml(response, 503, '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Service indisponible</title><p>Le service d’administration est temporairement indisponible. Vérifiez les variables Vercel et le schéma Supabase.</p></html>', true);
  }
};
