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
      const styleSuffix = ", Pixar 3D animation style, Disney movie look, highly detailed, vivid colors, cinematic lighting, funny expressions, 8k resolution";
      const encodedPrompt = encodeURIComponent(result.imagem_descricao + styleSuffix);
      result.imagem_url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
      return result;
    }

    // 2. Tenta a Vercel Function (Fallback automático)
    let vercelRes;
    try {
      vercelRes = await fetch('/api/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeUsuario }),
      });
    } catch (e: any) {
      throw new Error(`Falha de conexão com o servidor da Vercel: ${e.message}`);
    }

    if (vercelRes.ok) {
      const result = await vercelRes.json();
      result.autor = `Repórter: ${nomeUsuario}`;
      const styleSuffix = ", Pixar 3D animation style, Disney movie look, highly detailed, vivid colors, cinematic lighting, funny expressions, 8k resolution";
      const encodedPrompt = encodeURIComponent(result.imagem_descricao + styleSuffix);
      result.imagem_url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
      return result;
    }
    
    // Se deu erro em ambas as tentativas, vamos extrair o máximo de info possível
    let errorMsg = `Erro no Servidor.`;
    
    try {
      const statusText = vercelRes.status;
      const responseText = await vercelRes.text();
      try {
        const data = JSON.parse(responseText);
        errorMsg = data.error || `Erro ${statusText}: ${responseText.substring(0, 100)}`;
      } catch (e) {
        errorMsg = `Erro ${statusText} na Vercel: ${responseText.substring(0, 100) || 'Sem resposta do servidor'}`;
      }
    } catch (e) {
      errorMsg = "O servidor da Vercel não respondeu corretamente.";
    }
    
    throw new Error(errorMsg);
  } catch (error: any) {
    console.error("Erro ao gerar:", error);
    throw error;
  }
}
