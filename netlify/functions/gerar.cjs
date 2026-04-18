const https = require('https');

exports.handler = async (event) => {
  // Configuração de CORS para permitir que o frontend chame a função
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Metodo não permitido' };
  }

  try {
    const { nomeUsuario } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.length < 5) {
      return { 
        statusCode: 403, 
        headers,
        body: JSON.stringify({ error: "ERRO: A variável GEMINI_API_KEY não foi configurada ou está vazia no painel do Netlify." }) 
      };
    }

    const prompt = `Gere uma CRÔNICA POLICIAL curta (Coleção Vagalume) sobre "MARCA & TONE" (homem negro de boné). Repórter: ${nomeUsuario}. Retorne APENAS um JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => resolve({ body, statusCode: res.statusCode }));
      });

      req.on('error', (e) => reject(e));
      req.write(postData);
      req.end();
    });

    if (result.statusCode !== 200) {
      const errBody = JSON.parse(result.body);
      throw new Error(errBody.error?.message || `Erro no Google (Status ${result.statusCode})`);
    }

    const parsed = JSON.parse(result.body);
    const aiText = parsed.candidates[0].content.parts[0].text;
    
    return {
      statusCode: 200,
      headers,
      body: aiText
    };
  } catch (error) {
    console.error("Erro na Function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Erro interno na geração da história." })
    };
  }
};
