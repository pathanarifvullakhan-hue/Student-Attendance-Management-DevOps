const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database", "attendance.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance_days (
    attendance_date TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
    status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(attendance_date) REFERENCES attendance_days(attendance_date),
    UNIQUE(student_id, attendance_date, period)
  );
`);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "frontend")));

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function validMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
function httpError(res, status, message) {
  return res.status(status).json({ error: message });
}
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Student Attendance API is running" });
});

// Student management
app.get("/api/students", (_req, res) => {
  res.json(db.prepare("SELECT id, roll_no, name, department FROM students ORDER BY roll_no").all());
});

app.post("/api/students", (req, res) => {
  const roll_no = normalizeText(req.body.roll_no);
  const name = normalizeText(req.body.name);
  const department = normalizeText(req.body.department);
  if (!roll_no || !name || !department) return httpError(res, 400, "Roll number, name, and department are required.");
  try {
    const result = db.prepare("INSERT INTO students (roll_no, name, department) VALUES (?, ?, ?)").run(roll_no, name, department);
    res.status(201).json({ message: "Student added successfully.", id: Number(result.lastInsertRowid) });
  } catch (error) {
    if (String(error.code).includes("UNIQUE")) return httpError(res, 409, "That roll number already exists.");
    console.error(error);
    return httpError(res, 500, "Could not add student.");
  }
});

app.put("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const roll_no = normalizeText(req.body.roll_no);
  const name = normalizeText(req.body.name);
  const department = normalizeText(req.body.department);
  if (!Number.isInteger(id) || id < 1 || !roll_no || !name || !department) {
    return httpError(res, 400, "Provide a valid student ID, roll number, name, and department.");
  }
  try {
    const result = db.prepare("UPDATE students SET roll_no=?, name=?, department=? WHERE id=?").run(roll_no, name, department, id);
    if (!result.changes) return httpError(res, 404, "Student not found.");
    res.json({ message: "Student updated successfully." });
  } catch (error) {
    if (String(error.code).includes("UNIQUE")) return httpError(res, 409, "That roll number already exists.");
    console.error(error);
    return httpError(res, 500, "Could not update student.");
  }
});

// Daily attendance: unmarked periods are shown as not marked, but a saved day must contain all seven periods for every student.
app.get("/api/attendance", (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return httpError(res, 400, "Use a valid date in YYYY-MM-DD format.");
  const students = db.prepare("SELECT id AS student_id, roll_no, name, department FROM students ORDER BY roll_no").all();
  const rows = db.prepare("SELECT student_id, period, status FROM attendance WHERE attendance_date=?").all(date);
  const byStudent = new Map();
  for (const row of rows) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, {});
    byStudent.get(row.student_id)[row.period] = row.status;
  }
  res.json({
    date,
    saved: db.prepare("SELECT 1 FROM attendance_days WHERE attendance_date=?").get(date) !== undefined,
    students: students.map(s => ({ ...s, periods: Array.from({length: 7}, (_, i) => byStudent.get(s.student_id)?.[i + 1] || "") }))
  });
});

app.post("/api/attendance", (req, res) => {
  const { date, records } = req.body;
  if (!validDate(date)) return httpError(res, 400, "Use a valid date in YYYY-MM-DD format.");
  if (!Array.isArray(records)) return httpError(res, 400, "Records must be an array.");
  const registered = db.prepare("SELECT id FROM students").all().map(s => s.id);
  if (records.length !== registered.length) return httpError(res, 400, "Submit attendance for every registered student.");
  const registeredSet = new Set(registered);
  const seen = new Set();
  for (const record of records) {
    if (!Number.isInteger(record.student_id) || !registeredSet.has(record.student_id) || seen.has(record.student_id)) {
      return httpError(res, 400, "A student is missing, invalid, or duplicated.");
    }
    if (!Array.isArray(record.periods) || record.periods.length !== 7 ||
        !record.periods.every(s => s === "Present" || s === "Absent")) {
      return httpError(res, 400, "Each student must have exactly seven Present/Absent statuses.");
    }
    seen.add(record.student_id);
  }
  if (seen.size !== registeredSet.size) return httpError(res, 400, "Attendance is missing for a registered student.");
  try {
    const save = db.transaction(() => {
      db.prepare("INSERT INTO attendance_days(attendance_date) VALUES (?) ON CONFLICT(attendance_date) DO NOTHING").run(date);
      const statement = db.prepare(`
        INSERT INTO attendance(student_id, attendance_date, period, status) VALUES (?, ?, ?, ?)
        ON CONFLICT(student_id, attendance_date, period) DO UPDATE SET status=excluded.status
      `);
      for (const record of records) record.periods.forEach((status, index) => statement.run(record.student_id, date, index + 1, status));
    });
    save();
    res.json({ message: "Attendance saved successfully.", date, students: records.length, periodsPerStudent: 7 });
  } catch (error) {
    console.error(error);
    httpError(res, 500, "Could not save attendance.");
  }
});

app.get("/api/attendance/history", (req, res) => {
  const month = req.query.month;
  if (!validMonth(month)) return httpError(res, 400, "Use a valid month in YYYY-MM format.");
  const days = db.prepare(`
    SELECT d.attendance_date,
      COUNT(a.id) AS entries,
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent
    FROM attendance_days d
    LEFT JOIN attendance a ON a.attendance_date=d.attendance_date
    WHERE substr(d.attendance_date,1,7)=?
    GROUP BY d.attendance_date ORDER BY d.attendance_date DESC
  `).all(month);
  res.json({ month, days });
});

// Monthly report: each saved date counts as a working day and contributes seven working periods.
app.get("/api/reports/monthly", (req, res) => {
  const month = req.query.month;
  const threshold = req.query.threshold === undefined ? 75 : Number(req.query.threshold);
  if (!validMonth(month)) return httpError(res, 400, "Use a valid month in YYYY-MM format.");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) return httpError(res, 400, "Threshold must be between 0 and 100.");
  const workingDays = db.prepare("SELECT COUNT(*) AS total FROM attendance_days WHERE substr(attendance_date,1,7)=?").get(month).total;
  const workingPeriods = workingDays * 7;
  const students = db.prepare(`
    SELECT s.id, s.roll_no, s.name, s.department,
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent,
      COUNT(a.id) AS marked
    FROM students s
    LEFT JOIN attendance a ON a.student_id=s.id AND substr(a.attendance_date,1,7)=?
    GROUP BY s.id ORDER BY s.roll_no
  `).all(month).map(s => {
    const attended = Number(s.attended || 0);
    const absent = Number(s.absent || 0);
    const percentage = workingPeriods ? (attended / workingPeriods) * 100 : 0;
    return {
      id: s.id, roll_no: s.roll_no, name: s.name, department: s.department,
      attended, absent, working_periods: workingPeriods,
      marked_periods: Number(s.marked || 0),
      percentage: Number(percentage.toFixed(2)),
      below_threshold: workingPeriods > 0 && percentage < threshold
    };
  });
  res.json({ month, working_days: workingDays, working_periods: workingPeriods, threshold, students });
});

app.get("/api/reports/monthly.csv", (req, res) => {
  const month = req.query.month;
  const threshold = req.query.threshold === undefined ? 75 : Number(req.query.threshold);
  if (!validMonth(month)) return httpError(res, 400, "Use a valid month in YYYY-MM format.");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) return httpError(res, 400, "Threshold must be between 0 and 100.");
  const workingDays = db.prepare("SELECT COUNT(*) AS total FROM attendance_days WHERE substr(attendance_date,1,7)=?").get(month).total;
  const workingPeriods = workingDays * 7;
  const rows = db.prepare(`
    SELECT s.roll_no, s.name, s.department,
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent
    FROM students s LEFT JOIN attendance a
      ON a.student_id=s.id AND substr(a.attendance_date,1,7)=?
    GROUP BY s.id ORDER BY s.roll_no
  `).all(month);
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [["Roll Number","Name","Department","Working Days","Working Periods","Periods Attended","Periods Absent","Attendance Percentage","Below Threshold"]];
  for (const r of rows) {
    const attended = Number(r.attended || 0), absent = Number(r.absent || 0);
    const pct = workingPeriods ? Number(((attended / workingPeriods) * 100).toFixed(2)) : 0;
    lines.push([r.roll_no,r.name,r.department,workingDays,workingPeriods,attended,absent,pct + "%",workingPeriods > 0 && pct < threshold ? "Yes" : "No"]);
  }
  const csv = lines.map(row => row.map(quote).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${month}.csv"`);
  res.send("\uFEFF" + csv);
});

app.get("/api/reports/daily.csv", (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return httpError(res, 400, "Use a valid date in YYYY-MM-DD format.");
  const rows = db.prepare(`
    SELECT s.roll_no, s.name, s.department, a.period, a.status
    FROM attendance a JOIN students s ON s.id=a.student_id
    WHERE a.attendance_date=? ORDER BY s.roll_no, a.period
  `).all(date);
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [["Roll Number","Name","Department","Date","Period","Status"], ...rows.map(r => [r.roll_no,r.name,r.department,date,r.period,r.status])]
    .map(row => row.map(quote).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${date}.csv"`);
  res.send("\uFEFF" + csv);
});

app.get("/api", (_req, res) => res.json({
  name: "Student Attendance Management System",
  modules: ["student-management", "daily-attendance", "attendance-history", "monthly-reports", "csv-export"]
}));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Student Attendance app running at http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { app, db, server };
