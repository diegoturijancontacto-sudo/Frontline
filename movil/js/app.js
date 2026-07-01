// ============================================
// APP.JS - Inicialización y navegación
// ============================================

// ============================================
// TOAST
// ============================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('customToast');
    const msgSpan = document.getElementById('toastMessage');
    const iconSpan = document.getElementById('toastIcon');

    msgSpan.innerText = message;
    if (type === 'success') {
        iconSpan.innerHTML = '<i class="fas fa-check-circle text-emerald-400 text-sm"></i>';
    } else if (type === 'error') {
        iconSpan.innerHTML = '<i class="fas fa-exclamation-circle text-red-400 text-sm"></i>';
    } else {
        iconSpan.innerHTML = '<i class="fas fa-info-circle text-blue-400 text-sm"></i>';
    }

    toast.classList.add('show');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ============================================
// NAVEGACIÓN
// ============================================

function goHome() {
    document.getElementById('homeScreen').classList.remove('hidden');
    document.getElementById('homeScreen').style.display = 'flex';
    document.getElementById('resultsPanel').classList.add('hidden');
    document.getElementById('searchContainer').classList.add('hidden');
    document.getElementById('pageTitle').textContent = 'Inicio';
    document.getElementById('btnConfigCatalogo').classList.add('hidden');
    closeAllSidebars();
    document.getElementById('filterPanel').classList.remove('active');
}

function openFilters() {
    document.getElementById('filterPanel').classList.add('active');
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('resultsPanel').classList.add('hidden');
    document.getElementById('pageTitle').textContent = 'Filtros';
}

function closeFilterPanel() {
    document.getElementById('filterPanel').classList.remove('active');
    if (state.filteredObras.length === 0 && !state.hasAppliedInitialFilters) {
        goHome();
    } else {
        document.getElementById('resultsPanel').classList.remove('hidden');
        document.getElementById('pageTitle').textContent = 'Resultados';
        document.getElementById('searchContainer').classList.remove('hidden');
        document.getElementById('btnConfigCatalogo').classList.remove('hidden');
    }
}

function applyFiltersAndClose() {
    applyFilters();
    closeFilterPanel();
}

function toggleConfigPanel() {
    const panel = document.getElementById('configPanel');
    panel.classList.toggle('hidden');
}

function closeConfigPanel() {
    document.getElementById('configPanel').classList.add('hidden');
}

function closeAllSidebars() {
    document.getElementById('configPanel').classList.add('hidden');
    document.getElementById('localCatalogsPanel').classList.add('hidden');
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Cargar datos
    await fetchSheetsDatabase();
    await loadLocalCatalogs();
    goHome();
});

// ============================================
// EVENTOS GLOBALES
// ============================================

// Cerrar paneles al hacer clic fuera
document.addEventListener('click', function(e) {
    const configPanel = document.getElementById('configPanel');
    const localPanel = document.getElementById('localCatalogsPanel');
    
    if (configPanel && !configPanel.classList.contains('hidden')) {
        if (!e.target.closest('.config-panel-content') && !e.target.closest('[onclick*="toggleConfigPanel"]')) {
            closeConfigPanel();
        }
    }
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
    // Escape para cerrar paneles
    if (e.key === 'Escape') {
        closeAllSidebars();
        if (document.getElementById('filterPanel').classList.contains('active')) {
            closeFilterPanel();
        }
    }
    
    // Ctrl+F para abrir filtros
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        if (document.getElementById('filterPanel').classList.contains('active')) {
            closeFilterPanel();
        } else {
            openFilters();
        }
    }
});

// Actualizar el texto del botón de guardar según el estado de edición
function updateSaveButtonText() {
    const btnText = document.getElementById('saveButtonText');
    const btnTextMobile = document.getElementById('saveButtonTextMobile');
    if (state.currentCatalogId !== null) {
        if (btnText) btnText.textContent = 'ACTUALIZAR CATÁLOGO';
        if (btnTextMobile) btnTextMobile.textContent = 'ACTUALIZAR';
    } else {
        if (btnText) btnText.textContent = 'GUARDAR CATÁLOGO';
        if (btnTextMobile) btnTextMobile.textContent = 'GUARDAR';
    }
}
