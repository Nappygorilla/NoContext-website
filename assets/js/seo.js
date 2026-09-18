(() => {
  'use strict';

  const BASE = '/NoContext-website/';
  const SITE = 'https://nappygorilla.github.io/NoContext-website/';
  const OG_IMAGE = SITE + 'assets/img/og-image.svg';
  const API = 'https://nocontext.onrender.com';
  const routes = {
    '': { slug: '', title: 'luna.win | Software, without the noise.', description: 'luna.win is an independent software ecosystem focused on fast interfaces, useful tools, browser experiences and polished products.', type: 'WebSite' },
    index: { slug: '', title: 'luna.win | Software, without the noise.', description: 'luna.win is an independent software ecosystem focused on fast interfaces, useful tools, browser experiences and polished products.', type: 'WebSite' },
    features: { slug: 'features', title: 'luna.win Features | Performance & Design', description: 'Explore luna.win features, including performance-focused interfaces, clean design, responsive experiences and ongoing improvements.' },
    store: { slug: 'store', title: 'luna.win Store | Products & Releases', description: 'Browse luna.win software products, current releases, free tools and upcoming projects.' },
    'browser-games': { slug: 'browser-games', title: 'Browser Games | luna.win', description: 'Play free luna.win browser games including Flappy Bird, Snake, Baseball, Tetris and Minesweeper directly in your browser.' },
    games: { slug: 'browser-games', title: 'Browser Games | luna.win', description: 'Play free luna.win browser games directly in your browser.' },
    updates: { slug: 'updates', title: 'luna.win Updates | Releases & Changes', description: 'Read the latest luna.win releases, improvements, fixes and platform updates.' },
    about: { slug: 'about', title: 'About luna.win | Independent Software', description: 'Learn about luna.win, an independent software project focused on useful tools, browser experiences, performance and thoughtful design.' },
    faq: { slug: 'faq', title: 'luna.win FAQ | Frequently Asked Questions', description: 'Find answers about luna.win products, browser games, accounts, keys, support and the platform.' },
    contact: { slug: 'contact', title: 'Contact luna.win | Support & Questions', description: 'Contact luna.win for support, product questions, feedback, bug reports and general inquiries.' },
    privacy: { slug: 'privacy', title: 'luna.win Privacy Policy', description: 'Read the luna.win privacy policy and learn how account, site and support information is handled.' },
    terms: { slug: 'terms', title: 'luna.win Terms of Service', description: 'Read the luna.win terms of service governing use of the website, products and services.' },
    refunds: { slug: 'refunds', title: 'luna.win Refund Policy', description: 'Review the luna.win refund and cancellation policy for eligible purchases and support requests.' },
    legal: { slug: 'legal', title: 'luna.win Legal Center', description: 'Find luna.win legal, privacy, acceptable use, copyright and refund information in one place.' },
    'acceptable-use': { slug: 'acceptable-use', title: 'luna.win Acceptable Use Policy', description: 'Read the luna.win acceptable use policy for responsible use of the site and services.' },
    copyright: { slug: 'copyright', title: 'luna.win Copyright Policy', description: 'Read the luna.win copyright policy and information about reporting copyright concerns.' },
    'developer-api': { slug: 'developer-api', title: 'luna.win Developer API', description: 'Explore the luna.win developer API, API keys, authentication and license validation.' },
    api: { slug: 'api', title: 'luna.win API | Developer Access', description: 'Explore the luna.win API and developer access endpoints.' },
    product: { slug: 'product', title: 'luna.win Product | Software', description: 'Explore luna.win product information, features, availability and access.' },
    roblox: { slug: 'roblox', title: 'luna.win Roblox Tools | Products', description: 'Explore luna.win Roblox tools, product information and access details.' },
    'media-player': { slug: 'media-player', title: 'luna.win Media Player | Browser Tool', description: 'Use the luna.win media player for local and direct media playback in your browser.' }
  };

  const privateRoutes = new Set(['login','register','key','account','account-dashboard','dashboard','admin','admin-dashboard','forgot-password','reset-password','cancel','checkout','success']);

  const slugFromPath = () => {
    let path = location.pathname.toLowerCase();
    if (path.startsWith(BASE.toLowerCase())) path = path.slice(BASE.length);
    path = path.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
    if (!path) return 'index';
    return path.split('/')[0] || 'index';
  };

  const pageKey = slugFromPath();
  const page = routes[pageKey] || routes.index;
  const canonicalPath = page.slug ? page.slug + '.html' : '';
  const canonical = SITE + canonicalPath;

  const setMeta = (selector, attrs, content) => {
    let el = document.head.querySelector(selector);
    if (!el) { el = document.createElement('meta'); Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  const setLink = (rel, href) => {
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
    el.href = href;
  };

  document.title = page.title;
  setMeta('meta[name="description"]', {name:'description'}, page.description);
  const isPrivate = privateRoutes.has(pageKey);
  setMeta('meta[name="robots"]', {name:'robots'}, isPrivate ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large');
  setMeta('meta[name="googlebot"]', {name:'googlebot'}, isPrivate ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large');
  setMeta('meta[name="theme-color"]', {name:'theme-color'}, '#070809');
  setMeta('meta[property="og:type"]', {'property':'og:type'}, 'website');
  setMeta('meta[property="og:site_name"]', {'property':'og:site_name'}, 'luna.win');
  setMeta('meta[property="og:title"]', {'property':'og:title'}, page.title);
  setMeta('meta[property="og:description"]', {'property':'og:description'}, page.description);
  setMeta('meta[property="og:url"]', {'property':'og:url'}, canonical);
  setMeta('meta[property="og:image"]', {'property':'og:image'}, OG_IMAGE);
  setMeta('meta[property="og:image:alt"]', {'property':'og:image:alt'}, 'luna.win software ecosystem');
  setMeta('meta[name="twitter:card"]', {name:'twitter:card'}, 'summary_large_image');
  setMeta('meta[name="twitter:title"]', {name:'twitter:title'}, page.title);
  setMeta('meta[name="twitter:description"]', {name:'twitter:description'}, page.description);
  setMeta('meta[name="twitter:image"]', {name:'twitter:image'}, OG_IMAGE);
  setLink('canonical', canonical);
  let upgrade = document.head.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!upgrade) { upgrade = document.createElement('meta'); upgrade.setAttribute('http-equiv','Content-Security-Policy'); document.head.appendChild(upgrade); }
  upgrade.setAttribute('content','upgrade-insecure-requests');

  document.querySelectorAll('img').forEach((img, index) => {
    if (!img.getAttribute('alt')) {
      const src = img.getAttribute('src') || '';
      const name = src.split('/').pop().split('?')[0].replace(/[-_]+/g,' ').replace(/\.[^.]+$/,'').trim();
      img.alt = name ? `${name} — luna.win` : 'luna.win graphic';
    }
    img.decoding = img.decoding || 'async';
    if (index > 0 && !img.loading) img.loading = 'lazy';
    const width = img.getAttribute('width');
    const height = img.getAttribute('height');
    if (!width && img.naturalWidth) img.width = img.naturalWidth;
    if (!height && img.naturalHeight) img.height = img.naturalHeight;
  });

  const publicKeys = Object.keys(routes).filter(k => k !== 'index' && !privateRoutes.has(k));
  const cleanMap = new Map();
  Object.entries(routes).forEach(([key, info]) => { cleanMap.set(key === 'index' ? 'index.html' : key + '.html', info.slug ? BASE + info.slug + '.html' : BASE); cleanMap.set(key, info.slug ? BASE + info.slug + '.html' : BASE); });
  document.querySelectorAll('a[href]').forEach(a => {
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return;
      const rel = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length).replace(/^\/+|\/+$/g,'') : '';
      const baseName = rel.replace(/\.html$/i,'').toLowerCase();
      const target = routes[baseName];
      if (!target || privateRoutes.has(baseName)) return;
      const clean = target.slug ? BASE + target.slug + '.html' : BASE;
      a.setAttribute('href', clean + url.search + url.hash);
    } catch (_) {}
  });

  const existingH1 = [...document.querySelectorAll('h1')];
  if (!existingH1.length) {
    const candidate = document.querySelector('.section-title h2, main h2, section h2, .hero h2');
    if (candidate) candidate.outerHTML = '<h1>' + candidate.innerHTML + '</h1>';
    else {
      const main = document.querySelector('main, .section, .hero') || document.body;
      const h1 = document.createElement('h1'); h1.textContent = page.title.split('|')[0].trim(); h1.className = 'seo-generated-h1';
      main.prepend(h1);
    }
  } else existingH1.slice(1).forEach(h => { const h2 = document.createElement('h2'); h2.innerHTML = h.innerHTML; [...h.attributes].forEach(a => h2.setAttribute(a.name,a.value)); h.replaceWith(h2); });

  const related = {
    index: ['features','store','browser-games','updates'],
    features: ['store','developer-api','about'],
    store: ['roblox','features','faq'],
    'browser-games': ['store','about','contact'],
    updates: ['store','features','about'],
    about: ['features','updates','contact'],
    faq: ['contact','store','about'],
    contact: ['faq','about','updates'],
    privacy: ['terms','contact','legal'],
    terms: ['privacy','acceptable-use','contact'],
    refunds: ['store','terms','contact'],
    legal: ['privacy','terms','copyright','acceptable-use'],
    'acceptable-use': ['terms','privacy','contact'],
    copyright: ['legal','contact','privacy'],
    'developer-api': ['api','key','contact'],
    api: ['developer-api','features','contact'],
    product: ['store','features','contact'],
    roblox: ['store','product','faq'],
    'media-player': ['features','about','contact']
  };
  if (!isPrivate && !document.querySelector('.seo-related-links')) {
    const items = (related[pageKey] || ['about','contact','updates']).filter(k => routes[k]);
    const section = document.createElement('section');
    section.className = 'section seo-related-links';
    section.innerHTML = `<div class="container"><div class="section-title"><h2>Explore luna.win</h2><p>Keep moving through related pages, products and support resources.</p></div><div class="features-grid">${items.map(k => `<a class="card" href="${routes[k].slug ? BASE + routes[k].slug + '.html' : BASE}"><h3>${routes[k].title.replace(' | luna.win','').replace('luna.win ','')}</h3><p>${routes[k].description}</p></a>`).join('')}</div></div>`;
    const footer = document.querySelector('footer');
    if (footer) footer.before(section); else document.body.appendChild(section);
  }

  const schema = [
    {'@context':'https://schema.org','@type':'Organization','name':'luna.win','url':SITE,'sameAs':['https://discord.gg/GrD3C722nC']},
    {'@context':'https://schema.org','@type':'WebSite','name':'luna.win','url':SITE,'description':routes.index.description},
    {'@context':'https://schema.org','@type':'WebPage','name':page.title,'description':page.description,'url':canonical,'isPartOf':{'@type':'WebSite','name':'luna.win','url':SITE}}
  ];
  if (pageKey === 'faq') {
    const entities = [...document.querySelectorAll('.faq-item, .faq-card, details')].map(item => {
      const q = item.querySelector('.faq-question, summary, h3');
      const a = item.querySelector('.faq-answer, [data-answer], p');
      return q && a ? {'@type':'Question','name':q.textContent.trim(),'acceptedAnswer':{'@type':'Answer','text':a.textContent.trim()}} : null;
    }).filter(Boolean);
    if (entities.length) schema.push({'@context':'https://schema.org','@type':'FAQPage','mainEntity':entities});
  }
  if (['product','roblox'].includes(pageKey)) schema.push({'@context':'https://schema.org','@type':'SoftwareApplication','name':page.title.split('|')[0].trim(),'applicationCategory':'UtilitiesApplication','operatingSystem':'Windows','url':canonical});
  if (!document.head.querySelector('script[data-nocontext-schema]')) { const s=document.createElement('script');s.type='application/ld+json';s.dataset.nocontextSchema='true';s.textContent=JSON.stringify(schema);document.head.appendChild(s); }

  const syncNavigation = authenticated => {
    const nav = document.querySelector('nav .container');
    if (!nav) return;
    let actions = nav.querySelector('.nav-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'nav-actions';
      actions.style.cssText = 'display:flex;gap:8px;align-items:center';
      nav.appendChild(actions);
    }
    actions.innerHTML = authenticated
      ? `<a href="${BASE}account-dashboard.html" class="btn btn-primary">Dashboard</a>`
      : `<a href="${BASE}login.html" class="btn btn-outline">Sign In</a><a href="${BASE}register.html" class="btn btn-primary">Register</a>`;
    const mobile = document.querySelector('.mobile-nav');
    if (mobile) {
      mobile.querySelectorAll('a[data-auth-dashboard],a[data-auth-login],a[data-auth-register]').forEach(a => a.remove());
      const links = authenticated
        ? `<a data-auth-dashboard href="${BASE}account-dashboard.html">Dashboard</a>`
        : `<a data-auth-login href="${BASE}login.html">Sign In</a><a data-auth-register href="${BASE}register.html">Register</a>`;
      mobile.insertAdjacentHTML('beforeend', links);
    }
  };

  const refreshNavigation = async () => {
    try {
      const response = await fetch(`${API}/api/auth/me`, { credentials: 'include', cache: 'no-store', headers: { 'Accept': 'application/json' } });
      const data = await response.json().catch(() => ({}));
      syncNavigation(Boolean(response.ok && data.authenticated && data.user));
    } catch (_) {
      syncNavigation(false);
    }
  };

  const startNavigationAuthSync = () => {
    refreshNavigation();
    window.setTimeout(refreshNavigation, 700);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startNavigationAuthSync, {once:true});
  else startNavigationAuthSync();

  document.documentElement.dataset.seoReady = 'true';
  document.documentElement.dataset.seoBootMs = String(Math.round(performance.now()));
})();
