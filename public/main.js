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
let currentUser = null;
let portfolioData = [];
let currentFolderItems = [];
let currentLightboxIndex = -1;

// Init
document.addEventListener('DOMContentLoaded', () => {
    // (Removed old modal logic)

    // HERO CLOCK
    const heroClock = document.getElementById('hero-clock');
    if (heroClock) {
        setInterval(() => {
            const now = new Date();
            heroClock.textContent = now.toLocaleTimeString('en-GB');
        }, 1000);
    }

    // Navigation & Global Events
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    initLocalization();
    loadSettings(); // Load site settings (Hero Video etc)
    loadPortfolio();
    loadTestimonials();
    checkAuth(); 
    initAuthUI(); 
    
    // Folder Grid Event
    const archiveGrid = document.getElementById('archive-grid');
    if (archiveGrid) {
        archiveGrid.querySelectorAll('.folder-item').forEach(folder => {
            folder.addEventListener('click', () => {
                const category = folder.getAttribute('data-category');
                const titleCS = folder.querySelector('.folder-name').getAttribute('data-cs') || folder.querySelector('.folder-name').textContent;
                const titleEN = folder.querySelector('.folder-name').getAttribute('data-en') || folder.querySelector('.folder-name').textContent;
                openFolderModal(category, { cs: titleCS, en: titleEN }, folder);
            });
        });
    }

    // Folder Modal Close
    const folderModal = document.getElementById('folder-modal');
    const closeFolderBtn = document.getElementById('close-folder-modal');
    const closeFolderDot = document.getElementById('close-folder-modal-dot');
    
    const closeFolder = () => {
        if (folderModal && folderModal.classList.contains('active')) {
            const modalContent = folderModal.querySelector('.modal-content');
            
            const tl = gsap.timeline({
                onComplete: () => {
                    folderModal.classList.remove('active');
                    if (window.toggleBodyLock) window.toggleBodyLock(false);
                    // Reset to initial state for next open
                    gsap.set(modalContent, { scale: 0.85, opacity: 0 });
                    gsap.set(folderModal.querySelector('.modal-overlay'), { opacity: 0 });
                }
            });

            // Smoothly fade out the items first for extra polish
            tl.to("#folder-items-grid .reveal-fade", {
                opacity: 0,
                y: 10,
                duration: 0.2,
                stagger: 0.03,
                ease: "power2.in"
            })
            .to(modalContent, {
                scale: 0.8,
                opacity: 0,
                duration: 0.55,
                ease: "back.in(1.2)"
            }, "-=0.1")
            .to(folderModal.querySelector('.modal-overlay'), {
                opacity: 0,
                duration: 0.4
            }, "-=0.45");
        }
    };

    if (closeFolderBtn) closeFolderBtn.addEventListener('click', closeFolder);
    if (closeFolderDot) closeFolderDot.addEventListener('click', closeFolder);
    
    if (folderModal) {
        folderModal.querySelector('.modal-overlay')?.addEventListener('click', closeFolder);
    }

    // Contact Form Event
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }
    
    // Lightbox Close
    if(lightboxModal) {
        lightboxModal.querySelector('.close-btn').addEventListener('click', closeLightbox);
        lightboxModal.querySelector('.modal-overlay')?.addEventListener('click', closeLightbox);
        
        // Navigation
        document.getElementById('lb-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateLightbox(-1);
        });
        document.getElementById('lb-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateLightbox(1);
        });
    }

    function closeLightbox() {
        lightboxModal.classList.remove('active');
        lightboxMedia.innerHTML = '';
        if (window.toggleBodyLock) window.toggleBodyLock(false);
    }

    // Body Scroll Lock Helper
    window.toggleBodyLock = function(lock) {
        document.body.classList.toggle('modal-open', lock);
        if (window.lenis) {
            if (lock) window.lenis.stop();
            else window.lenis.start();
        }
    };

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const activeModal = document.querySelector('.modal.active, .auth-modal.active');
        if (!activeModal) return;

        if (e.key === 'Escape') {
            if (activeModal.id === 'lightbox-modal') closeLightbox();
            else if (activeModal.classList.contains('auth-modal')) closeAuthModal(activeModal.id);
            else if (activeModal.id === 'folder-modal') closeFolder();
            else if (activeModal.id === 'admin-dashboard-modal') document.getElementById('close-dashboard-btn').click();
        }

        if (activeModal.id === 'lightbox-modal') {
            if (e.key === 'ArrowRight') navigateLightbox(1);
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
        }
    });

    // Modified Close logic to use window helper
});

