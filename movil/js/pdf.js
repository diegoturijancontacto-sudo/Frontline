// ============================================
// PDF.JS - Generación de PDF
// ============================================

// Inicializar jsPDF correctamente
// La librería se carga desde CDN: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js

// Procesador de imágenes
async function fetchImageAndConvertToBase64(url) {
    if (!url) return null;
    const finalUrl = convertGoogleDriveUrl(url);

    try {
        const response = await fetch(finalUrl);
        if (!response.ok) throw new Error('Status HTTP ' + response.status);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Fallo de descarga por fetch, aplicando cargador nativo:', e);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                try {
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch (err) {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = finalUrl;
        });
    }
}

function convertGoogleDriveUrl(url) {
    if (!url) return null;
    const fileIdMatch = url.match(/[-\w]{25,}/);
    if (fileIdMatch) {
        return `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
    }
    return url;
}

let catalogFontsPromise = null;

async function loadCatalogFonts(doc) {
    if (!catalogFontsPromise) {
        catalogFontsPromise = Promise.all([
            ['Avenir-Roman.ttf', 'Avenir-Roman'],
            ['Avenir-Black.ttf', 'Avenir-Black'],
            ['CormorantGaramond-SemiBold.ttf', 'CormorantGaramond-SemiBold'],
            ['CormorantGaramond-MediumItalic.ttf', 'CormorantGaramond-MediumItalic']
        ].map(async ([fileName, fontFileName]) => {
            const response = await fetch(`./fonts/${fileName}`);
            if (!response.ok) throw new Error(`No se pudo cargar la fuente ${fileName}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            let binary = '';
            bytes.forEach(byte => binary += String.fromCharCode(byte));
            return [fontFileName, btoa(binary)];
        }));
    }

    const fonts = await catalogFontsPromise;
    fonts.forEach(([fontFileName, fontData]) => {
        doc.addFileToVFS(`${fontFileName}.ttf`, fontData);
    });
    doc.addFont('Avenir-Roman.ttf', 'Avenir', 'normal');
    doc.addFont('Avenir-Roman.ttf', 'Avenir', 'bold');
    doc.addFont('Avenir-Black.ttf', 'Avenir Black', 'normal');
    doc.addFont('CormorantGaramond-SemiBold.ttf', 'Cormorant Garamond', 'bold');
    doc.addFont('CormorantGaramond-MediumItalic.ttf', 'Cormorant Garamond', 'italic');
}

function drawTechnicalInfo(doc, info, price, x, y) {
    const normalParts = info.filter(Boolean);
    const normalText = normalParts.join(' | ');
    const priceText = price ? `${normalText ? ' | ' : ''}${price}` : '';

    doc.setFont('Avenir', 'normal');
    doc.setFontSize(8);
    const normalWidth = doc.getTextWidth(normalText);
    doc.setFont('Avenir Black', 'normal');
    const priceWidth = doc.getTextWidth(priceText);
    const totalWidth = normalWidth + priceWidth;
    let cursorX = x - totalWidth;
    if (normalText) {
        doc.setFont('Avenir', 'normal');
        doc.text(normalText, cursorX, y);
        cursorX += normalWidth;
    }
    if (priceText) {
        doc.setFont('Avenir Black', 'normal');
        doc.text(priceText, cursorX, y);
    }
}

