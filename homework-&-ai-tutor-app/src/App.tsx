import { useState, useEffect, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import { LogOut, BookOpen, MessageCircle, Users, FilePlus } from "lucide-react";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Login from "./pages/Login";

export default function App() {
  const [user, setUser] = useState<{ id: string; username: string; role: string; level?: string; age_group?: string } | null>(null);

  useEffect(() => {
    // Basic session persistence for prototype
    const stored = localStorage.getItem("user_session");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogin = (userData: typeof user) => {
    setUser(userData);
    localStorage.setItem("user_session", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user_session");
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen w-full bg-[#f8fafc] text-[#1e293b] font-sans overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-[#0f172a] text-white flex flex-col h-full shrink-0">
          <div className="p-6 border-b border-slate-700">
            <div className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              EduPlatform
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{user.role === 'teacher' ? 'Teacher Control Panel' : 'Student Portal'}</div>
          </div>
          
          <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
            <div className="text-[11px] font-semibold text-slate-500 uppercase px-2 py-2">Навигация</div>
            {user.role === "teacher" && (
              <>
                <Link to="/teacher/homeworks" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm transition-colors">
                  <span>📚</span> Управление заданиями
                </Link>
                <Link to="/teacher/students" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm transition-colors">
                  <span>👥</span> Управление студентами
                </Link>
              </>
            )}
            {user.role === "student" && (
              <>
                <Link to="/student/homeworks" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm transition-colors">
                  <span>📚</span> Мои задания
                </Link>
                <Link to="/student/chat" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm transition-colors">
                  <span>💬</span> ИИ Репетитор
                </Link>
              </>
            )}
          </nav>

          <div className="p-4 border-t border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                {user.username.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-medium truncate py-0.5">{user.username}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user.role}</div>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors shrink-0"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4 text-sm whitespace-nowrap">
               <span className="text-slate-400">Пользователь:</span>
               <span className="font-medium truncate">{user.username}</span>
               <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">ONLINE</span>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc]">
            <Routes>
              {user.role === "teacher" ? (
                <>
                  <Route path="/teacher/*" element={<TeacherDashboard user={user} />} />
                  <Route path="*" element={<Navigate to="/teacher/homeworks" replace />} />
                </>
              ) : (
                <>
                  <Route path="/student/*" element={<StudentDashboard user={user} />} />
                  <Route path="*" element={<Navigate to="/student/homeworks" replace />} />
                </>
              )}
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