// ==========================================
// SETTINGS
// ==========================================
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const settings = await res.json();
        
        // Update Hero Video
        if (settings.hero_video_url) {
            const heroIframe = document.querySelector('.hero-video');
            if (heroIframe) {
                let url = settings.hero_video_url;
                
                // YouTube cleaning
                if (url.includes('youtube.com/watch?v=')) {
                    const vidId = url.split('v=')[1].split('&')[0];
                    url = `https://www.youtube.com/embed/${vidId}?autoplay=0&mute=1&loop=1&playlist=${vidId}&modestbranding=1&rel=0`;
                } else if (url.includes('youtu.be/')) {
                    const vidId = url.split('youtu.be/')[1].split('?')[0];
                    url = `https://www.youtube.com/embed/${vidId}?autoplay=0&mute=1&loop=1&playlist=${vidId}&modestbranding=1&rel=0`;
                } else if (url.includes('youtube.com/embed/')) {
                    // Already an embed, just ensure essential params
                    if (!url.includes('autoplay')) {
                        url += (url.includes('?') ? '&' : '?') + 'autoplay=0&mute=1&loop=1&modestbranding=1';
                    } else {
                        url = url.replace('autoplay=1', 'autoplay=0');
                    }
                }
                
                // Vimeo cleaning
                if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
                    const vidId = url.split('vimeo.com/')[1].split('?')[0];
                    url = `https://player.vimeo.com/video/${vidId}?autoplay=0&muted=1&loop=1`;
                } else if (url.includes('player.vimeo.com')) {
                    url = url.replace('autoplay=1', 'autoplay=0');
                }

                heroIframe.src = url;
            }
        }
    } catch (err) {
        console.error('Settings load error:', err);
    }
}

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
        // We no longer render directly to a grid on home, we wait for folder clicks
    } catch (err) {
        console.error('Portfolio load error:', err);
    }
}

