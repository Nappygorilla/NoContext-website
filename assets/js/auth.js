(() => {
  const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
  const form = document.querySelector('.auth-form');
  if (!form) return;
  const submit = form.querySelector('.auth-submit');
  const originalText = submit?.textContent || 'Continue';
  const isRegister = location.pathname.toLowerCase().endsWith('register.html');
  const readCsrf = () => sessionStorage.getItem('nocontext_csrf') || '';
  const writeCsrf = value => value ? sessionStorage.setItem('nocontext_csrf', value) : sessionStorage.removeItem('nocontext_csrf');
  const clearLegacy = () => { sessionStorage.removeItem('nocontext_session'); sessionStorage.removeItem('nocontext_csrf'); localStorage.removeItem('nocontext_session_token'); localStorage.removeItem('nocontext_session'); localStorage.removeItem('nocontext_csrf'); };
  let csrfToken = readCsrf();
  let requestInFlight = false;
  const setStatus = (message, kind = 'error') => {
    let node = form.querySelector('.auth-status');
    if (!node) { node = document.createElement('p'); node.className = 'auth-status'; node.setAttribute('role','status'); node.setAttribute('aria-live','polite'); form.appendChild(node); }
    node.textContent = message; node.dataset.kind = kind;
  };
  const api = async (path, options = {}) => {
    if (!configured) throw new Error('Authentication backend is not configured yet.');
    const headers = { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(options.headers || {}) };
    const response = await fetch(`${configured}${path}`, { ...options, credentials: 'include', headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Something went wrong. Please try again.');
    return data;
  };
  if (!isRegister && !form.querySelector('[data-remember-row]')) {
    const row = document.createElement('label');
    row.dataset.rememberRow = 'true';
    row.style.cssText = 'display:flex;align-items:center;gap:9px;margin:-3px 0 2px;color:#aab2ae;font-size:.82rem;cursor:pointer;user-select:none';
    row.innerHTML = '<input id="remember-me" name="remember_me" type="checkbox" style="width:18px;height:18px;accent-color:#b8ff3d;cursor:pointer"><span>Remember me</span>';
    row.querySelector('input').checked = localStorage.getItem('nocontext_remember_me') === '1';
    form.querySelector('#password')?.parentElement?.insertAdjacentElement('afterend', row);
  }
  form.removeAttribute('novalidate');
  const password = form.querySelector('#password');
  if (password && !password.parentElement?.querySelector('.password-toggle')) {
    const wrap = password.parentElement; wrap?.classList.add('password-field');
    const toggle = document.createElement('button'); toggle.type='button'; toggle.className='password-toggle'; toggle.setAttribute('aria-label','Show password'); toggle.textContent='Show'; wrap?.appendChild(toggle);
    toggle.addEventListener('click', () => { const visible = password.type === 'text'; password.type = visible ? 'password' : 'text'; toggle.textContent = visible ? 'Show' : 'Hide'; toggle.setAttribute('aria-label', visible ? 'Show password' : 'Hide password'); });
  }
  if (!form.querySelector('.auth-discord') && !isRegister) {
    const discordButton = document.createElement('a'); discordButton.href = `${configured}/api/auth/discord/start`; discordButton.className='btn btn-outline auth-discord'; discordButton.innerHTML='<i class="fab fa-discord" aria-hidden="true"></i> Continue with Discord'; submit?.insertAdjacentElement('afterend', discordButton);
  }
  const remembered = localStorage.getItem('nocontext_remember_me') === '1';
  if (!isRegister && remembered && configured) {
    api('/api/auth/me').then(result => {
      if (result.authenticated && result.user) {
        csrfToken = result.csrfToken || csrfToken; writeCsrf(csrfToken); window.location.replace('./account-dashboard.html');
      } else {
        localStorage.removeItem('nocontext_remember_me');
        form.querySelector('#email')?.focus({ preventScroll:true });
      }
    }).catch(() => form.querySelector('#email')?.focus({ preventScroll:true }));
  } else form.querySelector('#email')?.focus({ preventScroll:true });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!submit || requestInFlight) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (isRegister) {
      const pass=form.querySelector('#password')?.value||''; const confirm=form.querySelector('#confirm')?.value||'';
      if (pass!==confirm) { form.querySelector('#confirm')?.focus(); setStatus('Passwords do not match.'); return; }
    }
    requestInFlight=true; submit.disabled=true; submit.setAttribute('aria-busy','true'); submit.textContent=isRegister?'Creating account…':'Signing in…'; setStatus('');
    try {
      const payload=isRegister ? {username:form.querySelector('#username')?.value.trim(),email:form.querySelector('#email')?.value.trim(),password:form.querySelector('#password')?.value||''} : {email:form.querySelector('#email')?.value.trim(),password:form.querySelector('#password')?.value||''};
      const result=await api(isRegister?'/api/auth/register':'/api/auth/login',{method:'POST',body:JSON.stringify(payload)});
      csrfToken=result.csrfToken||''; writeCsrf(csrfToken);
      if (!csrfToken) throw new Error('The server did not return a usable account session.');
      if (!isRegister) {
        if (form.querySelector('#remember-me')?.checked) localStorage.setItem('nocontext_remember_me','1');
        else localStorage.removeItem('nocontext_remember_me');
      }
      setStatus('Success. Redirecting…','success'); window.location.replace('./account-dashboard.html');
    } catch(error) {
      clearLegacy(); if (!isRegister) localStorage.removeItem('nocontext_remember_me');
      setStatus(error instanceof Error?error.message:'Unable to authenticate.'); requestInFlight=false; submit.disabled=false; submit.removeAttribute('aria-busy'); submit.textContent=originalText;
    }
  });
})();
