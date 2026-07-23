// DOM Elements
const yearEl = document.getElementById('year');
const portfolioGrid = document.getElementById('portfolio-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');
const reviewsGrid = document.getElementById('reviews-grid');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxMedia = document.getElementById('lightbox-media-container');

// Localization
const btnCS = document.getElementById('lang-cs');
const btnEN = document.getElementById('lang-en');
const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get('lang');
let currentLang = (langParam === 'cs' || langParam === 'en') ? langParam : (localStorage.getItem('karbyLang') || 'cs');
if (langParam === 'cs' || langParam === 'en') {
    localStorage.setItem('karbyLang', currentLang);
}

// State
let currentUser = null;
let portfolioData = [];
let currentFolderItems = [];
let currentLightboxIndex = -1;

// Admin Selection & Reordering State
let isSelectionMode = false;
let selectedItems = new Set();
let selectedSubfolders = new Set();
let sortableInstance = null;

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
    initCookieConsent();
    loadSettings(); // Load site settings (Hero Video etc)
    loadPortfolio();
    if (typeof window.loadFolders === 'function') window.loadFolders();
    loadTestimonials();
    checkAuth(); 
    initAuthUI(); 



    // --- Hero Tag Click Interactions ---
    const tags = document.querySelectorAll('.discipline-tag');
    tags.forEach(tag => {
        tag.addEventListener('click', (e) => {
            const csVal = tag.getAttribute('data-cs') || '';
            const enVal = tag.getAttribute('data-en') || '';
            
            let targetCategory = '';
            if (csVal === 'VIDEOKLIPY' || enVal === 'MUSIC VIDEOS') targetCategory = 'VIDEOKLIPY';
            else if (csVal === 'NATÁČENÍ AKCÍ' || enVal === 'EVENT FILMING') targetCategory = 'AKCE';
            else if (csVal === 'YOUTUBE EDIT' || enVal === 'YOUTUBE EDIT') targetCategory = 'YOUTUBE';
            else if (csVal === 'FOTOGRAFIE' || enVal === 'PHOTOGRAPHY') targetCategory = 'PHOTOGRAPHY';
            
            if (!targetCategory) return;
            
            e.preventDefault();
            
            // Scroll to portfolio
            const portfolioSec = document.getElementById('portfolio');
            if (portfolioSec) {
                if (window.lenis) {
                    window.lenis.scrollTo(portfolioSec, { offset: -50, duration: 1.2 });
                } else {
                    portfolioSec.scrollIntoView({ behavior: 'smooth' });
                }
                
                // After scroll, find folder, flash highlight and open it
                setTimeout(() => {
                    const folder = document.querySelector(`.folder-item[data-category="${targetCategory}"]`);
                    if (folder) {
                        folder.classList.add('highlight-glow');
                        // Trigger folder open after the glow pulse completes
                        setTimeout(() => {
                            folder.click();
                            folder.classList.remove('highlight-glow');
                        }, 700);
                    }
                }, 900);
            }
        });
    });

    // --- Form Diagnostic Protocol Calculator ---
    const contactForm = document.getElementById('contact-form');
    const integrityVal = document.getElementById('form-integrity-val');
    const integrityProgress = document.getElementById('form-integrity-progress');
    const stateVal = document.getElementById('form-state-val');

    if (contactForm && integrityVal && integrityProgress && stateVal) {
        const requiredInputs = contactForm.querySelectorAll('input[required], textarea[required]');
        
        const updateFormDiagnostics = () => {
            let filledRequired = 0;
            requiredInputs.forEach(input => {
                if (input.value.trim() !== '') filledRequired++;
            });
            
            // Check radio groups
            const projectTypeChecked = contactForm.querySelector('input[name="project_type"]:checked') ? 1 : 0;
            const budgetChecked = contactForm.querySelector('input[name="budget"]:checked') ? 1 : 0;
            
            const totalFields = requiredInputs.length + 2; // Required fields + 2 matrices
            const totalFilled = filledRequired + projectTypeChecked + budgetChecked;
            
            const percentage = Math.round((totalFilled / totalFields) * 100);
            
            if (integrityVal) integrityVal.textContent = percentage + '%';
            if (integrityProgress) gsap.to(integrityProgress, { width: percentage + '%', duration: 0.4, ease: "power2.out" });
            
            if (percentage === 0) {
                stateVal.textContent = 'IDLE';
            } else if (percentage === 100) {
                stateVal.textContent = 'READY_TO_TRANSMIT';
            } else {
                stateVal.textContent = 'BUFFERING_DATA';
            }
        };

        contactForm.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                stateVal.textContent = 'WRITING_DATA...';
                // Slight delay so the user sees the 'WRITING_DATA...' state before updating metric
                setTimeout(() => {
                    updateFormDiagnostics();
                }, 600);
            } else {
                updateFormDiagnostics();
            }
        });
        
        // Initial run
        updateFormDiagnostics();
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
                    
                    // Reset admin modes
                    isSelectionMode = false;
                    selectedItems.clear();
                    selectedSubfolders.clear();
                    window.currentFolderStack = [];
                    if (typeof updateBatchBar === 'function') updateBatchBar();
                    if (sortableInstance) {
                        sortableInstance.destroy();
                        sortableInstance = null;
                    }

                    // Reset to initial state for next open
                    gsap.set(modalContent, { opacity: 0 });
                    gsap.set(folderModal.querySelector('.modal-overlay'), { opacity: 0 });
                }
            });

            // Smoothly fade out the items first for extra polish
            tl.to("#folder-items-grid .reveal-fade", {
                opacity: 0,
                duration: 0.3,
                stagger: {
                    each: 0.02,
                    from: "end"
                },
                ease: "power2.in"
            })
            .to(modalContent, {
                opacity: 0,
                duration: 0.5,
                ease: "expo.in"
            }, "-=0.15")
            .to(folderModal.querySelector('.modal-overlay'), {
                opacity: 0,
                duration: 0.4
            }, "-=0.4");
        }
    };

    const handleFolderCloseOrBack = () => {
        if (window.currentFolderStack && window.currentFolderStack.length > 1) {
            window.currentFolderStack.pop();
            const parentState = window.currentFolderStack[window.currentFolderStack.length - 1];
            openFolderModal(parentState.category, parentState.titles, parentState.originEl);
        } else {
            closeFolder();
        }
    };

    if (closeFolderBtn) closeFolderBtn.addEventListener('click', handleFolderCloseOrBack);
    if (closeFolderDot) closeFolderDot.addEventListener('click', handleFolderCloseOrBack);
    
    if (folderModal) {
        folderModal.querySelector('.modal-overlay')?.addEventListener('click', handleFolderCloseOrBack);
    }

    // Contact Form Event
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }
    
    // Lightbox Close
    if(lightboxModal) {
        lightboxModal.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', closeLightbox));
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

        // Touch Swipe Navigation for Mobile
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        lightboxModal.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        lightboxModal.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            // Threshold for horizontal swipe (50px)
            // Ensure swipe is mostly horizontal, not vertical
            if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 0) {
                    navigateLightbox(-1); // Swipe Right -> Previous
                } else {
                    navigateLightbox(1);  // Swipe Left -> Next
                }
            }
        }
    }

    function closeLightbox() {
        if (!lightboxModal.classList.contains('active')) return;
        const modalContent = lightboxModal.querySelector('.modal-content');
        
        const tl = gsap.timeline({
            onComplete: () => {
                lightboxModal.classList.remove('active');
                lightboxMedia.innerHTML = '';
                if (window.toggleBodyLock) window.toggleBodyLock(false);
                if (window.location.hash.startsWith('#work-')) {
                    history.replaceState(null, null, window.location.pathname);
                }
                gsap.set(modalContent, { scale: 0.92, opacity: 0 });
                gsap.set(lightboxModal.querySelector('.modal-overlay'), { opacity: 0 });
            }
        });
        
        tl.to(modalContent, {
            scale: 0.92,
            opacity: 0,
            duration: 0.5,
            ease: "expo.in"
        })
        .to(lightboxModal.querySelector('.modal-overlay'), {
            opacity: 0,
            duration: 0.4
        }, "-=0.4");
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
            else if (activeModal.id === 'folder-modal') handleFolderCloseOrBack();
            else if (activeModal.id === 'admin-dashboard-modal') document.getElementById('close-dashboard-btn').click();
        }

        if (activeModal.id === 'lightbox-modal') {
            if (e.key === 'ArrowRight') navigateLightbox(1);
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
        }
    });

    // Hero Video Click to Open Lightbox
    const heroVideoTrigger = document.getElementById('hero-video-trigger');
    if (heroVideoTrigger) {
        heroVideoTrigger.addEventListener('click', () => {
            const iframe = heroVideoTrigger.querySelector('iframe');
            let src = iframe ? iframe.src : 'https://www.youtube.com/watch?v=_VWkv_ONEiM';
            
            const item = {
                title: 'KARBYVISUALS SHOWREEL',
                category: 'SHOWREEL',
                description: 'Vizuální produkce bez kompromisů.',
                media_url: src
            };
            
            currentFolderItems = [item];
            currentLightboxIndex = 0;
            openLightbox(item);
        });
    }


    // Modified Close logic to use window helper
});

