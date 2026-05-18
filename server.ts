import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";

// 1. Initialize SQLite Database
const db = new Database("app_data.db");
db.pragma("journal_mode = WAL");

// Setup Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'teacher' or 'student'
    level TEXT, -- 'A0', 'A1', 'A2', 'B1', 'B2', 'C1'
    age_group TEXT DEFAULT 'adult' -- 'child', 'teen', 'adult'
  );

  CREATE TABLE IF NOT EXISTS student_homeworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    homework_id INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending' or 'completed'
    question TEXT,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
    UNIQUE(student_id, homework_id)
  );

  CREATE TABLE IF NOT EXISTS submission_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    homework_id INTEGER,
    originalname TEXT,
    mimetype TEXT,
    data BLOB,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE
  );

  -- Handle migration
  BEGIN TRANSACTION;
  ALTER TABLE users ADD COLUMN age_group TEXT DEFAULT 'adult';
  COMMIT;
  
  BEGIN TRANSACTION;
  ALTER TABLE homeworks ADD COLUMN student_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  COMMIT;
  -- Ignore errors if column already exists
  
  CREATE TABLE IF NOT EXISTS homeworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    student_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS homework_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER,
    word TEXT,
    translation TEXT,
    FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS homework_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER,
    originalname TEXT,
    mimetype TEXT,
    data BLOB,
    FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE
  );
