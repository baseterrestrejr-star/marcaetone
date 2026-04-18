export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(403).json({ error: "FALTA CHAVE: Configure GEMINI_API_KEY na Vercel." });
    }

    // Parse body safely
    let nomeUsuario = "Repórter";
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (data && data.nomeUsuario) nomeUsuario = data.nomeUsuario;
    } catch (e) {
      console.warn("Falha ao parsear body, usando padrão.");
    }

    const prompt = `Gere uma CRÔNICA POLICIAL curta sobre "MARCA & TONE" (homem negro de boné). Repórter: ${nomeUsuario}. JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const googleRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      throw new Error(googleData.error?.message || `Erro Google ${googleRes.status}`);
    }

    const aiText = googleData.candidates[0].content.parts[0].text;
    res.status(200).send(aiText);

  } catch (error) {
    console.error("ERRO CRÍTICO NA API:", error);
    res.status(500).json({ error: `ERRO DO SERVIDOR: ${error.message}` });
  }
}
