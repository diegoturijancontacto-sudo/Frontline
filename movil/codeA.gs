/**
* Backend para Google Sheets - MÓDULO REGISTROS DE OBRA (Con CacheService optimizado)
*
* Hojas requeridas:
* - Responsables
* - RegistrosObra (Ficha técnica de obras)
* - Comisiones (fuente de Provenance)
* - Abreviaturas
*/

const SHEET_RESPONSABLES = 'Responsables';
const SHEET_REGISTROS_OBRA = 'RegistrosObra';
const SHEET_COMISIONES = 'Comisiones';
const SHEET_ABREVIATURAS = 'Abreviaturas';

// Carpeta en Drive donde se guardan archivos
const DRIVE_ATTACHMENTS_FOLDER_ID = '1IKdpJc0ezb6ZwtUzXJm6I91WZIO3s7FS';

// Claves y tiempo para CacheService (en segundos, máximo 21600 = 6 horas)
const CACHE_KEY_PREFIX = 'APP_DATA_ENDPOINT_';
const CACHE_EXPIRATION_SECONDS = 21600;

// Índices de columnas (1-based) en hoja RegistrosObra
const COL_REGISTROS_ID = 1;              // A
const COL_REGISTROS_NOMBRE = 2;          // B
const COL_REGISTROS_UBICACION = 3;       // C
const COL_REGISTROS_ESTATUS = 4;         // D
const COL_REGISTROS_TIPO = 5;            // E
const COL_REGISTROS_SUPERFICIE = 6;      // F
const COL_REGISTROS_PRECIO_LISTA = 7;    // G
const COL_REGISTROS_PRECIO_VENTA = 8;    // H
const COL_REGISTROS_FECHA_REGISTRO = 9;  // I
const COL_REGISTROS_FECHA_ADQUISICION = 10; // J
const COL_REGISTROS_FECHA_VENTA = 11;    // K
const COL_REGISTROS_CLIENTE = 12;        // L
const COL_REGISTROS_DOCUMENTOS = 13;     // M (JSON)
const COL_REGISTROS_OBSERVACIONES = 14;  // N
const COL_REGISTROS_ADJUNTOS = 15;       // O (JSON)
const COL_REGISTROS_ID_RESPONSABLE = 16; // P
const COL_REGISTROS_AUTOR = 17;          // Q
const COL_REGISTROS_ASIGNACION = 18;     // R
const COL_REGISTROS_PROVENANCE = 19;     // S
const COL_REGISTROS_CLAVE = 20;          // T
const COL_REGISTROS_ANCHO = 21;          // U
const COL_REGISTROS_ALTO = 22;           // V
const COL_REGISTROS_LARGO = 23;          // W
const COL_REGISTROS_TAGS = 24;           // X (JSON)
const COL_REGISTROS_MONEDA = 25;         // Y
const COL_REGISTROS_VERIFICADA = 26;     // Z
const COL_REGISTROS_PROMOCIONAR = 27;    // AA
const COL_REGISTROS_COMISION_VALOR = 28; // AB
const COL_REGISTROS_COMISION_TIPO = 29;  // AC

// Índices de columnas (1-based) en hoja Comisiones
const COL_COMISION_ID = 1;               // A
const COL_COMISION_PROVENANCE = 2;       // B
const COL_COMISION_PORCENTAJE = 3;       // C
const COL_COMISION_FECHA_REGISTRO = 4;   // D

