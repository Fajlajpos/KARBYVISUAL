// DOM Elements
const yearEl = document.getElementById('year');
const portfolioGrid = document.getElementById('portfolio-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');
const testSlider = document.getElementById('testimonial-slider');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxMedia = document.getElementById('lightbox-media-container');

// Localization
const btnCS = document.getElementById('lang-cs');
const btnEN = document.getElementById('lang-en');
let currentLang = localStorage.getItem('karbyLang') || 'cs';

// State
let portfolioData = [];
let slideIndex = 0;

// Init
document.addEventListener('DOMContentLoaded', () => {
    // REGISTRATION MODAL LOGIC
    const regModal = document.getElementById('registration-modal');
    const regTrigger = document.getElementById('register-trigger');
    const modalClose = document.getElementById('modal-close');

    if (regTrigger && regModal && modalClose) {
        regTrigger.addEventListener('click', () => {
            regModal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });

        modalClose.addEventListener('click', () => {
            regModal.classList.remove('active');
            document.body.style.overflow = ''; // Enable scrolling
        });

        // Close on escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && regModal.classList.contains('active')) {
                regModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // HERO CLOCK
    const heroClock = document.getElementById('hero-clock');
    if (heroClock) {
        setInterval(() => {
            const now = new Date();
            heroClock.textContent = now.toLocaleTimeString('en-GB');
        }, 1000);
    }

    // 1. Loading Sequence & Remove Noise Preloader
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    initLocalization();
    loadPortfolio();
    loadTestimonials();
    
    // Filters Event
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderPortfolio(e.target.dataset.filter);
        });
    });

    // Contact Form Event
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }
    
    // Lightbox Close
    if(lightboxModal) {
        lightboxModal.querySelector('.close-btn').addEventListener('click', () => {
            lightboxModal.classList.remove('active');
            lightboxMedia.innerHTML = ''; // Stop video
        });
    }
});

// ==========================================
// LOCALIZATION
// ==========================================
function initLocalization() {
    updateLanguageUI(currentLang);
    
    if (btnCS) btnCS.addEventListener('click', () => switchLanguage('cs'));
    if (btnEN) btnEN.addEventListener('click', () => switchLanguage('en'));
}

function switchLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('karbyLang', lang);
    updateLanguageUI(lang);
    
    // Update active state on toggles
    if (btnCS) btnCS.classList.toggle('active', lang === 'cs');
    if (btnEN) btnEN.classList.toggle('active', lang === 'en');
}

function updateLanguageUI(lang) {
    // Standard Text Nodes
    const translatableNodes = document.querySelectorAll('[data-cs][data-en]');
    translatableNodes.forEach(node => {
        // Since many nodes use innerHTML for <br> support in split-type
        node.innerHTML = node.getAttribute(`data-${lang}`);
    });
    
    // Inputs placeholders
    const translatableInputs = document.querySelectorAll('[data-placeholder-cs][data-placeholder-en]');
    translatableInputs.forEach(input => {
        input.setAttribute('placeholder', input.getAttribute(`data-placeholder-${lang}`));
    });

    // Option tags might be handled by data-cs/en too
    const selectOptions = document.querySelectorAll('option[data-cs][data-en]');
    selectOptions.forEach(opt => {
        opt.textContent = opt.getAttribute(`data-${lang}`);
    });
}

// Helper to safely parse localized description from DB
function getLocalizedDesc(descObjOrStr) {
    if (!descObjOrStr) return '';
    try {
        const obj = JSON.parse(descObjOrStr);
        return currentLang === 'cs' ? (obj.cs || obj.en) : (obj.en || obj.cs);
    } catch(e) {
        // It's a plain string
        return descObjOrStr;
    }
}

// ==========================================
// PORTFOLIO
// ==========================================
async function loadPortfolio() {
    try {
        const res = await fetch('/api/portfolio');
        if (!res.ok) throw new Error('Failed to load portfolio');
        portfolioData = await res.json();
        renderPortfolio('all');
    } catch (err) {
        if(portfolioGrid) portfolioGrid.innerHTML = `<div class="error">Errors loading archive: ${err.message}</div>`;
    }
}

