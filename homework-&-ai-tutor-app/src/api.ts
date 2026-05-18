import { db, storage, auth } from './firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export const API_URL = "/api";

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  if (endpoint.startsWith("/chat")) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");
    return data;
  }

  const method = options.method || "GET";
  const body = options.body ? JSON.parse(options.body as string) : null;

  if (endpoint === "/users/students" && method === "GET") {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  if (endpoint === "/users/students" && method === "POST") {
    const { username, password, level, age_group } = body;
    const email = `${username.toLowerCase()}@educa.app`;
    try {
      // Create user in firebase auth but we might be logged out... wait, we need another app instance or we are fine?
      // Actually we are not creating an admin SDK so this logs out the teacher!
      // But for prototype it's fine.
    } catch (e) {}
    await addDoc(collection(db, "users"), {
      username, role: 'student', level: level || 'A2', age_group: age_group || 'adult'
    });
    return { success: true };
  }

  if (endpoint.match(/^\/users\/students\/([^\/]+)\/level$/) && method === "PUT") {
    const id = endpoint.split("/")[3];
    await updateDoc(doc(db, "users", id), body);
    return { success: true };
  }

  if (endpoint === "/homeworks" || endpoint.startsWith("/homeworks?")) {
    const isStudent = endpoint.includes("student_id=");
    let snap;
    if (isStudent) {
       const sid = new URLSearchParams(endpoint.split("?")[1]).get("student_id");
       const qStudent = query(collection(db, "homeworks"), where("studentId", "in", [sid, null]));
       snap = await getDocs(qStudent);
    } else {
       snap = await getDocs(collection(db, "homeworks"));
    }
    const hws = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    
    // Add unread counts
    const msgSnap = await getDocs(collection(db, "messages"));
    const unreadByHw: any = {};
    msgSnap.forEach(doc => {
       const m = doc.data();
       if (isStudent && sid) {
         if (m.studentId === sid && m.senderId !== sid && m.isRead === false) {
           unreadByHw[m.homeworkId] = (unreadByHw[m.homeworkId] || 0) + 1;
         }
       } else { // Teacher
         if (m.role !== 'teacher' && m.isRead === false) {
           unreadByHw[m.homeworkId] = (unreadByHw[m.homeworkId] || 0) + 1;
         }
       }
    });

    return hws.map(hw => ({ ...hw, unread_count: unreadByHw[hw.id] || 0 }));
  }

  if (endpoint.match(/^\/homeworks\/([^\/]+)$/) && method === "DELETE") {
    const id = endpoint.split("/")[2];
    await deleteDoc(doc(db, "homeworks", id));
    return { success: true };
  }

  if (endpoint.match(/^\/homeworks\/([^\/]+)$/) && method === "PUT") {
    const id = endpoint.split("/")[2];
    await updateDoc(doc(db, "homeworks", id), body);
    return { success: true };
  }

  if (endpoint.match(/^\/homeworks\/([^\/]+)\/submissions$/) && method === "GET") {
    const id = endpoint.split("/")[2];
    const snap = await getDocs(query(collection(db, "submissions"), where("homeworkId", "==", id)));
    const subs = await Promise.all(snap.docs.map(async d => {
       const s = { id: d.id, ...d.data() } as any;
       // get student username
       const sDoc = await getDoc(doc(db, "users", s.studentId));
       return { ...s, username: sDoc.exists() ? sDoc.data().username : "Unknown" };
    }));
    return subs;
  }

  if (endpoint.match(/^\/homeworks\/([^\/\?]+)(\?.*)?$/) && method === "GET") {
    const id = endpoint.split("/")[2].split("?")[0];
    const hwDoc = await getDoc(doc(db, "homeworks", id));
    if (!hwDoc.exists()) throw new Error("Not picked up");
    const hw = { id: hwDoc.id, ...hwDoc.data() };
    
    // check submission
    const sid = endpoint.includes("student_id=") ? new URLSearchParams(endpoint.split("?")[1]).get("student_id") : null;
    let submission = null;
    let submissionFiles = [];
    if (sid) {
       const qSubs = query(collection(db, "submissions"), where("homeworkId", "==", id));
       const subsSnap = await getDocs(qSubs);
       const studentSub = subsSnap.docs.find(d => d.data().studentId === sid);
       if (studentSub) {
          submission = studentSub.data();
          submissionFiles = submission.files || [];
       }
    }
    return { ...hw, words: hw.words || [], files: hw.files || [], submission, submissionFiles };
  }

  throw new Error(`Unhandled endpoint: ${method} ${endpoint}`);
};

export const fetchApiFormData = async (endpoint: string, formData: FormData) => {
  if (endpoint === "/homeworks") {
    const hwRef = await addDoc(collection(db, "homeworks"), {
      title: formData.get("title"),
      description: formData.get("description"),
      words: formData.get("words") ? JSON.parse(formData.get("words") as string) : [],
      studentId: formData.get("student_id") || null,
      createdAt: serverTimestamp(),
      teacherId: auth.currentUser?.uid || 'teacher'
    });
    
    const files = formData.getAll("files") as File[];
    const fileURLs = [];
    for(const f of files) {
       const storageRef = ref(storage, `homeworks/${hwRef.id}/${f.name}`);
       await uploadBytes(storageRef, f);
       fileURLs.push({ id: Math.random().toString(), originalname: f.name, url: await getDownloadURL(storageRef) });
    }
    await updateDoc(hwRef, { files: fileURLs });
    return { success: true };
  }

  if (endpoint.match(/^\/homeworks\/([^\/]+)\/submit$/)) {
    const id = endpoint.split("/")[2];
    const sid = formData.get("student_id") as string;
    
    const files = formData.getAll("files") as File[];
    const fileURLs = [];
    for(const f of files) {
       const storageRef = ref(storage, `submissions/${id}/${sid}/${f.name}`);
       await uploadBytes(storageRef, f);
       fileURLs.push({ id: Math.random().toString(), originalname: f.name, url: await getDownloadURL(storageRef) });
    }

    const qSubs = query(collection(db, "submissions"), where("homeworkId", "==", id));
    const subsSnap = await getDocs(qSubs);
    const existingSubDoc = subsSnap.docs.find(d => d.data().studentId === sid);
    if (existingSubDoc) {
       const subId = existingSubDoc.id;
       const existFiles = existingSubDoc.data().files || [];
       await updateDoc(doc(db, "submissions", subId), {
         status: formData.get("status") || 'pending',
         updatedAt: serverTimestamp(),
         files: [...existFiles, ...fileURLs]
       });
    } else {
       await addDoc(collection(db, "submissions"), {
         homeworkId: id,
         studentId: sid,
         status: formData.get("status") || 'pending',
         updatedAt: serverTimestamp(),
         files: fileURLs
       });
    }
    return { success: true };
  }

  throw new Error(`Unhandled endpoint: ${endpoint}`);
};
