import { useState, useEffect } from "react";
import { fetchApi, fetchApiFormData } from "../api";
import { Plus, Users, BookOpen, Trash2, File as FileIcon } from "lucide-react";
import Papa from "papaparse";

export default function TeacherDashboard() {
  const [view, setView] = useState<"homeworks" | "students" | "new_homework">("homeworks");

  return (
    <div className="space-y-6">
      {/* View switch buttons can be styled cleaner */}
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        <button
          onClick={() => setView("homeworks")}
          className={`px-3 py-1.5 font-medium rounded text-xs transition-colors ${view === "homeworks" || view === "new_homework" ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          Управление заданиями
        </button>
        <button
          onClick={() => setView("students")}
          className={`px-3 py-1.5 font-medium rounded text-xs transition-colors ${view === "students" ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          Управление студентами
        </button>
      </div>

      {view === "homeworks" && <HomeworksList onNew={() => setView("new_homework")} user={user} />}
      {view === "new_homework" && <NewHomework onCancel={() => setView("homeworks")} />}
      {view === "students" && <StudentsList />}
    </div>
  );
}

function HomeworksList({ onNew, user }: { onNew: () => void, user: any }) {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any>(null);
  const [subsList, setSubsList] = useState<any[]>([]);

  const load = () => fetchApi("/homeworks").then(setHomeworks).catch(console.error);
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // Poll unread counts
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Удалить это задание?")) return;
    try {
      await fetchApi(`/homeworks/${id}`, { method: "DELETE" });
      load();
    } catch(e:any) { alert(e.message) }
  };

  const handleEditSave = async () => {
    try {
      await fetchApi(`/homeworks/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: editing.title, description: editing.description })
      });
      setEditing(null);
      load();
    } catch(e:any) { alert(e.message) }
  };

  const handleViewSubmissions = async (hw: any) => {
    setSubmissions(hw);
    try {
      const data = await fetchApi(`/homeworks/${hw.id}/submissions`);
      setSubsList(data);
    } catch(e:any) { console.error(e) }
  };

  if (submissions) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSubmissions(null)} className="text-xs text-blue-600 font-bold hover:underline mb-2 flex items-center gap-1">
          &larr; Назад к списку
        </button>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Ответы: {submissions.title}</h2>
        {subsList.length === 0 && <p className="text-sm text-slate-500">Никто еще не прислал ответ.</p>}
        {subsList.map(sub => (
          <div key={sub.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">{sub.username}</h3>
                {sub.unread_count > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{sub.unread_count}</span>}
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${sub.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {sub.status === 'completed' ? 'Выполнено' : 'В процессе'}
              </span>
            </div>
            
            {sub.files?.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Файлы ученика:</p>
                <div className="flex flex-col gap-1">
                  {sub.files.map((f:any) => (
                    <a key={f.id} href={f.url || `/api/homeworks/submission-file/${f.id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs">
                      📄 {f.originalname}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
               <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Чат с учеником</p>
               <HomeworkChat studentId={sub.student_id} homeworkId={sub.homework_id} currentUser={user} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-900">Список заданий</h2>
        <button onClick={onNew} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Создать ДЗ
        </button>
      </div>
      <div className="grid gap-3">
        {homeworks.map((hw) => (
          <div key={hw.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
            {editing?.id === hw.id ? (
               <div className="p-4 flex flex-col gap-2">
                 <input className="w-full border rounded px-2 py-1 text-sm font-bold" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} />
                 <textarea className="w-full border rounded px-2 py-1 text-sm" value={editing.description} onChange={e => setEditing({...editing, description: e.target.value})} />
                 <div className="flex gap-2">
                   <button onClick={handleEditSave} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold">Сохранить</button>
                   <button onClick={() => setEditing(null)} className="px-3 py-1 border rounded text-xs font-medium">Отмена</button>
                 </div>
               </div>
            ) : (
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div className="flex-1 mr-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {hw.title}
                    {hw.student_id ? (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded uppercase tracking-wider font-semibold">Индивидуальное</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded uppercase tracking-wider font-semibold">Общее</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{hw.description}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => setEditing({id: hw.id, title: hw.title, description: hw.description})} className="text-[10px] uppercase font-bold text-slate-400 hover:text-blue-600 transition-colors bg-white border border-slate-200 rounded px-2 py-1 text-center">Изменить</button>
                  <button onClick={() => handleViewSubmissions(hw)} className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-blue-600 hover:text-white hover:bg-blue-600 transition-colors bg-blue-50 border border-blue-100 rounded px-2 py-1 text-center">
                    Ответы {hw.unread_count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
                  </button>
                  <button onClick={() => handleDelete(hw.id)} className="text-[10px] uppercase font-bold text-red-500 hover:text-white hover:bg-red-500 transition-colors bg-red-50 border border-red-100 rounded px-2 py-1 text-center">Удалить</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {homeworks.length === 0 && <p className="text-xs text-slate-500 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">Пока нет заданий</p>}
      </div>
    </div>
  );
}

function NewHomework({ onCancel, studentId }: { onCancel: () => void, studentId?: number }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [words, setWords] = useState<{word: string, translation: string}[]>([]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          const parsedWords = results.data
            .filter((row: any) => row.length >= 2 && row[0] && row[1])
            .map((row: any) => ({ word: row[0], translation: row[1] }));
          setWords(parsedWords);
        }
      });
    }
  };

  const handleSave = async () => {
    if (!title) return alert("Введите заголовок");
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("words", JSON.stringify(words));
    if (studentId) {
      formData.append("student_id", String(studentId));
    }
    files.forEach(f => formData.append("files", f));

    try {
      await fetchApiFormData("/homeworks", formData);
      onCancel();
    } catch(e: any) {
      alert("Ошибка: " + e.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">Новое задание</h2>
      
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Заголовок</label>
        <input type="text" className="w-full bg-white border border-slate-200 rounded py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Описание задания</label>
        <textarea className="w-full bg-white border border-slate-200 rounded py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm h-24" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Файлы (PDF)</label>
        <input type="file" multiple accept=".pdf" className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all" onChange={e => {
            if(e.target.files) setFiles(Array.from(e.target.files));
        }} />
        {files.length > 0 && <ul className="mt-2 text-[11px] text-slate-500 space-y-1">{files.map(f => <li key={f.name} className="flex items-center gap-1"><span>📄</span> {f.name}</li>)}</ul>}
      </div>

      <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Слова к занятию (CSV)</label>
        <p className="text-[10px] text-slate-500 mb-2">Загрузите файл где первый столбец - слово, второй - перевод.</p>
        <input type="file" accept=".csv" className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all" onChange={handleCsvUpload} />
        {words.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto bg-white rounded border border-slate-200 flex flex-col">
            {words.map((w, i) => (
              <div key={i} className="px-3 py-1.5 flex text-xs border-b border-slate-100 last:border-0">
                <span className="flex-1 font-bold text-slate-800">{w.word}</span>
                <span className="flex-1 text-slate-500 italic">{w.translation}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-100">
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition-colors">Сохранить ДЗ</button>
        <button onClick={onCancel} className="px-4 py-1.5 border border-slate-200 rounded text-xs hover:bg-slate-50 font-medium transition-colors">Отмена</button>
      </div>
    </div>
  );
}

function StudentsList() {
  const [students, setStudents] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState("adult");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const load = () => fetchApi("/users/students").then(setStudents);
  useEffect(() => { load() }, []);

  const handleAdd = async () => {
    if (!newUsername || !newPassword) return;
    try {
      await fetchApi("/users/students", { method: "POST", body: JSON.stringify({ username: newUsername, password: newPassword, level: "A2", age_group: newAgeGroup }) });
      setNewUsername("");
      setNewPassword("");
      setNewAgeGroup("adult");
      load();
    } catch(e: any) { alert(e.message) }
  };

  const handleUpdateLevel = async (id: number, level: string) => {
    try {
      await fetchApi(`/users/students/${id}/level`, { method: "PUT", body: JSON.stringify({ level }) });
      load();
    } catch(e: any) { alert(e.message) }
  };

  const handleUpdateAgeGroup = async (id: number, age_group: string) => {
    try {
      await fetchApi(`/users/students/${id}/level`, { method: "PUT", body: JSON.stringify({ age_group }) });
      load();
    } catch(e: any) { alert(e.message) }
  };

  if (selectedStudent) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedStudent(null)} className="text-xs text-blue-600 font-bold hover:underline mb-2 flex items-center gap-1">
          &larr; Назад к списку студентов
        </button>
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">Профиль: {selectedStudent.username}</h2>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <p className="text-sm font-medium text-slate-600">Назначить ДЗ индивидуально для ученика:</p>
          <NewHomework onCancel={() => setSelectedStudent(null)} studentId={selectedStudent.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-end gap-3 max-w-4xl">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Новый ученик (Логин)</label>
          <input className="w-full bg-white border border-slate-200 rounded py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Пароль</label>
          <input type="password" className="w-full bg-white border border-slate-200 rounded py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Возраст</label>
          <select className="w-full bg-white border border-slate-200 rounded py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" value={newAgeGroup} onChange={e => setNewAgeGroup(e.target.value)}>
            <option value="adult">Взрослый (18-99)</option>
            <option value="teen">Подросток (12-17)</option>
            <option value="child">Ребенок (7-11)</option>
          </select>
        </div>
        <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition-colors h-[34px] w-full md:w-auto">Добавить</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left max-w-5xl">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Логин</th>
              <th className="px-4 py-3 w-48">Уровень языка</th>
              <th className="px-4 py-3 w-48">Возрастная группа</th>
              <th className="px-4 py-3 w-32">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {students.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium">{s.username}</td>
                <td className="px-4 py-3">
                  <select 
                    value={s.level} 
                    onChange={e => handleUpdateLevel(s.id, e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded py-1 px-2 focus:ring-1 focus:ring-blue-500 outline-none hover:border-slate-300 transition-colors"
                  >
                    {["A0", "A1", "A2", "B1", "B2", "C1", "C2"].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select 
                    value={s.age_group || 'adult'} 
                    onChange={e => handleUpdateAgeGroup(s.id, e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded py-1 px-2 focus:ring-1 focus:ring-blue-500 outline-none hover:border-slate-300 transition-colors"
                  >
                    <option value="adult">Взрослый (18+)</option>
                    <option value="teen">Подросток (12-17)</option>
                    <option value="child">Ребенок (7-11)</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelectedStudent(s)} className="text-[10px] uppercase font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 transition-colors bg-indigo-50 border border-indigo-100 rounded px-2 py-1 text-center w-full">Карточка</button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-xs text-slate-500 text-center">Нет учеников</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
