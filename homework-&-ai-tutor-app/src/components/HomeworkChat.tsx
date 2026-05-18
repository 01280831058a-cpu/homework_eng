import { useEffect, useState, useRef } from "react";
import { Send } from "lucide-react";
import clsx from "clsx";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, updateDoc, doc } from "firebase/firestore";

export default function HomeworkChat({ studentId, homeworkId, currentUser }: { studentId: string | number, homeworkId: string | number, currentUser: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      where("homeworkId", "==", String(homeworkId))
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      msgs = msgs.filter((m:any) => m.studentId === String(studentId));
      msgs.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMessages(msgs);

      // mark as read
      const unreadQuery = query(
        collection(db, "messages"),
        where("homeworkId", "==", String(homeworkId))
      );
      const unreadSnap = await getDocs(unreadQuery);
      unreadSnap.forEach(d => {
        const m = d.data() as any;
        if (m.studentId === String(studentId) && m.senderId !== String(currentUser.id) && m.isRead === false) {
           updateDoc(doc(db, "messages", d.id), { isRead: true });
        }
      });
    });

    return () => unsubscribe();
  }, [homeworkId, studentId, currentUser.id]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    try {
      await addDoc(collection(db, "messages"), {
        homeworkId: String(homeworkId),
        studentId: String(studentId),
        senderId: String(currentUser.id),
        username: currentUser.username || 'Unknown',
        role: currentUser.role,
        message: text,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error sending message:", e);
    }
  };

  return (
    <div className="flex flex-col h-64 bg-slate-50/50 border border-slate-200 rounded-lg overflow-hidden shrink-0 mt-3">
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={containerRef}>
        {messages.length === 0 && <p className="text-xs text-slate-400 text-center uppercase font-bold tracking-wider pt-8">Нет сообщений. Напишите первым!</p>}
        {messages.map(m => (
          <div key={m.id} className={clsx("flex", m.senderId === String(currentUser.id) ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[85%] rounded-lg p-2.5 text-sm", m.senderId === String(currentUser.id) ? "bg-blue-600 text-white rounded-br-none shadow-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm")}>
              {m.senderId !== String(currentUser.id) && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{m.role === 'teacher' ? 'Учитель' : m.username}</div>}
              <div className="whitespace-pre-wrap">{m.message}</div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="p-2 bg-white border-t border-slate-200 flex items-center gap-2">
        <input 
          type="text" 
          className="flex-1 text-sm bg-slate-100 border-transparent focus:bg-white focus:border-blue-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" 
          placeholder="Написать сообщение..." 
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim()} className="text-blue-600 p-1.5 disabled:opacity-50 hover:bg-blue-50 rounded transition-colors shadow-sm">
          <Send className="w-4 h-4"/>
        </button>
      </form>
    </div>
  );
}
