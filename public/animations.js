gsap.registerPlugin(ScrollTrigger);

// ==========================================================================
// Setup Lenis (Smooth Scroll)
// ==========================================================================
const _isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);
let lenis = null;

if (!_isMobile && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        infinite: false,
    });
    window.lenis = lenis; // Expose for main.js control

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        if (lenis) lenis.raf(time * 1000);
    });
} else {
    window.lenis = null;
}


// ==========================================================================
// Animations & Preloader
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    
    // Split text for reveal (Titles)
    const revealTexts = document.querySelectorAll('.reveal-text');
    revealTexts.forEach(text => {
        const type = new SplitType(text, { types: 'chars' });
        gsap.set(type.chars, { y: '100%', opacity: 0 });
        
        ScrollTrigger.create({
            trigger: text,
            start: "top 90%",
            onEnter: () => {
                gsap.to(type.chars, {
                    y: '0%', opacity: 1,
                    stagger: 0.03,
                    duration: 0.8,
                    ease: "power3.out"
                });
            }
        });
    });

    // Fade up animations (Paragrahs & Cells)
    const fadeEls = document.querySelectorAll('.reveal-fade, .bento-cell, .svc-row, .process-card');
    fadeEls.forEach(el => {
        gsap.set(el, { y: 30, opacity: 0 });
        ScrollTrigger.create({
            trigger: el,
            start: "top 85%",
            onEnter: () => {
                gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: "power2.out" });
            }
        });
    });

    // Counter Animations
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        
        ScrollTrigger.create({
            trigger: counter,
            start: "top 85%",
            once: true,
            onEnter: () => {
                gsap.to(counter, {
                    innerText: target,
                    snap: { innerText: 1 },
                    duration: 2,
                    ease: "power2.out"
                });
            }
        });
    });

    // Subtle Parallax for Media Frame
    // Disabled: The user requested that the video stays completely still when scrolling.
    /*
    if (document.querySelector('.hero-section')) {
        gsap.to('.hero-video', {
            yPercent: 15,
            ease: "none",
            scrollTrigger: {
                trigger: '.hero-section',
                start: "top top",
                end: "bottom top",
                scrub: true
            }
        });
    }
    */

    // Preloader Sequence
    const tl = gsap.timeline();
    
    // Fake loading progress
    const pg = { val: 0 };
    tl.to(pg, {
         val: 100,
         duration: _isMobile ? 0.8 : 1.5,
         ease: 'power2.inOut',
         onUpdate: () => {
             document.querySelector('.preloader-progress').style.setProperty('--after-width', `${pg.val}%`);
         }
    })
    .to('.preloader-text', {
        clipPath: 'inset(0 0% 0 0)',
        duration: 1,
        ease: 'power4.inOut' // Revealing text
    }, "-=1.0")
    .to('.preloader', {
        yPercent: -100,
        duration: 0.8,
        ease: 'power4.inOut',
        onComplete: () => {
            document.body.classList.remove('loading');
            document.body.style.overflow = ''; // Re-enable lenis without overriding CSS overflow-x: clip
            const preloader = document.querySelector('.preloader');
            if (preloader) {
                preloader.style.display = 'none';
                preloader.style.visibility = 'hidden';
            }
            ScrollTrigger.refresh(); // Ensure triggers are calculated correctly
        }
    })
    // Hero Entrance Sequence (Redo)
    .from('.monitor-workspace', {
        scale: 0.98, opacity: 0, duration: 1.4, ease: 'expo.out'
    }, "-=0.6")
    .from('.node-element', {
        scale: 0.8, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.5)'
    }, "-=1.2")
    .from('.node-path', {
        strokeDasharray: 1000, strokeDashoffset: 1000, duration: 2, ease: 'power2.inOut'
    }, "-=1.5")
    .from('.hero-cta-group', {
        y: 20, opacity: 0, duration: 0.8, ease: 'power2.out'
    }, "-=0.6");


    // Continuous Node Floating Animation (Subtle)
    gsap.to('.node-element', {
        y: "random(-15, 15)",
        x: "random(-10, 10)",
        duration: "random(3, 5)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
    });


    // Reviews logic is now handled by the general .reveal-fade transition
    // No mutual-exclusion scroll focus required for the new Grid layout.

    // ==========================================================================
    // Reviews Vertical Marquee
    // ==========================================================================
    function initReviewsMarquee() {
        const viewport = document.querySelector('.reviews-marquee-viewport');
        const grid = document.querySelector('#reviews-grid');
        if (!viewport || !grid) return;



        // Clean up any existing clones first (if called multiple times)
        const existingClones = grid.querySelectorAll('.is-clone');
        existingClones.forEach(c => c.remove());

        // Clone items for a seamless loop
        const items = Array.from(grid.children);
        items.forEach(item => {
            const clone = item.cloneNode(true);
            clone.classList.add('is-clone');
            grid.appendChild(clone);
        });

        // Use a slight delay to ensure items are rendered and height is correct
        setTimeout(() => {
            // Calculate height of one full set of items
            // We use the top of the first clone as the offset for totalHeight
            const firstClone = grid.querySelector('.is-clone');
            const totalHeight = firstClone.offsetTop - grid.offsetTop;
            
            // Kill previous marquee if exists to prevent stacking
            if (grid._marquee) grid._marquee.kill();

            const marquee = gsap.to(grid, {
                y: -totalHeight,
                duration: 25, 
                ease: "none",
                repeat: -1,
                force3D: true,
                lazy: true
            });
            grid._marquee = marquee;

            // Clean up any old event listeners
            if (grid._marqueeClick) {
                document.removeEventListener('click', grid._marqueeClick);
                grid._marqueeClick = null;
            }
            if (grid._marqueeHoverEnter && grid._marqueeHoverLeave) {
                const oldCards = grid.querySelectorAll('.insta-dm-card');
                oldCards.forEach(card => {
                    card.removeEventListener('mouseenter', grid._marqueeHoverEnter);
                    card.removeEventListener('mouseleave', grid._marqueeHoverLeave);
                });
            }

            const isMobileDevice = window.innerWidth <= 768 || window.matchMedia('(hover: none)').matches;

            if (isMobileDevice) {
                // Click-to-toggle pause logic (fixes mobile scrolling freeze and adds click-toggle)
                let pausedCard = null;

                const handleDocumentClick = (e) => {
                    const clickedCard = e.target.closest('.insta-dm-card');
                    
                    if (clickedCard) {
                        e.stopPropagation();
                        if (pausedCard === clickedCard) {
                            // Clicked same card again -> resume
                            marquee.play();
                            gsap.to(grid, { opacity: 1, duration: 0.3 });
                            clickedCard.classList.remove('card-paused');
                            pausedCard = null;
                        } else {
                            // Clicked a different card or first card
                            if (pausedCard) {
                                pausedCard.classList.remove('card-paused');
                            }
                            marquee.pause();
                            gsap.to(grid, { opacity: 0.8, duration: 0.3 });
                            gsap.to(clickedCard, { opacity: 1, duration: 0.3 }); // Keep clicked card at full opacity
                            clickedCard.classList.add('card-paused');
                            pausedCard = clickedCard;
                        }
                    } else {
                        // Clicked outside any card -> resume if paused
                        if (pausedCard) {
                            pausedCard.classList.remove('card-paused');
                            marquee.play();
                            gsap.to(grid, { opacity: 1, duration: 0.3 });
                            pausedCard = null;
                        }
                    }
                };

                grid._marqueeClick = handleDocumentClick;
                document.addEventListener('click', handleDocumentClick);
            } else {
                // Hover play/pause logic for PC
                const cards = grid.querySelectorAll('.insta-dm-card');
                
                const onMouseEnter = (e) => {
                    const card = e.currentTarget;
                    marquee.pause();
                    gsap.to(grid, { opacity: 0.8, duration: 0.3 });
                    gsap.to(card, { opacity: 1, duration: 0.3 });
                    card.classList.add('card-paused');
                };

                const onMouseLeave = (e) => {
                    const card = e.currentTarget;
                    marquee.play();
                    gsap.to(grid, { opacity: 1, duration: 0.3 });
                    card.classList.remove('card-paused');
                };

                cards.forEach(card => {
                    card.addEventListener('mouseenter', onMouseEnter);
                    card.addEventListener('mouseleave', onMouseLeave);
                });

                grid._marqueeHoverEnter = onMouseEnter;
                grid._marqueeHoverLeave = onMouseLeave;
            }
        }, 100);
    }

    // Initialize marquee if elements exist
    window.initReviewsMarquee = initReviewsMarquee;
    if (document.querySelector('.reviews-marquee-viewport')) {
        initReviewsMarquee();
    }

    // ==========================================================================
    // Form Interaction V3
    // ==========================================================================
    function initFormV3() {
        const tacticalInputs = document.querySelectorAll('.tactical-input');
        
        tacticalInputs.forEach(container => {
            const input = container.querySelector('input, textarea');
            if (!input) return;

            input.addEventListener('focus', () => {
                gsap.to(container, {
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.3)',
                    duration: 0.3
                });
            });

            input.addEventListener('blur', () => {
                gsap.to(container, {
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderColor: 'rgba(255,255,255,0.05)',
                    duration: 0.3
                });
            });
        });

        // Submit Button Scan Effect Sync
        const submitBtn = document.querySelector('.submit-btn-v3');
        if (submitBtn) {
            submitBtn.addEventListener('mouseenter', () => {
                gsap.to('.scan-bar', { opacity: 0.4, duration: 0.2 });
            });
            submitBtn.addEventListener('mouseleave', () => {
                gsap.to('.scan-bar', { opacity: 0.1, duration: 0.2 });
            });
        }
    }

    initFormV3();
    if (typeof initMobileMenu === 'function') initMobileMenu();
});

