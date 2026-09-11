(() => {
    const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
    let csrfToken = sessionStorage.getItem('nocontext_csrf') || '';

    const form = document.querySelector('.auth-form');
    if (!form) return;

    const submit = form.querySelector('.auth-submit');
    const originalText = submit?.textContent || 'Continue';
    const isRegister = location.pathname.toLowerCase().endsWith('register.html');

    const setStatus = (message, kind = 'error') => {
        let node = form.querySelector('.auth-status');
        if (!node) {
            node = document.createElement('p');
            node.className = 'auth-status';
            node.setAttribute('role', 'status');
            form.appendChild(node);
        }
        node.textContent = message;
        node.dataset.kind = kind;
    };

    const api = async (path, options = {}) => {
        if (!configured) throw new Error('Authentication backend is not configured yet.');
        const response = await fetch(`${configured}${path}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
                ...(options.headers || {})
            }
        });
        let data = {};
        try { data = await response.json(); } catch {}
        if (!response.ok) throw new Error(data.detail || 'Something went wrong. Please try again.');
        return data;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!submit) return;

        if (isRegister) {
            const password = form.querySelector('#password')?.value || '';
            const confirm = form.querySelector('#confirm')?.value || '';
            if (password !== confirm) {
                setStatus('Passwords do not match.');
                return;
            }
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
            if (csrfToken) sessionStorage.setItem('nocontext_csrf', csrfToken);
            setStatus('Success. Redirecting…', 'success');
            window.location.assign('account.html');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to authenticate.');
            submit.disabled = false;
            submit.textContent = originalText;
        }
    });
})();