// ==========================================
// SETTINGS
// ==========================================
async function loadSettings() {
    const defaultUrl = 'https://www.youtube.com/embed/_VWkv_ONEiM?autoplay=1&mute=1&loop=1&playlist=_VWkv_ONEiM&modestbranding=1&rel=0&controls=1';
    const heroIframe = document.querySelector('.hs-video-iframe');
    
    // Helper to safely set src and handle fade-in/out transition
    const setIframeSrc = (url) => {
        if (!heroIframe) return;
        
        // If the URL is already set to the same target, just show it
        if (heroIframe.src === url) {
            heroIframe.style.opacity = '1';
            return;
        }
        
        // Fade out if it was already visible
        heroIframe.style.opacity = '0';
        
        heroIframe.addEventListener('load', () => {
            heroIframe.style.opacity = '1';
        }, { once: true });
        
        heroIframe.src = url;
    };

    try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
            setIframeSrc(defaultUrl);
            return;
        }
        const settings = await res.json();
        
        // Update Hero Video
        if (settings.hero_video_url) {
            let url = settings.hero_video_url;
            
            // YouTube cleaning
            let ytId = '';
            if (url.includes('youtube.com/watch?v=')) {
                ytId = url.split('v=')[1].split(/[&#]/)[0];
            } else if (url.includes('youtu.be/')) {
                ytId = url.split('youtu.be/')[1].split(/[?#]/)[0];
            } else if (url.includes('youtube.com/embed/')) {
                ytId = url.split('embed/')[1].split(/[?&#]/)[0];
            } else if (url.includes('youtube.com/shorts/')) {
                ytId = url.split('shorts/')[1].split(/[?&#]/)[0];
            }

            if (ytId) {
                url = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&modestbranding=1&rel=0&controls=1`;
            } else if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
                const vidId = url.split('vimeo.com/')[1].split(/[?#]/)[0];
                url = `https://player.vimeo.com/video/${vidId}?autoplay=1&muted=1&loop=1&controls=1`;
            } else if (url.includes('player.vimeo.com')) {
                let parts = url.split('video/');
                if (parts[1]) {
                    let vimeoId = parts[1].split(/[?#]/)[0];
                    url = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&controls=1`;
                }
            }

            setIframeSrc(url);
        } else {
            setIframeSrc(defaultUrl);
        }
    } catch (err) {
        console.error('Settings load error:', err);
        setIframeSrc(defaultUrl);
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

    // Update active state in mobile drawer
    const drawerCS = document.querySelector('.drawer-lang-btn.cs-btn');
    const drawerEN = document.querySelector('.drawer-lang-btn.en-btn');
    if (drawerCS) drawerCS.classList.toggle('active', lang === 'cs');
    if (drawerEN) drawerEN.classList.toggle('active', lang === 'en');

    // Refresh active folder modal if open
    const folderModal = document.getElementById('folder-modal');
    if (folderModal && folderModal.classList.contains('active') && window.currentFolderStack && window.currentFolderStack.length > 0) {
        const activeState = window.currentFolderStack[window.currentFolderStack.length - 1];
        openFolderModal(activeState.category, activeState.titles, activeState.originEl);
    }

    // Refresh main page folders language display
    if (typeof loadFolders === 'function') {
        loadFolders();
    }
}
window.switchLanguage = switchLanguage;

function updateLanguageUI(lang) {
    document.documentElement.setAttribute('lang', lang);
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
        // Check for direct link via hash
        checkHashRouting();
    } catch (err) {
        console.error('Portfolio load error:', err);
    }
}

function checkHashRouting() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#work-')) {
        const id = parseInt(hash.replace('#work-', ''), 10);
        if (!isNaN(id)) {
            const item = portfolioData.find(p => p.id === id);
            if (item) {
                const categoryItems = portfolioData.filter(p => p.category === item.category);
                currentFolderItems = categoryItems;
                currentLightboxIndex = categoryItems.findIndex(p => p.id === item.id);
                openLightbox(item);
            }
        }
    }
}

window.loadFolders = async function() {
    const grid = document.getElementById('archive-grid');
    if (!grid) return;

    try {
        const res = await fetch('/api/folders');
        if (!res.ok) throw new Error('API fetch failed');
        const folders = await res.json();
        window.allFoldersData = folders;
        
        if (folders && folders.length > 0) {
            grid.innerHTML = '';
            const rootFolders = folders.filter(f => !f.parent_id);
            const displayFolders = rootFolders.length > 0 ? rootFolders : folders;
            displayFolders.forEach((f, idx) => {
                const div = document.createElement('div');
                div.className = 'folder-item reveal-fade';
                div.setAttribute('data-category', f.category_id);
                // Delay slightly for visual effect
                div.style.animationDelay = `${idx * 0.1}s`;
                
                div.innerHTML = `
                    <div class="folder-icon-wrap">
                        <img src="${f.icon_url || '/assets/folder-icon.png'}" alt="Folder" class="folder-icon">
                    </div>
                    <span class="folder-name" data-cs="${f.title_cs}" data-en="${f.title_en}">${currentLang === 'cs' ? f.title_cs : f.title_en}</span>
                `;
                
                let clickTimeout = null;
                div.addEventListener('click', () => {
                    if (window.isAdmin) {
                        if (clickTimeout) {
                            clearTimeout(clickTimeout);
                            clickTimeout = null;
                            return; // Handle via dblclick
                        }
                        clickTimeout = setTimeout(() => {
                            window.currentFolderStack = [{ category: f.category_id, titles: { cs: f.title_cs, en: f.title_en, id: f.id }, originEl: div }];
                            openFolderModal(f.category_id, { cs: f.title_cs, en: f.title_en, id: f.id }, div);
                            clickTimeout = null;
                        }, 250);
                    } else {
                        window.currentFolderStack = [{ category: f.category_id, titles: { cs: f.title_cs, en: f.title_en, id: f.id }, originEl: div }];
                        openFolderModal(f.category_id, { cs: f.title_cs, en: f.title_en, id: f.id }, div);
                    }
                });

                div.addEventListener('dblclick', (e) => {
                    if (window.isAdmin) {
                        e.stopPropagation();
                        if (clickTimeout) {
                            clearTimeout(clickTimeout);
                            clickTimeout = null;
                        }
                        
                        const nameEl = div.querySelector('.folder-name');
                        if (nameEl.querySelector('input')) return; // Already editing

                        const originalCS = f.title_cs;
                        const originalEN = f.title_en;

                        nameEl.innerHTML = `
                            <div class="folder-grid-rename" onclick="event.stopPropagation()">
                                <input type="text" value="${originalCS}" class="edit-cs-input tactical-input-xs">
                                <input type="text" value="${originalEN}" class="edit-en-input tactical-input-xs">
                                <button class="save-grid-rename"><i class="ph ph-check"></i></button>
                            </div>
                        `;

                        const saveBtn = nameEl.querySelector('.save-grid-rename');
                        const inputs = nameEl.querySelectorAll('input');

                        let isSaving = false;
                        const performSave = async () => {
                            if (isSaving) return;
                            isSaving = true;

                            const newCS = nameEl.querySelector('.edit-cs-input').value;
                            const newEN = nameEl.querySelector('.edit-en-input').value;
                            
                            if (newCS && newEN && (newCS !== originalCS || newEN !== originalEN)) {
                                try {
                                    const res = await fetch(`/api/admin/folders/update/${f.id}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ titleCS: newCS, titleEN: newEN })
                                    });
                                    if (res.ok) {
                                        showToast('FOLDER_RENAMED', 'success');
                                        window.loadFolders();
                                    } else {
                                        const errData = await res.json().catch(() => ({}));
                                        showToast(`RENAME_FAILED: ${res.status} ${errData.error || ''}`, 'error');
                                        window.loadFolders();
                                    }
                                } catch (err) {
                                    showToast('RENAME_NETWORK_ERROR', 'error');
                                    window.loadFolders();
                                }
                            } else {
                                window.loadFolders(); 
                            }
                        };

                        inputs.forEach(input => {
                            input.addEventListener('keydown', (ke) => {
                                if (ke.key === 'Enter') {
                                    ke.preventDefault();
                                    performSave();
                                }
                                if (ke.key === 'Escape') {
                                    ke.preventDefault();
                                    window.loadFolders();
                                }
                            });
                            input.addEventListener('blur', (be) => {
                                setTimeout(() => {
                                    if (!nameEl.contains(document.activeElement)) {
                                        performSave();
                                    }
                                }, 200);
                            });
                        });

                        saveBtn.onclick = (se) => {
                            se.preventDefault();
                            se.stopPropagation();
                            performSave();
                        };
                        
                        inputs[0].focus();
                    }
                });
                
                grid.appendChild(div);
            });
            return; // We successfully loaded DB folders, exit fallback
        }
    } catch(err) {
        console.warn('Folders load fallback active (DB not loaded yet):', err);
    }

    // Fallback: Bind event listeners to existing static HTML
    grid.querySelectorAll('.folder-item').forEach(folder => {
        if (folder.dataset.bound) return;
        folder.dataset.bound = "true";
        
        folder.addEventListener('click', () => {
            const category = folder.getAttribute('data-category');
            const nameEl = folder.querySelector('.folder-name');
            const titleCS = nameEl.getAttribute('data-cs') || nameEl.textContent;
            const titleEN = nameEl.getAttribute('data-en') || nameEl.textContent;
            openFolderModal(category, { cs: titleCS, en: titleEN }, folder);
        });
    });
};

