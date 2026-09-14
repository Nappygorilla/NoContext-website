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

  const loadUsers = async () => { try { const data=await request('/api/admin/users'); renderUsers(data); if(!status.textContent || status.textContent==='Loading…') status.textContent=`${data.users.length} users · owner controls active`; } catch(error){status.textContent=error.message;list.innerHTML=`<p class="admin-error">${esc(error.message)}</p>`;} };

  const formatExpiry = value => {
    if (!value) return 'No expiration';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  };

  const renderKeys = data => {
    const keys = Array.isArray(data.keys) ? data.keys : [];
    keyList.innerHTML = keys.length ? keys.map(key => `<article class="managed-key"><div class="managed-key-main"><div class="managed-key-title"><code>${esc(key.keyPrefix)}••••••••</code>${key.active ? '<span class="active-pill">Active</span>' : '<span class="expired-pill">Expired</span>'}</div><div class="managed-key-meta">User #${esc(key.userId)} · ${esc(key.username)} · ${esc(key.email)} · ${esc(key.product)} · Expires ${esc(formatExpiry(key.expiresAt))}</div></div><div class="managed-key-actions"><input type="number" min="1" max="3650" value="7" data-extend-days="${esc(key.id)}" aria-label="Days to add"><button class="btn btn-outline" type="button" data-extend-key="${esc(key.id)}">Add Days</button></div></article>`).join('') : '<p>No keys have been created yet.</p>';
    keyList.querySelectorAll('[data-extend-key]').forEach(button => button.addEventListener('click', async () => {
      const id = Number(button.dataset.extendKey);
      const input = keyList.querySelector(`[data-extend-days="${id}"]`);
      const days = Number(input?.value || 0);
      if (!Number.isInteger(days) || days < 1 || days > 3650) { keyStatus.textContent = 'Enter between 1 and 3650 days.'; return; }
      button.disabled = true;
      try { await request(`/api/admin/keys/${id}/extend`, {method:'POST', body:JSON.stringify({days})}); keyStatus.textContent=`Added ${days} day${days===1?'':'s'} to key #${id}.`; await loadKeys(); }
      catch(error) { keyStatus.textContent=error.message; }
      finally { button.disabled=false; }
    }));
  };

  const loadKeys = async () => { try { const data=await request('/api/admin/keys'); renderKeys(data); if(!keyStatus.textContent || keyStatus.textContent==='Loading…') keyStatus.textContent=`${(data.keys||[]).length} keys`; } catch(error){keyStatus.textContent=error.message;keyList.innerHTML=`<p class="admin-error">${esc(error.message)}</p>`;} };

  document.querySelector('[data-create-owner-key]')?.addEventListener('click', async () => {
    const button=document.querySelector('[data-create-owner-key]');
    const duration=document.querySelector('[data-key-duration]')?.value;
    const product=document.querySelector('[data-key-product]')?.value || 'NoContext External';
    const userValue=document.querySelector('[data-key-user]')?.value || '';
    const userId=userValue ? Number(userValue) : null;
    button.disabled=true;
    try {
      const data=await request('/api/admin/keys',{method:'POST',body:JSON.stringify({duration,product,user_id:userId})});
      const target = userId ? users.find(user => Number(user.id)===userId) : null;
      const targetText = target ? ` for #${target.id} · ${target.username}` : ' for your account';
      keyResult.hidden=false;
      keyResult.innerHTML=`<strong>Created: ${esc(data.durationLabel)}${esc(targetText)}</strong><code>${esc(data.key)}</code><button type="button" class="btn btn-outline" data-copy-owner-key>Copy Key</button><small>Save this key now. The plaintext key is returned only at creation.</small>`;
      keyResult.querySelector('[data-copy-owner-key]').addEventListener('click',async e=>{await navigator.clipboard.writeText(data.key);e.currentTarget.textContent='Copied';});
      await loadKeys();
    } catch(error){keyResult.hidden=false;keyResult.innerHTML=`<span class="admin-error">${esc(error.message)}</span>`;}
    finally{button.disabled=false;}
  });

  if(root) loadUsers();
  if(keyList) loadKeys();
  populateUserPicker();
})();
