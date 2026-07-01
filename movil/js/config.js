// ============================================
// CONFIG.JS - Configuración de la aplicación
// ============================================

// URL del backend (AppScript)
const API_URL = 'https://script.google.com/macros/s/AKfycbx1wIgADNvhYVbo9nNduz-jtz9s1pkvsZGXL3r6rmfjcWK0NWLFLHuw9zE5B21PF2OXow/exec';

// URL de la base de datos de obras
const DB_URL = 'https://script.google.com/macros/s/AKfycbxmPBIboe_Evn45ZHjtkjydbmlPRMuSax_sEiTc2iN8cqqi2i4-Pf_lOd6875cQXEd_yg/exec';

// Logo path
const LOGO_PATH = 'rtbrok_logo.png';

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
    isLoading: false
};