function openFolderModal(category, titles, originEl) {
    const modal = document.getElementById('folder-modal');
    const modalContent = modal.querySelector('.modal-content');
    const grid = document.getElementById('folder-items-grid');
    const titleEl = document.getElementById('folder-modal-title');

    if (!modal || !grid) return;

    if (!window.currentFolderStack || window.currentFolderStack.length === 0) {
        window.currentFolderStack = [{ category, titles, originEl }];
    }

    // Save origin
    if (originEl) {
        modal.dataset.originId = originEl.getAttribute('data-id') || '';
    }

    const currentStackItem = window.currentFolderStack[window.currentFolderStack.length - 1];
    const activeCategory = currentStackItem.category;
    const activeTitles = currentStackItem.titles;

    // Update Title & Back Button
    const backBtn = document.getElementById('folder-modal-back-btn');
    const displayTitle = currentLang === 'cs' ? activeTitles.cs : activeTitles.en;
    
    titleEl.innerHTML = `<span class="title-text" data-cs="[ ${activeTitles.cs} ]" data-en="[ ${activeTitles.en} ]">[ ${displayTitle} ]</span>`;

    if (window.currentFolderStack.length > 1) {
        const prevStackItem = window.currentFolderStack[window.currentFolderStack.length - 2];
        const prevTitleCS = prevStackItem.titles.cs;
        const prevTitleEN = prevStackItem.titles.en;
        const backPrefix = currentLang === 'cs' ? 'ZPĚT DO' : 'BACK TO';
        const targetTitle = (currentLang === 'cs' ? prevTitleCS : prevTitleEN).toUpperCase();
        
        if (backBtn) {
            backBtn.classList.remove('hidden');
            backBtn.setAttribute('data-cs', `ZPĚT DO ${prevTitleCS.toUpperCase()}`);
            backBtn.setAttribute('data-en', `BACK TO ${prevTitleEN.toUpperCase()}`);

            const backTextEl = backBtn.querySelector('.back-text');
            if (backTextEl) backTextEl.textContent = `${backPrefix} ${targetTitle}`;
            else backBtn.innerHTML = `<i class="ph ph-arrow-left"></i> <span class="back-text">${backPrefix} ${targetTitle}</span>`;
            
            backBtn.onclick = (e) => {
                e.stopPropagation();
                window.currentFolderStack.pop();
                const parentState = window.currentFolderStack[window.currentFolderStack.length - 1];
                openFolderModal(parentState.category, parentState.titles, parentState.originEl);
            };
        }
    } else {
        if (backBtn) backBtn.classList.add('hidden');
    }

    // Admin Controls (Selection, Reorder & Add Subfolder)
    if (window.isAdmin) {
        // Remove existing controls to avoid duplicates
        const existingControls = modal.querySelector('.folder-admin-controls');
        if (existingControls) existingControls.remove();

        const controlsWrap = document.createElement('div');
        controlsWrap.className = 'folder-admin-controls';
        
        const selectionBtn = document.createElement('button');
        selectionBtn.className = `btn-admin-mode btn-toggle-selection ${isSelectionMode ? 'active' : ''}`;
        selectionBtn.innerHTML = `<i class="ph ph-check-square"></i> ${isSelectionMode ? 'STOP SELECTION' : 'SELECT ITEMS'}`;
        selectionBtn.onclick = () => toggleSelectionMode();
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = `btn-admin-mode btn-select-all ${isSelectionMode ? '' : 'hidden'}`;
        selectAllBtn.innerHTML = '<i class="ph ph-list-checks"></i> SELECT ALL';
        selectAllBtn.onclick = () => toggleSelectAll();

        const reorderBtn = document.createElement('button');
        reorderBtn.className = `btn-admin-mode ${sortableInstance ? 'active' : ''}`;
        reorderBtn.id = 'reorder-btn';
        reorderBtn.innerHTML = sortableInstance ? '<i class="ph ph-check"></i> SAVE ORDER' : '<i class="ph ph-arrows-out-cardinal"></i> ENABLE SORTING';
        reorderBtn.onclick = () => toggleSortingMode(grid);
        
        const addSubfolderBtn = document.createElement('button');
        addSubfolderBtn.className = 'btn-admin-mode btn-add-subfolder';
        addSubfolderBtn.innerHTML = `<i class="ph ph-folder-plus"></i> ${currentLang === 'cs' ? 'VYTVOŘIT PODSLOŽKU' : 'CREATE SUBFOLDER'}`;
        addSubfolderBtn.onclick = () => {
            let inlineForm = controlsWrap.querySelector('.create-subfolder-inline');
            if (inlineForm) {
                inlineForm.remove();
                return;
            }
            inlineForm = document.createElement('div');
            inlineForm.className = 'create-subfolder-inline';
            inlineForm.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:8px; padding:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; width:100%; grid-column: 1 / -1;';
            inlineForm.innerHTML = `
                <input type="text" class="subfolder-cs-input tactical-input-sm" placeholder="NÁZEV PODSLOŽKY (CZ)" style="flex:1;">
                <input type="text" class="subfolder-en-input tactical-input-sm" placeholder="NÁZEV PODSLOŽKY (EN)" style="flex:1;">
                <button class="btn-admin-mode btn-confirm-subfolder" style="color:#4CAF50;"><i class="ph ph-check"></i> ${currentLang === 'cs' ? 'VYTVOŘIT' : 'CREATE'}</button>
                <button class="btn-admin-mode btn-cancel-subfolder"><i class="ph ph-x"></i></button>
            `;
            
            const csInput = inlineForm.querySelector('.subfolder-cs-input');
            const enInput = inlineForm.querySelector('.subfolder-en-input');
            const confirmBtn = inlineForm.querySelector('.btn-confirm-subfolder');
            const cancelBtn = inlineForm.querySelector('.btn-cancel-subfolder');
            
            cancelBtn.onclick = () => inlineForm.remove();
            
            const doCreate = async () => {
                const cs = csInput.value.trim();
                let en = enInput.value.trim() || cs;
                if (!cs) {
                    if (window.showToast) window.showToast('NÁZEV JE POVINNÝ', 'error');
                    return;
                }
                try {
                    const res = await fetch('/api/folders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ titleCS: cs, titleEN: en, parentId: activeTitles.id })
                    });
                    if (res.ok) {
                        if (window.showToast) window.showToast('PODSLOŽKA VYTVOŘENA', 'success');
                        inlineForm.remove();
                        const freshRes = await fetch('/api/folders');
                        if (freshRes.ok) window.allFoldersData = await freshRes.json();
                        openFolderModal(activeCategory, activeTitles, originEl);
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        if (window.showToast) window.showToast('CHYBA: ' + (errData.error || 'Neznámá chyba'), 'error');
                    }
                } catch (err) {
                    if (window.showToast) window.showToast('NETWORK ERROR', 'error');
                }
            };
            
            confirmBtn.onclick = doCreate;
            [csInput, enInput].forEach(inp => {
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') doCreate();
                    if (e.key === 'Escape') inlineForm.remove();
                });
            });

            controlsWrap.appendChild(inlineForm);
            csInput.focus();
        };

        controlsWrap.appendChild(selectionBtn);
        controlsWrap.appendChild(selectAllBtn);
        controlsWrap.appendChild(reorderBtn);
        controlsWrap.appendChild(addSubfolderBtn);
        
        grid.parentNode.insertBefore(controlsWrap, grid);
    }
    
    // Admin Rename Feature (Double Click & Pencil Icon)
    const targetFolderId = (activeTitles ? activeTitles.id : null) || (window.allFoldersData && window.allFoldersData.find(f => 
        (activeCategory && f.category_id && f.category_id.toUpperCase() === activeCategory.toUpperCase()) ||
        (f.title_cs && activeTitles && f.title_cs === activeTitles.cs) ||
        (f.title_en && activeTitles && f.title_en === activeTitles.en)
    )?.id);

    if (window.isAdmin && targetFolderId) {
        if (activeTitles && !activeTitles.id) {
            activeTitles.id = targetFolderId;
        }

        titleEl.style.pointerEvents = 'auto';

        const titleText = titleEl.querySelector('.title-text');
        if (titleText) {
            titleText.style.cursor = 'pointer';
            titleText.title = "DOUBLE_CLICK_TO_RENAME";
            
            const renameBtn = document.createElement('button');
            renameBtn.className = 'btn-tactical-subtle';
            renameBtn.style.marginLeft = '1rem';
            renameBtn.innerHTML = '<i class="ph ph-pencil-simple"></i>';
            renameBtn.title = "RENAME_FOLDER";
            
            const startRename = (e) => {
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }

                titleEl.innerHTML = `
                    <div class="folder-rename-mini-menu" onclick="event.stopPropagation()">
                        <input type="text" class="rename-cs-input tactical-input-sm" value="${activeTitles.cs || ''}" placeholder="CZ NAME">
                        <input type="text" class="rename-en-input tactical-input-sm" value="${activeTitles.en || ''}" placeholder="EN NAME">
                        <button id="save-rename" class="btn-tactical-subtle" style="color:#4CAF50;" title="Uložit"><i class="ph ph-check"></i></button>
                        <button id="cancel-rename" class="btn-tactical-subtle" title="Zrušit"><i class="ph ph-x"></i></button>
                    </div>
                `;
                
                const csInput = titleEl.querySelector('.rename-cs-input');
                const enInput = titleEl.querySelector('.rename-en-input');
                const saveBtn = titleEl.querySelector('#save-rename');
                const cancelBtn = titleEl.querySelector('#cancel-rename');

                if (csInput) csInput.focus();

                const cancelAction = (ce) => {
                    if (ce) ce.stopPropagation();
                    openFolderModal(activeCategory, activeTitles, originEl);
                };

                let isSaving = false;
                const saveAction = async (se) => {
                    if (se) se.stopPropagation();
                    if (isSaving) return;

                    const curCsInput = titleEl.querySelector('.rename-cs-input');
                    const curEnInput = titleEl.querySelector('.rename-en-input');
                    if (!curCsInput || !curEnInput) return;

                    const newCS = curCsInput.value.trim();
                    const newEN = curEnInput.value.trim();
                    
                    if (!newCS || !newEN) {
                        if (window.showToast) window.showToast('NÁZEV NESMÍ BÝT PRÁZDNÝ', 'error');
                        return;
                    }

                    isSaving = true;
                    try {
                        const res = await fetch(`/api/admin/folders/update/${targetFolderId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ titleCS: newCS, titleEN: newEN })
                        });
                        if (res.ok) {
                            if (window.showToast) window.showToast('FOLDER_RENAMED', 'success');
                            activeTitles.cs = newCS;
                            activeTitles.en = newEN;
                            activeTitles.id = targetFolderId;
                            const freshRes = await fetch('/api/folders');
                            if (freshRes.ok) window.allFoldersData = await freshRes.json();
                            openFolderModal(activeCategory, activeTitles, originEl);
                            if (window.loadFolders) window.loadFolders();
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            if (window.showToast) window.showToast(`RENAME_FAILED: ${res.status} ${errData.error || ''}`, 'error');
                            isSaving = false;
                        }
                    } catch (err) {
                        if (window.showToast) window.showToast('RENAME_NETWORK_ERROR', 'error');
                        isSaving = false;
                    }
                };

                if (cancelBtn) cancelBtn.onclick = cancelAction;
                if (saveBtn) saveBtn.onclick = saveAction;

                [csInput, enInput].forEach(input => {
                    if (!input) return;
                    input.addEventListener('keydown', (ke) => {
                        if (ke.key === 'Enter') {
                            ke.preventDefault();
                            saveAction(ke);
                        }
                        if (ke.key === 'Escape') {
                            ke.preventDefault();
                            cancelAction(ke);
                        }
                    });
                });
            };

            renameBtn.onclick = startRename;
            titleText.ondblclick = startRename;
            titleEl.appendChild(renameBtn);
        }
    }

    // Filter Portfolio Items (Standardized Categories)
    let filtered = portfolioData.filter(item => {
        const dbCat = item.category.toUpperCase();
        const targetCat = activeCategory.toUpperCase();
        
        if (dbCat === targetCat) return true;
        
        // Legacy fallbacks for old DB records on root folders
        if (window.currentFolderStack.length === 1) {
            if (targetCat === 'PHOTOGRAPHY' || targetCat === 'FOTKY') return dbCat === 'PHOTOGRAPHY';
            if (targetCat === 'VIDEOKLIPY') return dbCat === 'VIDEOKLIPY' || dbCat === 'EDITING' || dbCat === 'CINEMATOGRAPHY';
        }
        
        return false;
    });

    currentFolderItems = filtered;
    
    // DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    // Render Subfolders first
    const currentFolderId = activeTitles ? activeTitles.id : null;
    const subfolders = (window.allFoldersData || []).filter(f => f.parent_id && f.parent_id === currentFolderId);
    subfolders.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    if (subfolders.length > 0) {
        subfolders.forEach(sf => {
            const div = document.createElement('div');
            div.className = `folder-item subfolder-card reveal-fade active ${isSelectionMode ? 'selecting' : ''} ${selectedSubfolders.has(sf.id) ? 'selected' : ''}`;
            div.setAttribute('data-category', sf.category_id);
            div.setAttribute('data-id', sf.id);
            div.setAttribute('data-type', 'folder');
            
            div.innerHTML = `
                <div class="folder-icon-wrap">
                    <img src="${sf.icon_url || '/assets/folder-icon.png'}" alt="Folder" class="folder-icon">
                </div>
                <span class="folder-name" data-cs="${sf.title_cs}" data-en="${sf.title_en}">${currentLang === 'cs' ? sf.title_cs : sf.title_en}</span>
                ${window.isAdmin ? `
                    <div class="subfolder-admin-actions" onclick="event.stopPropagation()">
                        <button class="btn-subfolder-rename" title="Přejmenovat"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-subfolder-delete" title="Smazat"><i class="ph ph-trash"></i></button>
                    </div>
                ` : ''}
            `;
            
            div.addEventListener('click', (e) => {
                if (e.target.closest('.subfolder-admin-actions')) return;
                
                if (isSelectionMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSubfolderSelection(sf.id, div);
                } else {
                    window.currentFolderStack.push({
                        category: sf.category_id,
                        titles: { cs: sf.title_cs, en: sf.title_en, id: sf.id },
                        originEl: div
                    });
                    openFolderModal(sf.category_id, { cs: sf.title_cs, en: sf.title_en, id: sf.id }, div);
                }
            });

            if (window.isAdmin) {
                const renameBtn = div.querySelector('.btn-subfolder-rename');
                const deleteBtn = div.querySelector('.btn-subfolder-delete');

                if (renameBtn) {
                    renameBtn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        const nameEl = div.querySelector('.folder-name');
                        if (!nameEl || nameEl.querySelector('input')) return;

                        const originalCS = sf.title_cs;
                        const originalEN = sf.title_en;

                        nameEl.innerHTML = `
                            <div class="folder-grid-rename subfolder-inline-rename" onclick="event.stopPropagation()">
                                <input type="text" value="${originalCS}" class="edit-cs-input tactical-input-xs" placeholder="CZ NÁZEV">
                                <input type="text" value="${originalEN}" class="edit-en-input tactical-input-xs" placeholder="EN NÁZEV">
                                <div style="display:flex; gap:6px; margin-top:4px;">
                                    <button class="save-subfolder-rename save-grid-rename" style="background:#4CAF50; color:#fff;" title="Uložit"><i class="ph ph-check"></i></button>
                                    <button class="cancel-subfolder-rename save-grid-rename" style="background:rgba(255,255,255,0.2); color:#fff;" title="Zrušit"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                        `;

                        const csInput = nameEl.querySelector('.edit-cs-input');
                        const enInput = nameEl.querySelector('.edit-en-input');
                        const saveBtn = nameEl.querySelector('.save-subfolder-rename');
                        const cancelBtn = nameEl.querySelector('.cancel-subfolder-rename');

                        if (csInput) csInput.focus();

                        const cancelAction = (ce) => {
                            if (ce) ce.stopPropagation();
                            openFolderModal(activeCategory, activeTitles, originEl);
                        };

                        let isSaving = false;
                        const performSave = async (se) => {
                            if (se) se.stopPropagation();
                            if (isSaving) return;

                            const curCs = nameEl.querySelector('.edit-cs-input')?.value.trim();
                            const curEn = nameEl.querySelector('.edit-en-input')?.value.trim();

                            if (!curCs || !curEn) {
                                if (window.showToast) window.showToast('NÁZEV NESMÍ BÝT PRÁZDNÝ', 'error');
                                return;
                            }

                            if (curCs === originalCS && curEn === originalEN) {
                                cancelAction();
                                return;
                            }

                            isSaving = true;
                            try {
                                const res = await fetch(`/api/admin/folders/update/${sf.id}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ titleCS: curCs, titleEN: curEn })
                                });
                                if (res.ok) {
                                    if (window.showToast) window.showToast('PODSLOŽKA PŘEJMENOVÁNA', 'success');
                                    const freshRes = await fetch('/api/folders');
                                    if (freshRes.ok) window.allFoldersData = await freshRes.json();
                                    openFolderModal(activeCategory, activeTitles, originEl);
                                    if (window.loadFolders) window.loadFolders();
                                } else {
                                    const errData = await res.json().catch(() => ({}));
                                    if (window.showToast) window.showToast('CHYBA: ' + (errData.error || 'Neznámá chyba'), 'error');
                                    isSaving = false;
                                }
                            } catch (err) {
                                if (window.showToast) window.showToast('RENAME_ERROR', 'error');
                                isSaving = false;
                            }
                        };

                        if (saveBtn) saveBtn.onclick = performSave;
                        if (cancelBtn) cancelBtn.onclick = cancelAction;

                        [csInput, enInput].forEach(inp => {
                            if (!inp) return;
                            inp.addEventListener('keydown', (ke) => {
                                if (ke.key === 'Enter') {
                                    ke.preventDefault();
                                    performSave(ke);
                                }
                                if (ke.key === 'Escape') {
                                    ke.preventDefault();
                                    cancelAction(ke);
                                }
                            });
                        });
                    };
                }

                if (deleteBtn) {
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const confirmed = await window.customConfirm('OPRAVDU SMAZAT TUTO PODSLOŽKU I S JEJÍM OBSAHEM?');
                        if (!confirmed) return;
                        try {
                            const res = await fetch(`/api/folders/${sf.id}`, { method: 'DELETE' });
                            if (res.ok) {
                                if (window.showToast) window.showToast('PODSLOŽKA SMAZÁNA', 'success');
                                const freshRes = await fetch('/api/folders');
                                if (freshRes.ok) window.allFoldersData = await freshRes.json();
                                openFolderModal(activeCategory, activeTitles, originEl);
                                if (window.loadFolders) window.loadFolders();
                            }
                        } catch (err) {
                            if (window.showToast) window.showToast('DELETE_ERROR', 'error');
                        }
                    };
                }
            }

            fragment.appendChild(div);
        });
    }

    if (filtered.length > 0) {
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = `port-item reveal-fade active ${isSelectionMode ? 'selecting' : ''} ${selectedItems.has(item.id) ? 'selected' : ''}`;
            div.dataset.id = item.id;
            div.style.opacity = '0';
            // No transform on initial state — transforms bypass CSS overflow clipping
            // which causes items to visually bleed outside the grid container bounds

            let adminHtml = '';
            if (window.isAdmin) {
                 adminHtml = `<div class="admin-badge-container">
                     <button class="promote-btn" title="Move to Top" data-id="${item.id}"><i class="ph ph-arrow-fat-up"></i></button>
                     <button class="delete-btn" title="Delete Item" data-id="${item.id}"><i class="ph ph-trash"></i></button>
                 </div>`;
            }

            let mediaHtml = '';
            const rawUrl = (item.media_url || '');
            const url = rawUrl.toLowerCase();
            const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov') || url.includes('vimeo') || url.includes('youtube') || url.includes('youtu.be') || url.includes('instagram.com') || url.includes('tiktok.com');

            if (isVideo && !url.includes('vimeo') && !url.includes('youtube') && !url.includes('youtu.be') && !url.includes('instagram.com') && !url.includes('tiktok.com')) {
                const posterAttr = item.thumbnail_url ? ` poster="${item.thumbnail_url}"` : '';
                mediaHtml = `
                    <div class="port-video-wrap img-loading-trigger">
                        <video src="${item.media_url}"${posterAttr} autoplay muted loop playsinline class="port-video-preview img-reveal-hidden" onloadeddata="this.classList.add('img-reveal-visible'); this.parentElement.classList.remove('img-loading-trigger')"></video>
                        <div class="video-grid-overlay"><i class="ph ph-play"></i></div>
                    </div>
                `;
            } else if (url.includes('instagram.com') || url.includes('tiktok.com')) {
                let displayThumb = item.thumbnail_url;
                if (!displayThumb && url.includes('instagram.com')) {
                    const igMatch = rawUrl.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/i);
                    const igShortcode = igMatch ? igMatch[1] : null;
                    const isPost = url.includes('/p/');
                    displayThumb = igShortcode ? `https://www.instagram.com/${isPost ? 'p' : 'reel'}/${igShortcode}/media/?size=l` : '/assets/kolaz_v5.jpg';
                }
                if (!displayThumb) {
                    displayThumb = '/assets/kolaz_v5.jpg';
                }
                mediaHtml = `
                    <div class="port-img-wrap img-loading-trigger">
                        <img src="${displayThumb}" alt="${item.title}" class="port-img img-reveal-hidden" loading="lazy" 
                             onload="this.classList.add('img-reveal-visible'); this.parentElement.classList.remove('img-loading-trigger')" 
                             onerror="this.src='/assets/kolaz_v5.jpg'; this.classList.add('img-reveal-visible'); this.parentElement.classList.remove('img-loading-trigger')">
                        <div class="video-grid-overlay"><i class="ph ph-play"></i></div>
                    </div>
                `;
            } else {
                let displayThumb = item.thumbnail_url || '/assets/kolaz_v5.jpg';
                
                // Auto-generate YouTube thumbnail if possible
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    let ytId = '';
                    if (rawUrl.includes('watch?v=')) ytId = rawUrl.split('v=')[1].split(/[&#]/)[0];
                    else if (rawUrl.includes('youtu.be/')) ytId = rawUrl.split('youtu.be/')[1].split(/[?#]/)[0];
                    else if (rawUrl.includes('embed/')) ytId = rawUrl.split('embed/')[1].split(/[?#]/)[0];
                    else if (rawUrl.includes('shorts/')) ytId = rawUrl.split('shorts/')[1].split(/[?&#]/)[0];
                    
                    if (ytId) displayThumb = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
                }

                mediaHtml = `
                    <div class="port-img-wrap img-loading-trigger">
                        <img src="${displayThumb}" alt="${item.title}" class="port-img img-reveal-hidden" loading="lazy" 
                             onload="this.classList.add('img-reveal-visible'); this.parentElement.classList.remove('img-loading-trigger')" 
                             onerror="this.src='/assets/kolaz_v5.jpg'; this.classList.add('img-reveal-visible'); this.parentElement.classList.remove('img-loading-trigger')">
                        ${isVideo ? '<div class="video-grid-overlay"><i class="ph ph-video-camera"></i></div>' : ''}
                    </div>
                `;
            }

            div.innerHTML = `
                ${adminHtml}
                <div class="port-media-container" ${sortableInstance ? 'style="cursor: grab;"' : ''}>
                    ${mediaHtml}
                    <div class="item-overlay-icon"><i class="ph ph-plus"></i></div>
                </div>
                <div class="port-info">
                    <span class="port-cat">${item.category}</span>
                    <h3>${item.title}</h3>
                    <div class="view-indicator mono-label" data-cs="[ ZOBRAZIT ]" data-en="[ VIEW ]">[ VIEW ]</div>
                </div>
            `;

            if (window.isAdmin) {
                div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const confirmMsg = currentLang === 'cs' ? 'OPRAVDU SMAZAT TENTO ZÁZNAM?' : 'REALLY DELETE THIS RECORD?';
                    const confirmed = await window.customConfirm(confirmMsg);
                    if (!confirmed) return;
                    
                    deletePortfolioItem(item.id, div);
                });

                div.querySelector('.promote-btn')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    // Move this item to the front of the filtered list and save
                    const currentIndex = filtered.indexOf(item);
                    if (currentIndex > 0) {
                        filtered.splice(currentIndex, 1);
                        filtered.unshift(item);
                        // Force a re-order save
                        const orders = filtered.map((it, idx) => ({ id: it.id, sort_order: idx }));
                        try {
                            const res = await fetch('/api/portfolio/reorder', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orders })
                            });
                            if (res.ok) {
                                showToast('ITEM_PROMOTED_TO_TOP', 'success');
                                portfolioData = await fetch('/api/portfolio').then(r => r.json());
                                openFolderModal(category, titles, originEl);
                            }
                        } catch (err) {
                            showToast('PROMOTION_FAILED', 'error');
                        }
                    }
                });
            }

            div.addEventListener('click', (e) => {
                if (e.target.closest('.admin-badge-container')) return;

                if (isSelectionMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleItemSelection(item.id, div);
                } else {
                    currentLightboxIndex = filtered.indexOf(item);
                    openLightbox(item);
                }
            });
            fragment.appendChild(div);
        });
    } else if (subfolders.length === 0) {
        for (let i = 0; i < 3; i++) {
            const card = document.createElement('div');
            card.className = 'placeholder-card reveal-fade active';
            card.style.opacity = 0;
            card.innerHTML = `<i class="ph ph-file-dashed"></i><span class="mono-label" data-cs="PRÁZDNÝ ZÁZNAM" data-en="EMPTY RECORD">PRÁZDNÝ ZÁZNAM</span>`;
            fragment.appendChild(card);
        }
        updateLanguageUI(currentLang);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);

    // Only override maxHeight to prevent GSAP animation overflow bleed.
    // All other layout properties are controlled by .folder-content-modal #folder-items-grid in CSS.
    grid.style.maxHeight = 'calc(95vh - 130px)';

    // macOS Opening Animation Logic
    modal.classList.add('active');
    window.toggleBodyLock(true);

    // Open animation — opacity only, NO scale/translate on modal content.
    // Using transforms on a parent breaks overflow:hidden clipping for compositing-layer children.
    gsap.set(modalContent, { opacity: 0 });
    gsap.set(modal.querySelector('.modal-overlay'), { opacity: 0 });

    const tl = gsap.timeline();
    tl.to(modal.querySelector('.modal-overlay'), { opacity: 1, duration: 0.4, ease: "power2.out" })
      .to(modalContent, {
          opacity: 1,
          duration: 0.35,
          ease: "power2.out"
      }, "-=0.2")
      .to("#folder-items-grid .reveal-fade", {
          opacity: 1,
          duration: 0.5,
          stagger: 0.04,
          ease: "power2.out",
          force3D: true
      }, "-=0.1");
}

