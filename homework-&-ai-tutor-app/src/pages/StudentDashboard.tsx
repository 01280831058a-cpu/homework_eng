import { useEffect, useState } from "react";
import { Link, Routes, Route, useNavigate } from "react-router-dom";
import HomeworkDetail from "./HomeworkDetail";
import ChatTutor from "./ChatTutor";
import { db } from "../firebase";
import { collection, query, where, orderBy, getDocs, onSnapshot } from "firebase/firestore";

export default function StudentDashboard({ user }: { user: any }) {
  return (
    <Routes>
      <Route path="homeworks" element={<HomeworksList user={user} />} />
      <Route path="homework/:id" element={<HomeworkDetail user={user} />} />
      <Route path="chat" element={<ChatTutor studentLevel={user.level} ageGroup={user.age_group} />} />
    </Routes>
  );
}

function HomeworksList({ user }: { user: any }) {
  const [homeworks, setHomeworks] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    
    const loadData = async () => {
      // Load all homeworks assigned to this student or to all students (studentId = null)
      const qStudent = query(collection(db, "homeworks"), where("studentId", "in", [user.id, null]));
      const snap = await getDocs(qStudent);
      
      const hwData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Load unread counts
      const msgSnap = await getDocs(collection(db, "messages"));
      const unreadByHw: any = {};
      msgSnap.forEach(doc => {
        const m = doc.data();
        if (m.studentId === user.id && m.senderId !== user.id && m.isRead === false) {
          const hwId = m.homeworkId;
          unreadByHw[hwId] = (unreadByHw[hwId] || 0) + 1;
        }
      });

      const finalHw = hwData.map(hw => ({
        ...hw,
        unread_count: unreadByHw[hw.id] || 0
      })).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

      setHomeworks(finalHw);
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Мои задания</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {homeworks.map((hw) => (
          <Link 
            key={hw.id} 
            to={`/student/homework/${hw.id}`} 
            className="group block bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow transition-all cursor-pointer flex flex-col relative"
          >
            {hw.unread_count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm z-10 animate-bounce">
                {hw.unread_count}
              </span>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 mb-1">{hw.title}</h3>
              <p className="text-slate-500 line-clamp-2 text-xs">{hw.description}</p>
            </div>
          </Link>
        ))}
        {homeworks.length === 0 && <p className="text-xs text-slate-500 col-span-2">Пока нет заданий</p>}
      </div>
    </div>
  );
}
