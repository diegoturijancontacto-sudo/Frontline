// ============================================
// PDFVIEWER.JS - Visor de catálogos PDF con pdf.js
// ============================================

// Configurar pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Estado del visor
const viewerState = {
    currentCatalogId: null,
    pdfBlob: null,
    pdfUrl: null,
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    catalogs: [],
    isMobile: window.innerWidth < 640,
    isOpen: false,
    scale: 1
};

// Detectar cambios de tamaño
window.addEventListener('resize', () => {
    viewerState.isMobile = window.innerWidth < 640;
});

// ============================================
// ABRIR VISOR
// ============================================

async function openPDFViewer() {
    const overlay = document.getElementById('pdfViewer');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    viewerState.isOpen = true;
    viewerState.currentPage = 1;

    await loadCatalogsForViewer();

    if (state.currentCatalogId) {
        selectCatalogForViewer(state.currentCatalogId);
    } else if (viewerState.catalogs.length > 0) {
        selectCatalogForViewer(viewerState.catalogs[0].id);
    }
}

// ============================================
// CERRAR VISOR
// ============================================

function closePDFViewer() {
    const overlay = document.getElementById('pdfViewer');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';

    viewerState.isOpen = false;
    viewerState.pdfDoc = null;
    viewerState.currentPage = 1;
    viewerState.totalPages = 0;

    // Limpiar el frame
    const frame = document.getElementById('pdfViewerFrame');
    if (frame) {
        frame.innerHTML = `
            <div class="pdf-placeholder">
                <i class="fas fa-file-pdf text-6xl text-slate-300 mb-4"></i>
                <p class="text-slate-500">Selecciona un catálogo de la lista para visualizarlo</p>
                <p class="text-slate-400 text-sm mt-2">o genera uno nuevo desde la sección principal</p>
            </div>
        `;
    }

    // Actualizar info de página
    document.getElementById('pdfPageInfo').textContent = 'Página 0 de 0';

    if (viewerState.pdfUrl) {
        URL.revokeObjectURL(viewerState.pdfUrl);
        viewerState.pdfUrl = null;
        viewerState.pdfBlob = null;
    }
}

// ============================================
// CARGAR CATÁLOGOS PARA EL VISOR
// ============================================

