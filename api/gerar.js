import { GoogleGenerativeAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS Ultra-Permissivo para testes
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(403).json({ 
        error: "PLACA NÃO ENCONTRADA: Você esqueceu de colocar a GEMINI_API_KEY nas variáveis da Vercel!" 
      });
    }

    const { nomeUsuario } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Gere uma CRÔNICA POLICIAL curta sobre "MARCA & TONE" (meliante de boné). Repórter: ${nomeUsuario}. JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    res.status(200).send(text);
  } catch (error) {
    res.status(500).json({ error: "A PRENSA TRAVOU: " + error.message });
  }
}
