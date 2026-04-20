import { GoogleGenAI, Type } from "@google/genai";

export interface Ocorrencia {
  titulo: string;
  materia: string;
  nomeJornal: string;
  localInventado: string;
  imagem_descricao: string;
  imagem_url: string;
  autor: string;
  estilo: {
    corPrincipal: string;
    temaPortal: string;
  };
}

const NOME_MARCA_TONE = "MARCA & TONE";

export async function gerarOcorrencia(nomeUsuario: string): Promise<Ocorrencia> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY_MISSING");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Você é um repórter de rádio policial sensacionalista da Bahia, no estilo 'pinga-sangue', que fala gritando e usa gírias pesadas e debochadas. Escreva uma crônica ultra-detalhada sobre as presepadas do meliante "MARCA & TONE" (indivíduo de cor negra, sempre de boné).

        DIRETRIZES DE NÃO-REPETIÇÃO E ALTERNÂNCIA AUTOMÁTICA (CRITICAL):
        A cada geração, você DEVE ALTERNAR RADICALMENTE o tema central da história. Escolha UMA das vertentes abaixo a cada vez para que o App nunca seja repetitivo:
        - VERTENTE MACUMBA: Ele tenta fazer feitiço para os outros e o karma de Papai do Céu faz a mandinga voltar contra ele de forma hilária (ex: galo ataca ele, vela queima o boné, fica preso no despacho).
        - VERTENTE LGBTQIA+: Tenta se engraçar, paquerar ou dar uma de 'garanhão' pra cima de Travestis ou Drags e leva o maior esculacho/surra de bolsa/salto alto da sua vida.
        - VERTENTE GOLPE FALHADO: Tenta dar golpe do Pix, estelionato, roubo bizarro (dentadura, jegue, botijão) e se lasca na execução ou na fuga.
        - VERTENTE HUMILHAÇÃO PÚBLICA: Fica entalado em algum lugar, cai no esgoto, a calça cai na frente da polícia, ou é corrido por animais (abelhas, bodes, cão vira-lata).

        DIRETRIZES GERAIS:
        1. VARIEDADE DE PUNIÇÃO: Vassoura, chinelada, guarda-chuva, perseguição, ou apenas o karma.
        2. VARIEDADE DE CENÁRIO: Mude o bairro de Salvador ou cidade da Bahia e o Nome do Jornal (Inédito: ex: O Grito da Bota, Rádio Lapada, Diário do Meliante).
        3. TERMINOLOGIA: Use 'indivíduo de cor negra' ou 'elemento de boné'. Nunca use 'preto'.
        4. IMAGEM: Descrição detalhada para ANIMAÇÃO 3D ESTILO PIXAR (Disney Pixar Style), mostrando o Marca & Tone na situação específica sorteada acima.
        5. REPÓRTER: ${nomeUsuario}.

        RETORNE APENAS JSON:
        {
          "titulo": "Título BOMBÁSTICO, INÉDITO e SENSACIONALISTA",
          "materia": "A crônica detalhada (BO policial de rádio). Use gírias baianas 'lá ele', muito deboche e humor chulo.",
          "nomeJornal": "Nome de jornal bizarro e inédito",
          "localInventado": "Lugar na Bahia",
          "imagem_descricao": "Descrição detalhada (Marca & Tone na situação central sorteada, Pixar 3D Movie style)",
          "estilo": { "corPrincipal": "#b91c1c", "temaPortal": "RÁDIO PINGA-SANGUE" }
        }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Resposta da IA vazia");
    
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/```json|```/g, "").trim();
    }
    
    let data;
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      console.error("Erro ao parsear JSON da Gemini:", cleanText);
      throw new Error("A IA teve um piripaque e não gerou um texto válido. Tente de novo!");
    }

    // Garantindo que as chaves existam com fallbacks
    data.titulo = data.titulo || "FLAGRANTE BOMBÁSTICO!";
    data.materia = data.materia || "Meliante foi pego no pulo mas o repórter esqueceu de anotar os detalhes!";
    data.nomeJornal = data.nomeJornal || "Diário do Flagrante";
    data.localInventado = data.localInventado || "Salvador, Bahia";
    data.autor = `Repórter: ${nomeUsuario || 'Anônimo'}`;
    
    if (!data.estilo) data.estilo = { corPrincipal: "#b91c1c", temaPortal: "RÁDIO PINGA-SANGUE" };
    
    // Prompt ultra-estável para evitar URLs gigantes ou quebradas
    const imageDesc = (data.imagem_descricao || `Marca & Tone meliante de boné flagrante na Bahia`).substring(0, 150)
      .replace(/[^\w\sÀ-ÿ]/g, ''); // Remove caracteres especiais que podem quebrar a URL
    
    const styleSuffix = ", pixar 3d animation, sharp focus";
    
    // Usando o endpoint oficial com parâmetros simplificados
    data.imagem_url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imageDesc + styleSuffix)}?width=768&height=768&model=flux&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
    
    return data as Ocorrencia;
  } catch (error: any) {
    console.error("Erro ao gerar:", error);
    if (error.message === "API_KEY_MISSING") {
      throw new Error("A chave da IA (API KEY) não foi configurada nos Secrets deste ambiente. Use o Modo Demo para testar agora!");
    }
    throw error;
  }
}
