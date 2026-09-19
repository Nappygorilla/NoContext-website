const PRODUCTS = Object.freeze({
    external: Object.freeze({
        name: "luna.win External",
        description: "A professional-grade external tool designed for Roblox. luna.win External operates outside of the game process.",
        price: "FREE",
        buttonText: "Download",
        downloadUrl: "https://raw.githubusercontent.com/Nappygorilla/Cheat/main/nocontext.exe",
        comingSoon: false,
        uiImage: null,
        features: Object.freeze([
            Object.freeze({ icon: "fa-shield-halved", title: "External", desc: "Runs as a standalone Windows application." }),
            Object.freeze({ icon: "fa-bolt", title: "Lightweight", desc: "Designed to stay lightweight while running alongside Roblox." }),
            Object.freeze({ icon: "fa-mouse-pointer", title: "Auto-Clicker", desc: "Highly customizable clicking speeds and patterns." }),
            Object.freeze({ icon: "fa-crosshairs", title: "Visual Assists", desc: "Clean overlays and visual tools." }),
            Object.freeze({ icon: "fa-gear", title: "Custom Presets", desc: "Save and load your favorite configurations instantly." })
        ])
    }),
    executor: Object.freeze({
        name: "luna.win Executor",
        description: "The luna.win Executor is currently in development.",
        price: "COMING SOON",
        buttonText: "Coming Soon",
        comingSoon: true,
        uiImage: null,
        features: Object.freeze([
            Object.freeze({ icon: "fa-code", title: "Script Execution", desc: "Planned script execution environment." }),
            Object.freeze({ icon: "fa-microchip", title: "Custom API", desc: "A custom API is planned for the release." }),
            Object.freeze({ icon: "fa-folder-open", title: "Script Hub", desc: "A built-in script hub is planned." }),
            Object.freeze({ icon: "fa-gauge-high", title: "Fast", desc: "Designed for a fast and responsive experience." }),
            Object.freeze({ icon: "fa-life-ring", title: "Multi-Version", desc: "Compatibility details will be announced with release." })
        ])
    })
});

const API_BASE = String(window.NO_CONTEXT_API_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');

document.addEventListener('DOMContentLoaded', () => {
    const productId = new URLSearchParams(window.location.search).get('id');
    if (productId && Object.prototype.hasOwnProperty.call(PRODUCTS, productId)) {
        renderProduct(PRODUCTS[productId], productId);
    } else {
        window.location.replace('roblox.html');
    }
});

async function loadLiveStatus(id, product) {
    try {
        const response = await fetch(`${API_BASE}/api/cheats/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const live = await response.json();
        const badge = document.getElementById('product-badge');
        const btn = document.getElementById('get-key-btn');
        if (badge && live.status) badge.innerText = live.status.replace('_', ' ').toUpperCase();
        const blocked = ['offline', 'updating', 'maintenance', 'coming_soon'].includes(live.status);
        if (btn && blocked) {
            btn.href = '#';
            btn.removeAttribute('download');
            btn.removeAttribute('target');
            btn.removeAttribute('rel');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.innerText = live.status === 'coming_soon' ? 'Coming Soon' : 'Unavailable';
        } else if (btn && product.downloadUrl) {
            btn.href = product.downloadUrl;
            btn.setAttribute('download', 'luna.win-External.exe');
            btn.style.opacity = '';
            btn.style.cursor = '';
            btn.innerText = product.buttonText;
        }
        const note = document.getElementById('product-desc');
        if (note && live.note) note.insertAdjacentHTML('afterend', `<p data-live-note style="color:var(--text-muted);font-size:.82rem;margin-top:8px"></p>`), document.querySelector('[data-live-note]').innerText = live.note;
        if (live.version) document.title = `${product.name} v${live.version} | luna.win`;
    } catch (_) {
        // Keep the static product page usable if the API is temporarily unavailable.
    }
}

function renderProduct(product, id) {
    document.title = `${product.name} | luna.win`;
    document.getElementById('product-title').innerText = product.name;
    document.getElementById('product-desc').innerText = product.description;

    const btn = document.getElementById('get-key-btn');
    btn.innerText = product.buttonText;

    if (product.comingSoon) {
        btn.href = "#";
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.removeAttribute('download');
        btn.removeAttribute('target');
        btn.removeAttribute('rel');
        document.getElementById('product-badge').innerText = "COMING SOON";
        document.getElementById('product-badge').style.background = "var(--text-muted)";
    } else if (product.downloadUrl) {
        btn.href = product.downloadUrl;
        btn.setAttribute('download', 'luna.win-External.exe');
        btn.removeAttribute('target');
        btn.removeAttribute('rel');
        document.getElementById('product-badge').innerText = product.price;
    } else {
        btn.href = `key.html?product=${encodeURIComponent(id)}`;
        btn.removeAttribute('download');
        btn.removeAttribute('target');
        btn.removeAttribute('rel');
        document.getElementById('product-badge').innerText = product.price;
    }

    const featureContainer = document.getElementById('feature-list');
    featureContainer.replaceChildren();
    product.features.forEach(f => {
        const item = document.createElement('div'); item.className = 'feature-item-detailed';
        const icon = document.createElement('i'); icon.className = `fas ${f.icon}`;
        const title = document.createElement('h3'); title.innerText = f.title;
        const desc = document.createElement('p'); desc.style.cssText = 'color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;'; desc.innerText = f.desc;
        item.append(icon, title, desc); featureContainer.appendChild(item);
    });

    if (product.uiImage) {
        const container = document.getElementById('product-ui-container'); container.replaceChildren();
        const image = document.createElement('img'); image.src = product.uiImage; image.alt = `${product.name} UI`; container.appendChild(image);
    }
    loadLiveStatus(id, product);
}
