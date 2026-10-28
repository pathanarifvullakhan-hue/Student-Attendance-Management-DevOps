const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-test-"));
const port = 3400 + Math.floor(Math.random() * 500);
let child;
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function request(url, options={}) {
  const response = await fetch(base + url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, data };
}

test("API supports student registration, seven periods, monthly calculation, and CSV", async t => {
  child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(tempDir, "test.db") },
    stdio: "ignore"
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await wait(300);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i=0; i<50; i++) {
    try { if ((await request("/api/health")).status===200) { ready=true; break; } } catch {}
    await wait(100);
  }
  assert.equal(ready, true, "server should start");

  const invalid = await request("/api/students", {method:"POST",body:JSON.stringify({roll_no:"",name:"",department:""})});
  assert.equal(invalid.status, 400);

  const added = await request("/api/students", {method:"POST",body:JSON.stringify({roll_no:"TEST001",name:"Test Student",department:"CSE"})});
  assert.equal(added.status, 201);
  const duplicate = await request("/api/students", {method:"POST",body:JSON.stringify({roll_no:"TEST001",name:"Duplicate",department:"CSE"})});
  assert.equal(duplicate.status, 409);

  const list = await request("/api/students");
  assert.equal(list.data.length, 1);
  const id = list.data[0].id;

  const date = "2026-01-05";
  const saved = await request("/api/attendance", {method:"POST",body:JSON.stringify({date,records:[{student_id:id,periods:["Present","Present","Absent","Present","Present","Absent","Present"]}]})});
  assert.equal(saved.status, 200);

  const retrieved = await request(`/api/attendance?date=${date}`);
  assert.equal(retrieved.data.students[0].periods.length, 7);
  assert.equal(retrieved.data.students[0].periods[2], "Absent");

  const report = await request("/api/reports/monthly?month=2026-01&threshold=75");
  assert.equal(report.status, 200);
  assert.equal(report.data.working_periods, 7);
  assert.equal(report.data.students[0].attended, 5);
  assert.equal(report.data.students[0].absent, 2);
  assert.equal(report.data.students[0].percentage, 71.43);
  assert.equal(report.data.students[0].below_threshold, true);

  const csv = await request("/api/reports/monthly.csv?month=2026-01");
  assert.equal(csv.status, 200);
  assert.match(csv.data, /Roll Number/);
  assert.match(csv.data, /TEST001/);

  const badPeriod = await request("/api/attendance", {method:"POST",body:JSON.stringify({date:"2026-01-06",records:[{student_id:id,periods:["Present"]}]})});
  assert.equal(badPeriod.status, 400);
});
