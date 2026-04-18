import serverless from "serverless-http";
import { createServerApp } from "../../server";

let serverlessApp: any;

export const handler = async (event: any, context: any) => {
  try {
    if (!serverlessApp) {
      console.log("Inicializando servidor Express (Netlify)...");
      const app = await createServerApp();
      serverlessApp = serverless(app);
    }
    return await serverlessApp(event, context);
  } catch (error: any) {
    console.error("ERRO CRÍTICO NO HANDLER NETLIFY:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro interno fatal", details: error.message })
    };
  }
};