function openLightbox(item) {
    const title = document.getElementById('lightbox-title');
    const desc = document.getElementById('lightbox-desc');
    const cat = document.getElementById('lightbox-category');
    const editBtn = document.getElementById('lightbox-edit-btn');
    
    if (window.isAdmin && editBtn) {
        editBtn.classList.remove('hidden');
        editBtn.onclick = () => openEditModal(item);
    } else if (editBtn) {
        editBtn.classList.add('hidden');
    }
    
    title.textContent = item.title || 'Bez názvu';
    
    // Inject localized description (or plain string)
    let descCs = '';
    let descEn = '';
    try {
        const obj = JSON.parse(item.description);
        descCs = obj.cs || obj.en || '';
        descEn = obj.en || obj.cs || '';
    } catch(e) {
        descCs = item.description || '';
        descEn = item.description || '';
    }
    const escapeAttr = (str) => (str || '').replace(/"/g, '&quot;');
    
    let p = document.getElementById('lightbox-desc-text');
    if (!p) {
        p = document.createElement('p');
        p.id = 'lightbox-desc-text';
        p.style.marginTop = '1rem';
        p.style.color = '#ccc';
        document.querySelector('.lightbox-info').appendChild(p);
    }
    p.setAttribute('data-cs', escapeAttr(descCs));
    p.setAttribute('data-en', escapeAttr(descEn));
    p.innerHTML = currentLang === 'cs' ? descCs : descEn;
    
    cat.textContent = item.category;
    
    lightboxMedia.innerHTML = '';
    
    if (item.media_url) {
        const rawUrl = item.media_url;
        const url = rawUrl.toLowerCase();

        if (url.includes('vimeo.com') || url.includes('player.vimeo.com')) {
            // Extract Vimeo ID (Case sensitive)
            let vimeoId = '';
            if (rawUrl.includes('video/')) {
                vimeoId = rawUrl.split('video/')[1].split(/[?#]/)[0];
            } else {
                vimeoId = rawUrl.split('/').pop().split(/[?#]/)[0];
            }
            const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
            lightboxMedia.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width:100%; height:100%;"></iframe>`;
        } else if (url.includes('instagram.com')) {
            let displayThumb = item.thumbnail_url;
            if (!displayThumb) {
                const igMatch = rawUrl.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/i);
                const igShortcode = igMatch ? igMatch[1] : null;
                const isPost = url.includes('/p/');
                displayThumb = igShortcode ? `https://www.instagram.com/${isPost ? 'p' : 'reel'}/${igShortcode}/media/?size=l` : '/assets/kolaz_v5.jpg';
            }
            lightboxMedia.innerHTML = `
                <div class="social-redirect-container ig-theme">
                    <div class="social-ambient-glow" style="background-image: url('${displayThumb}')"></div>
                    <a href="${rawUrl}" target="_blank" rel="noopener noreferrer" class="social-redirect-card">
                        <div class="social-cover-wrapper">
                            <img src="${displayThumb}" class="social-cover" onerror="this.src='/assets/kolaz_v5.jpg'">
                            <div class="social-card-overlay"></div>
                        </div>
                        
                        <div class="hud-element hud-top-left">
                            <span class="hud-rec-dot"></span>
                            <span class="mono-label">REC</span>
                        </div>
                        <div class="hud-element hud-top-right">
                            <span class="mono-label">1080x1920 @60FPS</span>
                        </div>
                        <div class="hud-element hud-bottom-left">
                            <span class="mono-label">PLAYBACK_PREVIEW</span>
                        </div>
                        
                        <div class="hud-crosshair-tl"></div>
                        <div class="hud-crosshair-tr"></div>
                        <div class="hud-crosshair-bl"></div>
                        <div class="hud-crosshair-br"></div>
                        
                        <div class="social-center-cta">
                            <div class="social-play-btn">
                                <i class="ph ph-instagram-logo"></i>
                            </div>
                        </div>
                        
                        <div class="social-bottom-bar">
                            <div class="social-btn-cta instagram-gradient-btn">
                                <i class="ph ph-arrow-up-right"></i>
                                <span class="mono-label" data-cs="OTEVŘÍT NA INSTAGRAMU" data-en="OPEN ON INSTAGRAM">OPEN ON INSTAGRAM</span>
                            </div>
                        </div>
                    </a>
                </div>
            `;
            updateLanguageUI(currentLang);
        } else if (url.includes('tiktok.com')) {
            const displayThumb = item.thumbnail_url || '/assets/kolaz_v5.jpg';
            lightboxMedia.innerHTML = `
                <div class="social-redirect-container tiktok-theme">
                    <div class="social-ambient-glow" style="background-image: url('${displayThumb}')"></div>
                    <a href="${rawUrl}" target="_blank" rel="noopener noreferrer" class="social-redirect-card">
                        <div class="social-cover-wrapper">
                            <img src="${displayThumb}" class="social-cover" onerror="this.src='/assets/kolaz_v5.jpg'">
                            <div class="social-card-overlay"></div>
                        </div>
                        
                        <div class="hud-element hud-top-left">
                            <span class="hud-rec-dot"></span>
                            <span class="mono-label">REC</span>
                        </div>
                        <div class="hud-element hud-top-right">
                            <span class="mono-label">1080x1920 @60FPS</span>
                        </div>
                        <div class="hud-element hud-bottom-left">
                            <span class="mono-label">PLAYBACK_PREVIEW</span>
                        </div>
                        
                        <div class="hud-crosshair-tl"></div>
                        <div class="hud-crosshair-tr"></div>
                        <div class="hud-crosshair-bl"></div>
                        <div class="hud-crosshair-br"></div>
                        
                        <div class="social-center-cta">
                            <div class="social-play-btn">
                                <i class="ph ph-tiktok-logo"></i>
                            </div>
                        </div>
                        
                        <div class="social-bottom-bar">
                            <div class="social-btn-cta tiktok-neon-btn">
                                <i class="ph ph-arrow-up-right"></i>
                                <span class="mono-label" data-cs="OTEVŘÍT NA TIKTOKU" data-en="OPEN ON TIKTOK">OPEN ON TIKTOK</span>
                            </div>
                        </div>
                    </a>
                </div>
            `;
            updateLanguageUI(currentLang);
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            // Extract YouTube ID (Case sensitive)
            let ytId = '';
            if (rawUrl.includes('watch?v=')) {
                ytId = rawUrl.split('v=')[1].split(/[&#]/)[0];
            } else if (rawUrl.includes('youtu.be/')) {
                ytId = rawUrl.split('youtu.be/')[1].split(/[?#]/)[0];
            } else if (rawUrl.includes('embed/')) {
                ytId = rawUrl.split('embed/')[1].split(/[?#]/)[0];
            } else if (rawUrl.includes('shorts/')) {
                ytId = rawUrl.split('shorts/')[1].split(/[?#]/)[0];
            }
            
            const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&modestbranding=1`;
            lightboxMedia.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%;"></iframe>`;
        } else if (url.match(/\.(mp4|webm|mov)(\?.*)?$/i)) {
            lightboxMedia.innerHTML = `<video controls autoplay muted loop playsinline name="media" style="max-height:100%; width:100%;"><source src="${item.media_url}" type="video/mp4"></video>`;
            
            // Explicitly force the video to start playing to bypass dynamic DOM injection restrictions
            setTimeout(() => {
                const vid = lightboxMedia.querySelector('video');
                if (vid) {
                    vid.muted = true; // Double ensure muted for browser policy
                    const playPromise = vid.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.warn("Explicit autoplay prevented, adding trigger:", error);
                        });
                    }
                }
            }, 50);
        } else {
             lightboxMedia.innerHTML = `<img src="${item.media_url}" alt="${item.title}" style="max-height:100%; object-fit: contain;">`;
        }
    } else {
        let displayThumb = item.thumbnail_url || '/assets/kolaz_v5.jpg';
        const url = (item.media_url || '').toLowerCase();
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let ytId = '';
            if (item.media_url.includes('watch?v=')) ytId = item.media_url.split('v=')[1].split(/[&#]/)[0];
            else if (item.media_url.includes('youtu.be/')) ytId = item.media_url.split('youtu.be/')[1].split(/[?#]/)[0];
            else if (item.media_url.includes('embed/')) ytId = item.media_url.split('embed/')[1].split(/[?#]/)[0];
            else if (item.media_url.includes('shorts/')) ytId = item.media_url.split('shorts/')[1].split(/[?#]/)[0];
            
            if (ytId) displayThumb = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        }
        lightboxMedia.innerHTML = `<img src="${displayThumb}" alt="${item.title}" style="max-height:100%; object-fit: contain;" onerror="this.src='/assets/kolaz_v5.jpg'">`;
    }
    
    const isAlreadyActive = lightboxModal.classList.contains('active');
    lightboxModal.classList.add('active');
    window.toggleBodyLock(true);
    
    // Update URL Hash for sharing and SEO
    window.location.hash = 'work-' + item.id;

    if (!isAlreadyActive) {
        const modalContent = lightboxModal.querySelector('.modal-content');
        gsap.set(modalContent, { scale: 0.92, opacity: 0, y: 30 });
        gsap.set(lightboxModal.querySelector('.modal-overlay'), { opacity: 0 });

        const tl = gsap.timeline();
        tl.to(lightboxModal.querySelector('.modal-overlay'), { opacity: 1, duration: 0.5, ease: "power2.out" })
          .to(modalContent, {
              scale: 1,
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: "expo.out",
              clearProps: "transform"
          }, "-=0.35");
    }
}

function navigateLightbox(direction) {
    if (currentFolderItems.length === 0) return;
    
    const mediaContainer = document.getElementById('lightbox-media-container');
    if (!mediaContainer) return;
    
    // Prevent animation queues from building up on fast clicking/swiping
    gsap.killTweensOf(mediaContainer.children);
    
    const slideOutX = direction === 1 ? -60 : 60;
    const slideInX = direction === 1 ? 60 : -60;
    
    gsap.to(mediaContainer.children, {
        x: slideOutX,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
            currentLightboxIndex += direction;
            if (currentLightboxIndex < 0) currentLightboxIndex = currentFolderItems.length - 1;
            if (currentLightboxIndex >= currentFolderItems.length) currentLightboxIndex = 0;
            
            openLightbox(currentFolderItems[currentLightboxIndex]);
            
            const newChildren = mediaContainer.children;
            gsap.killTweensOf(newChildren);
            gsap.set(newChildren, { x: slideInX, opacity: 0 });
            gsap.to(newChildren, {
                x: 0,
                opacity: 1,
                duration: 0.3,
                ease: "power2.out"
            });
        }
    });
}

function openEditModal(item) {
    const modal = document.getElementById('edit-portfolio-modal');
    document.getElementById('edit-p-id').value = item.id;
    document.getElementById('edit-p-title').value = item.title || '';
    
    let descObj = { cs: '', en: '' };
    try {
        const parsed = JSON.parse(item.description);
        if (parsed && typeof parsed === 'object') descObj = parsed;
        else descObj.cs = item.description;
    } catch(e) {
        descObj.cs = item.description || '';
    }
    
    document.getElementById('edit-p-desc-cs').value = descObj.cs || '';
    document.getElementById('edit-p-desc-en').value = descObj.en || '';
    document.getElementById('edit-p-tags').value = item.tags || '';
    
    modal.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-edit-portfolio-btn')?.addEventListener('click', () => {
        document.getElementById('edit-portfolio-modal').classList.remove('active');
    });

    document.getElementById('edit-portfolio-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-p-id').value;
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const btn = e.target.querySelector('button[type="submit"]');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<span class="btn-text">SAVING...</span>';
        
        try {
            const res = await fetch(`/api/portfolio/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                if (window.showToast) window.showToast('ZÁZNAM AKTUALIZOVÁN', 'success');
                document.getElementById('edit-portfolio-modal').classList.remove('active');
                await loadPortfolio();
                
                // Update currentFolderItems if needed, and close lightbox so user can reopen
                const closeLightboxBtn = document.querySelector('#lightbox-modal .close-btn');
                if (closeLightboxBtn) closeLightboxBtn.click();
            } else {
                if (window.showToast) window.showToast('CHYBA AKTUALIZACE', 'error');
            }
        } catch(err) {
            console.error(err);
        } finally {
            btn.innerHTML = oldText;
        }
    });
});


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
    if (!reviewsGrid || data.length === 0) return;
    
    // Use data-attributes for localization if needed, or render based on currentLang
    reviewsGrid.innerHTML = '';
    
    const escapeAttr = (str) => (str || '').replace(/"/g, '&quot;');
    
    data.forEach((t, i) => {
        const card = document.createElement('div');
        card.className = 'insta-dm-card reveal-fade';
        
        const quoteCs = t.quote || t.quote_cs || '';
        const quoteEn = t.quote_en || t.quote || t.quote_cs || '';
        const quote = currentLang === 'cs' ? quoteCs : quoteEn;
        
        // Better fallback for avatar: use UI Avatars instead of random pravatar
        const avatarImg = t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.client_name)}&background=111&color=fff&bold=true`;
        const hasProject = t.project && t.project.trim() !== '';
        
        card.innerHTML = `
            <div class="dm-avatar-wrapper">
                <img src="${avatarImg}" alt="${t.client_name}" class="dm-avatar" onerror="this.src='/assets/user-icon.png'">
            </div>
            <div class="dm-content-wrapper">
                <span class="dm-username">${t.client_name.toLowerCase().replace(/\s/g, '_')}</span>
                <div class="dm-bubble">
                    <p class="dm-text" data-cs="${escapeAttr(quoteCs)}" data-en="${escapeAttr(quoteEn)}">${quote}</p>
                    <div class="dm-scanner-line"></div>
                </div>
                ${hasProject ? `<span class="dm-meta">${t.project}</span>` : ''}
            </div>
        `;
        reviewsGrid.appendChild(card);
    });

    // RE-INIT MARQUEE for the new content
    if (typeof window.initReviewsMarquee === 'function') {
        window.initReviewsMarquee();
    }
}

async function handleContactSubmit(e) {
    e.preventDefault();
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader-ring');
    const submitBtn = document.getElementById('submit-btn');
    
    formStatus.innerHTML = '';

    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData.entries());

    // Collect all checked project types since they are now checkboxes
    const checkedTypes = Array.from(contactForm.querySelectorAll('input[name="project_type"]:checked')).map(el => el.value);
    data.project_type = checkedTypes.join(', ');

    // Custom validation for inputs to prevent silent submission blocking
    if (!data.project_type || !data.budget) {
        const errorMsg = currentLang === 'cs' ? 'ZVOLTE TYP PROJEKTU A ROZPOČET.' : 'SELECT PROJECT TYPE AND BUDGET.';
        formStatus.innerHTML = `<div style="color: var(--accent); margin-top: 15px;">ERROR: ${errorMsg}</div>`;
        return;
    }

    if (btnText) btnText.style.display = 'none';
    if (loader) loader.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;

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
        if (btnText) btnText.style.display = 'block';
        if (loader) loader.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
        setTimeout(() => { formStatus.innerHTML = ''; }, 5000);
    }
}
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
    const mobileNavAuth = document.getElementById('mobile-nav-auth');
    if (!navAuth) return;

    let authHtml = '';

    if (authenticated && currentUser) {
        console.log('DEBUG: User logged in:', currentUser); // Debugging
        
        // Handle both snake_case and camelCase from session
        const fullName = currentUser.full_name || currentUser.fullName || 'User';
        const firstName = fullName.split(' ')[0];
        const isAdmin = currentUser.role === 'admin';
        
        window.isAdmin = isAdmin;
        document.body.classList.toggle('admin-enabled', isAdmin);
        
        let adminBtns = '';
        if (isAdmin) {
            adminBtns = `
                <button id="nav-db-btn" class="btn-admin-db" data-cs="DATABÁZE" data-en="DATABASE" title="View Records"><i class="ph ph-database"></i> DATABASE</button>
                <button id="nav-admin-btn" class="nav-admin-btn" title="Add Work"><i class="ph ph-plus-circle"></i> <span data-cs="PŘIDAT" data-en="ADD">ADD</span></button>
            `;
        }
        
        authHtml = `
            <div class="user-profile" style="display: flex; align-items: center; gap: 0.8rem;">
                ${adminBtns}
                <div class="user-info" style="display: flex; align-items: center; gap: 0.5rem; margin-left: 0.5rem; font-family: var(--font-mono); font-size: 0.7rem; color: #fff;">
                    <i class="ph ph-user-circle" style="font-size: 1.1rem; opacity: 0.7;"></i>
                    <span style="letter-spacing: 1px;">${firstName.toUpperCase()}</span>
                </div>
                <button class="btn-logout-tactical" id="main-logout-btn"><i class="ph ph-power"></i> LOGOUT</button>
            </div>
        `;
    } else {
        window.isAdmin = false;
        document.body.classList.remove('admin-enabled');
    }
    
    navAuth.innerHTML = authHtml;
    if (mobileNavAuth) {
        mobileNavAuth.innerHTML = authHtml;
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
    // 5-tap gesture on KARBYVISUALS logo to open login modal
    let logoTapCount = 0;
    let logoTapTimeout = null;

    // Global Event Delegation for Auth and Admin actions
    document.addEventListener('click', (e) => {
        const target = e.target;

        // 5-tap gesture detection on logo
        const logoLink = target.closest('.navbar .logo a, .mobile-nav-header .logo a');
        if (logoLink) {
            logoTapCount++;
            if (logoTapTimeout) clearTimeout(logoTapTimeout);
            
            logoTapTimeout = setTimeout(() => {
                logoTapCount = 0;
            }, 800);

            // Prevent default page navigation for subsequent rapid taps to avoid jitter/jumping
            if (logoTapCount > 1) {
                e.preventDefault();
            }

            if (logoTapCount === 5) {
                logoTapCount = 0;
                if (logoTapTimeout) {
                    clearTimeout(logoTapTimeout);
                    logoTapTimeout = null;
                }

                // If mobile drawer is open, close it by triggering a click on the close button
                const drawerCloseBtn = document.getElementById('mobile-drawer-close');
                if (drawerCloseBtn) {
                    drawerCloseBtn.click();
                }

                // Open the auth modal
                if (typeof openAuthModal === 'function') {
                    openAuthModal('login-modal');
                } else {
                    const loginModal = document.getElementById('login-modal');
                    if (loginModal) loginModal.classList.add('active');
                }
            }
            return;
        }

        const id = target.id || target.closest('[id]')?.id;
        
        // --- AUTH TRIGGERS ---
        const isFootLink = target.classList.contains('auth-foot-link') || target.closest('.auth-foot-link');
        if (id === 'login-trigger' || isFootLink) {
            e.preventDefault();
            openAuthModal('login-modal');
            return;
        }

        if (id === 'legal-terms-trigger' || target.closest('#legal-terms-trigger')) {
            e.preventDefault();
            openAuthModal('legal-modal');
            if (typeof window.switchLegalTab === 'function') window.switchLegalTab('terms');
            return;
        }
        if (id === 'legal-privacy-trigger' || target.closest('#legal-privacy-trigger')) {
            e.preventDefault();
            openAuthModal('legal-modal');
            if (typeof window.switchLegalTab === 'function') window.switchLegalTab('privacy');
            return;
        }
        if (id === 'main-logout-btn') {
            handleLogout();
            return;
        }

        // --- ADMIN TRIGGERS ---
        if (id === 'nav-db-btn' || target.closest('#nav-db-btn')) {
            openAdminDbModal();
            return;
        }
        if (id === 'nav-admin-btn' || target.closest('#nav-admin-btn')) {
            console.log('Admin Dashboard trigger detected');
            if (typeof window.openDashboard === 'function') {
                window.openDashboard();
            } else {
                console.error('window.openDashboard not found');
            }
            return;
        }

        // --- MODAL CLOSES ---
        if (target.classList.contains('auth-close') || target.closest('.auth-close') || target.classList.contains('modal-overlay') || target.closest('.close-btn')) {
            const modal = target.closest('.auth-modal') || target.closest('.modal');
            if (modal) {
                // Skip folder-modal as it uses custom GSAP logic
                if (modal.id === 'folder-modal') return;

                if (modal.classList.contains('auth-modal')) {
                    closeAuthModal(modal.id);
                } else {
                    // This handles general modals like admin-db-modal
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                    if (window.toggleBodyLock) window.toggleBodyLock(false);
                }
            }
        }
        
        // --- TABS & SWITCHES ---
        const switchBtn = target.closest('.switch-btn') || target.closest('.switch-btn-full');
        if (switchBtn) {
            const current = switchBtn.closest('.auth-modal').id;
            const targetModal = switchBtn.dataset.target;
            switchModals(current, targetModal);
        }

        const tabBtn = target.closest('.db-tab-btn');
        if (tabBtn) {
            const parentWrap = tabBtn.closest('.db-tabs') || document;
            parentWrap.querySelectorAll('.db-tab-btn').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            if (typeof window.dashboardFetchDbData === 'function') {
                window.dashboardFetchDbData(tabBtn.dataset.tab);
            }
        }

        // --- PASS TOGGLE ---
        if (target.classList.contains('toggle-password')) {
            const input = target.previousElementSibling;
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
                target.classList.toggle('ph-eye');
                target.classList.toggle('ph-eye-slash');
            }
        }

        // --- DELETE ACTIONS ---
        const deleteBtn = target.closest('.delete-btn');
        if (deleteBtn && window.isAdmin) {
            e.preventDefault();
            e.stopPropagation();
            const itemId = deleteBtn.dataset.id;
            const confirmMsg = currentLang === 'cs' ? 'OPRAVDU SMAZAT TENTO ZÁZNAM?' : 'REALLY DELETE THIS RECORD?';
            
            window.customConfirm(confirmMsg).then(confirmed => {
                if (confirmed) {
                    deletePortfolioItem(itemId, deleteBtn.closest('.port-item'));
                }
            });
        }
    });

    // Forms
    document.addEventListener('submit', (e) => {
        if (e.target.id === 'login-form') handleLogin(e);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            console.log('Enter pressed! Target:', e.target);
            const loginForm = e.target.closest('#login-form');
            if (loginForm) {
                console.log('loginForm found!');
                e.preventDefault();
                if (loginForm.reportValidity()) {
                    console.log('Form is valid, calling handleLogin manually.');
                    handleLogin({
                        preventDefault: () => {},
                        target: loginForm
                    });
                } else {
                    console.log('Form invalid');
                }
            } else {
                console.log('loginForm NOT found from target.');
                // Fallback: If focus is anywhere in the modal, try to find the active login form
                const activeModal = document.getElementById('login-modal');
                if (activeModal && activeModal.classList.contains('active')) {
                    const form = document.getElementById('login-form');
                    if (form && form.reportValidity()) {
                        e.preventDefault();
                        handleLogin({ preventDefault: () => {}, target: form });
                    }
                }
            }
        }
    });

    // Secret Login Shortcut (Shift + K + V)
    let secretKeys = { k: false, v: false };
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'k') secretKeys.k = true;
        if (e.key.toLowerCase() === 'v') secretKeys.v = true;

        if (e.shiftKey && secretKeys.k && secretKeys.v) {
            if (typeof openAuthModal === 'function') {
                openAuthModal('login-modal');
            } else {
                const loginModal = document.getElementById('login-modal');
                if (loginModal) loginModal.classList.add('active');
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() === 'k') secretKeys.k = false;
        if (e.key.toLowerCase() === 'v') secretKeys.v = false;
    });
}

// ADMIN DB FUNCTIONS
function openAdminDbModal() {
    const modal = document.getElementById('admin-db-modal');
    if (!modal) return;
    
    if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('admin-db-modal');
    } else {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Default to submissions
    if (typeof window.dashboardFetchDbData === 'function') {
        window.dashboardFetchDbData('messages');
    }
}


function openAuthModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
    if (window.toggleBodyLock) window.toggleBodyLock(true);
    if (window.animateModalOpen) window.animateModalOpen(id);
}
window.openAuthModal = openAuthModal;

function closeAuthModal(id) {
    if (window.animateModalClose) {
        window.animateModalClose(id, () => {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('active');
            if (window.toggleBodyLock) window.toggleBodyLock(false);
            
            // Re-open cookie banner if it was temporarily hidden to read the legal text
            if (id === 'legal-modal' && window.cookieBannerWasHiddenForLegal) {
                window.cookieBannerWasHiddenForLegal = false;
                if (window.animateCookieBannerOpen) {
                    window.animateCookieBannerOpen();
                } else {
                    const overlay = document.getElementById('cookie-overlay');
                    if (overlay) overlay.classList.add('active');
                }
            }
        });
    } else {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
        if (window.toggleBodyLock) window.toggleBodyLock(false);
        
        // Re-open cookie banner if it was temporarily hidden to read the legal text
        if (id === 'legal-modal' && window.cookieBannerWasHiddenForLegal) {
            window.cookieBannerWasHiddenForLegal = false;
            if (window.animateCookieBannerOpen) {
                window.animateCookieBannerOpen();
            } else {
                const overlay = document.getElementById('cookie-overlay');
                if (overlay) overlay.classList.add('active');
            }
        }
    }
}
window.closeAuthModal = closeAuthModal;

function switchLegalTab(tab) {
    const btnTerms = document.getElementById('legal-tab-btn-terms');
    const btnPrivacy = document.getElementById('legal-tab-btn-privacy');
    const tabTerms = document.getElementById('legal-tab-terms');
    const tabPrivacy = document.getElementById('legal-tab-privacy');

    if (tab === 'terms') {
        if (btnTerms) {
            btnTerms.classList.add('active');
            btnTerms.style.borderBottom = '2px solid var(--accent)';
            btnTerms.style.color = '#fff';
        }
        if (btnPrivacy) {
            btnPrivacy.classList.remove('active');
            btnPrivacy.style.borderBottom = 'none';
            btnPrivacy.style.color = 'rgba(255,255,255,0.5)';
        }
        if (tabTerms) tabTerms.style.display = 'block';
        if (tabPrivacy) tabPrivacy.style.display = 'none';
    } else {
        if (btnTerms) {
            btnTerms.classList.remove('active');
            btnTerms.style.borderBottom = 'none';
            btnTerms.style.color = 'rgba(255,255,255,0.5)';
        }
        if (btnPrivacy) {
            btnPrivacy.classList.add('active');
            btnPrivacy.style.borderBottom = '2px solid var(--accent)';
            btnPrivacy.style.color = '#fff';
        }
        if (tabTerms) tabTerms.style.display = 'none';
        if (tabPrivacy) tabPrivacy.style.display = 'block';
    }
}
window.switchLegalTab = switchLegalTab;

function customConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-action');
        const cancelBtn = document.getElementById('confirm-cancel');
        const overlay = modal.querySelector('.modal-overlay');

        if (!modal) {
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message.toUpperCase();
        modal.classList.add('active');
        if (window.toggleBodyLock) window.toggleBodyLock(true);

        const cleanup = (result) => {
            modal.classList.remove('active');
            if (window.toggleBodyLock) window.toggleBodyLock(false);
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onCancel);
            resolve(result);
        };

        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onCancel);
    });
}
window.customConfirm = customConfirm;

function switchModals(from, to) {
    if (window.transitionAuthPanels) {
        window.transitionAuthPanels(from, to);
    } else {
        const toModal = document.getElementById(to);
        const toOverlay = toModal.querySelector('.modal-overlay');
        const toPanel = toModal.querySelector('.modal-panel');
        
        if (toOverlay) toOverlay.style.transition = 'none';
        if (toPanel) toPanel.style.transition = 'none';
        
        document.getElementById(from).classList.remove('active');
        toModal.classList.add('active');
        
        setTimeout(() => {
            if (toOverlay) toOverlay.style.transition = '';
            if (toPanel) toPanel.style.transition = '';
        }, 50);
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
            setTimeout(() => {
                window.location.reload();
            }, 1000);
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
                    scale: 0.7,
                    y: 20,
                    duration: 0.3,
                    ease: 'power2.in',
                    onComplete: () => {
                        // Collapse space smoothly
                        gsap.to(element, {
                            width: 0,
                            margin: 0,
                            padding: 0,
                            duration: 0.3,
                            ease: 'power2.inOut',
                            onComplete: () => {
                                element.remove();
                                // Keep local state in sync for lightbox
                                if (window.currentFolderItems) {
                                    window.currentFolderItems = window.currentFolderItems.filter(i => i.id !== parseInt(id));
                                }
                                loadPortfolio();
                            }
                        });
                    }
                });
            } else {
                loadPortfolio();
            }
        } else {
            const data = await res.json();
        }
    } catch (err) {
        showToast('DELETE FAILED', 'error');
    }
}


