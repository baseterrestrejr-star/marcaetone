import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Loader2
} from 'lucide-react';
import { gerarOcorrencia, type Ocorrencia } from './lib/gemini';

export default function App() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Ocorrencia[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

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
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?id=${id}`;
    } catch (e) {
      console.error('Erro ao salvar no Firestore', e);
      // Fallback to legacy compressed link if firestore fails
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
      return `${window.location.origin + window.location.pathname}?d=${compressed}`;
    }
  };

  const copiarLink = useCallback(async () => {
    if (!ocorrencia) return;
    setLoading(true);
    const shareUrl = await getShortLink(ocorrencia);
    setLoading(false);
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link curto da ocorrência copiado! Agora é só colar no Zap. 🔗');
    } catch (err) {
      console.error(err);
    }
  }, [ocorrencia]);

  const copiarTexto = useCallback(async () => {
    if (!ocorrencia) return;
    setLoading(true);
    const shareUrl = await getShortLink(ocorrencia);
    setLoading(false);

    try {
      const textoCompleto = `🗞️ ${ocorrencia.titulo.toUpperCase()}\n\n📝 HISTÓRICO DO FLAGRANTE:\n${ocorrencia.materia}\n\n✍️ ${ocorrencia.autor}\n\n🔗 LINK DA MATÉRIA: ${shareUrl}`;
      await navigator.clipboard.writeText(textoCompleto);
      alert('Matéria completa (texto + link curto) copiada! 🗞️');
    } catch (err) {
      console.error(err);
    }
  }, [ocorrencia]);

  const compartilharWhatsApp = useCallback(async () => {
    if (!ocorrencia) return;
    
    setLoading(true);
    const shareUrl = await getShortLink(ocorrencia);
    setLoading(false);

    // WhatsApp prefere o link no final para gerar o preview corretamente
    // e o link precisa estar isolado para ser clicável
    const textoFinal = `🚨 *VEXAME DO MELIANTE MARCA & TONE* 🚨\n\n🗞️ *${ocorrencia.titulo}*\n\n🕵️‍♂️ _Gere você também a sua ocorrência no portal!_\n\n👉 *CLIQUE PARA VER A MATÉRIA:* \n${shareUrl}`;
    
    const escapedText = encodeURIComponent(textoFinal);
    const url = `https://api.whatsapp.com/send?text=${escapedText}`;
    window.open(url, '_blank');
  }, [ocorrencia]);

  const baixarImagem = useCallback(() => {
    if (!ocorrencia?.imagem_url) return;
    window.open(ocorrencia.imagem_url, '_blank');
  }, [ocorrencia]);

  const getPortalStyles = () => {
    if (!ocorrencia) return { container: '', header: '', title: '', body: '' };
    
    switch (ocorrencia.estilo.temaPortal) {
      case 'noticias_pop':
        return {
          container: 'bg-white border-t-8 border-red-600 shadow-2xl relative overflow-hidden',
          header: 'bg-red-600 text-white p-2 font-black italic tracking-tighter uppercase text-3xl flex justify-between items-center',
          title: 'text-3xl md:text-5xl font-sans font-black leading-tight text-neutral-900 px-4 py-6 text-center underline decoration-red-600 decoration-4 underline-offset-8',
          body: 'px-6 py-8 md:columns-2 font-sans text-lg text-neutral-800 leading-relaxed gap-10'
        };
      case 'portal_moderno':
        return {
          container: 'bg-neutral-50 rounded-xl overflow-hidden shadow-xl border border-neutral-200',
          header: 'bg-neutral-900 text-white p-4 font-sans font-bold flex justify-between items-center',
          title: 'text-4xl md:text-6xl font-sans font-extrabold text-neutral-900 p-8 tracking-tight border-b border-neutral-200',
          body: 'p-8 font-sans text-xl text-neutral-700 leading-relaxed max-w-4xl mx-auto'
        };
      case 'blog_fofoca':
        return {
          container: 'bg-[#fff] border-x-8 border-pink-500 shadow-lg relative',
          header: 'bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 font-display text-center uppercase tracking-[0.3em] text-xl',
          title: 'text-3xl md:text-5xl font-serif font-black italic text-pink-600 p-8 text-center drop-shadow-sm leading-tight',
          body: 'p-8 font-serif italic text-xl text-neutral-800 leading-relaxed'
        };
      default: // tabloide_classico
        return {
          container: 'bg-[#f4ece1] border-4 border-neutral-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] paper-grain',
          header: 'bg-neutral-900 text-white p-3 font-display uppercase text-center tracking-widest',
          title: 'text-4xl md:text-7xl font-serif font-black uppercase leading-[0.85] text-center p-8 border-b-2 border-neutral-300 mx-4',
          body: 'p-8 md:columns-2 font-serif text-xl text-neutral-900 leading-normal text-justify gap-8'
        };
    }
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
          >
            <div className={portal.container}>
              {/* Portal Header */}
              <div className={portal.header}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white text-neutral-900 rounded flex items-center justify-center font-black">
                    {ocorrencia.nomeJornal.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[200px] md:max-w-none">
                    {ocorrencia.nomeJornal.toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block text-[10px] font-mono tracking-tighter opacity-70">
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {new Date().toLocaleTimeString()}
                </div>
              </div>

              {/* Title Content */}
              <h2 className={portal.title}>
                {ocorrencia.titulo}
              </h2>

              {/* Image Section */}
              <div className="p-4 md:p-8">
                <div className="bg-neutral-200 border-2 border-neutral-900 relative aspect-video overflow-hidden shadow-inner group">
                  {ocorrencia.imagem_url ? (
                    <img 
                      src={ocorrencia.imagem_url} 
                      alt="Flagrante" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-400 bg-neutral-100">
                      <Loader2 className="animate-spin" size={40} />
                      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Processando Flagrante...</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg transform -rotate-1">
                    Exclusivo
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <p className="text-white text-[10px] font-bold uppercase tracking-wide">
                      Registro do momento exato em que Marca & Tone percebe que a casa caiu
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <p className="text-xs font-mono text-neutral-700 text-center uppercase leading-relaxed flex flex-col items-center justify-center gap-2">
                    <span className="flex items-center gap-2 font-bold tracking-wide">
                      <AlertTriangle size={14} className="text-red-600" /> 
                      LOCAL: {ocorrencia.localInventado}
                    </span>
                    <span className="opacity-80">
                      MELIANTE: MARCA & TONE (HOMEM NEGRO DE BONÉ) EM FLAGRANTE
                    </span>
                    <span className="mt-1 text-[10px] italic font-sans text-neutral-500 border-t border-neutral-200 pt-2 w-full max-w-[280px]">
                      Nota: As imagens acima são meramente demonstrativas para não gerar constrangimento desnecessário ao meliante.
                    </span>
                  </p>
                </div>
              </div>

              {/* News Text */}
              <div className={portal.body}>
                <p className="whitespace-pre-wrap first-letter:text-6xl first-letter:font-black first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                  {ocorrencia.materia}
                </p>
                
                {/* Author Stamp */}
                <div className="mt-16 pt-8 border-t-2 border-dashed border-neutral-200 flex flex-col md:flex-row justify-center items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white">
                      {ocorrencia.autor.split(': ')[1]?.charAt(0).toUpperCase() || 'R'}
                    </div>
                    <div>
                      <span className="block text-[8px] font-black uppercase text-red-600 tracking-widest mb-1">Repórter Especialista em Kao</span>
                      <span className="font-black text-lg tracking-tighter text-neutral-900 border-b-2 border-yellow-400">{ocorrencia.autor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button 
                onClick={copiarLink}
                className="flex items-center justify-center gap-3 bg-white border-2 border-neutral-900 px-8 py-5 font-black uppercase tracking-widest text-xs hover:bg-yellow-400 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
              >
                <LinkIcon size={20} /> Copiar Link Curto
              </button>
              <button 
                onClick={copiarTexto}
                className="flex items-center justify-center gap-3 bg-white border-2 border-neutral-900 px-8 py-5 font-black uppercase tracking-widest text-xs hover:bg-neutral-900 hover:text-white transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
              >
                <Copy size={20} /> Matéria + Link
              </button>
              <button 
                onClick={compartilharWhatsApp}
                className="flex items-center justify-center gap-3 bg-green-500 text-white border-2 border-neutral-900 px-8 py-5 font-black uppercase tracking-widest text-xs hover:bg-green-600 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
              >
                <Share2 size={20} /> Mandar pro Zap
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Footer */}
      <footer className="mt-auto pt-24 pb-12 text-neutral-400 text-[9px] font-black uppercase tracking-[0.4em] text-center w-full max-w-4xl border-t border-neutral-200">
        © 2026 PORTAL DE OCORRÊNCIAS MARCA & TONE — TUDO PELO CLICK E PELA VERGONHA
      </footer>
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
    </div>
  );
}