// ==========================================================================
// AUTH & TOAST ANIMATIONS (GSAP)
// ==========================================================================

window.animateCookieBannerOpen = function() {
    const overlay = document.getElementById('cookie-overlay');
    const banner = document.getElementById('cookie-banner');
    if (!overlay || !banner) return;

    gsap.killTweensOf([overlay, banner]);
    
    // Set initial values if they are not already visible
    if (!overlay.classList.contains('active')) {
        gsap.set(overlay, { 
            display: "flex",
            opacity: 0,
            backdropFilter: "blur(0px) saturate(100%)",
            webkitBackdropFilter: "blur(0px) saturate(100%)"
        });
        gsap.set(banner, { 
            opacity: 0, 
            y: 30, 
            scale: 0.98
        });
    }
    
    overlay.classList.add('active');
    
    gsap.to(overlay, {
        opacity: 1,
        backdropFilter: "blur(20px) saturate(180%)",
        webkitBackdropFilter: "blur(20px) saturate(180%)",
        duration: 0.5,
        ease: "power2.out"
    });
    
    gsap.to(banner, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: "power3.out"
    });
};

window.animateCookieBannerClose = function(callback) {
    const overlay = document.getElementById('cookie-overlay');
    const banner = document.getElementById('cookie-banner');
    if (!overlay || !banner) {
        if (callback) callback();
        return;
    }

    gsap.killTweensOf([overlay, banner]);
    
    const tl = gsap.timeline({
        onComplete: () => {
            overlay.classList.remove('active');
            gsap.set(overlay, { clearProps: "display,opacity,backdropFilter,webkitBackdropFilter" });
            gsap.set(banner, { clearProps: "opacity,transform" });
            if (callback) callback();
        }
    });
    
    tl.to(banner, {
        opacity: 0,
        y: 30,
        scale: 0.98,
        duration: 0.5,
        ease: "power2.in"
    }, 0)
    .to(overlay, {
        opacity: 0,
        backdropFilter: "blur(0px) saturate(100%)",
        webkitBackdropFilter: "blur(0px) saturate(100%)",
        duration: 0.4,
        ease: "power2.in"
    }, 0.1);
};

