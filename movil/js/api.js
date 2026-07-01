// ============================================
// API.JS - Comunicación con el backend
// ============================================

// ============================================
// CATÁLOGOS API
// ============================================

// Obtener todos los catálogos del backend
async function getSavedCatalogs() {
    try {
        const response = await fetch(`${API_URL}?action=list`);
        const result = await response.json();
        
        if (result.status === 'success') {
            return result.data || [];
        } else {
            console.error('Error al obtener catálogos:', result.message);
            return [];
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        showToast('Error al conectar con el servidor', 'error');
        return [];
    }
}

// Guardar catálogo en el backend
async function saveCatalogToLocal() {
    if (state.selectedIds.size === 0) {
        showToast('Selecciona al menos una obra antes de guardar el catálogo.', 'error');
        return;
    }

    const name = document.getElementById('pdfArtistName').value.trim() || 'Catálogo sin título';

    const config = {
        artistName: name,
        subtitle: document.getElementById('pdfSubtitle').value.trim(),
        updateText: document.getElementById('pdfUpdateText').value.trim(),
        legalNote: document.getElementById('pdfLegalNote').value.trim(),
        cfgPrices: document.getElementById('cfgPrices').checked,
        cfgDims: document.getElementById('cfgDims').checked,
        cfgLocation: document.getElementById('cfgLocation').checked,
        cfgProveedor: document.getElementById('cfgProveedor').checked,
        cfgFicha: document.getElementById('cfgFicha').checked,
        cfgBiography: document.getElementById('cfgBiography')?.checked || false
    };

    const catalogData = {
        id: 'cat_' + Date.now(),
        title: name,
        selectedWorksCount: state.selectedIds.size,
        selectedIds: Array.from(state.selectedIds),
        config: config
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'save',
                ...catalogData
            })
        });

        showToast(`Catálogo "${name}" guardado exitosamente en la nube.`, 'success');
        await loadLocalCatalogs();
        updateSidebarSummary();
    } catch (error) {
        console.error('Error al guardar:', error);
        showToast('Error al guardar el catálogo', 'error');
    }
}

// Eliminar catálogo del backend
async function deleteCatalog(id) {
    if (!confirm('¿Estás seguro de eliminar este catálogo?')) return;

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete',
                id: id
            })
        });

        showToast('Catálogo eliminado exitosamente.', 'success');
        await loadLocalCatalogs();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast('Error al eliminar el catálogo', 'error');
    }
}

// Cargar un catálogo específico
async function loadSavedCatalog(id) {
    try {
        const response = await fetch(`${API_URL}?action=get&id=${encodeURIComponent(id)}`);
        const result = await response.json();
        
        if (result.status === 'error') {
            showToast(result.message, 'error');
            return;
        }

        const catalog = result.data;
        if (!catalog) {
            showToast('No se pudo encontrar el catálogo seleccionado.', 'error');
            return;
        }

        state.selectedIds = new Set(catalog.selectedIds || []);

        if (catalog.config) {
            document.getElementById('pdfArtistName').value = catalog.config.artistName || '';
            document.getElementById('pdfSubtitle').value = catalog.config.subtitle || '';
            document.getElementById('pdfUpdateText').value = catalog.config.updateText || '';
            document.getElementById('pdfLegalNote').value = catalog.config.legalNote || '';
            
            document.getElementById('cfgPrices').checked = catalog.config.cfgPrices !== undefined ? catalog.config.cfgPrices : true;
            document.getElementById('cfgDims').checked = catalog.config.cfgDims !== undefined ? catalog.config.cfgDims : true;
            document.getElementById('cfgLocation').checked = catalog.config.cfgLocation !== undefined ? catalog.config.cfgLocation : true;
            document.getElementById('cfgProveedor').checked = catalog.config.cfgProveedor || false;
            document.getElementById('cfgFicha').checked = catalog.config.cfgFicha !== undefined ? catalog.config.cfgFicha : true;
            
            syncConfigs();
        }

        updateSidebarSummary();
        state.hasAppliedInitialFilters = true;
        
        // Mostrar resultados
        document.getElementById('homeScreen').style.display = 'none';
        document.getElementById('homeScreen').classList.add('hidden');
        document.getElementById('resultsPanel').classList.remove('hidden');
        document.getElementById('searchContainer').classList.remove('hidden');
        document.getElementById('pageTitle').textContent = catalog.title || 'Resultados';
        document.getElementById('btnConfigCatalogo').classList.remove('hidden');
        
        state.filteredObras = state.rawObras;
        sortData();
        showToast(`Catálogo "${catalog.title}" cargado correctamente.`, 'success');
        
        // Abrir filtros si no hay obras seleccionadas
        if (state.selectedIds.size === 0) {
            openFilters();
        }
    } catch (error) {
        console.error('Error al cargar catálogo:', error);
        showToast('Error al cargar el catálogo', 'error');
    }
}

