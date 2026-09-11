// Shared UI Logic + GSAP Motion

document.addEventListener('DOMContentLoaded', () => {
    // FAQ Accordion
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(q => {
        q.addEventListener('click', () => {
            const answer = q.nextElementSibling;
            const isOpen = answer.style.display === 'block';

            document.querySelectorAll('.faq-answer').forEach(a => a.style.display = 'none');
            document.querySelectorAll('.faq-question i').forEach(i => i.classList.remove('faq-chevron-open'));

            answer.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) q.querySelector('i')?.classList.add('faq-chevron-open');

            if (!prefersReducedMotion() && typeof gsap !== 'undefined') {
                gsap.fromTo(answer,
                    { height: 0, opacity: 0, y: -8 },
                    { height: 'auto', opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }
                );
            }
        });
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();

            if (typeof gsap !== 'undefined' && !prefersReducedMotion()) {
                gsap.to(window, {
                    duration: 0.8,
                    scrollTo: { y: target, offsetY: 80 },
                    ease: 'power3.inOut'
                });
            } else {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    initGSAPAnimations();
});

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initGSAPAnimations() {
    if (typeof gsap === 'undefined' || prefersReducedMotion()) return;

    // GSAP's ScrollToPlugin is not required; native smooth scrolling handles anchors.
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

    // Initial page reveal — subtle, fast, and deliberately not "AI template" flashy.
    gsap.from('nav', {
        y: -24,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out'
    });

    const hero = document.querySelector('.hero');
    if (hero) {
        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        heroTl
            .from(hero.querySelector('h1'), { y: 45, opacity: 0, duration: 0.9 })
            .from(hero.querySelector('p'), { y: 24, opacity: 0, duration: 0.65 }, '-=0.55')
            .from(hero.querySelectorAll('.hero-btns .btn'), { y: 18, opacity: 0, stagger: 0.1, duration: 0.5 }, '-=0.35');
    }

    // Every content section gets a clean viewport-triggered entrance.
    document.querySelectorAll('.section').forEach(section => {
        const title = section.querySelector('.section-title');
        if (title) {
            gsap.from(title, {
                y: 35,
                opacity: 0,
                duration: 0.7,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: title,
                    start: 'top 86%',
                    once: true
                }
            });
        }
    });

    // Stagger cards as they enter the viewport.
    document.querySelectorAll('.features-grid, .store-grid, .feature-list-detailed').forEach(grid => {
        const cards = grid.querySelectorAll('.card, .product-card, .feature-item-detailed, .platform-card');
        if (!cards.length) return;

        gsap.from(cards, {
            y: 42,
            opacity: 0,
            scale: 0.97,
            duration: 0.65,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: grid,
                start: 'top 84%',
                once: true
            }
        });
    });

    document.querySelectorAll('.faq-list .faq-item').forEach((item, index) => {
        gsap.from(item, {
            x: index % 2 === 0 ? -20 : 20,
            opacity: 0,
            duration: 0.55,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: item,
                start: 'top 90%',
                once: true
            }
        });
    });

    // Product/detail pages.
    document.querySelectorAll('.product-hero').forEach(heroSection => {
        gsap.from(heroSection.children, {
            y: 30,
            opacity: 0,
            duration: 0.75,
            stagger: 0.12,
            ease: 'power3.out'
        });
    });

    // Footer enters last instead of sitting statically at the bottom.
    const footer = document.querySelector('footer');
    if (footer) {
        gsap.from(footer, {
            y: 25,
            opacity: 0,
            duration: 0.65,
            scrollTrigger: {
                trigger: footer,
                start: 'top 92%',
                once: true
            }
        });
    }

    // Premium micro-interactions on buttons/cards.
    document.querySelectorAll('.btn, .card, .product-card, .feature-item-detailed, .platform-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            gsap.to(el, { y: -4, duration: 0.25, ease: 'power2.out', overwrite: true });
        });
        el.addEventListener('mouseleave', () => {
            gsap.to(el, { y: 0, duration: 0.35, ease: 'power3.out', overwrite: true });
        });
    });
}

// Helper for copying text to clipboard
function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btnElement.innerText;
        btnElement.innerText = 'Copied!';
        setTimeout(() => {
            btnElement.innerText = originalText;
        }, 2000);
    });
}
