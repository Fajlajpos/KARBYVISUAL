gsap.registerPlugin(ScrollTrigger);

// ==========================================================================
// Setup Lenis (Smooth Scroll)
// ==========================================================================
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
})

window.lenis = lenis; // Expose for main.js control

function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

// Integrate Lenis with ScrollTrigger
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time)=>{
  lenis.raf(time * 1000)
})
gsap.ticker.lagSmoothing(0)


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
         duration: 1.5,
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
            document.body.style.overflow = 'auto'; // Re-enable lenis
        }
    })
    // Hero Entrance Anim
    .from('.hero-top-labels, .hero-bottom-info', {
        y: 20, opacity: 0,
        duration: 0.8, stagger: 0.2
    }, "-=0.3")
    .from('.media-frame', {
        y: 50, opacity: 0,
        duration: 1, ease: 'power3.out'
    }, "-=0.5");

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
            
            // Vertical animation (UPWARDS)
            const marquee = gsap.to(grid, {
                y: -totalHeight,
                duration: 45, 
                ease: "none",
                repeat: -1
            });

            // Interactive control - using more direct control
            viewport.addEventListener('mouseenter', () => {
                marquee.pause();
                gsap.to(grid, { opacity: 0.8, duration: 0.3 }); // Subtle visual feedback
            });
            viewport.addEventListener('mouseleave', () => {
                marquee.play();
                gsap.to(grid, { opacity: 1, duration: 0.3 });
            });
        }, 100);
    }

    // Initialize marquee if elements exist
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
});

// ==========================================================================
// AUTH & TOAST ANIMATIONS (GSAP)
// ==========================================================================

window.animateModalOpen = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const panel = modal.querySelector('.modal-panel');
    const overlay = modal.querySelector('.modal-overlay');
    
    if (!panel || !overlay) {
        gsap.set(modal, { visibility: 'visible', pointerEvents: 'auto', opacity: 1 });
        return;
    }
    
    // Preparation
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
    
    const panel = modal.querySelector('.modal-panel');
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
