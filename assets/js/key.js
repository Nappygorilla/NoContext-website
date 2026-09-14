const PRODUCT_CONFIG = Object.freeze({
    external: Object.freeze({ name: 'NoContext External', product: 'NoContext External' }),
    executor: Object.freeze({ name: 'NoContext Executor', product: 'NoContext Executor' })
});

let selectedProduct = 'NoContext External';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const booster = params.get('booster');
    if (booster) window.history.replaceState({}, document.title, 'key.html');

    showState('loading');
    try {
        const session = await ApiService.getKeySession();
        if (session.active) {
            document.getElementById('existing-copy').innerText = `Your current key expires ${formatExpiry(session.expiresAt)}. You cannot generate another key until it expires.`;
            showState('existing');
            return;
        }
        showState('selection');
    } catch (err) {
        showError(err instanceof Error ? err.message : 'Unable to connect to the key server.');
    }
});

function selectProduct(type) {
    const config = PRODUCT_CONFIG[type];
    if (!config) return;
    selectedProduct = config.product;
    document.getElementById('product-title').innerText = config.name;
    document.getElementById('duration-copy').innerText = 'Standard free keys last 3 days. Verified Discord boosters receive 7 days.';
    const discordButton = document.getElementById('discord-btn');
    discordButton.href = ApiService.discordVerifyUrl();
    discordButton.innerText = 'Verify Discord Boost for 7 Days';
    document.getElementById('generate-btn').innerText = 'Generate 3-Day Key';
    showState('ready');
}

async function generateKey() {
    const button = document.getElementById('generate-btn');
    button.disabled = true;
    try {
        const response = await ApiService.claimFreeKey(selectedProduct);
        document.getElementById('generated-key').innerText = response.key;
        document.getElementById('success-copy').innerText = response.booster
            ? `Your verified-booster key lasts 7 days and expires ${formatExpiry(response.expiresAt)}.`
            : `Your free key lasts 3 days and expires ${formatExpiry(response.expiresAt)}.`;
        showState('success');
    } catch (err) {
        if (err instanceof Error && /already have an active key/i.test(err.message)) {
            document.getElementById('existing-copy').innerText = err.message;
            showState('existing');
        } else {
            showError(err instanceof Error ? err.message : 'Unable to generate a key.');
        }
    } finally {
        button.disabled = false;
    }
}

function formatExpiry(value) {
    if (!value) return 'an unknown time';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'an unknown time' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function showState(state) {
    ['selection', 'ready', 'loading', 'success', 'existing', 'error'].forEach((name) => {
        const node = document.getElementById(`${name}-state`);
        if (node) node.style.display = name === state ? 'block' : 'none';
    });
}

function showError(msg) {
    document.getElementById('error-message').innerText = msg;
    showState('error');
}

function copyKey(btn) {
    const key = document.getElementById('generated-key').innerText;
    copyToClipboard(key, btn);
}
