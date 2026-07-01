// ============================================
// PDF.JS - Generación de PDF
// ============================================

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
            img.onload = function() {
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

// Generar PDF
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
                code: (obra.clave || ('CAT-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase(),
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

        await buildAndSavePDF(processedArtworks, config);

    } catch (err) {
        console.error('Fallo general creando PDF:', err);
        showToast('Ocurrió un error inesperado al generar el PDF.', 'error');
    } finally {
        loader.classList.add('hidden');
        state.isLoading = false;
    }
}

async function buildAndSavePDF(artworks, cfg) {
    const doc = new jsPDF('p', 'mm', 'a4');
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
    } catch (e) {}

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

            // Imagen
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
            
            // Título
            doc.setTextColor(20, 20, 20);
            doc.setFont('times', 'bold');
            doc.setFontSize(9);
            const title = art.title.length > 35 ? art.title.substring(0, 32) + '...' : art.title;
            doc.text(title, x + imageMaxW/2, infoY + 4, { align: 'center' });

            // Artista
            if (art.artist) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(110);
                const artist = art.artist.length > 30 ? art.artist.substring(0, 27) + '...' : art.artist;
                doc.text(artist, x + imageMaxW/2, infoY + 11, { align: 'center' });
            }

            // Info
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
            const splitInfo = doc.splitTextToSize(infoText, imageMaxW - 4);
            const displayInfo = splitInfo.length > 2 ? splitInfo.slice(0, 2) : splitInfo;
            displayInfo.forEach((line, li) => {
                doc.text(line, x + imageMaxW/2, infoY + 16 + (li * 4), { align: 'center' });
            });
        }

        // Número de página
        const pageNum = Math.floor(i / obrasPorHoja) + 1;
        const totalPages = Math.ceil(artworks.length / obrasPorHoja);
        doc.setFontSize(6);
        doc.setTextColor(170);
        doc.setFont('helvetica', 'bold');
        doc.text(`PÁGINA ${pageNum} DE ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`CATALOGO_${cfg.artistName.replace(/\s+/g, '_')}.pdf`);
}
