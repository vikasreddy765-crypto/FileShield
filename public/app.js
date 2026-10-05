const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem("fileshield_token")||"";
let currentUser=null, files=[], selectedDashFile=null, selectedVerifyFile=null;

function api(path, options={}) {
  options.headers=options.headers||{};
  if(token) options.headers.Authorization=`Bearer ${token}`;
  return fetch(path,options);
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function msg(id,text,type=""){const e=$(id);e.textContent=text;e.className=`msg ${type}`}
function bytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(2)} MB`}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function date(v){return new Date(v).toLocaleString()}
function showPublic(){ $("#publicView").classList.remove("hidden");$("#authView").classList.add("hidden");$("#dashboardView").classList.add("hidden"); }
function showAuth(){ $("#publicView").classList.add("hidden");$("#authView").classList.remove("hidden");$("#dashboardView").classList.add("hidden"); }
function showDash(){ $("#publicView").classList.add("hidden");$("#authView").classList.add("hidden");$("#dashboardView").classList.remove("hidden"); loadDashboard(); }

$("#loginNav").onclick=showAuth; $("#heroLogin").onclick=showAuth;
document.querySelectorAll(".back").forEach(a=>a.onclick=e=>{e.preventDefault();showPublic();location.hash="home"});
$$(".auth-tab").forEach(tab=>tab.onclick=()=>{const mode=tab.dataset.auth;$$(".auth-tab").forEach(x=>x.classList.toggle("active",x===tab));$("#loginForm").classList.toggle("hidden",mode!=="login");$("#registerForm").classList.toggle("hidden",mode!=="register");$("#authTitle").textContent=mode==="login"?"Welcome back":"Create your lecturer account";$("#authSubtitle").textContent=mode==="login"?"Sign in to protect your attendance records.":"Create an account to manage your attendance files."});

$("#loginForm").onsubmit=async e=>{e.preventDefault();msg("#loginMsg","Signing in…");try{const r=await api("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("#loginEmail").value,password:$("#loginPassword").value})});const d=await r.json();if(!r.ok)throw Error(d.error);token=d.token;localStorage.setItem("fileshield_token",token);currentUser=d.user;msg("#loginMsg","Login successful.","success");showDash()}catch(err){msg("#loginMsg",err.message,"error")}};
$("#registerForm").onsubmit=async e=>{e.preventDefault();msg("#registerMsg","Creating account…");try{const r=await api("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("#regName").value,email:$("#regEmail").value,password:$("#regPassword").value})});const d=await r.json();if(!r.ok)throw Error(d.error);token=d.token;localStorage.setItem("fileshield_token",token);currentUser=d.user;showDash()}catch(err){msg("#registerMsg",err.message,"error")}};

$("#logout").onclick=()=>{token="";currentUser=null;localStorage.removeItem("fileshield_token");showPublic();location.hash="home";toast("Logged out safely.")};

function setupDrop(zone,input,onFile){const z=$(zone),i=$(input);i.onchange=()=>{if(i.files[0])onFile(i.files[0])};["dragenter","dragover"].forEach(x=>z.addEventListener(x,e=>{e.preventDefault();z.classList.add("drag")}));["dragleave","drop"].forEach(x=>z.addEventListener(x,e=>{e.preventDefault();z.classList.remove("drag")}));z.addEventListener("drop",e=>{if(e.dataTransfer.files[0])onFile(e.dataTransfer.files[0])})}
setupDrop("#dashDrop","#dashFile",f=>{selectedDashFile=f;$("#dashFileName").textContent=`${f.name} • ${bytes(f.size)}`;$("#dashFileName").classList.remove("hidden")});
setupDrop("#verifyDrop","#verifyFile",f=>{selectedVerifyFile=f;$("#verifyFileName").textContent=`${f.name} • ${bytes(f.size)}`;$("#verifyFileName").classList.remove("hidden")});

async function loadDashboard(){
  try{
    const me=await api("/api/auth/me"); if(!me.ok) throw Error("Session expired."); const md=await me.json(); currentUser=md.user;
    $("#userName").textContent=`${currentUser.name} • ${currentUser.role}`;
    $("#welcomeName").textContent=currentUser.name;
    const [dash,fr,vr]=await Promise.all([api("/api/dashboard"),api("/api/files"),api("/api/verifications")]);
    const d=await dash.json(), fd=await fr.json(), vd=await vr.json();
    files=fd.records;
    $("#statFiles").textContent=d.registeredFiles;$("#statChecks").textContent=d.verifications;$("#statVerified").textContent=d.verified;$("#statModified").textContent=d.modified;
    renderFiles();renderHistory(vd.logs);
    $("#fileSelect").innerHTML=files.length?`<option value="">Select a registered original…</option>`+files.map(f=>`<option value="${f._id}">${esc(f.fileName)} — ${bytes(f.fileSize)}</option>`).join(""):`<option value="">No registered originals yet</option>`;
    if(currentUser.role==="admin"){ $("#adminCard").classList.remove("hidden");const ur=await api("/api/admin/users");const ud=await ur.json();$("#usersTable").innerHTML=ud.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${date(u.createdAt)}</td></tr>`).join("")}
  }catch(err){localStorage.removeItem("fileshield_token");token="";showAuth();msg("#loginMsg",err.message,"error")}
}
function renderFiles(){if(!files.length){$("#fileTable").innerHTML=`<tr><td colspan="5">No registered attendance files yet.</td></tr>`;return}$("#fileTable").innerHTML=files.map(f=>`<tr><td><b>${esc(f.fileName)}</b><br><small>${bytes(f.fileSize)}</small></td><td>${date(f.createdAt)}</td><td>${f.verificationCount||0}</td><td><code>${esc(f.hash)}</code></td><td><button class="tiny-delete" data-id="${f._id}">Delete</button></td></tr>`).join("");$$(".tiny-delete").forEach(b=>b.onclick=()=>deleteFile(b.dataset.id))}
function renderHistory(logs){if(!logs.length){$("#historyTable").innerHTML=`<tr><td colspan="4">No verification history yet.</td></tr>`;return}$("#historyTable").innerHTML=logs.map(l=>`<tr><td>${esc(l.checkedFileName)}</td><td>${esc(l.originalFileName)}</td><td><span class="badge ${l.result==="VERIFIED"?"ok":"bad"}">${l.result==="VERIFIED"?"✓ VERIFIED":"⚠ MODIFIED"}</span></td><td>${date(l.checkedAt)}</td></tr>`).join("")}
async function deleteFile(id){if(!confirm("Delete this registered file and its verification history?"))return;const r=await api(`/api/files/${id}`,{method:"DELETE"});const d=await r.json();if(!r.ok)return toast(d.error);toast("Registered file deleted.");loadDashboard()}
$("#refresh").onclick=loadDashboard;