`);

// Insert default teacher if not exists
const teacherExists = db.prepare("SELECT * FROM users WHERE username = 'teacher'").get();
if (!teacherExists) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('teacher', 'admin', 'teacher');
  console.log("Default teacher created (teacher/admin)");
}

// 2. Initialize Express & Middleware
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });

  // 3. API Routes

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT id, username, role, level, age_group FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });

  app.get("/api/users/students", (req, res) => {
    const students = db.prepare("SELECT id, username, level, age_group FROM users WHERE role = 'student'").all();
    res.json(students);
  });

  app.post("/api/users/students", (req, res) => {
    const { username, password, level, age_group } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (username, password, role, level, age_group) VALUES (?, ?, 'student', ?, ?)").run(username, password, level || 'A2', age_group || 'adult');
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message });
    }
  });

  app.put("/api/users/students/:id/level", (req, res) => {
    const { level, age_group } = req.body;
    if (age_group) {
      db.prepare("UPDATE users SET level = ?, age_group = ? WHERE id = ?").run(level, age_group, req.params.id);
    } else {
      db.prepare("UPDATE users SET level = ? WHERE id = ?").run(level, req.params.id);
    }
    res.json({ success: true });
  });

  app.get("/api/homeworks", (req, res) => {
    const student_id = req.query.student_id;
    let homeworks;
    if (student_id) {
       homeworks = db.prepare(`
        SELECT h.*, 
        (SELECT COUNT(*) FROM homework_messages hm JOIN users tu ON hm.sender_id = tu.id WHERE hm.homework_id = h.id AND hm.student_id = ? AND tu.role = 'teacher' AND hm.is_read = 0) as unread_count
        FROM homeworks h 
        WHERE student_id IS NULL OR student_id = ? 
        ORDER BY created_at DESC
       `).all(student_id, student_id);
    } else {
       homeworks = db.prepare(`
        SELECT h.*,
        (SELECT COUNT(*) FROM homework_messages hm JOIN users su ON hm.sender_id = su.id WHERE hm.homework_id = h.id AND su.role = 'student' AND hm.is_read = 0) as unread_count
        FROM homeworks h 
        ORDER BY created_at DESC
       `).all();
    }
    res.json(homeworks);
  });

  app.delete("/api/homeworks/:id", (req, res) => {
    db.prepare("DELETE FROM homeworks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/homeworks", upload.array("files"), (req, res) => {
    const { title, description, words, student_id } = req.body;
    
    const insertHw = db.prepare("INSERT INTO homeworks (title, description, student_id) VALUES (?, ?, ?)");
    const insertWord = db.prepare("INSERT INTO homework_words (homework_id, word, translation) VALUES (?, ?, ?)");
    const insertFile = db.prepare("INSERT INTO homework_files (homework_id, originalname, mimetype, data) VALUES (?, ?, ?, ?)");

    const transaction = db.transaction(() => {
      const info = insertHw.run(title, description, student_id || null);
      const hwId = info.lastInsertRowid;

      if (words) {
        const wordsArray = JSON.parse(words);
        for (const w of wordsArray) {
          insertWord.run(hwId, w.word, w.translation);
        }
      }

      if (req.files) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) {
          insertFile.run(hwId, file.originalname, file.mimetype, file.buffer);
        }
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put("/api/homeworks/:id", (req, res) => {
    const { title, description } = req.body;
    db.prepare("UPDATE homeworks SET title = ?, description = ? WHERE id = ?").run(title, description, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/homeworks/:id", (req, res) => {
    const id = req.params.id;
    const hw = db.prepare("SELECT * FROM homeworks WHERE id = ?").get(id);
    if (!hw) return res.status(404).json({ error: "Not found" });

    const words = db.prepare("SELECT id, word, translation FROM homework_words WHERE homework_id = ?").all(id);
    const files = db.prepare("SELECT id, originalname FROM homework_files WHERE homework_id = ?").all(id);

    let submission = null;
    let submissionFiles = [];
    if (req.query.student_id) {
       submission = db.prepare("SELECT * FROM student_homeworks WHERE homework_id = ? AND student_id = ?").get(id, req.query.student_id);
       submissionFiles = db.prepare("SELECT id, originalname FROM submission_files WHERE homework_id = ? AND student_id = ?").all(id, req.query.student_id);
    }

    res.json({ ...hw, words, files, submission, submissionFiles });
  });

  app.post("/api/homeworks/:id/submit", upload.array("files"), (req, res) => {
    const hwId = req.params.id;
    const { student_id, status, question } = req.body;
    
    if (!student_id) return res.status(400).json({ error: "student_id required" });

    const transaction = db.transaction(() => {
      const existing = db.prepare("SELECT id FROM student_homeworks WHERE homework_id = ? AND student_id = ?").get(hwId, student_id);
      if (existing) {
        db.prepare("UPDATE student_homeworks SET status = ?, question = ? WHERE homework_id = ? AND student_id = ?").run(status || 'pending', question || '', hwId, student_id);
      } else {
        db.prepare("INSERT INTO student_homeworks (student_id, homework_id, status, question) VALUES (?, ?, ?, ?)").run(student_id, hwId, status || 'pending', question || '');
      }

      if (req.files) {
        const files = req.files as Express.Multer.File[];
        const insertFile = db.prepare("INSERT INTO submission_files (student_id, homework_id, originalname, mimetype, data) VALUES (?, ?, ?, ?, ?)");
        for (const file of files) {
          insertFile.run(student_id, hwId, file.originalname, file.mimetype, file.buffer);
        }
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/homeworks/:id/messages", (req, res) => {
    const { student_id } = req.query;
    const hw_id = req.params.id;
    if (!student_id) return res.status(400).json({ error: "student_id required" });
    const messages = db.prepare(`
      SELECT hm.*, u.username, u.role 
      FROM homework_messages hm 
      JOIN users u ON hm.sender_id = u.id 
      WHERE hm.homework_id = ? AND hm.student_id = ? 
      ORDER BY hm.created_at ASC
    `).all(hw_id, student_id);
    res.json(messages);
  });

  app.post("/api/homeworks/:id/messages", (req, res) => {
    const { student_id, sender_id, message } = req.body;
    const hw_id = req.params.id;
    db.prepare("INSERT INTO homework_messages (student_id, homework_id, sender_id, message) VALUES (?, ?, ?, ?)").run(student_id, hw_id, sender_id, message);
    res.json({ success: true });
  });

  app.post("/api/homeworks/:id/messages/read", (req, res) => {
    const { student_id, user_id } = req.body; 
    const hw_id = req.params.id;
    db.prepare(`
      UPDATE homework_messages 
      SET is_read = 1 
      WHERE homework_id = ? AND student_id = ? AND sender_id != ?
    `).run(hw_id, student_id, user_id);
    res.json({ success: true });
  });

  app.get("/api/homeworks/:id/submissions", (req, res) => {
    const id = req.params.id;
    const submissions = db.prepare(`
      SELECT sh.*, u.username,
      (SELECT COUNT(*) FROM homework_messages hm WHERE hm.homework_id = sh.homework_id AND hm.student_id = sh.student_id AND hm.sender_id = sh.student_id AND hm.is_read = 0) as unread_count
      FROM student_homeworks sh
      JOIN users u ON sh.student_id = u.id
      WHERE sh.homework_id = ?
    `).all(id);

    const fullSubs = submissions.map((sub: any) => {
      const subFiles = db.prepare("SELECT id, originalname FROM submission_files WHERE homework_id = ? AND student_id = ?").all(id, sub.student_id);
      return { ...sub, files: subFiles };
    });

    res.json(fullSubs);
  });

  app.get("/api/homeworks/submission-file/:fileId", (req, res) => {
    const file: any = db.prepare("SELECT * FROM submission_files WHERE id = ?").get(req.params.fileId);
    if (!file) return res.status(404).send("File not found");

    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalname)}"`);
    res.send(file.data);
  });

  app.get("/api/homeworks/file/:fileId", (req, res) => {
    const file: any = db.prepare("SELECT * FROM homework_files WHERE id = ?").get(req.params.fileId);
    if (!file) return res.status(404).send("File not found");

    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalname)}"`);
    res.send(file.data);
  });

  app.post("/api/chat", async (req, res) => {
    const { prompt, mode, studentLevel, ageGroup } = req.body;
    const apiKey = process.env.YANDEX_API_KEY;
    const folderId = process.env.YANDEX_FOLDER_ID;

    if (!apiKey || !folderId) {
      return res.status(500).json({ error: "YANDEX_API_KEY and YANDEX_FOLDER_ID are required in environment variables." });
    }

    let systemPrompt = "";
    if (mode === "translation") {
      systemPrompt = `You are an English-Russian dictionary and translator. Your ONLY output should be strictly in the format "Word - Translation". Do NOT add any examples, greetings, explanations, punctuation context, or anything else. Output nothing but "Word - Translation" (or "Phrase - Translation").`;
    } else {
      systemPrompt = `You are a friendly and helpful English tutor. The user is a student at language level ${studentLevel || 'A2'}, and belongs to the age group: ${ageGroup || 'adult'}.`;
      if (ageGroup === 'child') {
        systemPrompt += ` Since the student is a child (7-11), use very simple language, avoid complex grammar terms, be very encouraging, and absolutely filter out any inappropriate, sensitive, or adult topics. Formulate your answers as simply as possible.`;
      } else if (ageGroup === 'teen') {
        systemPrompt += ` Since the student is a teenager (12-17), explain things slightly more in-depth than for a child, but maintain a clear, engaging tone. Avoid adult topics.`;
      } else {
        systemPrompt += ` Interact normally for an adult student. Provide comprehensive explanations.`;
      }
      systemPrompt += ` Answer their questions, provide explanations about grammar or vocabulary, and guide them in their learning. Adjust your language complexity to be appropriate for a ${studentLevel || 'A2'} student. You can blend Russian and English as a tutor normally would.`;
    }

    try {
      const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
        method: "POST",
        headers: {
          "Authorization": `Api-Key ${apiKey}`,
          "x-folder-id": folderId,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          modelUri: `gpt://${folderId}/yandexgpt/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.6,
            maxTokens: "1000"
          },
          messages: [
            { role: "system", text: systemPrompt },
            { role: "user", text: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Yandex API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const reply = data.result?.alternatives?.[0]?.message?.text || "No response generated.";
      res.json({ reply });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // 4. Vite Middleware for Development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // 5. Production Static File Serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
