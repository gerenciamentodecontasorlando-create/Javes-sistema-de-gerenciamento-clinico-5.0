/* BTX Docs Saúde — App (Offline + Memória forte IndexedDB) */

const LOGIN_KEY = "btx007"; // minúsculo, sem traço

const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 2600);
}

function esc(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function isoToBR(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
}
function nowBR(){
  const d = new Date();
  const data = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
  return `${data} • ${hora}`;
}
function startOfWeekISO(iso){ // segunda
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d, 12,0,0);
  const day = dt.getDay(); // 0 dom .. 6 sab
  const diff = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diff);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDaysISO(iso, n){
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d, 12,0,0);
  dt.setDate(dt.getDate()+n);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =========================
   IndexedDB (memória forte)
   ========================= */
const DB_NAME = "btx_docs_db_v1";
const DB_VER = 1;

let db = null;

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;

      if(!d.objectStoreNames.contains("kv")){
        d.createObjectStore("kv", { keyPath: "key" });
      }
      if(!d.objectStoreNames.contains("patients")){
        const s = d.createObjectStore("patients", { keyPath: "id" });
        s.createIndex("by_name", "name", { unique:false });
        s.createIndex("by_phone", "phone", { unique:false });
      }
      if(!d.objectStoreNames.contains("agenda")){
        const s = d.createObjectStore("agenda", { keyPath: "id" });
        s.createIndex("by_date", "date", { unique:false });
      }
      if(!d.objectStoreNames.contains("notes")){
        const s = d.createObjectStore("notes", { keyPath: "id" });
        s.createIndex("by_patient", "patientId", { unique:false });
        s.createIndex("by_date", "date", { unique:false });
      }
      if(!d.objectStoreNames.contains("drafts")){
        d.createObjectStore("drafts", { keyPath: "key" }); // key = tab name
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode="readonly"){
  const t = db.transaction(store, mode);
  return t.objectStore(store);
}

function kvSet(key, value){
  return new Promise((res, rej)=>{
    const req = tx("kv","readwrite").put({key, value});
    req.onsuccess=()=>res(true);
    req.onerror=()=>rej(req.error);
  });
}
function kvGet(key){
  return new Promise((res, rej)=>{
    const req = tx("kv","readonly").get(key);
    req.onsuccess=()=>res(req.result ? req.result.value : null);
    req.onerror=()=>rej(req.error);
  });
}

function put(store, obj){
  return new Promise((res, rej)=>{
    const req = tx(store,"readwrite").put(obj);
    req.onsuccess=()=>res(obj);
    req.onerror=()=>rej(req.error);
  });
}
function del(store, id){
  return new Promise((res, rej)=>{
    const req = tx(store,"readwrite").delete(id);
    req.onsuccess=()=>res(true);
    req.onerror=()=>rej(req.error);
  });
}
function get(store, id){
  return new Promise((res, rej)=>{
    const req = tx(store,"readonly").get(id);
    req.onsuccess=()=>res(req.result || null);
    req.onerror=()=>rej(req.error);
  });
}
function getAll(store){
  return new Promise((res, rej)=>{
    const req = tx(store,"readonly").getAll();
    req.onsuccess=()=>res(req.result || []);
    req.onerror=()=>rej(req.error);
  });
}
function getAllByIndex(store, indexName, value){
  return new Promise((res, rej)=>{
    const st = tx(store,"readonly");
    const idx = st.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess=()=>res(req.result || []);
    req.onerror=()=>rej(req.error);
  });
}