// Renombrar catálogo en el backend
async function renameCatalog(id, newName) {
    const trimmed = newName.trim();
    if (!trimmed) {
        showToast('El nombre no puede estar vacío.', 'error');
        loadLocalCatalogs();
        return;
    }

    try {
        // Primero obtenemos el catálogo actual
        const response = await fetch(`${API_URL}?action=get&id=${encodeURIComponent(id)}`);
        const result = await response.json();
        
        if (result.status === 'error') {
            showToast(result.message, 'error');
            loadLocalCatalogs();
            return;
        }

        const catalog = result.data;
        catalog.title = trimmed;
        
        // Guardamos con el nuevo nombre
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'save',
                ...catalog
            })
        });

        showToast(`Catálogo renombrado a "${trimmed}".`, 'success');
        loadLocalCatalogs();
    } catch (error) {
        console.error('Error al renombrar:', error);
        showToast('Error al renombrar el catálogo', 'error');
        loadLocalCatalogs();
    }
}

// Sincronizar catálogos
async function syncCatalogs() {
    showToast('Sincronizando catálogos...', 'info');
    await loadLocalCatalogs();
    showToast('Catálogos sincronizados correctamente.', 'success');
}

// ============================================
// OBRAS API
// ============================================

// Cargar obras desde la base de datos
async function fetchSheetsDatabase() {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    loaderText.innerText = 'Cargando base de datos de RTBROK...';
    loader.classList.remove('hidden');
    state.isLoading = true;

    try {
        const response = await fetch(DB_URL);
        const data = await response.json();
        
        if (data.registrosObra && Array.isArray(data.registrosObra)) {
            state.rawObras = data.registrosObra.map((obra, idx) => ({
                ...obra,
                id: obra.id || `obra_fallback_${idx}_${Date.now()}`
            }));
            state.rawComisiones = data.comisiones || [];
            
            state.filteredObras = [];
            buildDynamicFilters();
            renderGrid(state.filteredObras);
        } else {
            throw new Error('No se pudo obtener la lista de obras.');
        }
    } catch (err) {
        console.error('Error al cargar la DB:', err);
        showToast('Ocurrió un problema al sincronizar la base de datos.', 'error');
    } finally {
        loader.classList.add('hidden');
        state.isLoading = false;
    }
}

// ============================================
// UTILIDADES DE IMAGEN
// ============================================

function getLH3ImageUrl(adjuntosArray) {
    if (!adjuntosArray || adjuntosArray.length === 0) return null;
    const adjunto = adjuntosArray[0];
    const url = typeof adjunto === 'string' ? adjunto : (adjunto.url || '');
    if (!url) return null;

    const fileIdMatch = url.match(/[-\w]{25,}/);
    if (fileIdMatch) {
        return `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}=s400`;
    }
    return url;
}

function getFullLH3ImageUrl(adjuntosArray) {
    if (!adjuntosArray || adjuntosArray.length === 0) return null;
    const adjunto = adjuntosArray[0];
    const url = typeof adjunto === 'string' ? adjunto : (adjunto.url || '');
    if (!url) return null;

    const fileIdMatch = url.match(/[-\w]{25,}/);
    if (fileIdMatch) {
        return `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
    }
    return url;
}

// ============================================
// EXPORTAR E IMPORTAR CATÁLOGOS
// ============================================

async function exportAllCatalogs() {
    try {
        const catalogs = await getSavedCatalogs();
        const dataStr = JSON.stringify(catalogs, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `catalogos_rtbrok_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Catálogos exportados correctamente.', 'success');
    } catch (error) {
        console.error('Error al exportar:', error);
        showToast('Error al exportar los catálogos', 'error');
    }
}

async function importCatalog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            const text = await file.text();
            const catalogs = JSON.parse(text);
            
            if (!Array.isArray(catalogs)) {
                showToast('El archivo no contiene una lista válida de catálogos.', 'error');
                return;
            }

            let imported = 0;
            for (const catalog of catalogs) {
                if (!catalog.id) {
                    catalog.id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }
                
                await fetch(API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'save',
                        ...catalog
                    })
                });
                imported++;
            }
            
            showToast(`${imported} catálogo(s) importado(s) correctamente.`, 'success');
            loadLocalCatalogs();
        } catch (error) {
            console.error('Error al importar:', error);
            showToast('Error al importar los catálogos', 'error');
        }
    };
    input.click();
}
