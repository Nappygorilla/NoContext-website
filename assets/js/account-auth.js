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

    const readStore = (key) => sessionStorage.getItem(key) || localStorage.getItem(key) || '';
    const writeStore = (key, value) => { if (value) { sessionStorage.setItem(key, value); localStorage.setItem(key, value); } };
    const clearStore = (key) => { sessionStorage.removeItem(key); localStorage.removeItem(key); };
    const redirectToLogin = () => { clearStore('nocontext_csrf'); clearStore('nocontext_session'); location.replace('./login.html'); };
    if (!configured) { redirectToLogin(); return; }

    let csrfToken = readStore('nocontext_csrf');
    let sessionToken = readStore('nocontext_session');
    const request = async (path, options = {}) => {
        const response = await fetch(`${configured}${path}`, {
            ...options, credentials:'include', cache:'no-store',
            headers:{'Content-Type':'application/json', ...(sessionToken ? {Authorization:`Bearer ${sessionToken}`} : {}), ...(csrfToken ? {'X-CSRF-Token':csrfToken} : {}), ...(options.headers || {})}
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `Request failed (${response.status}).`);
        return data;
    };
    const formatExpiry = (value) => { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };
    const escapeHtml = (value) => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

    const renderLicenses = (licenses) => {
        if (!licenseList) return;
        if (!licenses.length) { licenseList.innerHTML='<div class="license-empty">No licenses yet.</div>'; return; }
        licenseList.innerHTML=licenses.map(license=>{ const status=String(license.status||'unknown').toLowerCase(); return `<div class="license-row"><div><div class="license-key">${escapeHtml(license.keyPrefix)}••••••••</div><div class="license-meta">${escapeHtml(license.product)} · Expires ${escapeHtml(formatExpiry(license.expiresAt))}</div></div><div class="license-status ${escapeHtml(status)}">${escapeHtml(status)}</div></div>`; }).join('');
    };
    const loadLicenses = async () => { if (!licenseList) return; try { const data=await request('/api/licenses'); renderLicenses(Array.isArray(data.licenses)?data.licenses:[]); } catch (_) { licenseList.innerHTML='<div class="license-empty">Unable to load licenses.</div>'; } };
    const showLicenseMessage = (message,type='') => { if (!licenseMessage) return; licenseMessage.textContent=message; licenseMessage.className=`license-message${type?` ${type}`:''}`; };

    const renderTickets = async () => {
        if (!ticketsView) return;
        ticketsView.innerHTML = `<div class="ticket-header"><div><h2 id="tickets-title">Support Tickets</h2><p>Create and manage support requests for your NoContext account.</p></div><button class="btn btn-primary" type="button" data-new-ticket>New Ticket</button></div><div data-ticket-list><div class="ticket-empty"><i class="fas fa-spinner fa-spin"></i><strong>Loading tickets…</strong><span>Checking your support history.</span></div></div>`;
        const list = ticketsView.querySelector('[data-ticket-list]');
        const esc = escapeHtml;
        const openTicket = async id => {
            const data = await request(`/api/tickets/${id}`);
            const t=data.ticket;
            list.innerHTML=`<div class="ticket-header"><div><h2>#${esc(t.id)} · ${esc(t.subject)}</h2><p>${esc(t.status)} · Updated ${esc(formatExpiry(t.updatedAt))}</p></div><button class="btn btn-outline" type="button" data-back-tickets>Back</button></div><div class="license-box" style="margin-bottom:15px">${(data.messages||[]).map(m=>`<div class="ticket-message" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)"><strong>${esc(m.authorName)}</strong><span style="float:right;color:var(--text-muted);font-size:.72rem">${esc(formatExpiry(m.createdAt))}</span><p style="margin-top:7px;white-space:pre-wrap">${esc(m.body)}</p></div>`).join('')}</div>${t.status==='closed'?'<p class="account-note">This ticket is closed.</p>':'<div class="account-actions"><textarea data-ticket-reply placeholder="Write a reply…" style="width:100%;min-height:100px;background:#0b0d12;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;padding:12px;font:inherit"></textarea><button class="btn btn-primary" data-send-ticket-reply type="button">Send Reply</button></div>'}`;
            list.querySelector('[data-back-tickets]')?.addEventListener('click', renderTickets);
            list.querySelector('[data-send-ticket-reply]')?.addEventListener('click', async e=>{ const box=list.querySelector('[data-ticket-reply]'); const body=box.value.trim(); if(!body)return; e.currentTarget.disabled=true; try{await request(`/api/tickets/${id}/messages`,{method:'POST',body:JSON.stringify({body})}); await openTicket(id);}catch(err){alert(err.message);e.currentTarget.disabled=false;} });
        };
        try {
            const data=await request('/api/tickets');
            const tickets=Array.isArray(data.tickets)?data.tickets:[];
            list.innerHTML=tickets.length?tickets.map(t=>`<button class="ticket-item" type="button" data-ticket-id="${esc(t.id)}" style="display:block;width:100%;text-align:left;margin:8px 0;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.02);color:#fff;cursor:pointer"><strong>#${esc(t.id)} · ${esc(t.subject)}</strong><span style="float:right;text-transform:uppercase;font-size:.68rem;color:${t.status==='closed'?'#ff9d9d':'#9ff0b0'}">${esc(t.status)}</span><div style="color:var(--text-muted);font-size:.75rem;margin-top:6px">Updated ${esc(formatExpiry(t.updatedAt))}</div></button>`).join(''):'<div class="ticket-empty"><i class="fas fa-ticket"></i><strong>No tickets yet</strong><span>Open a ticket and the conversation will stay attached to your account.</span></div>';
            list.querySelectorAll('[data-ticket-id]').forEach(button=>button.addEventListener('click',()=>openTicket(Number(button.dataset.ticketId))));
        } catch (error) { list.innerHTML=`<div class="ticket-empty"><strong>Unable to load tickets</strong><span>${esc(error.message)}</span></div>`; }
        ticketsView.querySelector('[data-new-ticket]')?.addEventListener('click',()=>{
            list.innerHTML=`<div class="ticket-header"><div><h2>New Ticket</h2><p>Tell support what you need help with.</p></div><button class="btn btn-outline" type="button" data-cancel-ticket>Cancel</button></div><div class="account-actions" style="display:grid;gap:10px"><input data-ticket-subject maxlength="120" placeholder="Subject" style="background:#0b0d12;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;padding:12px;font:inherit"><textarea data-ticket-body maxlength="4000" placeholder="Describe the issue…" style="min-height:150px;background:#0b0d12;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;padding:12px;font:inherit"></textarea><button class="btn btn-primary" type="button" data-create-ticket>Create Ticket</button><p data-ticket-message class="license-message"></p></div>`;
            list.querySelector('[data-cancel-ticket]').onclick=renderTickets;
            list.querySelector('[data-create-ticket]').onclick=async e=>{ const subject=list.querySelector('[data-ticket-subject]').value.trim(); const body=list.querySelector('[data-ticket-body]').value.trim(); const msg=list.querySelector('[data-ticket-message]'); if(subject.length<3||!body){msg.textContent='Enter a subject and message.';msg.className='license-message error';return;} e.currentTarget.disabled=true; try{const created=await request('/api/tickets',{method:'POST',body:JSON.stringify({subject,body})}); await openTicket(created.id);}catch(err){msg.textContent=err.message;msg.className='license-message error';e.currentTarget.disabled=false;} };
        });
    };

    (async()=>{ try {
        if(!sessionToken) throw new Error('No saved login session was found.');
        const data=await request('/api/auth/me');
        if(!data.authenticated||!data.user){redirectToLogin();return;}
        csrfToken=data.csrfToken||csrfToken; if(csrfToken)writeStore('nocontext_csrf',csrfToken);
        const username=String(data.user.username||'User'); userLabels.forEach(node=>node.textContent=username); if(secondaryUser)secondaryUser.textContent=username; if(emailLabel)emailLabel.textContent=data.user.email||'—'; if(idLabel)idLabel.textContent=String(data.user.id??'—'); if(expiryLabel)expiryLabel.textContent=formatExpiry(data.sessionExpiresAt); if(avatar)avatar.textContent=username.slice(0,2).toUpperCase(); if(state)state.textContent='Signed in';
        if(Number(data.user.id)===1){ const sidebar=document.querySelector('[data-dashboard-sidebar]'); if(sidebar&&!sidebar.querySelector('[data-admin-link]')){ const link=document.createElement('a'); link.className='account-sidebar-link'; link.href='admin-dashboard.html'; link.dataset.adminLink='true'; link.innerHTML='<i class="fas fa-shield-halved"></i><span>Admin</span>'; sidebar.appendChild(link); } }
        loading?.classList.add('hidden'); await loadLicenses(); await renderTickets();
    } catch(error) { if(loading)loading.classList.add('hidden'); if(state){state.textContent=error instanceof Error?error.message:'Unable to verify session.';state.classList.add('account-error');} setTimeout(()=>{if(sessionToken)return;redirectToLogin();},900); }})();

    licenseGenerate?.addEventListener('click',async()=>{ licenseGenerate.disabled=true; showLicenseMessage('Generating license…'); try{const data=await request('/api/licenses/generate',{method:'POST',body:JSON.stringify({product:'NoContext External'})});const key=String(data.key||'');showLicenseMessage(`Your new key: ${key} — copy it now.`,'success');try{await navigator.clipboard.writeText(key);}catch(_){} await loadLicenses();}catch(error){showLicenseMessage(error instanceof Error?error.message:'Unable to generate license.','error');}finally{licenseGenerate.disabled=false;} });
    logout?.addEventListener('click',async()=>{logout.disabled=true;try{await request('/api/auth/logout',{method:'POST'});clearStore('nocontext_csrf');clearStore('nocontext_session');location.replace('./login.html');}catch(error){if(state){state.textContent=error instanceof Error?error.message:'Unable to sign out.';state.classList.add('account-error');}logout.disabled=false;}});
})();
