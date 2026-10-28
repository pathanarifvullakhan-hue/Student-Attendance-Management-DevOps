const $ = id => document.getElementById(id);
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
const localMonth = localDate.slice(0,7);
$("attendanceDate").value = localDate;
$("reportMonth").value = localMonth;
$("historyMonth").value = localMonth;
let students = [];
let attendanceRows = [];

function showMessage(text, error=false) {
  const el=$("message"); el.textContent=text; el.classList.remove("hidden","error");
  if(error) el.classList.add("error");
  window.clearTimeout(showMessage.timer);
  showMessage.timer=window.setTimeout(()=>el.classList.add("hidden"),5000);
}
async function api(url, options={}) {
  const response=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=response.headers.get("content-type")?.includes("application/json")?await response.json():null;
  if(!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}
function escapeHtml(value) {
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function setTab(id) {
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("hidden",p.id!==id));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));

async function checkHealth(){
  try { await api("/api/health"); $("apiStatus").textContent="API connected"; }
  catch { $("apiStatus").textContent="API unavailable"; $("apiStatus").style.color="#ffb6a8"; }
}
async function loadStudents(){
  students=await api("/api/students");
  $("studentRows").innerHTML=students.map(s=>`<tr><td>${escapeHtml(s.roll_no)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.department)}</td><td><button class="secondary edit-student" data-id="${s.id}">Edit</button></td></tr>`).join("") || '<tr><td colspan="4">No students yet. Add your first student above.</td></tr>';
  $("studentCount").textContent=`${students.length} student(s) registered`;
  document.querySelectorAll(".edit-student").forEach(b=>b.addEventListener("click",()=>editStudent(Number(b.dataset.id))));
}
function resetStudentForm(){
  $("studentForm").reset(); $("studentId").value=""; $("studentSubmit").textContent="Add student"; $("cancelEdit").classList.add("hidden");
}
function editStudent(id){
  const s=students.find(x=>x.id===id); if(!s)return;
  $("studentId").value=s.id; $("rollNo").value=s.roll_no; $("studentName").value=s.name; $("department").value=s.department;
  $("studentSubmit").textContent="Save changes"; $("cancelEdit").classList.remove("hidden");
  $("rollNo").focus();
}
$("cancelEdit").addEventListener("click",resetStudentForm);
$("studentForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=$("studentId").value;
  const body={roll_no:$("rollNo").value,name:$("studentName").value,department:$("department").value};
  try{
    await api(id?`/api/students/${id}`:"/api/students",{method:id?"PUT":"POST",body:JSON.stringify(body)});
    showMessage(id?"Student updated.":"Student added."); resetStudentForm(); await loadStudents(); await loadAttendance();
  }catch(err){showMessage(err.message,true);}
});

