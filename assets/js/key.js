const PRODUCT_CONFIG = {
    external: {
        name: 'NoContext External',
        url: 'https://work.ink/external-link'
    },
    executor: {
        name: 'NoContext Executor',
        url: 'https://work.ink/executor-link'
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const productParam = urlParams.get('product');

    if (token) {
        showState('loading');

        try {
            const response = await ApiService.claimFreeKey(token);
            if (response.success) {
                document.getElementById('generated-key').innerText = response.key;
                showState('success');
            } else {
                showError(response.message || 'Verification failed.');
            }
        } catch (err) {
            showError(err.message);
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
    document.getElementById('workink-link').href = config.url;

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