/* ==========================================
   BATCH ACTIONS & SORTING LOGIC
   ========================================== */

function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    const btn = document.querySelector('.btn-toggle-selection');
    const allBtn = document.querySelector('.btn-select-all');
    
    if (btn) {
        btn.classList.toggle('active', isSelectionMode);
        btn.innerHTML = `<i class="ph ph-check-square"></i> ${isSelectionMode ? 'STOP SELECTION' : 'SELECT ITEMS'}`;
    }
    
    if (allBtn) {
        allBtn.classList.toggle('hidden', !isSelectionMode);
    }
    
    const items = document.querySelectorAll('.port-item, .subfolder-card');
    items.forEach(el => {
        el.classList.toggle('selecting', isSelectionMode);
        if (!isSelectionMode) {
            el.classList.remove('selected');
        }
    });
    
    if (!isSelectionMode) {
        selectedItems.clear();
        selectedSubfolders.clear();
    }
    updateBatchBar();
}

function toggleSelectAll() {
    const portItems = document.querySelectorAll('#folder-items-grid .port-item');
    const subfolderCards = document.querySelectorAll('#folder-items-grid .subfolder-card');

    const allPortSelected = portItems.length > 0 ? Array.from(portItems).every(el => el.classList.contains('selected')) : true;
    const allSubSelected = subfolderCards.length > 0 ? Array.from(subfolderCards).every(el => el.classList.contains('selected')) : true;
    const allSelected = allPortSelected && allSubSelected && (portItems.length > 0 || subfolderCards.length > 0);
    
    portItems.forEach(el => {
        const id = parseInt(el.dataset.id, 10);
        if (allSelected) {
            el.classList.remove('selected');
            selectedItems.delete(id);
        } else {
            el.classList.add('selected');
            selectedItems.add(id);
        }
    });

    subfolderCards.forEach(el => {
        const id = parseInt(el.dataset.id, 10);
        if (allSelected) {
            el.classList.remove('selected');
            selectedSubfolders.delete(id);
        } else {
            el.classList.add('selected');
            selectedSubfolders.add(id);
        }
    });

    updateBatchBar();
}

