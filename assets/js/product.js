const PRODUCTS = {
    external: {
        name: "NoContext External",
        description: "A professional-grade external tool designed for Roblox. NoContext External operates outside of the game process, making it completely undetectable by standard anti-cheats. Perfect for players who prioritize safety and account longevity.",
        price: "FREE",
        buttonText: "Download",
        comingSoon: false,
        uiImage: null, // Add path to UI screenshot here
        features: [
            { icon: "fa-shield-halved", title: "Undetectable", desc: "Operates 100% externally from the game process." },
            { icon: "fa-bolt", title: "Lightweight", desc: "Zero performance impact on your gameplay." },
            { icon: "fa-mouse-pointer", title: "Auto-Clicker", desc: "Highly customizable clicking speeds and patterns." },
            { icon: "fa-crosshairs", title: "Visual Assists", desc: "Clean overlays that don't flicker or lag." },
            { icon: "fa-gear", title: "Custom Presets", desc: "Save and load your favorite configurations instantly." }
        ]
    },
    executor: {
        name: "NoContext Executor",
        description: "The most powerful script execution environment for Roblox. NoContext Executor features a high-performance custom API, Level 7 execution capabilities, and a built-in script hub with thousands of community scripts.",
        price: "COMING SOON",
        buttonText: "Coming Soon",
        comingSoon: true,
        uiImage: null, // Add path to UI screenshot here
        features: [
            { icon: "fa-code", title: "Level 7 Execution", desc: "Run even the most complex scripts with ease." },
            { icon: "fa-microchip", title: "Custom API", desc: "Unique functions exclusive to NoContext users." },
            { icon: "fa-folder-open", title: "Script Hub", desc: "Browse and execute scripts from our massive library." },
            { icon: "fa-gauge-high", title: "Fast Injection", desc: "Get into the action in seconds with our optimized DLL." },
            { icon: "fa-life-ring", title: "Multi-Version", desc: "Compatible with both Web and Microsoft Store versions." }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId && PRODUCTS[productId]) {
        renderProduct(PRODUCTS[productId], productId);
    } else {
        // Redirect if product not found
        window.location.href = 'roblox.html';
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
        btn.href = `key.html?product=${id}`;
        document.getElementById('product-badge').innerText = product.price;
    }

    // Render features
    const featureContainer = document.getElementById('feature-list');
    featureContainer.innerHTML = '';

    product.features.forEach(f => {
        const item = document.createElement('div');
        item.className = 'feature-item-detailed';
        item.innerHTML = `
            <i class="fas ${f.icon}"></i>
            <h3>${f.title}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;">${f.desc}</p>
        `;
        featureContainer.appendChild(item);
    });

    // Handle UI Image
    if (product.uiImage) {
        const container = document.getElementById('product-ui-container');
        container.innerHTML = `<img src="${product.uiImage}" alt="${product.name} UI">`;
    }
}
