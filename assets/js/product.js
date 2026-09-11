const PRODUCTS = Object.freeze({
    external: Object.freeze({
        name: "NoContext External",
        description: "A professional-grade external tool designed for Roblox. NoContext External operates outside of the game process, making it completely undetectable by standard anti-cheats. Perfect for players who prioritize safety and account longevity.",
        price: "FREE",
        buttonText: "Download",
        comingSoon: false,
        uiImage: null,
        features: Object.freeze([
            Object.freeze({ icon: "fa-shield-halved", title: "Undetectable", desc: "Operates 100% externally from the game process." }),
            Object.freeze({ icon: "fa-bolt", title: "Lightweight", desc: "Zero performance impact on your gameplay." }),
            Object.freeze({ icon: "fa-mouse-pointer", title: "Auto-Clicker", desc: "Highly customizable clicking speeds and patterns." }),
            Object.freeze({ icon: "fa-crosshairs", title: "Visual Assists", desc: "Clean overlays that don't flicker or lag." }),
            Object.freeze({ icon: "fa-gear", title: "Custom Presets", desc: "Save and load your favorite configurations instantly." })
        ])
    }),
    executor: Object.freeze({
        name: "NoContext Executor",
        description: "The most powerful script execution environment for Roblox. NoContext Executor features a high-performance custom API, Level 7 execution capabilities, and a built-in script hub with thousands of community scripts.",
        price: "COMING SOON",
        buttonText: "Coming Soon",
        comingSoon: true,
        uiImage: null,
        features: Object.freeze([
            Object.freeze({ icon: "fa-code", title: "Level 7 Execution", desc: "Run even the most complex scripts with ease." }),
            Object.freeze({ icon: "fa-microchip", title: "Custom API", desc: "Unique functions exclusive to NoContext users." }),
            Object.freeze({ icon: "fa-folder-open", title: "Script Hub", desc: "Browse and execute scripts from our massive library." }),
            Object.freeze({ icon: "fa-gauge-high", title: "Fast Injection", desc: "Get into the action in seconds with our optimized DLL." }),
            Object.freeze({ icon: "fa-life-ring", title: "Multi-Version", desc: "Compatible with both Web and Microsoft Store versions." })
        ])
    })
});

document.addEventListener('DOMContentLoaded', () => {
    const productId = new URLSearchParams(window.location.search).get('id');
    if (productId && Object.prototype.hasOwnProperty.call(PRODUCTS, productId)) {
        renderProduct(PRODUCTS[productId], productId);
    } else {
        window.location.replace('roblox.html');
    }
});

function renderProduct(product, id) {
    document.title = `${product.name} | NoContext`;
    document.getElementById('product-title').innerText = product.name;
    document.getElementById('product-desc').innerText = product.description;

    const btn = document.getElementById('get-key-btn');
    btn.innerText = product.buttonText;

    if (product.comingSoon) {
        btn.href = "#";
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        document.getElementById('product-badge').innerText = "COMING SOON";
        document.getElementById('product-badge').style.background = "var(--text-muted)";
    } else {
        btn.href = `key.html?product=${encodeURIComponent(id)}`;
        document.getElementById('product-badge').innerText = product.price;
    }

    const featureContainer = document.getElementById('feature-list');
    featureContainer.replaceChildren();

    product.features.forEach(f => {
        const item = document.createElement('div');
        item.className = 'feature-item-detailed';

        const icon = document.createElement('i');
        icon.className = `fas ${f.icon}`;
        const title = document.createElement('h3');
        title.innerText = f.title;
        const desc = document.createElement('p');
        desc.style.cssText = 'color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;';
        desc.innerText = f.desc;

        item.append(icon, title, desc);
        featureContainer.appendChild(item);
    });

    if (product.uiImage) {
        const container = document.getElementById('product-ui-container');
        container.replaceChildren();
        const image = document.createElement('img');
        image.src = product.uiImage;
        image.alt = `${product.name} UI`;
        container.appendChild(image);
    }
}
