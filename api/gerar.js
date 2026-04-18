export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
    const apiKey = rawApiKey.trim();
    if (!apiKey) {
      return res.status(403).json({ error: "FALTA CHAVE: Configure GEMINI_API_KEY na Vercel." });
    }

    // Parse body safely
    let nomeUsuario = "Repórter";
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (data && data.nomeUsuario) nomeUsuario = data.nomeUsuario;
    } catch (e) {}

    const prompt = `Gere uma CRÔNICA POLICIAL curta sobre "MARCA & TONE" (homem negro de boné). Repórter: ${nomeUsuario}. JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

    const modelosParaTentar = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-pro"
    ];

    let ultimoErro = "";

    for (const modelName of modelosParaTentar) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const googleRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const data = await googleRes.json();

        if (googleRes.ok) {
          const aiText = data.candidates[0].content.parts[0].text;
          return res.status(200).send(aiText);
        } else {
          ultimoErro = data.error?.message || `Erro ${googleRes.status}`;
          console.warn(`Tentativa com ${modelName} falhou: ${ultimoErro}`);
        }
      } catch (e) {
        ultimoErro = e.message;
      }
    }

    throw new Error(`O Google recusou todos os modelos. Último erro: ${ultimoErro}`);

  } catch (error) {
    console.error("ERRO CRÍTICO NA API:", error);
    res.status(500).json({ error: `ERRO DO SERVIDOR: ${error.message}` });
  }
}
