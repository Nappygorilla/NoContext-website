(() => {
  const api = String(window.LUNA_API_URL || '').replace(/\/$/, '');
  const loading = document.querySelector('[data-admin-loading]');
  const usersEl = document.querySelector('[data-users]');
  const detail = document.querySelector('[data-ticket-detail]');
  const empty = document.querySelector('[data-detail-empty]');
  const readCsrf = () => sessionStorage.getItem('luna_csrf') || '';
  const clearAuthState = () => sessionStorage.removeItem('luna_csrf');
  let csrf = readCsrf();
  let selectedId = null;

  const showError = message => {
    if (!loading) return;
    loading.textContent = message || 'Unable to load the owner dashboard.';
  };

  const request = async (path, options = {}) => {
    if (!api) throw new Error('Authentication backend is not configured.');
    const headers = {'Content-Type':'application/json', ...(csrf ? {'X-CSRF-Token':csrf} : {}), ...(options.headers || {})};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${api}${path}`, {...options, headers, credentials:'include', cache:'no-store', signal:controller.signal});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('The luna.win API did not respond. Please try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };
  const logout = () => { clearAuthState(); location.replace('./login.html'); };

  const loadMediaApplications = async () => {
    const host = document.querySelector("[data-media-applications]");
    const status = document.querySelector("[data-media-management-status]");
    if (!host) return;
    try {
      const data = await request("/api/admin/media/applications");
      const apps = Array.isArray(data.applications) ? data.applications : [];
      if (status) status.textContent = `${apps.filter(a => a.status === "pending").length} pending`;
      if (!apps.length) { host.innerHTML = "<p>No Media Team applications yet.</p>"; return; }
      host.innerHTML = apps.map(app => `<article class="managed-user" data-media-app-id="${esc(app.id)}" style="align-items:flex-start"><div style="min-width:0"><div class="managed-user-title"><strong>#${esc(app.id)} · ${esc(app.username)}</strong><span class="role-pill">${esc(app.status)}</span></div><div class="managed-user-meta">${esc(app.email)} · ${esc(app.role)} · ${esc(fmt(app.createdAt))}</div><details style="margin-top:10px"><summary style="cursor:pointer;color:#fff">View application</summary><div style="margin-top:12px;color:#c8c8c8;font-size:.8rem;line-height:1.6"><p><strong>Experience</strong><br>${esc(app.experience || "—")}</p><p style="margin-top:10px"><strong>Portfolio</strong><br>${app.portfolio ? `<a href="${esc(app.portfolio)}" target="_blank" rel="noopener noreferrer">${esc(app.portfolio)}</a>` : "—"}</p><p style="margin-top:10px"><strong>Social</strong><br>${esc(app.social || "—")}</p><p style="margin-top:10px"><strong>Availability</strong><br>${esc(app.availability || "—")}</p><p style="margin-top:10px"><strong>Why join</strong><br>${esc(app.whyJoin || "—")}</p>${app.reviewNote ? `<p style="margin-top:10px"><strong>Review note</strong><br>${esc(app.reviewNote)}</p>` : ""}</div></details></div><div class="managed-user-actions">${app.status === "pending" ? `<button class="btn btn-primary" type="button" data-media-approve>Approve</button><button class="btn btn-outline danger-btn" type="button" data-media-reject>Reject</button>` : `<button class="btn btn-outline" type="button" data-media-pending>Reopen</button>`}</div></article>`).join("");
      host.querySelectorAll("[data-media-app-id]").forEach(card => {
        const id = Number(card.dataset.mediaAppId);
        const review = async statusValue => {
          const note = prompt(statusValue === "approved" ? "Optional note for the applicant:" : "Reason for rejecting this application:") ?? "";
          try { await request(`/api/admin/media/applications/${id}`, { method:"POST", body:JSON.stringify({status:statusValue,review_note:note}) }); await loadMediaApplications(); }
          catch (error) { alert(error.message || "Unable to review application."); }
        };
        card.querySelector("[data-media-approve]")?.addEventListener("click", () => review("approved"));
        card.querySelector("[data-media-reject]")?.addEventListener("click", () => review("rejected"));
        card.querySelector("[data-media-pending]")?.addEventListener("click", () => review("pending"));
      });
    } catch (error) {
      if (status) status.textContent = "Unavailable";
      host.innerHTML = `<p class="admin-error">${esc(error.message || "Unable to load Media Team applications.")}</p>`;
    }
  };
  const renderDashboard = data => {
    document.querySelector('[data-stat-users]').textContent = data.users.length;
    document.querySelector('[data-stat-open]').textContent = data.tickets.filter(t => t.status !== 'closed').length;
    document.querySelector('[data-stat-total]').textContent = data.tickets.length;
    usersEl.innerHTML = data.users.length ? data.users.map(u => `<div class="user-row"><strong>#${esc(u.id)} · ${esc(u.username)}</strong><span>${esc(u.email)}</span></div>`).join('') : '<p>No users yet.</p>';
    const oldTitle = document.querySelector('[data-admin-ticket-title]');
    const oldList = document.querySelector('[data-admin-ticket-list]');
    oldTitle?.remove();
    oldList?.remove();
    const ticketTitle = document.createElement('h2');
    ticketTitle.textContent = 'Tickets';
    ticketTitle.dataset.adminTicketTitle = 'true';
    ticketTitle.id = 'tickets';
    const list = document.createElement('div');
    list.className = 'ticket-list';
    list.dataset.adminTicketList = 'true';
    usersEl.after(ticketTitle, list);
    data.tickets.forEach(t => {
      const b = document.createElement('button');
      b.className = `ticket-item ${selectedId === t.id ? 'active' : ''}`;
      b.innerHTML = `<span class="status ${t.status === 'closed' ? 'closed' : ''}">${esc(t.status)}</span><strong>#${esc(t.id)} · ${esc(t.subject)}</strong><small>User ${esc(t.userId)} · ${esc(fmt(t.updatedAt))}</small>`;
      b.onclick = () => { document.querySelectorAll('.ticket-item').forEach(x => x.classList.remove('active')); b.classList.add('active'); loadTicket(t.id); };
      list.appendChild(b);
    });
  };

  const loadTicket = async id => {
    selectedId = id;
    try {
      const data = await request(`/api/admin/tickets/${id}`);
      empty.classList.add('hidden');
      detail.classList.remove('hidden');
      const t = data.ticket;
      detail.innerHTML = `<div class="detail-top"><div><div class="kicker">Ticket #${esc(t.id)}</div><h2>${esc(t.subject)}</h2><p style="margin-top:6px">User ID ${esc(t.userId)} · ${esc(t.status)} · Updated ${esc(fmt(t.updatedAt))}</p></div>${t.status === 'closed' ? '' : '<button class="btn btn-outline" type="button" data-close-ticket>Close Ticket</button>'}</div><div class="messages">${(data.messages || []).map(m => `<article class="message ${m.source === 'admin' || m.source === 'discord' ? 'staff' : ''}"><div class="message-head"><strong>${esc(m.authorName)} · ${esc(m.source)}</strong><span>${esc(fmt(m.createdAt))}</span></div><div class="message-body">${esc(m.body)}</div></article>`).join('')}</div>${t.status === 'closed' ? '<p>Ticket is closed.</p>' : '<div class="reply-box"><textarea data-reply placeholder="Reply to the customer…"></textarea><button class="btn btn-primary" type="button" data-send-reply>Send</button></div>'}`;
      detail.querySelector('[data-send-reply]')?.addEventListener('click', async () => {
        const button = detail.querySelector('[data-send-reply]');
        const box = detail.querySelector('[data-reply]');
        const body = box.value.trim();
        if (!body) return;
        button.disabled = true;
        try { await request(`/api/admin/tickets/${id}/messages`, {method:'POST', body:JSON.stringify({body})}); await loadTicket(id); } catch(e) { alert(e.message); button.disabled=false; }
      });
      detail.querySelector('[data-close-ticket]')?.addEventListener('click', async () => {
        if (!confirm('Close this ticket?')) return;
        try { await request(`/api/admin/tickets/${id}/close`, {method:'POST'}); await refresh(); await loadTicket(id); } catch(e) { alert(e.message); }
      });
    } catch (e) {
      detail.classList.remove('hidden');
      empty.classList.add('hidden');
      detail.innerHTML = `<p class="admin-error">${esc(e.message)}</p>`;
    }
  };

  const refresh = async () => {
    const data = await request('/api/admin');
    renderDashboard(data);
  };

  (async () => {
    try {
      // The backend is the owner authority. User ID 1 is the owner.
      // Do not perform a separate client-side owner verification that can leave the loader stuck.
      const ownerData = await request('/api/admin');
      if (!ownerData || !Array.isArray(ownerData.users) || !Array.isArray(ownerData.tickets)) {
        throw new Error('The owner dashboard returned an invalid response.');
      }
      csrf = ownerData.csrfToken || csrf;
      if (csrf) sessionStorage.setItem('luna_csrf', csrf);

      const controls = document.createElement('script');
      controls.src = `assets/js/admin-cheats.js?v=${Date.now()}`;
      document.body.appendChild(controls);
      renderDashboard(ownerData);
      loadMediaApplications();
      loading?.classList.add('hidden');
    } catch (e) {
      showError(e.message || 'Owner access could not be loaded.');
      setTimeout(logout, 2500);
    }
  })();
})();
