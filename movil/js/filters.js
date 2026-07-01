// ============================================
// FILTERS.JS - Lógica de filtros
// ============================================

// Construir filtros dinámicos
function buildDynamicFilters() {
    const autorCounts = {};
    let maxPrecioGlobal = 0; 

    state.rawObras.forEach(o => {
        const autor = (o.autor || 'Desconocido').trim();
        autorCounts[autor] = (autorCounts[autor] || 0) + 1;
        
        const p = parseFloat(o.precio_lista) || 0;
        if(p > maxPrecioGlobal) maxPrecioGlobal = p;
    });
    const sortedAutores = Object.entries(autorCounts).sort((a, b) => b[1] - a[1]);
    
    const filterAutor = document.getElementById('filterAutor');
    filterAutor.innerHTML = '<option value="">Todos los autores</option>';
    sortedAutores.forEach(([autor, count]) => {
        filterAutor.innerHTML += `<option value="${autor}">${autor} (${count})</option>`;
    });

    const tecnicas = [...new Set(state.rawObras.map(o => (o.tipo_obra || 'Técnica mixta').trim()))].filter(Boolean).sort();
    const filterTecnica = document.getElementById('filterTecnica');
    filterTecnica.innerHTML = '<option value="">Seleccionar técnica</option>' + 
        tecnicas.map(t => `<option value="${t}">${t}</option>`).join('');

    const filterProveedor = document.getElementById('filterProveedor');
    const proveedoresMap = {};
    state.rawComisiones.forEach(c => {
        if (c.id && c.provenance) {
            proveedoresMap[c.id] = c.provenance;
        }
    });

    const proveedoresIdsUsados = [...new Set(state.rawObras.map(o => (o.provenance || '').toString().trim()))].filter(Boolean);
    filterProveedor.innerHTML = '<option value="">Seleccionar proveedor</option>';
    proveedoresIdsUsados.forEach(id => {
        const textLabel = proveedoresMap[id] || id; 
        filterProveedor.innerHTML += `<option value="${id}">${textLabel}</option>`;
    });

    const ubicaciones = [...new Set(state.rawObras.map(o => (o.ubicacion || 'México').trim()))].filter(Boolean).sort();
    const filterUbicacion = document.getElementById('filterUbicacion');
    filterUbicacion.innerHTML = '<option value="">Seleccionar ubicación</option>' + 
        ubicaciones.map(u => `<option value="${u}">${u}</option>`).join('');

    const estatusDisponibles = [...new Set(state.rawObras.map(o => (o.estatus || 'Bodega').trim()))].filter(Boolean).sort();
    const filterDisponibilidad = document.getElementById('filterDisponibilidad');
    filterDisponibilidad.innerHTML = '';
    estatusDisponibles.forEach(est => {
        filterDisponibilidad.innerHTML += `
            <label class="flex items-center gap-2 cursor-pointer text-sm text-slate-700 hover:text-slate-900">
                <input type="checkbox" value="${est}" class="dispo-checkbox w-4 h-4 text-slate-800 border-gray-300 rounded focus:ring-slate-800">
                <span>${est}</span>
            </label>
        `;
    });

    maxPrecioGlobal = Math.ceil(maxPrecioGlobal / 10000) * 10000 || 1000000;
    const priceRange = document.getElementById('filterPriceRange');
    priceRange.max = maxPrecioGlobal;
    priceRange.value = maxPrecioGlobal;
    updatePriceLabel();
}

function updatePriceLabel() {
    const val = document.getElementById('filterPriceRange').value;
    const max = document.getElementById('filterPriceRange').max;
    const label = document.getElementById('priceLabel');
    if (val == max) {
        label.innerText = 'Cualquier Precio';
        label.classList.remove('bg-blue-100', 'text-blue-700');
        label.classList.add('bg-slate-100', 'text-slate-700');
    } else {
        label.innerText = `Hasta $${parseInt(val).toLocaleString('en-US')} MXN`;
        label.classList.remove('bg-slate-100', 'text-slate-700');
        label.classList.add('bg-blue-100', 'text-blue-700');
    }
}

