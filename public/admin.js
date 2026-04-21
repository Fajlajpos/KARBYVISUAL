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
        if (window.toggleBodyLock) window.toggleBodyLock(true);
        fetchCurrentSettings();
        fetchFoldersAdmin();
    }

    function closeDashboard() {
        if (!dashboardModal) return;
        dashboardModal.classList.remove('active');
        if (window.toggleBodyLock) window.toggleBodyLock(false);
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
            const statusEl = document.getElementById('hero-status');
            
            saveHeroBtn.textContent = 'TRANSMITTING...';
            if (statusEl) statusEl.textContent = 'UPLOADING_DATA';
            
            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'hero_video_url', value: url })
                });
                if (res.ok) {
                    if (window.showToast) window.showToast('HERO VISUALS SYNCHRONIZED', 'success');
                    if (statusEl) statusEl.textContent = 'SYNC_COMPLETE';
                    // Update the live iframe
                    if (typeof loadSettings === 'function') loadSettings();
                } else {
                    throw new Error('Save failed');
                }
            } catch (err) {
                if (window.showToast) window.showToast('CORE_LINK_FAILURE', 'error');
                if (statusEl) statusEl.textContent = 'ERROR_DETECTED';
            } finally {
                setTimeout(() => {
                    saveHeroBtn.textContent = 'UPDATE';
                    if (statusEl && statusEl.textContent !== 'ERROR_DETECTED') statusEl.textContent = 'STANDBY';
                }, 2000);
            }
        });
    }

    // FOLDERS LOGIC
    async function fetchFoldersAdmin() {
        const categorySelect = document.getElementById('p-category');
        const foldersList = document.getElementById('admin-folders-list');
        
        try {
            const res = await fetch('/api/folders');
            const data = await res.json();
            
            // Populate select
            if (categorySelect) {
                categorySelect.innerHTML = '';
                data.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f.category_id;
                    const isCS = (typeof currentLang !== 'undefined' ? currentLang : 'cs') === 'cs';
                    opt.textContent = isCS ? f.title_cs : f.title_en;
                    // Pro zachování překladů pokud by user přepínal jazyk i v adminu:
                    opt.setAttribute('data-cs', f.title_cs);
                    opt.setAttribute('data-en', f.title_en);
                    categorySelect.appendChild(opt);
                });
            }

            // Populate list
            if (foldersList) {
                if (data.length === 0) {
                    foldersList.innerHTML = '<div class="mono-label" style="opacity: 0.5;">NO FOLDERS CONFIGURED.</div>';
                } else {
                    foldersList.innerHTML = '';
                    data.forEach(f => {
                        foldersList.innerHTML += `
                            <div class="port-item" style="display:flex; justify-content:space-between; align-items:center; padding: 1rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
                                <div>
                                    <div class="mono-label" style="opacity:0.6; font-size: 0.6rem;">ID: ${f.category_id}</div>
                                    <div style="font-weight: 500;">CS: ${f.title_cs} | EN: ${f.title_en}</div>
                                </div>
                                <button type="button" class="action-icon-btn" onclick="window.deleteFolder(${f.id})"><i class="ph ph-trash"></i> DELETE</button>
                            </div>
                        `;
                    });
                }
            }
        } catch (e) {
            console.error('Failed to fetch folders', e);
        }
    }

    const addFolderForm = document.getElementById('add-folder-form');
    if (addFolderForm) {
        addFolderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = addFolderForm.querySelector('button[type="submit"]');
            btn.innerHTML = 'CREATING...';
            const statusLabel = document.getElementById('folder-form-status');
            
            const titleCS = document.getElementById('folder-title-cs').value;
            const titleEN = document.getElementById('folder-title-en').value;
            
            try {
                const res = await fetch('/api/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ titleCS, titleEN })
                });
                
                if (res.ok) {
                    if (window.showToast) window.showToast('FOLDER ESTABLISHED', 'success');
                    if (statusLabel) {
                         statusLabel.style.color = '#4CAF50';
                         statusLabel.textContent = 'SLOŽKA ÚSPĚŠNĚ VYTVOŘENA';
                    }
                    addFolderForm.reset();
                    fetchFoldersAdmin();
                    if (typeof loadFolders === 'function') loadFolders(); // public UI refresh
                } else {
                    if (statusLabel) {
                         statusLabel.style.color = 'var(--accent)';
                         statusLabel.textContent = 'CHYBA PŘI VYTVÁŘENÍ SLOŽKY';
                    }
                }
            } catch (err) {
                 if (statusLabel) statusLabel.textContent = 'NETWORK FAILURE';
            } finally {
                btn.innerHTML = '<span class="btn-text" data-cs="ZALOŽIT SLOŽKU" data-en="CREATE FOLDER">ZALOŽIT SLOŽKU</span>';
                setTimeout(() => { if(statusLabel) statusLabel.textContent = ''; }, 3000);
            }
        });
    }

    window.deleteFolder = async function(id) {
        if (!confirm('DELETE THIS FOLDER ENTIRELY?')) return;
        try {
            const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (window.showToast) window.showToast('FOLDER ANNIHILATED', 'success');
                fetchFoldersAdmin();
                if (typeof loadFolders === 'function') loadFolders();
            } else {
                if (window.showToast) window.showToast('ACTION FAILED', 'error');
            }
        } catch(e) {
            console.error(e);
        }
    };

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

    // Setup detail panel toggles globally for standalone DB Modal
    document.addEventListener('click', (e) => {
        if (e.target.closest('#detail-panel-close') || e.target.id === 'db-detail-overlay') {
            closeDbDetailPanel();
        }
    });

    function openDbDetailPanel() {
        const panel = document.getElementById('db-detail-panel');
        const overlay = document.getElementById('db-detail-overlay');
        if(panel) panel.classList.add('active');
        if(overlay) overlay.classList.add('active');
    }

    function closeDbDetailPanel() {
        const panel = document.getElementById('db-detail-panel');
        const overlay = document.getElementById('db-detail-overlay');
        if(panel) panel.classList.remove('active');
        if(overlay) overlay.classList.remove('active');
    }

    async function deleteDbRecord(type, id) {
        if (!confirm(`ARE YOU SURE YOU WANT TO DELETE THIS ${type.toUpperCase()}?`)) return;
        try {
            const res = await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if(window.showToast) window.showToast('RECORD PURGED', 'success');
                dashboardFetchDbData(type); // refresh
                closeDbDetailPanel();
            } else {
                if(window.showToast) window.showToast('ACTION FAILED', 'error');
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.openUserDetail = async function(email, fullName) {
        openDbDetailPanel();
        const title = document.getElementById('detail-panel-title');
        const content = document.getElementById('detail-panel-content');
        
        title.textContent = `USER [${fullName}]`;
        content.innerHTML = '<div class="loading-state mono-label">SCANNING ARCHIVE...</div>';

        try {
            const res = await fetch(`/api/admin/user-messages/${encodeURIComponent(email)}`);
            const messages = await res.json();

            if (messages.length === 0) {
                content.innerHTML = '<div class="mono-label" style="opacity:0.5; padding: 2rem 0;">NO TRANSMISSION DATA FOUND.</div>';
                return;
            }

            let html = `<div class="mono-label" style="margin-bottom:1.5rem;">FOUND [${messages.length}] RECORD(S)</div>`;
            messages.forEach(msg => {
                const date = new Date(msg.created_at).toLocaleString();
                html += `
                    <div class="transmission-log-card">
                        <div class="meta-grid">
                            <div class="meta-item"><span>DATE</span><strong>${date}</strong></div>
                            <div class="meta-item"><span>PROJECT_TYPE</span><strong>${msg.project_type || 'N/A'}</strong></div>
                            <div class="meta-item"><span>BUDGET_CLASS</span><strong>${msg.budget || 'N/A'}</strong></div>
                            <div class="meta-item"><span>STATUS</span><strong style="color:var(--accent);">DELIVERED</strong></div>
                        </div>
                        <div class="msg-content">${msg.message}</div>
                        <div style="margin-top: 1.5rem; text-align: right;">
                            <button type="button" class="action-icon-btn" onclick="window.deleteDbRecordMsg(${msg.id})">
                                <i class="ph ph-trash"></i> PURGE_RECORD
                            </button>
                        </div>
                    </div>
                `;
            });
            content.innerHTML = html;
        } catch(e) {
            content.innerHTML = '<div class="error-msg">SCAN FAILED</div>';
        }
    };

    window.openMessageDetail = function(msgJsonStr) {
        openDbDetailPanel();
        try {
            const msg = JSON.parse(decodeURIComponent(msgJsonStr));
            const title = document.getElementById('detail-panel-title');
            const content = document.getElementById('detail-panel-content');
            
            title.textContent = `TRANSMISSION [ID#${msg.id}]`;
            
            const date = new Date(msg.created_at).toLocaleString();
            let html = `
                <div class="transmission-log-card">
                    <div class="meta-grid">
                        <div class="meta-item"><span>SENDER_NAME</span><strong>${msg.name}</strong></div>
                        <div class="meta-item"><span>SENDER_EMAIL</span><strong>${msg.email}</strong></div>
                        <div class="meta-item"><span>DATE_RECEIVED</span><strong>${date}</strong></div>
                        <div class="meta-item"><span>PROJECT_TYPE</span><strong>${msg.project_type || 'N/A'}</strong></div>
                        <div class="meta-item"><span>BUDGET_VAL</span><strong>${msg.budget || 'N/A'}</strong></div>
                    </div>
                    <div class="msg-content" style="border:1px dashed rgba(255,255,255,0.1); padding: 1.5rem; background: rgba(0,0,0,0.3);">${msg.message}</div>
                    
                    <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                        <a href="mailto:${msg.email}" class="action-btn-tactical" style="text-decoration:none;"><i class="ph ph-envelope-simple"></i> REPLY_LINK</a>
                        <button type="button" class="action-icon-btn" style="padding: 0.6rem 1rem;" onclick="window.deleteDbRecordMsg(${msg.id})">
                            <i class="ph ph-trash"></i> DELETE
                        </button>
                    </div>
                </div>
            `;
            content.innerHTML = html;
        } catch(e) { console.error(e); }
    };

    window.deleteDbRecordMsg = function(id) { deleteDbRecord('messages', id); };
    window.deleteDbRecordUser = function(id) { deleteDbRecord('users', id); };

    window.dashboardFetchDbData = async function(type) {
        const wrapper = document.getElementById('db-table-wrapper');
        const countEl = document.getElementById('db-total-count'); 
        
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
                html += `<th>DATE</th><th>CLIENT</th><th>EMAIL</th><th>TYPE</th><th>MSG</th><th>ACTION</th>`;
            } else {
                html += `<th>ID</th><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>ACTION</th>`;
            }
            html += `</tr></thead><tbody>`;
            
            data.forEach(item => {
                const date = new Date(item.created_at).toLocaleDateString();
                
                if (type === 'messages') {
                    const encodedMsg = encodeURIComponent(JSON.stringify(item));
                    html += `
                    <tr class="table-row-clickable">
                        <td onclick="window.openMessageDetail('${encodedMsg}')">${date}</td>
                        <td onclick="window.openMessageDetail('${encodedMsg}')">${item.name}</td>
                        <td onclick="window.openMessageDetail('${encodedMsg}')">${item.email}</td>
                        <td onclick="window.openMessageDetail('${encodedMsg}')">${item.project_type}</td>
                        <td onclick="window.openMessageDetail('${encodedMsg}')" title="${item.message}">${item.message.substring(0,30)}...</td>
                        <td>
                            <button class="action-icon-btn" onclick="window.deleteDbRecordMsg(${item.id})"><i class="ph ph-trash"></i></button>
                        </td>
                    </tr>`;
                } else {
                    html += `
                    <tr class="table-row-clickable">
                        <td onclick="window.openUserDetail('${item.email}', '${item.full_name}')">#${item.id}</td>
                        <td onclick="window.openUserDetail('${item.email}', '${item.full_name}')">${item.full_name}</td>
                        <td onclick="window.openUserDetail('${item.email}', '${item.full_name}')">${item.email}</td>
                        <td onclick="window.openUserDetail('${item.email}', '${item.full_name}')">${item.role.toUpperCase()}</td>
                        <td>
                            <button class="action-icon-btn" onclick="window.deleteDbRecordUser(${item.id})" ${item.role === 'admin' ? 'disabled style="opacity:0.2"' : ''}><i class="ph ph-trash"></i></button>
                        </td>
                    </tr>`;
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

    const metaInfo = document.getElementById('p-meta-info');

    if (dropzone && mediaInput) {
        // Drag feedback
        mediaInput.addEventListener('dragenter', () => dropzone.classList.add('drag-over'));
        mediaInput.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        mediaInput.addEventListener('drop', () => dropzone.classList.remove('drag-over'));

        mediaInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                // Metadata
                let totalSize = 0;
                let imageCount = 0;
                let videoCount = 0;
                
                previewContainer.innerHTML = '<div class="scanner-line"></div>'; // Reset
                const galleryWrapper = document.createElement('div');
                galleryWrapper.className = 'preview-gallery';
                previewContainer.appendChild(galleryWrapper);

                Array.from(files).forEach((file, index) => {
                    totalSize += file.size;
                    if (file.type.startsWith('image/')) imageCount++;
                    else videoCount++;

                    // Create Small Preview
                    const thumb = document.createElement('div');
                    thumb.className = 'preview-thumb';
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (re) => { thumb.innerHTML = `<img src="${re.target.result}">`; };
                        reader.readAsDataURL(file);
                    } else {
                        thumb.innerHTML = `<div class="video-placeholder"><i class="ph ph-video-camera"></i></div>`;
                    }
                    galleryWrapper.appendChild(thumb);
                });

                const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
                if (metaInfo) {
                    metaInfo.innerHTML = `<span>BATCH: ${files.length} ITEMS</span><span>TOTAL: ${totalSizeMB} MB</span>`;
                }

                previewContainer.classList.remove('hidden');
                
                // Re-add status overlay
                const statusOverlay = document.createElement('div');
                statusOverlay.className = 'preview-overlay';
                statusOverlay.innerHTML = `
                    <div class="meta-info">${metaInfo.innerHTML}</div>
                    <div class="status-ready"><i class="ph ph-check-circle"></i> DATA_ARRAY_READY</div>
                `;
                previewContainer.appendChild(statusOverlay);

            } else {
                clearPreview();
            }
        });
    }

    function clearPreview() {
        if (previewContainer) {
            previewContainer.innerHTML = '<div class="scanner-line"></div>';
            previewContainer.classList.add('hidden');
        }
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