// ======================================================
// INIT / VALIDACIÓN DE ESQUEMA
// ======================================================
function ensureSchema_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Responsables
  getOrCreateSheet_(ss, SHEET_RESPONSABLES, ['ID', 'Nombre', 'Departamento', 'Email', 'Rol', 'Fecha Registro', 'Identificador']);

  // RegistrosObra (con Moneda, Verificada, Promocionar, Comisión Valor y Comisión Tipo)
  getOrCreateSheet_(ss, SHEET_REGISTROS_OBRA, [
    'ID', 'Nombre Obra', 'Ubicación', 'Estatus', 'Tipo de Obra', 'Superficie (m²)',
    'Precio Lista', 'Precio Venta', 'Fecha Registro', 'Fecha Adquisición', 'Fecha Venta',
    'Cliente', 'Documentos', 'Observaciones', 'Adjuntos', 'ID Responsable',
    'Autor', 'Asignación', 'Provenance', 'Clave',
    'Ancho (m)', 'Alto (m)', 'Largo (m)', 'Tags', 'Tipo de Moneda', 'Verificada',
    'Promocionar', 'Comisión Valor', 'Comisión Tipo'
  ]);

  // Comisiones
  getOrCreateSheet_(ss, SHEET_COMISIONES, ['ID', 'Provenance', 'Porcentaje', 'Fecha Registro']);

  // Abreviaturas
  getOrCreateSheet_(ss, SHEET_ABREVIATURAS, ['ID', 'Nombre', 'Abreviatura', 'Tipo', 'Fecha Registro']);

  // Asegurar columna Identificador en Responsables y rellenar vacíos
  const shR = ss.getSheetByName(SHEET_RESPONSABLES);
  const colIdent = ensureColumnWithHeader_(shR, 'Identificador');
  const lastRow = shR.getLastRow();
  if (lastRow > 1) {
    const values = shR.getRange(2, 1, lastRow - 1, Math.max(shR.getLastColumn(), colIdent)).getValues();
    for (let i = 0; i < values.length; i++) {
      const nombre = (values[i][1] || '').toString();
      const ident = (values[i][colIdent - 1] || '').toString().trim();
      if (!ident && nombre) {
        shR.getRange(i + 2, colIdent).setValue(generarIdentificador(nombre));
      }
    }
  }

  // Forzar columna Asignación en RegistrosObra como TEXTO
  forceTextColumn_(ss.getSheetByName(SHEET_REGISTROS_OBRA), COL_REGISTROS_ASIGNACION);

  // Asegurar columnas de RegistrosObra con valores por defecto
  const shO = ss.getSheetByName(SHEET_REGISTROS_OBRA);
  if (shO) {
    // Verificada
    const colVerif = ensureColumnWithHeader_(shO, 'Verificada');
    const lastRowObra = shO.getLastRow();
    if (lastRowObra > 1) {
      const range = shO.getRange(2, colVerif, lastRowObra - 1, 1);
      const values = range.getValues();
      let needsUpdate = false;
      for (let i = 0; i < values.length; i++) {
        const val = (values[i][0] || '').toString().trim();
        if (val !== 'Sí' && val !== 'No') {
          values[i][0] = 'No';
          needsUpdate = true;
        }
      }
      if (needsUpdate) {
        range.setValues(values);
      }
    }

    // Promocionar
    const colPromocionar = ensureColumnWithHeader_(shO, 'Promocionar');
    const lastRowObraProm = shO.getLastRow();
    if (lastRowObraProm > 1) {
      const rangeProm = shO.getRange(2, colPromocionar, lastRowObraProm - 1, 1);
      const valuesProm = rangeProm.getValues();
      let needsUpdateProm = false;
      for (let i = 0; i < valuesProm.length; i++) {
        const val = (valuesProm[i][0] || '').toString().trim();
        if (val !== 'Sí' && val !== 'No') {
          valuesProm[i][0] = 'No';
          needsUpdateProm = true;
        }
      }
      if (needsUpdateProm) {
        rangeProm.setValues(valuesProm);
      }
    }

    // Comisión Valor y Comisión Tipo
    const colComValor = ensureColumnWithHeader_(shO, 'Comisión Valor');
    const colComTipo = ensureColumnWithHeader_(shO, 'Comisión Tipo');
    const lastRowCom = shO.getLastRow();
    if (lastRowCom > 1) {
      const rangeValor = shO.getRange(2, colComValor, lastRowCom - 1, 1);
      const rangeTipo = shO.getRange(2, colComTipo, lastRowCom - 1, 1);
      const valuesValor = rangeValor.getValues();
      const valuesTipo = rangeTipo.getValues();
      let needsValor = false, needsTipo = false;
      for (let i = 0; i < valuesValor.length; i++) {
        if (valuesValor[i][0] === '' || valuesValor[i][0] === null || valuesValor[i][0] === undefined) {
          valuesValor[i][0] = 0;
          needsValor = true;
        }
        const t = (valuesTipo[i][0] || '').toString().trim().toLowerCase();
        if (t !== 'porcentaje' && t !== 'monto') {
          valuesTipo[i][0] = 'porcentaje';
          needsTipo = true;
        }
      }
      if (needsValor) rangeValor.setValues(valuesValor);
      if (needsTipo) rangeTipo.setValues(valuesTipo);
    }
  }
}

function getOrCreateSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    return sh;
  }
  const a1 = (sh.getRange(1, 1).getValue() || '').toString().trim().toLowerCase();
  if (a1 !== 'id') {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sh;
  }
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => (v || '').toString().trim());
  if (sh.getLastColumn() < headers.length) {
    sh.getRange(1, sh.getLastColumn() + 1, 1, headers.length - sh.getLastColumn())
      .setValues([headers.slice(sh.getLastColumn())]);
  }
  for (let i = 0; i < headers.length; i++) {
    const expected = headers[i];
    const existing = row1[i];
    if (!existing) sh.getRange(1, i + 1).setValue(expected);
  }
  return sh;
}

function ensureColumnWithHeader_(sh, headerName) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => (v || '').toString().trim());
  let idx = row1.findIndex(h => h.toLowerCase() === headerName.toLowerCase());
  if (idx === -1) {
    const newCol = lastCol + 1;
    sh.getRange(1, newCol).setValue(headerName);
    idx = newCol - 1;
  }
  return idx + 1;
}

function forceTextColumn_(sh, colIndex) {
  if (!sh) return;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  sh.getRange(2, colIndex, lastRow - 1, 1).setNumberFormat('@STRING@');
}

// ======================================================
// UTILIDADES
// ======================================================
function generarIdentificador(nombre) {
  if (!nombre) return 'xxx';
  const palabras = nombre.toLowerCase().split(' ');
  let ident = '';
  for (let i = 0; i < Math.min(palabras.length, 3); i++) {
    if (palabras[i]) ident += palabras[i][0];
  }
  if (ident.length === 1 && nombre.length >= 3) ident = nombre.substring(0, 3).toLowerCase();
  return ident || 'x';
}

