(() => {
  const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
  const userLabels = document.querySelectorAll('[data-account-user]');
  const secondaryUser = document.querySelector('[data-account-user-secondary]');
  const emailLabel = document.querySelector('[data-account-email]');
  const idLabel = document.querySelector('[data-account-id]');
  const expiryLabel = document.querySelector('[data-account-expiry]');
  const avatar = document.querySelector('[data-account-avatar]');
  const logout = document.querySelector('[data-account-logout]');
  const state = document.querySelector('[data-account-state]');
  const loading = document.querySelector('[data-account-loading]');
  const licenseList = document.querySelector('[data-license-list]');
  const licenseGenerate = document.querySelector('[data-license-generate]');
  const licenseMessage = document.querySelector('[data-license-message]');
  const ticketsView = document.querySelector('[data-dashboard-view="tickets"]');
  const DISCORD_INVITE = 'https://discord.gg/GrD3C722nC';

  const readCsrf = () => sessionStorage.getItem('nocontext_csrf') || '';
  const writeCsrf = value => value ? sessionStorage.setItem('nocontext_csrf', value) : sessionStorage.removeItem('nocontext_csrf');
  const clearAuthState = () => {
    sessionStorage.removeItem('nocontext_csrf');
    sessionStorage.removeItem('nocontext_session');
    localStorage.removeItem('nocontext_session_token');
    localStorage.removeItem('nocontext_session');
    localStorage.removeItem('nocontext_csrf');
    localStorage.removeItem('nocontext_remember_me');
  };
  const redirectToLogin = () => { clearAuthState(); location.replace('./login.html'); };

  if (!configured) { redirectToLogin(); return; }

  let csrfToken = readCsrf();
  const request = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(`${configured}${path}`, { ...options, credentials: 'include', cache: 'no-store', headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) redirectToLogin();
      throw new Error(data.detail || `Request failed (${response.status}).`);
    }
    if (data.csrfToken) { csrfToken = data.csrfToken; writeCsrf(csrfToken); }
    return data;
  };

  const formatExpiry = value => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };
  const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const isActiveTicket = ticket => !['closed', 'resolved', 'cancelled'].includes(String(ticket.status || '').toLowerCase());

  const addActiveTicketSummary = tickets => {
    const existing = document.getElementById('active-ticket-summary');
    existing?.remove();
    const active = tickets.filter(isActiveTicket);
    const host = document.querySelector('#tickets') || ticketsView;
    if (!host) return;
    const card = document.createElement('div');
    card.id = 'active-ticket-summary';
    card.className = 'card active-ticket-summary';
    card.style.cssText = 'margin:0 0 18px;padding:20px;border:1px solid rgba(184,255,61,.16);background:rgba(184,255,61,.025)';
    const rows = active.slice(0, 6).map(t => `<button type="button" class="ticket-item active-ticket-item" data-active-ticket-id="${escapeHtml(t.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;margin:8px 0;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.02);color:#fff;cursor:pointer"><span><strong>#${escapeHtml(t.id)} · ${escapeHtml(t.subject)}</strong><small style="display:block;margin-top:5px;color:var(--text-muted)">Updated ${escapeHtml(formatExpiry(t.updatedAt))}</small></span><span style="color:#9ff0b0;text-transform:uppercase;font-size:.67rem;letter-spacing:.08em">${escapeHtml(t.status || 'open')}</span></button>`).join('');
    card.innerHTML = active.length
      ? `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px"><div><span style="font-size:.67rem;text-transform:uppercase;letter-spacing:.11em;color:#7e8984">Support</span><h3 style="margin:.35rem 0">${active.length} active ticket${active.length === 1 ? '' : 's'}</h3><p style="margin:0;color:var(--text-muted);font-size:.84rem">Your open support requests appear here.</p></div><a class="btn btn-outline" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Open Discord Support</a></div><div style="margin-top:12px">${rows}</div>`
      : `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px"><div><span style="font-size:.67rem;text-transform:uppercase;letter-spacing:.11em;color:#7e8984">Support</span><h3 style="margin:.35rem 0">No active tickets</h3><p style="margin:0;color:var(--text-muted);font-size:.84rem">Need help? Open a ticket in the NoContext Discord server.</p></div><a class="btn btn-primary" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Open Discord Support</a></div>`;
    host.parentNode?.insertBefore(card, host);
    card.querySelectorAll('[data-active-ticket-id]').forEach(button => {
      button.addEventListener('click', () => {
        const target = ticketsView?.querySelector(`[data-ticket-id="${CSS.escape(button.dataset.activeTicketId || '')}"]`);
        target?.click();
        document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const renderLicenses = licenses => {
    if (!licenseList) return;
    if (!licenses.length) { licenseList.innerHTML = '<div class="license-empty">No licenses yet.</div>'; return; }
    licenseList.innerHTML = licenses.map(license => {
      const status = String(license.status || 'unknown').toLowerCase();
      return `<div class="license-row"><div><div class="license-key">${escapeHtml(license.keyPrefix)}••••••••</div><div class="license-meta">${escapeHtml(license.product)} · Expires ${escapeHtml(formatExpiry(license.expiresAt))}</div></div><div class="license-status ${escapeHtml(status)}">${escapeHtml(status)}</div></div>`;
    }).join('');
  };

  const loadLicenses = async () => {
    if (!licenseList) return;
    try {
      const data = await request('/api/licenses');
      renderLicenses(Array.isArray(data.licenses) ? data.licenses : []);
    } catch (_) {
      licenseList.innerHTML = '<div class="license-empty">Unable to load licenses.</div>';
    }
  };
  const showLicenseMessage = (message, type = '') => {
    if (!licenseMessage) return;
    licenseMessage.textContent = message;
    licenseMessage.className = `license-message${type ? ` ${type}` : ''}`;
  };

  const renderTickets = async (ticketsOverride = null) => {
    if (!ticketsView) return;
    ticketsView.innerHTML = `<div class="ticket-header"><div><h2 id="tickets-title">Support Tickets</h2><p>Track active support requests from your NoContext account.</p></div><a class="btn btn-primary" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Open Discord Ticket</a></div><div data-ticket-list><div class="ticket-empty"><i class="fas fa-spinner fa-spin"></i><strong>Loading tickets…</strong><span>Checking your support history.</span></div></div>`;
    const list = ticketsView.querySelector('[data-ticket-list]');
    const esc = escapeHtml;
    const openTicket = async id => {
      const data = await request(`/api/tickets/${id}`);
      const t = data.ticket;
      list.innerHTML = `<div class="ticket-header"><div><h2>#${esc(t.id)} · ${esc(t.subject)}</h2><p>${esc(t.status)} · Updated ${esc(formatExpiry(t.updatedAt))}</p></div><button class="btn btn-outline" type="button" data-back-tickets>Back</button></div><div class="license-box" style="margin-bottom:15px">${(data.messages || []).map(m => `<div class="ticket-message" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)"><strong>${esc(m.authorName)}</strong><span style="float:right;color:var(--text-muted);font-size:.72rem">${esc(formatExpiry(m.createdAt))}</span><p style="margin-top:7px;white-space:pre-wrap">${esc(m.body)}</p></div>`).join('')}</div>${isActiveTicket(t) ? `<div class="account-actions"><textarea data-ticket-reply placeholder="Write a reply…" style="width:100%;min-height:100px;background:#0b0d12;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;padding:12px;font:inherit"></textarea><button class="btn btn-primary" data-send-ticket-reply type="button">Send Reply</button></div>` : '<p class="account-note">This ticket is closed.</p>'}`;
      list.querySelector('[data-back-tickets]')?.addEventListener('click', () => renderTickets());
      list.querySelector('[data-send-ticket-reply]')?.addEventListener('click', async e => {
        const box = list.querySelector('[data-ticket-reply]'); const body = box.value.trim(); if (!body) return;
        e.currentTarget.disabled = true;
        try { await request(`/api/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }); await renderTickets(); }
        catch (err) { alert(err.message); e.currentTarget.disabled = false; }
      });
    };
    try {
      const data = ticketsOverride ? { tickets: ticketsOverride } : await request('/api/tickets');
      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      addActiveTicketSummary(tickets);
      const active = tickets.filter(isActiveTicket);
      list.innerHTML = tickets.length
        ? tickets.map(t => `<button class="ticket-item${isActiveTicket(t) ? ' active' : ''}" type="button" data-ticket-id="${esc(t.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;margin:8px 0;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.02);color:#fff;cursor:pointer"><span><strong>#${esc(t.id)} · ${esc(t.subject)}</strong><div style="color:var(--text-muted);font-size:.75rem;margin-top:6px">Updated ${esc(formatExpiry(t.updatedAt))}</div></span><span style="text-transform:uppercase;font-size:.68rem;color:${isActiveTicket(t) ? '#9ff0b0' : '#ff9d9d'}">${esc(t.status)}</span></button>`).join('')
        : '<div class="ticket-empty"><i class="fas fa-ticket"></i><strong>No tickets yet</strong><span>Open a support ticket in the NoContext Discord server to get help.</span></div>';
      list.querySelectorAll('[data-ticket-id]').forEach(button => button.addEventListener('click', () => openTicket(Number(button.dataset.ticketId))));
      if (active.length && tickets.length > active.length) {
        const note = document.createElement('p'); note.className = 'account-note'; note.style.marginTop='12px'; note.textContent = `${tickets.length - active.length} closed ticket${tickets.length - active.length === 1 ? '' : 's'} shown below.`; list.appendChild(note);
      }
    } catch (error) {
      list.innerHTML = `<div class="ticket-empty"><strong>Unable to load tickets</strong><span>${esc(error.message)}</span></div>`;
    }
  };

  (async () => {
    try {
      const data = await request('/api/auth/me');
      if (!data.authenticated || !data.user) { redirectToLogin(); return; }
      csrfToken = data.csrfToken || csrfToken;
      writeCsrf(csrfToken);
      const username = String(data.user.username || 'User');
      userLabels.forEach(node => node.textContent = username);
      if (secondaryUser) secondaryUser.textContent = username;
      if (emailLabel) emailLabel.textContent = data.user.email || '—';
      if (idLabel) idLabel.textContent = String(data.user.id ?? '—');
      if (expiryLabel) expiryLabel.textContent = formatExpiry(data.sessionExpiresAt);
      if (avatar) avatar.textContent = username.slice(0, 2).toUpperCase();
      if (state) state.textContent = 'Signed in';
      if (Number(data.user.id) === 1) {
        const sidebar = document.querySelector('[data-dashboard-sidebar]');
        if (sidebar && !sidebar.querySelector('[data-admin-link]')) {
          const link = document.createElement('a'); link.className = 'account-sidebar-link'; link.href = 'admin-dashboard.html'; link.dataset.adminLink = 'true';
          link.innerHTML = '<i class="fas fa-shield-halved"></i><span>Admin</span>'; sidebar.appendChild(link);
        }
      }
      loading?.classList.add('hidden');
      await loadLicenses();
      await renderTickets();
    } catch (error) {
      if (loading) loading.classList.add('hidden');
      if (state) { state.textContent = error instanceof Error ? error.message : 'Unable to verify session.'; state.classList.add('account-error'); }
      setTimeout(redirectToLogin, 900);
    }
  })();

  licenseGenerate?.addEventListener('click', async () => {
    licenseGenerate.disabled = true; showLicenseMessage('Generating license…');
    try {
      const data = await request('/api/licenses/generate', { method: 'POST', body: JSON.stringify({ product: 'NoContext External' }) });
      const key = String(data.key || ''); showLicenseMessage(`Your new key: ${key} — copy it now.`, 'success');
      try { await navigator.clipboard.writeText(key); } catch (_) {}
      await loadLicenses();
    } catch (error) { showLicenseMessage(error instanceof Error ? error.message : 'Unable to generate license.', 'error'); }
    finally { licenseGenerate.disabled = false; }
  });

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await request('/api/auth/logout', { method: 'POST' }); clearAuthState(); location.replace('./login.html'); }
    catch (error) { if (state) { state.textContent = error instanceof Error ? error.message : 'Unable to sign out.'; state.classList.add('account-error'); } logout.disabled = false; }
  });
})();

(() => {
  const addDeveloperLink = () => {
    const sidebar = document.querySelector('[data-dashboard-sidebar]');
    if (!sidebar || sidebar.querySelector('[data-developer-api-link]')) return;
    const link = document.createElement('a'); link.className = 'account-sidebar-link'; link.href = 'developer-api'; link.dataset.developerApiLink = 'true';
    link.innerHTML = '<i class="fas fa-code"></i><span>Developer API</span>'; sidebar.appendChild(link);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addDeveloperLink, { once: true }); else addDeveloperLink();
})();
