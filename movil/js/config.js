// ============================================
// CONFIG.JS - Configuración de la aplicación
// ============================================

// URL del backend (AppScript)
const API_URL = 'https://script.google.com/macros/s/AKfycbx1wIgADNvhYVbo9nNduz-jtz9s1pkvsZGXL3r6rmfjcWK0NWLFLHuw9zE5B21PF2OXow/exec';

// URL de la base de datos de obras
const DB_URL = 'https://script.google.com/macros/s/AKfycbxyBzZ7duM3pKtobXHj8A2NgFpIarP5WPS71TKTH2uFMOXXL8rzo68-blixF8kgCwvl8w/exec';

// Logo path
const LOGO_PATH = './rtbrok_logo.png';

// Texto de disponibilidad
const AVAILABILITY_TEXT = 'TODA LA OBRA SE ENCUENTRA DISPONIBLE A RESERVA DE CONFIRMACIÓN';

// Configuraciones por defecto
const DEFAULT_CONFIG = {
    artistName: 'CATÁLOGO GENERAL',
    subtitle: 'OBRA SELECCIONADA',
    updateText: 'ACTUALIZACIÓN 2026',
    legalNote: 'Toda la obra se encuentra disponible a reserva de confirmación de precio y autenticidad.',
    cfgPrices: true,
    cfgDims: true,
    cfgLocation: true,
    cfgProveedor: false,
    cfgFicha: true,
    cfgBiography: false
};

// Estado global
const state = {
    rawObras: [],
    rawComisiones: [],
    filteredObras: [],
    selectedIds: new Set(),
    hasAppliedInitialFilters: false,
    currentViewMode: 'grid',
    currentPageLayout: 1,
    isLoading: false,
    // NUEVO: ID del catálogo actual que está siendo editado
    currentCatalogId: null,
    // NUEVO: Título original del catálogo (para saber si cambió)
    currentCatalogTitle: null
};

// Referencia a jsPDF
let jsPDFLib = null;

function getJSPDF() {
    if (jsPDFLib) return jsPDFLib;
    
    if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
        jsPDFLib = window.jspdf.jsPDF;
        return jsPDFLib;
    }
    
    if (typeof jsPDF !== 'undefined') {
        jsPDFLib = jsPDF;
        return jsPDFLib;
    }
    
    console.error('jsPDF no está disponible. Verifica la carga de la librería.');
    return null;
}
