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
    document.getElementById('cfgDimsOrder').checked = true;
    document.getElementById('cfgLocation').checked = false;
    document.getElementById('cfgProveedor').checked = false;
    document.getElementById('cfgFicha').checked = true;
    
    // Sincronizar paneles
    syncConfigs();
    updateSidebarSummary();
    
    // Verificar que la función existe antes de llamarla
    if (typeof updateSaveButtonText === 'function') {
        updateSaveButtonText();
    } else {
        console.warn('updateSaveButtonText no está disponible');
    }
    
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

// Cargar PDFs de catálogos personalizados publicados por Apps Script
async function loadPersonalizedCatalogs() {
    const listContainer = document.getElementById('personalizedCatalogsList');
    const countSpan = document.getElementById('personalizedCatalogCount');
    if (!listContainer || !countSpan) return;

    listContainer.innerHTML = `
        <div class="text-center text-slate-400 py-8">
            <i class="fas fa-spinner fa-spin mb-3"></i>
            <p class="text-sm">Cargando catálogos personalizados...</p>
        </div>
    `;

    try {
        const response = await fetch(`${PERSONALIZED_CATALOGS_URL}?action=list`);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

        const result = await response.json();
        if (result.status !== 'ok' || !Array.isArray(result.files)) {
            throw new Error(result.message || 'Respuesta inválida del servidor');
        }

        const catalogs = result.files;
        countSpan.textContent = `${catalogs.length} catálogo${catalogs.length !== 1 ? 's' : ''}`;

        if (catalogs.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center text-slate-400 py-8">
                    <i class="fas fa-folder-open text-3xl mb-3 opacity-30"></i>
                    <p class="text-sm">No hay catálogos personalizados disponibles.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';
        catalogs.forEach(catalog => {
            const card = document.createElement('div');
            card.className = 'personalized-catalog-card';

            const info = document.createElement('div');
            info.className = 'min-w-0';

            const title = document.createElement('p');
            title.className = 'font-medium text-sm text-slate-800 truncate';
            title.textContent = catalog.name || 'Catálogo sin nombre';

            const metadata = document.createElement('p');
            metadata.className = 'text-xs text-slate-400 mt-1';
            metadata.textContent = formatPersonalizedCatalogMetadata(catalog);

            info.append(title, metadata);

            const download = document.createElement('a');
            download.className = 'personalized-catalog-download';
            download.href = `${PERSONALIZED_CATALOGS_URL}?action=download&id=${encodeURIComponent(catalog.id)}`;
            download.target = '_blank';
            download.rel = 'noopener';
            download.title = 'Descargar catálogo';
            download.innerHTML = '<i class="fas fa-download"></i><span>Descargar</span>';

            card.append(info, download);
            listContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar catálogos personalizados:', error);
        countSpan.textContent = 'No disponible';
        listContainer.innerHTML = `
            <div class="text-center text-red-400 py-8">
                <i class="fas fa-exclamation-triangle text-3xl mb-3 opacity-60"></i>
                <p class="text-sm">No se pudieron cargar los catálogos personalizados.</p>
                <button onclick="loadPersonalizedCatalogs()" class="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
                    <i class="fas fa-sync mr-1"></i> Reintentar
                </button>
            </div>
        `;
    }
}

function formatPersonalizedCatalogMetadata(catalog) {
    const parts = [];
    if (catalog.size) parts.push(formatFileSize(catalog.size));
    if (catalog.date) {
        const date = new Date(catalog.date);
        if (!Number.isNaN(date.getTime())) {
            parts.push(date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }));
        }
    }
    return parts.join(' · ') || 'PDF disponible para descarga';
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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

// Resetear el estado de edición
function resetEditingState() {
    state.currentCatalogId = null;
    state.currentCatalogTitle = null;
    if (typeof updateSaveButtonText === 'function') {
        updateSaveButtonText();
    }
}
