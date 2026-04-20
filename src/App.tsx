import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import domtoimage from 'dom-to-image-more';
import LZString from 'lz-string';
import { getOcorrenciaFirestore, saveOcorrenciaFirestore } from './lib/firebase';
import { 
  Megaphone, 
  RefreshCw, 
  Copy, 
  Share2, 
  Link as LinkIcon,
  Download, 
  Newspaper, 
  User as UserIcon,
  AlertTriangle,
  History,
  Trash2,
  Loader2,
  Camera,
  MessageCircle,
  FileImage
} from 'lucide-react';
import { gerarOcorrencia, type Ocorrencia } from './lib/gemini';

export default function App() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [counter, setCounter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Ocorrencia[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showZapGuide, setShowZapGuide] = useState(false);
  const [pendingZapUrl, setPendingZapUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const resultRef = useRef<HTMLDivElement>(null);
  const newspaperRef = useRef<HTMLDivElement>(null);

  // --- CONFIGURAÇÃO DA URL (Derruba o link técnico e usa o da Vercel) ---
  // Se você definir VITE_SITE_URL nas variáveis de ambiente da Vercel, ele usará esse link.
  // Caso contrário, ele usa o link atual de onde o app está rodando.
  const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
  // -----------------------------------------------------------------

  const triggerCopied = (id: string) => {
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Convert external image to Base64 to bypass CORS
  useEffect(() => {
    if (ocorrencia?.imagem_url) {
      setLocalImageUrl(null);
      const convertToBase64 = async () => {
        try {
          const response = await fetch(ocorrencia.imagem_url!, { mode: 'no-cors' });
          // Note: with no-cors we can't actually read the body as a blob/base64 easily in some browsers
          // but we can try to use a standard fetch first.
          const res2 = await fetch(ocorrencia.imagem_url!); 
          const blob = await res2.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("CORS/Fetch error, using direct URL");
          return null;
        }
      };

      convertToBase64().then(url => {
        if (url) setLocalImageUrl(url);
      });
    }
  }, [ocorrencia?.imagem_url]);

  // Load from URL and localStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('d');
    const shortId = params.get('id');

    // Handle Short ID (Preferred)
    if (shortId) {
      setLoading(true);
      getOcorrenciaFirestore(shortId)
        .then(data => {
          if (data) {
            setOcorrencia(data as Ocorrencia);
            setIsSharedView(true);
          }
        })
        .catch(e => console.error('Erro ao carregar ID curto', e))
        .finally(() => setLoading(false));
    } 
    // Handle Legacy Compressed Data
    else if (sharedData) {
      try {
        const jsonString = LZString.decompressFromEncodedURIComponent(sharedData);
        if (jsonString) {
          const data = JSON.parse(jsonString);
          setOcorrencia(data);
          setIsSharedView(true);
        }
      } catch (e) {
        console.error('Erro ao decodificar link compartilhado', e);
      }
    }

    // Load History
    const saved = localStorage.getItem('marca_tone_history');
    if (saved) {
      try {
        setHistorico(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar histórico', e);
      }
    }
  }, []);

  const salvarNoHistorico = useCallback((nova: Ocorrencia) => {
    setHistorico(prev => {
      const atualizado = [nova, ...prev.slice(0, 19)]; // Keep last 20
      localStorage.setItem('marca_tone_history', JSON.stringify(atualizado));
      return atualizado;
    });
  }, []);

  const limparHistorico = () => {
    setHistorico([]);
    localStorage.removeItem('marca_tone_history');
    setConfirmDelete(false);
  };

  const handleGerar = async () => {
    if (!nomeUsuario.trim()) {
      setError('Por favor, digite seu nome de repórter!');
      return;
    }
    
    setLoading(true);
    setError(null);
    setIsSharedView(false);
    try {
      const nova = await gerarOcorrencia(nomeUsuario);
      const proximoCount = counter + 1;
      setOcorrencia(nova);
      setCounter(proximoCount);
      salvarNoHistorico(nova);

      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err: any) {
      console.error('Erro na geração:', err);
      let msg = err.message || 'Eita! A viatura quebrou no caminho. Tente gerar novamente.';
      
      if (msg.includes('configurada')) {
        msg = `ERRO DE CONFIGURAÇÃO: Nenhuma chave API foi encontrada. Verifique o painel "Environment Variables" na Vercel ou Netlify e se fez o Deploy novamente.`;
      } else if (msg === 'API_KEY_MISSING') {
        msg = 'ERRO DE CONFIGURAÇÃO: Nenhuma chave API foi encontrada. Verifique se você configurou GEMINI_API_KEY no painel de Environment Variables e se fez o Deploy.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getShortLink = async (data: Ocorrencia) => {
    try {
      const id = Math.random().toString(36).substring(2, 10);
      await saveOcorrenciaFirestore(id, data);
      return `${SITE_URL}${window.location.pathname}?id=${id}`;
    } catch (e) {
      console.error('Erro ao salvar no Firestore', e);
      // Fallback to legacy compressed link if firestore fails
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
      return `${SITE_URL}${window.location.pathname}?d=${compressed}`;
    }
  };

  const copiarLink = useCallback(async () => {
    if (!ocorrencia) return;
    setLoading(true);
    const shareUrl = await getShortLink(ocorrencia);
    setLoading(false);
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerCopied('link');
    } catch (err) {
      console.error(err);
      alert(`Não foi possível copiar automaticamente. Copie manualmente:\n\n${shareUrl}`);
    }
  }, [ocorrencia, triggerCopied]);

  const copiarTexto = useCallback(async () => {
    if (!ocorrencia) return;
    setLoading(true);
    const shareUrl = await getShortLink(ocorrencia);
    setLoading(false);

    const textoCompleto = `🗞️ ${ocorrencia.titulo.toUpperCase()}\n\n📝 HISTÓRICO DO FLAGRANTE:\n${ocorrencia.materia}\n\n✍️ ${ocorrencia.autor}\n\n🔗 LINK DA MATÉRIA: ${shareUrl}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textoCompleto);
        triggerCopied('texto');
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      console.error(err);
      alert('Seu navegador bloqueou a cópia automática. Tente compartilhar direto pelo botão do WhatsApp!');
    }
  }, [ocorrencia, triggerCopied]);

  const compartilharWhatsApp = useCallback(async () => {
    if (!ocorrencia) return;
    
    setLoading(true);
    const shareUrl = await getShortLink(ocorrencia);
    setLoading(false);

    const textoFinal = `Gere vc tambem a reportagem do meliante em: ${shareUrl}`;
    
    const escapedText = encodeURIComponent(textoFinal);
    const url = `https://api.whatsapp.com/send?text=${escapedText}`;
    window.open(url, '_blank');
  }, [ocorrencia]);

  const copiarImagem = useCallback(async () => {
    if (!newspaperRef.current) return;
    setCapturing(true);

    try {
      // Use dom-to-image-more for better quality and robustness
      const blob = await domtoimage.toBlob(newspaperRef.current, {
        bgcolor: '#f4ece1',
        width: newspaperRef.current.clientWidth,
        height: newspaperRef.current.clientHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      if (!blob) throw new Error('Não foi possível gerar a imagem');

      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 
          'image/png': blob,
          'text/plain': new Blob([`Gere vc tambem a reportagem do meliante em: ${SITE_URL}`], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
        triggerCopied('imagem');
      } else {
        throw new Error('Clipboard API not supported');
      }
    } catch (err: any) {
      console.error('Erro ao capturar para clipboard:', err);
      alert('A cópia direta falhou no seu navegador. Use o botão "Baixar Capa (PNG)" e anexe o arquivo no WhatsApp!');
    } finally {
      setCapturing(false);
    }
  }, [triggerCopied]);

  const compartilharCompleto = useCallback(async () => {
    if (!newspaperRef.current || !ocorrencia) return;
    setCapturing(true);
    setError(null);

    try {
      const shareUrl = await getShortLink(ocorrencia);
      const textoFinal = `Gere vc tambem a reportagem do meliante em: ${shareUrl}`;
      
      const blob = await domtoimage.toBlob(newspaperRef.current, {
        bgcolor: '#f4ece1',
        width: newspaperRef.current.clientWidth,
        height: newspaperRef.current.clientHeight
      });

      if (!blob) throw new Error('Não foi possível gerar a imagem');

      // Detecta se é mobile (para decidir entre Share API e Clipboard + Redirect)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'a.png', {type:'image/png'})] })) {
        // Celular: Share API funciona perfeitamente com ambos
        const file = new File([blob], 'capa-jornal.png', { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Flagrante no Jornal do Vexame',
          text: textoFinal,
        });
      } else {
        // Desktop (Windows/Mac): Melhor fluxo possível
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            // 1. Copia APENAS a imagem para a memória (para não dar conflito com o link)
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            triggerCopied('zap');
          } catch (clipErr) {
            console.error('Falha ao copiar imagem:', clipErr);
          }
          
          // 2. Prepara a URL mas NÃO abre ainda
          const zapUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoFinal)}`;
          setPendingZapUrl(zapUrl);
          
          // 3. Mostra o Guia de Ajuda Visual primeiro
          setShowZapGuide(true);
        } else {
          // Fallback se o navegador for antigo
          await navigator.clipboard.writeText(textoFinal);
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textoFinal)}`, '_blank');
        }
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
      // Fallback para o usuário não ficar na mão
      window.open(`https://api.whatsapp.com/send?text=Gere vc tambem a reportagem do meliante: ${SITE_URL}`, '_blank');
    } finally {
      setCapturing(false);
    }
  }, [ocorrencia, triggerCopied, SITE_URL]);

  const baixarCapa = useCallback(async () => {
    if (!newspaperRef.current) return;
    setCapturing(true);

    try {
      const dataUrl = await domtoimage.toPng(newspaperRef.current, {
        bgcolor: '#f4ece1',
        width: newspaperRef.current.clientWidth,
        height: newspaperRef.current.clientHeight
      });

      const link = document.createElement('a');
      link.download = `capa-noticia-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
      triggerCopied('baixar');
    } catch (err) {
      console.error('Erro ao baixar:', err);
      alert('Erro ao gerar arquivo. Tente tirar um print da tela!');
    } finally {
      setCapturing(false);
    }
  }, [triggerCopied]);

  const abrirWhatsApp = useCallback(() => {
    window.open('https://web.whatsapp.com/', '_blank');
  }, []);

  const baixarImagem = useCallback(() => {
    if (!ocorrencia?.imagem_url) return;
    window.open(ocorrencia.imagem_url, '_blank');
  }, [ocorrencia]);

  const getPortalStyles = () => {
    if (!ocorrencia) return { container: '', header: '', title: '', body: '' };
    
    // Normalização do tema para evitar erros de case
    const tema = (ocorrencia.estilo?.temaPortal || '').toUpperCase().trim();
    
    if (tema === 'PORTAL_MODERNO') {
      return {
        container: 'bg-neutral-50 rounded-xl overflow-hidden shadow-xl border border-neutral-200',
        header: 'bg-neutral-900 text-white p-4 font-sans font-bold flex justify-between items-center',
        title: 'text-4xl md:text-6xl font-sans font-extrabold text-neutral-900 p-8 tracking-tight border-b border-neutral-200 font-sans',
        body: 'p-8 font-sans text-2xl text-neutral-700 leading-relaxed max-w-4xl mx-auto'
      };
    }
    
    if (tema === 'BLOG_FOFOCA') {
      return {
        container: 'bg-[#fff] border-x-8 border-pink-500 shadow-lg relative',
        header: 'bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 font-display text-center uppercase tracking-[0.3em] text-xl',
        title: 'text-3xl md:text-5xl font-serif font-black italic text-pink-600 p-8 text-center drop-shadow-sm leading-tight font-serif',
        body: 'p-8 font-serif italic text-2xl text-neutral-800 leading-relaxed'
      };
    }

    if (tema.includes('PINGA-SANGUE') || tema.includes('DIÁRIO') || tema.includes('FLAGRANTE')) {
      return {
        container: 'bg-[#fcf8f2] border-4 border-red-900 shadow-[12px_12px_0px_0px_#450a0a] paper-grain',
        header: 'bg-red-900 text-white p-4 font-black uppercase text-center tracking-[0.2em] text-2xl animate-flash-red',
        title: 'text-4xl md:text-6xl font-sans font-black uppercase leading-tight text-center p-8 border-b-4 border-red-200 text-red-900 italic font-sans',
        body: 'p-8 md:p-12 font-serif text-3xl text-neutral-900 leading-[1.6] text-left gap-8 selection:bg-red-200'
      };
    }

    // Default: tabloide_classico ou qualquer outro
    return {
      container: 'bg-[#f4ece1] border-4 border-neutral-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] paper-grain',
      header: 'bg-neutral-900 text-white p-3 font-display uppercase text-center tracking-widest',
      title: 'text-4xl md:text-7xl font-serif font-black uppercase leading-[0.85] text-center p-8 border-b-2 border-neutral-300 mx-4 font-serif',
      body: 'p-8 md:columns-1 font-serif text-2xl text-neutral-900 leading-normal text-justify'
    };
  };

  const portal = getPortalStyles();

  return (
    <div className="min-h-screen px-4 py-8 md:py-12 bg-neutral-100 font-sans flex flex-col items-center paper-grain">
      {/* App Header */}
      <header className="w-full max-w-4xl flex flex-col items-center text-center mb-12 relative">
        <div className="flex w-full justify-between items-center mb-6">
          <div className="w-10"></div>
          <h1 className="text-3xl md:text-5xl font-black uppercase leading-none tracking-tighter text-neutral-900 drop-shadow-md">
            Ocorrências de <span className="text-red-600">Marca & Tone</span>
          </h1>
          <button 
            onClick={() => setShowHistory(true)}
            className="p-3 bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-y-1 active:shadow-none transition-all relative"
            title="Histórico"
          >
            <History size={20} />
            {historico.length > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-neutral-900 font-bold">
                {historico.length}
              </span>
            )}
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-2 w-full max-w-2xl">
          <div className="h-px bg-neutral-300 flex-1"></div>
          <p className="text-neutral-500 font-bold uppercase text-[10px] tracking-[0.3em]">Gerador de Vergonha Alheia</p>
          <div className="h-px bg-neutral-300 flex-1"></div>
        </div>

        {isSharedView && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-6 p-4 bg-yellow-400 border-2 border-neutral-900 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3"
          >
            <Newspaper size={20} />
            <span>Você está vendo uma matéria compartilhada!</span>
            <button 
              onClick={() => {
                setOcorrencia(null);
                setIsSharedView(false);
                window.history.replaceState({}, '', window.location.pathname);
              }}
              className="ml-4 px-3 py-1 bg-neutral-900 text-white hover:bg-red-600 text-xs"
            >
              CRIAR MINHA PRÓPRIA
            </button>
          </motion.div>
        )}
      </header>

      {/* Control Panel */}
      <div className={`w-full max-w-xl bg-white border-2 border-neutral-900 p-8 mb-16 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group transition-all ${isSharedView ? 'hidden' : 'block'}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rotate-45 -mr-16 -mt-16 border-b-2 border-neutral-900 transition-transform group-hover:scale-110"></div>
        
        <div className="relative z-10 space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-neutral-500 flex items-center gap-2">
              <UserIcon size={14} className="text-red-600" />
              Seu Nick de Repórter
            </label>
            <input 
              type="text" 
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder="Ex: Tino Marcos"
              className="w-full p-4 border-2 border-neutral-900 bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-yellow-400/50 font-black text-xl placeholder:opacity-20"
            />
          </div>

          <button 
            onClick={handleGerar}
            disabled={loading}
            className="w-full group relative bg-neutral-900 hover:bg-red-600 text-white p-6 border-2 border-neutral-900 transition-all active:translate-y-2 active:shadow-none font-black uppercase tracking-widest text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3"><Loader2 className="animate-spin" size={24} /> RODANDO PRENSA...</span>
            ) : (
              <span className="flex items-center justify-center gap-3"><Megaphone /> GERAR OCORRÊNCIA</span>
            )}
          </button>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-red-50 text-red-600 border-l-4 border-red-600 flex items-center gap-3 text-sm font-bold uppercase shadow-sm"
            >
              <AlertTriangle size={18} /> {error}
            </motion.div>
          )}
        </div>
      </div>

      {/* Portal Display */}
      <AnimatePresence mode="wait">
        {ocorrencia && (
          <motion.div 
            key={ocorrencia.titulo}
            initial={{ opacity: 0, y: 50, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.98 }}
            className="w-full max-w-4xl mb-24"
            ref={resultRef}
          >
            <div ref={newspaperRef} className={`${portal.container} min-h-[600px] flex flex-col`}>
              {/* Portal Header */}
              <div className={portal.header}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white text-neutral-900 rounded flex items-center justify-center font-black">
                    {(ocorrencia.nomeJornal || 'J').charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[200px] md:max-w-none">
                    {(ocorrencia.nomeJornal || 'Jornal do Flagrante').toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block text-[10px] font-mono tracking-tighter opacity-70">
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {new Date().toLocaleTimeString()}
                </div>
              </div>

              {/* Title Content */}
              <h2 className={portal.title}>
                {ocorrencia.titulo || 'Meliante é flagrado em situação suspeita!'}
              </h2>

              {/* Image Section */}
              <div className="p-4 md:p-8 flex-shrink-0">
                <div className="bg-neutral-100 border-2 border-neutral-900 relative aspect-square overflow-hidden shadow-inner group flex items-center justify-center min-h-[300px]">
                  {(localImageUrl || ocorrencia.imagem_url) ? (
                    <img 
                      src={localImageUrl || ocorrencia.imagem_url!} 
                      alt="Flagrante Policial" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="eager"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('model=turbo')) {
                          console.warn('Erro na imagem FLUX, tentando fallback Turbo...');
                          target.src = target.src.replace('model=flux', 'model=turbo');
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-400 bg-neutral-100">
                      <Loader2 className="animate-spin" size={40} />
                      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Revelando Foto...</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg transform -rotate-1 z-10">
                    Exclusivo
                  </div>
                </div>
                <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <p className="text-xs font-mono text-neutral-700 text-center uppercase leading-relaxed flex flex-col items-center justify-center gap-2">
                    <span className="flex items-center gap-2 font-bold tracking-wide">
                      <AlertTriangle size={14} className="text-red-600" /> 
                      LOCAL: {ocorrencia.localInventado || 'Salvador, BA'}
                    </span>
                    <span className="opacity-80">
                      MELIANTE: MARCA & TONE (FLAGRANTE)
                    </span>
                  </p>
                </div>
              </div>

              {/* News Text */}
              <div className={portal.body}>
                <p className="whitespace-pre-wrap first-letter:text-7xl first-letter:font-black first-letter:float-left first-letter:mr-4 first-letter:mt-2">
                  {ocorrencia.materia || 'A polícia ainda está apurando os fatos do ocorrido...'}
                </p>
                
                {/* Author Stamp */}
                <div className="mt-12 pt-8 border-t-2 border-dashed border-neutral-300 flex flex-col justify-center items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-neutral-900 text-white rounded-full flex items-center justify-center font-black text-3xl shadow-lg border-2 border-white">
                      {(ocorrencia.autor || 'R').split(': ')[1]?.charAt(0).toUpperCase() || 'R'}
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase text-red-600 tracking-widest mb-1">Repórter do Vexame</span>
                      <span className="font-black text-xl tracking-tighter text-neutral-900 border-b-2 border-yellow-400 px-1">{ocorrencia.autor || 'Repórter Anônimo'}</span>
                    </div>
                  </div>
                  
                  {/* Disclaimer and App Link inside image */}
                  <div className="mt-8 text-center space-y-4">
                    <div className="bg-yellow-400 px-6 py-4 border-2 border-neutral-900 transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(185,28,28,1)]">
                      <p className="font-black text-xs md:text-sm uppercase tracking-tighter text-neutral-900 mb-1 leading-tight">
                        Gere vc tambem a reportagem do meliante em:
                      </p>
                      <p className="text-sm md:text-base font-black text-red-600 underline decoration-2 tracking-widest">
                        {SITE_URL.replace('https://', '').replace('http://', '')}
                      </p>
                    </div>
                    <p className="text-[10px] font-medium text-neutral-500 italic max-w-xs mx-auto leading-tight opacity-70">
                      * Marca & Tone é um personagem fictício e qualquer relação com a vida real é mera coincidência.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Painel de Ações Simplificado */}
            <div className="mt-12 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                <button 
                  onClick={compartilharCompleto}
                  disabled={capturing}
                  className={`flex flex-col items-center justify-center gap-2 bg-[#25D366] text-black border-4 border-black px-6 py-6 font-black uppercase tracking-tighter text-sm hover:bg-[#20bd5a] transition-all shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none`}
                >
                  {capturing ? <Loader2 className="animate-spin" /> : <MessageCircle size={32} />} 
                  <span className="text-lg">Enviar p/ WhatsApp</span>
                </button>
                
                <button 
                  onClick={baixarCapa}
                  disabled={capturing}
                  className={`flex flex-col items-center justify-center gap-2 bg-white text-black border-4 border-black px-6 py-6 font-black uppercase tracking-tighter text-sm hover:bg-neutral-100 transition-all shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50`}
                >
                  {capturing ? <Loader2 className="animate-spin" /> : <Download size={32} />} 
                  <span className="text-lg">{copiedStates.baixar ? 'BAIXADO!' : 'Baixar PNG'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Site Footer consolidated */}
      <footer className="mt-20 pt-16 pb-12 px-6 border-t font-mono text-[10px] text-neutral-400 text-center uppercase tracking-[0.2em] bg-white w-full">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="bg-neutral-900 text-white px-4 py-2 font-black rotate-1 skew-x-3">
              PORTAL MARCA & TONE
            </div>
            <p className="font-black text-red-600 tracking-[0.3em]">
              GERE VC TAMBÉM A REPORTAGEM EM: {SITE_URL.replace('https://', '').replace('http://', '').toUpperCase()}
            </p>
          </div>
          
          <div className="flex justify-center gap-6 opacity-60">
            <a href="/" className="hover:text-red-600 transition-colors">INÍCIO</a>
            <span>•</span>
            <a href="#gerar" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="hover:text-red-600 transition-colors">GERAR B.O.</a>
            <span>•</span>
            <span className="text-neutral-300">{SITE_URL}</span>
          </div>

          <p className="max-w-md mx-auto leading-relaxed border-t border-neutral-100 pt-6 italic opacity-50">
            Atenção: Este site é uma obra de ficção. Marca & Tone é um personagem humorístico. 
            Qualquer semelhança com pessoas reais é mera coincidência fictícia.
          </p>
          
          <p className="font-black opacity-30 mt-8">© 2026 - TUDO PELO CLICK E PELA VERGONHA</p>
        </div>
      </footer>

      {/* Empty State */}
      {!ocorrencia && !loading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-neutral-400 mt-20 max-w-sm px-6"
        >
          <div className="bg-white w-28 h-28 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl border-4 border-neutral-100 rotate-3">
            <Newspaper size={56} className="text-neutral-200" />
          </div>
          <p className="font-black uppercase tracking-widest text-xs mb-2 text-neutral-500">Nenhum B.O. registrado</p>
          <p className="font-sans text-sm italic">
            O Marca & Tone deve estar aprontando um novo "kao" agora mesmo. Digite seu nome acima e registre o flagrante!
          </p>
        </motion.div>
      )}
      {/* History Slide-over */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[60] shadow-2xl overflow-y-auto paper-grain border-l-4 border-neutral-900"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <History className="text-red-600" /> Histórico de B.O.s
                  </h2>
                  <button onClick={() => setShowHistory(false)} className="bg-neutral-900 text-white p-2">FECHAR</button>
                </div>

                {historico.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <Newspaper size={48} className="mx-auto mb-4" />
                    <p className="font-bold uppercase text-xs">A ficha dele está limpa... por enquanto.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historico.map((h, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setOcorrencia(h);
                          setShowHistory(false);
                          setIsSharedView(false);
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }}
                        className="group bg-neutral-50 border-2 border-neutral-200 p-4 hover:border-red-600 cursor-pointer transition-all flex gap-4"
                      >
                        <img 
                          src={h.imagem_url} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 object-cover border border-neutral-300" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-black text-red-600 uppercase mb-1">{h.nomeJornal}</p>
                          <h3 className="text-sm font-black uppercase leading-tight truncate mb-1">{h.titulo}</h3>
                          <p className="text-[10px] text-neutral-500 line-clamp-2 leading-tight">{h.materia}</p>
                        </div>
                      </div>
                    ))}
                    
                    {confirmDelete ? (
                      <div className="mt-8 p-6 bg-red-50 border-2 border-red-600 space-y-4">
                        <p className="text-xs font-black uppercase text-red-600 text-center">Tem certeza? Isso vai apagar todas as fichas criminais!</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={limparHistorico}
                            className="flex-1 p-3 bg-red-600 text-white font-black uppercase text-[10px]"
                          >
                            SIM, APAGAR TUDO
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(false)}
                            className="flex-1 p-3 bg-neutral-900 text-white font-black uppercase text-[10px]"
                          >
                            CANCELAR
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                        className="w-full mt-8 p-4 text-xs font-bold uppercase text-red-600 border-2 border-dashed border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} /> Apagar Todas as Ocorrências
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* GUIA DE COMPARTILHAMENTO WHATSAPP (DESKTOP) */}
      <AnimatePresence>
        {showZapGuide && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#f4ece1] border-4 border-black p-6 max-w-md w-full shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] relative"
            >
              <button 
                onClick={() => {
                  setShowZapGuide(false);
                  setPendingZapUrl(null);
                }}
                className="absolute -top-4 -right-4 bg-red-600 text-white w-10 h-10 rounded-none border-2 border-black flex items-center justify-center font-black hover:bg-red-700 transition-colors z-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                X
              </button>
              
              <div className="space-y-6 text-black">
                <div className="text-center">
                  <div className="bg-yellow-400 border-2 border-black py-1 px-3 inline-block mb-2 font-black text-xs uppercase tracking-widest">
                    Atenção Repórter!
                  </div>
                  <h3 className="font-serif text-3xl font-black uppercase tracking-tighter leading-none mb-4">
                    📢 Quase Pronto!
                  </h3>
                  <p className="text-sm font-bold leading-tight opacity-80">
                    O WhatsApp abriu com o link. Agora você só precisa colar a foto do jornal na conversa!
                  </p>
                </div>

                <div className="bg-white/60 border-2 border-black p-5 space-y-5 shadow-inner">
                  <div className="flex items-start gap-4">
                    <div className="bg-black text-white w-7 h-7 flex-shrink-0 flex items-center justify-center font-black text-sm">1</div>
                    <p className="text-[13px] font-bold">Vá para a aba do <span className="text-green-700 uppercase">WhatsApp</span> que abriu.</p>
                  </div>
                  
                  <div className="flex items-start gap-4 border-y-2 border-black/10 py-4">
                    <div className="bg-black text-white w-7 h-7 flex-shrink-0 flex items-center justify-center font-black text-sm">2</div>
                    <div>
                      <p className="text-[13px] font-bold">Clique na conversa e aperte:</p>
                      <div className="flex items-center gap-2 mt-2">
                        <kbd className="bg-neutral-800 text-white border-b-4 border-black px-3 py-1 rounded font-mono text-sm font-bold">CTRL</kbd>
                        <span className="font-black text-xl">+</span>
                        <kbd className="bg-neutral-800 text-white border-b-4 border-black px-3 py-1 rounded font-mono text-sm font-bold">V</kbd>
                      </div>
                      <p className="text-[10px] mt-2 italic opacity-60">(Se for Mac, use Command + V)</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-black text-white w-7 h-7 flex-shrink-0 flex items-center justify-center font-black text-sm">3</div>
                    <p className="text-[13px] font-bold text-red-600">A FOTO APARECERÁ! AÍ É SÓ DAR <span className="underline decoration-double">ENTER</span>.</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (pendingZapUrl) window.open(pendingZapUrl, '_blank');
                    setShowZapGuide(false);
                    setPendingZapUrl(null);
                  }}
                  className="w-full bg-[#25D366] text-black font-black py-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase text-lg tracking-tighter"
                >
                  ENTENDI, ABRIR WHATSAPP 🚀
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
