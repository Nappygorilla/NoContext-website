(() => {
  const api = String(window.NO_CONTEXT_API_URL || '').replace(/\/$/, '');
  const loading = document.querySelector('[data-admin-loading]');
  const usersEl = document.querySelector('[data-users]');
  const detail = document.querySelector('[data-ticket-detail]');
  const empty = document.querySelector('[data-detail-empty]');
  const readCsrf = () => sessionStorage.getItem('nocontext_csrf') || '';
  const clearAuthState = () => sessionStorage.removeItem('nocontext_csrf');
  let csrf = readCsrf();
  let selectedId = null;

  const request = async (path, options = {}) => {
    const headers = {'Content-Type':'application/json', ...(csrf ? {'X-CSRF-Token':csrf} : {}), ...(options.headers || {})};
    const res = await fetch(`${api}${path}`, {...options, headers, credentials:'include', cache:'no-store'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  };
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };
  const logout = () => { clearAuthState(); location.replace('./login.html'); };

  const loadTicket = async id => {
    selectedId = id;
    try {
      const data = await request(`/api/admin/tickets/${id}`);
      empty.classList.add('hidden'); detail.classList.remove('hidden');
      const t = data.ticket;
      detail.innerHTML = `<div class="detail-top"><div><div class="kicker">Ticket #${esc(t.id)}</div><h2>${esc(t.subject)}</h2><p style="margin-top:6px">User ID ${esc(t.userId)} · ${esc(t.status)} · Updated ${esc(fmt(t.updatedAt))}</p></div>${t.status === 'closed' ? '' : '<button class="btn btn-outline" type="button" data-close-ticket>Close Ticket</button>'}</div><div class="messages">${(data.messages || []).map(m => `<article class="message ${m.source === 'admin' || m.source === 'discord' ? 'staff' : ''}"><div class="message-head"><strong>${esc(m.authorName)} · ${esc(m.source)}</strong><span>${esc(fmt(m.createdAt))}</span></div><div class="message-body">${esc(m.body)}</div></article>`).join('')}</div>${t.status === 'closed' ? '<p>Ticket is closed.</p>' : '<div class="reply-box"><textarea data-reply placeholder="Reply to the customer…"></textarea><button class="btn btn-primary" type="button" data-send-reply>Send</button></div>'}`;
      detail.querySelector('[data-send-reply]')?.addEventListener('click', async () => {
        const button = detail.querySelector('[data-send-reply]'); const box = detail.querySelector('[data-reply]'); const body = box.value.trim();
        if (!body) return;
        button.disabled = true;
        try { await request(`/api/admin/tickets/${id}/messages`, {method:'POST', body:JSON.stringify({body})}); await loadTicket(id); } catch(e) { alert(e.message); button.disabled=false; }
      });
      detail.querySelector('[data-close-ticket]')?.addEventListener('click', async () => {
        if (!confirm('Close this ticket?')) return;
        try { await request(`/api/admin/tickets/${id}/close`, {method:'POST'}); await refresh(); await loadTicket(id); } catch(e) { alert(e.message); }
      });
    } catch (e) { detail.classList.remove('hidden'); empty.classList.add('hidden'); detail.innerHTML = `<p class="admin-error">${esc(e.message)}</p>`; }
  };

  const refresh = async () => {
    const data = await request('/api/admin');
    if (!data.ownerId) throw new Error('Owner access is not configured.');
    document.querySelector('[data-stat-users]').textContent = data.users.length;
    document.querySelector('[data-stat-open]').textContent = data.tickets.filter(t => t.status !== 'closed').length;
    document.querySelector('[data-stat-total]').textContent = data.tickets.length;
    usersEl.innerHTML = data.users.length ? data.users.map(u => `<div class="user-row"><strong>#${esc(u.id)} · ${esc(u.username)}</strong><span>${esc(u.email)}</span></div>`).join('') : '<p>No users yet.</p>';
    const list = document.createElement('div'); list.className='ticket-list';
    const ticketTitle = document.createElement('h2'); ticketTitle.textContent='Tickets'; usersEl.after(ticketTitle, list);
    data.tickets.forEach(t => { const b=document.createElement('button'); b.className=`ticket-item ${selectedId===t.id?'active':''}`; b.innerHTML=`<span class="status ${t.status==='closed'?'closed':''}">${esc(t.status)}</span><strong>#${esc(t.id)} · ${esc(t.subject)}</strong><small>User ${esc(t.userId)} · ${esc(fmt(t.updatedAt))}</small>`; b.onclick=()=>{document.querySelectorAll('.ticket-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');loadTicket(t.id)}; list.appendChild(b); });
  };

  (async () => {
    try {
      const me = await request('/api/auth/me');
      if (!me.authenticated || !me.user) throw new Error('Not signed in.');
      csrf = me.csrfToken || csrf;
      if (csrf) sessionStorage.setItem('nocontext_csrf', csrf);
      if (Number(me.user.id) !== 1) throw new Error('Owner access required.');
      await refresh();
      const controls = document.createElement('script');
      controls.src = `assets/js/admin-cheats.js?v=${Date.now()}`;
      document.body.appendChild(controls);
      loading.classList.add('hidden');
    } catch (e) {
      loading.textContent = e.message || 'Access denied.';
      setTimeout(logout, 1000);
    }
  })();
})();