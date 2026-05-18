import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchApi, fetchApiFormData } from "../api";
import { ArrowLeft, Download, RefreshCw, CheckCircle, HelpCircle, Upload, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import HomeworkChat from "../components/HomeworkChat";

export default function HomeworkDetail({ user }: { user?: any }) {
  const { id } = useParams();
  const [hw, setHw] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("pending");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    fetchApi(`/homeworks/${id}${user ? `?student_id=${user.id}` : ''}`).then(data => {
      setHw(data);
      if (data.submission) {
        setStatus(data.submission.status);
      }
    }).catch(console.error);
  }

  useEffect(() => {
    load();
  }, [id, user]);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("student_id", user.id);
      formData.append("status", status);
      formData.append("question", "");
      files.forEach(f => formData.append("files", f));

      await fetchApiFormData(`/homeworks/${id}/submit`, formData);
      setFiles([]);
      load();
      alert("Отправлено!");
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hw) return <div className="p-10 text-center animate-pulse text-blue-600 text-sm font-medium">Загрузка...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Link to="/student/homeworks" className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> К списку заданий
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-lg font-bold text-slate-900">{hw.title}</h1>
        </div>
        <div className="p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Описание задания</h3>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {hw.description}
          </div>
        </div>
      </div>

      {hw.files?.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Файлы (PDF)</h3>
          <div className="flex flex-wrap gap-3">
            {hw.files.map((f: any) => (
              <a 
                key={f.id}
                href={f.url || `/api/homeworks/file/${f.id}`} 
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-white shadow-sm hover:border-blue-300 transition-colors w-48"
              >
                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-red-600 text-[10px] font-bold shrink-0">PDF</div>
                <div className="overflow-hidden">
                  <div className="text-[11px] font-medium text-slate-900 truncate">{f.originalname}</div>
                  <div className="text-[10px] text-slate-400">Скачать</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {hw.words?.length > 0 && (
        <section className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Слова к занятию (Flashcards)</h3>
          <Flashcards words={hw.words} />
        </section>
      )}

      {/* Submission Section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 mb-8 mt-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Мой ответ и результаты</h3>
        
        <div className="space-y-5">
          {/* Status Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Статус:</span>
            <button 
              onClick={() => setStatus(status === 'completed' ? 'pending' : 'completed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {status === 'completed' ? 'Выполнено' : 'Не выполнено'}
            </button>
          </div>

          {/* Files Upload & List */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Прикрепить файлы (Решение/Фото)</label>
            <input 
              type="file" 
              multiple 
              accept=".pdf,.png,.jpg,.jpeg" 
              className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all mb-2 w-full border border-slate-200 rounded p-1" 
              onChange={e => {
                if(e.target.files) setFiles(Array.from(e.target.files));
              }} 
            />
            
            {/* Previously uploaded files */}
            {hw.submissionFiles?.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Загруженные ранее файлы:</p>
                {hw.submissionFiles.map((f: any) => (
                  <a key={f.id} href={f.url || `/api/homeworks/submission-file/${f.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <span>📄</span> {f.originalname}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? "Отправка..." : "Отправить файлы / обновить статус"}
            </button>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <MessageCircle className="w-4 h-4" />
              Чат с учителем по этому заданию
            </h4>
            <p className="text-xs text-slate-500 mb-2">Напишите сюда, если что-то было непонятно, и учитель вам ответит.</p>
            <HomeworkChat studentId={user.id} homeworkId={hw.id} currentUser={user} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Flashcards({ words }: { words: {id:number, word:string, translation:string}[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((p) => (p + 1) % words.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((p) => (p - 1 + words.length) % words.length);
    }, 150);
  };

  const currentWord = words[currentIndex];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-sm aspect-[3/2] perspective-1000">
        <motion.div
          className="w-full h-full cursor-pointer relative preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          onClick={() => setIsFlipped(!isFlipped)}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front (Word) */}
          <div 
            className="absolute inset-0 bg-white border border-blue-200 rounded-xl shadow-sm flex flex-col items-center justify-center p-6 backface-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-2xl font-bold text-blue-900 text-center">{currentWord.word}</p>
          </div>
          
          {/* Back (Translation) */}
          <div 
            className="absolute inset-0 bg-blue-600 text-white rounded-xl shadow-sm flex flex-col items-center justify-center p-6 backface-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-2xl font-bold text-center">{currentWord.translation}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button onClick={prevCard} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium hover:bg-slate-50 transition-colors">Назад</button>
        <span className="text-slate-500 font-bold text-xs">{currentIndex + 1} / {words.length}</span>
        <button onClick={nextCard} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium hover:bg-slate-50 transition-colors">Вперед</button>
      </div>
      <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1 uppercase tracking-wider font-semibold"><RefreshCw className="w-3 h-3"/> Нажмите, чтобы перевернуть</p>
    </div>
  );
}
