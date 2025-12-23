/* BTX Docs Saúde — App */
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

function nowBR(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}/${mm}/${yyyy} • ${hh}:${mi}`;
}

function fmtDateBR(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
}

function v(id){
  const el = $(id);
  return el ? el.value.trim() : "";
}

function line(label, value){
  if (!value) return "";
  return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
}

function block(title, value){
  if (!value) return "";
  return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
}

/* =========================
   LOGIN (btx007)
   ========================= */
const LOGIN_KEY = "btx007";
const LS_UNLOCK = "btx_unlocked";

function isUnlocked(){
  return localStorage.getItem(LS_UNLOCK) === "1";
}
function setUnlocked(){
  localStorage.setItem(LS_UNLOCK, "1");
}
function lockUI(show){
  $("lock").classList.toggle("show", !!show);
}

/* =========================
   PROFISSIONAL (IndexedDB)
   ========================= */
async function loadProf(){
  return await dbGet(STORES.prof, "prof") || null;
}
async function saveProf(p){
  await dbPut(STORES.prof, { id:"prof", ...p, updatedAt: Date.now() });
}
function readProfFromUI(){
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
async function setProfToUI(){
  const p = await loadProf();
  $("profNome").value = p?.nome || "";
  $("profEsp").value = p?.esp || "";
  $("profConselho").value = p?.conselho || "";
  $("profReg").value = p?.reg || "";
  $("profEnd").value = p?.end || "";
  $("profTel").value = p?.tel || "";
  $("profEmail").value = p?.email || "";
}

/* =========================
   AGENDA (IndexedDB)
   ========================= */
function weekStartISO(iso){
  const d = iso ? new Date(iso+"T12:00:00") : new Date();
  const day = d.getDay(); // 0 dom
  const diff = (day === 0 ? -6 : 1) - day; // monday
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDaysISO(iso, n){
  const d = new Date(iso+"T12:00:00");
  d.setDate(d.getDate()+n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
async function listAgenda(){
  const all = await dbAll(STORES.agenda);
  return all.sort((a,b)=> (a.data+a.hora).localeCompare(b.data+b.hora));
}
async function addAgendaItem(item){
  const id = crypto.randomUUID();
  await dbPut(STORES.agenda, { id, ...item, updatedAt: Date.now() });
}
async function deleteAgenda(id){
  await dbDel(STORES.agenda, id);
}

/* =========================
   PACIENTES + PRONTUÁRIO (IndexedDB)
   ========================= */
async function upsertPaciente(p){
  const id = p.id || crypto.randomUUID();
  await dbPut(STORES.pacientes, { id, ...p, updatedAt: Date.now() });
  return id;
}
async function listPacientes(){
  const all = await dbAll(STORES.pacientes);
  return all.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
}
async function addProntuarioEntry(entry){
  const id = crypto.randomUUID();
  await dbPut(STORES.prontuario, { id, ...entry, updatedAt: Date.now() });
}
async function listProntuarioByPaciente(pacienteId){
  const all = await dbAll(STORES.prontuario);
  return all
    .filter(e=> e.pacienteId === pacienteId)
    .sort((a,b)=> (a.data+a.hora).localeCompare(b.data+b.hora));
}

/* =========================
   DRAFTS (rascunho docs)
   ========================= */
async function saveDraft(tab, data){
  await dbPut(STORES.drafts, { id:tab, data, updatedAt: Date.now() });
}
async function loadDraft(tab){
  const d = await dbGet(STORES.drafts, tab);
  return d?.data || null;
}

/* =========================
   RECEITUÁRIO — presets (completo)
   ========================= */
const RX_PRESETS = {
  // Analgésicos
  dipirona: "Dipirona 500mg\nTomar 01 comprimido a cada 6–8 horas, se dor ou febre, por até 3 dias.\nQuantidade: ___",
  paracetamol: "Paracetamol 750mg\nTomar 01 comprimido a cada 8 horas, se dor ou febre, por até 3 dias.\nQuantidade: ___",

  // Anti-inflamatórios
  ibuprofeno: "Ibuprofeno 400mg\nTomar 01 comprimido a cada 8 horas, após alimentação, por 3 dias.\nQuantidade: ___",
  nimesulida: "Nimesulida 100mg\nTomar 01 comprimido a cada 12 horas, após alimentação, por 3 dias.\nQuantidade: ___",
  diclofenaco: "Diclofenaco de potássio 50mg\nTomar 01 comprimido a cada 8–12 horas, após alimentação, por 3 dias.\nQuantidade: ___",

  // Antibióticos
  amoxicilina: "Amoxicilina 500mg\nTomar 01 cápsula a cada 8 horas por 7 dias.\nQuantidade: ___",
  azitromicina: "Azitromicina 500mg\nTomar 01 comprimido ao dia por 3 dias.\nQuantidade: ___",
  amoxclav: "Amoxicilina 875mg + Clavulanato 125mg\nTomar 01 comprimido a cada 12 horas por 7 dias.\nQuantidade: ___",

  // Hipertensão
  losartana: "Losartana 50mg\nTomar 01 comprimido ao dia (conforme prescrição).\nQuantidade: ___",
  enalapril: "Enalapril 10mg\nTomar 01 comprimido ao dia (conforme prescrição).\nQuantidade: ___",
  amlodipino: "Amlodipino 5mg\nTomar 01 comprimido ao dia (conforme prescrição).\nQuantidade: ___",
  hctz: "Hidroclorotiazida 25mg (HCTZ)\nTomar 01 comprimido ao dia (conforme prescrição).\nQuantidade: ___",

  // Diabetes
  metformina: "Metformina 500mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição).\nQuantidade: ___",
  glibenclamida: "Glibenclamida 5mg\nTomar 01 comprimido ao dia (conforme prescrição).\nQuantidade: ___",
  gliclazida: "Gliclazida 30mg (MR)\nTomar 01 comprimido ao dia (conforme prescrição).\nQuantidade: ___",

  // Antifúngicos / Dermatológicos
  fluconazol: "Fluconazol 150mg\nTomar 01 cápsula dose única (ou conforme prescrição).\nQuantidade: ___",
  cetoconazol_creme: "Cetoconazol creme 2%\nAplicar fina camada 2x ao dia por 7–14 dias.\nQuantidade: ___",
  miconazol_creme: "Miconazol creme 2%\nAplicar fina camada 2x ao dia por 7–14 dias.\nQuantidade: ___",
  terbinafina_creme: "Terbinafina creme 1%\nAplicar 1–2x ao dia por 7–14 dias.\nQuantidade: ___",
  shampoo_cetoconazol: "Shampoo cetoconazol 2%\nAplicar no couro cabeludo, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas.\nQuantidade: ___"
};

function appendRxPreset(key){
  const ta = $("r_corpo");
  const txt = RX_PRESETS[key];
  if(!ta || !txt) return;
  const cur = ta.value.trim();
  ta.value = cur ? (cur + "\n\n" + txt) : txt;
}

/* =========================
   TABS
   ========================= */
let currentTab = "agenda";

const TABS = {
  agenda: {
    title: "Agenda",
    sub: "Agenda do dia e da semana, offline, com memória forte.",
    renderForm: async () => {
      const draft = await loadDraft("agenda") || {};
      return `
        <label>Data</label>
        <input id="ag_data" type="date" value="${esc(draft.data || todayISO())}"/>

        <div class="row">
          <div>
            <label>Hora</label>
            <input id="ag_hora" type="time" value="${esc(draft.hora || "")}"/>
          </div>
          <div>
            <label>Paciente</label>
            <input id="ag_paciente" placeholder="Nome do paciente" value="${esc(draft.paciente || "")}"/>
          </div>
        </div>

        <div class="row">
          <div>
            <label>Tipo</label>
            <select id="ag_tipo">
              ${["consulta","retorno","procedimento","avaliacao"].map(x=>`<option ${draft.tipo===x?"selected":""} value="${x}">${x}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="ag_status">
              ${["aguardando","confirmado","remarcado","faltou","concluido"].map(x=>`<option ${draft.status===x?"selected":""} value="${x}">${x==="concluido"?"concluído":x}</option>`).join("")}
            </select>
          </div>
        </div>

        <label>Observações</label>
        <input id="ag_obs" placeholder="Ex: retorno pós-op, dor, etc." value="${esc(draft.obs || "")}"/>

        <div class="actions" style="justify-content:flex-start; margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnAgSalvar">Salvar</button>
          <button class="btn btn-ghost" type="button" id="btnAgHoje">Hoje</button>
          <button class="btn btn-ghost" type="button" id="btnAgSemana">Semana</button>
        </div>

        <p class="small" style="margin-top:10px;">
          Dica: “Semana” gera a lista da semana no preview.
        </p>
      `;
    },
    build: async () => {
      const list = await listAgenda();
      const only = v("ag_mode")==="week" ? "" : (v("ag_data") || "");
      const mode = v("ag_mode") || "day";

      const base = v("ag_data") || todayISO();
      const start = weekStartISO(base);
      const end = addDaysISO(start, 6);

      let filtered = list;
      if(mode==="day"){
        filtered = list.filter(it=> it.data === base);
      } else {
        filtered = list.filter(it=> it.data >= start && it.data <= end);
      }

      const title = mode==="day"
        ? `Agenda do dia — ${fmtDateBR(base)}`
        : `Agenda da semana — ${fmtDateBR(start)} a ${fmtDateBR(end)}`;

      const rows = filtered.map(it=>`
        <tr>
          <td>${esc(it.hora||"")}</td>
          <td>${esc(it.paciente||"")}</td>
          <td>${esc(it.tipo||"")}</td>
          <td>${esc(it.status||"")}</td>
          <td>${esc(it.obs||"")}</td>
        </tr>
      `).join("");

      return `
        <div class="doc-title">${esc(title)}</div>
        ${rows ? `
        <table>
          <thead><tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : `<p class="doc-line">Nenhum agendamento.</p>`}
      `;
    },
    afterRender: async () => {
      // modo escondido pra build
      if(!$("ag_mode")){
        const hidden = document.createElement("input");
        hidden.type="hidden"; hidden.id="ag_mode"; hidden.value="day";
        $("formPanel").appendChild(hidden);
      }

      const saveDraftFromInputs = async () => {
        await saveDraft("agenda", {
          data: v("ag_data"),
          hora: v("ag_hora"),
          paciente: v("ag_paciente"),
          tipo: v("ag_tipo"),
          status: v("ag_status"),
          obs: v("ag_obs")
        });
      };

      ["ag_data","ag_hora","ag_paciente","ag_tipo","ag_status","ag_obs"].forEach(id=>{
        $(id).addEventListener("input", async ()=>{ await saveDraftFromInputs(); await buildPreview(); });
        $(id).addEventListener("change", async ()=>{ await saveDraftFromInputs(); await buildPreview(); });
      });

      $("btnAgSalvar").addEventListener("click", async ()=>{
        const data = v("ag_data") || todayISO();
        const paciente = v("ag_paciente");
        if(!paciente){ alert("Digite o nome do paciente."); return; }

        await addAgendaItem({
          data,
          hora: v("ag_hora"),
          paciente,
          tipo: v("ag_tipo") || "consulta",
          status: v("ag_status") || "aguardando",
          obs: v("ag_obs")
        });

        $("ag_hora").value="";
        $("ag_paciente").value="";
        $("ag_obs").value="";
        await saveDraft("agenda", { data, tipo:v("ag_tipo"), status:v("ag_status") });

        toast("Agendamento salvo ✅");
        await buildPreview();
      });

      $("btnAgHoje").addEventListener("click", async ()=>{
        $("ag_mode").value="day";
        $("ag_data").value=todayISO();
        await saveDraft("agenda", { ...await loadDraft("agenda"), data: todayISO() });
        await buildPreview();
      });

      $("btnAgSemana").addEventListener("click", async ()=>{
        $("ag_mode").value="week";
        await buildPreview();
      });
    }
  },

  prontuario: {
    title: "Prontuário",
    sub: "Registro clínico por paciente, com histórico e exportação em PDF.",
    renderForm: async () => {
      const pacientes = await listPacientes();
      const opts = pacientes.map(p=>`<option value="${esc(p.id)}">${esc(p.nome||"")}${p.tel? " • "+esc(p.tel):""}</option>`).join("");
      return `
        <div class="doc-title">Selecionar paciente</div>
        <label>Busca rápida (nome/telefone)</label>
        <input id="pr_busca" placeholder="Digite para filtrar..." />

        <label>Paciente</label>
        <select id="pr_paciente">
          <option value="">— selecione —</option>
          ${opts}
        </select>

        <hr class="hr"/>

        <div class="doc-title">Cadastrar / Atualizar paciente</div>
        <label>Nome</label>
        <input id="pc_nome" placeholder="Nome completo" />
        <div class="row">
          <div>
            <label>Nascimento</label>
            <input id="pc_nasc" type="date" />
          </div>
          <div>
            <label>Telefone</label>
            <input id="pc_tel" />
          </div>
        </div>
        <label>Endereço</label>
        <input id="pc_end" />

        <div class="actions" style="justify-content:flex-start;margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnPcSalvar">Salvar paciente</button>
        </div>

        <hr class="hr"/>

        <div class="doc-title">Novo atendimento / procedimento</div>
        <label>Data</label>
        <input id="pr_data" type="date" value="${todayISO()}"/>
        <label>Hora</label>
        <input id="pr_hora" type="time" />
        <label>Descrição do atendimento (o que foi feito)</label>
        <textarea id="pr_texto" placeholder="Ex.: avaliação, procedimento, conduta, orientações..."></textarea>

        <div class="actions" style="justify-content:flex-start;margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnPrAdd">Adicionar ao prontuário</button>
        </div>
      `;
    },
    build: async () => {
      const pid = v("pr_paciente");
      if(!pid) return `<p class="doc-line">Selecione um paciente para visualizar o prontuário.</p>`;

      const p = await dbGet(STORES.pacientes, pid);
      const hist = await listProntuarioByPaciente(pid);

      const head = `
        ${line("Paciente", p?.nome || "")}
        ${p?.nasc ? line("Nascimento", fmtDateBR(p.nasc)) : ""}
        ${p?.tel ? line("Telefone", p.tel) : ""}
        ${p?.end ? line("Endereço", p.end) : ""}
      `;

      const rows = hist.map(h=>`
        <tr>
          <td>${esc(fmtDateBR(h.data||""))}</td>
          <td>${esc(h.hora||"")}</td>
          <td>${esc(h.texto||"")}</td>
        </tr>
      `).join("");

      return `
        <div class="doc-title">Identificação</div>
        ${head || "<p class='doc-line'>—</p>"}

        <div class="doc-title">Histórico</div>
        ${rows ? `
          <table>
            <thead><tr><th>Data</th><th>Hora</th><th>Registro</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `<p class="doc-line">Sem registros ainda.</p>`}
      `;
    },
    afterRender: async () => {
      const refreshPacientesSelect = async ()=>{
        const pacientes = await listPacientes();
        const sel = $("pr_paciente");
        const cur = sel.value;
        sel.innerHTML = `<option value="">— selecione —</option>` + pacientes.map(p=>`<option value="${esc(p.id)}">${esc(p.nome||"")}${p.tel? " • "+esc(p.tel):""}</option>`).join("");
        sel.value = cur;
      };

      $("pr_busca").addEventListener("input", async ()=>{
        const q = v("pr_busca").toLowerCase();
        const pacientes = await listPacientes();
        const filt = pacientes.filter(p=>{
          return (p.nome||"").toLowerCase().includes(q) || (p.tel||"").toLowerCase().includes(q);
        });
        const sel = $("pr_paciente");
        sel.innerHTML = `<option value="">— selecione —</option>` + filt.map(p=>`<option value="${esc(p.id)}">${esc(p.nome||"")}${p.tel? " • "+esc(p.tel):""}</option>`).join("");
      });

      $("pr_paciente").addEventListener("change", buildPreview);

      $("btnPcSalvar").addEventListener("click", async ()=>{
        const nome = v("pc_nome");
        if(!nome){ alert("Digite o nome do paciente."); return; }
        const id = await upsertPaciente({
          nome,
          nasc: v("pc_nasc") || "",
          tel: v("pc_tel") || "",
          end: v("pc_end") || ""
        });
        toast("Paciente salvo ✅");
        await refreshPacientesSelect();
        $("pr_paciente").value = id;
        await buildPreview();
      });

      $("btnPrAdd").addEventListener("click", async ()=>{
        const pid = v("pr_paciente");
        if(!pid){ alert("Selecione um paciente."); return; }
        const texto = v("pr_texto");
        if(!texto){ alert("Descreva o atendimento."); return; }

        await addProntuarioEntry({
          pacienteId: pid,
          data: v("pr_data") || todayISO(),
          hora: v("pr_hora") || "",
          texto
        });

        $("pr_hora").value="";
        $("pr_texto").value="";
        toast("Registro adicionado ✅");
        await buildPreview();
      });

      ["pc_nome","pc_nasc","pc_tel","pc_end","pr_data","pr_hora","pr_texto"].forEach(id=>{
        $(id).addEventListener("input", buildPreview);
        $(id).addEventListener("change", buildPreview);
      });
    }
  },

  ficha: {
    title: "Ficha clínica",
    sub: "Cadastro e anamnese simplificada.",
    renderForm: async () => `
      <label>Nome do paciente</label>
      <input id="f_paciente" />

      <div class="row">
        <div>
          <label>Nascimento</label>
          <input id="f_nasc" type="date" />
        </div>
        <div>
          <label>Telefone</label>
          <input id="f_tel" />
        </div>
      </div>

      <label>Endereço</label>
      <input id="f_end" />

      <label>Motivo da consulta</label>
      <textarea id="f_motivo"></textarea>

      <label>Anamnese</label>
      <textarea id="f_anamnese"></textarea>

      <label>Planejamento</label>
      <textarea id="f_plan"></textarea>

      <label>Procedimentos realizados hoje</label>
      <textarea id="f_proc"></textarea>
    `,
    build: async () => [
      line("Paciente", v("f_paciente")),
      v("f_nasc") ? line("Nascimento", fmtDateBR(v("f_nasc"))) : "",
      line("Telefone", v("f_tel")),
      line("Endereço", v("f_end")),
      block("Motivo da consulta", v("f_motivo")),
      block("Anamnese", v("f_anamnese")),
      block("Planejamento", v("f_plan")),
      block("Procedimentos realizados hoje", v("f_proc")),
    ].join("")
  },

  receita: {
    title: "Receituário",
    sub: "Somente o essencial no PDF. Botões 1-clique + campo editável.",
    renderForm: async () => `
      <label>Paciente</label>
      <input id="r_paciente" />

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="r_cidade" placeholder="Ex.: Belém" />
        </div>
        <div>
          <label>Data</label>
          <input id="r_data" type="date" value="${todayISO()}"/>
        </div>
      </div>

      <div class="doc-title">Medicações (1 clique)</div>

      <div class="small">Analgésicos</div>
      <div class="quickgrid">
        <button class="btn btn-ghost" type="button" data-rx="dipirona">dipirona</button>
        <button class="btn btn-ghost" type="button" data-rx="paracetamol">paracetamol</button>
      </div>

      <div class="small" style="margin-top:10px;">Anti-inflamatórios</div>
      <div class="quickgrid">
        <button class="btn btn-ghost" type="button" data-rx="ibuprofeno">ibuprofeno</button>
        <button class="btn btn-ghost" type="button" data-rx="nimesulida">nimesulida</button>
        <button class="btn btn-ghost" type="button" data-rx="diclofenaco">diclofenaco</button>
      </div>

      <div class="small" style="margin-top:10px;">Antibióticos</div>
      <div class="quickgrid">
        <button class="btn btn-ghost" type="button" data-rx="amoxicilina">amoxicilina</button>
        <button class="btn btn-ghost" type="button" data-rx="azitromicina">azitromicina</button>
        <button class="btn btn-ghost" type="button" data-rx="amoxclav">amox+clav</button>
      </div>

      <div class="small" style="margin-top:10px;">Hipertensão</div>
      <div class="quickgrid">
        <button class="btn btn-ghost" type="button" data-rx="losartana">losartana</button>
        <button class="btn btn-ghost" type="button" data-rx="enalapril">enalapril</button>
        <button class="btn btn-ghost" type="button" data-rx="amlodipino">amlodipino</button>
        <button class="btn btn-ghost" type="button" data-rx="hctz">HCTZ</button>
      </div>

      <div class="small" style="margin-top:10px;">Diabetes</div>
      <div class="quickgrid">
        <button class="btn btn-ghost" type="button" data-rx="metformina">metformina</button>
        <button class="btn btn-ghost" type="button" data-rx="glibenclamida">glibenclamida</button>
        <button class="btn btn-ghost" type="button" data-rx="gliclazida">gliclazida</button>
      </div>

      <div class="small" style="margin-top:10px;">Antifúngicos / Dermatológicos</div>
      <div class="quickgrid">
        <button class="btn btn-ghost" type="button" data-rx="fluconazol">fluconazol</button>
        <button class="btn btn-ghost" type="button" data-rx="cetoconazol_creme">cetoconazol creme</button>
        <button class="btn btn-ghost" type="button" data-rx="miconazol_creme">miconazol creme</button>
        <button class="btn btn-ghost" type="button" data-rx="terbinafina_creme">terbinafina creme</button>
        <button class="btn btn-ghost" type="button" data-rx="shampoo_cetoconazol">shampoo cetoconazol</button>
      </div>

      <p class="small" style="margin-top:10px;">Clique para inserir. Depois revise e edite (você é o responsável pela prescrição).</p>

      <label>Prescrição (editável)</label>
      <textarea id="r_corpo" placeholder="As medicações escolhidas vão aparecer aqui..."></textarea>

      <label>Orientações adicionais (opcional)</label>
      <textarea id="r_obs" placeholder="Ex.: repouso, retorno, cuidados..."></textarea>
    `,
    build: async () => {
      const paciente = v("r_paciente");
      const cidade = v("r_cidade");
      const dataISO = v("r_data") || todayISO();
      const presc = [v("r_corpo"), v("r_obs")].filter(Boolean).join("\n\n").trim();

      return [
        paciente ? line("Paciente", paciente) : "",
        `<div class="doc-title">Prescrição</div>`,
        `<div class="doc-block">${esc(presc || "")}</div>`,
        `<p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(fmtDateBR(dataISO))}</p>`
      ].join("");
    },
    afterRender: async () => {
      const bind = () => {
        $("formPanel").querySelectorAll("[data-rx]").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            appendRxPreset(btn.dataset.rx);
            await saveDraft("receita", {
              paciente: v("r_paciente"),
              cidade: v("r_cidade"),
              data: v("r_data"),
              corpo: $("r_corpo").value,
              obs: $("r_obs").value
            });
            await buildPreview();
          });
        });
      };

      // restaura rascunho
      const d = await loadDraft("receita");
      if(d){
        $("r_paciente").value = d.paciente || "";
        $("r_cidade").value = d.cidade || "";
        $("r_data").value = d.data || todayISO();
        $("r_corpo").value = d.corpo || "";
        $("r_obs").value = d.obs || "";
      }

      ["r_paciente","r_cidade","r_data","r_corpo","r_obs"].forEach(id=>{
        $(id).addEventListener("input", async ()=>{
          await saveDraft("receita", {
            paciente: v("r_paciente"),
            cidade: v("r_cidade"),
            data: v("r_data"),
            corpo: $("r_corpo").value,
            obs: $("r_obs").value
          });
          await buildPreview();
        });
        $(id).addEventListener("change", async ()=>{
          await buildPreview();
        });
      });

      bind();
    }
  },

  recibo: {
    title: "Recibo",
    sub: "Comprovação de pagamento / prestação de serviço.",
    renderForm: async () => `
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
      const forma = v("rc_forma");
      const ref = v("rc_ref");
      const cidade = v("rc_cidade");
      const data = v("rc_data") || todayISO();
      const valorFmt = valor ? Number(valor).toFixed(2) : "";

      return [
        `<div class="doc-title">Recibo</div>`,
        `<p class="doc-line">Recebi de <strong>${esc(pag || "")}</strong> a quantia de <strong>R$ ${esc(valorFmt || "")}</strong>.</p>`,
        ref ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(ref)}</p>` : "",
        forma ? `<p class="doc-line"><strong>Forma de pagamento:</strong> ${esc(forma)}</p>` : "",
        block("Observações", v("rc_obs")),
        `<p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(fmtDateBR(data))}</p>`
      ].join("");
    }
  },

  orcamento: {
    title: "Orçamento",
    sub: "Procedimentos e valores, pronto para impressão.",
    renderForm: async () => {
      let rows = "";
      for (let i=1;i<=10;i++){
        rows += `
          <div class="row">
            <div>
              <label>Procedimento ${i}</label>
              <input id="o_d${i}" />
            </div>
            <div>
              <label>Valor ${i} (R$)</label>
              <input id="o_v${i}" type="number" step="0.01" />
            </div>
          </div>
        `;
      }
      return `
        <label>Paciente</label>
        <input id="o_paciente" />

        <label>Observações</label>
        <textarea id="o_obs"></textarea>

        <div style="margin:10px 0 6px;" class="small">Até 10 itens:</div>
        ${rows}

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="o_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="o_data" type="date" value="${todayISO()}"/>
          </div>
        </div>
      `;
    },
    build: async () => {
      const paciente = v("o_paciente");
      const cidade = v("o_cidade");
      const data = v("o_data") || todayISO();

      const itens = [];
      for (let i=1;i<=10;i++){
        const d = v(`o_d${i}`);
        const rawV = v(`o_v${i}`);
        if (d || rawV){
          itens.push({ desc: d || "", valor: rawV ? Number(rawV) : 0 });
        }
      }

      let table = "";
      if (itens.length){
        const total = itens.reduce((a,b)=>a+(b.valor||0),0);
        table = `
          <div class="doc-title">Procedimentos</div>
          <table>
            <thead><tr><th>Procedimento</th><th>Valor (R$)</th></tr></thead>
            <tbody>
              ${itens.map(it => `<tr><td>${esc(it.desc)}</td><td>${(it.valor||0).toFixed(2)}</td></tr>`).join("")}
            </tbody>
            <tfoot><tr><td>Total</td><td>${total.toFixed(2)}</td></tr></tfoot>
          </table>
        `;
      } else {
        table = `<p class="doc-line">Nenhum procedimento informado.</p>`;
      }

      return [
        paciente ? line("Paciente", paciente) : "",
        table,
        block("Observações", v("o_obs")),
        `<p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(fmtDateBR(data))}</p>`
      ].join("");
    }
  },

  laudo: {
    title: "Laudo",
    sub: "Relatório estruturado com conclusão.",
    renderForm: async () => `
      <label>Paciente</label>
      <input id="l_paciente" />

      <label>Título</label>
      <input id="l_titulo" placeholder="Ex.: Laudo clínico..." />

      <label>Descrição detalhada</label>
      <textarea id="l_desc"></textarea>

      <label>Conclusão / Impressão diagnóstica</label>
      <textarea id="l_conc"></textarea>

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="l_cidade" />
        </div>
        <div>
          <label>Data</label>
          <input id="l_data" type="date" value="${todayISO()}"/>
        </div>
      </div>
    `,
    build: async () => {
      const paciente = v("l_paciente");
      const cidade = v("l_cidade");
      const data = v("l_data") || todayISO();
      return [
        paciente ? line("Paciente", paciente) : "",
        line("Título", v("l_titulo")),
        block("Descrição detalhada", v("l_desc")),
        block("Conclusão / Impressão diagnóstica", v("l_conc")),
        `<p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(fmtDateBR(data))}</p>`
      ].join("");
    }
  },

  atestado: {
    title: "Atestado",
    sub: "Justificativa e dias de afastamento (opcional).",
    renderForm: async () => `
      <label>Paciente</label>
      <input id="a_paciente" />

      <label>Dias de afastamento (opcional)</label>
      <input id="a_dias" type="number" min="0" step="1" placeholder="Ex.: 2" />

      <label>Texto do atestado</label>
      <textarea id="a_desc" placeholder="Ex.: Atesto para os devidos fins que..."></textarea>

      <div class="row">
        <div>
          <label>Cidade</label>
          <input id="a_cidade" />
        </div>
        <div>
          <label>Data</label>
          <input id="a_data" type="date" value="${todayISO()}"/>
        </div>
      </div>
    `,
    build: async () => {
      const paciente = v("a_paciente");
      const cidade = v("a_cidade");
      const data = v("a_data") || todayISO();
      const diasRaw = v("a_dias");
      const dias = diasRaw ? Number(diasRaw) : null;

      return [
        paciente ? line("Paciente", paciente) : "",
        (dias && !Number.isNaN(dias) && dias > 0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : "",
        block("Atestado", v("a_desc")),
        `<p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(fmtDateBR(data))}</p>`
      ].join("");
    }
  }
};

