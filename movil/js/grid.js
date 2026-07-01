// ============================================
// GRID.JS - Renderizado de grid y selección
// ============================================

// Renderizar grid de obras
function renderGrid(obras) {
    const gridContainer = document.getElementById('gridContainer');
    const emptyState = document.getElementById('emptyState');
    const resultsCount = document.getElementById('resultsCount');
    
    gridContainer.innerHTML = '';
    resultsCount.innerText = `${obras.length} obras`;
    const emptyStateIcon = document.getElementById('emptyStateIcon');
    const emptyStateTitle = document.getElementById('emptyStateTitle');
    const emptyStateDesc = document.getElementById('emptyStateDesc');

    if (obras.length === 0) {
        gridContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');

        if (!state.hasAppliedInitialFilters) {
            emptyStateIcon.className = 'fas fa-filter text-5xl mb-3 opacity-20';
            emptyStateTitle.innerText = 'Configura tu búsqueda inicial';
            emptyStateDesc.innerText = 'Selecciona tus filtros en el panel y haz clic en APLICAR para ver el inventario.';
        } else {
            emptyStateIcon.className = 'fas fa-image text-5xl mb-3 opacity-20';
            emptyStateTitle.innerText = 'No se encontraron resultados';
            emptyStateDesc.innerText = 'Prueba desactivando o modificando los filtros de búsqueda.';
        }
        return;
    }

    gridContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const isList = state.currentViewMode === 'list';
    if (isList) {
        gridContainer.classList.add('list-view');
    } else {
        gridContainer.classList.remove('list-view');
    }

    obras.forEach(obra => {
        const isSelected = state.selectedIds.has(obra.id);
        const imageUrl = getLH3ImageUrl(obra.adjuntos);
        const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='%23f1f5f9'><rect width='100%' height='100%'/><path d='M140 250 L200 170 L260 250' stroke='%23cbd5e1' stroke-width='2' fill='none'/><circle cx='240' cy='145' r='12' fill='%23cbd5e1'/></svg>`;

        const dimParts = [];
        if (obra.ancho) dimParts.push(`${obra.ancho}`);
        if (obra.alto) dimParts.push(`${obra.alto}`);
        if (obra.largo) dimParts.push(`${obra.largo}`);
        const dimStr = dimParts.length > 0 ? `${dimParts.join(' x ')} cm` : 'S/M';

        const precio = parseFloat(obra.precio_lista) || 0;
        const precioFormatted = precio > 0 ? `$${precio.toLocaleString('en-US')} ${obra.tipo_moneda || 'MXN'}` : 'A consultar';

        const card = document.createElement('div');
        card.id = `card-${obra.id}`;
        card.className = `grid-card ${isList ? 'list-view' : ''} ${isSelected ? 'selected' : ''}`;

        if (isList) {
            card.innerHTML = `
                <div class="relative bg-slate-50 w-36 sm:w-44 h-full flex items-center justify-center overflow-hidden cursor-pointer shrink-0" onclick="toggleCardSelection('${obra.id}')">
                    <img src="${imageUrl || fallbackSvg}" onerror="this.src='${fallbackSvg}'" class="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" alt="${obra.nombre_obra}">
                    <div class="absolute top-2 left-2" onclick="event.stopPropagation()">
                        <input type="checkbox" id="chk-${obra.id}" class="img-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCheckboxSelection('${obra.id}')">
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1 gap-2">
                        <h3 class="font-bold text-slate-800 text-sm sm:text-base truncate uppercase tracking-tight" title="${obra.nombre_obra}">${obra.nombre_obra || 'Sin Título'}</h3>
                        <p class="font-bold text-slate-900 text-sm whitespace-nowrap">${precioFormatted}</p>
                    </div>
                    <p class="text-xs sm:text-sm text-slate-500 mb-2 truncate">${obra.autor || 'Artista Desconocido'}</p>
                    
                    <div class="text-[11px] sm:text-xs text-slate-600 space-y-1 mb-2 flex-1">
                        <p class="truncate"><span class="font-medium text-slate-400">Técnica:</span> ${obra.tipo_obra || 'Óleo'}</p>
                        <p class="truncate"><span class="font-medium text-slate-400">Medidas:</span> ${dimStr}</p>
                    </div>

                    <div class="flex justify-between items-end border-t border-slate-100 pt-2 mt-auto">
                        <p class="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider">${obra.ubicacion || 'México'}</p>
                        <button class="text-slate-300 hover:text-slate-800 transition-colors"><i class="far fa-bookmark text-sm"></i></button>
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="relative bg-slate-50 aspect-square flex items-center justify-center overflow-hidden cursor-pointer" onclick="toggleCardSelection('${obra.id}')">
                    <img src="${imageUrl || fallbackSvg}" onerror="this.src='${fallbackSvg}'" class="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" alt="${obra.nombre_obra}">
                    <div class="absolute top-3 left-3" onclick="event.stopPropagation()">
                        <input type="checkbox" id="chk-${obra.id}" class="img-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCheckboxSelection('${obra.id}')">
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-1">
                    <h3 class="font-bold text-slate-800 text-sm mb-0.5 truncate uppercase tracking-tight">${obra.nombre_obra || 'Sin Título'}</h3>
                    <p class="text-xs text-slate-500 mb-2 truncate">${obra.autor || 'Artista Desconocido'}</p>
                    
                    <div class="text-[11px] text-slate-600 space-y-1 mb-3 flex-1">
                        <p class="truncate"><span class="font-medium text-slate-400">Técnica:</span> ${obra.tipo_obra || 'Óleo'}</p>
                        <p class="truncate"><span class="font-medium text-slate-400">Medidas:</span> ${dimStr}</p>
                    </div>

                    <div class="flex justify-between items-end border-t border-slate-100 pt-3 mt-auto">
                        <div>
                            <p class="font-bold text-slate-900 text-sm leading-none">${precioFormatted}</p>
                            <p class="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">${obra.ubicacion || 'México'}</p>
                        </div>
                        <button class="text-slate-300 hover:text-slate-800 transition-colors"><i class="far fa-bookmark text-sm"></i></button>
                    </div>
                </div>
            `;
        }
        gridContainer.appendChild(card);
    });
}

// Toggle selección de obra
function toggleCardSelection(id) {
    const cb = document.getElementById(`chk-${id}`);
    if (cb) {
        cb.checked = !cb.checked;
        toggleCheckboxSelection(id);
    }
}

function toggleCheckboxSelection(id) {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
    } else {
        state.selectedIds.add(id);
    }
    
    const cardElement = document.getElementById(`card-${id}`);
    const checkboxElement = document.getElementById(`chk-${id}`);
    const isNowSelected = state.selectedIds.has(id);

    if (cardElement) {
        if (isNowSelected) {
            cardElement.classList.add('selected');
        } else {
            cardElement.classList.remove('selected');
        }
    }

    if (checkboxElement) {
        checkboxElement.checked = isNowSelected;
    }

    updateSidebarSummary();
}

// Seleccionar/Deseleccionar todo
function selectAllWorks() {
    state.filteredObras.forEach(obra => state.selectedIds.add(obra.id));
    renderGrid(state.filteredObras);
    updateSidebarSummary();
    showToast(`Se seleccionaron ${state.filteredObras.length} obras.`, 'success');
}

function deselectAllWorks() {
    state.filteredObras.forEach(obra => state.selectedIds.delete(obra.id));
    renderGrid(state.filteredObras);
    updateSidebarSummary();
    showToast('Se deseleccionaron todas las obras.', 'info');
}

function clearSelection() {
    state.selectedIds.clear();
    updateSidebarSummary();
    sortData(); 
}

function updateSidebarSummary() {
    const total = state.selectedIds.size;
    document.getElementById('selectedCountText').innerText = `${total} obra${total !== 1 ? 's' : ''} seleccionada${total !== 1 ? 's' : ''}`;

    const mobileBadge = document.getElementById('mobileSelectedBadge');
    if(total > 0) {
        mobileBadge.innerText = total;
        mobileBadge.classList.remove('hidden');
    } else {
        mobileBadge.classList.add('hidden');
    }

    let totalEstimado = 0;
    state.rawObras.forEach(o => {
        if (state.selectedIds.has(o.id)) {
            totalEstimado += parseFloat(o.precio_lista) || 0;
        }
    });

    document.getElementById('totalValueText').innerText = `$${totalEstimado.toLocaleString('en-US')} MXN`;
}

function sortData() {
    const val = document.getElementById('orderBySelect').value;
    if (val === 'priceDesc') {
        state.filteredObras.sort((a, b) => (parseFloat(b.precio_lista) || 0) - (parseFloat(a.precio_lista) || 0));
    } else if (val === 'priceAsc') {
        state.filteredObras.sort((a, b) => (parseFloat(a.precio_lista) || 0) - (parseFloat(b.precio_lista) || 0));
    } else {
        state.filteredObras.sort((a, b) => a.id.toString().localeCompare(b.id.toString()));
    }
    renderGrid(state.filteredObras);
}

function setViewMode(mode) {
    state.currentViewMode = mode;
    const btnGrid = document.getElementById('btnGridView');
    const btnList = document.getElementById('btnListView');

    if (mode === 'grid') {
        btnGrid.classList.add('active');
        btnList.classList.remove('active');
    } else {
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
    }
    
    renderGrid(state.filteredObras);
}

function setPageLayout(layout) {
    state.currentPageLayout = layout;
    document.querySelectorAll('.page-layout-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.layout) === layout);
    });
    showToast(`Diseño cambiado a ${layout} obra(s) por página.`, 'info');
}

function syncConfigs() {
    const ids = ['cfgPrices', 'cfgDims', 'cfgLocation', 'cfgProveedor', 'cfgFicha'];
    ids.forEach(id => {
        const el1 = document.getElementById(id);
        const el2 = document.getElementById(id + 'Panel');
        if (el1 && el2) {
            el2.checked = el1.checked;
        }
    });
}