function openFolderModal(category, titles, originEl) {
    const modal = document.getElementById('folder-modal');
    const modalContent = modal.querySelector('.modal-content');
    const grid = document.getElementById('folder-items-grid');
    const titleEl = document.getElementById('folder-modal-title');

    if (!modal || !grid) return;

    // Save origin
    if (originEl) {
        modal.dataset.originId = originEl.getAttribute('data-id') || '';
    }

    // Update Title
    const displayTitle = currentLang === 'cs' ? titles.cs : titles.en;
    titleEl.textContent = `[ ${displayTitle.toUpperCase()} ]`;

    // Filter Items (Standardized Categories)
    let filtered = portfolioData.filter(item => {
        const dbCat = item.category.toUpperCase();
        const targetCat = category.toUpperCase();
        
        // Photography mapping
        if (targetCat === 'PHOTOGRAPHY' || targetCat === 'FOTKY') return dbCat === 'PHOTOGRAPHY';
        
        // Video folder mapping (includes legacy Editing/Cinematography if needed)
        if (targetCat === 'VIDEOKLIPY') {
            return dbCat === 'VIDEOKLIPY' || dbCat === 'EDITING' || dbCat === 'CINEMATOGRAPHY';
        }
        
        // Social / Specific platforms
        if (targetCat === 'TIKTOK') return dbCat === 'TIKTOK';
        if (targetCat === 'INSTAGRAM') return dbCat === 'INSTAGRAM';
        if (targetCat === 'YOUTUBE') return dbCat === 'YOUTUBE';
        if (targetCat === 'AKCE') return dbCat === 'AKCE';

        return dbCat === targetCat;
    });

    currentFolderItems = filtered;
    grid.innerHTML = '';

    if (filtered.length > 0) {
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'port-item reveal-fade active';
            div.style.opacity = 0;
            
            let adminHtml = '';
            if (window.isAdmin) {
                 adminHtml = `<div class="admin-badge-container">
                     <button class="delete-btn" title="Delete Item" data-id="${item.id}"><i class="ph ph-trash"></i></button>
                 </div>`;
            }

            let mediaHtml = '';
            const url = (item.media_url || '').toLowerCase();
            const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov') || url.includes('vimeo') || url.includes('youtube');

            if (isVideo && !url.includes('vimeo') && !url.includes('youtube')) {
                mediaHtml = `
                    <div class="port-video-wrap">
                        <video src="${item.media_url}" muted loop playsinline class="port-video-preview"></video>
                        <div class="video-grid-overlay"><i class="ph ph-play"></i></div>
                    </div>
                `;
            } else {
                mediaHtml = `
                    <div class="port-img-wrap">
                        <img src="${item.thumbnail_url || '/assets/portfolio-placeholder.png'}" alt="${item.title}" class="port-img" loading="lazy" onerror="this.src='/assets/portfolio-placeholder.png'">
                        ${isVideo ? '<div class="video-grid-overlay"><i class="ph ph-video-camera"></i></div>' : ''}
                    </div>
                `;
            }

            div.innerHTML = `
                ${adminHtml}
                <div class="port-media-container">
                    ${mediaHtml}
                    <div class="item-overlay-icon"><i class="ph ph-plus"></i></div>
                </div>
                <div class="port-info">
                    <span class="port-cat">${item.category}</span>
                    <h3>${item.title}</h3>
                    <div class="view-indicator mono-label" data-cs="[ ZOBRAZIT ]" data-en="[ VIEW ]">[ VIEW ]</div>
                </div>
            `;

            
            // Add delete listener if admin
            if (window.isAdmin) {
                div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm('DELETE THIS ITEM PERMANENTLY?')) return;
                    
                    try {
                        const res = await fetch(`/api/portfolio/${item.id}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast('ITEM DELETED', 'success');
                            loadPortfolio().then(() => openFolderModal(category, titles, originEl));
                        }
                    } catch (err) {
                        showToast('DELETE FAILED', 'error');
                    }
                });
            }

            div.querySelector('.port-img-wrap, .port-video-wrap').addEventListener('click', () => {
                currentLightboxIndex = filtered.indexOf(item);
                openLightbox(item);
            });
            grid.appendChild(div);
        });
    } else {
        for (let i = 0; i < 3; i++) {
            const card = document.createElement('div');
            card.className = 'placeholder-card reveal-fade active';
            card.style.opacity = 0;
            card.innerHTML = `<i class="ph ph-file-dashed"></i><span class="mono-label" data-cs="PRÁZDNÝ ZÁZNAM" data-en="EMPTY RECORD">PRÁZDNÝ ZÁZNAM</span>`;
            grid.appendChild(card);
        }
        updateLanguageUI(currentLang);
    }

    // macOS Opening Animation Logic
    modal.classList.add('active');
    window.toggleBodyLock(true);

    // Start modal hidden and scaled down
    gsap.set(modalContent, { scale: 0.88, opacity: 0 });
    gsap.set(modal.querySelector('.modal-overlay'), { opacity: 0 });

    const tl = gsap.timeline();
    tl.to(modal.querySelector('.modal-overlay'), { opacity: 1, duration: 0.3 })
      .to(modalContent, {
          scale: 1,
          opacity: 1,
          duration: 0.45,
          ease: "back.out(1.5)",
          clearProps: "transform"
      }, "-=0.15")
      .to("#folder-items-grid .reveal-fade", {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power2.out"
      }, "-=0.25");
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
        const url = item.media_url.toLowerCase();
        if (url.includes('vimeo.com') || url.includes('player.vimeo.com')) {
            // Extract Vimeo ID
            let vimeoId = url.split('/').pop().split('?')[0];
            if (url.includes('video/')) vimeoId = url.split('video/')[1].split('?')[0];
            const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
            lightboxMedia.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width:100%; height:100%;"></iframe>`;
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            // Extract YouTube ID
            let ytId = '';
            if (url.includes('watch?v=')) ytId = url.split('watch?v=')[1].split('&')[0];
            else if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1].split('?')[0];
            else if (url.includes('embed/')) ytId = url.split('embed/')[1].split('?')[0];
            
            const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&modestbranding=1`;
            lightboxMedia.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%;"></iframe>`;
        } else if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
            lightboxMedia.innerHTML = `<video controls autoplay name="media" style="max-height:100%; width:100%;"><source src="${item.media_url}" type="video/mp4"></video>`;
        } else {
             lightboxMedia.innerHTML = `<img src="${item.media_url}" alt="${item.title}" style="max-height:100%; object-fit: contain;">`;
        }
    } else {
        lightboxMedia.innerHTML = `<img src="${item.thumbnail_url || '/assets/download_1774980242270.jpeg'}" alt="${item.title}" style="max-height:100%; object-fit: contain;">`;
    }
    
    lightboxModal.classList.add('active');
    window.toggleBodyLock(true);
}

function navigateLightbox(direction) {
    if (currentFolderItems.length === 0) return;
    
    currentLightboxIndex += direction;
    
    if (currentLightboxIndex < 0) currentLightboxIndex = currentFolderItems.length - 1;
    if (currentLightboxIndex >= currentFolderItems.length) currentLightboxIndex = 0;
    
    openLightbox(currentFolderItems[currentLightboxIndex]);
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
// ==========================================
// AUTH & TOASTS
// ==========================================

// ==========================================
// AUTH & TOASTS
// ==========================================

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            currentUser = await res.json();
            updateNavAuth(true);
        } else {
            currentUser = null;
            updateNavAuth(false);
        }
    } catch (err) {
        currentUser = null;
        updateNavAuth(false);
    }
}