/* =========================
   RENDER / PREVIEW
   ========================= */
async function renderTab(tab){
  currentTab = tab;

  document.querySelectorAll(".tabbtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  $("docTitle").textContent = TABS[tab].title;
  $("docSub").textContent = TABS[tab].sub;

  $("formPanel").innerHTML = await TABS[tab].renderForm();

  $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
    el.addEventListener("input", buildPreview);
    el.addEventListener("change", buildPreview);
  });

  if (typeof TABS[tab].afterRender === "function") await TABS[tab].afterRender();

  await buildPreview();
}

async function buildPreview(){
  const prof = await loadProf();

  const nome = (prof?.nome || "").trim();
  const esp = (prof?.esp || "").trim();
  const conselho = (prof?.conselho || "").trim();
  const reg = (prof?.reg || "").trim();
  const end = (prof?.end || "").trim();
  const tel = (prof?.tel || "").trim();
  const email = (prof?.email || "").trim();

  const cr = [conselho, reg].filter(Boolean).join(" ").trim();
  const contato = [tel, email].filter(Boolean).join(" • ").trim();

  $("profResumo").textContent = [nome, esp].filter(Boolean).join(" — ") || "—";

  // canto direito: BTX + ENDEREÇO (no lugar de “documentos clínicos”) + data/hora
  $("pvBrandRight").innerHTML = `
    <div class="brand-right">
      <div class="btx">BTX Docs Saúde</div>
      <div class="addr">${esc(end || "Endereço não informado")}</div>
      <div class="dt">${esc(nowBR())}</div>
    </div>
  `;

  // bloco de dados do profissional (abaixo do título) — sem texto morto
  $("pvProfBlock").innerHTML = nome ? `
    <div class="l1">${esc(nome)}</div>
    <div class="l2">${esc([esp, cr].filter(Boolean).join(" — "))}</div>
    <div class="l3">${esc([end, contato].filter(Boolean).join(" • "))}</div>
  ` : `<div class="l2" style="color:#b91c1c;font-weight:900;">Preencha os dados do profissional para completar o documento.</div>`;

  $("pvTitle").textContent = TABS[currentTab].title;
  $("pvSub").textContent = TABS[currentTab].sub;

  $("pvBody").innerHTML = await TABS[currentTab].build();

  // assinatura
  $("pvSign").innerHTML = nome ? `
    <div class="sigrow">
      <div class="sig">
        <div class="line"></div>
        <div><b>${esc(nome)}</b></div>
        <div style="font-size:12px;color:#334155;">${esc(cr)}</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div><b>Assinatura do(a) paciente / responsável</b></div>
        <div style="font-size:12px;color:#334155;">(quando aplicável)</div>
      </div>
    </div>
  ` : `<div class="small" style="color:#374151;">(Preencha os dados do profissional para assinatura.)</div>`;

  // rodapé fixo: endereço/contato + conselho
  $("pvFooter").innerHTML = `
    <div class="left">${esc([end, tel, email].filter(Boolean).join(" • "))}</div>
    <div class="right">${esc(cr)}</div>
  `;
}

