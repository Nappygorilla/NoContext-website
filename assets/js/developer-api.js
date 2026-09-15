(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  let csrfToken = localStorage.getItem('nocontext_csrf') || sessionStorage.getItem('nocontext_csrf') || '';
  const session = () => localStorage.getItem('nocontext_session_token') || '';

  const persistCsrf = value => {
    csrfToken = String(value || '');
    if (csrfToken) {
      sessionStorage.setItem('nocontext_csrf', csrfToken);
      localStorage.setItem('nocontext_csrf', csrfToken);
    } else {
      sessionStorage.removeItem('nocontext_csrf');
      localStorage.removeItem('nocontext_csrf');
    }
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...(session() ? { Authorization: `Bearer ${session()}` } : {})
  });

  const request = async (path, options = {}) => {
    const response = await fetch(`${api}${path}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status}).`);
    if (data.csrfToken) persistCsrf(data.csrfToken);
    return data;
  };

  const bootstrapSession = async () => {
    const response = await fetch(`${api}/api/auth/me`, { credentials: 'include', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) throw new Error(data.detail || 'Not signed in.');
    if (data.csrfToken) persistCsrf(data.csrfToken);
    return data;
  };

  const refreshAndRetry = async (path, options = {}) => {
    await bootstrapSession();
    return request(path, options);
  };

  const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const formatDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
  const keysEl = document.querySelector('[data-dev-keys]');
  const resultEl = document.querySelector('[data-dev-result]');
  const statusEl = document.querySelector('[data-dev-create-status]');
  const nameEl = document.querySelector('[data-dev-key-name]');

  function render(keys) {
    if (!keys.length) { keysEl.innerHTML = '<div class="dev-empty">No developer API keys yet.</div>'; return; }
    keysEl.innerHTML = keys.map(k => `<div class="dev-key"><div class="dev-key-main"><strong>${esc(k.name)}</strong><span>${esc(k.prefix)} · Created ${esc(formatDate(k.createdAt))}${k.lastUsedAt ? ` · Last used ${esc(formatDate(k.lastUsedAt))}` : ''}</span></div><button class="btn btn-outline" type="button" data-revoke="${esc(k.id)}" ${k.active ? '' : 'disabled'}>${k.active ? 'Revoke' : 'Revoked'}</button></div>`).join('');
    keysEl.querySelectorAll('[data-revoke]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm('Revoke this developer API key? Any application using it will stop authenticating.')) return;
      button.disabled = true;
      try { await request(`/api/developer/keys/${button.dataset.revoke}/revoke`, { method: 'POST' }); await load(); }
      catch (error) {
        if (/CSRF|403/i.test(error.message)) {
          try { await refreshAndRetry(`/api/developer/keys/${button.dataset.revoke}/revoke`, { method: 'POST' }); await load(); return; }
          catch (retryError) { alert(retryError.message); }
        } else alert(error.message);
        button.disabled = false;
      }
    }));
  }

  async function load() {
    try {
      const data = await request('/api/developer/keys');
      render(Array.isArray(data.keys) ? data.keys : []);
    } catch (error) {
      if (/CSRF|403/i.test(error.message)) {
        try {
          const data = await refreshAndRetry('/api/developer/keys');
          render(Array.isArray(data.keys) ? data.keys : []);
          return;
        } catch (retryError) { error = retryError; }
      }
      if (/401|403/.test(error.message)) { location.replace('./login'); return; }
      keysEl.innerHTML = `<div class="dev-empty">Unable to load API keys: ${esc(error.message)}</div>`;
    }
  }

  document.querySelector('[data-dev-create]')?.addEventListener('click', async event => {
    const name = String(nameEl?.value || '').trim() || 'My application';
    const requestOptions = { method: 'POST', body: JSON.stringify({ name }) };
    event.currentTarget.disabled = true;
    statusEl.className = 'dev-status';
    statusEl.textContent = 'Creating API key…';
    resultEl.classList.remove('visible');
    try {
      const data = await request('/api/developer/keys', requestOptions);
      resultEl.innerHTML = `<strong>API key created</strong><code>${esc(data.apiKey)}</code><small>Copy this key now. The full secret is only shown at creation time.</small>`;
      resultEl.classList.add('visible');
      statusEl.className = 'dev-status success';
      statusEl.textContent = 'Key created successfully.';
      try { await navigator.clipboard.writeText(String(data.apiKey)); } catch (_) {}
      await load();
    } catch (error) {
      if (/CSRF|403/i.test(error.message)) {
        try {
          const data = await refreshAndRetry('/api/developer/keys', requestOptions);
          resultEl.innerHTML = `<strong>API key created</strong><code>${esc(data.apiKey)}</code><small>Copy this key now. The full secret is only shown at creation time.</small>`;
          resultEl.classList.add('visible');
          statusEl.className = 'dev-status success';
          statusEl.textContent = 'Key created successfully.';
          try { await navigator.clipboard.writeText(String(data.apiKey)); } catch (_) {}
          await load();
          return;
        } catch (retryError) { error = retryError; }
      }
      statusEl.className = 'dev-status error';
      statusEl.textContent = error.message;
    } finally { event.currentTarget.disabled = false; }
  });

  bootstrapSession().then(load).catch(error => {
    if (/401|403|Not signed in/i.test(error.message)) location.replace('./login');
    else {
      statusEl.className = 'dev-status error';
      statusEl.textContent = error.message;
    }
  });
})();
