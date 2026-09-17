(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  const root = document.querySelector('[data-user-management]');
  const list = document.querySelector('[data-managed-users]');
  const status = document.querySelector('[data-user-management-status]');
  const keyResult = document.querySelector('[data-owner-key-result]');
  const keyList = document.querySelector('[data-managed-keys]');
  const keyStatus = document.querySelector('[data-key-management-status]');
  const csrf = () => sessionStorage.getItem('nocontext_csrf') || localStorage.getItem('nocontext_csrf') || '';
  const sessionToken = () => sessionStorage.getItem('nocontext_session') || localStorage.getItem('nocontext_session_token') || '';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const request = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(csrf() ? {'X-CSRF-Token': csrf()} : {}),
      ...(sessionToken() ? {Authorization: `Bearer ${sessionToken()}`} : {}),
      ...(options.headers || {})
    };
    const response = await fetch(`${api}${path}`, {...options, headers, credentials:'include', cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  };

  let users = [];

  const populateUserPicker = () => {
    const picker = document.querySelector('[data-key-user]');
    if (!picker) return;
    const selected = picker.value;
    picker.innerHTML = '<option value="">Your account</option>' + users.map(user => `<option value="${esc(user.id)}">#${esc(user.id)} · ${esc(user.username)}</option>`).join('');
    if ([...picker.options].some(option => option.value === selected)) picker.value = selected;
  };

  const ensureProducts = () => {
    const picker = document.querySelector('[data-key-product]');
    if (!picker) return;
    if (![...picker.options].some(option => option.value === 'NoContext Executor')) {
      const option = document.createElement('option');
      option.value = 'NoContext Executor';
      option.textContent = 'NoContext Executor';
      picker.appendChild(option);
    }
  };

  const setupImportUI = () => {
    const button = document.querySelector('[data-create-owner-key]');
    const form = button?.closest('.owner-key-form');
    if (!button || !form) return;

    const section = form.parentElement;
    const heading = section?.querySelector('h2');
    const description = section?.querySelector(':scope > p');
    if (heading) heading.textContent = 'Import Key';
    if (description) description.textContent = 'Paste a license key, choose a duration, and assign it to a registered account.';
    button.textContent = 'Import Key';

    // Keep one real, native input in a dedicated block. This replaces the old
    // injected field that was ending up visually present but not editable.
    document.querySelectorAll('.key-import-panel, .keyauth-import-panel, '.concat('key-import-panel-fixed')).forEach(node => node.remove());
    const inputPanel = document.createElement('div');
    inputPanel.className = 'key-import-panel-fixed';
    inputPanel.style.cssText = 'display:block!important;position:relative!important;z-index:100!important;width:100%!important;margin:12px 0 0!important;padding:0!important;pointer-events:auto!important;clear:both!important;';
    inputPanel.innerHTML = `
      <label style="display:block!important;width:100%!important;margin:0!important;position:relative!important;z-index:101!important;pointer-events:auto!important">
        <span style="display:block!important;margin:0 0 7px!important;color:#aab2ae!important;font-size:.65rem!important;text-transform:uppercase!important;letter-spacing:.08em!important">License key</span>
        <input data-key-import-input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" tabindex="0" inputmode="text" placeholder="Paste license key" aria-label="License key to import"
          style="display:block!important;position:relative!important;z-index:102!important;width:100%!important;min-width:0!important;height:58px!important;min-height:58px!important;max-height:58px!important;box-sizing:border-box!important;padding:15px 16px!important;margin:0!important;border-radius:11px!important;background:#0b0d12!important;border:1px solid rgba(190,255,70,.28)!important;color:#fff!important;font:inherit!important;font-size:16px!important;line-height:1.4!important;outline:none!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important;cursor:text!important;">
      </label>`;

    form.parentElement?.insertBefore(inputPanel, keyResult || null);

    const input = inputPanel.querySelector('[data-key-import-input]');
    input?.addEventListener('mousedown', event => event.stopPropagation());
    input?.addEventListener('click', event => event.stopPropagation());
    input?.addEventListener('keydown', event => event.stopPropagation());
    input?.addEventListener('focus', () => input.style.boxShadow = '0 0 0 2px rgba(190,255,70,.12)');
    input?.addEventListener('blur', () => input.style.boxShadow = 'none');

    const durationSelect = document.querySelector('[data-key-duration]');
    if (!durationSelect) return;
    durationSelect.style.display = 'none';
    document.querySelector('[data-key-duration-options]')?.remove();

    const durationGroup = document.createElement('div');
    durationGroup.dataset.keyDurationOptions = 'true';
    durationGroup.style.cssText = 'width:100%;margin:4px 0 12px;position:relative;z-index:90;';
    durationGroup.innerHTML = `
      <span style="display:block;margin:0 0 7px;color:#aab2ae;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em">Duration</span>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;width:100%;">
        <button type="button" data-duration="3d" style="min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left;position:relative;z-index:91;"><strong style="display:block;font-size:.88rem">3 Days</strong><span style="display:block;margin-top:4px;color:#8f9894;font-size:.72rem">3 days of access</span></button>
        <button type="button" data-duration="7d" style="min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left;position:relative;z-index:91;"><strong style="display:block;font-size:.88rem">1 Week</strong><span style="display:block;margin-top:4px;color:#8f9894;font-size:.72rem">7 days of access</span></button>
        <button type="button" data-duration="lifetime" style="min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left;position:relative;z-index:91;"><strong style="display:block;font-size:.88rem">Lifetime</strong><span style="display:block;margin-top:4px;color:#8f9894;font-size:.72rem">No expiration</span></button>
      </div>`;
    durationSelect.parentElement?.insertBefore(durationGroup, durationSelect);

    const setDuration = value => {
      durationSelect.value = value;
      durationGroup.querySelectorAll('[data-duration]').forEach(option => {
        const active = option.dataset.duration === value;
        option.style.borderColor = active ? 'rgba(190,255,70,.5)' : 'rgba(255,255,255,.1)';
        option.style.background = active ? 'rgba(190,255,70,.08)' : 'rgba(255,255,255,.03)';
      });
    };
    durationGroup.querySelectorAll('[data-duration]').forEach(option => option.addEventListener('click', () => setDuration(option.dataset.duration)));
    setDuration(durationSelect.value || '3d');
  };

  const renderUsers = data => {
    users = Array.isArray(data.users) ? data.users : [];
    if (!list) return;
    list.innerHTML = users.length ? users.map(user => {
      const protectedUser = Number(user.id) === 1;
      return `<article class="managed-user ${user.banned ? 'is-banned' : ''}"><div class="managed-user-main"><div class="managed-user-title"><strong>#${esc(user.id)} · ${esc(user.username)}</strong><span class="role-pill">${esc(user.role)}</span>${user.banned ? '<span class="ban-pill">BANNED</span>' : ''}</div><div class="managed-user-meta">${esc(user.email)} · Joined ${esc(new Date(user.createdAt).toLocaleDateString())}</div></div><div class="managed-user-actions"><label>Role<select data-role="${esc(user.id)}" ${protectedUser ? 'disabled' : ''}>${data.roles.map(role => `<option value="${esc(role)}" ${role === user.role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label>${protectedUser ? '<span class="protected-note">Primary owner</span>' : user.banned ? `<button class="btn btn-outline" type="button" data-unban="${esc(user.id)}">Unban</button>` : `<button class="btn btn-outline danger-btn" type="button" data-ban="${esc(user.id)}">Ban</button>`}</div></article>`;
    }).join('') : '<p>No registered users.</p>';

    populateUserPicker();
    list.querySelectorAll('[data-role]').forEach(select => select.addEventListener('change', async () => {
      const id = Number(select.dataset.role); select.disabled = true;
      try { await request(`/api/admin/users/${id}/role`, {method:'POST', body:JSON.stringify({role:select.value})}); status.textContent = 'Role updated.'; await loadUsers(); }
      catch (error) { status.textContent = error.message; select.disabled = false; }
    }));
    list.querySelectorAll('[data-ban]').forEach(button => button.addEventListener('click', async () => {
      const id = Number(button.dataset.ban);
      if (!confirm(`Ban user #${id}? They will be signed out and unable to sign in until unbanned.`)) return;
      button.disabled = true;
      try { await request(`/api/admin/users/${id}/ban`, {method:'POST'}); status.textContent = 'User banned.'; await loadUsers(); }
      catch (error) { status.textContent = error.message; button.disabled = false; }
    }));
    list.querySelectorAll('[data-unban]').forEach(button => button.addEventListener('click', async () => {
      const id = Number(button.dataset.unban); button.disabled = true;
      try { await request(`/api/admin/users/${id}/unban`, {method:'POST'}); status.textContent = 'User unbanned.'; await loadUsers(); }
      catch (error) { status.textContent = error.message; button.disabled = false; }
    }));
  };

  const loadUsers = async () => {
    try { const data = await request('/api/admin/users'); renderUsers(data); if (status && (!status.textContent || status.textContent === 'Loading…')) status.textContent = `${data.users.length} users · owner controls active`; }
    catch (error) { if (status) status.textContent = error.message; if (list) list.innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  };

  const formatExpiry = value => {
    if (!value) return 'No expiration';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  };

  const renderKeys = data => {
    if (!keyList) return;
    const keys = Array.isArray(data.keys) ? data.keys : [];
    keyList.innerHTML = keys.length ? keys.map(key => `<article class="managed-key"><div class="managed-key-main"><div class="managed-key-title"><code>${esc(key.keyPrefix)}••••••••</code>${key.active ? '<span class="active-pill">Active</span>' : '<span class="expired-pill">Expired</span>'}</div><div class="managed-key-meta">User #${esc(key.userId)} · ${esc(key.username)} · ${esc(key.email)} · ${esc(key.product)} · Expires ${esc(formatExpiry(key.expiresAt))}</div></div></article>`).join('') : '<p>No imported keys yet.</p>';
  };

  const loadKeys = async () => {
    try { const data = await request('/api/admin/keys'); renderKeys(data); if (keyStatus && (!keyStatus.textContent || keyStatus.textContent === 'Loading…')) keyStatus.textContent = `${(data.keys || []).length} imported keys`; }
    catch (error) { if (keyStatus) keyStatus.textContent = error.message; if (keyList) keyList.innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  };

  const importKey = async () => {
    const button = document.querySelector('[data-create-owner-key]');
    const duration = document.querySelector('[data-key-duration]')?.value || '3d';
    const product = document.querySelector('[data-key-product]')?.value || 'NoContext External';
    const userValue = document.querySelector('[data-key-user]')?.value || '';
    const userId = userValue ? Number(userValue) : null;
    const input = document.querySelector('[data-key-import-input]');
    const key = input?.value.trim() || '';
    if (!key) {
      if (keyResult) { keyResult.hidden = false; keyResult.innerHTML = '<span class="admin-error">Paste a license key first.</span>'; }
      input?.focus();
      return;
    }
    button.disabled = true;
    try {
      const data = await request('/api/admin/keys', {method:'POST', body:JSON.stringify({key,duration,product,user_id:userId})});
      const target = userId ? users.find(user => Number(user.id) === userId) : null;
      const targetText = target ? ` for #${target.id} · ${target.username}` : ' for your account';
      if (keyResult) {
        keyResult.hidden = false;
        keyResult.innerHTML = `<strong>Key imported: ${esc(data.durationLabel)}${esc(targetText)}</strong><code>${esc(data.key)}</code><button type="button" class="btn btn-outline" data-copy-owner-key>Copy Key</button><small>The license key is stored securely and only its protected identifier is shown later.</small>`;
        keyResult.querySelector('[data-copy-owner-key]')?.addEventListener('click', async event => { try { await navigator.clipboard.writeText(data.key); event.currentTarget.textContent = 'Copied'; } catch { event.currentTarget.textContent = 'Copy failed'; } });
      }
      if (input) input.value = '';
      await loadKeys();
    } catch (error) {
      if (keyResult) { keyResult.hidden = false; keyResult.innerHTML = `<span class="admin-error">${esc(error.message)}</span>`; }
    } finally { button.disabled = false; }
  };

  document.querySelector('[data-create-owner-key]')?.addEventListener('click', importKey);
  ensureProducts();
  setupImportUI();
  loadUsers();
  loadKeys();
  populateUserPicker();
})();