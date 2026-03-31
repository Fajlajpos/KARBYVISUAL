document.addEventListener('DOMContentLoaded', () => {
    const loginTrigger = document.getElementById('top-login-btn');
    const footerLoginTrigger = document.getElementById('login-trigger');
    const loginModal = document.getElementById('login-modal');
    const loginStatus = document.getElementById('login-status');
    const loginForm = document.getElementById('login-form');
    
    // Top nav elements
    const navAdminWrapper = document.getElementById('nav-admin-wrapper');
    const navAdminBtn = document.getElementById('nav-admin-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    
    // Admin toolbar elements (footer fallback / extra actions)
    const adminToolbar = document.getElementById('admin-toolbar');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Upload Modal elements
    const adminUploadModal = document.getElementById('admin-upload-modal');
    const closeUploadBtn = document.getElementById('close-upload-btn');
    const portfolioForm = document.getElementById('portfolio-form');
    const mediaTypeSelect = document.getElementById('p-media-type');
    const fileUploadSection = document.getElementById('file-upload-section');
    const vimeoUploadSection = document.getElementById('vimeo-upload-section');

    // Check Auth Status on Load
    checkAuthStatus();
    
    // Login Triggers
    const handleLoginClick = (e) => {
        e.preventDefault();
        if (window.isAdmin) {
            // Already admin, maybe log out or do nothing
        } else {
            loginModal.classList.add('active');
        }
    };

    if (loginTrigger) loginTrigger.addEventListener('click', handleLoginClick);
    if (footerLoginTrigger) footerLoginTrigger.addEventListener('click', handleLoginClick);
        
    if (loginModal) {
        loginModal.querySelector('.close-btn').addEventListener('click', () => {
            loginModal.classList.remove('active');
        });
    }
    
    // Login Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    setAdminState(true);
                    loginModal.classList.remove('active');
                } else {
                    loginStatus.textContent = data.error || 'Login Failed';
                }
            } catch (err) {
                 loginStatus.textContent = 'Server Error';
            }
        });
    }
    
    // Logout
    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        setAdminState(false);
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', handleLogout);
    }

    // Checking authentication status
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/check-auth');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated && data.role === 'admin') {
                    setAdminState(true);
                }
            }
        } catch(e) { /* user not logged in */ }
    }

    function setAdminState(isAdminState) {
        window.isAdmin = isAdminState;
        if (isAdminState) {
            document.body.classList.add('admin-mode');
            
            // Hide login triggers
            if (loginTrigger) loginTrigger.classList.add('hidden');
            if (footerLoginTrigger) footerLoginTrigger.classList.add('hidden');
            
            // Show new Nav btn
            if (navAdminWrapper) navAdminWrapper.classList.remove('hidden');
            
            // Show bottom toolbar
            if (adminToolbar) {
                adminToolbar.classList.remove('hidden');
                setTimeout(() => adminToolbar.classList.add('visible'), 100);
            }
        } else {
            document.body.classList.remove('admin-mode');
            
            // Show login triggers
            if (loginTrigger) loginTrigger.classList.remove('hidden');
            if (footerLoginTrigger) footerLoginTrigger.classList.remove('hidden');
            
            // Hide new Nav btn
            if (navAdminWrapper) navAdminWrapper.classList.add('hidden');
            
            if (adminToolbar) {
                adminToolbar.classList.remove('visible');
                setTimeout(() => adminToolbar.classList.add('hidden'), 400);
            }
        }
        
        // Rerender portfolio to show/hide admin buttons
        if (typeof renderPortfolio === 'function' && typeof portfolioData !== 'undefined') {
            renderPortfolio('all');
        }
    }
    
    // ==========================================
    // UPLOAD MODAL LOGIC
    // ==========================================
    if (navAdminBtn && adminUploadModal) {
        navAdminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            adminUploadModal.classList.add('active');
        });
        
        closeUploadBtn.addEventListener('click', () => {
            adminUploadModal.classList.remove('active');
        });

        // Delegate listener to bottom-toolbar plus sign for backward compatibility
        const oldAddBtn = document.getElementById('add-portfolio-btn');
        if (oldAddBtn) {
            oldAddBtn.addEventListener('click', (e) => {
                 e.preventDefault();
                 adminUploadModal.classList.add('active');
            });
        }
    }

    // Dynamic field toggle based on Media Type
    if (mediaTypeSelect) {
        mediaTypeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'vimeo') {
                fileUploadSection.classList.add('hidden');
                document.getElementById('p-media').required = false;
                
                vimeoUploadSection.classList.remove('hidden');
                document.getElementById('p-vimeo').required = true;
            } else {
                vimeoUploadSection.classList.add('hidden');
                document.getElementById('p-vimeo').required = false;
                
                fileUploadSection.classList.remove('hidden');
                document.getElementById('p-media').required = true;
            }
        });
    }

    if (portfolioForm) {
        portfolioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = portfolioForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'UPLOADING...';
            
            const formData = new FormData(portfolioForm);
            
            try {
                const res = await fetch('/api/portfolio', {
                    method: 'POST',
                    body: formData // Multipar/form-data because of file
                });
                const data = await res.json();
                
                if (res.ok) {
                    adminUploadModal.classList.remove('active');
                    portfolioForm.reset();
                    if(typeof loadPortfolio === 'function') loadPortfolio();
                } else {
                    alert('Upload failed: ' + (data.error || 'Server error'));
                }
            } catch (err) {
                 alert('Network error during upload.');
            } finally {
                 btn.textContent = originalText;
            }
        });
    }
    
    // Delegate Delete Listener to Body
    document.body.addEventListener('click', async (e) => {
        if (e.target.closest('.delete-btn')) {
            const btn = e.target.closest('.delete-btn');
            const id = btn.getAttribute('data-id');
            if (confirm('DESTRUCTIVE ACTION: Remove item from archive?')) {
                await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
                // reload
                if(typeof loadPortfolio === 'function') loadPortfolio();
            }
        }
    });

});