function uid(prefix="id"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* =========================
   Login (bloqueio local)
   ========================= */
const LS_LOGIN_OK = "btx_login_ok_v1";

function showLogin(){
  $("loginOverlay").classList.add("show");
  $("loginOverlay").setAttribute("aria-hidden","false");
  $("loginHint").textContent = "";
  $("loginKey").value = "";
  setTimeout(()=> $("loginKey").focus(), 50);
}
function hideLogin(){
  $("loginOverlay").classList.remove("show");
  $("loginOverlay").setAttribute("aria-hidden","true");
}

function isLogged(){
  return localStorage.getItem(LS_LOGIN_OK) === "1";
}

function doLogin(){
  const key = ($("loginKey").value || "").trim().toLowerCase();
  if(key !== LOGIN_KEY){
    $("loginHint").textContent = "Chave inválida. Digite exatamente: btx007";
    return;
  }
  const remember = $("loginRemember").checked;
  if(remember) localStorage.setItem(LS_LOGIN_OK, "1");
  else localStorage.removeItem(LS_LOGIN_OK);
  hideLogin();
  toast("Acesso liberado ✅");
}

function logout(){
  localStorage.removeItem(LS_LOGIN_OK);
  showLogin();
}

/* =========================
   Profissional
   ========================= */
async function loadProf(){
  return await kvGet("prof");
}
async function saveProf(data){
  await kvSet("prof", data);
}
function profLines(p){
  const cr = (p?.conselho || p?.reg) ? `${p.conselho || ""} ${p.reg || ""}`.trim() : "";
  return [p?.nome, p?.esp, cr, p?.end, p?.tel, p?.email].filter(Boolean);
}
function fillProfUI(p){
  $("profNome").value = p?.nome || "";
  $("profEsp").value = p?.esp || "";
  $("profConselho").value = p?.conselho || "";
  $("profReg").value = p?.reg || "";
  $("profEnd").value = p?.end || "";
  $("profTel").value = p?.tel || "";
  $("profEmail").value = p?.email || "";
}
function readProfUI(){
  return {
    nome: $("profNome").value.trim(),
    esp: $("profEsp").value.trim(),
    conselho: $("profConselho").value.trim(),
    reg: $("profReg").value.trim(),
    end: $("profEnd").value.trim(),
    tel: $("profTel").value.trim(),
    email: $("profEmail").value.trim(),
  };
}

/* =========================
   Pacientes (cadastro rápido)
   ========================= */
async function upsertPatient({name, phone=""}){
  const n = (name||"").trim();
  if(!n) return null;
  const p = { id: uid("p"), name: n, phone: phone.trim(), createdAt: Date.now() };
  await put("patients", p);
  return p;
}

async function searchPatients(q){
  const all = await getAll("patients");
  const s = (q||"").trim().toLowerCase();
  if(!s) return all.slice(0,30);
  return all.filter(p => (p.name||"").toLowerCase().includes(s) || (p.phone||"").includes(s)).slice(0,30);
}

/* =========================
   Agenda
   ========================= */
async function addAgendaItem(item){
  const obj = {
    id: uid("ag"),
    date: item.date,
    time: item.time || "",
    patientName: item.patientName || "",
    patientId: item.patientId || "",
    type: item.type || "consulta",
    status: item.status || "aguardando",
    obs: item.obs || "",
    createdAt: Date.now()
  };
  await put("agenda", obj);
  return obj;
}

async function getAgendaByDate(dateISO){
  const list = await getAllByIndex("agenda","by_date",dateISO);
  list.sort((a,b)=> (a.time||"").localeCompare(b.time||""));
  return list;
}

async function getAgendaWeek(startISO){
  const days = Array.from({length:7}, (_,i)=>addDaysISO(startISO,i));
  const all = await getAll("agenda");
  const set = new Set(days);
  const list = all.filter(it=> set.has(it.date));
  list.sort((a,b)=> ((a.date+" "+(a.time||"")).localeCompare(b.date+" "+(b.time||""))));
  return {days, list};
}

/* =========================
   Prontuário / Notas
   ========================= */
async function addNote({patientId, patientName, date, text}){
  const obj = {
    id: uid("nt"),
    patientId: patientId || "",
    patientName: patientName || "",
    date: date || todayISO(),
    text: (text||"").trim(),
    createdAt: Date.now()
  };
  await put("notes", obj);
  return obj;
}

async function getNotesByPatient(patientId){
  const list = await getAllByIndex("notes","by_patient",patientId);
  list.sort((a,b)=> (b.date||"").localeCompare(a.date||"") || b.createdAt - a.createdAt);
  return list;
}

/* =========================
   Drafts (rascunhos por aba)
   ========================= */
async function saveDraft(tabKey, data){
  await put("drafts", {key: tabKey, value: data});
}
async function loadDraft(tabKey){
  const r = await get("drafts", tabKey);
  return r ? r.value : null;
}

/* =========================
   Receituário presets (1-clique)
   ========================= */
const RX = {
  // Analgésicos
  dipirona: "Dipirona 500mg\nTomar 01 comprimido a cada 6–8 horas, se dor ou febre, por até 3 dias.",
  paracetamol: "Paracetamol 750mg\nTomar 01 comprimido a cada 8 horas, se dor ou febre, por até 3 dias.",

  // Anti-inflamatórios
  ibuprofeno: "Ibuprofeno 400mg\nTomar 01 comprimido a cada 8 horas, após alimentação, por 3 dias.",
  nimesulida: "Nimesulida 100mg\nTomar 01 comprimido a cada 12 horas, após alimentação, por 3 dias.",
  diclofenaco: "Diclofenaco de potássio 50mg\nTomar 01 comprimido a cada 8–12 horas, após alimentação, por 3 dias.",

  // Antibióticos
  amoxicilina: "Amoxicilina 500mg\nTomar 01 cápsula a cada 8 horas por 7 dias.",
  azitromicina: "Azitromicina 500mg\nTomar 01 comprimido ao dia por 3 dias.",
  amoxclav: "Amoxicilina 875mg + Clavulanato 125mg\nTomar 01 comprimido a cada 12 horas por 7 dias.",

  // Hipertensão
  losartana: "Losartana 50mg\nTomar 01 comprimido ao dia (conforme prescrição).",
  enalapril: "Enalapril 10mg\nTomar 01 comprimido ao dia (conforme prescrição).",
  amlodipino: "Amlodipino 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
  hctz: "Hidroclorotiazida 25mg\nTomar 01 comprimido ao dia (conforme prescrição).",

  // Diabetes
  metformina: "Metformina 500mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição).",
  glibenclamida: "Glibenclamida 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
  glicazida: "Glicazida MR 30mg\nTomar 01 comprimido ao dia (conforme prescrição).",

  // Antifúngicos / Dermato
  fluconazol: "Fluconazol 150mg\nTomar 01 cápsula dose única (ou conforme prescrição).",
  cetoconazol_creme: "Cetoconazol creme\nAplicar fina camada 1–2x ao dia por 2–4 semanas (conforme orientação).",
  miconazol_creme: "Miconazol creme\nAplicar fina camada 2x ao dia por 7–14 dias (conforme orientação).",
  terbinafina_creme: "Terbinafina creme\nAplicar 1x ao dia por 1–2 semanas (conforme orientação).",
  shampoo_cetoconazol: "Shampoo cetoconazol 2%\nAplicar no couro cabeludo, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas."
};

function appendRx(key){
  const ta = $("rxText");
  const txt = RX[key];
  if(!ta || !txt) return;
  const cur = ta.value.trim();
  ta.value = cur ? (cur + "\n\n" + txt) : txt;
  buildPreview();
  saveRxDraft();
}

/* =========================
   TABS
   ========================= */
let currentTab = "agenda";

const TABS = {
  agenda: {
    title: "Agenda",
    sub: "Dia e Semana, offline, com memória forte.",
    render: async () => {
      const draft = await loadDraft("agenda") || { date: todayISO() };
      return `
        <label>Data</label>
        <input id="agDate" type="date" value="${esc(draft.date || todayISO())}" />

        <div class="row">
          <div>
            <label>Hora</label>
            <input id="agTime" type="time" />
          </div>
          <div>
            <label>Paciente (busca rápida)</label>
            <input id="agSearch" placeholder="Digite nome ou telefone..." />
          </div>
        </div>

        <label>Selecionar paciente (opcional)</label>
        <select id="agPatientPick">
          <option value="">— digite acima ou cadastre —</option>
        </select>

        <div class="row">
          <div>
            <label>Tipo</label>
            <select id="agType">
              <option value="consulta">consulta</option>
              <option value="retorno">retorno</option>
              <option value="procedimento">procedimento</option>
              <option value="avaliacao">avaliação</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="agStatus">
              <option value="aguardando">aguardando</option>
              <option value="confirmado">confirmado</option>
              <option value="remarcado">remarcado</option>
              <option value="faltou">faltou</option>
              <option value="concluido">concluído</option>
            </select>
          </div>
        </div>

        <label>Observações</label>
        <input id="agObs" placeholder="Ex: retorno pós-op, dor, etc." />

        <div class="actions" style="justify-content:flex-start; margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnAgSave">Salvar</button>
          <button class="btn btn-ghost" type="button" id="btnAgToday">Hoje</button>
          <button class="btn btn-ghost" type="button" id="btnAgWeek">Semana</button>
        </div>

        <div class="small" style="margin-top:10px;">
          Dica: “Semana” gera a lista completa (segunda→domingo) no PDF.
        </div>
      `;
    },
    after: async () => {
      const dateEl = $("agDate");
      const searchEl = $("agSearch");
      const pickEl = $("agPatientPick");

      async function refreshPick(){
        const q = searchEl.value || "";
        const list = await searchPatients(q);
        pickEl.innerHTML = `<option value="">— digite acima ou cadastre —</option>` +
          list.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.phone ? " • "+esc(p.phone) : ""}</option>`).join("");
      }

      searchEl.addEventListener("input", async ()=>{
        await refreshPick();
        await saveDraft("agenda", {date: dateEl.value || todayISO()});
      });

      dateEl.addEventListener("change", async ()=>{
        await saveDraft("agenda", {date: dateEl.value || todayISO()});
        buildPreview();
      });

      await refreshPick();

      $("btnAgToday").addEventListener("click", async ()=>{
        dateEl.value = todayISO();
        await saveDraft("agenda", {date: dateEl.value});
        buildPreview();
      });

      $("btnAgWeek").addEventListener("click", async ()=>{
        // força preview da semana
        window.__agendaMode = "week";
        buildPreview();
      });

      $("btnAgSave").addEventListener("click", async ()=>{
        const date = dateEl.value || todayISO();
        const pickedId = pickEl.value || "";
        let patientName = "";

        if(pickedId){
          const p = await get("patients", pickedId);
          patientName = p?.name || "";
        }

        // se não escolheu na lista, usa o que digitou (isso resolve teu problema do nome sumindo)
        if(!patientName){
          patientName = (searchEl.value || "").trim();
        }

        if(!patientName){
          alert("Digite o nome do paciente (ou selecione).");
          return;
        }

        await addAgendaItem({
          date,
          time: $("agTime").value || "",
          patientId: pickedId,
          patientName,
          type: $("agType").value,
          status: $("agStatus").value,
          obs: $("agObs").value || ""
        });

        $("agTime").value = "";
        $("agObs").value = "";
        toast("Agendamento salvo ✅");
        window.__agendaMode = "day";
        buildPreview();
      });

      window.__agendaMode = "day"; // default
    },
    build: async () => {
      const date = $("agDate")?.value || todayISO();
      const mode = window.__agendaMode || "day";

      if(mode === "week"){
        const start = startOfWeekISO(date);
        const {days, list} = await getAgendaWeek(start);

        const rows = list.map(it=>`
          <tr>
            <td>${esc(isoToBR(it.date))}</td>
            <td>${esc(it.time||"")}</td>
            <td>${esc(it.patientName||"")}</td>
            <td>${esc(it.type||"")}</td>
            <td>${esc(it.status||"")}</td>
            <td>${esc(it.obs||"")}</td>
          </tr>
        `).join("");

        return `
          <div class="doc-title">Agenda da semana (início: ${esc(isoToBR(start))})</div>
          ${rows ? `
            <table>
              <thead><tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          ` : `<p class="doc-line">Nenhum agendamento nesta semana.</p>`}
        `;
      }

      const list = await getAgendaByDate(date);
      const rows = list.map(it=>`
        <tr>
          <td>${esc(it.time||"")}</td>
          <td>${esc(it.patientName||"")}</td>
          <td>${esc(it.type||"")}</td>
          <td>${esc(it.status||"")}</td>
          <td>${esc(it.obs||"")}</td>
        </tr>
      `).join("");

      return `
        <div class="doc-title">Agenda do dia ${esc(isoToBR(date))}</div>
        ${rows ? `
          <table>
            <thead><tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `<p class="doc-line">Nenhum agendamento.</p>`}
      `;
    }
  },

  prontuario: {
    title: "Prontuário",
    sub: "Registro clínico por paciente (visão por semana e histórico).",
    render: async () => {
      return `
        <label>Buscar paciente</label>
        <input id="prSearch" placeholder="Digite nome ou telefone..." />

        <label>Selecionar paciente</label>
        <select id="prPick">
          <option value="">— selecione —</option>
        </select>

        <div class="row">
          <div>
            <label>Semana (qualquer dia da semana)</label>
            <input id="prWeek" type="date" value="${todayISO()}" />
          </div>
          <div>
            <label>Data do atendimento</label>
            <input id="prDate" type="date" value="${todayISO()}" />
          </div>
        </div>

        <label>Registro / Procedimentos realizados</label>
        <textarea id="prText" placeholder="Descreva o que foi feito, conduta, observações..."></textarea>

        <div class="actions" style="justify-content:flex-start; margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnPrSave">Salvar registro</button>
          <button class="btn btn-ghost" type="button" id="btnPrWeekView">Ver semana</button>
          <button class="btn btn-ghost" type="button" id="btnPrHistory">Ver histórico</button>
          <button class="btn btn-ghost" type="button" id="btnPrNewPatient">Cadastrar paciente</button>
        </div>

        <div class="small" style="margin-top:10px;">
          “Ver semana” monta o PDF com todos os registros daquela semana para o paciente selecionado.
        </div>
      `;
    },
    after: async () => {
      const searchEl = $("prSearch");
      const pickEl = $("prPick");

      async function refreshPick(){
        const list = await searchPatients(searchEl.value || "");
        pickEl.innerHTML = `<option value="">— selecione —</option>` +
          list.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.phone ? " • "+esc(p.phone) : ""}</option>`).join("");
      }
      searchEl.addEventListener("input", refreshPick);
      await refreshPick();

      $("btnPrNewPatient").addEventListener("click", async ()=>{
        const name = prompt("Nome do paciente:");
        if(!name) return;
        const phone = prompt("Telefone (opcional):") || "";
        await upsertPatient({name, phone});
        toast("Paciente cadastrado ✅");
        await refreshPick();
      });

      $("btnPrSave").addEventListener("click", async ()=>{
        const pid = pickEl.value;
        if(!pid){ alert("Selecione um paciente."); return; }
        const p = await get("patients", pid);
        const text = ($("prText").value || "").trim();
        if(!text){ alert("Digite o registro/procedimento."); return; }

        await addNote({
          patientId: pid,
          patientName: p?.name || "",
          date: $("prDate").value || todayISO(),
          text
        });
        $("prText").value = "";
        toast("Registro salvo ✅");
        window.__prMode = "week";
        buildPreview();
      });

      $("btnPrWeekView").addEventListener("click", ()=>{
        window.__prMode = "week";
        buildPreview();
      });
      $("btnPrHistory").addEventListener("click", ()=>{
        window.__prMode = "history";
        buildPreview();
      });

      window.__prMode = "week";
    },
    build: async () => {
      const pid = $("prPick")?.value || "";
      if(!pid) return `<p class="doc-line">Selecione um paciente para gerar o prontuário.</p>`;

      const p = await get("patients", pid);
      const mode = window.__prMode || "week";
      const weekAny = $("prWeek")?.value || todayISO();
      const start = startOfWeekISO(weekAny);
      const days = Array.from({length:7}, (_,i)=>addDaysISO(start,i));
      const notes = await getNotesByPatient(pid);

      const header = `
        <div class="doc-title">Paciente</div>
        <p class="doc-line"><strong>Nome:</strong> ${esc(p?.name||"")}</p>
        ${p?.phone ? `<p class="doc-line"><strong>Telefone:</strong> ${esc(p.phone)}</p>` : ""}
      `;

      if(mode === "history"){
        const rows = notes.map(n=>`
          <div class="doc-title">${esc(isoToBR(n.date))}</div>
          <div class="doc-block">${esc(n.text)}</div>
        `).join("") || `<p class="doc-line">Nenhum registro ainda.</p>`;

        return header + `<div class="doc-title">Histórico completo</div>` + rows;
      }

      // week
      const weekNotes = notes.filter(n => days.includes(n.date));
      const rows = weekNotes.map(n=>`
        <div class="doc-title">${esc(isoToBR(n.date))}</div>
        <div class="doc-block">${esc(n.text)}</div>
      `).join("") || `<p class="doc-line">Nenhum registro nesta semana.</p>`;

      return header + `<div class="doc-title">Semana (início: ${esc(isoToBR(start))})</div>` + rows;
    }
  },

  ficha: {
    title: "Ficha clínica",
    sub: "Identificação, anamnese e planejamento.",
    render: async () => {
      const d = await loadDraft("ficha") || {};
      return `
        <label>Paciente</label>
        <input id="fPaciente" value="${esc(d.paciente||"")}" />

        <div class="row">
          <div>
            <label>Nascimento</label>
            <input id="fNasc" type="date" value="${esc(d.nasc||"")}" />
          </div>
          <div>
            <label>Telefone</label>
            <input id="fTel" value="${esc(d.tel||"")}" />
          </div>
        </div>

        <label>Endereço</label>
        <input id="fEnd" value="${esc(d.end||"")}" />

        <label>Motivo da consulta</label>
        <textarea id="fMotivo">${esc(d.motivo||"")}</textarea>

        <label>Anamnese</label>
        <textarea id="fAnamnese">${esc(d.anamnese||"")}</textarea>

        <label>Planejamento</label>
        <textarea id="fPlan">${esc(d.plan||"")}</textarea>

        <label>Procedimentos realizados hoje</label>
        <textarea id="fProc">${esc(d.proc||"")}</textarea>
      `;
    },
    after: async () => {
      const ids = ["fPaciente","fNasc","fTel","fEnd","fMotivo","fAnamnese","fPlan","fProc"];
      ids.forEach(id=>{
        $(id).addEventListener("input", saveFichaDraft);
        $(id).addEventListener("change", saveFichaDraft);
      });
    },
    build: async () => {
      const paciente = ($("fPaciente")?.value||"").trim();
      return [
        paciente ? `<p class="doc-line"><strong>Paciente:</strong> ${esc(paciente)}</p>` : "",
        $("fNasc")?.value ? `<p class="doc-line"><strong>Nascimento:</strong> ${esc(isoToBR($("fNasc").value))}</p>` : "",
        $("fTel")?.value ? `<p class="doc-line"><strong>Telefone:</strong> ${esc($("fTel").value)}</p>` : "",
        $("fEnd")?.value ? `<p class="doc-line"><strong>Endereço:</strong> ${esc($("fEnd").value)}</p>` : "",
        block("Motivo da consulta", $("fMotivo")?.value),
        block("Anamnese", $("fAnamnese")?.value),
        block("Planejamento", $("fPlan")?.value),
        block("Procedimentos realizados hoje", $("fProc")?.value),
      ].filter(Boolean).join("");
    }
  },

  receita: {
    title: "Receituário",
    sub: "Somente o essencial no PDF. Botões 1-clique + campo editável.",
    render: async () => {
      const d = await loadDraft("receita") || { data: todayISO() };
      return `
        <div class="row">
          <div>
            <label>Paciente</label>
            <input id="rxPaciente" value="${esc(d.paciente||"")}" />
          </div>
        </div>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rxCidade" value="${esc(d.cidade||"")}" placeholder="Ex.: Belém" />
          </div>
          <div>
            <label>Data</label>
            <input id="rxData" type="date" value="${esc(d.data||todayISO())}" />
          </div>
        </div>

        <div class="doc-title">Medicações (1 clique)</div>

        <div class="small" style="margin-top:6px;">Analgésicos</div>
        <div class="pillgrid">
          <button class="pillbtn" type="button" data-rx="dipirona">dipirona</button>
          <button class="pillbtn" type="button" data-rx="paracetamol">paracetamol</button>
        </div>

        <div class="small" style="margin-top:10px;">Anti-inflamatórios</div>
        <div class="pillgrid">
          <button class="pillbtn" type="button" data-rx="ibuprofeno">ibuprofeno</button>
          <button class="pillbtn" type="button" data-rx="nimesulida">nimesulida</button>
          <button class="pillbtn" type="button" data-rx="diclofenaco">diclofenaco</button>
        </div>

        <div class="small" style="margin-top:10px;">Antibióticos</div>
        <div class="pillgrid">
          <button class="pillbtn" type="button" data-rx="amoxicilina">amoxicilina</button>
          <button class="pillbtn" type="button" data-rx="azitromicina">azitromicina</button>
          <button class="pillbtn" type="button" data-rx="amoxclav">amox+clav</button>
        </div>

        <div class="small" style="margin-top:10px;">Hipertensão</div>
        <div class="pillgrid">
          <button class="pillbtn" type="button" data-rx="losartana">losartana</button>
          <button class="pillbtn" type="button" data-rx="enalapril">enalapril</button>
          <button class="pillbtn" type="button" data-rx="amlodipino">amlodipino</button>
          <button class="pillbtn" type="button" data-rx="hctz">HCTZ</button>
        </div>

        <div class="small" style="margin-top:10px;">Diabetes</div>
        <div class="pillgrid">
          <button class="pillbtn" type="button" data-rx="metformina">metformina</button>
          <button class="pillbtn" type="button" data-rx="glibenclamida">glibenclamida</button>
          <button class="pillbtn" type="button" data-rx="glicazida">glicazida</button>
        </div>

        <div class="small" style="margin-top:10px;">Antifúngicos / Dermatológicos</div>
        <div class="pillgrid">
          <button class="pillbtn" type="button" data-rx="fluconazol">fluconazol</button>
          <button class="pillbtn" type="button" data-rx="cetoconazol_creme">cetoconazol creme</button>
          <button class="pillbtn" type="button" data-rx="miconazol_creme">miconazol creme</button>
          <button class="pillbtn" type="button" data-rx="terbinafina_creme">terbinafina creme</button>
          <button class="pillbtn" type="button" data-rx="shampoo_cetoconazol">shampoo cetoconazol</button>
        </div>

        <label style="margin-top:12px;">Prescrição (editável)</label>
        <textarea id="rxText" placeholder="As medicações escolhidas aparecem aqui...">${esc(d.text||"")}</textarea>

        <label>Orientações adicionais (opcional)</label>
        <textarea id="rxOrient" placeholder="Ex.: repouso, retorno, cuidados...">${esc(d.orient||"")}</textarea>
      `;
    },
    after: async () => {
      $("rxPaciente").addEventListener("input", saveRxDraft);
      $("rxCidade").addEventListener("input", saveRxDraft);
      $("rxData").addEventListener("change", saveRxDraft);
      $("rxText").addEventListener("input", saveRxDraft);
      $("rxOrient").addEventListener("input", saveRxDraft);

      $("formPanel").querySelectorAll("[data-rx]").forEach(btn=>{
        btn.addEventListener("click", ()=>appendRx(btn.dataset.rx));
      });
    },
    build: async () => {
      const paciente = ($("rxPaciente")?.value||"").trim();
      const cidade = ($("rxCidade")?.value||"").trim() || "Cidade";
      const data = $("rxData")?.value || todayISO();

      const presc = ($("rxText")?.value||"").trim();
      const orient = ($("rxOrient")?.value||"").trim();

      return `
        ${paciente ? `<p class="doc-line"><strong>Paciente:</strong> ${esc(paciente)}</p>` : ""}
        <div class="doc-title">Prescrição</div>
        <div class="doc-block">${esc(presc || "—")}</div>
        ${orient ? `<div class="doc-title">Orientações</div><div class="doc-block">${esc(orient)}</div>` : ""}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(isoToBR(data))}</p>
      `;
    }
  },

  recibo: {
    title: "Recibo",
    sub: "Comprovação de pagamento / prestação de serviço.",
    render: async () => {
      const d = await loadDraft("recibo") || { data: todayISO() };
      return `
        <label>Pagador (paciente)</label>
        <input id="rcPagador" value="${esc(d.pagador||"")}" />

        <div class="row">
          <div>
            <label>Valor recebido (R$)</label>
            <input id="rcValor" type="number" step="0.01" value="${esc(d.valor||"")}" />
          </div>
          <div>
            <label>Forma de pagamento</label>
            <input id="rcForma" value="${esc(d.forma||"")}" placeholder="PIX / dinheiro / cartão" />
          </div>
        </div>

        <label>Referente a</label>
        <input id="rcRef" value="${esc(d.ref||"")}" placeholder="Ex.: Consulta / Procedimento..." />

        <label>Observações (opcional)</label>
        <textarea id="rcObs">${esc(d.obs||"")}</textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rcCidade" value="${esc(d.cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="rcData" type="date" value="${esc(d.data||todayISO())}" />
          </div>
        </div>
      `;
    },
    after: async () => {
      ["rcPagador","rcValor","rcForma","rcRef","rcObs","rcCidade","rcData"].forEach(id=>{
        $(id).addEventListener("input", saveReciboDraft);
        $(id).addEventListener("change", saveReciboDraft);
      });
    },
    build: async () => {
      const pagador = ($("rcPagador")?.value||"").trim();
      const valor = ($("rcValor")?.value||"").trim();
      const referente = ($("rcRef")?.value||"").trim();
      const forma = ($("rcForma")?.value||"").trim();
      const cidade = ($("rcCidade")?.value||"").trim() || "Cidade";
      const data = $("rcData")?.value || todayISO();

      const v = valor ? Number(valor).toFixed(2) : "0.00";

      return `
        <div class="doc-title">Recibo</div>
        <p class="doc-line">Recebi de <strong>${esc(pagador||"—")}</strong> a quantia de <strong>R$ ${esc(v)}</strong>.</p>
        ${referente ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(referente)}</p>` : ""}
        ${forma ? `<p class="doc-line"><strong>Forma:</strong> ${esc(forma)}</p>` : ""}
        ${block("Observações", $("rcObs")?.value)}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(isoToBR(data))}</p>
      `;
    }
  },

  orcamento: {
    title: "Orçamento",
    sub: "Procedimentos e valores, pronto para impressão.",
    render: async () => {
      const d = await loadDraft("orcamento") || { data: todayISO(), itens: Array.from({length:10}, ()=>({desc:"", valor:""})) };
      const rows = d.itens.map((it, i)=>`
        <div class="row">
          <div>
            <label>Procedimento ${i+1}</label>
            <input id="oD${i}" value="${esc(it.desc||"")}" />
          </div>
          <div>
            <label>Valor ${i+1} (R$)</label>
            <input id="oV${i}" type="number" step="0.01" value="${esc(it.valor||"")}" />
          </div>
        </div>
      `).join("");

      return `
        <label>Paciente</label>
        <input id="oPaciente" value="${esc(d.paciente||"")}" />

        <label>Observações</label>
        <textarea id="oObs">${esc(d.obs||"")}</textarea>

        <div style="margin:10px 0 6px;" class="small">Até 10 itens:</div>
        ${rows}

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="oCidade" value="${esc(d.cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="oData" type="date" value="${esc(d.data||todayISO())}" />
          </div>
        </div>
      `;
    },
    after: async () => {
      const ids = ["oPaciente","oObs","oCidade","oData", ...Array.from({length:10}, (_,i)=>`oD${i}`), ...Array.from({length:10}, (_,i)=>`oV${i}`)];
      ids.forEach(id=>{
        $(id).addEventListener("input", saveOrcDraft);
        $(id).addEventListener("change", saveOrcDraft);
      });
    },
    build: async () => {
      const paciente = ($("oPaciente")?.value||"").trim();
      const cidade = ($("oCidade")?.value||"").trim() || "Cidade";
      const data = $("oData")?.value || todayISO();

      const itens = [];
      for(let i=0;i<10;i++){
        const desc = ($(`oD${i}`)?.value||"").trim();
        const v = ($(`oV${i}`)?.value||"").trim();
        if(desc || v){
          itens.push({desc, valor: v ? Number(v) : 0});
        }
      }

      let table = "";
      if(itens.length){
        const total = itens.reduce((a,b)=>a+(b.valor||0),0);
        table = `
          <div class="doc-title">Procedimentos</div>
          <table>
            <thead><tr><th>Procedimento</th><th>Valor (R$)</th></tr></thead>
            <tbody>${itens.map(it=>`<tr><td>${esc(it.desc)}</td><td>${(it.valor||0).toFixed(2)}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td>Total</td><td>${total.toFixed(2)}</td></tr></tfoot>
          </table>
        `;
      } else {
        table = `<p class="doc-line">Nenhum procedimento informado.</p>`;
      }

      return `
        ${paciente ? `<p class="doc-line"><strong>Paciente:</strong> ${esc(paciente)}</p>` : ""}
        ${table}
        ${block("Observações", $("oObs")?.value)}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(isoToBR(data))}</p>
      `;
    }
  },

  laudo: {
    title: "Laudo",
    sub: "Relatório estruturado com conclusão.",
    render: async () => {
      const d = await loadDraft("laudo") || { data: todayISO() };
      return `
        <label>Paciente</label>
        <input id="lPaciente" value="${esc(d.paciente||"")}" />

        <label>Título</label>
        <input id="lTitulo" value="${esc(d.titulo||"")}" placeholder="Ex.: Laudo clínico..." />

        <label>Descrição</label>
        <textarea id="lDesc">${esc(d.desc||"")}</textarea>

        <label>Conclusão</label>
        <textarea id="lConc">${esc(d.conc||"")}</textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="lCidade" value="${esc(d.cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="lData" type="date" value="${esc(d.data||todayISO())}" />
          </div>
        </div>
      `;
    },
    after: async () => {
      ["lPaciente","lTitulo","lDesc","lConc","lCidade","lData"].forEach(id=>{
        $(id).addEventListener("input", saveLaudoDraft);
        $(id).addEventListener("change", saveLaudoDraft);
      });
    },
    build: async () => {
      const paciente = ($("lPaciente")?.value||"").trim();
      const cidade = ($("lCidade")?.value||"").trim() || "Cidade";
      const data = $("lData")?.value || todayISO();

      return `
        ${paciente ? `<p class="doc-line"><strong>Paciente:</strong> ${esc(paciente)}</p>` : ""}
        ${$("lTitulo")?.value ? `<p class="doc-line"><strong>Título:</strong> ${esc($("lTitulo").value)}</p>` : ""}
        ${block("Descrição", $("lDesc")?.value)}
        ${block("Conclusão", $("lConc")?.value)}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(isoToBR(data))}</p>
      `;
    }
  },

  atestado: {
    title: "Atestado",
    sub: "Justificativa e dias de afastamento (opcional).",
    render: async () => {
      const d = await loadDraft("atestado") || { data: todayISO() };
      return `
        <label>Paciente</label>
        <input id="aPaciente" value="${esc(d.paciente||"")}" />

        <label>Dias de afastamento (opcional)</label>
        <input id="aDias" type="number" min="0" step="1" value="${esc(d.dias||"")}" placeholder="Ex.: 2" />

        <label>Descrição / justificativa</label>
        <textarea id="aDesc" placeholder="Ex.: Necessita afastamento de suas atividades por motivo de saúde.">${esc(d.desc||"")}</textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="aCidade" value="${esc(d.cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="aData" type="date" value="${esc(d.data||todayISO())}" />
          </div>
        </div>
      `;
    },
    after: async () => {
      ["aPaciente","aDias","aDesc","aCidade","aData"].forEach(id=>{
        $(id).addEventListener("input", saveAtestadoDraft);
        $(id).addEventListener("change", saveAtestadoDraft);
      });
    },
    build: async () => {
      const paciente = ($("aPaciente")?.value||"").trim();
      const cidade = ($("aCidade")?.value||"").trim() || "Cidade";
      const data = $("aData")?.value || todayISO();
      const dias = Number(($("aDias")?.value||"").trim());
      const desc = ($("aDesc")?.value||"").trim();

      return `
        ${paciente ? `<p class="doc-line"><strong>Paciente:</strong> ${esc(paciente)}</p>` : ""}
        ${(dias && !Number.isNaN(dias) && dias>0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : ""}
        ${block("Atesto", desc)}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(isoToBR(data))}</p>
      `;
    }
  }
};

function block(title, value){
  const v = (value||"").trim();
  if(!v) return "";
  return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(v)}</div></div>`;
}

/* Draft savers */
async function saveFichaDraft(){
  await saveDraft("ficha", {
    paciente: $("fPaciente").value, nasc: $("fNasc").value, tel: $("fTel").value,
    end: $("fEnd").value, motivo: $("fMotivo").value, anamnese: $("fAnamnese").value,
    plan: $("fPlan").value, proc: $("fProc").value
  });
}
async function saveRxDraft(){
  await saveDraft("receita", {
    paciente: $("rxPaciente").value, cidade: $("rxCidade").value, data: $("rxData").value,
    text: $("rxText").value, orient: $("rxOrient").value
  });
}
async function saveReciboDraft(){
  await saveDraft("recibo", {
    pagador: $("rcPagador").value, valor: $("rcValor").value, forma: $("rcForma").value,
    ref: $("rcRef").value, obs: $("rcObs").value, cidade: $("rcCidade").value, data: $("rcData").value
  });
}
async function saveOrcDraft(){
  const itens = Array.from({length:10}, (_,i)=>({desc: $(`oD${i}`).value, valor: $(`oV${i}`).value}));
  await saveDraft("orcamento", {
    paciente: $("oPaciente").value, obs: $("oObs").value, cidade: $("oCidade").value, data: $("oData").value,
    itens
  });
}
async function saveLaudoDraft(){
  await saveDraft("laudo", {
    paciente: $("lPaciente").value, titulo: $("lTitulo").value, desc: $("lDesc").value,
    conc: $("lConc").value, cidade: $("lCidade").value, data: $("lData").value
  });
}
async function saveAtestadoDraft(){
  await saveDraft("atestado", {
    paciente: $("aPaciente").value, dias: $("aDias").value, desc: $("aDesc").value,
    cidade: $("aCidade").value, data: $("aData").value
  });
}

/* =========================
   Render / Preview
   ========================= */
async function renderTab(tab){
  currentTab = tab;

  document.querySelectorAll(".tabbtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  $("docTitle").textContent = TABS[tab].title;
  $("docSub").textContent = TABS[tab].sub;

  $("formPanel").innerHTML = await TABS[tab].render();

  // buildPreview on any input
  $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
    el.addEventListener("input", buildPreview);
    el.addEventListener("change", buildPreview);
  });

  if (typeof TABS[tab].after === "function") await TABS[tab].after();
  await buildPreview();
}

async function buildPreview(){
  $("pvMeta").textContent = nowBR();
  $("pvTitle").textContent = TABS[currentTab].title;
  $("pvSub").textContent = TABS[currentTab].sub;

  const prof = await loadProf();
  const lines = profLines(prof);
  $("profResumo").textContent = (lines.length ? `${lines[0]}${lines[1] ? " — " + lines[1] : ""}` : "—");

  $("pvBody").innerHTML = await TABS[currentTab].build();

  // Assinatura profissional (sem “textos irrelevantes”)
  if(lines.length){
    const conselhoReg = lines[2] || "";
    const end = lines[3] || "";
    const tel = lines[4] || "";
    const email = lines[5] || "";
    const contato = [end, tel, email].filter(Boolean).join(" • ");

    $("pvSign").innerHTML = `
      <div class="sigrow">
        <div class="sig">
          <div class="line"></div>
          <div><b>${esc(lines[0] || "")}</b></div>
          <div style="font-size:12px;color:#334155;">${esc(conselhoReg)}</div>
          ${contato ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">${esc(contato)}</div>` : ""}
        </div>
        <div class="sig">
          <div class="line"></div>
          <div><b>Assinatura do(a) paciente / responsável</b></div>
          <div style="font-size:12px;color:#334155;">(quando aplicável)</div>
        </div>
      </div>
    `;
  } else {
    $("pvSign").innerHTML = `<div class="small" style="color:#374151;">(Preencha os dados do profissional para assinatura.)</div>`;
  }
}

/* =========================
   Backup / Import
   ========================= */
async function exportBackup(){
  const payload = {
    version: 1,
    exportedAt: Date.now(),
    prof: await loadProf(),
    patients: await getAll("patients"),
    agenda: await getAll("agenda"),
    notes: await getAll("notes"),
    drafts: await getAll("drafts")
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `btx_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup baixado ✅");
}

async function importBackup(file){
  const text = await file.text();
  const data = JSON.parse(text);

  if(!data || typeof data !== "object") throw new Error("Arquivo inválido.");

  if(confirm("Importar vai substituir os dados atuais. Deseja continuar?") !== true) return;

  // Zera stores e reimporta
  await resetAll(false);

  if(data.prof) await kvSet("prof", data.prof);
  for(const p of (data.patients||[])) await put("patients", p);
  for(const a of (data.agenda||[])) await put("agenda", a);
  for(const n of (data.notes||[])) await put("notes", n);
  for(const d of (data.drafts||[])) await put("drafts", d);

  await initUIFromDB();
  toast("Importação concluída ✅");
}

/* =========================
   Reset
   ========================= */
async function resetAll(confirmUser=true){
  if(confirmUser){
    if(!confirm("Tem certeza? Isso apaga tudo (profissional, pacientes, agenda e prontuário) do aparelho.")) return;
  }

  // recria o DB apagando e reabrindo
  await new Promise((res, rej)=>{
    const delReq = indexedDB.deleteDatabase(DB_NAME);
    delReq.onsuccess=()=>res(true);
    delReq.onerror=()=>rej(delReq.error);
    delReq.onblocked=()=>res(true);
  });

  db = await openDB();
  $("storageStatus").textContent = "Memória: zerada ✅";
}

/* =========================
   Download HTML do preview
   ========================= */
function downloadPreviewHTML(){
  const html = `
<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BTX Docs — Documento</title>
</head>
<body>
${$("paper").outerHTML}
</body></html>`.trim();

  const blob = new Blob([html], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `btx_documento_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Documento HTML baixado ✅");
}

/* =========================
   Init
   ========================= */
async function initUIFromDB(){
  const prof = await loadProf();
  fillProfUI(prof);

  // status
  $("netPill").textContent = navigator.onLine ? "Online" : "Offline";
  $("storageStatus").textContent = "Memória: IndexedDB ativo ✅";

  // tabs
  document.querySelectorAll(".tabbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
  });

  // prof buttons
  $("btnProfSave").addEventListener("click", async ()=>{
    const p = readProfUI();
    if(!p.nome){
      alert("Digite pelo menos o nome do profissional.");
      return;
    }
    await saveProf(p);
    toast("Profissional salvo ✅");
    buildPreview();
  });

  $("btnProfClear").addEventListener("click", async ()=>{
    await kvSet("prof", null);
    fillProfUI(null);
    toast("Profissional limpo ✅");
    buildPreview();
  });

  // global buttons
  $("btnClearForm").addEventListener("click", async ()=>{
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      if(el.type === "date") el.value = todayISO();
      else el.value = "";
    });
    toast("Formulário limpo ✅");
    buildPreview();
  });

  $("btnPrint").addEventListener("click", async ()=>{
    await buildPreview();
    window.print();
  });

  $("btnDownloadHTML").addEventListener("click", async ()=>{
    await buildPreview();
    downloadPreviewHTML();
  });

  $("btnExport").addEventListener("click", exportBackup);

  $("btnImport").addEventListener("click", ()=> $("importFile").click());
  $("importFile").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      await importBackup(file);
    }catch(err){
      alert("Falha ao importar: " + (err?.message || err));
    } finally {
      e.target.value = "";
    }
  });

  $("btnResetAll").addEventListener("click", async ()=>{
    await resetAll(true);
    await initUIFromDB();
    await renderTab("agenda");
  });

  $("btnLogout").addEventListener("click", ()=>logout());

  // Update button (forces reload)
  $("btnUpdate").addEventListener("click", ()=>location.reload());

  // online/offline pill
  window.addEventListener("online", ()=> $("netPill").textContent="Online");
  window.addEventListener("offline", ()=> $("netPill").textContent="Offline");

  // first tab
  await renderTab("agenda");
}

/* Login wiring */
$("btnLogin").addEventListener("click", doLogin);
$("loginKey").addEventListener("keydown", (e)=>{
  if(e.key === "Enter") doLogin();
});
$("btnLoginHelp").addEventListener("click", ()=>{
  alert("Chave padrão do app: btx007 (tudo minúsculo, sem traço).");
});

/* Boot */
(async ()=>{
  try{
    db = await openDB();
    if(!isLogged()) showLogin();
    else hideLogin();

    await initUIFromDB();
  }catch(err){
    alert("Erro ao iniciar memória (IndexedDB): " + (err?.message || err));
  }
})();
