// ============================================
// CATALOGS.JS - Gestión de catálogos en UI
// ============================================

// Crear nuevo catálogo
async function createNewCatalog() {
    const name = prompt('Nombre del nuevo catálogo:', 'Catálogo ' + new Date().toLocaleDateString());
    if (name === null) return;
    const trimmedName = name.trim() || 'Catálogo sin título';
    
    // RESETEAR EL ESTADO DE EDICIÓN
    state.currentCatalogId = null;
    state.currentCatalogTitle = null;
    
    // Limpiar selecciones anteriores
    state.selectedIds = new Set();
    
    // Resetear configuración a valores por defecto
    document.getElementById('pdfArtistName').value = trimmedName;
    document.getElementById('pdfSubtitle').value = 'OBRA SELECCIONADA';
    document.getElementById('pdfUpdateText').value = 'ACTUALIZACIÓN ' + new Date().getFullYear();
    document.getElementById('pdfLegalNote').value = 'Toda la obra se encuentra disponible a reserva de confirmación de precio y autenticidad.';
    
    document.getElementById('cfgPrices').checked = true;
    document.getElementById('cfgDims').checked = true;
    document.getElementById('cfgLocation').checked = true;
    document.getElementById('cfgProveedor').checked = false;
    document.getElementById('cfgFicha').checked = true;
    
    // Sincronizar paneles
    syncConfigs();
    updateSidebarSummary();
    updateSaveButtonText();
    
    // Abrir filtros para seleccionar obras
    openFilters();
    showToast(`Nuevo catálogo "${trimmedName}" creado. Selecciona obras y guarda.`, 'success');
}
// Cargar lista de catálogos guardados
async function loadLocalCatalogs() {
    const gridContainer = document.getElementById('catalogsGrid');
    const countSpan = document.getElementById('catalogCount');
    
    try {
        const catalogs = await getSavedCatalogs();
        
        countSpan.textContent = `${catalogs.length} catálogo${catalogs.length !== 1 ? 's' : ''}`;

        if (catalogs.length === 0) {
            gridContainer.innerHTML = `
                <div class="col-span-full text-center text-slate-400 py-12">
                    <i class="fas fa-folder-open text-4xl mb-3 opacity-30"></i>
                    <p class="text-sm">No tienes catálogos guardados.</p>
                    <p class="text-xs mt-1">Crea tu primer catálogo haciendo clic en el botón superior.</p>
                </div>
            `;
            return;
        }

        gridContainer.innerHTML = '';
        catalogs.forEach(cat => {
            const card = document.createElement('div');
            card.className = 'catalog-card';
            
            // Marcar si es el catálogo que está siendo editado
            const isEditing = state.currentCatalogId === cat.id;
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <input type="text" class="name-input" value="${cat.title}" 
                           onchange="renameCatalog('${cat.id}', this.value)" 
                           onfocus="this.select()"
                           title="Haz clic para editar el nombre">
                    <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ml-2">
                        ${isEditing ? '✏️ EDITANDO' : `${cat.selectedWorksCount} obras`}
                    </span>
                </div>
                <div class="text-xs text-slate-400 mb-3">${cat.date}</div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="loadSavedCatalog('${cat.id}')" class="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <i class="fas fa-folder-open"></i> ${isEditing ? 'Continuar editando' : 'Abrir'}
                    </button>
                    <button onclick="deleteCatalog('${cat.id}')" class="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <i class="far fa-trash-alt"></i> Eliminar
                    </button>
                </div>
                ${isEditing ? `
                    <div class="edit-hint text-blue-500">
                        <i class="fas fa-pen text-[8px] mr-1"></i> Editando actualmente - Guardar para actualizar
                    </div>
                ` : `
                    <div class="edit-hint"><i class="fas fa-pen text-[8px] mr-1"></i> Haz clic en el nombre para editarlo</div>
                `}
            `;
            gridContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar catálogos:', error);
        gridContainer.innerHTML = `
            <div class="col-span-full text-center text-red-400 py-12">
                <i class="fas fa-exclamation-triangle text-4xl mb-3 opacity-50"></i>
                <p class="text-sm">Error al cargar los catálogos</p>
                <p class="text-xs mt-1">Verifica la conexión con el servidor.</p>
                <button onclick="loadLocalCatalogs()" class="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
                    <i class="fas fa-sync mr-1"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Alternar panel de catálogos locales
function toggleLocalCatalogsPanel() {
    const panel = document.getElementById('localCatalogsPanel');
    if (panel.classList.contains('hidden')) {
        loadLocalCatalogs();
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

// NUEVA FUNCIÓN: Resetear el estado de edición (para cuando se cierra un catálogo sin guardar)
function resetEditingState() {
    state.currentCatalogId = null;
    state.currentCatalogTitle = null;
    // No resetear las selecciones para que el usuario pueda continuar
}