function toggleItemSelection(id, element) {
    if (selectedItems.has(id)) {
        selectedItems.delete(id);
        element.classList.remove('selected');
    } else {
        selectedItems.add(id);
        element.classList.add('selected');
    }
    updateBatchBar();
}

function toggleSubfolderSelection(id, element) {
    if (selectedSubfolders.has(id)) {
        selectedSubfolders.delete(id);
        element.classList.remove('selected');
    } else {
        selectedSubfolders.add(id);
        element.classList.add('selected');
    }
    updateBatchBar();
}

function updateBatchBar() {
    const bar = document.getElementById('batch-actions-bar');
    if (!bar) return;
    const countEl = bar.querySelector('.selection-count');
    const totalSelected = selectedItems.size + selectedSubfolders.size;
    
    if (isSelectionMode && totalSelected > 0) {
        bar.classList.add('active');
        countEl.textContent = `${totalSelected} ITEMS_SELECTED`;
    } else {
        bar.classList.remove('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const batchCancelBtn = document.getElementById('batch-cancel-btn');
    if (batchCancelBtn) {
        batchCancelBtn.onclick = () => {
            isSelectionMode = false;
            selectedItems.clear();
            selectedSubfolders.clear();
            updateBatchBar();
            const grid = document.getElementById('folder-items-grid');
            if (grid) {
                grid.querySelectorAll('.port-item, .subfolder-card').forEach(el => {
                    el.classList.remove('selecting', 'selected');
                });
            }
        };
    }

    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.onclick = async () => {
            const totalSelected = selectedItems.size + selectedSubfolders.size;
            if (totalSelected === 0) return;

            const confirmMsg = currentLang === 'cs' 
                ? `OPRAVDU SMAZAT ${totalSelected} POLOŽEK (VČETNĚ VYBRANÝCH PODSLOŽEK A JEJICH OBSAHU)?` 
                : `REALLY DELETE ${totalSelected} ITEMS (INCLUDING SELECTED SUBFOLDERS AND THEIR CONTENTS)?`;
            const confirmed = await window.customConfirm(confirmMsg);
            if (!confirmed) return;

            try {
                // Delete selected subfolders first (which recursively cleans files from disk and DB)
                for (const sfId of selectedSubfolders) {
                    await fetch(`/api/folders/${sfId}`, { method: 'DELETE' });
                }

                // Delete selected portfolio items
                if (selectedItems.size > 0) {
                    const ids = Array.from(selectedItems);
                    await fetch('/api/portfolio/batch-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids })
                    });
                }

                showToast('BATCH_DELETE_SUCCESS', 'success');
                selectedItems.clear();
                selectedSubfolders.clear();
                isSelectionMode = false;
                updateBatchBar();

                // Refresh data and re-render modal
                const freshRes = await fetch('/api/folders');
                if (freshRes.ok) window.allFoldersData = await freshRes.json();
                await loadPortfolio();

                const currentStackItem = window.currentFolderStack[window.currentFolderStack.length - 1];
                if (currentStackItem) {
                    openFolderModal(currentStackItem.category, currentStackItem.titles, currentStackItem.originEl);
                } else {
                    const closeBtn = document.getElementById('close-folder-modal');
                    if (closeBtn) closeBtn.click();
                }
            } catch (err) {
                showToast('BATCH_DELETE_FAILED', 'error');
            }
        };
    }
});

