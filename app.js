/* BTX Docs Saúde — app.js (offline real + IndexedDB) */

const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 2400);
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
function fmtDateBR(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
}
function nowBR(){
  const d = new Date();
  const dt = d.toLocaleDateString("pt-BR");
  const tm = d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
  return `${dt} • ${tm}`;
}
function v(id){
  const el = $(id);
  return el ? String(el.value ?? "").trim() : "";
}
function setVal(id, value){
  const el = $(id);
  if(el) el.value = value ?? "";
}

/* =========================
   IndexedDB (memória forte)
   ========================= */
const DB_NAME = "btx_docs_saude_db";
const DB_VER  = 1;

function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      if(!db.objectStoreNames.contains("patients")) db.createObjectStore("patients", { keyPath:"id" });
      if(!db.objectStoreNames.contains("agenda")) db.createObjectStore("agenda", { keyPath:"id" });
      if(!db.objectStoreNames.contains("notes")) db.createObjectStore("notes", { keyPath:"id" });
      if(!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(store, key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readonly");
    const st = tx.objectStore(store);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(store, value, keyOverride=null){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    const st = tx.objectStore(store);
    const req = keyOverride !== null ? st.put(value, keyOverride) : st.put(value);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(store, key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    const st = tx.objectStore(store);
    const req = st.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
async function idbAll(store){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readonly");
    const st = tx.objectStore(store);
    const req = st.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

const KEY_PROF = "profissional";
const draftKey = (tab) => `draft_${tab}`;

/* =========================
   Profissional
   ========================= */
function readProfUI(){
  return {
    nome: v("prof_nome"),
    esp: v("prof_esp"),
    conselho: v("prof_conselho"),
    reg: v("prof_reg"),
    end: v("prof_end"),
    tel: v("prof_tel"),
    email: v("prof_email"),
  };
}
function setProfUI(p){
  setVal("prof_nome", p?.nome || "");
  setVal("prof_esp", p?.esp || "");
  setVal("prof_conselho", p?.conselho || "");
  setVal("prof_reg", p?.reg || "");
  setVal("prof_end", p?.end || "");
  setVal("prof_tel", p?.tel || "");
  setVal("prof_email", p?.email || "");
}
function profLines(p){
  const cr = (p?.conselho || p?.reg) ? `${p.conselho || ""} ${p.reg || ""}`.trim() : "";
  return [p?.nome, p?.esp, cr, p?.end, p?.tel, p?.email].filter(Boolean);
}

/* =========================
   Pacientes + Prontuário
   ========================= */
function uid(prefix="id"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function upsertPatientFromForm(){
  const nome = v("pt_nome");
  const tel  = v("pt_tel");
  if(!nome) { alert("Digite o nome do paciente."); return null; }
  const id = v("pt_id") || uid("pt");
  const patient = {
    id,
    nome,
    nasc: v("pt_nasc"),
    tel,
    email: v("pt_email"),
    end: v("pt_end"),
    obs: v("pt_obs"),
    updatedAt: Date.now()
  };
  await idbSet("patients", patient);
  setVal("pt_id", id);
  toast("Paciente salvo ✅");
  return patient;
}

async function addNoteForPatient(patientId){
  const texto = v("note_texto");
  if(!patientId){ alert("Salve/Selecione um paciente primeiro."); return; }
  if(!texto){ alert("Descreva o procedimento/atendimento."); return; }
  const note = {
    id: uid("nt"),
    patientId,
    data: v("note_data") || todayISO(),
    hora: v("note_hora") || "",
    texto,
    createdAt: Date.now()
  };
  await idbSet("notes", note);
  setVal("note_texto", "");
  toast("Registro adicionado ✅");
  await refreshPatientNotes(patientId);
  buildPreview();
}

async function refreshPatientSelect(){
  const patients = await idbAll("patients");
  patients.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
  const sel = $("ag_patientId");
  if(!sel) return;

  const cur = sel.value || "";
  sel.innerHTML = `<option value="">— digite acima ou cadastre —</option>` +
    patients.map(p=>`<option value="${esc(p.id)}">${esc(p.nome)}${p.tel? " • "+esc(p.tel):""}</option>`).join("");
  if(cur) sel.value = cur;
}

async function refreshPatientNotes(patientId){
  const list = await idbAll("notes");
  const notes = list.filter(n=>n.patientId === patientId);
  notes.sort((a,b)=> (a.data||"").localeCompare(b.data||"") || (a.hora||"").localeCompare(b.hora||"") || (a.createdAt-b.createdAt));

  const box = $("notes_list");
  if(!box) return;

  if(!notes.length){
    box.innerHTML = `<p class="small">Sem registros ainda. Adicione o primeiro atendimento.</p>`;
    return;
  }

  box.innerHTML = notes.map(n=>`
    <div style="border:1px solid #1f2937;border-radius:12px;padding:10px;margin:8px 0;background:#060b09;">
      <div style="font-size:12px;color:#a9c8ba;margin-bottom:6px;">
        <b>${esc(fmtDateBR(n.data))}</b> ${n.hora? "• "+esc(n.hora):""}
      </div>
      <div style="white-space:pre-wrap;color:#e9fff5;font-size:13px;">${esc(n.texto)}</div>
      <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost" type="button" data-delnote="${esc(n.id)}">Excluir</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-delnote]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(!confirm("Excluir este registro?")) return;
      await idbDel("notes", btn.dataset.delnote);
      toast("Registro excluído ✅");
      await refreshPatientNotes(patientId);
      buildPreview();
    });
  });
}

/* =========================
   Agenda (semana inteira)
   ========================= */
function weekStartISO(iso){
  const d = iso ? new Date(iso+"T12:00:00") : new Date();
  const day = d.getDay(); // 0 domingo
  const diff = (day === 0 ? -6 : 1) - day; // segunda
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDaysISO(iso, add){
  const d = new Date(iso+"T12:00:00");
  d.setDate(d.getDate()+add);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
async function addAgendaItem(){
  const data = v("ag_data") || todayISO();
  const hora = v("ag_hora");
  const nome = v("ag_nome");
  const patientId = v("ag_patientId") || "";
  if(!nome && !patientId){ alert("Digite um nome ou selecione um paciente."); return; }

  const item = {
    id: uid("ag"),
    data,
    hora,
    patientId,
    nome: nome || "",
    tipo: v("ag_tipo") || "consulta",
    status: v("ag_status") || "aguardando",
    obs: v("ag_obs") || "",
    createdAt: Date.now()
  };
  await idbSet("agenda", item);

  setVal("ag_hora","");
  setVal("ag_nome","");
  setVal("ag_obs","");
  toast("Agendamento salvo ✅");
  buildPreview();
}

async function listAgenda(){
  const list = await idbAll("agenda");
  list.sort((a,b)=> (a.data||"").localeCompare(b.data||"") || (a.hora||"").localeCompare(b.hora||""));
  return list;
}

/* =========================
   Receituário (1 clique)
   ========================= */
const RX = {
  // Analgésicos
  dipirona: { label:"dipirona", text:"Dipirona 500mg\nTomar 01 comprimido a cada 6–8 horas, se dor ou febre, por até 3 dias." },
  paracetamol: { label:"paracetamol", text:"Paracetamol 750mg\nTomar 01 comprimido a cada 8 horas, se dor ou febre, por até 3 dias." },

  // Anti-inflamatórios
  ibuprofeno: { label:"ibuprofeno", text:"Ibuprofeno 400mg\nTomar 01 comprimido a cada 8 horas, após alimentação, por 3 dias." },
  nimesulida: { label:"nimesulida", text:"Nimesulida 100mg\nTomar 01 comprimido a cada 12 horas, após alimentação, por 3 dias." },
  diclofenaco: { label:"diclofenaco", text:"Diclofenaco de potássio 50mg\nTomar 01 comprimido a cada 8–12 horas, após alimentação, por 3 dias." },

  // Antibióticos
  amoxicilina: { label:"amoxicilina", text:"Amoxicilina 500mg\nTomar 01 cápsula a cada 8 horas por 7 dias." },
  azitromicina: { label:"azitromicina", text:"Azitromicina 500mg\nTomar 01 comprimido ao dia por 3 dias." },
  amoxclav: { label:"amox+clav", text:"Amoxicilina 875mg + Clavulanato 125mg\nTomar 01 comprimido a cada 12 horas por 7 dias." },

  // Hipertensão
  losartana: { label:"losartana", text:"Losartana 50mg\nTomar 01 comprimido ao dia (conforme prescrição)." },
  enalapril: { label:"enalapril", text:"Enalapril 10mg\nTomar 01 comprimido ao dia (conforme prescrição)." },
  amlodipino: { label:"amlodipino", text:"Amlodipino 5mg\nTomar 01 comprimido ao dia (conforme prescrição)." },
  hctz: { label:"HCTZ", text:"Hidroclorotiazida 25mg\nTomar 01 comprimido ao dia (conforme prescrição)." },

  // Diabetes
  metformina: { label:"metformina", text:"Metformina 500mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição)." },
  glibenclamida: { label:"glibenclamida", text:"Glibenclamida 5mg\nTomar 01 comprimido ao dia (conforme prescrição)." },
  gliclazida: { label:"gliclazida", text:"Gliclazida 30mg (liberação modificada)\nTomar 01 comprimido ao dia (conforme prescrição)." },

  // Antifúngicos / Dermato
  fluconazol: { label:"fluconazol", text:"Fluconazol 150mg\nTomar 01 cápsula dose única (ou conforme prescrição)." },
  cetoconazol_creme: { label:"cetoconazol creme", text:"Cetoconazol creme 2%\nAplicar fina camada 2x ao dia por 2–4 semanas (conforme prescrição)." },
  miconazol_creme: { label:"miconazol creme", text:"Miconazol creme 2%\nAplicar fina camada 2x ao dia por 2–4 semanas (conforme prescrição)." },
  terbinafina_creme: { label:"terbinafina creme", text:"Terbinafina creme 1%\nAplicar 1x ao dia por 1–2 semanas (conforme prescrição)." },
  shampoo_cetoconazol: { label:"shampoo cetoconazol", text:"Shampoo de cetoconazol 2%\nAplicar no couro cabeludo, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas." },
};

function appendRx(key){
  const ta = $("rx_body");
  const item = RX[key];
  if(!ta || !item) return;
  const cur = ta.value.trim();
  ta.value = cur ? (cur + "\n\n" + item.text) : item.text;
}

/* =========================
   TABS (forms + preview)
   ========================= */
let currentTab = "agenda";

const TABS = {
  agenda:{
    title:"Agenda",
    sub:"Semana inteira, offline, com memória forte.",
    render: async () => {
      await refreshPatientSelect();
      return `
        <label>Data</label>
        <input id="ag_data" type="date" value="${todayISO()}"/>

        <div class="row">
          <div>
            <label>Hora</label>
            <input id="ag_hora" type="time"/>
          </div>
          <div>
            <label>Paciente (busca rápida)</label>
            <input id="ag_nome" placeholder="Digite nome ou telefone..." />
          </div>
        </div>

        <label>Selecionar paciente (opcional)</label>
        <select id="ag_patientId"></select>

        <div class="row">
          <div>
            <label>Tipo</label>
            <select id="ag_tipo">
              <option value="consulta">consulta</option>
              <option value="retorno">retorno</option>
              <option value="procedimento">procedimento</option>
              <option value="avaliacao">avaliação</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="ag_status">
              <option value="aguardando">aguardando</option>
              <option value="confirmado">confirmado</option>
              <option value="remarcado">remarcado</option>
              <option value="faltou">faltou</option>
              <option value="concluido">concluído</option>
            </select>
          </div>
        </div>

        <label>Observações</label>
        <input id="ag_obs" placeholder="Ex: retorno pós-op, dor, etc."/>

        <div class="actions left" style="margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnAgSalvar">Salvar</button>
          <button class="btn btn-ghost" type="button" id="btnAgHoje">Hoje</button>
          <button class="btn btn-ghost" type="button" id="btnAgSemana">Semana</button>
        </div>

        <p class="small" style="margin-top:10px;">
          Dica: “Semana” imprime a agenda completa (seg–dom) em PDF.
        </p>
      `;
    },
    after: () => {
      $("btnAgSalvar").onclick = addAgendaItem;
      $("btnAgHoje").onclick = ()=>{ setVal("ag_data", todayISO()); buildPreview(); };
      $("btnAgSemana").onclick = ()=>{ setVal("ag_data", weekStartISO(v("ag_data")||todayISO())); buildPreview(); };
    },
    build: async () => {
      const list = await listAgenda();
      const start = weekStartISO(v("ag_data")||todayISO());
      const end = addDaysISO(start, 6);

      const filtered = list.filter(it => (it.data||"") >= start && (it.data||"") <= end);

      const rows = filtered.map(it=>{
        return `
          <tr>
            <td>${esc(fmtDateBR(it.data))}</td>
            <td>${esc(it.hora||"")}</td>
            <td>${esc(it.nome || "")}</td>
            <td>${esc(it.tipo||"")}</td>
            <td>${esc(it.status||"")}</td>
            <td>${esc(it.obs||"")}</td>
          </tr>
        `;
      }).join("");

      return `
        <div class="doc-title">Agenda semanal</div>
        <p class="doc-line"><strong>Semana (início):</strong> ${esc(fmtDateBR(start))} — <strong>fim:</strong> ${esc(fmtDateBR(end))}</p>
        ${
          rows
          ? `<table>
              <thead><tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`
          : `<p class="doc-line">Nenhum agendamento na semana.</p>`
        }
      `;
    }
  },

  prontuario:{
    title:"Prontuário",
    sub:"Registro clínico por paciente (semana, mês, histórico).",
    render: async () => {
      const patients = await idbAll("patients");
      patients.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));

      return `
        <input id="pt_id" type="hidden" />

        <div class="doc-title">Cadastro / Seleção de paciente</div>
        <label>Selecionar paciente</label>
        <select id="pt_select">
          <option value="">— novo paciente —</option>
          ${patients.map(p=>`<option value="${esc(p.id)}">${esc(p.nome)}${p.tel? " • "+esc(p.tel):""}</option>`).join("")}
        </select>

        <label>Nome do paciente</label>
        <input id="pt_nome" placeholder="Nome completo" />

        <div class="row">
          <div>
            <label>Nascimento</label>
            <input id="pt_nasc" type="date" />
          </div>
          <div>
            <label>Telefone</label>
            <input id="pt_tel" />
          </div>
        </div>

        <div class="row">
          <div>
            <label>E-mail</label>
            <input id="pt_email" />
          </div>
          <div>
            <label>Endereço</label>
            <input id="pt_end" />
          </div>
        </div>

        <label>Observações do paciente</label>
        <textarea id="pt_obs"></textarea>

        <div class="actions left" style="margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnPtSalvar">Salvar paciente</button>
          <button class="btn btn-ghost" type="button" id="btnPtNovo">Novo</button>
        </div>

        <hr class="sep" />

        <div class="doc-title">Registrar atendimento / procedimento</div>
        <div class="row">
          <div>
            <label>Data</label>
            <input id="note_data" type="date" value="${todayISO()}"/>
          </div>
          <div>
            <label>Hora</label>
            <input id="note_hora" type="time"/>
          </div>
        </div>

        <label>Descrição do que foi feito</label>
        <textarea id="note_texto" placeholder="Ex.: avaliação, procedimento realizado, evolução, orientações..."></textarea>

        <div class="actions left">
          <button class="btn btn-primary" type="button" id="btnNoteAdd">Adicionar ao prontuário</button>
        </div>

        <div class="doc-title">Histórico</div>
        <div id="notes_list"></div>
      `;
    },
    after: () => {
      const sel = $("pt_select");
      const loadPatient = async (id) => {
        if(!id){
          setVal("pt_id","");
          setVal("pt_nome","");
          setVal("pt_nasc","");
          setVal("pt_tel","");
          setVal("pt_email","");
          setVal("pt_end","");
          setVal("pt_obs","");
          $("notes_list").innerHTML = `<p class="small">Selecione ou cadastre um paciente.</p>`;
          buildPreview();
          return;
        }
        const p = await idbGet("patients", id);
        setVal("pt_id", p?.id || "");
        setVal("pt_nome", p?.nome || "");
        setVal("pt_nasc", p?.nasc || "");
        setVal("pt_tel", p?.tel || "");
        setVal("pt_email", p?.email || "");
        setVal("pt_end", p?.end || "");
        setVal("pt_obs", p?.obs || "");
        await refreshPatientNotes(id);
        buildPreview();
      };

      sel.onchange = ()=> loadPatient(sel.value);

      $("btnPtSalvar").onclick = async ()=>{
        const p = await upsertPatientFromForm();
        if(!p) return;
        toast("Paciente pronto ✅");
        // recarrega seleção
        renderTab("prontuario");
      };

      $("btnPtNovo").onclick = ()=>{ sel.value=""; sel.onchange(); };
      $("btnNoteAdd").onclick = async ()=>{
        const pid = v("pt_id");
        await addNoteForPatient(pid);
      };

      $("notes_list").innerHTML = `<p class="small">Selecione ou cadastre um paciente.</p>`;
    },
    build: async () => {
      const pid = v("pt_id");
      if(!pid){
        return `<p class="doc-line">Selecione um paciente para gerar o prontuário.</p>`;
      }
      const p = await idbGet("patients", pid);
      const all = await idbAll("notes");
      const notes = all.filter(n=>n.patientId===pid)
        .sort((a,b)=> (a.data||"").localeCompare(b.data||"") || (a.hora||"").localeCompare(b.hora||""));

      const rows = notes.map(n=>`
        <tr>
          <td>${esc(fmtDateBR(n.data))}</td>
          <td>${esc(n.hora||"")}</td>
          <td>${esc(n.texto||"")}</td>
        </tr>
      `).join("");

      return `
        <div class="doc-title">Prontuário</div>
        <p class="doc-line"><strong>Paciente:</strong> ${esc(p?.nome||"")}</p>
        ${p?.nasc ? `<p class="doc-line"><strong>Nascimento:</strong> ${esc(fmtDateBR(p.nasc))}</p>` : ""}
        ${p?.tel ? `<p class="doc-line"><strong>Telefone:</strong> ${esc(p.tel)}</p>` : ""}
        ${p?.end ? `<p class="doc-line"><strong>Endereço:</strong> ${esc(p.end)}</p>` : ""}

        <div class="doc-title">Registros</div>
        ${
          rows ? `
            <table>
              <thead><tr><th>Data</th><th>Hora</th><th>Descrição</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          ` : `<p class="doc-line">Sem registros ainda.</p>`
        }
      `;
    }
  },

  ficha:{
    title:"Ficha clínica",
    sub:"Identificação, anamnese e planejamento.",
    render: async () => `
      <label>Paciente</label>
      <input id="fc_paciente" placeholder="Nome do paciente" />

      <div class="row">
        <div>
          <label>Nascimento</label>
          <input id="fc_nasc" type="date"/>
        </div>
        <div>
          <label>Telefone</label>
          <input id="fc_tel" />
        </div>
      </div>

      <label>Endereço</label>
      <input id="fc_end" />

      <label>Motivo da consulta</label>
      <textarea id="fc_motivo"></textarea>

      <label>Anamnese</label>
      <textarea id="fc_anamnese"></textarea>

      <label>Planejamento</label>
      <textarea id="fc_plan"></textarea>

      <label>Procedimentos realizados hoje</label>
      <textarea id="fc_proc"></textarea>
    `,
    build: async () => `
      ${line("Paciente", v("fc_paciente"))}
      ${line("Nascimento", fmtDateBR(v("fc_nasc")))}
      ${line("Telefone", v("fc_tel"))}
      ${line("Endereço", v("fc_end"))}
      ${block("Motivo da consulta", v("fc_motivo"))}
      ${block("Anamnese", v("fc_anamnese"))}
      ${block("Planejamento", v("fc_plan"))}
      ${block("Procedimentos realizados hoje", v("fc_proc"))}
    `
  },

  receita:{
    title:"Receituário",
    sub:"Limpo, profissional e editável. Só imprime o que você revisou.",
    render: async () => `
      <label>Paciente</label>
      <input id="rx_paciente" placeholder="Nome do paciente" />

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="rx_cidade" placeholder="Ex.: Belém" />
        </div>
        <div>
          <label>Data</label>
          <input id="rx_data" type="date" value="${todayISO()}"/>
        </div>
      </div>

      <div class="doc-title">Medicações rápidas (1 clique)</div>

      <div class="small" style="margin-bottom:6px;">Analgésicos</div>
      <div class="quickgrid">
        ${qbtn("dipirona")}
        ${qbtn("paracetamol")}
      </div>

      <div class="small" style="margin:10px 0 6px;">Anti-inflamatórios</div>
      <div class="quickgrid">
        ${qbtn("ibuprofeno")}
        ${qbtn("nimesulida")}
        ${qbtn("diclofenaco")}
      </div>

      <div class="small" style="margin:10px 0 6px;">Antibióticos</div>
      <div class="quickgrid">
        ${qbtn("amoxicilina")}
        ${qbtn("azitromicina")}
        ${qbtn("amoxclav")}
      </div>

      <div class="small" style="margin:10px 0 6px;">Hipertensão</div>
      <div class="quickgrid">
        ${qbtn("losartana")}
        ${qbtn("enalapril")}
        ${qbtn("amlodipino")}
        ${qbtn("hctz")}
      </div>

      <div class="small" style="margin:10px 0 6px;">Diabetes</div>
      <div class="quickgrid">
        ${qbtn("metformina")}
        ${qbtn("glibenclamida")}
        ${qbtn("gliclazida")}
      </div>

      <div class="small" style="margin:10px 0 6px;">Antifúngicos / Dermatológicos</div>
      <div class="quickgrid">
        ${qbtn("fluconazol")}
        ${qbtn("cetoconazol_creme")}
        ${qbtn("miconazol_creme")}
        ${qbtn("terbinafina_creme")}
        ${qbtn("shampoo_cetoconazol")}
      </div>

      <p class="small" style="margin-top:10px;">
        Clique para inserir a posologia. Depois revise e edite (você é o responsável pela prescrição).
      </p>

      <label>Prescrição (editável)</label>
      <textarea id="rx_body" placeholder="As medicações escolhidas aparecem aqui..."></textarea>

      <label>Orientações adicionais (opcional)</label>
      <textarea id="rx_orient" placeholder="Ex.: repouso, retorno, cuidados..."></textarea>
    `,
    after: () => {
      // CLIQUE FUNCIONANDO + PREVIEW NA HORA
      document.querySelectorAll("[data-rx]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          appendRx(btn.dataset.rx);
          // força atualização da prévia imediatamente
          await new Promise(r=>setTimeout(r, 0));
          buildPreview();
          // autosave draft
          saveDraftSoon();
        });
      });
    },
    build: async () => {
      const paciente = v("rx_paciente");
      const cidade = v("rx_cidade") || "Cidade";
      const data = v("rx_data") || todayISO();

      const corpo = v("rx_body");
      const orient = v("rx_orient");

      // OBRIGATÓRIO no documento: identificação + prescrição + data/local
      return `
        ${line("Paciente", paciente)}
        <div class="doc-title">Prescrição</div>
        <div class="doc-block">${esc(corpo || "")}</div>
        ${orient ? `<div class="doc-title">Orientações</div><div class="doc-block">${esc(orient)}</div>` : ""}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(fmtDateBR(data))}</p>
      `;
    }
  },

  recibo:{
    title:"Recibo",
    sub:"Comprovação de pagamento / prestação de serviço.",
    render: async () => `
      <label>Nome do pagador (paciente)</label>
      <input id="rc_pagador" />

      <div class="row">
        <div>
          <label>Valor recebido (R$)</label>
          <input id="rc_valor" type="number" step="0.01" placeholder="Ex.: 150.00" />
        </div>
        <div>
          <label>Forma de pagamento</label>
          <input id="rc_forma" placeholder="PIX / dinheiro / cartão" />
        </div>
      </div>

      <label>Referente a</label>
      <input id="rc_ref" placeholder="Ex.: Consulta / Procedimento..." />

      <label>Observações (opcional)</label>
      <textarea id="rc_obs"></textarea>

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="rc_cidade" />
        </div>
        <div>
          <label>Data</label>
          <input id="rc_data" type="date" value="${todayISO()}"/>
        </div>
      </div>
    `,
    build: async () => {
      const pag = v("rc_pagador");
      const valor = v("rc_valor");
      const valorFmt = valor ? Number(valor).toFixed(2) : "0,00";
      const cidade = v("rc_cidade") || "Cidade";
      const data = v("rc_data") || todayISO();
      return `
        <div class="doc-title">Recibo</div>
        <p class="doc-line">Recebi de <strong>${esc(pag)}</strong> a quantia de <strong>R$ ${esc(valorFmt)}</strong>.</p>
        ${v("rc_ref") ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(v("rc_ref"))}</p>` : ""}
        ${v("rc_forma") ? `<p class="doc-line"><strong>Forma:</strong> ${esc(v("rc_forma"))}</p>` : ""}
        ${block("Observações", v("rc_obs"))}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(fmtDateBR(data))}</p>
      `;
    }
  },

  orcamento:{
    title:"Orçamento",
    sub:"Procedimentos e valores, pronto para impressão.",
    render: async () => {
      let rows = "";
      for(let i=1;i<=10;i++){
        rows += `
          <div class="row">
            <div>
              <label>Procedimento ${i}</label>
              <input id="or_d${i}" />
            </div>
            <div>
              <label>Valor ${i} (R$)</label>
              <input id="or_v${i}" type="number" step="0.01" />
            </div>
          </div>
        `;
      }
      return `
        <label>Paciente</label>
        <input id="or_paciente" />

        <label>Observações</label>
        <textarea id="or_obs"></textarea>

        <div class="small" style="margin:10px 0 6px;">Até 10 itens:</div>
        ${rows}

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="or_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="or_data" type="date" value="${todayISO()}"/>
          </div>
        </div>
      `;
    },
    build: async () => {
      const itens = [];
      for(let i=1;i<=10;i++){
        const d = v(`or_d${i}`);
        const raw = v(`or_v${i}`);
        if(d || raw) itens.push({desc:d||"", valor: raw ? Number(raw) : 0});
      }
      const cidade = v("or_cidade") || "Cidade";
      const data = v("or_data") || todayISO();

      let table = "";
      if(itens.length){
        const total = itens.reduce((a,b)=>a+(b.valor||0),0);
        table = `
          <div class="doc-title">Procedimentos</div>
          <table>
            <thead><tr><th>Procedimento</th><th>Valor (R$)</th></tr></thead>
            <tbody>
              ${itens.map(it=>`<tr><td>${esc(it.desc)}</td><td>${(it.valor||0).toFixed(2)}</td></tr>`).join("")}
            </tbody>
            <tfoot><tr><td>Total</td><td>${total.toFixed(2)}</td></tr></tfoot>
          </table>
        `;
      }else{
        table = `<p class="doc-line">Nenhum item informado.</p>`;
      }

      return `
        ${line("Paciente", v("or_paciente"))}
        ${table}
        ${block("Observações", v("or_obs"))}
        <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(fmtDateBR(data))}</p>
      `;
    }
  },

  laudo:{
    title:"Laudo",
    sub:"Relatório estruturado com conclusão.",
    render: async () => `
      <label>Paciente</label>
      <input id="ld_paciente" />

      <label>Título</label>
      <input id="ld_titulo" placeholder="Ex.: Laudo clínico / radiográfico..." />

      <label>Descrição detalhada</label>
      <textarea id="ld_desc"></textarea>

      <label>Conclusão / Impressão diagnóstica</label>
      <textarea id="ld_conc"></textarea>

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="ld_cidade" />
        </div>
        <div>
          <label>Data</label>
          <input id="ld_data" type="date" value="${todayISO()}"/>
        </div>
      </div>
    `,
    build: async () => `
      ${line("Paciente", v("ld_paciente"))}
      ${line("Título", v("ld_titulo"))}
      ${block("Descrição", v("ld_desc"))}
      ${block("Conclusão", v("ld_conc"))}
      <p class="doc-line"><strong>${esc(v("ld_cidade") || "Cidade")}</strong>, ${esc(fmtDateBR(v("ld_data") || todayISO()))}</p>
    `
  },

  atestado:{
    title:"Atestado",
    sub:"Justificativa e dias de afastamento (opcional).",
    render: async () => `
      <label>Paciente</label>
      <input id="at_paciente" />

      <label>Dias de afastamento (opcional)</label>
      <input id="at_dias" type="number" min="0" step="1" placeholder="Ex.: 2" />

      <label>Texto do atestado</label>
      <textarea id="at_texto" placeholder="Ex.: Atesto para os devidos fins que o(a) paciente ..."></textarea>

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="at_cidade" />
        </div>
        <div>
          <label>Data</label>
          <input id="at_data" type="date" value="${todayISO()}"/>
        </div>
      </div>
    `,
    build: async () => {
      const dias = Number(v("at_dias")||"0");
      const extra = (dias && dias>0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : "";
      return `
        ${line("Paciente", v("at_paciente"))}
        ${extra}
        ${block("Atestado", v("at_texto"))}
        <p class="doc-line"><strong>${esc(v("at_cidade") || "Cidade")}</strong>, ${esc(fmtDateBR(v("at_data") || todayISO()))}</p>
      `;
    }
  }
};

/* Helpers usados em build */
function line(label, value){
  if(!value) return "";
  return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
}
function block(title, value){
  if(!value) return "";
  return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
}
function qbtn(key){
  return `<button class="qbtn" type="button" data-rx="${esc(key)}">${esc(RX[key]?.label || key)}</button>`;
}

/* =========================
   Draft autosave (por aba)
   ========================= */
let draftTimer = null;
function collectDraft(){
  const panel = $("formPanel");
  const data = {};
  if(!panel) return data;
  panel.querySelectorAll("input, textarea, select").forEach(el=>{
    if(!el.id) return;
    data[el.id] = el.value;
  });
  return data;
}
async function saveDraft(){
  await idbSet("drafts", collectDraft(), draftKey(currentTab));
}
function saveDraftSoon(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=>saveDraft().catch(()=>{}), 300);
}
async function loadDraft(tab){
  return (await idbGet("drafts", draftKey(tab))) || null;
}

/* =========================
   Render + Preview
   ========================= */
async function renderTab(tab){
  currentTab = tab;

  document.querySelectorAll(".tabbtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  $("docTitle").textContent = TABS[tab].title;
  $("docSub").textContent   = TABS[tab].sub;

  const html = await TABS[tab].render();
  $("formPanel").innerHTML = html;

  // carregar draft da aba
  const draft = await loadDraft(tab);
  if(draft){
    Object.keys(draft).forEach(id=>{
      const el = $(id);
      if(el) el.value = draft[id];
    });
  }

  $("formPanel").querySelectorAll("input, textarea, select").forEach(el=>{
    el.addEventListener("input", ()=>{ buildPreview(); saveDraftSoon(); });
    el.addEventListener("change", ()=>{ buildPreview(); saveDraftSoon(); });
  });

  if(typeof TABS[tab].after === "function") TABS[tab].after();

  buildPreview();
}

async function buildPreview(){
  $("pvMeta").textContent = nowBR();
  $("pvTitle").textContent = TABS[currentTab].title;
  $("pvSub").textContent = TABS[currentTab].sub;

  const prof = await idbGet("settings", KEY_PROF);
  const lines = profLines(prof);

  $("profResumo").textContent = lines.length ? `${lines[0]}${lines[1] ? " — " + lines[1] : ""}` : "—";

  $("pvProfMini").innerHTML = lines.length
    ? `${esc(lines[0]||"")}<br>${esc(lines[2]||"")}<br>${esc(lines[3]||"")}`
    : `<span style="color:#64748b;">Preencha o profissional</span>`;

  $("pvBody").innerHTML = await TABS[currentTab].build();

  if(lines.length){
    const conselhoReg = lines[2] || "";
    $("pvSign").innerHTML = `
      <div class="sigrow">
        <div class="sig">
          <div class="line"></div>
          <div><b>${esc(lines[0] || "")}</b></div>
          <div style="font-size:12px;color:#334155;">${esc(conselhoReg)}</div>
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
   Botões gerais
   ========================= */
$("btnProfSalvar").addEventListener("click", async ()=>{
  const p = readProfUI();
  if(!p.nome){ alert("Digite pelo menos o nome do profissional."); return; }
  await idbSet("settings", p, KEY_PROF);
  toast("Profissional salvo ✅");
  buildPreview();
});

$("btnProfLimpar").addEventListener("click", async ()=>{
  await idbDel("settings", KEY_PROF);
  setProfUI(null);
  toast("Profissional limpo ✅");
  buildPreview();
});

$("btnClearForm").addEventListener("click", async ()=>{
  $("formPanel").querySelectorAll("input, textarea, select").forEach(el=>{
    // mantém datas como hoje quando fizer sentido
    if(el.type === "date") el.value = todayISO();
    else el.value = "";
  });
  await idbSet("drafts", collectDraft(), draftKey(currentTab));
  toast("Form limpo ✅");
  buildPreview();
});

$("btnPrint").addEventListener("click", async ()=>{
  await buildPreview();
  window.print();
});

$("btnDownloadHTML").addEventListener("click", async ()=>{
  await buildPreview();
  const html = `
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BTX Docs — ${esc(TABS[currentTab].title)}</title>
<style>body{font-family:Arial,system-ui;margin:18px} .paper{max-width:820px;margin:0 auto}</style>
</head><body>
<div class="paper">${$("paper").innerHTML}</div>
</body></html>`;
  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `btx_${currentTab}_${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("HTML baixado ✅");
});

$("btnExport").addEventListener("click", async ()=>{
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: await idbGet("settings", KEY_PROF),
    patients: await idbAll("patients"),
    agenda: await idbAll("agenda"),
    notes: await idbAll("notes"),
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `btx_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup exportado ✅");
});

$("btnResetAll").addEventListener("click", async ()=>{
  if(!confirm("Tem certeza? Isso apaga TUDO do aparelho (profissional, pacientes, agenda, registros).")) return;
  // recria apagando o banco inteiro
  indexedDB.deleteDatabase(DB_NAME);
  toast("Zerado ✅ Recarregando…");
  setTimeout(()=>location.reload(), 700);
});

$("btnRefresh").addEventListener("click", ()=>location.reload());

/* =========================
   Online/Offline pill
   ========================= */
function updateNet(){
  const online = navigator.onLine;
  $("netPill").textContent = online ? "Online" : "Offline";
  $("netPill").style.borderColor = online ? "#1f2937" : "#f97316";
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);

/* =========================
   Init
   ========================= */
document.querySelectorAll(".tabbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
});

(async function init(){
  updateNet();

  // carrega profissional
  const prof = await idbGet("settings", KEY_PROF);
  setProfUI(prof);

  await renderTab("agenda");
})();
