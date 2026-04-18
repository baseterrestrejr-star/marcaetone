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

    const prompt = `Você é um escrivão de delegacia na Bahia com um senso de humor afiado. Escreva um BOLETIM DE OCORRÊNCIA (B.O.) extremamente detalhado e CÔMICO sobre o meliante "MARCA & TONE" (homem negro de boné, já conhecido dos meios policiais por ser 'malandro de internet').

        REGRAS DA MATÉRIA:
        1. LOCAL: Varie entre fila do banco, farmácia, praça, fazenda, pescando, no carrinho de rolimã, moto ou carro.
        2. CONTEXTO: Ele sempre tenta dar um golpe (tipo golpe do Pix) ou se dar bem, mas acaba se metendo com o público LGBT (travestis, drag queens, transformistas) ou guardas e se dá muito mal.
        3. DESFECHO: Ele sempre apanha, é humilhado ou acaba preso de forma ridícula.
        4. ESTILO: Linguagem popular baiana misturada com termos técnicos de B.O. (ex: 'o meliante em tela', 'logrou êxito em se lascar').
        5. TOM: Hilário, para fazer o leitor rir muito.
        6. REPÓRTER: ${nomeUsuario}.

        RETORNE APENAS JSON:
        {
          "titulo": "Título chamativo e engraçado estilo jornal popular",
          "materia": "A crônica detalhada em tom de B.O.",
          "nomeJornal": "Gazeta da Taca" ou "Diário do Meliante",
          "localInventado": "Nome de um bairro ou cidade na Bahia",
          "imagem_descricao": "Descrição para gerar uma imagem cômica da confusão (ex: Marca & Tone fugindo de drag queen em um carrinho de rolimã)",
          "autor": "Inspecione: ${nomeUsuario}",
          "estilo": { "corPrincipal": "#e63946", "temaPortal": "POLICIAL CÔMICO" }
        }`;

    const modelosParaTentar = [
      "gemini-3-flash-preview",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite-preview"
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
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        const data = await googleRes.json();

        if (googleRes.ok) {
          let aiText = data.candidates[0].content.parts[0].text;
          
          // Limpeza de Markdown (Caso a IA ignore o MimeType)
          if (aiText.includes("```")) {
            aiText = aiText.replace(/```json|```/gi, "").trim();
          }
          
          // Validação final de JSON
          try {
            JSON.parse(aiText);
            return res.status(200).send(aiText);
          } catch (e) {
            console.error("IA gerou um JSON inválido, tentando próximo modelo...");
            ultimoErro = "JSON INVÁLIDO";
            continue;
          }
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