/* =========================
   EXPORT HTML do documento atual
   ========================= */
function downloadCurrentHTML(){
  const html = `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc($("pvTitle").textContent)}</title>
<style>${document.querySelector("style") ? document.querySelector("style").innerHTML : ""}</style>
<link rel="stylesheet" href="./style.css">
</head>
<body>
<div style="padding:10px;">
  ${$("paper").outerHTML}
</div>
</body>
</html>
  `.trim();

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `btx_${currentTab}_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   EVENTOS
   ========================= */
$("btnSalvarProf").addEventListener("click", async ()=>{
  const p = readProfFromUI();
  if(!p.nome){ alert("Digite o nome do profissional."); return; }
  await saveProf(p);
  toast("Profissional salvo ✅");
  await buildPreview();
});

$("btnLimparProf").addEventListener("click", async ()=>{
  await dbDel(STORES.prof, "prof");
  await setProfToUI();
  toast("Profissional limpo ✅");
  await buildPreview();
});

$("btnLimparForm").addEventListener("click", async ()=>{
  $("formPanel").querySelectorAll("input,textarea,select").forEach(el=> el.value="");
  toast("Form limpo ✅");
  await buildPreview();
});

$("btnDownload").addEventListener("click", async ()=>{
  await buildPreview();
  downloadCurrentHTML();
});

$("btnPrint").addEventListener("click", async ()=>{
  const prof = await loadProf();
  if(prof?.nome && !String(prof?.end||"").trim()){
    if(!confirm("Endereço do profissional está vazio. Imprimir assim mesmo?")) return;
  }
  await buildPreview();
  window.print();
});

$("btnResetAll").addEventListener("click", async ()=>{
  if(!confirm("Tem certeza? Isso apaga tudo do aparelho.")) return;
  await dbClear(STORES.prof);
  await dbClear(STORES.agenda);
  await dbClear(STORES.pacientes);
  await dbClear(STORES.prontuario);
  await dbClear(STORES.drafts);
  localStorage.removeItem(LS_UNLOCK);
  toast("Tudo zerado ✅");
  location.reload();
});

document.querySelectorAll(".tabbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
});

/* =========================
   ONLINE/OFFLINE indicador
   ========================= */
function updateNet(){
  $("netPill").textContent = navigator.onLine ? "Online" : "Offline";
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);
updateNet();

/* =========================
   FORÇAR UPDATE
   ========================= */
$("btnForceUpdate").addEventListener("click", ()=>{
  location.reload();
});

/* =========================
   INIT
   ========================= */
(async function init(){
  // login
  if(!isUnlocked()){
    lockUI(true);
    $("btnUnlock").addEventListener("click", ()=>{
      const k = $("lockKey").value.trim();
      if(k === LOGIN_KEY){
        setUnlocked();
        lockUI(false);
        toast("Acesso liberado ✅");
      } else {
        alert("Chave inválida.");
      }
    });
  }

  await setProfToUI();
  await renderTab("agenda");
})();
