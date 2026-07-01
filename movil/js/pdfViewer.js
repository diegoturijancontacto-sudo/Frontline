// ============================================
// PDFVIEWER.JS - Visor de catálogos PDF
// ============================================

// Estado del visor
const viewerState = {
    currentCatalogId: null,
    pdfBlob: null,
    pdfUrl: null,
    catalogs: []
};

// ============================================
// ABRIR VISOR
// ============================================

async function openPDFViewer() {
    const overlay = document.getElementById('pdfViewer');
    overlay.classList.remove('hidden');
    
    // Cargar la lista de catálogos
    await loadCatalogsForViewer();
    
    // Si hay un catálogo activo, seleccionarlo
    if (state.currentCatalogId) {
        selectCatalogForViewer(state.currentCatalogId);
    } else if (viewerState.catalogs.length > 0) {
        // Si no hay catálogo activo, seleccionar el primero
        selectCatalogForViewer(viewerState.catalogs[0].id);
    }
}

// ============================================
// CERRAR VISOR
// ============================================

function closePDFViewer() {
    const overlay = document.getElementById('pdfViewer');
    overlay.classList.add('hidden');
    
    // Limpiar el iframe
    const frame = document.getElementById('pdfViewerFrame');
    frame.innerHTML = `
        <div class="pdf-placeholder">
            <i class="fas fa-file-pdf text-6xl text-slate-300 mb-4"></i>
            <p class="text-slate-500">Selecciona un catálogo de la lista para visualizarlo</p>
            <p class="text-slate-400 text-sm mt-2">o genera uno nuevo desde la sección principal</p>
        </div>
    `;
    
    // Liberar URL del blob
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
        viewerState.catalogs = catalogs;
        
        const listContainer = document.getElementById('pdfCatalogList');
        const countSpan = document.getElementById('pdfCatalogCount');
        
        countSpan.textContent = catalogs.length;
        
        if (catalogs.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center text-slate-400 py-8 px-4">
                    <i class="fas fa-folder-open text-3xl mb-2 opacity-30"></i>
                    <p class="text-sm">No hay catálogos guardados</p>
                    <p class="text-xs mt-1">Crea un catálogo desde la sección principal</p>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = '';
        catalogs.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'pdf-catalog-item';
            if (viewerState.currentCatalogId === cat.id) {
                item.classList.add('active');
            }
            item.dataset.id = cat.id;
            
            item.innerHTML = `
                <span class="pdf-catalog-title">${cat.title}</span>
                <span class="pdf-catalog-date">${cat.date}</span>
                <span class="pdf-catalog-count">${cat.selectedWorksCount} obras</span>
            `;
            
            item.addEventListener('click', () => {
                selectCatalogForViewer(cat.id);
            });
            
            listContainer.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error al cargar catálogos para el visor:', error);
        document.getElementById('pdfCatalogList').innerHTML = `
            <div class="text-center text-red-400 py-8 px-4">
                <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                <p class="text-sm">Error al cargar catálogos</p>
            </div>
        `;
    }
}

// ============================================
// SELECCIONAR CATÁLOGO PARA VISUALIZAR
// ============================================

async function selectCatalogForViewer(catalogId) {
    // Actualizar estado
    viewerState.currentCatalogId = catalogId;
    
    // Actualizar UI
    document.querySelectorAll('.pdf-catalog-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === catalogId);
    });
    
    // Mostrar loading
    const frame = document.getElementById('pdfViewerFrame');
    frame.innerHTML = `
        <div class="pdf-loading">
            <div class="spinner"></div>
            <p>Generando catálogo...</p>
        </div>
    `;
    
    try {
        // Obtener el catálogo
        const response = await fetch(`${API_URL}?action=get&id=${encodeURIComponent(catalogId)}`);
        const result = await response.json();
        
        if (result.status === 'error') {
            throw new Error(result.message);
        }
        
        const catalog = result.data;
        
        // Actualizar título
        document.getElementById('pdfViewerTitle').textContent = `📄 ${catalog.title}`;
        
        // Generar el PDF
        await generateAndDisplayPDF(catalog);
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        frame.innerHTML = `
            <div class="text-center text-red-500 p-8">
                <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
                <p class="font-medium">Error al generar el PDF</p>
                <p class="text-sm text-slate-500 mt-1">${error.message}</p>
            </div>
        `;
    }
}

