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

});