window.animateModalOpen = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const panel = modal.querySelector('.modal-panel') || modal.querySelector('.modal-content');
    const overlay = modal.querySelector('.modal-overlay');
    
    if (!panel || !overlay) {
        gsap.set(modal, { clearProps: 'visibility,pointerEvents,opacity' });
        gsap.set(modal, { visibility: 'visible', pointerEvents: 'auto', opacity: 1 });
        return;
    }
    
    // Preparation
    gsap.set(modal, { clearProps: 'visibility,pointerEvents,opacity' });
    gsap.set(modal, { visibility: 'visible', pointerEvents: 'auto', opacity: 1 });
    gsap.set(overlay, { opacity: 0 });
    
    gsap.set(panel, { 
        scale: 0.95,
        y: 20,
        opacity: 0
    });

    const tl = gsap.timeline();
    tl.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.out" })
      .to(panel, { scale: 1, y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.2)" }, "-=0.2");
};

window.animateModalClose = function(modalId, callback) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const panel = modal.querySelector('.modal-panel') || modal.querySelector('.modal-content');
    const overlay = modal.querySelector('.modal-overlay');
    
    if (!panel || !overlay) {
        gsap.set(modal, { visibility: 'hidden', pointerEvents: 'none', opacity: 0 });
        if (callback) callback();
        return;
    }

    const tl = gsap.timeline({ onComplete: () => {
        gsap.set(modal, { visibility: 'hidden', pointerEvents: 'none', opacity: 0 });
        if (callback) callback();
    }});

    tl.to(panel, { 
        scale: 0.95, 
        opacity: 0, 
        y: 10,
        duration: 0.4, 
        ease: "power2.in" 
    })
    .to(overlay, { opacity: 0, duration: 0.3, ease: "power2.in" }, "-=0.2");
};

