(() => {
    const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
    const form = document.querySelector('.auth-form');
    if (!form) return;
    const submit = form.querySelector('.auth-submit');
    const originalText = submit?.textContent || 'Continue';
    const isRegister = location.pathname.toLowerCase().endsWith('register.html');

    const readCsrf = () => localStorage.getItem('nocontext_csrf') || sessionStorage.getItem('nocontext_csrf') || '';
    const writeCsrf = (value) => {
        if (value) { localStorage.setItem('nocontext_csrf', value); sessionStorage.setItem('nocontext_csrf', value); }
        else { localStorage.removeItem('nocontext_csrf'); sessionStorage.removeItem('nocontext_csrf'); }
    };
    const writeSession = (value) => {
        if (value) { localStorage.setItem('nocontext_session_token', value); localStorage.setItem('nocontext_session', '1'); }
        else { localStorage.removeItem('nocontext_session_token'); localStorage.removeItem('nocontext_session'); }
    };
    const clearSession = () => { localStorage.removeItem('nocontext_session_token'); localStorage.removeItem('nocontext_session'); localStorage.removeItem('nocontext_csrf'); sessionStorage.removeItem('nocontext_session'); sessionStorage.removeItem('nocontext_csrf'); };

    let csrfToken = readCsrf();
    const setStatus = (message, kind = 'error') => {
        let node = form.querySelector('.auth-status');
        if (!node) { node = document.createElement('p'); node.className = 'auth-status'; node.setAttribute('role', 'status'); form.appendChild(node); }
        node.textContent = message;
        node.dataset.kind = kind;
    };

    const api = async (path, options = {}) => {
        if (!configured) throw new Error('Authentication backend is not configured yet.');
        const token = localStorage.getItem('nocontext_session_token') || '';
        const headers = { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
        const response = await fetch(`${configured}${path}`, { ...options, credentials: 'include', headers, cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Something went wrong. Please try again.');
        return data;
    };

    const discordButton = document.createElement('a');
    discordButton.href = `${configured}/api/auth/discord/start`;
    discordButton.className = 'btn btn-outline';
    discordButton.style.cssText = 'width:100%;display:flex;justify-content:center;align-items:center;gap:9px;margin-top:12px';
    discordButton.innerHTML = '<i class="fab fa-discord"></i> Continue with Discord';
    if (!isRegister) {
        submit?.insertAdjacentElement('afterend', discordButton);
    }

    const discordSession = new URLSearchParams(location.hash.replace(/^#/, '?')).get('discord-session');
    if (discordSession && !isRegister) {
        writeSession(discordSession);
        history.replaceState(null, document.title, location.pathname + location.search);
        (async () => {
            try {
                const result = await api('/api/auth/me');
                if (!result.authenticated || !result.csrfToken) throw new Error('Discord session could not be verified.');
                csrfToken = result.csrfToken;
                writeCsrf(csrfToken);
                localStorage.setItem('nocontext_session', '1');
                window.location.replace('./account-dashboard.html?auth=discord');
            } catch (error) {
                clearSession();
                setStatus(error instanceof Error ? error.message : 'Unable to complete Discord login.');
            }
        })();
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!submit) return;
        if (isRegister) {
            const password = form.querySelector('#password')?.value || '';
            const confirm = form.querySelector('#confirm')?.value || '';
            if (password !== confirm) { setStatus('Passwords do not match.'); return; }
        }
        submit.disabled = true;
        submit.textContent = isRegister ? 'Creating account…' : 'Signing in…';
        setStatus('');
        try {
            const payload = isRegister
                ? { username: form.querySelector('#username')?.value.trim(), email: form.querySelector('#email')?.value.trim(), password: form.querySelector('#password')?.value || '' }
                : { email: form.querySelector('#email')?.value.trim(), password: form.querySelector('#password')?.value || '' };
            const result = await api(isRegister ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
            csrfToken = result.csrfToken || '';
            writeCsrf(csrfToken);
            writeSession(result.sessionToken || '');
            sessionStorage.setItem('nocontext_session', '1');
            if (!csrfToken || !result.sessionToken) throw new Error('The server did not return a usable account session.');
            setStatus('Success. Redirecting…', 'success');
            window.location.assign('./account-dashboard.html?auth=' + Date.now());
        } catch (error) {
            clearSession();
            setStatus(error instanceof Error ? error.message : 'Unable to authenticate.');
            submit.disabled = false;
            submit.textContent = originalText;
        }
    });
})();
