document.addEventListener('DOMContentLoaded', () => {
    // Admin DASHBOARD Elements
    const dashboardModal = document.getElementById('admin-dashboard-modal');
    const closeDashboardBtn = document.getElementById('close-dashboard-btn');
    const dashboardTabs = document.querySelectorAll('.db-nav-btn');
    const tabContents = document.querySelectorAll('.db-tab-content');
    
    // Forms
    const portfolioForm = document.getElementById('portfolio-form');
    const settingsForm = document.getElementById('admin-settings-form');
    
    // Settings elements
    const heroVidInput = document.getElementById('hero-vid-url');
    const saveHeroBtn = document.getElementById('save-hero-vid-btn');

    // Portfolio Form toggles
    const mediaTypeSelect = document.getElementById('p-media-type');
    const fileUploadSection = document.getElementById('file-upload-section');
    const vimeoUploadSection = document.getElementById('vimeo-upload-section');

    // Auth check
    checkAuthStatus();

    // DASHBOARD TRIGGER
    document.addEventListener('click', (e) => {
        if (e.target.id === 'nav-admin-btn' || e.target.closest('#nav-admin-btn')) {
            openDashboard();
        }
    });

    if (closeDashboardBtn) {
        closeDashboardBtn.addEventListener('click', closeDashboard);
    }

    function openDashboard() {
        if (!dashboardModal) return;
        dashboardModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        fetchCurrentSettings();
    }

    function closeDashboard() {
        if (!dashboardModal) return;
        dashboardModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // TAB SWITCHING
    dashboardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            
            dashboardTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${target}`) {
                    content.classList.add('active');
                }
            });

            // Special logic for DB view
            if (target === 'db-view') {
                initDashboardDbView();
            }
        });
    });

    // SETTINGS LOGIC
    async function fetchCurrentSettings() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if (heroVidInput) heroVidInput.value = settings.hero_video_url || '';
        } catch (e) {
            console.error('Failed to fetch settings');
        }
    }

    if (saveHeroBtn) {
        saveHeroBtn.addEventListener('click', async () => {
            const url = heroVidInput.value;
            saveHeroBtn.textContent = 'SAVING...';
            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'hero_video_url', value: url })
                });
                if (res.ok) {
                    if (window.showToast) window.showToast('HERO VIDEO UPDATED', 'success');
                    // Update the live iframe if user is looking at it
                    if (typeof loadSettings === 'function') loadSettings();
                }
            } catch (err) {
                if (window.showToast) window.showToast('SAVE FAILED', 'error');
            } finally {
                saveHeroBtn.textContent = 'SAVE';
            }
        });
    }

    // PORTFOLIO LOGIC
    if (mediaTypeSelect) {
        mediaTypeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'vimeo') {
                fileUploadSection.classList.add('hidden');
                vimeoUploadSection.classList.remove('hidden');
                document.getElementById('p-media').required = false;
                document.getElementById('p-vimeo').required = true;
            } else {
                vimeoUploadSection.classList.add('hidden');
                fileUploadSection.classList.remove('hidden');
                document.getElementById('p-vimeo').required = false;
                document.getElementById('p-media').required = true;
            }
        });
    }

    if (portfolioForm) {
        portfolioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = portfolioForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'TRANSFUSING DATA...';
            
            const formData = new FormData(portfolioForm);
            
            try {
                const res = await fetch('/api/portfolio', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    const successMsg = currentLang === 'cs' ? 'PŘÍSPĚVEK PUBLIKOVÁN. JE NYNÍ VEŘEJNÝ.' : 'POST PUBLISHED. IT IS NOW LIVE.';
                    
                    // NEW: Success Animation
                    showSuccessAnimation(successMsg);
                    
                    portfolioForm.reset();
                    clearPreview();
                    if (typeof loadPortfolio === 'function') loadPortfolio();
                } else {
                    const data = await res.json();
                    if (window.showToast) window.showToast('FAIL: ' + data.error, 'error');
                }
            } catch (err) {
                if (window.showToast) window.showToast('NETWORK FAILURE', 'error');
            } finally {
                btn.innerHTML = originalText;
            }
        });
    }

    // DB VIEW INTEGRATION
    function initDashboardDbView() {
        const dbTabs = dashboardModal.querySelectorAll('.db-tab-btn');
        dbTabs.forEach(btn => {
            // Already has global listener from main/auth logic but let's ensure target
            btn.dataset.wrapper = 'dashboard-db-wrapper';
        });
        // Initial fetch
        dashboardFetchDbData('messages');
    }

    async function dashboardFetchDbData(type) {
        const wrapper = document.getElementById('dashboard-db-wrapper');
        const countEl = document.getElementById('db-total-count'); // if global
        
        wrapper.innerHTML = '<div class="loading-state mono-label">SYNCHRONIZING RECORDS...</div>';
        
        try {
            const res = await fetch(`/api/admin/${type}`);
            const data = await res.json();
            
            if (data.length === 0) {
                wrapper.innerHTML = '<div class="loading-state mono-label">NO RECORDS DETECTED.</div>';
                return;
            }

            let html = `<table class="admin-table"><thead><tr>`;
            if (type === 'messages') {
                html += `<th>DATE</th><th>CLIENT</th><th>EMAIL</th><th>TYPE</th><th>MSG</th>`;
            } else {
                html += `<th>ID</th><th>NAME</th><th>EMAIL</th><th>ROLE</th>`;
            }
            html += `</tr></thead><tbody>`;
            
            data.forEach(item => {
                const date = new Date(item.created_at).toLocaleDateString();
                if (type === 'messages') {
                    html += `<tr><td>${date}</td><td>${item.name}</td><td>${item.email}</td><td>${item.project_type}</td><td title="${item.message}">${item.message.substring(0,20)}...</td></tr>`;
                } else {
                    html += `<tr><td>#${item.id}</td><td>${item.full_name}</td><td>${item.email}</td><td>${item.role.toUpperCase()}</td></tr>`;
                }
            });
            html += `</tbody></table>`;
            wrapper.innerHTML = html;
        } catch (e) {
            wrapper.innerHTML = `<div class="error-msg">SCAN FAILED</div>`;
        }
    }

    const dropzone = document.getElementById('p-dropzone');
    const mediaInput = document.getElementById('p-media');
    const previewContainer = document.getElementById('p-preview-container');
    const previewImg = document.getElementById('p-preview-img');

    if (dropzone && mediaInput) {
        // Drag feedback
        mediaInput.addEventListener('dragenter', () => dropzone.classList.add('drag-over'));
        mediaInput.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        mediaInput.addEventListener('drop', () => dropzone.classList.remove('drag-over'));

        mediaInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                clearPreview();
            }
        });
    }

    function clearPreview() {
        if (previewImg) previewImg.src = '';
        if (previewContainer) previewContainer.classList.add('hidden');
    }

    // SUCCESS ANIMATION logic
    function showSuccessAnimation(msg) {
        const overlay = document.getElementById('admin-success-overlay');
        if (!overlay) {
            if (window.showToast) window.showToast(msg, 'success');
            return;
        }

        const tl = gsap.timeline();
        
        // Show overlay
        tl.to(overlay, { autoAlpha: 1, duration: 0.4, ease: 'power2.inOut' });
        
        // Entrance of title and icon
        tl.fromTo(overlay.querySelector('.glitch-title'), 
            { y: 20, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }
        );
        tl.fromTo(overlay.querySelector('.success-icon'), 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.8, ease: 'elastic.out(1, 0.3)' }, 
            '-=0.3'
        );

        // Hold and then hide
        tl.to(overlay, { autoAlpha: 0, duration: 0.6, delay: 1.5, ease: 'power2.inOut', onComplete: () => {
             if (window.showToast) window.showToast(msg, 'success');
        }});
    }

    // Auth status helper
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/check-auth');
            if (res.ok) {
                const data = await res.json();
                window.isAdmin = (data.authenticated && data.role === 'admin');
                if (window.isAdmin) document.body.classList.add('admin-enabled');
            }
        } catch(e) {}
    }
});