function toggleSortingMode(grid) {
    const btn = document.getElementById('reorder-btn');
    if (sortableInstance) {
        // Save and Disable
        saveNewOrder(grid);
        sortableInstance.destroy();
        sortableInstance = null;
        btn.innerHTML = '<i class="ph ph-arrows-out-cardinal"></i> ENABLE SORTING';
        btn.classList.remove('active');
        grid.querySelectorAll('.port-media-container, .subfolder-card').forEach(h => h.style.cursor = '');
    } else {
        // Enable
        sortableInstance = new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            filter: '.subfolder-admin-actions, .admin-badge-container',
            preventOnFilter: true,
            forceFallback: true,
            fallbackOnBody: true,
            fallbackClass: 'sortable-fallback',
            onStart: () => { document.body.classList.add('is-dragging'); },
            onEnd: () => { 
                document.body.classList.remove('is-dragging');
            }
        });
        btn.innerHTML = '<i class="ph ph-check"></i> SAVE ORDER';
        btn.classList.add('active');
        grid.querySelectorAll('.port-media-container, .subfolder-card').forEach(h => h.style.cursor = 'grab');
        if (window.showToast) window.showToast('SORTING_MODE_ACTIVE', 'info');
    }
}

async function saveNewOrder(grid) {
    const portItems = Array.from(grid.querySelectorAll('.port-item'));
    const subfolderCards = Array.from(grid.querySelectorAll('.subfolder-card'));

    if (subfolderCards.length > 0) {
        const folderOrders = subfolderCards.map((el, index) => ({
            id: parseInt(el.dataset.id),
            sort_order: index
        }));
        try {
            const res = await fetch('/api/folders/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders: folderOrders })
            });
            if (res.ok) {
                const freshRes = await fetch('/api/folders');
                if (freshRes.ok) window.allFoldersData = await freshRes.json();
            }
        } catch (err) {
            console.error('Error saving folder order:', err);
        }
    }

    if (portItems.length > 0) {
        const itemOrders = portItems.map((el, index) => ({
            id: parseInt(el.dataset.id),
            sort_order: index
        }));
        try {
            const res = await fetch('/api/portfolio/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders: itemOrders })
            });
            if (res.ok) {
                if (window.showToast) window.showToast('ORDER_SYNCHRONIZED', 'success');
                loadPortfolio();
            }
        } catch (err) {
            if (window.showToast) window.showToast('ORDER_SYNC_FAILED', 'error');
        }
    }
}

