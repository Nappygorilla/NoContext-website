(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  const root = document.querySelector('[data-user-management]');
  const list = document.querySelector('[data-managed-users]');
  const status = document.querySelector('[data-user-management-status]');
  const keyResult = document.querySelector('[data-owner-key-result]');
  const keyList = document.querySelector('[data-managed-keys]');
  const keyStatus = document.querySelector('[data-key-management-status]');
  const csrf = () => localStorage.getItem('nocontext_csrf') || sessionStorage.getItem('nocontext_csrf') || '';
  const sessionToken = () => localStorage.getItem('nocontext_session_token') || '';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const request = async (path, options = {}) => {
    const headers = {'Content-Type':'application/json', ...(csrf() ? {'X-CSRF-Token':csrf()} : {}), ...(sessionToken() ? {Authorization:`Bearer ${sessionToken()}`} : {}), ...(options.headers || {})};
    const response = await fetch(`${api}${path}`, {...options, headers, credentials:'include', cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  };

  let users = [];

  const renderUsers = data => {
    users = Array.isArray(data.users) ? data.users : [];
    list.innerHTML = users.length ? users.map(user => {
      const protectedUser = Number(user.id) === 1;
      return `<article class="managed-user ${user.banned ? 'is-banned' : ''}"><div class="managed-user-main"><div class="managed-user-title"><strong>#${esc(user.id)} · ${esc(user.username)}</strong><span class="role-pill">${esc(user.role)}</span>${user.banned ? '<span class="ban-pill">BANNED</span>' : ''}</div><div class="managed-user-meta">${esc(user.email)} · Joined ${esc(new Date(user.createdAt).toLocaleDateString())}</div></div><div class="managed-user-actions"><label>Role<select data-role="${esc(user.id)}" ${protectedUser ? 'disabled' : ''}>${data.roles.map(role => `<option value="${esc(role)}" ${role === user.role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label>${protectedUser ? '<span class="protected-note">Primary owner</span>' : user.banned ? `<button class="btn btn-outline" type="button" data-unban="${esc(user.id)}">Unban</button>` : `<button class="btn btn-outline danger-btn" type="button" data-ban="${esc(user.id)}">Ban</button>`}</div></article>`;
    }).join('') : '<p>No registered users.</p>';
    populateUserPicker();
    list.querySelectorAll('[data-role]').forEach(select => select.addEventListener('change', async () => { const id=Number(select.dataset.role); select.disabled=true; try { await request(`/api/admin/users/${id}/role`,{method:'POST',body:JSON.stringify({role:select.value})}); status.textContent='Role updated.'; await loadUsers(); } catch(error){status.textContent=error.message;select.disabled=false;} }));
    list.querySelectorAll('[data-ban]').forEach(button => button.addEventListener('click', async () => { const id=Number(button.dataset.ban); if(!confirm(`Ban user #${id}? They will be signed out and unable to sign in until unbanned.`))return; button.disabled=true; try{await request(`/api/admin/users/${id}/ban`,{method:'POST'});status.textContent='User banned.';await loadUsers();}catch(error){status.textContent=error.message;button.disabled=false;} }));
    list.querySelectorAll('[data-unban]').forEach(button => button.addEventListener('click', async () => { const id=Number(button.dataset.unban);button.disabled=true;try{await request(`/api/admin/users/${id}/unban`,{method:'POST'});status.textContent='User unbanned.';await loadUsers();}catch(error){status.textContent=error.message;button.disabled=false;}}));
  };

  const populateUserPicker = () => {
    const picker = document.querySelector('[data-key-user]');
    if (!picker) return;
    const selected = picker.value;
    picker.innerHTML = `<option value="">Your account</option>` + users.map(user => `<option value="${esc(user.id)}">#${esc(user.id)} · ${esc(user.username)}</option>`).join('');
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
    if (!button) return;
    const form = button.parentElement;
    const section = form?.parentElement;
    const heading = section?.querySelector('h2');
    const description = section?.querySelector(':scope > p');
    if (heading) heading.textContent = 'Import Key';
    if (description) description.textContent = 'Paste a license key, choose a duration, and assign it to a registered account.';
    button.textContent = 'Import Key';

    let wrapper = document.querySelector('.key-import-panel') || document.querySelector('.keyauth-import-panel');
    let keyInput = wrapper?.querySelector('[data-key-import-input], [data-keyauth-import-input]') || null;
    if (!wrapper) {
      wrapper = document.createElement('div');
      form?.insertBefore(wrapper, form.querySelector('[data-key-duration]')?.parentElement || button);
    }
    wrapper.className = 'key-import-panel';
    wrapper.style.cssText = 'display:block !important;width:100% !important;flex:1 0 100% !important;margin:0 0 12px !important;';
    wrapper.innerHTML = `<label class="key-import-label" style="display:block;width:100%;margin:0"><span style="display:block;margin-bottom:7px;color:#aab2ae;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em">License key</span><input data-key-import-input type="text" autocomplete="off" spellcheck="false" placeholder="Paste license key" style="display:block!important;width:100%!important;min-width:0!important;height:56px!important;min-height:56px!important;box-sizing:border-box!important;padding:14px 16px!important;border-radius:10px!important;font:inherit!important;font-size:16px!important;line-height:1.4!important;background:#0b0d12!important;border:1px solid rgba(190,255,70,.22)!important;color:#fff!important"></label>`;
    keyInput = wrapper.querySelector('[data-key-import-input]');

    const durationSelect = document.querySelector('[data-key-duration]');
    if (!durationSelect || document.querySelector('[data-key-duration-options]')) return;
    durationSelect.style.display = 'none';

    const group = document.createElement('div');
    group.dataset.keyDurationOptions = 'true';
    group.style.cssText = 'width:100%;margin:4px 0 12px;';
    group.innerHTML = `<span style="display:block;margin:0 0 7px;color:#aab2ae;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em">Duration</span><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;width:100%"><button type="button" data-duration="3d" style="min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left"><strong style="display:block;font-size:.88rem">3 Days</strong><span style="display:block;margin-top:4px;color:#8f9894;font-size:.72rem">3 days of access</span></button><button type="button" data-duration="7d" style="min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left"><strong style="display:block;font-size:.88rem">1 Week</strong><span style="display:block;margin-top:4px;color:#8f9894;font-size:.72rem">7 days of access</span></button><button type="button" data-duration="lifetime" style="min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left"><strong style="display:block;font-size:.88rem">Lifetime</strong><span style="display:block;margin-top:4px;color:#8f9894;font-size:.72rem">No expiration</span></button></div>`;
    durationSelect.parentElement?.insertBefore(group, durationSelect);

    const setDuration = value => {
      durationSelect.value = value;
      group.querySelectorAll('[data-duration]').forEach(option => {
        const active = option.dataset.duration === value;
        option.style.borderColor = active ? 'rgba(190,255,70,.5)' : 'rgba(255,255,255,.1)';
        option.style.background = active ? 'rgba(190,255,70,.08)' : 'rgba(255,255,255,.03)';
      });
    };
    group.querySelectorAll('[data-duration]').forEach(option => option.addEventListener('click', () => setDuration(option.dataset.duration)));
    setDuration(durationSelect.value || '3d');
  };

  const loadUsers = async () => { try { const data=await request('/api/admin/users'); renderUsers(data); if(!status.textContent || status.textContent==='Loading…') status.textContent=`${data.users.length} users · owner controls active`; } catch(error){status.textContent=error.message;list.innerHTML=`<p class="admin-error">${esc(error.message)}</p>`;} };

  const formatExpiry = value => {
    if (!value) return 'No expiration';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  };

  const renderKeys = data => {
    const keys = Array.isArray(data.keys) ? data.keys : [];
    keyList.innerHTML = keys.length ? keys.map(key => `<article class="managed-key"><div class="managed-key-main"><div class="managed-key-title"><code>${esc(key.keyPrefix)}••••••••</code>${key.active ? '<span class="active-pill">Active</span>' : '<span class="expired-pill">Expired</span>'}</div><div class="managed-key-meta">User #${esc(key.userId)} · ${esc(key.username)} · ${esc(key.email)} · ${esc(key.product)} · Expires ${esc(formatExpiry(key.expiresAt))}</div></div></article>`).join('') : '<p>No imported keys yet.</p>';
  };

  const loadKeys = async () => { try { const data=await request('/api/admin/keys'); renderKeys(data); if(!keyStatus.textContent || keyStatus.textContent==='Loading…') keyStatus.textContent=`${(data.keys||[]).length} imported keys`; } catch(error){keyStatus.textContent=error.message;keyList.innerHTML=`<p class="admin-error">${esc(error.message)}</p>`;} };

  document.querySelector('[data-create-owner-key]')?.addEventListener('click', async () => {
    const button=document.querySelector('[data-create-owner-key]');
    const duration=document.querySelector('[data-key-duration]')?.value || '3d';
    const product=document.querySelector('[data-key-product]')?.value || 'NoContext External';
    const userValue=document.querySelector('[data-key-user]')?.value || '';
    const userId=userValue ? Number(userValue) : null;
    const keyInput=document.querySelector('[data-key-import-input]');
    const key=keyInput?.value.trim() || '';
    if (!key) {
      keyResult.hidden=false;
      keyResult.innerHTML='<span class="admin-error">Paste a license key first.</span>';
      keyInput?.focus();
      return;
    }
    button.disabled=true;
    try {
      const data=await request('/api/admin/keys',{method:'POST',body:JSON.stringify({key,duration,product,user_id:userId})});
      const target = userId ? users.find(user => Number(user.id)===userId) : null;
      const targetText = target ? ` for #${target.id} · ${target.username}` : ' for your account';
      keyResult.hidden=false;
      keyResult.innerHTML=`<strong>Key imported: ${esc(data.durationLabel)}${esc(targetText)}</strong><code>${esc(data.key)}</code><button type="button" class="btn btn-outline" data-copy-owner-key>Copy Key</button><small>The license key is stored securely and only its protected identifier is shown later.</small>`;
      keyResult.querySelector('[data-copy-owner-key]').addEventListener('click',async e=>{await navigator.clipboard.writeText(data.key);e.currentTarget.textContent='Copied';});
      keyInput.value='';
      await loadKeys();
    } catch(error){keyResult.hidden=false;keyResult.innerHTML=`<span class="admin-error">${esc(error.message)}</span>`;}
    finally{button.disabled=false;}
  });

  ensureProducts();
  setupImportUI();
  if(root) loadUsers();
  if(keyList) loadKeys();
  populateUserPicker();
})();