function renderPortfolio(filter) {
    if (!portfolioGrid) return;
    portfolioGrid.innerHTML = '';
    
    let filtered = portfolioData;
    if (filter !== 'all') {
        filtered = portfolioData.filter(item => item.category.toUpperCase() === filter.toUpperCase());
    }

    if (filtered.length === 0) {
        const msg = currentLang === 'cs' ? 'ŽÁDNÝ ZÁZNAM NENALEZEN' : 'NO RECORDS FOUND.';
        portfolioGrid.innerHTML = `<div class="empty-state mono-label" style="grid-column: span 2; padding:3rem; border:1px solid #333; text-align:center;">${msg}</div>`;
        return;
    }

    filtered.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'port-item reveal-fade';
        div.setAttribute('data-id', item.id);
        
        let adminHtml = '';
        if (window.isAdmin) {
             adminHtml = `<div class="admin-badge">
                 <button class="delete-btn" data-id="${item.id}"><i class="ph ph-trash"></i> DELETE</button>
             </div>`;
        }

        div.innerHTML = `
            ${adminHtml}
            <div class="port-img-wrap">
                <img src="${item.thumbnail_url || '/assets/download_1774980242270.jpeg'}" alt="${item.title}" class="port-img" loading="lazy">
            </div>
            <div class="port-info">
                <h3>${item.title}</h3>
                <span class="port-cat">[ ${item.category} ]</span>
            </div>
            <div class="port-line"></div>
        `;
        
        div.querySelector('.port-img-wrap').addEventListener('click', () => {
            openLightbox(item);
        });
        
        portfolioGrid.appendChild(div);
    });
}

function openLightbox(item) {
    const title = document.getElementById('lightbox-title');
    const desc = document.getElementById('lightbox-desc');
    const cat = document.getElementById('lightbox-category');
    
    title.textContent = item.title;
    
    // Inject localized description (or plain string)
    let descriptionText = getLocalizedDesc(item.description);
    
    // Prevent old element duplication
    if (document.getElementById('lightbox-desc-text')) {
        document.getElementById('lightbox-desc-text').innerHTML = descriptionText;
    } else {
        const p = document.createElement('p');
        p.id = 'lightbox-desc-text';
        p.style.marginTop = '1rem';
        p.style.color = '#ccc';
        p.innerHTML = descriptionText;
        document.querySelector('.lightbox-info').appendChild(p);
    }
    
    cat.textContent = item.category;
    
    lightboxMedia.innerHTML = '';
    
    if (item.media_url) {
        if (item.media_url.includes('vimeo') || item.media_url.includes('youtube')) {
            const embedUrl = item.media_url.replace('vimeo.com', 'player.vimeo.com/video');
            lightboxMedia.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width:100%; height:100%;"></iframe>`;
        } else if (item.media_url.endsWith('.mp4') || item.media_url.endsWith('.webm')) {
            lightboxMedia.innerHTML = `<video controls autoplay name="media" style="max-height:100%;"><source src="${item.media_url}" type="video/mp4"></video>`;
        } else {
             lightboxMedia.innerHTML = `<img src="${item.media_url}" alt="${item.title}" style="max-height:100%;">`;
        }
    } else {
        lightboxMedia.innerHTML = `<img src="${item.thumbnail_url || '/assets/download_1774980242270.jpeg'}" alt="${item.title}" style="max-height:100%;">`;
    }
    
    lightboxModal.classList.add('active');
}

// ==========================================
// TESTIMONIALS & CONTACT
// ==========================================
async function loadTestimonials() {
    try {
        const res = await fetch('/api/testimonials');
        if (!res.ok) return;
        const data = await res.json();
        renderTestimonials(data);
    } catch(err) {
        console.error(err);
    }
}

function renderTestimonials(data) {
    if (!testSlider || data.length === 0) return;
    testSlider.innerHTML = '';
    
    data.forEach((t, i) => {
        const div = document.createElement('div');
        div.className = `t-slide ${i === 0 ? 'active' : ''}`;
        div.innerHTML = `
            <p class="t-quote">"${t.quote}"</p>
            <div class="t-client">${t.client_name}</div>
        `;
        testSlider.appendChild(div);
    });
    
    if (data.length > 1) {
        setInterval(() => {
            const slides = document.querySelectorAll('.t-slide');
            if(slides.length === 0) return;
            slides[slideIndex].classList.remove('active');
            slideIndex = (slideIndex + 1) % slides.length;
            slides[slideIndex].classList.add('active');
        }, 5000);
    }
}

async function handleContactSubmit(e) {
    e.preventDefault();
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader-ring');
    const submitBtn = document.getElementById('submit-btn');
    
    formStatus.innerHTML = '';
    btnText.style.display = 'none';
    loader.classList.remove('hidden');
    submitBtn.disabled = true;

    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            const msg = currentLang === 'cs' ? 'DIREKTIVA ODESLÁNA.' : 'MESSAGE TRANSMITTED.';
            formStatus.innerHTML = `<div style="color: #4CAF50; margin-top: 15px;">${msg}</div>`;
            contactForm.reset();
        } else {
            formStatus.innerHTML = `<div style="color: var(--accent); margin-top: 15px;">ERROR: ${result.error}</div>`;
        }
    } catch (err) {
        formStatus.innerHTML = `<div style="color: var(--accent); margin-top: 15px;">CONNECTION FAILED.</div>`;
    } finally {
        btnText.style.display = 'block';
        loader.classList.add('hidden');
        submitBtn.disabled = false;
        setTimeout(() => { formStatus.innerHTML = ''; }, 5000);
    }
}