// ==========================================
// COOKIE CONSENT PROTOCOL
// ==========================================
function initCookieConsent() {
    const overlay = document.getElementById('cookie-overlay');
    const banner = document.getElementById('cookie-banner');
    if (!overlay || !banner) return;

    const acceptAllBtn = document.getElementById('cookie-accept-all');
    const rejectAllBtn = document.getElementById('cookie-reject-all');
    const toggleSettingsBtn = document.getElementById('cookie-toggle-settings');
    const saveSettingsBtn = document.getElementById('cookie-save-settings');
    const settingsPanel = document.getElementById('cookie-settings-panel');
    
    const optAnalytics = document.getElementById('cookie-opt-analytics');
    const optMarketing = document.getElementById('cookie-opt-marketing');
    
    const settingsTrigger = document.getElementById('cookie-settings-trigger');

    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax; Secure";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
        return null;
    }

    // 1. Check if preference already exists in localStorage or Cookie
    const consentCookie = getCookie('karbyCookieConsent');
    const consent = localStorage.getItem('karbyCookieConsent') || consentCookie;
    
    if (!consent) {
        // Show banner after 3.2 seconds delay (gives preloader & hero animations time to finish)
        setTimeout(() => {
            if (window.animateCookieBannerOpen) {
                window.animateCookieBannerOpen();
            } else {
                overlay.classList.add('active');
            }
        }, 3200);
    } else {
        // Apply existing preferences
        try {
            const preferences = JSON.parse(consent);
            applyCookiePreferences(preferences);
            // Sync cookie just in case it was only in localStorage
            if (!consentCookie) {
                setCookie('karbyCookieConsent', JSON.stringify(preferences), 365);
            }
        } catch (e) {
            console.error('Failed to parse cookie preferences:', e);
        }
    }

    // 2. Accept All Action (Agree & Enter)
    if (acceptAllBtn) {
        acceptAllBtn.addEventListener('click', () => {
            const preferences = {
                necessary: true,
                analytics: true,
                marketing: true,
                timestamp: new Date().getTime()
            };
            savePreferences(preferences);
        });
    }

    // 3. Reject All / Disagree Action (Disagree & Continue)
    if (rejectAllBtn) {
        rejectAllBtn.addEventListener('click', () => {
            const preferences = {
                necessary: true,
                analytics: false,
                marketing: false,
                timestamp: new Date().getTime()
            };
            savePreferences(preferences);
        });
    }

    // 4. Toggle Settings Action (Customize Protocol)
    if (toggleSettingsBtn) {
        toggleSettingsBtn.addEventListener('click', () => {
            const isHidden = settingsPanel.style.display === 'none';
            if (isHidden) {
                // Expand panel
                settingsPanel.style.display = 'flex';
                // Show save settings button
                saveSettingsBtn.style.display = 'block';
                
                // Update dynamic translation attributes
                toggleSettingsBtn.setAttribute('data-cs', 'SKRÝT NASTAVENÍ');
                toggleSettingsBtn.setAttribute('data-en', 'HIDE PREFERENCES');
                toggleSettingsBtn.textContent = currentLang === 'cs' ? 'SKRÝT NASTAVENÍ' : 'HIDE PREFERENCES';
                
                // Pre-populate switches from current settings if they exist
                const activeConsent = localStorage.getItem('karbyCookieConsent') || getCookie('karbyCookieConsent');
                if (activeConsent) {
                    try {
                        const preferences = JSON.parse(activeConsent);
                        if (optAnalytics) optAnalytics.checked = !!preferences.analytics;
                        if (optMarketing) optMarketing.checked = !!preferences.marketing;
                    } catch(e) {}
                }
            } else {
                // Collapse panel
                settingsPanel.style.display = 'none';
                saveSettingsBtn.style.display = 'none';
                
                // Reset translation attributes
                toggleSettingsBtn.setAttribute('data-cs', 'NASTAVENÍ COOKIES');
                toggleSettingsBtn.setAttribute('data-en', 'COOKIE SETTINGS');
                toggleSettingsBtn.textContent = currentLang === 'cs' ? 'NASTAVENÍ COOKIES' : 'COOKIE SETTINGS';
            }
        });
    }

    // 5. Save Custom Settings Action (Save Consent & Enter)
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const preferences = {
                necessary: true,
                analytics: optAnalytics ? optAnalytics.checked : false,
                marketing: optMarketing ? optMarketing.checked : false,
                timestamp: new Date().getTime()
            };
            savePreferences(preferences);
        });
    }

    // 6. Unified trigger handler to open settings panel and show overlay
    const openSettingsHandler = (e) => {
        e.preventDefault();
        
        // Open settings panel inside the banner immediately
        settingsPanel.style.display = 'flex';
        saveSettingsBtn.style.display = 'block';
        
        toggleSettingsBtn.setAttribute('data-cs', 'SKRÝT NASTAVENÍ');
        toggleSettingsBtn.setAttribute('data-en', 'HIDE PREFERENCES');
        toggleSettingsBtn.textContent = currentLang === 'cs' ? 'SKRÝT NASTAVENÍ' : 'HIDE PREFERENCES';
        
        // Populate switches
        const currentConsent = localStorage.getItem('karbyCookieConsent') || getCookie('karbyCookieConsent');
        if (currentConsent) {
            try {
                const preferences = JSON.parse(currentConsent);
                if (optAnalytics) optAnalytics.checked = !!preferences.analytics;
                if (optMarketing) optMarketing.checked = !!preferences.marketing;
            } catch(e) {}
        }
        
        if (window.animateCookieBannerOpen) {
            window.animateCookieBannerOpen();
        } else {
            overlay.classList.add('active');
        }

        // Close mobile drawer menu if open
        const mobileDrawer = document.getElementById('mobile-drawer');
        if (mobileDrawer && (mobileDrawer.classList.contains('active') || mobileDrawer.classList.contains('open'))) {
            const drawerCloseBtn = document.getElementById('mobile-drawer-close');
            if (drawerCloseBtn) {
                drawerCloseBtn.click();
            } else {
                mobileDrawer.classList.remove('active');
                mobileDrawer.classList.remove('open');
                const drawerOverlay = document.getElementById('mobile-drawer-overlay');
                if (drawerOverlay) {
                    drawerOverlay.classList.remove('active');
                    drawerOverlay.classList.remove('open');
                }
                document.body.classList.remove('modal-open');
                if (window.lenis) window.lenis.start();
            }
        }
    };

    if (settingsTrigger) settingsTrigger.addEventListener('click', openSettingsHandler);
    const menuSettingsTrigger = document.getElementById('menu-cookie-trigger');
    if (menuSettingsTrigger) menuSettingsTrigger.addEventListener('click', openSettingsHandler);

    // 7. Privacy Policy Modal Trigger Proxy
    const privacyLink = document.getElementById('cookie-privacy-link');
    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Hide the cookie banner overlay temporarily so it doesn't block the legal text
            if (window.animateCookieBannerClose) {
                window.animateCookieBannerClose(() => {
                    overlay.classList.remove('active');
                });
            } else {
                overlay.classList.remove('active');
            }
            window.cookieBannerWasHiddenForLegal = true;
            
            const trigger = document.getElementById('legal-privacy-trigger');
            if (trigger) trigger.click();
        });
    }

    function deleteCookie(name) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = name + '=; Path=/; Domain=' + window.location.hostname + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = name + '=; Path=/; Domain=.' + window.location.hostname + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        
        const hostParts = window.location.hostname.split('.');
        if (hostParts.length >= 2) {
            const mainDomain = '.' + hostParts.slice(-2).join('.');
            document.cookie = name + '=; Path=/; Domain=' + mainDomain + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
    }

    function clearFirstPartyCookies(category) {
        const cookies = document.cookie.split(';');
        const analyticsPatterns = ['_ga', '_gid', '_gat', '__utm'];
        const marketingPatterns = ['_fbp', '_fbc', 'fr'];
        
        let patterns = [];
        if (category === 'analytics') patterns = analyticsPatterns;
        if (category === 'marketing') patterns = marketingPatterns;
        
        cookies.forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            const shouldDelete = patterns.some(pattern => name.startsWith(pattern));
            if (shouldDelete) {
                deleteCookie(name);
            }
        });
    }

    function savePreferences(preferences) {
        localStorage.setItem('karbyCookieConsent', JSON.stringify(preferences));
        setCookie('karbyCookieConsent', JSON.stringify(preferences), 365);
        applyCookiePreferences(preferences);
        
        // Hide overlay
        if (window.animateCookieBannerClose) {
            window.animateCookieBannerClose(() => {
                overlay.classList.remove('active');
                // Reset display after animation completes
                settingsPanel.style.display = 'none';
                saveSettingsBtn.style.display = 'none';
                toggleSettingsBtn.setAttribute('data-cs', 'NASTAVENÍ COOKIES');
                toggleSettingsBtn.setAttribute('data-en', 'COOKIE SETTINGS');
                toggleSettingsBtn.textContent = currentLang === 'cs' ? 'NASTAVENÍ COOKIES' : 'COOKIE SETTINGS';
            });
        } else {
            overlay.classList.remove('active');
            setTimeout(() => {
                settingsPanel.style.display = 'none';
                saveSettingsBtn.style.display = 'none';
                toggleSettingsBtn.setAttribute('data-cs', 'NASTAVENÍ COOKIES');
                toggleSettingsBtn.setAttribute('data-en', 'COOKIE SETTINGS');
                toggleSettingsBtn.textContent = currentLang === 'cs' ? 'NASTAVENÍ COOKIES' : 'COOKIE SETTINGS';
            }, 600);
        }
        
        // Show success notification/toast if showToast is available
        if (typeof showToast === 'function') {
            showToast(currentLang === 'cs' ? 'SOUHLAS BYL ULOŽEN' : 'CONSENT PROTOCOL UPDATED', 'success');
        }
    }

    function applyCookiePreferences(preferences) {
        console.log('Cookie preferences applied:', preferences);
        
        // Custom events to hook up with third party widgets (Analytics/GTM/FB pixel etc)
        if (preferences.analytics) {
            window.analyticsEnabled = true;
            document.dispatchEvent(new CustomEvent('cookies:analytics:optin'));
        } else {
            window.analyticsEnabled = false;
            document.dispatchEvent(new CustomEvent('cookies:analytics:optout'));
            clearFirstPartyCookies('analytics');
        }
        
        if (preferences.marketing) {
            window.marketingEnabled = true;
            document.dispatchEvent(new CustomEvent('cookies:marketing:optin'));
        } else {
            window.marketingEnabled = false;
            document.dispatchEvent(new CustomEvent('cookies:marketing:optout'));
            clearFirstPartyCookies('marketing');
        }
    }
}