function renderAttendance(){
  $("attendanceHead").innerHTML=`<tr><th>Roll number</th><th>Student name</th>${[1,2,3,4,5,6,7].map(n=>`<th>Period ${n}</th>`).join("")}</tr>`;
  $("attendanceRows").innerHTML=attendanceRows.map((s,index)=>`<tr><td>${escapeHtml(s.roll_no)}</td><td>${escapeHtml(s.name)}</td>${s.periods.map((status,p)=>`<td><select aria-label="${escapeHtml(s.name)} period ${p+1}" data-row="${index}" data-period="${p}"><option value="" ${!status?"selected":""}>Select</option><option value="Present" ${status==="Present"?"selected":""}>Present</option><option value="Absent" ${status==="Absent"?"selected":""}>Absent</option></select></td>`).join("")}</tr>`).join("") || '<tr><td colspan="9">Add students before marking attendance.</td></tr>';
  $("attendanceRows").querySelectorAll("select").forEach(sel=>sel.addEventListener("change",()=>{
    attendanceRows[Number(sel.dataset.row)].periods[Number(sel.dataset.period)]=sel.value;
  }));
}
async function loadAttendance(){
  if(!$("attendanceDate").value)return;
  try{
    const data=await api(`/api/attendance?date=${encodeURIComponent($("attendanceDate").value)}`);
    attendanceRows=data.students;
    renderAttendance();
    $("attendanceSaved").textContent=data.saved?"Saved records loaded. You may correct them.":"No saved attendance for this date yet.";
  }catch(err){showMessage(err.message,true);}
}
$("attendanceDate").addEventListener("change",loadAttendance);
$("allPresent").addEventListener("click",()=>{attendanceRows.forEach(s=>s.periods=Array(7).fill("Present"));renderAttendance();});
$("allAbsent").addEventListener("click",()=>{attendanceRows.forEach(s=>s.periods=Array(7).fill("Absent"));renderAttendance();});
$("saveAttendance").addEventListener("click",async()=>{
  if(!attendanceRows.length){showMessage("Add students before saving attendance.",true);return;}
  if(attendanceRows.some(s=>s.periods.length!==7||s.periods.some(v=>!["Present","Absent"].includes(v)))){
    showMessage("Choose Present or Absent for every student and all seven periods.",true);return;
  }
  try{
    await api("/api/attendance",{method:"POST",body:JSON.stringify({date:$("attendanceDate").value,records:attendanceRows.map(s=>({student_id:s.student_id,periods:s.periods}))})});
    showMessage("Attendance saved successfully."); $("attendanceSaved").textContent="Saved successfully."; await loadReport(); await loadHistory();
  }catch(err){showMessage(err.message,true);}
});

function reportQuery(){
  const month=$("reportMonth").value;
  const threshold=$("threshold").value || "75";
  return {month,threshold};
}
async function loadReport(){
  const {month,threshold}=reportQuery(); if(!month)return;
  try{
    const data=await api(`/api/reports/monthly?month=${encodeURIComponent(month)}&threshold=${encodeURIComponent(threshold)}`);
    $("reportSummary").innerHTML=[
      ["Working days",data.working_days],["Working periods per student",data.working_periods],["Below threshold",data.students.filter(s=>s.below_threshold).length]
    ].map(([label,value])=>`<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
    $("reportRows").innerHTML=data.students.map(s=>`<tr><td>${escapeHtml(s.roll_no)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.department)}</td><td>${s.working_periods}</td><td>${s.attended}</td><td>${s.absent}</td><td>${s.percentage.toFixed(2)}%</td><td><span class="pill ${s.below_threshold?"low":"ok"}">${s.working_periods===0?"No data":s.below_threshold?"Below threshold":"OK"}</span></td></tr>`).join("") || '<tr><td colspan="8">No students registered.</td></tr>';
    $("downloadCsv").href=`/api/reports/monthly.csv?month=${encodeURIComponent(month)}&threshold=${encodeURIComponent(threshold)}`;
  }catch(err){showMessage(err.message,true);}
}
$("loadReport").addEventListener("click",loadReport);
$("reportMonth").addEventListener("change",loadReport);
$("threshold").addEventListener("change",loadReport);

async function loadHistory(){
  const month=$("historyMonth").value;if(!month)return;
  try{
    const data=await api(`/api/attendance/history?month=${encodeURIComponent(month)}`);
    $("historyRows").innerHTML=data.days.map(d=>`<tr><td>${escapeHtml(d.attendance_date)}</td><td>${d.entries}</td><td>${d.present||0}</td><td>${d.absent||0}</td><td><a class="button-link" href="/api/reports/daily.csv?date=${encodeURIComponent(d.attendance_date)}">Export CSV</a></td></tr>`).join("") || '<tr><td colspan="5">No saved attendance dates for this month.</td></tr>';
  }catch(err){showMessage(err.message,true);}
}
$("loadHistory").addEventListener("click",loadHistory);
$("historyMonth").addEventListener("change",loadHistory);

(async function init(){
  await checkHealth();
  try{await loadStudents();await loadAttendance();await loadReport();await loadHistory();}
  catch(err){showMessage(err.message,true);}
})();
