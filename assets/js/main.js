// Shared UI Logic + Premium GSAP Motion

document.addEventListener('DOMContentLoaded', () => {
    initAmbientVisuals();
    initFAQ();
    initSmoothLinks();
    initGSAPAnimations();
});

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initAmbientVisuals() {
    if (prefersReducedMotion()) return;

    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    document.body.appendChild(progress);

    const orb = document.createElement('div');
    orb.className = 'ambient-orb';
    document.body.appendChild(orb);

    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    window.addEventListener('pointermove', e => {
        gsap.to(glow, { x: e.clientX, y: e.clientY, opacity: 1, duration: .35, ease: 'power2.out', overwrite: true });
        gsap.to(orb, { x: e.clientX, y: e.clientY, duration: 1.4, ease: 'power3.out', overwrite: true });
    }, { passive: true });

    window.addEventListener('pointerleave', () => gsap.to(glow, { opacity: 0, duration: .3 }));

    const updateProgress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        progress.style.width = pct + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
}

function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
            const answer = q.nextElementSibling;
            const isOpen = answer.style.display === 'block';
            document.querySelectorAll('.faq-answer').forEach(a => a.style.display = 'none');
            document.querySelectorAll('.faq-question i').forEach(i => i.classList.remove('faq-chevron-open'));
            answer.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) q.querySelector('i')?.classList.add('faq-chevron-open');
            if (!prefersReducedMotion() && typeof gsap !== 'undefined' && !isOpen) {
                gsap.fromTo(answer, { height: 0, opacity: 0, y: -8 }, { height: 'auto', opacity: 1, y: 0, duration: .45, ease: 'power3.out' });
            }
        });
    });
}

function initSmoothLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined' && !prefersReducedMotion()) {
                gsap.to(window, { duration: .95, scrollTo: { y: target, offsetY: 80 }, ease: 'power4.inOut' });
            } else target.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function initGSAPAnimations() {
    if (typeof gsap === 'undefined' || prefersReducedMotion()) return;
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    if (typeof ScrollToPlugin !== 'undefined') gsap.registerPlugin(ScrollToPlugin);

    // Cinematic page entrance
    gsap.set('body', { opacity: 1 });
    gsap.from('nav', { y: -35, opacity: 0, duration: .9, ease: 'power4.out' });

    const hero = document.querySelector('.hero');
    if (hero) {
        const title = hero.querySelector('h1');
        const text = hero.querySelector('p');
        const buttons = hero.querySelectorAll('.hero-btns .btn');
        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
        tl.from(title, { y: 80, opacity: 0, scale: .94, duration: 1.15 })
          .from(text, { y: 28, opacity: 0, duration: .75 }, '-=.7')
          .from(buttons, { y: 25, opacity: 0, scale: .96, stagger: .12, duration: .65 }, '-=.45');
        gsap.to(hero.querySelector('.container'), { yPercent: 12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }

    // Section headings rise into view.
    document.querySelectorAll('.section-title').forEach(title => {
        gsap.from(title, { y: 55, opacity: 0, duration: .8, ease: 'power4.out', scrollTrigger: { trigger: title, start: 'top 88%', once: true } });
    });

    // Cards reveal with a slight depth effect.
    document.querySelectorAll('.features-grid, .store-grid, .feature-list-detailed').forEach(grid => {
        const cards = grid.querySelectorAll('.card, .product-card, .feature-item-detailed, .platform-card');
        if (!cards.length) return;
        gsap.from(cards, {
            y: 65, opacity: 0, scale: .94, rotateX: 5, stagger: .11, duration: .8, ease: 'power4.out',
            scrollTrigger: { trigger: grid, start: 'top 84%', once: true }
        });
    });

    document.querySelectorAll('.faq-list .faq-item').forEach((item, i) => {
        gsap.from(item, { x: i % 2 ? 35 : -35, opacity: 0, duration: .65, ease: 'power3.out', scrollTrigger: { trigger: item, start: 'top 92%', once: true } });
    });

    document.querySelectorAll('.product-hero').forEach(section => {
        gsap.from(section.children, { y: 45, opacity: 0, stagger: .15, duration: .9, ease: 'power4.out' });
        const image = section.querySelector('.product-image-container');
        if (image) gsap.to(image, { y: -18, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    const footer = document.querySelector('footer');
    if (footer) gsap.from(footer, { y: 35, opacity: 0, duration: .8, scrollTrigger: { trigger: footer, start: 'top 94%', once: true } });

    initMagneticButtons();
    initCardTilt();
}

function initMagneticButtons() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('pointermove', e => {
            const r = btn.getBoundingClientRect();
            const x = e.clientX - r.left - r.width / 2;
            const y = e.clientY - r.top - r.height / 2;
            gsap.to(btn, { x: x * .10, y: y * .18, duration: .3, ease: 'power3.out', overwrite: true });
        });
        btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1,.45)', overwrite: true }));
    });
}

function initCardTilt() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll('.card, .product-card, .feature-item-detailed, .platform-card').forEach(card => {
        card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - .5;
            const py = (e.clientY - r.top) / r.height - .5;
            gsap.to(card, { rotationY: px * 4, rotationX: -py * 4, y: -5, transformPerspective: 900, duration: .35, ease: 'power2.out', overwrite: true });
        });
        card.addEventListener('pointerleave', () => gsap.to(card, { rotationY: 0, rotationX: 0, y: 0, duration: .65, ease: 'power3.out', overwrite: true }));
    });
}

function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btnElement.innerText;
        btnElement.innerText = 'Copied!';
        if (typeof gsap !== 'undefined') gsap.fromTo(btnElement, { scale: .92 }, { scale: 1, duration: .45, ease: 'back.out(2)' });
        setTimeout(() => { btnElement.innerText = originalText; }, 2000);
    });
}
