const PRODUCT_CONFIG = Object.freeze({
    external: Object.freeze({ name: 'NoContext External', product: 'NoContext External' }),
    executor: Object.freeze({ name: 'NoContext Executor', product: 'NoContext Executor' })
});

let selectedProduct = 'NoContext External';
let isBooster = false;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const discordResult = params.get('discord');
    if (discordResult) {
        window.history.replaceState({}, document.title, 'key.html');
        if (discordResult === 'not_boosting') {
            const note = document.getElementById('booster-note');
            if (note) note.textContent = 'That Discord account is not currently boosting the configured server.';
        }
    }

    showState('loading');
    try {
        const session = await ApiService.getKeySession();
        isBooster = Boolean(session.booster);
        if (session.active) {
            document.getElementById('existing-copy').innerText = `Your current key expires ${formatExpiry(session.expiresAt)}. You cannot generate another key until it expires.`;
            showState('existing');
            return;
        }
        const accountCopy = document.getElementById('account-copy');
        if (accountCopy) accountCopy.innerText = isBooster
            ? 'Your Discord boost is verified. You can generate one 7-day free key at a time.'
            : 'You can generate one 3-day free key at a time. Boost the configured Discord server and verify your account to get 7-day keys.';
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
    document.getElementById('duration-copy').innerText = isBooster
        ? 'Verified Discord boosters receive a 7-day key. You can generate another after it expires.'
        : 'Standard users receive a 3-day key. You can generate another after it expires.';
    const discordButton = document.getElementById('discord-btn');
    discordButton.href = ApiService.discordVerifyUrl();
    discordButton.innerText = isBooster ? 'Discord Boost Verified' : 'Verify Discord Boost for 7 Days';
    discordButton.style.pointerEvents = isBooster ? 'none' : 'auto';
    discordButton.style.opacity = isBooster ? '.6' : '1';
    document.getElementById('generate-btn').innerText = isBooster ? 'Generate 7-Day Key' : 'Generate 3-Day Key';
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