function updateNavAuth(authenticated) {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;

    if (authenticated && currentUser) {
        const firstName = currentUser.full_name.split(' ')[0];
        const isAdmin = currentUser.role === 'admin';
        window.isAdmin = isAdmin;
        document.body.classList.toggle('admin-enabled', isAdmin);
        
        let adminBtns = '';
        if (isAdmin) {
            adminBtns = `
                <button id="nav-db-btn" class="btn-admin-db" data-cs="DATABÁZE" data-en="DATABASE" title="View Records"><i class="ph ph-database"></i> DATABASE</button>
                <button id="nav-admin-btn" class="nav-admin-btn" title="Add Work"><i class="ph ph-plus-circle"></i> <span data-cs="PŘIDAT" data-en="ADD">ADD</span></button>
                <div class="admin-badge"></div>
            `;
        }
        
        navAuth.innerHTML = `
            <div class="user-profile" style="display: flex; align-items: center; gap: 0.8rem;">
                ${adminBtns}
                <div class="user-info" style="display: flex; align-items: center; gap: 0.5rem; margin-left: 0.5rem; font-family: var(--font-mono); font-size: 0.7rem; color: #fff;">
                    <i class="ph ph-user-circle" style="font-size: 1.1rem; opacity: 0.7;"></i>
                    <span style="letter-spacing: 1px;">${firstName.toUpperCase()}</span>
                </div>
                <button class="logout-btn auth-btn" id="main-logout-btn" style="padding: 6px 14px; font-size: 0.65rem;">LOGOUT</button>
            </div>
        `;
    } else {
        navAuth.innerHTML = `
            <button class="auth-btn btn-login" id="login-trigger" data-cs="PŘIHLÁSIT" data-en="LOGIN">LOGIN</button>
            <button class="auth-btn btn-register auth-btn btn-filled" id="register-trigger" data-cs="REGISTRACE" data-en="REGISTER">REGISTER</button>
        `;
        window.isAdmin = false;
        document.body.classList.remove('admin-enabled');
    }
    
    updateLanguageUI(currentLang);
}

async function handleLogout() {
    try {
        const res = await fetch('/api/logout', { method: 'POST' });
        if (res.ok) {
            showToast(currentLang === 'cs' ? 'Odhlášení úspěšné.' : 'Logged out successfully.', 'success');
            checkAuth();
        }
    } catch (err) {
        showToast('Logout failed.', 'error');
    }
}

function initAuthUI() {
    // Event Delegation
    document.addEventListener('click', (e) => {
        const id = e.target.id || e.target.closest('[id]')?.id;
        const isFootLink = e.target.classList.contains('auth-foot-link') || e.target.closest('.auth-foot-link');
        
        if (id === 'login-trigger' || isFootLink) {
            e.preventDefault();
            openAuthModal('login-modal');
        }
        if (id === 'register-trigger') openAuthModal('reg-modal');
        if (id === 'main-logout-btn') handleLogout();
        
        // Closes
        if (e.target.classList.contains('auth-close') || e.target.closest('.auth-close') || e.target.classList.contains('modal-overlay') || e.target.closest('.close-btn')) {
            const modal = e.target.closest('.auth-modal') || e.target.closest('.modal');
            
            // Skip folder-modal as it uses custom GSAP logic
            if (modal && modal.id === 'folder-modal') return;

            if (modal) {
                if (modal.classList.contains('auth-modal')) {
                    closeAuthModal(modal.id);
                } else {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
        }
        
        // Switches
        const switchBtn = e.target.closest('.switch-btn') || e.target.closest('.switch-btn-full');
        if (switchBtn) {
            const current = switchBtn.closest('.auth-modal').id;
            const target = switchBtn.dataset.target;
            switchModals(current, target);
        }

        // Pass Toggle
        if (e.target.classList.contains('toggle-password')) {
            const input = e.target.previousElementSibling;
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
                e.target.classList.toggle('ph-eye');
                e.target.classList.toggle('ph-eye-closed');
            }
        }
    });

    // Admin actions
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#nav-db-btn');
        if (btn) {
            openAdminDbModal();
        }

        const tabBtn = e.target.closest('.db-tab-btn');
        if (tabBtn) {
            const parentWrap = tabBtn.closest('.db-tabs') || document;
            parentWrap.querySelectorAll('.db-tab-btn').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            
            if (typeof dashboardFetchDbData === 'function') {
                dashboardFetchDbData(tabBtn.dataset.tab);
            }
        }

        if (e.target.closest('#close-db-modal-btn') || e.target.closest('#close-db-modal-dot') || e.target.classList.contains('modal-overlay')) {
            const modal = document.getElementById('admin-db-modal');
            if (modal && modal.classList.contains('active')) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        // DELETE PORTFOLIO ITEM
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn && window.isAdmin) {
            const id = deleteBtn.dataset.id;
            const confirmMsg = currentLang === 'cs' ? 'OPRAVDU SMAZAT TENTO ZÁZNAM?' : 'PERMANENTLY DELETE THIS RECORD?';
            if (confirm(confirmMsg)) {
                deletePortfolioItem(id, deleteBtn.closest('.port-item'));
            }
        }
    });

    // Forms
    document.addEventListener('submit', (e) => {
        if (e.target.id === 'login-form') handleLogin(e);
        if (e.target.id === 'register-form') handleRegister(e);
    });

    // Password Strength
    document.addEventListener('input', (e) => {
        if (e.target.id === 'reg-password') {
            const val = e.target.value;
            const bar = document.querySelector('.strength-bar');
            if (!bar) return;
            bar.className = 'strength-bar';
            if (val.length > 0) {
                if (val.length < 6) bar.classList.add('weak');
                else if (val.match(/[A-Z]/) && val.match(/[0-9]/)) bar.classList.add('strong');
                else bar.classList.add('medium');
            }
        }
    });
}

