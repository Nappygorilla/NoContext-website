(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  const root = document.querySelector('[data-user-management]');
  const list = document.querySelector('[data-managed-users]');
  const status = document.querySelector('[data-user-management-status]');
  const csrf = () => sessionStorage.getItem('nocontext_csrf') || '';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const request = async (path, options = {}) => {
    const headers = {'Content-Type':'application/json', ...(csrf() ? {'X-CSRF-Token':csrf()} : {}), ...(options.headers || {})};
    const response = await fetch(`${api}${path}`, {...options, headers, credentials:'include', cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  };

  const render = data => {
    list.innerHTML = data.users.length ? data.users.map(user => {
      const protectedUser = Number(user.id) === 1;
      return `<article class="managed-user ${user.banned ? 'is-banned' : ''}">
        <div class="managed-user-main">
          <div class="managed-user-title"><strong>#${esc(user.id)} · ${esc(user.username)}</strong><span class="role-pill">${esc(user.role)}</span>${user.banned ? '<span class="ban-pill">BANNED</span>' : ''}</div>
          <div class="managed-user-meta">${esc(user.email)} · Joined ${esc(new Date(user.createdAt).toLocaleDateString())}</div>
        </div>
        <div class="managed-user-actions">
          <label>Role<select data-role="${esc(user.id)}" ${protectedUser ? 'disabled' : ''}>${data.roles.map(role => `<option value="${esc(role)}" ${role === user.role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label>
          ${protectedUser ? '<span class="protected-note">Primary owner</span>' : user.banned ? `<button class="btn btn-outline" type="button" data-unban="${esc(user.id)}">Unban</button>` : `<button class="btn btn-outline danger-btn" type="button" data-ban="${esc(user.id)}">Ban</button>`}
        </div>
      </article>`;
    }).join('') : '<p>No registered users.</p>';

    list.querySelectorAll('[data-role]').forEach(select => select.addEventListener('change', async () => {
      const id = Number(select.dataset.role);
      const previous = select.value;
      select.disabled = true;
      try {
        await request(`/api/admin/users/${id}/role`, {method:'POST', body:JSON.stringify({role:select.value})});
        status.textContent = 'Role updated.';
        await load();
      } catch (error) { select.value = previous; status.textContent = error.message; select.disabled = false; }
    }));
    list.querySelectorAll('[data-ban]').forEach(button => button.addEventListener('click', async () => {
      const id = Number(button.dataset.ban);
      if (!confirm(`Ban user #${id}? They will be signed out and unable to sign in until unbanned.`)) return;
      button.disabled = true;
      try { await request(`/api/admin/users/${id}/ban`, {method:'POST'}); status.textContent = 'User banned.'; await load(); }
      catch (error) { status.textContent = error.message; button.disabled = false; }
    }));
    list.querySelectorAll('[data-unban]').forEach(button => button.addEventListener('click', async () => {
      const id = Number(button.dataset.unban);
      button.disabled = true;
      try { await request(`/api/admin/users/${id}/unban`, {method:'POST'}); status.textContent = 'User unbanned.'; await load(); }
      catch (error) { status.textContent = error.message; button.disabled = false; }
    }));
  };

  const load = async () => {
    try { const data = await request('/api/admin/users'); render(data); if (!status.textContent) status.textContent = `${data.users.length} users · owner controls active`; }
    catch (error) { status.textContent = error.message; list.innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  };

  if (root) load();
})();