window.transitionAuthPanels = function(fromId, toId) {
    const fromModal = document.getElementById(fromId);
    const toModal = document.getElementById(toId);
    if (!fromModal || !toModal) return;

    const fromPanel = fromModal.querySelector('.modal-panel');
    const toPanel = toModal.querySelector('.modal-panel');
    const toOverlay = toModal.querySelector('.modal-overlay');

    if (!fromPanel || !toPanel) {
        fromModal.classList.remove('active');
        toModal.classList.add('active');
        return;
    }

    // Make the target modal visible globally without removing the fromModal yet
    toModal.classList.add('active');
    gsap.set(toModal, { visibility: 'visible', pointerEvents: 'auto', opacity: 1 });
    gsap.set(toOverlay, { opacity: 1 });
    gsap.set(toPanel, { scale: 1.04, opacity: 0, y: 15 });

    const tl = gsap.timeline({
        onComplete: () => {
            fromModal.classList.remove('active');
            gsap.set(fromModal, { visibility: 'hidden', pointerEvents: 'none', opacity: 0 });
            gsap.set(fromPanel, { scale: 1, opacity: 1, y: 0 }); // reset for future
        }
    });
    
    // Cross-fade both panels for a seamless "plynulejsi" transition
    tl.to(fromPanel, { 
        scale: 0.96,
        opacity: 0, 
        y: -15,
        duration: 0.5, 
        ease: "power3.inOut" 
    }, 0)
    .to(toPanel, { 
        scale: 1, 
        opacity: 1, 
        y: 0,
        duration: 0.5, 
        ease: "power3.out" 
    }, 0.1);
};

window.animateToastIn = function(toast) {
    gsap.to(toast, { x: '0%', duration: 0.8, ease: "expo.out" });
};

window.animateToastOut = function(toast, callback) {
    gsap.to(toast, { x: '110%', opacity: 0, duration: 0.6, ease: "expo.in", onComplete: callback });
};

window.shakeError = function(element) {
    gsap.fromTo(element, { x: -10 }, { x: 10, duration: 0.1, repeat: 5, yoyo: true, ease: "none", onComplete: () => {
        gsap.to(element, { x: 0, duration: 0.1 });
    }});
};

