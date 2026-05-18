import { useState, useRef, useEffect } from "react";
import { fetchApi } from "../api";
import { Send, Bot, Languages, MessageCircle } from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";

export default function ChatTutor({ studentLevel, ageGroup }: { studentLevel?: string, ageGroup?: string }) {
  const [mode, setMode] = useState<"translation" | "free">("translation");
  const [messages, setMessages] = useState<{ role: "student" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // When mode changes, we don't save dialogs as per requirements, so we clear them.
  useEffect(() => {
    setMessages([]);
  }, [mode]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Add student message immediately
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "student", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetchApi("/chat", {
        method: "POST",
        body: JSON.stringify({ prompt: userMsg, mode, studentLevel: mode === 'translation' ? undefined : studentLevel, ageGroup: mode === 'translation' ? undefined : ageGroup }),
      });
      setMessages(prev => [...prev, { role: "ai", text: res.reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "ai", text: "Ошибка: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx(
      "max-w-4xl mx-auto h-[80vh] flex flex-col rounded-xl border overflow-hidden",
      mode === "translation" ? "bg-[#eff6ff] border-blue-200" : "bg-[#0f172a] border-slate-700"
    )}>
      
      {/* Header and Mode Selector */}
      <div className={clsx(
        "p-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 border-b",
        mode === "translation" ? "bg-blue-50/50 border-blue-100" : "bg-slate-900 border-slate-800"
      )}>
        <div>
          <h2 className={clsx(
            "font-bold text-xs uppercase tracking-wider flex items-center gap-2",
            mode === "translation" ? "text-blue-900" : "text-slate-300"
          )}>
            <Bot className="w-4 h-4" />
            AI Помощник <span className={clsx("text-[10px] px-2 py-0.5 rounded font-bold", mode === "translation" ? "bg-blue-100 text-blue-700" : "bg-slate-800 text-slate-400")}>Level {studentLevel || 'A2'}</span>
          </h2>
        </div>
        
        <div className={clsx("flex p-1 rounded-lg", mode === "translation" ? "bg-blue-100/50" : "bg-slate-800")}>
          <button 
            onClick={() => setMode("translation")}
            className={clsx("flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded transition-colors", mode === "translation" ? "bg-white shadow-sm text-blue-700 border border-blue-200" : "text-slate-400 hover:text-slate-200 border border-transparent")}
          >
            <Languages className="w-3.5 h-3.5" /> Быстрый перевод
          </button>
          <button 
            onClick={() => setMode("free")}
            className={clsx("flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded transition-colors", mode === "free" ? "bg-slate-700 shadow-sm text-white border border-slate-600" : "text-blue-600/70 hover:text-blue-800 border border-transparent")}
          >
            <MessageCircle className="w-3.5 h-3.5" /> Свободный чат
          </button>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <Bot className={clsx("w-12 h-12 opacity-50", mode === "translation" ? "text-blue-300" : "text-slate-600")} />
            <p className={clsx("text-sm", mode === "translation" ? "text-blue-700/70" : "text-slate-400")}>
              {mode === "translation" 
                ? "Отправьте слово или фразу для получения перевода и примеров согласно вашему уровню." 
                : "Задавайте любые вопросы по грамматике, словарному запасу или общайтесь на английском!"}
            </p>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={clsx("flex", m.role === "student" ? "justify-end" : "justify-start")}>
            <div className={clsx(
              "max-w-[85%] md:max-w-[75%] p-3 text-sm leading-relaxed",
              m.role === "student" && mode === "translation" && "bg-blue-600 text-white rounded-lg rounded-tr-none",
              m.role === "ai" && mode === "translation" && "bg-white border border-blue-100 text-slate-700 rounded-lg rounded-tl-none",
              m.role === "student" && mode === "free" && "bg-blue-900 text-blue-100 rounded-lg",
              m.role === "ai" && mode === "free" && "bg-slate-800 text-slate-300 rounded-lg"
            )}>
              {m.role === "ai" ? (
                <div className="markdown-body">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className={clsx("p-3 rounded-lg rounded-tl-none flex gap-1 items-center", mode === "translation" ? "bg-white border border-blue-100" : "bg-slate-800")}>
              <span className={clsx("w-1.5 h-1.5 rounded-full animate-bounce", mode === "translation" ? "bg-blue-400" : "bg-slate-500")}></span>
              <span className={clsx("w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s]", mode === "translation" ? "bg-blue-400" : "bg-slate-500")}></span>
              <span className={clsx("w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s]", mode === "translation" ? "bg-blue-400" : "bg-slate-500")}></span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <div className={clsx("p-4 shrink-0", mode === "translation" ? "bg-transparent" : "bg-[#0f172a]")}>
        <form 
          onSubmit={e => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2 relative"
        >
          <input
            type="text"
            className={clsx(
              "w-full rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-2",
              mode === "translation" 
                ? "bg-white border border-blue-200 focus:ring-blue-500 text-slate-800 placeholder:text-slate-400 shadow-sm" 
                : "bg-slate-800 border border-slate-700 focus:ring-blue-500 text-white placeholder:text-slate-500"
            )}
            placeholder={mode === "translation" ? "Введите слово/фразу..." : "Задать вопрос ИИ..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className={clsx(
              "absolute right-2 top-1.5 p-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg",
               mode === "translation" ? "text-blue-500 hover:text-blue-600" : "text-slate-400 hover:text-white"
            )}
          >
            {mode === "translation" ? "✈️" : "⏎"}
          </button>
        </form>
      </div>
    </div>
  );
}