// Generar PDF como Blob (para el visor)
async function generatePDFBlob(artworks, cfg) {
    // Verificar que jsPDF está disponible
    const PDFLib = getJSPDF();
    if (!PDFLib) {
        throw new Error('No se pudo cargar la librería jsPDF');
    }

    const doc = new PDFLib('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;

    await loadCatalogFonts(doc);

    let logoData = null;
    let footerLogoData = null;
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

    try {
        const res = await fetch('./logo_pie_de_pagina.jpeg');
        if (res.ok) {
            const blob = await res.blob();
            footerLogoData = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = () => r(reader.result);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn('No se pudo cargar el logo del pie:', e);
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

    // Hojas de obras: una obra por página, siguiendo el formato del catálogo impreso.
    for (let i = 0; i < artworks.length; i++) {
        doc.addPage();
        const art = artworks[i];

        // --- MEDIDAS EXACTAS DEL ESQUEMA ---
        const imageX = 44.7;      // Margen izquierdo
        const imageY = 20.0;      // Borde superior
        const imageMaxW = 120.6;  // Ancho máximo de la imagen
        const imageMaxH = 155.0;  // Alto máximo de la imagen

        if (art.image && art.image.startsWith('data:')) {
            try {
                const img = new Image();
                img.src = art.image;
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

                const imgRatio = img.width / img.height;
                const boxRatio = imageMaxW / imageMaxH;
                const renderW = imgRatio > boxRatio ? imageMaxW : imageMaxH * imgRatio;
                const renderH = imgRatio > boxRatio ? imageMaxW / imgRatio : imageMaxH;
                const offsetX = imageX + (imageMaxW - renderW) / 2;
                const offsetY = imageY + (imageMaxH - renderH) / 2;

                doc.addImage(art.image, undefined, offsetX, offsetY, renderW, renderH, undefined, 'FAST');
            } catch (err) {
                doc.setFillColor(245, 247, 250);
                doc.rect(imageX, imageY, imageMaxW, imageMaxH, 'F');
                doc.setTextColor(150);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text('IMAGEN NO DISPONIBLE', pageWidth / 2, imageY + imageMaxH / 2, { align: 'center' });
            }
        }

        // --- POSICIONES EXACTAS DE TEXTOS ---
        const infoX = pageWidth - 22; // Margen derecho duplicado: 22 mm

        // Título
        const titleLines = doc.splitTextToSize(art.title || 'SIN TÍTULO', 175);
        const titleY = 256.96;

        doc.setTextColor(20, 20, 20);
        doc.setFont('Cormorant Garamond', 'bold');
        doc.setFontSize(14);
        doc.text(titleLines.slice(0, 2), infoX, titleY, { align: 'right' });

        // Subtítulo (Autor)
        const subtitleY = titleY + 4.63;
        if (art.artist) {
            doc.setFont('Cormorant Garamond', 'italic');
            doc.setFontSize(12);
            doc.setTextColor(20, 20, 20);
            doc.text(art.artist.toUpperCase(), infoX, subtitleY, { align: 'right' });
        }

        // Ficha Técnica (Info y Precio)
        const info = [];
        if (cfg.showDims && art.dimensions) info.push(art.dimensions);
        if (cfg.showFicha && art.medium) info.push(art.medium);
        if (cfg.showLocation && art.location) info.push(art.location);
        if (cfg.showProveedor && art.provider) info.push(`PROV: ${art.provider}`);
        if (art.code) info.push(art.code);

        if (info.length || (cfg.showPrices && art.price)) {
            doc.setTextColor(20, 20, 20);
            // El pie queda 7.65 mm debajo de la línea base de los datos.
            drawTechnicalInfo(doc, info, cfg.showPrices ? art.price : '', infoX, 280.45);
        }

        // --- PIE DE PÁGINA EXACTO ---
        const footerY = pageHeight - 12.90;
        const pageNum = i + 1;
        const totalPages = artworks.length;

        const lineX1 = 14;
        const lineX2 = pageWidth - 14;

        doc.setDrawColor(20, 20, 20);
        doc.setLineWidth(0.2);

        const footerLogoSize = pageWidth * 0.05;
        const footerLogoX = lineX1;
        const footerLogoY = footerY - footerLogoSize / 2;
        const footerTextX = footerLogoX + footerLogoSize + 4;

        if (footerLogoData) {
            doc.addImage(footerLogoData, 'JPEG', footerLogoX, footerLogoY, footerLogoSize, footerLogoSize);
        }

        doc.setFont('Cormorant Garamond', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        doc.text(`${cfg.artistName || ''} • ${cfg.updateText || ''} • ${cfg.subtitle || ''}`, footerTextX, footerY + 4);
        doc.text(`Pág ${pageNum} de ${totalPages}`, lineX2, footerY + 4, { align: 'right' });

        // La línea comienza después del logo para no invadirlo.
        doc.line(footerTextX, footerY, lineX2, footerY);
    }

    return doc.output('blob');
}

// Generar PDF completo (para descarga directa)
async function generateCatalogPDF() {
    if (state.selectedIds.size === 0) {
        showToast('Selecciona al menos una obra de la grilla central para el PDF.', 'error');
        return;
    }

    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    loader.classList.remove('hidden');
    state.isLoading = true;

    try {
        const selectedWorks = state.rawObras.filter(o => state.selectedIds.has(o.id));
        const processedArtworks = [];

        for (let i = 0; i < selectedWorks.length; i++) {
            const obra = selectedWorks[i];
            loaderText.innerText = `Preparando imagen ${i + 1} de ${selectedWorks.length}...`;

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
                code: (obra.clave ? obra.clave.replace(/-/g, '') : ('CAT-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase(),
                location: (obra.ubicacion || '').toUpperCase(),
                provider: realProv.toUpperCase()
            });
        }

        loaderText.innerText = 'Sintetizando archivo PDF...';

        const config = {
            artistName: document.getElementById('pdfArtistName').value.trim() || 'CATÁLOGO',
            subtitle: document.getElementById('pdfSubtitle').value.trim() || 'OBRA SELECCIONADA',
            updateText: document.getElementById('pdfUpdateText').value.trim(),
            legalNote: document.getElementById('pdfLegalNote').value.trim(),
            showPrices: document.getElementById('cfgPrices').checked,
            showDims: document.getElementById('cfgDims').checked,
            showLocation: document.getElementById('cfgLocation').checked,
            showProveedor: document.getElementById('cfgProveedor').checked,
            showFicha: document.getElementById('cfgFicha').checked,
            layout: state.currentPageLayout
        };

        // Generar el PDF como blob y descargar
        const pdfBlob = await generatePDFBlob(processedArtworks, config);
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CATALOGO_${config.artistName.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('PDF generado y descargado exitosamente.', 'success');

    } catch (err) {
        console.error('Fallo general creando PDF:', err);
        showToast('Ocurrió un error inesperado al generar el PDF.', 'error');
    } finally {
        loader.classList.add('hidden');
        state.isLoading = false;
    }
}

// ============================================
// EXPORTAR FUNCIONES GLOBALMENTE
// ============================================

// Exportar generatePDFBlob para que esté disponible en pdfViewer.js
window.generatePDFBlob = generatePDFBlob;

// Exportar otras funciones que puedan ser necesarias
window.fetchImageAndConvertToBase64 = fetchImageAndConvertToBase64;
window.getFullLH3ImageUrl = getFullLH3ImageUrl;
window.getJSPDF = getJSPDF;
