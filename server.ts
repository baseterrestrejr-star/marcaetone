import express from "express";
import path from "path";
import fs from "fs";
import LZString from "lz-string";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

  // API to generate occurrence (DEPRECATED: Now handled on frontend)
  app.post("/api/gerar", async (req, res) => {
    res.status(410).json({ error: "Este endpoint foi desativado. Use a lógica de frontend agora." });
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
