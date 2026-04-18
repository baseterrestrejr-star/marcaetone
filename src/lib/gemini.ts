export interface Ocorrencia {
  titulo: string;
  materia: string;
  nomeJornal: string;
  localInventado: string;
  imagem_descricao: string;
  imagem_url: string;
  mensagem_whatsapp: string;
  texto_copiavel: string;
  autor: string;
  estilo: {
    corPrincipal: string;
    temaPortal: 'noticias_pop' | 'portal_moderno' | 'blog_fofoca' | 'tabloide_classico';
  };
}

export async function gerarOcorrencia(nomeUsuario: string): Promise<Ocorrencia> {
  try {
    // 1. Tenta a Netlify Function (Seguro e funciona com Netlify Drop)
    const res = await fetch('/.netlify/functions/gerar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nomeUsuario }),
    });

    if (res.ok) {
      const result = await res.json();
      result.autor = `Repórter: ${nomeUsuario}`;
      const encodedPrompt = encodeURIComponent(result.imagem_descricao + ", funny, high quality, vibrant");
      result.imagem_url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
      return result;
    }

    // 2. Tenta a Vercel Function (Fallback automático)
    const vercelRes = await fetch('/api/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeUsuario }),
    });

    if (vercelRes.ok) {
      const result = await vercelRes.json();
      result.autor = `Repórter: ${nomeUsuario}`;
      const encodedPrompt = encodeURIComponent(result.imagem_descricao + ", funny, high quality, vibrant");
      result.imagem_url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
      return result;
    }
    
    // Se deu erro em ambas as tentativas
    let errorMsg = "A viatura quebrou no caminho.";
    
    if (res.status !== 404) {
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
      } catch (e) {}
    } else if (vercelRes.status !== 404) {
      try {
        const data = await vercelRes.json();
        errorMsg = data.error || errorMsg;
      } catch (e) {}
    } else {
      errorMsg = "Serviço de IA não encontrado em nenhum servidor (404). Verifique o deploy.";
    }
    
    throw new Error(errorMsg);
  } catch (error: any) {
    console.error("Erro ao gerar:", error);
    throw error;
  }
}