// Nav Auth Stagger
function initAuthEntrance() {
    gsap.from('.auth-btn', {
        y: 20, opacity: 0,
        duration: 0.8, stagger: 0.2,
        delay: 2.5, // After preloader
        ease: "power2.out"
    });
}

// Initial Call
if (document.querySelector('.auth-btn')) {
    initAuthEntrance();
}

// ==========================================================================
// Navbar Scroll Effect
// ==========================================================================
function initNavbarScroll() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;

    const updateNav = () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', updateNav);
    updateNav(); // Initial check
}

document.addEventListener('DOMContentLoaded', initNavbarScroll);

function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    const drawerLinks = document.querySelectorAll('.mobile-nav-link, .drawer-link');
    const langBtns = document.querySelectorAll('.drawer-lang-btn');
    const drawerCloseBtn = document.getElementById('mobile-drawer-close');

    if (!menuBtn || !drawer || !overlay) return;

    let tcInterval = null;
    const tcElement = document.getElementById('menu-tc-display');

    const updateTimecode = () => {
        if (!tcElement) return;
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const ms = now.getMilliseconds();
        const frame = String(Math.floor((ms / 1000) * 24)).padStart(2, '0');
        tcElement.textContent = `TC ${hrs}:${mins}:${secs}:${frame}`;
    };

    const openMenu = () => {
        drawer.classList.add('open');
        overlay.classList.add('open');
        menuBtn.classList.add('active');
        
        if (window.lenis) window.lenis.stop();
        document.body.classList.add('modal-open');

        // Start timecode ticker
        if (tcElement) {
            updateTimecode();
            clearInterval(tcInterval);
            tcInterval = setInterval(updateTimecode, 1000 / 24);
        }

        // GSAP top-down slide in
        gsap.killTweensOf(drawer);
        gsap.fromTo(drawer,
            { yPercent: -100 },
            { yPercent: 0, duration: 0.6, ease: "power4.out" }
        );

        // GSAP premium staggered entrance reveal
        gsap.killTweensOf('.mobile-nav-link');
        gsap.killTweensOf('.mobile-nav-footer > *');
        
        gsap.fromTo('.mobile-nav-link', 
            { y: 35, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power3.out", delay: 0.18 }
        );
        gsap.fromTo('.mobile-nav-footer > *',
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: "power2.out", delay: 0.38 }
        );
    };

    const closeMenu = () => {
        overlay.classList.remove('open');
        menuBtn.classList.remove('active');
        
        if (window.lenis) window.lenis.start();
        document.body.classList.remove('modal-open');

        // Stop timecode ticker
        if (tcInterval) {
            clearInterval(tcInterval);
            tcInterval = null;
        }

        // GSAP slide up and then deactivate open class
        gsap.killTweensOf(drawer);
        gsap.to(drawer, {
            yPercent: -100,
            duration: 0.5,
            ease: "power4.in",
            onComplete: () => {
                drawer.classList.remove('open');
            }
        });

        // Graceful fade out of contents
        gsap.to('.mobile-nav-link, .mobile-nav-footer > *', {
            opacity: 0,
            y: -10,
            duration: 0.2,
            ease: "power2.in",
            overwrite: "auto"
        });
    };

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (drawer.classList.contains('open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    overlay.addEventListener('click', closeMenu);
    if (drawerCloseBtn) {
        drawerCloseBtn.addEventListener('click', closeMenu);
    }

    drawerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#') && href !== '#') {
                e.preventDefault();
                const targetEl = document.querySelector(href);
                closeMenu();
                if (targetEl && window.lenis) {
                    setTimeout(() => {
                        window.lenis.scrollTo(targetEl, { offset: -60, duration: 1.0 });
                    }, 250);
                } else if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                closeMenu();
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeMenu();
        }
    });

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            if (typeof window.switchLanguage === 'function') {
                window.switchLanguage(lang);
            }
        });
    });
}
