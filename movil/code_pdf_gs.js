/**
 * ============================================================
 *  CODE.GS  —  Backend del Web App
 * ============================================================
 *  Endpoints:
 *    GET  ?action=ping                 → health check
 *    GET  ?action=list                 → lista PDFs
 *    GET  ?action=download&id=XXX      → descarga directa
 *    POST { action:'upload', token, fileName, fileData }
 *    POST { action:'delete', token, fileId }
 * ============================================================
 */

// Usamos APP_CONFIG para evitar colisiones de nombre con Setup.gs
const APP_CONFIG = {
  // ⚠️ Si NO usas Script Properties, rellena estos valores a mano.
  // Si ejecutaste setupInicial(), déjalos en null para leerlos de Properties.
  FOLDER_ID_MANUAL: null,
  API_TOKEN_MANUAL: null,
  MAX_BYTES: 45 * 1024 * 1024 // límite seguro por petición (≈45 MB)
};

/* ---------- Helpers ---------- */

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    folderId: APP_CONFIG.FOLDER_ID_MANUAL || props.getProperty('FOLDER_ID'),
    token:    APP_CONFIG.API_TOKEN_MANUAL || props.getProperty('API_TOKEN')
  };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(msg, code) {
  return json_({ status: 'error', code: code || 500, message: msg });
}

/* ---------- GET ---------- */

function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping').toLowerCase();
    const cfg = getConfig_();

    if (!cfg.folderId) return error_('FOLDER_ID no configurado', 500);

    const folder = DriveApp.getFolderById(cfg.folderId);

    switch (action) {
      case 'ping':
        return json_({ status: 'ok', time: new Date().toISOString() });

      case 'list': {
        const files = folder.getFilesByType(MimeType.PDF);
        const list = [];
        while (files.hasNext()) {
          const f = files.next();
          list.push({
            id: f.getId(),
            name: f.getName(),
            size: f.getSize(),
            date: f.getDateCreated().toISOString()
          });
        }
        // más recientes primero
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        return json_({ status: 'ok', files: list });
      }

      case 'download': {
        const id = e.parameter.id;
        if (!id) return error_('Falta parámetro id', 400);

        const file = DriveApp.getFileById(id);

        // Seguridad: solo permitir archivos dentro de nuestra carpeta
        const parents = file.getParents();
        let permitido = false;
        while (parents.hasNext()) {
          if (parents.next().getId() === cfg.folderId) { permitido = true; break; }
        }
        if (!permitido) return error_('Archivo no permitido', 403);

        // Devolver un enlace de descarga de Google Drive.
        // El archivo debe tener permiso de lectura mediante enlace.
        return json_({
          status: 'ok',
          url: 'https://drive.google.com/uc?export=download&id='
               + encodeURIComponent(file.getId())
        });
      }

      default:
        return error_('Acción GET no reconocida: ' + action, 400);
    }
  } catch (err) {
    return error_(err.toString(), 500);
  }
}

/* ---------- POST ---------- */

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return error_('Sin cuerpo en la petición', 400);
    }

    const body = JSON.parse(e.postData.contents);
    const action = (body.action || '').toLowerCase();
    const cfg = getConfig_();

    if (!cfg.token) return error_('API_TOKEN no configurado', 500);

    // Validar token en acciones de escritura
    if (action === 'upload' || action === 'delete') {
      if (body.token !== cfg.token) return error_('Token inválido', 401);
    }

    const folder = DriveApp.getFolderById(cfg.folderId);

    /* ----- UPLOAD ----- */
    if (action === 'upload') {
      if (!body.fileName || !body.fileData) {
        return error_('Faltan fileName o fileData', 400);
      }

      // Validar extensión y MIME
      if (!/\.pdf$/i.test(body.fileName)) {
        return error_('Solo se permiten archivos .pdf', 400);
      }

      // Calcular tamaño (base64 ≈ 4/3 del original)
      const approxBytes = Math.floor(body.fileData.length * 0.75);
      if (approxBytes > APP_CONFIG.MAX_BYTES) {
        return error_('Archivo demasiado grande (> ' + (APP_CONFIG.MAX_BYTES / 1024 / 1024) + ' MB)', 413);
      }

      // Sanitizar nombre
      const safeName = body.fileName.replace(/[\\/:*?"<>|]/g, '_');

      const bytes = Utilities.base64Decode(body.fileData);
      const blob = Utilities.newBlob(bytes, 'application/pdf', safeName);
      const file = folder.createFile(blob);

      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );

      return json_({
        status: 'ok',
        file: {
          id: file.getId(),
          name: file.getName(),
          size: file.getSize()
        }
      });
    }

    /* ----- DELETE ----- */
    if (action === 'delete') {
      if (!body.fileId) return error_('Falta fileId', 400);

      const file = DriveApp.getFileById(body.fileId);

      // Verificar que pertenezca a la carpeta
      const parents = file.getParents();
      let permitido = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === cfg.folderId) { permitido = true; break; }
      }
      if (!permitido) return error_('Archivo no permitido', 403);

      file.setTrashed(true);
      return json_({ status: 'ok', deleted: body.fileId });
    }

    return error_('Acción POST no reconocida: ' + action, 400);

  } catch (err) {
    return error_(err.toString(), 500);
  }
}