function normalizeAsignacion_(v) {
  if (!v) return '';
  if (v instánceof Date) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (s.includes('GMT')) return '';
  return s;
}

function generateObraAsignacion_(ss) {
  const sh = ss.getSheetByName(SHEET_REGISTROS_OBRA);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return 'obra-1';

  // Lectura optimizada: lee únicamente la celda de la última fila en la columna de asignación
  const ultimaAsignacion = sh.getRange(lastRow, COL_REGISTROS_ASIGNACION).getValue();
  const match = String(ultimaAsignacion).match(/^obra-(\d+)$/);
  const maxNum = match ? parseInt(match[1], 10) : lastRow - 1;
  return `obra-${maxNum + 1}`;
}

// Funciones para manejar Tags (JSON) en RegistrosObra
function parseTagsCell_(cellValue) {
  const raw = (cellValue || '').toString().trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function stringifyTagsCell_(tags) {
  return JSON.stringify(tags || []);
}

function parseDocumentosObra_(cellValue) {
  const raw = (cellValue || '').toString().trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function stringifyDocumentosObra_(documentos) {
  return JSON.stringify(documentos || []);
}

function parseAdjuntosObra_(cellValue) {
  const raw = (cellValue || '').toString().trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function stringifyAdjuntosObra_(adjuntos) {
  return JSON.stringify(adjuntos || []);
}

function getRegistroObraById_(ss, obraId) {
  const sh = ss.getSheetByName(SHEET_REGISTROS_OBRA);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString() === obraId.toString()) {
      return { rowIndex: i + 1, values: rows[i], sh: sh };
    }
  }
  return null;
}

function isPrivileged_(ss, actorId) {
  if (!actorId) return false;
  const sh = ss.getSheetByName(SHEET_RESPONSABLES);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString() === actorId.toString()) {
      const rol = (rows[i][4] || '').toString();
      return rol === 'supervisor' || rol === 'director';
    }
  }
  return false;
}

function assertPrivileged_(ss, actorId) {
  if (!isPrivileged_(ss, actorId)) {
    throw new Error('No autorizado: solo supervisor/director puede realizar esta acción.');
  }
}

// ======================================================
// CÁLCULO DE COMISIÓN
// ======================================================
/**
 * Normaliza el tipo de comisión a 'porcentaje' o 'monto'.
 */
function normalizarComisionTipo_(tipo) {
  const t = (tipo || '').toString().trim().toLowerCase();
  return (t === 'monto') ? 'monto' : 'porcentaje';
}

/**
 * Normaliza el valor de comisión a número >= 0.
 */
function normalizarComisionValor_(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;
  const n = parseFloat(valor);
  if (isNaN(n) || n < 0) return 0;
  return n;
}

/**
 * Calcula el monto efectivo de comisión según el tipo.
 * @param {Object} obra - Objeto con comision_valor, comision_tipo, precio_venta
 * @returns {number} Monto de comisión
 */
function calcularComisionEfectiva_(obra) {
  const valor = parseFloat(obra.comision_valor) || 0;
  const tipo = normalizarComisionTipo_(obra.comision_tipo);
  const precioVenta = parseFloat(obra.precio_venta) || 0;
  if (tipo === 'monto') return valor;
  return (precioVenta * valor) / 100;
}

// ======================================================
// DRIVE
// ======================================================
function getAttachmentsFolder_() {
  if (!DRIVE_ATTACHMENTS_FOLDER_ID) throw new Error('Falta DRIVE_ATTACHMENTS_FOLDER_ID');
  return DriveApp.getFolderById(DRIVE_ATTACHMENTS_FOLDER_ID);
}

function ensureFileIsShareable_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn('No se pudo cambiar sharing: ' + e);
  }
}

