import https from 'https';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST permitido' });
  }

  try {
    // Na Vercel, req.body pode vir como string ou objeto dependendo do parser
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { nomeUsuario } = body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey.length < 5) {
      return res.status(403).json({ error: "Chave GEMINI_API_KEY não configurada na Vercel!" });
    }

    const prompt = `Gere uma CRÔNICA POLICIAL curta (Coleção Vagalume) sobre "MARCA & TONE" (homem negro de boné). Repórter: ${nomeUsuario}. Retorne APENAS um JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

    const result = await new Promise((resolve, reject) => {
      const data = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const request = https.request(options, (response) => {
        let responseBody = '';
        response.on('data', (d) => responseBody += d);
        response.on('end', () => resolve({ body: responseBody, statusCode: response.statusCode }));
      });

      request.on('error', (e) => reject(e));
      request.write(data);
      request.end();
    });

    const parsed = JSON.parse(result.body);
    if (result.statusCode !== 200) {
      throw new Error(parsed.error?.message || 'Erro no Google');
    }

    const aiText = parsed.candidates[0].content.parts[0].text;
    res.status(200).send(aiText);
  } catch (error) {
    console.error("Erro na API Vercel:", error);
    res.status(500).json({ error: error.message });
  }
}