// ============================================
// GENERAR Y MOSTRAR PDF
// ============================================

async function generateAndDisplayPDF(catalog) {
    // Recuperar las obras seleccionadas
    const selectedWorks = state.rawObras.filter(o => catalog.selectedIds.includes(o.id));
    
    if (selectedWorks.length === 0) {
        const frame = document.getElementById('pdfViewerFrame');
        frame.innerHTML = `
            <div class="text-center text-slate-500 p-8">
                <i class="fas fa-info-circle text-4xl mb-3 opacity-30"></i>
                <p class="font-medium">Este catálogo no tiene obras seleccionadas</p>
                <p class="text-sm mt-1">Edita el catálogo para agregar obras</p>
            </div>
        `;
        return;
    }
    
    // Procesar las obras para el PDF
    const processedArtworks = [];
    
    for (const obra of selectedWorks) {
        let imgBase64 = null;
        if (obra.adjuntos && obra.adjuntos.length > 0) {
            const directUrl = getFullLH3ImageUrl(obra.adjuntos);
            imgBase64 = await fetchImageAndConvertToBase64(directUrl);
        }
        
        const fallbackSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="%23f8fafc"><rect width="100%" height="100%"/><text x="50%" y="50%" font-family="Arial" font-size="20" fill="%23cbd5e1" text-anchor="middle" dominant-baseline="middle">SIN IMAGEN DISPONIBLE</text></svg>';
        
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
    
    // Configuración del PDF
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
    
    // Generar el PDF como blob
    const pdfBlob = await generatePDFBlob(processedArtworks, config);
    
    // Crear URL del blob
    if (viewerState.pdfUrl) {
        URL.revokeObjectURL(viewerState.pdfUrl);
    }
    viewerState.pdfBlob = pdfBlob;
    viewerState.pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Mostrar en el iframe
    const frame = document.getElementById('pdfViewerFrame');
    frame.innerHTML = `
        <iframe src="${viewerState.pdfUrl}" type="application/pdf"></iframe>
    `;
}

// ============================================
// GENERAR PDF COMO BLOB
// ============================================

async function generatePDFBlob(artworks, cfg) {
    // Verificar que jsPDF está disponible
    const PDFLib = getJSPDF();
    if (!PDFLib) {
        throw new Error('No se pudo cargar la librería jsPDF');
    }
    
    const doc = new PDFLib('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;

    let logoData = null;
    try {
        const res = await fetch(LOGO_PATH);
        if (res.ok) {
            const blob = await res.blob();
            logoData = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = () => r(reader.result);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn('No se pudo cargar el logo:', e);
    }

    // Portada
    const titleY = 120;
    if (logoData) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.05 }));
        doc.addImage(logoData, 'PNG', (pageWidth - 85) / 2, titleY - 60, 85, 85);
        doc.restoreGraphicsState();
    }

    doc.setTextColor(20, 20, 20);
    doc.setFont('times', 'normal');
    doc.setFontSize(28);
    doc.text(cfg.artistName.toUpperCase().split('').join(' '), pageWidth / 2, titleY, { align: 'center' });

    doc.setFontSize(10);
    doc.text(cfg.subtitle.toUpperCase().split('').join(' '), pageWidth / 2, titleY + 15, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(cfg.updateText.toUpperCase(), pageWidth / 2, pageHeight - 40, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(110);
    const splitNote = doc.splitTextToSize(cfg.legalNote, 160);
    doc.text(splitNote, pageWidth / 2, pageHeight - 25, { align: 'center' });

    // Hojas de obras
    const obrasPorHoja = cfg.layout || 1;

    for (let i = 0; i < artworks.length; i += obrasPorHoja) {
        doc.addPage();
        const chunk = artworks.slice(i, i + obrasPorHoja);
        const margin = 20;
        
        const cols = obrasPorHoja === 1 ? 1 : (obrasPorHoja === 2 ? 2 : 2);
        const rows = obrasPorHoja === 4 ? 2 : 1;
        
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2 - 30;
        
        const itemWidth = (usableWidth - (cols - 1) * 15) / cols;
        const itemHeight = Math.min((usableHeight - (rows - 1) * 15) / rows, 200);
        
        const imageMaxW = itemWidth - 10;
        const imageMaxH = itemHeight - 45;

        for (let idx = 0; idx < chunk.length; idx++) {
            const art = chunk[idx];
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            
            const x = margin + col * (itemWidth + 15);
            const y = margin + row * (itemHeight + 15);

            if (art.image && art.image.startsWith('data:')) {
                try {
                    const img = new Image();
                    img.src = art.image;
                    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

                    const imgRatio = img.width / img.height;
                    const boxRatio = imageMaxW / imageMaxH;

                    let renderW, renderH;
                    if (imgRatio > boxRatio) {
                        renderW = imageMaxW;
                        renderH = imageMaxW / imgRatio;
                    } else {
                        renderH = imageMaxH;
                        renderW = imageMaxH * imgRatio;
                    }

                    const offsetX = x + (imageMaxW - renderW) / 2;
                    const offsetY = y + (imageMaxH - renderH) / 2;

                    doc.addImage(art.image, undefined, offsetX, offsetY, renderW, renderH, undefined, 'FAST');
                } catch (err) {
                    doc.setFillColor(245, 247, 250);
                    doc.rect(x, y, imageMaxW, imageMaxH, 'F');
                    doc.setTextColor(150);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.text('IMAGEN NO DISPONIBLE', x + imageMaxW/2, y + imageMaxH/2, { align: 'center' });
                }
            }

            const infoY = y + imageMaxH + 3;
            
            doc.setTextColor(20, 20, 20);
            doc.setFont('times', 'bold');
            doc.setFontSize(9);
            const title = art.title.length > 35 ? art.title.substring(0, 32) + '...' : art.title;
            doc.text(title, x + imageMaxW/2, infoY + 4, { align: 'center' });

            if (art.artist) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(110);
                const artist = art.artist.length > 30 ? art.artist.substring(0, 27) + '...' : art.artist;
                doc.text(artist, x + imageMaxW/2, infoY + 11, { align: 'center' });
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(90);
            let info = [];
            if (cfg.showFicha && art.medium) info.push(art.medium);
            if (cfg.showDims && art.dimensions) info.push(art.dimensions);
            if (cfg.showPrices && art.price) info.push(art.price);
            if (cfg.showLocation && art.location) info.push(art.location);
            if (cfg.showProveedor && art.provider) info.push(`PROV: ${art.provider}`);
            if (art.code) info.push(art.code);

            const infoText = info.join(' | ').toUpperCase();
            if (infoText) {
                const splitInfo = doc.splitTextToSize(infoText, imageMaxW - 4);
                const displayInfo = splitInfo.length > 2 ? splitInfo.slice(0, 2) : splitInfo;
                displayInfo.forEach((line, li) => {
                    doc.text(line, x + imageMaxW/2, infoY + 16 + (li * 4), { align: 'center' });
                });
            }
        }

        const pageNum = Math.floor(i / obrasPorHoja) + 1;
        const totalPages = Math.ceil(artworks.length / obrasPorHoja);
        doc.setFontSize(6);
        doc.setTextColor(170);
        doc.setFont('helvetica', 'bold');
        doc.text(`PÁGINA ${pageNum} DE ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // Devolver como blob
    return doc.output('blob');
}

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
        const iframe = document.querySelector('#pdfViewerFrame iframe');
        if (iframe) {
            try {
                iframe.contentWindow.print();
            } catch (e) {
                // Si no se puede imprimir desde el iframe, abrir en nueva ventana
                window.open(viewerState.pdfUrl, '_blank');
            }
        }
    } else {
        showToast('No hay PDF para imprimir.', 'error');
    }
}

// ============================================
// ACTUALIZAR LISTA DEL VISOR
// ============================================

async function refreshViewerList() {
    await loadCatalogsForViewer();
    if (viewerState.currentCatalogId) {
        selectCatalogForViewer(viewerState.currentCatalogId);
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
window.refreshViewerList = refreshViewerList;
window.generatePDFBlob = generatePDFBlob;