// ======================================================
// GET - OBTENER DATOS (Con CacheService optimizado)
// ======================================================
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const endpoint = params.endpoint || 'all';
    const limit = parseInt(params.limit) || null;
    const offset = parseInt(params.offset) || 0;

    // Solo usar caché para consultas completas estándar (sin paginación personalizada pesada)
    const useCache = !limit && offset === 0;
    const cacheKey = CACHE_KEY_PREFIX + endpoint;
    const cache = CacheService.getScriptCache();

    if (useCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return ContentService
          .createTextOutput(cachedData)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    ensureSchema_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let response = {
      meta: {
        endpoint: endpoint,
        limit: limit,
        offset: offset,
        totales: {}
      }
    };

    const getPaginatedData = (sheet) => {
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return { data: [], total: 0 };

      const totalRecords = lastRow - 1;
      let allData = sheet.getDataRange().getValues().slice(1);

      if (limit) {
        allData = allData.slice(offset, offset + limit);
      } else if (offset > 0) {
        allData = allData.slice(offset);
      }

      return { data: allData, total: totalRecords };
    };

    if (endpoint === 'all' || endpoint === 'responsables') {
      const shR = ss.getSheetByName(SHEET_RESPONSABLES);
      const colIdent = ensureColumnWithHeader_(shR, 'Identificador');
      const { data, total } = getPaginatedData(shR);

      response.responsables = data.map(r => ({
        id: (r[0] || '').toString(),
        nombre: r[1] || '',
        departamento: r[2] || '',
        email: r[3] || '',
        rol: r[4] || 'responsable',
        fecha_registro: r[5] || '',
        identificador: (r[colIdent - 1] || '').toString() || generarIdentificador(r[1] || '')
      }));
      response.meta.totales.responsables = total;
    }

    if (endpoint === 'all' || endpoint === 'obras') {
      const shO = ss.getSheetByName(SHEET_REGISTROS_OBRA);
      const { data, total } = getPaginatedData(shO);

      response.registrosObra = data.map(r => ({
        id: (r[0] || '').toString(),
        nombre_obra: r[1] || '',
        ubicacion: r[2] || '',
        estatus: r[3] || 'Consolidación',
        tipo_obra: r[4] || '',
        superficie: parseFloat(r[5]) || 0,
        precio_lista: parseFloat(r[6]) || 0,
        precio_venta: parseFloat(r[7]) || 0,
        fecha_registro: r[8] ? new Date(r[8]).toISOString().split('T')[0] : '',
        fecha_adquisicion: r[9] ? new Date(r[9]).toISOString().split('T')[0] : '',
        fecha_venta: r[10] ? new Date(r[10]).toISOString().split('T')[0] : '',
        cliente: r[11] || '',
        documentos: parseDocumentosObra_(r[12]),
        observaciones: r[13] || '',
        adjuntos: parseAdjuntosObra_(r[14]),
        id_responsable: (r[15] || '').toString(),
        autor: r[16] || '',
        asignacion: normalizeAsignacion_(r[17]),
        provenance: r[18] || '',
        clave: r[19] || '',
        ancho: parseFloat(r[20]) || 0,
        alto: parseFloat(r[21]) || 0,
        largo: parseFloat(r[22]) || 0,
        tags: parseTagsCell_(r[23]),
        tipo_moneda: r[24] || '',
        verificada: (r[25] || '').toString() === 'Sí',
        promocionar: (r[26] || '').toString() === 'Sí',
        comision_valor: parseFloat(r[27]) || 0,
        comision_tipo: normalizarComisionTipo_(r[28])
      }));
      response.meta.totales.obras = total;
    }

    if (endpoint === 'all' || endpoint === 'comisiones') {
      const shCo = ss.getSheetByName(SHEET_COMISIONES);
      const { data, total } = getPaginatedData(shCo);

      response.comisiones = data.map(r => ({
        id: (r[0] || '').toString(),
        provenance: (r[1] || '').toString(),
        porcentaje: parseFloat(r[2]) || 0,
        fecha_registro: r[3] || ''
      }));
      response.meta.totales.comisiones = total;
    }

    if (endpoint === 'all' || endpoint === 'abreviaturas') {
      const shA = ss.getSheetByName(SHEET_ABREVIATURAS);
      const { data, total } = getPaginatedData(shA);

      response.abreviaturas = data.map(r => ({
        id: (r[0] || '').toString(),
        nombre: (r[1] || '').toString(),
        abreviatura: (r[2] || '').toString(),
        tipo: (r[3] || '').toString(),
        fecha_registro: (r[4] || '').toString()
      }));
      response.meta.totales.abreviaturas = total;
    }

    const outputString = JSON.stringify(response);

    // Guardar en CacheService si aplica
    if (useCache) {
      try {
        cache.put(cacheKey, outputString, CACHE_EXPIRATION_SECONDS);
      } catch (cacheErr) {
        console.warn('No se pudo guardar en caché: ' + cacheErr);
      }
    }

    return ContentService
      .createTextOutput(outputString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ======================================================
// HELPER PARA INVALIDAR / ACTUALIZAR CACHÉ
// ======================================================
function invalidarCache_() {
  const cache = CacheService.getScriptCache();
  const endpoints = ['all', 'responsables', 'obras', 'comisiones', 'abreviaturas'];
  const keysToRemove = endpoints.map(ep => CACHE_KEY_PREFIX + ep);
  try {
    cache.removeAll(keysToRemove);
  } catch (e) {
    endpoints.forEach(ep => {
      try { cache.remove(CACHE_KEY_PREFIX + ep); } catch (_) {}
    });
  }
}

// ======================================================
// POST - OPERACIONES (Actualiza y limpia el caché automáticamente)
// ======================================================
function doPost(e) {
  try {
    // Se elimina ensureSchema_() en doPost para maximizar la velocidad de escritura.
    // El esquema ya debe estar previamente creado o se actualiza al consultar vía GET.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data || {};

    let operacionExitosa = false;

    // ======================================================
    // REGISTROS OBRA - CRUD
    // ======================================================
    if (action === 'registro_obra_add' || action === 'registro_obra_update' || action === 'registro_obra_delete') {
      const sh = ss.getSheetByName(SHEET_REGISTROS_OBRA);

      if (action === 'registro_obra_add') {
        const asignacion = generateObraAsignacion_(ss);
        const fechaRegistro = data.fecha_registro || new Date().toISOString().split('T')[0];
        const tagsValue = Array.isArray(data.tags)
          ? stringifyTagsCell_(data.tags)
          : (typeof data.tags === 'string' ? data.tags : '[]');

        // Valor por defecto para promocionar: 'No'
        const promocionar = (data.promocionar === true || data.promocionar === 'Sí' || data.promocionar === 'true')
          ? 'Sí'
          : 'No';

        // Comisión
        const comisionValor = normalizarComisionValor_(data.comision_valor);
        const comisionTipo = normalizarComisionTipo_(data.comision_tipo);

        sh.appendRow([
          data.id,
          data.nombre_obra || '',
          data.ubicacion || '',
          data.estatus || 'Consolidación',
          data.tipo_obra || '',
          data.superficie || 0,
          data.precio_lista || 0,
          data.precio_venta || 0,
          fechaRegistro,
          data.fecha_adquisicion || '',
          data.fecha_venta || '',
          data.cliente || '',
          '[]',
          data.observaciones || '',
          '[]',
          data.id_responsable || '',
          data.autor || '',
          '',
          data.provenance || '',
          data.clave || '',
          data.ancho || 0,
          data.alto || 0,
          data.largo || 0,
          tagsValue,
          data.tipo_moneda || 'MXN',
          'No',          // Verificada
          promocionar,   // Promocionar
          comisionValor, // Comisión Valor
          comisionTipo   // Comisión Tipo
        ]);

        const lastRow = sh.getLastRow();
        sh.getRange(lastRow, COL_REGISTROS_ASIGNACION).setNumberFormat('@STRING@');
        sh.getRange(lastRow, COL_REGISTROS_ASIGNACION).setValue(String(asignacion));

        if (sh.getLastColumn() >= COL_REGISTROS_DOCUMENTOS) {
          sh.getRange(lastRow, COL_REGISTROS_DOCUMENTOS).setValue('[]');
        }
        if (sh.getLastColumn() >= COL_REGISTROS_ADJUNTOS) {
          sh.getRange(lastRow, COL_REGISTROS_ADJUNTOS).setValue('[]');
        }
        operacionExitosa = true;
      }

      else if (action === 'registro_obra_update') {
        const rows = sh.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i][0] || '').toString() === (data.id || '').toString()) {
            if (data.nombre_obra !== undefined) sh.getRange(i + 1, COL_REGISTROS_NOMBRE).setValue(data.nombre_obra);
            if (data.ubicacion !== undefined) sh.getRange(i + 1, COL_REGISTROS_UBICACION).setValue(data.ubicacion);
            if (data.estatus !== undefined) sh.getRange(i + 1, COL_REGISTROS_ESTATUS).setValue(data.estatus);
            if (data.tipo_obra !== undefined) sh.getRange(i + 1, COL_REGISTROS_TIPO).setValue(data.tipo_obra);
            if (data.superficie !== undefined) sh.getRange(i + 1, COL_REGISTROS_SUPERFICIE).setValue(data.superficie);
            if (data.precio_lista !== undefined) sh.getRange(i + 1, COL_REGISTROS_PRECIO_LISTA).setValue(data.precio_lista);
            if (data.precio_venta !== undefined) sh.getRange(i + 1, COL_REGISTROS_PRECIO_VENTA).setValue(data.precio_venta);
            if (data.fecha_registro !== undefined) sh.getRange(i + 1, COL_REGISTROS_FECHA_REGISTRO).setValue(data.fecha_registro);
            if (data.fecha_adquisicion !== undefined) sh.getRange(i + 1, COL_REGISTROS_FECHA_ADQUISICION).setValue(data.fecha_adquisicion);
            if (data.fecha_venta !== undefined) sh.getRange(i + 1, COL_REGISTROS_FECHA_VENTA).setValue(data.fecha_venta);
            if (data.cliente !== undefined) sh.getRange(i + 1, COL_REGISTROS_CLIENTE).setValue(data.cliente);
            if (data.observaciones !== undefined) sh.getRange(i + 1, COL_REGISTROS_OBSERVACIONES).setValue(data.observaciones);
            if (data.id_responsable !== undefined) sh.getRange(i + 1, COL_REGISTROS_ID_RESPONSABLE).setValue(data.id_responsable);
            if (data.autor !== undefined) sh.getRange(i + 1, COL_REGISTROS_AUTOR).setValue(data.autor);
            if (data.asignacion !== undefined) {
              sh.getRange(i + 1, COL_REGISTROS_ASIGNACION).setNumberFormat('@STRING@');
              sh.getRange(i + 1, COL_REGISTROS_ASIGNACION).setValue(String(data.asignacion));
            }
            if (data.provenance !== undefined) sh.getRange(i + 1, COL_REGISTROS_PROVENANCE).setValue(data.provenance);
            if (data.clave !== undefined) sh.getRange(i + 1, COL_REGISTROS_CLAVE).setValue(data.clave);
            if (data.ancho !== undefined) sh.getRange(i + 1, COL_REGISTROS_ANCHO).setValue(data.ancho);
            if (data.alto !== undefined) sh.getRange(i + 1, COL_REGISTROS_ALTO).setValue(data.alto);
            if (data.largo !== undefined) sh.getRange(i + 1, COL_REGISTROS_LARGO).setValue(data.largo);
            if (data.tipo_moneda !== undefined) sh.getRange(i + 1, COL_REGISTROS_MONEDA).setValue(data.tipo_moneda);

            if (data.verificada !== undefined) {
              const verificado = typeof data.verificada === 'boolean'
                ? (data.verificada ? 'Sí' : 'No')
                : (data.verificada === 'Sí' || data.verificada === 'true' ? 'Sí' : 'No');
              sh.getRange(i + 1, COL_REGISTROS_VERIFICADA).setValue(verificado);
            }

            if (data.promocionar !== undefined) {
              const promocionar = typeof data.promocionar === 'boolean'
                ? (data.promocionar ? 'Sí' : 'No')
                : (data.promocionar === 'Sí' || data.promocionar === 'true' ? 'Sí' : 'No');
              sh.getRange(i + 1, COL_REGISTROS_PROMOCIONAR).setValue(promocionar);
            }

            if (data.tags !== undefined) {
              if (Array.isArray(data.tags)) {
                sh.getRange(i + 1, COL_REGISTROS_TAGS).setValue(stringifyTagsCell_(data.tags));
              } else if (typeof data.tags === 'string') {
                sh.getRange(i + 1, COL_REGISTROS_TAGS).setValue(data.tags);
              }
            }

            if (data.documentos !== undefined) {
              if (Array.isArray(data.documentos)) {
                sh.getRange(i + 1, COL_REGISTROS_DOCUMENTOS).setValue(stringifyDocumentosObra_(data.documentos));
              } else if (typeof data.documentos === 'string') {
                sh.getRange(i + 1, COL_REGISTROS_DOCUMENTOS).setValue(data.documentos);
              }
            }

            if (data.adjuntos !== undefined) {
              if (Array.isArray(data.adjuntos)) {
                sh.getRange(i + 1, COL_REGISTROS_ADJUNTOS).setValue(stringifyAdjuntosObra_(data.adjuntos));
              } else if (typeof data.adjuntos === 'string') {
                sh.getRange(i + 1, COL_REGISTROS_ADJUNTOS).setValue(data.adjuntos);
              }
            }

            if (data.comision_valor !== undefined) {
              sh.getRange(i + 1, COL_REGISTROS_COMISION_VALOR).setValue(normalizarComisionValor_(data.comision_valor));
            }
            if (data.comision_tipo !== undefined) {
              sh.getRange(i + 1, COL_REGISTROS_COMISION_TIPO).setValue(normalizarComisionTipo_(data.comision_tipo));
            }

            operacionExitosa = true;
            break;
          }
        }
      }

      else if (action === 'registro_obra_delete') {
        const rows = sh.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i][0] || '').toString() === (data.id || '').toString()) {
            sh.deleteRow(i + 1);
            operacionExitosa = true;
            break;
          }
        }
      }

      if (operacionExitosa) invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - DOCUMENTOS (JSON)
    // ======================================================
    else if (action === 'registro_obra_documentos_set') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const documentos = Array.isArray(data.documentos) ? data.documentos : [];
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);
      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_DOCUMENTOS).setValue(stringifyDocumentosObra_(documentos));
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'registro_obra_documento_add') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const documento = data.documento || {};
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);
      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      const prev = parseDocumentosObra_(obra.sh.getRange(obra.rowIndex, COL_REGISTROS_DOCUMENTOS).getValue());
      const newDoc = {
        id: documento.id || ('doc_' + Date.now().toString()),
        tipo: (documento.tipo || '').toString(),
        nombre: (documento.nombre || '').toString(),
        url: (documento.url || '').toString(),
        fecha: (documento.fecha || new Date().toISOString().split('T')[0]),
        uploadedBy: actorId
      };
      prev.push(newDoc);
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_DOCUMENTOS).setValue(stringifyDocumentosObra_(prev));
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', documento: newDoc })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'registro_obra_documento_delete') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const documentoId = (data.documentoId || '').toString().trim();
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      if (!documentoId) throw new Error('Falta data.documentoId');
      assertPrivileged_(ss, actorId);
      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      const prev = parseDocumentosObra_(obra.sh.getRange(obra.rowIndex, COL_REGISTROS_DOCUMENTOS).getValue());
      const next = prev.filter(doc => (doc.id || '') !== documentoId);
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_DOCUMENTOS).setValue(stringifyDocumentosObra_(next));
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - ADJUNTOS (Drive)
    // ======================================================
    else if (action === 'registro_obra_upload_adjunto') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      if (!data.base64) throw new Error('Falta data.base64');

      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      const obraResponsableId = (obra.values[COL_REGISTROS_ID_RESPONSABLE - 1] || '').toString();
      if (!isPrivileged_(ss, actorId) && actorId !== obraResponsableId) {
        throw new Error('No autorizado: solo el responsable o supervisor puede subir adjuntos');
      }

      const folder = getAttachmentsFolder_();
      const filename = (data.filename || 'adjunto_obra').toString();
      const mimeType = (data.mimeType || 'application/octet-stream').toString();
      const base64 = (data.base64 || '').toString();
      const bytes = Utilities.base64Decode(base64);
      const blob = Utilities.newBlob(bytes, mimeType, filename);
      const file = folder.createFile(blob).setName(filename);
      ensureFileIsShareable_(file);
      const fileUrl = file.getUrl();
      const fileId = file.getId();

      const prevRaw = obra.sh.getRange(obra.rowIndex, COL_REGISTROS_ADJUNTOS).getValue();
      const prevAdj = parseAdjuntosObra_(prevRaw);
      prevAdj.push({
        id: fileId,
        name: filename,
        url: fileUrl,
        kind: 'adjunto_obra',
        uploadedBy: actorId,
        createdAt: new Date().toISOString(),
        mimeType: mimeType
      });
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_ADJUNTOS).setValue(stringifyAdjuntosObra_(prevAdj));
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', fileId, url: fileUrl })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'registro_obra_adjunto_eliminar') {
      const idObra = (data.id_obra || '').toString().trim();
      const fileId = (data.fileId || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!fileId) throw new Error('Falta data.fileId');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);

      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (e) { }

      const obra = getRegistroObraById_(ss, idObra);
      if (obra) {
        const prevRaw = obra.sh.getRange(obra.rowIndex, COL_REGISTROS_ADJUNTOS).getValue();
        const prevAdj = parseAdjuntosObra_(prevRaw);
        const nextAdj = prevAdj.filter(a => (a.id || '') !== fileId);
        obra.sh.getRange(obra.rowIndex, COL_REGISTROS_ADJUNTOS).setValue(stringifyAdjuntosObra_(nextAdj));
      }
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - TAGS
    // ======================================================
    else if (action === 'registro_obra_tags_set') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const tags = Array.isArray(data.tags) ? data.tags : [];
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);
      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_TAGS).setValue(stringifyTagsCell_(tags));
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'registro_obra_tag_add') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const tag = data.tag || '';
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      if (!tag) throw new Error('Falta data.tag');
      assertPrivileged_(ss, actorId);
      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      const prev = parseTagsCell_(obra.sh.getRange(obra.rowIndex, COL_REGISTROS_TAGS).getValue());
      if (!prev.includes(tag)) {
        prev.push(tag);
        obra.sh.getRange(obra.rowIndex, COL_REGISTROS_TAGS).setValue(stringifyTagsCell_(prev));
      }
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', tags: prev })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'registro_obra_tag_remove') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const tag = data.tag || '';
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      if (!tag) throw new Error('Falta data.tag');
      assertPrivileged_(ss, actorId);
      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');
      const prev = parseTagsCell_(obra.sh.getRange(obra.rowIndex, COL_REGISTROS_TAGS).getValue());
      const next = prev.filter(t => t !== tag);
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_TAGS).setValue(stringifyTagsCell_(next));
      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', tags: next })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - VERIFICAR
    // ======================================================
    else if (action === 'registro_obra_verificar') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const verificada = data.verificada === true || data.verificada === 'Sí' || data.verificada === 'true';

      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);

      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');

      const valor = verificada ? 'Sí' : 'No';
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_VERIFICADA).setValue(valor);
      invalidarCache_();

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        verificada: verificada
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - PROMOCIONAR (TOGGLE)
    // ======================================================
    else if (action === 'registro_obra_promocionar_toggle') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      const promocionar = data.promocionar === true || data.promocionar === 'Sí' || data.promocionar === 'true';

      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);

      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');

      const valor = promocionar ? 'Sí' : 'No';
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_PROMOCIONAR).setValue(valor);
      invalidarCache_();

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        promocionar: promocionar
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - COMISIÓN (SET)
    // ======================================================
    else if (action === 'registro_obra_comision_set') {
      const idObra = (data.id_obra || '').toString().trim();
      const actorId = (data.id_actor || '').toString().trim();
      if (!idObra) throw new Error('Falta data.id_obra');
      if (!actorId) throw new Error('Falta data.id_actor');
      assertPrivileged_(ss, actorId);

      const obra = getRegistroObraById_(ss, idObra);
      if (!obra) throw new Error('Registro de obra no encontrado');

      const valor = normalizarComisionValor_(data.comision_valor);
      const tipo = normalizarComisionTipo_(data.comision_tipo);

      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_COMISION_VALOR).setValue(valor);
      obra.sh.getRange(obra.rowIndex, COL_REGISTROS_COMISION_TIPO).setValue(tipo);

      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        comision_valor: valor,
        comision_tipo: tipo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // REGISTROS OBRA - OBTENER OBRAS PROMOCIONABLES
    // ======================================================
    else if (action === 'registro_obra_get_promocionables') {
      const sh = ss.getSheetByName(SHEET_REGISTROS_OBRA);
      const rows = sh.getDataRange().getValues();
      const obrasPromocionables = [];

      for (let i = 1; i < rows.length; i++) {
        const promocionar = (rows[i][COL_REGISTROS_PROMOCIONAR - 1] || '').toString().trim();
        if (promocionar === 'Sí') {
          obrasPromocionables.push({
            id: (rows[i][0] || '').toString(),
            nombre_obra: rows[i][1] || '',
            ubicacion: rows[i][2] || '',
            estatus: rows[i][3] || 'Consolidación',
            tipo_obra: rows[i][4] || '',
            superficie: parseFloat(rows[i][5]) || 0,
            precio_lista: parseFloat(rows[i][6]) || 0,
            precio_venta: parseFloat(rows[i][7]) || 0,
            fecha_registro: rows[i][8] ? new Date(rows[i][8]).toISOString().split('T')[0] : '',
            fecha_adquisicion: rows[i][9] ? new Date(rows[i][9]).toISOString().split('T')[0] : '',
            fecha_venta: rows[i][10] ? new Date(rows[i][10]).toISOString().split('T')[0] : '',
            cliente: rows[i][11] || '',
            id_responsable: (rows[i][15] || '').toString(),
            autor: rows[i][16] || '',
            asignacion: normalizeAsignacion_(rows[i][17]),
            provenance: rows[i][18] || '',
            clave: rows[i][19] || '',
            ancho: parseFloat(rows[i][20]) || 0,
            alto: parseFloat(rows[i][21]) || 0,
            largo: parseFloat(rows[i][22]) || 0,
            tags: parseTagsCell_(rows[i][23]),
            tipo_moneda: rows[i][24] || '',
            verificada: (rows[i][25] || '').toString() === 'Sí',
            promocionar: true,
            comision_valor: parseFloat(rows[i][27]) || 0,
            comision_tipo: normalizarComisionTipo_(rows[i][28])
          });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        obras: obrasPromocionables,
        total: obrasPromocionables.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // COMISIONES (CRUD)
    // ======================================================
    else if (action === 'comision_add' || action === 'comision_update' || action === 'comision_delete') {
      const sh = ss.getSheetByName(SHEET_COMISIONES);

      if (action === 'comision_add') {
        const id = (data.id || ('com_' + Date.now().toString())).toString();
        const provenance = (data.provenance || '').toString();
        const porcentaje = (data.porcentaje !== undefined) ? data.porcentaje : 0;
        const fechaRegistro = new Date().toISOString();
        sh.appendRow([id, provenance, porcentaje, fechaRegistro]);
      }

      else if (action === 'comision_update') {
        const id = (data.id || '').toString();
        if (!id) throw new Error('Falta data.id');
        const rows = sh.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i][0] || '').toString() === id) {
            if (data.provenance !== undefined) sh.getRange(i + 1, COL_COMISION_PROVENANCE).setValue(String(data.provenance));
            if (data.porcentaje !== undefined) sh.getRange(i + 1, COL_COMISION_PORCENTAJE).setValue(data.porcentaje);
            break;
          }
        }
      }

      else if (action === 'comision_delete') {
        const id = (data.id || '').toString();
        if (!id) throw new Error('Falta data.id');
        const rows = sh.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i][0] || '').toString() === id) {
            sh.deleteRow(i + 1);
            break;
          }
        }
      }

      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // ======================================================
    // ABREVIATURAS (CRUD)
    // ======================================================
    else if (action === 'abreviatura_add') {
      const sh = ss.getSheetByName(SHEET_ABREVIATURAS);
      const id = data.id || `abrev_${Date.now().toString()}`;
      const fechaRegistro = data.fecha_registro || new Date().toISOString();

      sh.appendRow([
        id,
        data.nombre || '',
        data.abreviatura || '',
        data.tipo || '',
        fechaRegistro
      ]);

      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        id
      })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'abreviatura_update') {
      const sh = ss.getSheetByName(SHEET_ABREVIATURAS);
      const id = (data.id || '').toString().trim();

      if (!id) throw new Error('Falta data.id');

      const rows = sh.getDataRange().getValues();
      let encontrado = false;

      for (let i = 1; i < rows.length; i++) {
        if ((rows[i][0] || '').toString() === id) {
          const rowIndex = i + 1;

          if (data.nombre !== undefined) {
            sh.getRange(rowIndex, 2).setValue(data.nombre);
          }
          if (data.abreviatura !== undefined) {
            sh.getRange(rowIndex, 3).setValue(data.abreviatura);
          }
          if (data.tipo !== undefined) {
            sh.getRange(rowIndex, 4).setValue(data.tipo);
          }

          encontrado = true;
          break;
        }
      }

      if (!encontrado) throw new Error('Abreviatura no encontrada');

      invalidarCache_();
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'abreviatura_delete') {
      const sh = ss.getSheetByName(SHEET_ABREVIATURAS);
      const id = (data.id || '').toString().trim();

      if (!id) throw new Error('Falta data.id');

      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if ((rows[i][0] || '').toString() === id) {
          sh.deleteRow(i + 1);
          invalidarCache_();
          return ContentService.createTextOutput(JSON.stringify({
            result: 'success'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      throw new Error('Abreviatura no encontrada');
    }

    invalidarCache_();
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      message: 'Operación completada'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