async function loadCatalogsForViewer() {
    try {
        const catalogs = await getSavedCatalogs();
        viewerState.catalogs = catalogs || [];

        const listContainer = document.getElementById('pdfCatalogList');
        const countSpan = document.getElementById('pdfCatalogCount');

        if (countSpan) {
            countSpan.textContent = viewerState.catalogs.length;
        }

        if (!listContainer) return;

        if (viewerState.catalogs.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center text-slate-400 py-6 px-4">
                    <i class="fas fa-folder-open text-2xl mb-2 opacity-30"></i>
                    <p class="text-xs">No hay catálogos guardados</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';
        viewerState.catalogs.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'pdf-catalog-item';
            if (viewerState.currentCatalogId === cat.id) {
                item.classList.add('active');
            }
            item.dataset.id = cat.id;

            const displayTitle = cat.title.length > 20 ? cat.title.substring(0, 18) + '...' : cat.title;

            item.innerHTML = `
                <div class="pdf-catalog-info">
                    <span class="pdf-catalog-title">${displayTitle}</span>
                    <span class="pdf-catalog-date">${cat.date}</span>
                </div>
                <span class="pdf-catalog-count">${cat.selectedWorksCount}</span>
            `;

            item.addEventListener('click', (e) => {
                e.preventDefault();
                selectCatalogForViewer(cat.id);
            });

            item.addEventListener('touchend', (e) => {
                if (!e.target.closest('.pdf-catalog-item')) return;
                selectCatalogForViewer(cat.id);
            });

            listContainer.appendChild(item);
        });

    } catch (error) {
        console.error('Error al cargar catálogos:', error);
        const listContainer = document.getElementById('pdfCatalogList');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="text-center text-red-400 py-6 px-4">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p class="text-xs">Error al cargar</p>
                    <button onclick="loadCatalogsForViewer()" class="mt-2 px-3 py-1 bg-slate-800 text-white rounded text-xs">
                        <i class="fas fa-sync mr-1"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

// ============================================
// SELECCIONAR CATÁLOGO PARA VISUALIZAR
// ============================================

async function selectCatalogForViewer(catalogId) {
    viewerState.currentCatalogId = catalogId;
    viewerState.currentPage = 1;

    // Actualizar UI
    document.querySelectorAll('.pdf-catalog-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === catalogId);
    });

    // Mostrar loading
    const frame = document.getElementById('pdfViewerFrame');
    if (frame) {
        frame.innerHTML = `
            <div class="pdf-loading">
                <div class="spinner"></div>
                <p>Generando catálogo...</p>
            </div>
        `;
    }

    try {
        const response = await fetch(`${API_URL}?action=get&id=${encodeURIComponent(catalogId)}`);
        const result = await response.json();

        if (result.status === 'error') {
            throw new Error(result.message);
        }

        const catalog = result.data;

        const titleEl = document.getElementById('pdfViewerTitle');
        if (titleEl) {
            const displayTitle = catalog.title.length > 25 ? catalog.title.substring(0, 22) + '...' : catalog.title;
            titleEl.textContent = `📄 ${displayTitle}`;
        }

        await generateAndDisplayPDF(catalog);

    } catch (error) {
        console.error('Error:', error);
        const frame = document.getElementById('pdfViewerFrame');
        if (frame) {
            frame.innerHTML = `
                <div class="text-center text-red-500 p-6">
                    <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
                    <p class="font-medium text-sm">Error al generar el PDF</p>
                    <button onclick="selectCatalogForViewer('${catalogId}')" class="mt-2 px-3 py-1 bg-slate-800 text-white rounded text-xs">
                        <i class="fas fa-sync mr-1"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

// ============================================
// GENERAR Y MOSTRAR PDF CON PDF.JS
// ============================================

async function generateAndDisplayPDF(catalog) {
    const selectedWorks = state.rawObras.filter(o => catalog.selectedIds.includes(o.id));

    if (selectedWorks.length === 0) {
        const frame = document.getElementById('pdfViewerFrame');
        if (frame) {
            frame.innerHTML = `
                <div class="text-center text-slate-500 p-6">
                    <i class="fas fa-info-circle text-3xl mb-2 opacity-30"></i>
                    <p class="font-medium text-sm">Este catálogo no tiene obras</p>
                </div>
            `;
        }
        return;
    }

    // Procesar obras
    const processedArtworks = [];
    const frame = document.getElementById('pdfViewerFrame');

    for (let i = 0; i < selectedWorks.length; i++) {
        const obra = selectedWorks[i];

        if (i % 5 === 0 && frame) {
            frame.innerHTML = `
                <div class="pdf-loading">
                    <div class="spinner"></div>
                    <p>Procesando ${i + 1}/${selectedWorks.length}</p>
                </div>
            `;
        }

        let imgBase64 = null;
        if (obra.adjuntos && obra.adjuntos.length > 0) {
            const directUrl = getFullLH3ImageUrl(obra.adjuntos);
            imgBase64 = await fetchImageAndConvertToBase64(directUrl);
        }

        const fallbackSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="%23f8fafc"><rect width="100%" height="100%"/><text x="50%" y="50%" font-family="Arial" font-size="20" fill="%23cbd5e1" text-anchor="middle" dominant-baseline="middle">SIN IMAGEN</text></svg>';

        const dimParts = [];
        if (obra.ancho) dimParts.push(`${obra.ancho}`);
        if (obra.alto) dimParts.push(`${obra.alto}`);
        if (obra.largo) dimParts.push(`${obra.largo}`);
        const dimStr = dimParts.length > 0 ? `${dimParts.join(' x ')} cm` : '';

        const pVal = parseFloat(obra.precio_lista) || 0;
        const priceStr = pVal > 0 ? `$${pVal.toLocaleString('en-US')} ${obra.tipo_moneda || 'MXN'}` : '';

        const provObj = state.rawComisiones.find(c => c.id?.toString().trim() === (obra.provenance || '').toString().trim());
        const realProv = provObj ? provObj.provenance : (obra.provenance || '');

        processedArtworks.push({
            image: imgBase64 || fallbackSvg,
            title: (obra.nombre_obra || 'SIN TÍTULO').toUpperCase(),
            artist: (obra.autor || '').toUpperCase(),
            medium: (obra.tipo_obra || '').toUpperCase(),
            dimensions: dimStr,
            price: priceStr,
            code: (obra.clave || ('CAT-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase(),
            location: (obra.ubicacion || '').toUpperCase(),
            provider: realProv.toUpperCase()
        });
    }

    const config = {
        artistName: catalog.config?.artistName || catalog.title,
        subtitle: catalog.config?.subtitle || 'OBRA SELECCIONADA',
        updateText: catalog.config?.updateText || 'ACTUALIZACIÓN ' + new Date().getFullYear(),
        legalNote: catalog.config?.legalNote || 'Toda la obra se encuentra disponible a reserva de confirmación de precio y autenticidad.',
        showPrices: catalog.config?.cfgPrices !== undefined ? catalog.config.cfgPrices : true,
        showDims: catalog.config?.cfgDims !== undefined ? catalog.config.cfgDims : true,
        showLocation: catalog.config?.cfgLocation !== undefined ? catalog.config.cfgLocation : true,
        showProveedor: catalog.config?.cfgProveedor || false,
        showFicha: catalog.config?.cfgFicha !== undefined ? catalog.config.cfgFicha : true,
        layout: state.currentPageLayout || 1
    };

    if (frame) {
        frame.innerHTML = `
            <div class="pdf-loading">
                <div class="spinner"></div>
                <p>Generando PDF...</p>
            </div>
        `;
    }

    const pdfBlob = await generatePDFBlob(processedArtworks, config);

    if (viewerState.pdfUrl) {
        URL.revokeObjectURL(viewerState.pdfUrl);
    }
    viewerState.pdfBlob = pdfBlob;
    viewerState.pdfUrl = URL.createObjectURL(pdfBlob);

    // Renderizar con pdf.js
    await renderPDFWithPDFJS(viewerState.pdfUrl);
}

// ============================================
// RENDERIZAR PDF CON PDF.JS
// ============================================

async function renderPDFWithPDFJS(url) {
    const frame = document.getElementById('pdfViewerFrame');

    try {
        // Cargar el PDF
        const loadingTask = pdfjsLib.getDocument(url);
        viewerState.pdfDoc = await loadingTask.promise;
        viewerState.totalPages = viewerState.pdfDoc.numPages;
        viewerState.currentPage = 1;

        // Actualizar info
        document.getElementById('pdfPageInfo').textContent = `Página 1 de ${viewerState.totalPages}`;

        // Renderizar primera página
        await renderPage(1);

    } catch (error) {
        console.error('Error al renderizar PDF:', error);
        if (frame) {
            frame.innerHTML = `
                <div class="text-center text-red-500 p-6">
                    <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
                    <p class="font-medium text-sm">Error al renderizar el PDF</p>
                    <p class="text-xs text-slate-500 mt-1">${error.message}</p>
                </div>
            `;
        }
    }
}

// ============================================
// RENDERIZAR PÁGINA ESPECÍFICA
// ============================================

async function renderPage(pageNum) {
    if (!viewerState.pdfDoc) return;

    const frame = document.getElementById('pdfViewerFrame');
    if (!frame) return;

    try {
        const page = await viewerState.pdfDoc.getPage(pageNum);

        // Calcular escala para que quepa en la pantalla
        const containerWidth = frame.clientWidth - 16;
        const containerHeight = frame.clientHeight - 16;

        const viewport = page.getViewport({ scale: 1 });
        const scaleX = containerWidth / viewport.width;
        const scaleY = containerHeight / viewport.height;
        const scale = Math.min(scaleX, scaleY, 1.5);

        const scaledViewport = page.getViewport({ scale });

        // Crear canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        // Renderizar
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };

        await page.render(renderContext).promise;

        // Limpiar y mostrar el canvas
        frame.innerHTML = '';
        frame.appendChild(canvas);

        // Aplicar estilos al canvas para que se vea bien en móvil
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.borderRadius = '4px';
        canvas.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';

        // Actualizar controles
        document.getElementById('pdfPageInfo').textContent = `Página ${pageNum} de ${viewerState.totalPages}`;
        document.querySelector('.pdf-nav-btn:first-child').disabled = pageNum <= 1;
        document.querySelector('.pdf-nav-btn:last-child').disabled = pageNum >= viewerState.totalPages;

    } catch (error) {
        console.error('Error al renderizar página:', error);
        frame.innerHTML = `
            <div class="text-center text-red-500 p-4">
                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                <p class="text-sm">Error al renderizar página ${pageNum}</p>
            </div>
        `;
    }
}

// ============================================
// NAVEGACIÓN DE PÁGINAS
// ============================================

function pdfViewerPrevPage() {
    if (viewerState.currentPage > 1) {
        viewerState.currentPage--;
        renderPage(viewerState.currentPage);
    }
}

function pdfViewerNextPage() {
    if (viewerState.currentPage < viewerState.totalPages) {
        viewerState.currentPage++;
        renderPage(viewerState.currentPage);
    }
}

// Exponer funciones de navegación globalmente
window.pdfViewerPrevPage = pdfViewerPrevPage;
window.pdfViewerNextPage = pdfViewerNextPage;

// ============================================
// DESCARGAR PDF ACTUAL
// ============================================

function downloadCurrentPDF() {
    if (viewerState.pdfBlob) {
        const catalog = viewerState.catalogs.find(c => c.id === viewerState.currentCatalogId);
        const fileName = catalog ? `CATALOGO_${catalog.title.replace(/\s+/g, '_')}.pdf` : 'catalogo.pdf';

        const link = document.createElement('a');
        link.href = viewerState.pdfUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('PDF descargado exitosamente.', 'success');
    } else {
        showToast('No hay PDF para descargar.', 'error');
    }
}

// ============================================
// IMPRIMIR PDF ACTUAL
// ============================================

function printCurrentPDF() {
    if (viewerState.pdfUrl) {
        const win = window.open(viewerState.pdfUrl, '_blank');
        if (win) {
            win.onload = function () {
                setTimeout(() => {
                    win.print();
                }, 500);
            };
        } else {
            showToast('Abre el PDF en una nueva ventana para imprimir.', 'info');
        }
    } else {
        showToast('No hay PDF para imprimir.', 'error');
    }
}

// ============================================
// EXPORTAR FUNCIONES GLOBALMENTE
// ============================================

window.openPDFViewer = openPDFViewer;
window.closePDFViewer = closePDFViewer;
window.loadCatalogsForViewer = loadCatalogsForViewer;
window.selectCatalogForViewer = selectCatalogForViewer;
window.downloadCurrentPDF = downloadCurrentPDF;
window.printCurrentPDF = printCurrentPDF;
window.pdfViewerPrevPage = pdfViewerPrevPage;
window.pdfViewerNextPage = pdfViewerNextPage;
