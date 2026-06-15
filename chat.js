/**
 * Serverless Function para Vercel
 * Este archivo procesa la petición de manera privada y segura.
 * Lee la variable de entorno 'GEMINI_API_KEY' sin exponerla al cliente en el frontend.
 */
export default async function handler(req, res) {
    // 1. Obtener la clave API desde las variables de entorno de Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ 
            error: "La variable de entorno GEMINI_API_KEY no está configurada en Vercel." 
        });
    }

    // Solo admitir solicitudes POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
    }

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    try {
        // 2. Realizar la petición segura a la API oficial de Google Gemini
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(req.body) // Reenviamos el payload JSON del chat
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error en el servicio de Gemini: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        
        // 3. Devolver la respuesta procesada de vuelta al navegador
        return res.status(200).json(data);

    } catch (error) {
        console.error("Error en la ejecución Serverless:", error);
        return res.status(500).json({ 
            error: "Fallo al comunicar con la Inteligencia Artificial",
            details: error.message 
        });
    }
}