$("#dashRegisterForm").onsubmit=async e=>{e.preventDefault();if(!selectedDashFile)return msg("#dashRegisterMsg","Choose an original file.","error");const fd=new FormData();fd.append("file",selectedDashFile);msg("#dashRegisterMsg","Calculating CRC-32 fingerprint…");try{const r=await api("/api/files/register",{method:"POST",body:fd});const d=await r.json();if(!r.ok)throw Error(d.error);msg("#dashRegisterMsg",`Registered successfully. CRC-32: ${d.record.hash}`,"success");selectedDashFile=null;$("#dashFileName").classList.add("hidden");loadDashboard()}catch(err){msg("#dashRegisterMsg",err.message,"error")}};

$("#dashVerifyForm").onsubmit=async e=>{e.preventDefault();const id=$("#fileSelect").value;if(!id)return msg("#dashVerifyMsg","Select a registered original.","error");if(!selectedVerifyFile)return msg("#dashVerifyMsg","Choose the file to verify.","error");const fd=new FormData();fd.append("file",selectedVerifyFile);fd.append("recordId",id);msg("#dashVerifyMsg","Comparing cryptographic fingerprints…");try{const r=await api("/api/files/verify",{method:"POST",body:fd});const d=await r.json();if(!r.ok)throw Error(d.error);renderVerification(d);msg("#dashVerifyMsg","Verification completed.","success");selectedVerifyFile=null;$("#verifyFileName").classList.add("hidden");loadDashboard()}catch(err){msg("#dashVerifyMsg",err.message,"error")}};

function renderVerification(d){const ok=d.status==="VERIFIED";const w=window.open("","_blank","width=850,height=700");if(!w){toast("Allow pop-ups to view the verification report.");return}w.document.write(`<!doctype html><html><head><title>FileShield Verification Report</title><style>body{font-family:Arial,sans-serif;padding:45px;color:#101828}h1{color:${ok?"#047857":"#b91c1c"}}.box{border:1px solid #ddd;border-radius:15px;padding:22px;margin:15px 0}code{word-break:break-all;font-size:12px}</style></head><body><h1>${ok?"✓ FILE INTEGRITY VERIFIED":"⚠ FILE MODIFICATION DETECTED"}</h1><p>FileShield Digital Attendance File Integrity Auditor</p><div class="box"><b>Original file:</b><p>${esc(d.originalFileName)}</p><b>Checked file:</b><p>${esc(d.checkedFileName)}</p><b>Original CRC-32:</b><p><code>${esc(d.originalHash)}</code></p><b>Current CRC-32:</b><p><code>${esc(d.currentHash)}</code></p><b>File size:</b><p>${bytes(d.fileSize)}</p><b>Checked at:</b><p>${date(d.checkedAt)}</p></div><button onclick="window.print()">Print / Save as PDF</button></body></html>`);w.document.close()}

(async()=>{if(token){try{const r=await api("/api/auth/me");if(r.ok){showDash();return}}catch{}token="";localStorage.removeItem("fileshield_token")}showPublic()})();