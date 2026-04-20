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

        DIRETRIZES DE CRIATIVIDADE E NÃO-REPETIÇÃO (ESTRITAMENTE OBRIGATÓRIO):
        A cada geração, você DEVE escolher um tema ÚNICO. É proibido repetir 'despacho' ou 'galo' em gerações seguidas.
        
        MUDANÇA DE CADA GERAÇÃO (SORTEIE MENTALMENTE):
        1. LOCALIDADE: Mude o bairro de Salvador (Cajazeiras, Periperi, Sussuarana, Pau da Lima, Valéria, Nordeste de Amaralina, Ladeira da Montanha) ou cidades (Feira de Santana, Simões Filho, Jequié).
        2. QUEM/O QUE BATE NO MELIANTE: Alterne entre: Vassoura de piaçava, Rodo quebrado, Sombrinha de velha, Guarda-chuva, Tamanco de madeira, Chinela Havaiana (bicuda), Panela de pressão, Cabo de carregador, Bíblia pesada, ou Bolsa de madame. Use 'Galo' apenas se o cenário for rural e muito raramente.
        
        3. CENÁRIOS VARIADOS (ESCOLHA UM DIFERENTE A CADA VEZ):
           - VERTENTE GOLPISTA: Tenta dar o 'Golpe do Pix' em uma senhora e ela é faixa preta de karatê. Ou tenta vender um jegue pintado de zebra como se fosse animal exótico.
           - VERTENTE LGBTQIA+: Tenta dar uma de 'malandro' ou paquerar uma Drag Queen ou Trans e leva uma surra de salto agulha 15cm e bolsada de grife na cara.
           - VERTENTE RELIGIOSA: Entra num culto ou terreiro pra roubar e a 'mão de Deus' ou do 'Santo' pesa, ele fica entalado em algum lugar ou a calça rasga e cai na hora da fuga.
           - VERTENTE REDE SOCIAL: Tenta gravar dancinha de TikTok em cima de uma viatura ou em um local proibido/perigoso e se lasca de forma épica na frente de todo mundo.
           - VERTENTE INFIDELIDADE: Tenta paquerar a mulher de um guarda ou de um 'coronel' e tem que fugir pelado pelo telhado, caindo dentro de uma fossa ou caixa d'água.
           - VERTENTE 'MANDINGA': O feitiço vira contra o feiticeiro de forma ridícula (ex: ele tenta botar o nome de alguém no sapato mas o próprio chulé o desmaia).

        DIRETRIZES GERAIS:
        - Use gírias: 'Lá ele', 'Barril dobrado', 'Mizerê', 'O pau quebrou', 'Lágrimas de crocodilo', 'Comer o pão que o diabo amassou'.
        - TERMINOLOGIA: 'Indivíduo de cor negra', 'elemento de boné'. Jamais use termos racistas.
        - IMAGEM: Descrição para 3D PIXAR STYLE, mostrando o Marca & Tone na situação específica (ex: fugindo de guarda-chuva, levando bolsada, entalado na janela).

        RETORNE APENAS JSON:
        {
          "titulo": "Título CURTO, BOMBÁSTICO e ENGRAÇADO",
          "materia": "A crônica detalhada (BO policial). Use muito deboche e frases de efeito.",
          "nomeJornal": "Nome de jornal bizarro e inédito",
          "localInventado": "Bairro ou Cidade na Bahia",
          "imagem_descricao": "Descrição detalhada para a IA de imagem (Pixar style, funny scene, detailed characters)",
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