function applyFilters() {
    state.hasAppliedInitialFilters = true;
    const globalSearch = document.getElementById('globalSearch').value.toLowerCase().trim();
    const selectAutor = document.getElementById('filterAutor').value;
    const selectTecnica = document.getElementById('filterTecnica').value;
    const selectProveedor = document.getElementById('filterProveedor').value;
    const selectUbicacion = document.getElementById('filterUbicacion').value;
    const selectCategoria = document.getElementById('filterCategoria').value;
    const checkCertificado = document.getElementById('filterCertificado').checked;
    const selectSize = document.getElementById('filterSize').value;
    
    const maxPriceLimit = parseFloat(document.getElementById('filterPriceRange').value) || Infinity;
    const isSliderActive = maxPriceLimit < parseFloat(document.getElementById('filterPriceRange').max);

    const checkedDispos = Array.from(document.querySelectorAll('.dispo-checkbox:checked')).map(cb => cb.value);

    state.filteredObras = state.rawObras.filter(o => {
        const oNombre = (o.nombre_obra || '').toLowerCase();
        const oAutor = (o.autor || '').toLowerCase();
        const oTecnica = (o.tipo_obra || '').toLowerCase();
        const oClave = (o.clave || '').toLowerCase();
        const oUbicacion = o.ubicacion || '';
        const oEstatus = o.estatus || '';
        const oProv = o.provenance || '';
        
        const oTagsLower = Array.isArray(o.tags) ? o.tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : '') : [];
        const oPrecio = parseFloat(o.precio_lista) || 0;

        if (globalSearch) {
            const matchesGlobal = oNombre.includes(globalSearch) || 
                                  oAutor.includes(globalSearch) || 
                                  oTecnica.includes(globalSearch) || 
                                  oClave.includes(globalSearch);
            if (!matchesGlobal) return false;
        }

        if (selectAutor && o.autor !== selectAutor) return false;
        if (checkedDispos.length > 0 && !checkedDispos.includes(oEstatus)) return false;
        if (selectTecnica && o.tipo_obra !== selectTecnica) return false;
        if (selectProveedor && oProv.toString().trim() !== selectProveedor.toString().trim()) return false;
        if (selectUbicacion && oUbicacion !== selectUbicacion) return false;
        
        if (isSliderActive && oPrecio > maxPriceLimit) return false;

        if (selectSize) {
            const dimensionPrimaria = parseFloat(o.largo) || parseFloat(o.ancho) || 0;
            const dimensionSecundaria = parseFloat(o.alto) || 0;
            const sizeAvg = (dimensionPrimaria + dimensionSecundaria) / 2;

            if (selectSize === 'P' && sizeAvg >= 50) return false;
            if (selectSize === 'M' && (sizeAvg < 50 || sizeAvg >= 100)) return false;
            if (selectSize === 'G' && (sizeAvg < 100 || sizeAvg >= 200)) return false;
            if (selectSize === 'X' && sizeAvg < 200) return false;
        }

        if (selectCategoria && !oTagsLower.includes(selectCategoria.toLowerCase())) return false;
        if (checkCertificado && !oTagsLower.includes('#certificado')) return false;

        return true;
    });

    sortData();
}

function clearFilters() {
    document.getElementById('globalSearch').value = '';
    document.getElementById('filterCategoria').value = '';
    document.getElementById('filterTecnica').value = '';
    document.getElementById('filterProveedor').value = '';
    document.getElementById('filterUbicacion').value = '';
    document.getElementById('filterAutor').value = '';
    document.getElementById('filterCertificado').checked = false;
    document.getElementById('filterSize').value = '';

    const priceRange = document.getElementById('filterPriceRange');
    priceRange.value = priceRange.max;
    updatePriceLabel();

    document.querySelectorAll('.dispo-checkbox').forEach(cb => cb.checked = false);

    state.hasAppliedInitialFilters = false; 
    state.filteredObras = [];
    renderGrid(state.filteredObras);
}