// ADMIN DB FUNCTIONS
function openAdminDbModal() {
    const modal = document.getElementById('admin-db-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Default to submissions
    if (typeof dashboardFetchDbData === 'function') {
        dashboardFetchDbData('messages');
    }
}


function openAuthModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('active');
    window.toggleBodyLock(true);
    if (window.animateModalOpen) window.animateModalOpen(id);
}

function closeAuthModal(id) {
    if (window.animateModalClose) {
        window.animateModalClose(id, () => {
            document.getElementById(id).classList.remove('active');
            window.toggleBodyLock(false);
        });
    } else {
        document.getElementById(id).classList.remove('active');
        window.toggleBodyLock(false);
    }
}

function switchModals(from, to) {
    if (window.transitionAuthPanels) {
        window.transitionAuthPanels(from, to);
    } else {
        document.getElementById(from).classList.remove('active');
        document.getElementById(to).classList.add('active');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-dot"></div>
        <div class="toast-msg">${message.toUpperCase()}</div>
    `;
    container.appendChild(toast);

    if (window.animateToastIn) window.animateToastIn(toast);
    
    setTimeout(() => {
        if (window.animateToastOut) {
            window.animateToastOut(toast, () => toast.remove());
        } else {
            toast.remove();
        }
    }, 4000);
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    // ... logic same ...
    const email = form.email.value;
    const password = form.password.value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast(`WELCOME BACK, ${data.fullName.toUpperCase()}!`, 'success');
            closeAuthModal('login-modal');
            checkAuth();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function handleLogout() {
    try {
        const res = await fetch('/api/logout', { method: 'POST' });
        if (res.ok) {
            showToast('LOGGED OUT.', 'info');
            setTimeout(() => window.location.reload(), 1000);
        }
    } catch (err) {
        console.error('Logout failed:', err);
        window.location.reload();
    }
}

// Global click listener for main logout and other dynamic elements
document.addEventListener('click', (e) => {
    if (e.target.id === 'main-logout-btn') {
        handleLogout();
    }
});

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const fullName = form.fullName.value;
    const email = form.email.value;
    const password = form.password.value;
    const confirm = form.confirmPassword.value;

    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Account created. Welcome.', 'success');
            closeAuthModal('reg-modal');
            checkAuth();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

function toggleBtnLoading(btn, loading) {
    // Keeping simple for now
    if (btn) btn.disabled = loading;
}

async function deletePortfolioItem(id, element) {
    try {
        const res = await fetch(`/api/portfolio/${id}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            showToast(currentLang === 'cs' ? 'ZÁZNAM BYL SMAZÁN' : 'RECORD DELETED', 'success');
            
            // Animate removal
            if (element) {
                gsap.to(element, {
                    opacity: 0,
                    scale: 0.8,
                    duration: 0.4,
                    onComplete: () => {
                        element.remove();
                        // Reload portfolio data in memory
                        loadPortfolio();
                    }
                });
            } else {
                loadPortfolio();
            }
        } else {
            const data = await res.json();
            showToast('ERROR: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('DELETE FAILED', 'error');
    }
}

