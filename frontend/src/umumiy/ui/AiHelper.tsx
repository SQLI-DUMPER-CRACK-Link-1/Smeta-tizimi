import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User } from 'lucide-react';
import { gas } from '../../api/client';
import { useObyektlar } from '../../api/hooks';
import ReactMarkdown from 'react-markdown';

type Message = {
  id: string;
  role: 'user' | 'ai';
  text: string;
  source?: string;
};

export function AiHelper() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text:
        'Salom! Men **Jarvis** — shu tizimning yordamchisiman.\n\n' +
        'Aniq raqam bilan javob beraman. Masalan:\n\n' +
        '- Amfiteatrda bu oy qancha fakt bajarildi?\n' +
        '- Qaysi obyektda F2 orqada qolgan?\n' +
        '- Suniy ko\'lda qoldiq qancha?',
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedObyekt, setSelectedObyekt] = useState<string>('');
  const { data: obyektlar } = useObyektlar();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Avtomatik obyekt tanlash
  useEffect(() => {
    if (!selectedObyekt && obyektlar?.length) {
      setSelectedObyekt(obyektlar[0].obyekt);
    }
  }, [obyektlar, selectedObyekt]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userText = input.trim();
    setInput('');
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      // History format: [{role: 'user', parts: [{text: '...'}]}, {role: 'model', parts: [{text: '...'}]}]
      const history = messages
        .filter(m => m.id !== '1') // ilk xabarni olib tashlaymiz
        .map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));

      const res = await gas<any>('apiTitanAi', {
        obyekt: selectedObyekt,
        text: userText,
        history: history,
        mode: 'auto'
      });

      /* ⚠️ GAS `{intent, text}` qaytaradi — `reply` EMAS. Avval `reply` qidirilgani
       * uchun topilmay, xom JSON ekranga chiqib qolgan edi («{"intent":"system",…}»
       * va ko'rinib qolgan `\n` belgilari). Endi to'g'ri maydon o'qiladi. */
      const aiText =
        typeof res === 'string'
          ? res
          : (res?.text || res?.reply || res?.javob || res?.error || 'Javob bo\'sh keldi');

      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: aiText,
        source: typeof res === 'object' ? res?.source : undefined
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: `Xatolik yuz berdi: ${err.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent/90 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-40 group"
        >
          <Bot size={26} />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-ok rounded-full border-2 border-bg"></span>
          
          {/* Tooltip */}
          <div className="absolute right-full mr-4 bg-surface-2 border border-border text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
            Jarvis AI
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden transform transition-all">
          {/* Header */}
          <div className="bg-surface-2 px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Jarvis AI</h3>
                <p className="text-xs text-text-dim flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok"></span> Online
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-text-dim hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Context Selector */}
          <div className="px-4 py-2 border-b border-border bg-surface flex items-center gap-2">
            <span className="text-xs text-text-dim">Kontekst:</span>
            <select 
              value={selectedObyekt}
              onChange={e => setSelectedObyekt(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Umumiy (obyektsiz)</option>
              {obyektlar?.map((o: any) => (
                <option key={o.obyekt} value={o.obyekt}>{o.obyekt}</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === 'user' ? 'bg-surface-2 text-text-dim' : 'bg-accent/20 text-accent'
                }`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user' 
                    ? 'bg-accent text-white rounded-tr-none' 
                    : 'bg-surface-2 text-text border border-border rounded-tl-none'
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                  {m.source && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-text-mute flex items-center justify-between">
                      <span>Manba: {m.source}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 flex-row">
                <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0">
                  <Bot size={16} />
                </div>
                <div className="bg-surface-2 text-text border border-border rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-dim animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-text-dim animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-text-dim animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-surface-2 border-t border-border">
            <div className="relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Xabaringizni yozing..."
                className="w-full bg-surface border border-border text-white text-sm rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-accent resize-none min-h-[44px] max-h-32"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 w-8 h-8 bg-accent text-white rounded-lg flex items-center justify-center hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-text-mute">
                AI xato qilishi mumkin. Moliya qarorlarida e'tiborli bo'ling.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
