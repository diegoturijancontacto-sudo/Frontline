/**
 * Serverless Function para Vercel
 * Este archivo actúa como un proxy seguro para descargar los datos de tus obras.
 * Evita la exposición directa de la URL de tu Google Apps Script en el cliente.
 */
export default async function handler(req, res) {
    // 1. Obtener la URL de Google Apps Script desde las variables de entorno de Vercel
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;

    if (!appsScriptUrl) {
        return res.status(500).json({ 
            error: "La variable de entorno APPS_SCRIPT_URL no está configurada en Vercel." 
        });
    }

    // Solo admitir solicitudes GET para obtener el catálogo de obras
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido. Utiliza GET.' });
    }

    try {
        // 2. Realizar la petición segura a Google Apps Script
        const response = await fetch(appsScriptUrl);

        if (!response.ok) {
            throw new Error(`Error al conectar con Google Sheets: ${response.status}`);
        }

        const data = await response.json();
        
        // 3. Devolver los registros de las obras al navegador
        return res.status(200).json(data);

    } catch (error) {
        console.error("Error en la ejecución Serverless de Obras:", error);
        return res.status(500).json({ 
            error: "Fallo al comunicar con la base de datos de Google Sheets",
            details: error.message 
        });
    }
}
