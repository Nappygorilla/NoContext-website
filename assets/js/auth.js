(() => {
    const configured = String(window.NO_CONTEXT_API_URL || '').trim().replace(/\/$/, '');
    const form = document.querySelector('.auth-form');
    if (!form) return;

    const submit = form.querySelector('.auth-submit');
    const originalText = submit?.textContent || 'Continue';
    const isRegister = location.pathname.toLowerCase().endsWith('register.html');
    const firstField = form.querySelector('input:not([type="checkbox"])');

    // CSRF is short-lived page/session state. Never persist the session token in browser storage.
    const readCsrf = () => sessionStorage.getItem('nocontext_csrf') || '';
    const writeCsrf = value => {
        if (value) sessionStorage.setItem('nocontext_csrf', value);
        else sessionStorage.removeItem('nocontext_csrf');
    };
    const clearSession = () => {
        sessionStorage.removeItem('nocontext_session');
        sessionStorage.removeItem('nocontext_csrf');
        localStorage.removeItem('nocontext_session_token');
        localStorage.removeItem('nocontext_session');
    };

    let csrfToken = readCsrf();
    let requestInFlight = false;

    const setStatus = (message, kind = 'error') => {
        let node = form.querySelector('.auth-status');
        if (!node) {
            node = document.createElement('p');
            node.className = 'auth-status';
            node.setAttribute('role', 'status');
            node.setAttribute('aria-live', 'polite');
            form.appendChild(node);
        }
        node.textContent = message;
        node.dataset.kind = kind;
    };

    const api = async (path, options = {}) => {
        if (!configured) throw new Error('Authentication backend is not configured yet.');
        const headers = {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            ...(options.headers || {})
        };
        const response = await fetch(`${configured}${path}`, {
            ...options,
            credentials: 'include',
            headers,
            cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Something went wrong. Please try again.');
        return data;
    };

    // Start waking the API while the user is reading/filling the form. This hides most cold-start latency.
    if (configured) {
        const wake = () => fetch(`${configured}/api/health`, {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store'
        }).catch(() => {});
        if ('requestIdleCallback' in window) requestIdleCallback(wake, { timeout: 900 });
        else setTimeout(wake, 150);
    }

    // Native browser validation gives instant feedback without a server round-trip.
    form.setAttribute('novalidate', 'false');
    firstField?.focus({ preventScroll: true });

    const password = form.querySelector('#password');
    if (password) {
        const wrap = password.parentElement;
        wrap?.classList.add('password-field');
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'password-toggle';
        toggle.setAttribute('aria-label', 'Show password');
        toggle.textContent = 'Show';
        wrap?.appendChild(toggle);
        toggle.addEventListener('click', () => {
            const visible = password.type === 'text';
            password.type = visible ? 'password' : 'text';
            toggle.textContent = visible ? 'Show' : 'Hide';
            toggle.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
        });
    }

    const discordButton = document.createElement('a');
    discordButton.href = `${configured}/api/auth/discord/start`;
    discordButton.className = 'btn btn-outline auth-discord';
    discordButton.innerHTML = '<i class="fab fa-discord" aria-hidden="true"></i> Continue with Discord';
    if (!isRegister) submit?.insertAdjacentElement('afterend', discordButton);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!submit || requestInFlight) return;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (isRegister) {
            const pass = form.querySelector('#password')?.value || '';
            const confirm = form.querySelector('#confirm')?.value || '';
            if (pass !== confirm) {
                form.querySelector('#confirm')?.focus();
                setStatus('Passwords do not match.');
                return;
            }
        }

        requestInFlight = true;
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        submit.textContent = isRegister ? 'Creating account…' : 'Signing in…';
        setStatus('');

        try {
            const payload = isRegister
                ? {
                    username: form.querySelector('#username')?.value.trim(),
                    email: form.querySelector('#email')?.value.trim(),
                    password: form.querySelector('#password')?.value || ''
                }
                : {
                    email: form.querySelector('#email')?.value.trim(),
                    password: form.querySelector('#password')?.value || ''
                };

            const result = await api(isRegister ? '/api/auth/register' : '/api/auth/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            csrfToken = result.csrfToken || '';
            writeCsrf(csrfToken);
            // The authenticated session is the HttpOnly cookie set by the server.
            sessionStorage.setItem('nocontext_session', '1');

            if (!csrfToken) throw new Error('The server did not return a usable account session.');
            setStatus('Success. Redirecting…', 'success');
            window.location.replace('./account-dashboard.html');
        } catch (error) {
            clearSession();
            setStatus(error instanceof Error ? error.message : 'Unable to authenticate.');
            requestInFlight = false;
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
            submit.textContent = originalText;
        }
    });
})();
