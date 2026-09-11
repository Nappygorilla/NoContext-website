const PRODUCT_CONFIG = Object.freeze({
    external: Object.freeze({ name: 'NoContext External', url: 'https://work.ink/external-link' }),
    executor: Object.freeze({ name: 'NoContext Executor', url: 'https://work.ink/executor-link' })
});

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const productParam = urlParams.get('product');

    if (token) {
        window.history.replaceState({}, document.title, 'key.html');
        showState('loading');
        try {
            const response = await ApiService.claimFreeKey(token);
            if (response.success && typeof response.key === 'string') {
                document.getElementById('generated-key').innerText = response.key;
                showState('success');
            } else {
                showError('Verification failed.');
            }
        } catch (err) {
            showError('Free-key verification is temporarily unavailable. Please try again later.');
        }
    } else if (productParam && PRODUCT_CONFIG[productParam]) {
        selectProduct(productParam);
    } else {
        showState('selection');
    }
});

function selectProduct(type) {
    const config = PRODUCT_CONFIG[type];
    if (!config) return;
    document.getElementById('product-title').innerText = config.name;
    document.getElementById('product-name').innerText = config.name;
    const workinkLink = document.getElementById('workink-link');
    workinkLink.href = config.url;
    workinkLink.rel = 'noopener noreferrer';
    showState('ready');
}

function showState(state) {
    document.getElementById('selection-state').style.display = 'none';
    document.getElementById('ready-state').style.display = 'none';
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('success-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById(`${state}-state`).style.display = 'block';
}

function showError(msg) {
    document.getElementById('error-message').innerText = msg;
    showState('error');
}

function copyKey(btn) {
    const key = document.getElementById('generated-key').innerText;
    copyToClipboard(key, btn);
}
