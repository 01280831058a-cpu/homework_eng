import { useState } from "react";
import { BookOpen, AlertCircle } from "lucide-react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Convert username to a local email for Firebase Auth
    const email = `${username.toLowerCase().trim()}@educa.app`;
    
    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        // If the teacher account doesn't exist, create it automatically on first run
        if (username === 'teacher' && err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", auth.currentUser!.uid), {
              username: 'teacher',
              role: 'teacher',
              level: 'C2',
              age_group: 'adult'
            });
        } else {
             throw err;
        }
      }

      // Fetch user data from firestore
      const userDoc = await getDoc(doc(db, "users", auth.currentUser!.uid));
      if (userDoc.exists()) {
         onLogin({ id: userDoc.id, ...userDoc.data() });
      } else {
         throw new Error("User data not found in DB.");
      }

    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Неверный логин или пароль");
      } else {
        setError(err.message || "Ошибка авторизации");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Вход в Educa
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Система управления</p>
        </div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 p-3 rounded-lg flex items-center gap-2 text-red-700 border border-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Логин
              </label>
              <input
                type="text"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-slate-200 placeholder-slate-400 text-slate-900 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50 focus:bg-white transition-colors"
                placeholder="teacher"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Пароль
              </label>
              <input
                type="password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-slate-200 placeholder-slate-400 text-slate-900 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50 focus:bg-white transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-semibold rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75 transition-colors shadow-sm"
            >
              {loading ? "Загрузка..." : "Войти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
