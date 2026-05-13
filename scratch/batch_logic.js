

/* ==========================================
   BATCH ACTIONS & SORTING LOGIC
   ========================================== */

function toggleSelectionMode(category, titles, originEl) {
    isSelectionMode = !isSelectionMode;
    if (!isSelectionMode) selectedItems.clear();
    updateBatchBar();
    openFolderModal(category, titles, originEl); // Re-render with new mode
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

function updateBatchBar() {
    const bar = document.getElementById('batch-actions-bar');
    if (!bar) return;
    const countEl = bar.querySelector('.selection-count');
    
    if (isSelectionMode && selectedItems.size > 0) {
        bar.classList.add('active');
        countEl.textContent = `${selectedItems.size} ITEMS_SELECTED`;
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
            updateBatchBar();
            const grid = document.getElementById('folder-items-grid');
            if (grid) {
                grid.querySelectorAll('.port-item').forEach(el => {
                    el.classList.remove('selecting', 'selected');
                });
            }
        };
    }

    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.onclick = async () => {
            const ids = Array.from(selectedItems);
            const confirmMsg = currentLang === 'cs' ? `OPRAVDU SMAZAT ${ids.length} POLOŽEK?` : `REALLY DELETE ${ids.length} ITEMS?`;
            const confirmed = await window.customConfirm(confirmMsg);
            if (!confirmed) return;

            try {
                const res = await fetch('/api/portfolio/batch-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids })
                });
                if (res.ok) {
                    showToast('BATCH_DELETE_SUCCESS', 'success');
                    selectedItems.clear();
                    isSelectionMode = false;
                    updateBatchBar();
                    loadPortfolio().then(() => {
                        const closeBtn = document.getElementById('close-folder-modal');
                        if (closeBtn) closeBtn.click();
                    });
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
        grid.querySelectorAll('.drag-handle').forEach(h => h.style.opacity = 0);
    } else {
        // Enable
        sortableInstance = new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            onEnd: () => { console.log('Item moved'); }
        });
        btn.innerHTML = '<i class="ph ph-check"></i> SAVE ORDER';
        btn.classList.add('active');
        grid.querySelectorAll('.drag-handle').forEach(h => h.style.opacity = 1);
        showToast('SORTING_MODE_ACTIVE', 'info');
    }
}

async function saveNewOrder(grid) {
    const items = Array.from(grid.querySelectorAll('.port-item'));
    const orders = items.map((el, index) => ({
        id: parseInt(el.dataset.id),
        sort_order: index
    }));

    try {
        const res = await fetch('/api/portfolio/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders })
        });
        if (res.ok) {
            showToast('ORDER_SYNCHRONIZED', 'success');
            loadPortfolio();
        }
    } catch (err) {
        showToast('ORDER_SYNC_FAILED', 'error');
    }
}
