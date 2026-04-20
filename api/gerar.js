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

    const prompt = `Você é um repórter de rádio policial sensacionalista da Bahia, daqueles que fala gritando e usa gírias pesadas, mas com um vocabulário 'técnico' de delegacia chulo. Escreva uma crônica ultra-detalhada sobre as presepadas do meliante "MARCA & TONE" (indivíduo de cor negra, sempre de boné).

        DIRETRIZES TÉCNICAS:
        1. TERMINOLOGIA: Nunca use a palavra 'preto'. Refira-se a ele sempre como 'indivíduo de cor negra', 'elemento de boné', 'meliante já conhecido' ou 'vulgo Marca & Tone'.
        2. DINÂMICA PIRIGUETES LGBTQIA+: Em todas as histórias, ele deve tentar SE ENGRAÇAR, PAQUERAR ou se insinuar para as 'piriguetes' do público LGBTQIA+ (travestis, drags, transformistas), achando que é o garanhão da Bahia. O desfecho deve ser ele sendo sumariamente esculachado, levando uma surra de bolsa ou sendo humilhado em público por essas figuras que são muito mais espertas que ele.
        3. VARIEDADE TOTAL: A cada geração, voce DEVE ESCOLHER UM CENÁRIO, UM GOLPE e UM MEIO DE FUGA DIFERENTE:
           - CENÁRIOS: Shopping, feira livre, interior da fazenda, hospital, cartório, pescaria no Rio Paraguaçu, procissão, festa de largo, academia, cinema, boteco de esquina.
           - GOLPES: Bilhete premiado falso, venda de terreno na lua, golpe do Pix por aproximação, venda de perfume que é água com ki-suco, golpe da herança do shake árabe, fingir que é fiscal da prefeitura.
           - FUGAS: Moto cinquentinha, cavalo manco, patins, bicicleta sem freio, trator, skate, correndo no meio do mato, canoa furada, em cima de um trio elétrico desligado, lombo de jegue.
        4. TOM: Sarcástico, humor chulo, programa de rádio 'pinga-sangue', muita risada e deboche da desgraça dele.
        5. IMAGEM: A descrição da imagem DEVE ser pensada para um estilo de ANIMAÇÃO 3D DA PIXAR (Disney Pixar Style), com personagens expressivos e coloridos, mas em situações engraçadas de B.O.
        6. REPÓRTER: ${nomeUsuario}.

        RETORNE APENAS JSON:
        {
          "titulo": "Título BOMBÁSTICO e engraçado (invente um novo a cada vez)",
          "materia": "A crônica detalhada (BO policial de rádio). Use gírias baianas como 'lá ele', 'barril', 'armengue', 'tuma', 'brotar'.",
          "nomeJornal": "Invente um nome de jornal diferente para cada história (Ex: O Porrete, A Taca Diária, O Grito do Subúrbio, Jornal Meia-Noite, Diário do Quebra-Queixo)",
          "localInventado": "Um bairro ou localidade específica da Bahia (ex: Paripe, Liberdade, Cajazeiras, Periperi)",
          "imagem_descricao": "Descrição detalhada para a IA gerar a imagem: Marca & Tone (indivíduo de cor negra de boné) em situação cômica com travestis/drags, estilo Pixar 3D Movie, cores vibrantes, engraçado",
          "autor": "Inspecione: ${nomeUsuario}",
          "estilo": { "corPrincipal": "#2b2d42", "temaPortal": "RÁDIO PINGA-SANGUE" }
        }`;

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
