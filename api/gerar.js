import { GoogleGenerativeAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST permitido' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(403).json({ error: "ERRO DE CHAVE: Você precisa adicionar GEMINI_API_KEY no painel de Environment Variables da Vercel e dar um Redeploy." });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { nomeUsuario } = body;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Gere uma CRÔNICA POLICIAL curta (Coleção Vagalume) sobre "MARCA & TONE" (homem negro de boné). Repórter: ${nomeUsuario}. Retorne APENAS um JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Tenta validar se é JSON mesmo
    JSON.parse(text); 
    
    res.status(200).send(text);
  } catch (error) {
    console.error("Erro na Vercel Function:", error);
    res.status(500).json({ error: "Erro na IA: " + error.message });
  }
}
