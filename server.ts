import express from "express";
import path from "path";
import fs from "fs";
import LZString from "lz-string";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize AI
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

async function gerarOcorrenciaBackend(nomeUsuario: string) {
  const prompt = `Gere uma CRÔNICA POLICIAL curta (Coleção Vagalume) sobre "MARCA & TONE" (homem negro de boné). Repórter: ${nomeUsuario}. Retorne APENAS um JSON: {titulo, materia, nomeJornal, localInventado, imagem_descricao, autor, estilo: {corPrincipal, temaPortal}}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Fallback mode if no API KEY is present to avoid 502 crash
    if (!apiKey || apiKey.length < 5) {
      console.warn("GEMINI_API_KEY ausente ou inválida. Usando modo demonstração.");
      return {
        titulo: "O MISTÉRIO DO BONÉ DESAPARECIDO",
        materia: "Em uma manhã nebulosa no bairro do Limoeiro, Marca & Tone foi visto pela última vez segurando um café e seu inseparável boné. Testemunhas dizem que ele sorriu para o perigo antes de desaparecer entre as sombras da gráfica. A polícia investiga um rastro de pó de café e vergonha alheia.",
        nomeJornal: "Diário da Vagalume",
        localInventado: "Bairro do Limoeiro",
        imagem_descricao: "Pulp novel style illustration of a detective finding a black cap in a dark alley",
        autor: `Repórter: ${nomeUsuario} (Modo Demo)`,
        imagem_url: "https://picsum.photos/seed/policial/1024/576",
        estilo: { corPrincipal: "#ff0000", temaPortal: "POLICIAL" }
      };
    }

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest", 
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    if (!response || !response.text) throw new Error("Resposta da IA vazia");
    
    let text = response.text.trim();
    if (text.startsWith("```")) text = text.replace(/```json|```/g, "").trim();
    
    const data = JSON.parse(text);
    data.autor = `Repórter: ${nomeUsuario}`;
    data.imagem_url = `https://image.pollinations.ai/prompt/${encodeURIComponent(data.imagem_descricao + ", police newspaper style")}?width=1024&height=576&nologo=true&seed=${Math.random()}`;
    return data;
  } catch (error: any) {
    console.error("Erro no Gerador:", error);
    // Even on error, return something to prevent 502
    return {
      titulo: "VIATURA QUEBROU NO CAMINHO",
      materia: `Ocorreu um erro técnico: ${error.message}. Mas não se preocupe, Marca & Tone continua foragido na imaginação do público.`,
      nomeJornal: "O Grito de Alerta",
      localInventado: "Oficina do Seu Zé",
      imagem_descricao: "A broken police car on a side road",
      autor: "Sistema de Emergência",
      imagem_url: "https://picsum.photos/seed/broken/1024/576",
      estilo: { corPrincipal: "#000000", temaPortal: "ERRO" }
    };
  }
}

// Initialize Firebase with safety
let db: any;
try {
  let config: any = null;
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  
  if (process.env.FIREBASE_CONFIG) {
    config = JSON.parse(process.env.FIREBASE_CONFIG);
  } else if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  if (config) {
    const firebaseApp = initializeApp(config);
    db = getFirestore(firebaseApp, config.firestoreDatabaseId);
  }
} catch (e) {
  console.error("Erro ao carregar configuração do Firebase:", e);
}

async function getOcorrenciaFirestore(id: string) {
  if (!db) return null;
  try {
    const docSnap = await getDoc(doc(db, "ocorrencias", id));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (e) {
    console.error("Erro ao buscar no Firestore:", e);
    return null;
  }
}

export async function createServerApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // API to get configuration (Dynamic Fallback)
  app.get("/api/config", (req, res) => {
    res.json({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || 
                      process.env.VITE_GEMINI_API_KEY || 
                      process.env.GOOGLE_API_KEY || 
                      process.env.API_KEY || 
                      "",
      FIREBASE_CONFIG: process.env.FIREBASE_CONFIG || 
                       process.env.VITE_FIREBASE_CONFIG || 
                       ""
    });
  });

  // API to get occurrence data
  app.get("/api/ocorrencias/:id", async (req, res) => {
    try {
      const data = await getOcorrenciaFirestore(req.params.id);
      if (data) res.json(data);
      else res.status(404).json({ error: "Ocorrência não encontrada" });
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar dados" });
    }
  });

  // API to generate occurrence
  app.post("/api/gerar", async (req, res) => {
    const { nomeUsuario } = req.body;
    if (!nomeUsuario) return res.status(400).json({ error: "Nome necessário" });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Erro: GEMINI_API_KEY não configurada no Netlify." });
    }

    try {
      const data = await gerarOcorrenciaBackend(nomeUsuario);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: `IA falhou: ${e.message}` });
    }
  });

  // In Development, serve Vite. In Netlify, let Netlify handle static files.
  if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res) => {
      const template = await vite.transformIndexHtml(req.url, fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8"));
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    });
  }

  return app;
}

if (process.env.NODE_ENV !== "production" || !process.env.NETLIFY) {
  createServerApp().then(app => {
    app.listen(3000, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:3000`);
    });
  });
}
