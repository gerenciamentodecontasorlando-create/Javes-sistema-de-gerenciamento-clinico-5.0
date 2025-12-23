/* BTX Docs Saúde — App (Agenda + Pacientes + Prontuário + Documentos + Backup) */
(() => {
  const $ = (id) => document.getElementById(id);

  const SETTINGS = BTXDB.STORES.settings;
  const PATIENTS = BTXDB.STORES.patients;
  const APPTS    = BTXDB.STORES.appts;
  const VISITS   = BTXDB.STORES.visits;
  const DOCS     = BTXDB.STORES.documents;

  const KEY_PROF = "profissional_v1";
  const KEY_FOCUS_PATIENT = "focus_patientId";
  const KEY_DOC_DRAFT = "doc_draft_v1";

  function uid(prefix="id"){
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

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

  function v(id){
    const el = $(id);
    return el ? el.value.trim() : "";
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

  function line(label, value){
    if (!value) return "";
    return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
  }

  function block(title, value){
    if (!value) return "";
    return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
  }

  function ensureDefaultDates(){
    ["ag_date","doc_date","pv_date"].forEach(id=>{
      const el = $(id);
      if (el && !el.value) el.value = todayISO();
    });
  }

  function parseISODate(iso){
    if(!iso) return null;
    const [y,m,d] = iso.split("-").map(Number);
    if(!y||!m||!d) return null;
    return new Date(y, m-1, d, 12, 0, 0);
  }

  function startOfWeekISO(iso){
    // semana iniciando na segunda
    const dt = parseISODate(iso) || new Date();
    const day = dt.getDay(); // 0 dom ... 6 sab
    const diff = (day === 0 ? -6 : 1 - day); // segunda = 0
    dt.setDate(dt.getDate() + diff);
    return toISO(dt);
  }

  function addDaysISO(iso, days){
    const dt = parseISODate(iso) || new Date();
    dt.setDate(dt.getDate() + days);
    return toISO(dt);
  }

  function toISO(dt){
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function inRange(iso, startISO, endISO){
    const d = parseISODate(iso)?.getTime();
    const s = parseISODate(startISO)?.getTime();
    const e = parseISODate(endISO)?.getTime();
    if(d==null||s==null||e==null) return false;
    return d >= s && d <= e;
  }

  async function getSetting(key, fallback=null){
    const val = await BTXDB.get(SETTINGS, key);
    return (val === null || val === undefined) ? fallback : val;
  }

  async function setSetting(key, value){
    await BTXDB.set(SETTINGS, value);
    // settings store usa key-value sem keyPath: precisamos usar key como "key"
    // então guardamos como par [key,value] no próprio "key" do objectStore.
  }

  // Ajuste: store settings foi criado sem keyPath, então BTXDB.set precisa do value,
  // mas também precisamos do "key". Vamos padronizar em objeto {key, value} usando put com chave externa:
  // Para isso, vamos sobrescrever helpers específicos:
  async function settingsSet(key, value){
    // usa transação direta via BTXDB.get/set (que usa put(value) e keyPath inexistente => put(value, key) não está implementado)
    // então aqui fazemos um hack: guardamos num objeto com propriedade __key e keyPath não existe, mas o IndexedDB permite put(value, key)
    // como BTXDB.set não suporta put(value, key), vamos usar localStorage só para settings críticos?
    // NÃO. Vamos fazer settings no próprio store patients? Não.
    // Solução simples: settings store sem keyPath -> precisamos de put(value, key). Recriar DB? não dá.
    // Então: vamos armazenar settings como item {id:key, value} num store dedicado com keyPath "id".
    // Como DB já foi criado, vamos usar store "patients"? Não.
    // Melhor: usar localStorage apenas para settings (prof/draft/focus). Memória dos dados clínicos fica no IndexedDB.
    localStorage.setItem("btx_setting_"+key, JSON.stringify(value));
  }

  async function settingsGet(key, fallback=null){
    try{
      const raw = localStorage.getItem("btx_setting_"+key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }

  async function settingsRemove(key){
    localStorage.removeItem("btx_setting_"+key);
  }

  async function loadProf(){
    return settingsGet(KEY_PROF, null);
  }
  async function saveProf(data){
    await settingsSet(KEY_PROF, data);
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

  function setProfToUI(p){
    $("profNome").value = p?.nome || "";
    $("profEsp").value = p?.esp || "";
    $("profConselho").value = p?.conselho || "";
    $("profReg").value = p?.reg || "";
    $("profEnd").value = p?.end || "";
    $("profTel").value = p?.tel || "";
    $("profEmail").value = p?.email || "";
  }

  function profLines(p){
    const cr = (p?.conselho || p?.reg) ? `${p.conselho || ""} ${p.reg || ""}`.trim() : "";
    return [p?.nome, p?.esp, cr, p?.end, p?.tel, p?.email].filter(Boolean);
  }

  async function setFocusPatient(patientId){
    await settingsSet(KEY_FOCUS_PATIENT, patientId || "");
  }
  async function getFocusPatient(){
    return settingsGet(KEY_FOCUS_PATIENT, "");
  }

  function downloadFile(filename, mime, content){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportAllBackup(){
    const payload = {
      exportedAt: new Date().toISOString(),
      profissional: await loadProf(),
      patients: await BTXDB.all(PATIENTS),
      appointments: await BTXDB.all(APPTS),
      visits: await BTXDB.all(VISITS),
      documents: await BTXDB.all(DOCS),
    };
    downloadFile(`BTX_Backup_${new Date().toISOString().slice(0,10)}.json`, "application/json", JSON.stringify(payload, null, 2));
  }

  async function importBackupFromJSON(text){
    const obj = JSON.parse(text);
    if(!obj || typeof obj !== "object") throw new Error("Backup inválido.");

    if(obj.profissional) await saveProf(obj.profissional);

    // limpa dados antes de importar?
    await BTXDB.wipeAll();

    // reimporta
    const pats = Array.isArray(obj.patients) ? obj.patients : [];
    const appts = Array.isArray(obj.appointments) ? obj.appointments : [];
    const visits = Array.isArray(obj.visits) ? obj.visits : [];
    const docs = Array.isArray(obj.documents) ? obj.documents : [];

    for(const p of pats) await BTXDB.set(PATIENTS, p);
    for(const a of appts) await BTXDB.set(APPTS, a);
    for(const v of visits) await BTXDB.set(VISITS, v);
    for(const d of docs) await BTXDB.set(DOCS, d);

    toast("Backup importado ✅");
  }

  /* =========================
     Tabs
     ========================= */
  let currentTab = "agenda";

  const TABS = {
    agenda: {
      title: "Agenda",
      sub: "Agendamento com visão do dia e da semana. Botão “Atender” gera prontuário.",
      renderForm: async () => {
        const baseDate = await settingsGet("agenda_date", todayISO());
        const weekStart = startOfWeekISO(baseDate);

        return `
          <div class="doc-title">Agenda do dia</div>
          <label>Data</label>
          <input id="ag_date" type="date" value="${esc(baseDate)}" />

          <div class="row">
            <div>
              <label>Hora</label>
              <input id="ag_time" type="time" />
            </div>
            <div>
              <label>Paciente (nome)</label>
              <input id="ag_patientName" placeholder="Digite o nome" />
            </div>
          </div>

          <div class="row">
            <div>
              <label>Tipo</label>
              <select id="ag_type">
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
          <input id="ag_obs" placeholder="Ex: dor, retorno pós-op…" />

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnAgAdd">Salvar na agenda</button>
            <button class="btn btn-ghost" type="button" id="btnAgToday">Hoje</button>
            <button class="btn btn-ghost" type="button" id="btnAgWeek">Semana</button>
          </div>

          <div class="doc-title">Atalhos</div>
          <div class="mini">
            <span class="pill" id="pillOpenPatients">📁 Abrir Pacientes</span>
            <span class="pill" id="pillOpenProntuario">🩺 Abrir Prontuário</span>
          </div>

          <p class="small" style="margin-top:10px;">
            “Semana” puxa a agenda de <b>${fmtDateBR(weekStart)}</b> até <b>${fmtDateBR(addDaysISO(weekStart, 6))}</b>.
          </p>
        `;
      },
      afterRender: async () => {
        ensureDefaultDates();

        $("ag_date").addEventListener("change", async () => {
          await settingsSet("agenda_date", $("ag_date").value || todayISO());
          await buildPreview();
        });

        $("btnAgToday").onclick = async () => {
          $("ag_date").value = todayISO();
          await settingsSet("agenda_date", $("ag_date").value);
          await buildPreview();
        };

        $("btnAgWeek").onclick = async () => {
          await settingsSet("agenda_view", "week");
          await buildPreview();
          toast("Visualizando semana ✅");
        };

        $("btnAgAdd").onclick = async () => {
          const date = v("ag_date") || todayISO();
          const time = v("ag_time");
          const patientName = v("ag_patientName");

          if(!patientName){
            alert("Digite o nome do paciente.");
            return;
          }

          // cria/acha paciente por nome (simples)
          let patient = (await BTXDB.all(PATIENTS)).find(p => (p.name||"").toLowerCase() === patientName.toLowerCase());
          if(!patient){
            patient = { id: uid("pat"), name: patientName, phone:"", createdAt: new Date().toISOString() };
            await BTXDB.set(PATIENTS, patient);
          }

          const appt = {
            id: uid("apt"),
            date,
            time,
            patientId: patient.id,
            patientName: patient.name,
            type: v("ag_type") || "consulta",
            status: v("ag_status") || "aguardando",
            obs: v("ag_obs"),
            createdAt: new Date().toISOString()
          };

          await BTXDB.set(APPTS, appt);

          $("ag_time").value = "";
          $("ag_patientName").value = "";
          $("ag_obs").value = "";

          toast("Agendamento salvo ✅");
          await buildPreview();
        };

        $("pillOpenPatients").onclick = () => renderTab("pacientes");
        $("pillOpenProntuario").onclick = () => renderTab("prontuario");
      },
      buildPreviewBody: async () => {
        const view = await settingsGet("agenda_view", "day");
        const date = v("ag_date") || await settingsGet("agenda_date", todayISO());
        const weekStart = startOfWeekISO(date);
        const weekEnd = addDaysISO(weekStart, 6);

        const appts = await BTXDB.all(APPTS);
        const list = appts
          .filter(a => view==="week" ? inRange(a.date, weekStart, weekEnd) : a.date === date)
          .sort((a,b) => (a.date+" "+(a.time||"")).localeCompare(b.date+" "+(b.time||"")));

        if(!list.length){
          return `<p class="doc-line">Nenhum agendamento encontrado.</p>`;
        }

        const title = view==="week"
          ? `Agenda da semana (${fmtDateBR(weekStart)} – ${fmtDateBR(weekEnd)})`
          : `Agenda do dia ${fmtDateBR(date)}`;

        const rows = list.map(a => `
          <tr>
            <td>${esc(fmtDateBR(a.date))}</td>
            <td>${esc(a.time||"")}</td>
            <td>${esc(a.patientName||"")}</td>
            <td>${esc(a.type||"")}</td>
            <td>${esc(a.status||"")}</td>
            <td>${esc(a.obs||"")}</td>
          </tr>
        `).join("");

        return `
          <div class="doc-title">${esc(title)}</div>
          <table>
            <thead><tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>

          <p class="small" style="margin-top:10px;color:#334155;">
            Dica: no módulo “Prontuário” você registra o atendimento do paciente e salva no histórico.
          </p>
        `;
      }
    },

    pacientes: {
      title: "Pacientes",
      sub: "Cadastro + busca. Selecione um paciente para trabalhar e exportar.",
      renderForm: async () => {
        const q = await settingsGet("patients_q", "");
        const focus = await getFocusPatient();
        const pats = await BTXDB.all(PATIENTS);

        const filtered = pats
          .filter(p => (p.name||"").toLowerCase().includes((q||"").toLowerCase()))
          .sort((a,b) => (a.name||"").localeCompare(b.name||""));

        const listHTML = filtered.map(p => `
          <div class="pill" data-patient="${esc(p.id)}">
            <span>👤 ${esc(p.name||"")}</span>
            ${focus===p.id ? `<span class="badge">ativo</span>` : `<span class="badge">selecionar</span>`}
          </div>
        `).join("");

        return `
          <div class="doc-title">Cadastrar paciente</div>
          <label>Nome</label>
          <input id="p_name" placeholder="Nome completo" />
          <div class="row">
            <div>
              <label>Telefone</label>
              <input id="p_phone" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label>Observações</label>
              <input id="p_notes" placeholder="Alergias, cuidados…" />
            </div>
          </div>

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnPAdd">Salvar paciente</button>
          </div>

          <div class="doc-title">Buscar</div>
          <input id="p_q" placeholder="Digite para filtrar" value="${esc(q)}" />

          <div class="doc-title">Lista</div>
          <div class="mini" id="p_list">
            ${listHTML || `<p class="small">Nenhum paciente encontrado.</p>`}
          </div>

          <div class="doc-title">Ações do paciente ativo</div>
          <div class="row">
            <button class="btn btn-ghost" type="button" id="btnGoPront">Abrir prontuário</button>
            <button class="btn btn-ghost" type="button" id="btnExportWeek">Baixar semana (JSON)</button>
          </div>
        `;
      },
      afterRender: async () => {
        $("btnPAdd").onclick = async () => {
          const name = v("p_name");
          if(!name){ alert("Digite o nome do paciente."); return; }
          const patient = {
            id: uid("pat"),
            name,
            phone: v("p_phone"),
            notes: v("p_notes"),
            createdAt: new Date().toISOString()
          };
          await BTXDB.set(PATIENTS, patient);
          toast("Paciente salvo ✅");
          renderTab("pacientes");
        };

        $("p_q").addEventListener("input", async () => {
          await settingsSet("patients_q", $("p_q").value || "");
          renderTab("pacientes");
        });

        $("p_list").querySelectorAll("[data-patient]").forEach(el=>{
          el.addEventListener("click", async ()=>{
            await setFocusPatient(el.dataset.patient);
            toast("Paciente ativo ✅");
            renderTab("pacientes");
          });
        });

        $("btnGoPront").onclick = async () => {
          const focus = await getFocusPatient();
          if(!focus){ alert("Selecione um paciente."); return; }
          renderTab("prontuario");
        };

        $("btnExportWeek").onclick = async () => {
          const focus = await getFocusPatient();
          if(!focus){ alert("Selecione um paciente."); return; }

          const base = todayISO();
          const weekStart = startOfWeekISO(base);
          const weekEnd = addDaysISO(weekStart, 6);

          const patient = await BTXDB.get(PATIENTS, focus);
          const visits = (await BTXDB.all(VISITS))
            .filter(v => v.patientId === focus && inRange(v.date, weekStart, weekEnd))
            .sort((a,b) => (a.date+" "+(a.time||"")).localeCompare(b.date+" "+(b.time||"")));

          const payload = {
            exportedAt: new Date().toISOString(),
            weekStart, weekEnd,
            profissional: await loadProf(),
            patient,
            visits
          };

          downloadFile(`BTX_${(patient?.name||"Paciente").replaceAll(" ","_")}_Semana_${weekStart}.json`, "application/json", JSON.stringify(payload, null, 2));
          toast("Semana exportada ✅");
        };
      },
      buildPreviewBody: async () => {
        const focus = await getFocusPatient();
        const pats = await BTXDB.all(PATIENTS);
        const p = focus ? await BTXDB.get(PATIENTS, focus) : null;

        return `
          <div class="doc-title">Paciente ativo</div>
          ${p ? `
            ${line("Nome", p.name)}
            ${line("Telefone", p.phone)}
            ${p.notes ? block("Observações", p.notes) : ""}
            <p class="doc-line"><strong>Cadastro:</strong> ${esc((p.createdAt||"").slice(0,10))}</p>
          ` : `<p class="doc-line">Nenhum paciente selecionado.</p>`}

          <div class="doc-title">Total de pacientes</div>
          <p class="doc-line">${pats.length}</p>

          <p class="small" style="margin-top:10px;color:#334155;">
            No prontuário, cada atendimento vira um registro com data e procedimentos.
          </p>
        `;
      }
    },

    prontuario: {
      title: "Prontuário",
      sub: "Atendimento por data (salva automático). Exporta semana do paciente.",
      renderForm: async () => {
        const focus = await getFocusPatient();
        const patient = focus ? await BTXDB.get(PATIENTS, focus) : null;

        const baseDate = await settingsGet("pront_date", todayISO());

        return `
          <div class="doc-title">Paciente</div>
          ${patient ? `
            <p class="doc-line"><strong>${esc(patient.name)}</strong></p>
            <p class="small">Paciente ativo. Você pode exportar a semana dele em “Pacientes” ou aqui.</p>
          ` : `
            <p class="small">Selecione um paciente em “Pacientes” para registrar atendimento.</p>
          `}

          <div class="doc-title">Registrar atendimento</div>
          <label>Data</label>
          <input id="pv_date" type="date" value="${esc(baseDate)}" />

          <div class="row">
            <div>
              <label>Hora (opcional)</label>
              <input id="pv_time" type="time" />
            </div>
            <div>
              <label>Tipo</label>
              <select id="pv_tipo">
                <option value="consulta">consulta</option>
                <option value="retorno">retorno</option>
                <option value="procedimento">procedimento</option>
                <option value="avaliacao">avaliação</option>
              </select>
            </div>
          </div>

          <label>Queixa / evolução</label>
          <textarea id="pv_evolucao" placeholder="Descreva evolução e sintomas…"></textarea>

          <label>Procedimentos realizados</label>
          <textarea id="pv_proced" placeholder="Descreva tudo que foi feito…"></textarea>

          <label>Conduta / plano</label>
          <textarea id="pv_plano" placeholder="Orientações, conduta, retorno…"></textarea>

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnPVSave">Salvar atendimento</button>
            <button class="btn btn-ghost" type="button" id="btnPVExportWeek">Baixar semana (JSON)</button>
          </div>

          <div class="doc-title">Histórico do paciente</div>
          <div class="mini" id="pv_hist"></div>
        `;
      },
      afterRender: async () => {
        ensureDefaultDates();

        const focus = await getFocusPatient();
        const patient = focus ? await BTXDB.get(PATIENTS, focus) : null;

        $("pv_date").addEventListener("change", async ()=>{
          await settingsSet("pront_date", $("pv_date").value || todayISO());
          await buildPreview();
        });

        async function refreshHistory(){
          const focusNow = await getFocusPatient();
          const histEl = $("pv_hist");
          if(!focusNow){
            histEl.innerHTML = `<p class="small">Selecione um paciente.</p>`;
            return;
          }
          const visits = (await BTXDB.all(VISITS))
            .filter(v => v.patientId === focusNow)
            .sort((a,b) => (b.date+" "+(b.time||"")).localeCompare(a.date+" "+(a.time||"")));

          if(!visits.length){
            histEl.innerHTML = `<p class="small">Nenhum atendimento registrado.</p>`;
            return;
          }

          histEl.innerHTML = visits.slice(0, 20).map(vs => `
            <div class="pill" data-visit="${esc(vs.id)}">
              <span>📌 ${esc(fmtDateBR(vs.date))} ${esc(vs.time||"")}</span>
              <span class="badge">${esc(vs.tipo||"")}</span>
            </div>
          `).join("");

          histEl.querySelectorAll("[data-visit]").forEach(el=>{
            el.addEventListener("click", async ()=>{
              const id = el.dataset.visit;
              const vs = await BTXDB.get(VISITS, id);
              if(!vs) return;

              $("pv_date").value = vs.date || todayISO();
              $("pv_time").value = vs.time || "";
              $("pv_tipo").value = vs.tipo || "consulta";
              $("pv_evolucao").value = vs.evolucao || "";
              $("pv_proced").value = vs.procedimentos || "";
              $("pv_plano").value = vs.plano || "";

              toast("Atendimento carregado ✅");
              await buildPreview();
            });
          });
        }

        $("btnPVSave").onclick = async () => {
          const focusNow = await getFocusPatient();
          if(!focusNow){ alert("Selecione um paciente em “Pacientes”."); return; }

          const date = v("pv_date") || todayISO();
          const visit = {
            id: uid("visit"),
            patientId: focusNow,
            date,
            time: v("pv_time"),
            tipo: v("pv_tipo") || "consulta",
            evolucao: v("pv_evolucao"),
            procedimentos: v("pv_proced"),
            plano: v("pv_plano"),
            createdAt: new Date().toISOString()
          };

          await BTXDB.set(VISITS, visit);
          toast("Atendimento salvo ✅");
          await refreshHistory();
          await buildPreview();
        };

        $("btnPVExportWeek").onclick = async () => {
          const focusNow = await getFocusPatient();
          if(!focusNow){ alert("Selecione um paciente."); return; }
          const patientNow = await BTXDB.get(PATIENTS, focusNow);

          const base = v("pv_date") || todayISO();
          const weekStart = startOfWeekISO(base);
          const weekEnd = addDaysISO(weekStart, 6);

          const visits = (await BTXDB.all(VISITS))
            .filter(v => v.patientId === focusNow && inRange(v.date, weekStart, weekEnd))
            .sort((a,b) => (a.date+" "+(a.time||"")).localeCompare(b.date+" "+(b.time||"")));

          const payload = {
            exportedAt: new Date().toISOString(),
            weekStart, weekEnd,
            profissional: await loadProf(),
            patient: patientNow,
            visits
          };

          downloadFile(`BTX_${(patientNow?.name||"Paciente").replaceAll(" ","_")}_Semana_${weekStart}.json`, "application/json", JSON.stringify(payload, null, 2));
          toast("Semana exportada ✅");
        };

        await refreshHistory();
      },
      buildPreviewBody: async () => {
        const focus = await getFocusPatient();
        const patient = focus ? await BTXDB.get(PATIENTS, focus) : null;

        if(!patient){
          return `<p class="doc-line">Selecione um paciente em “Pacientes”.</p>`;
        }

        const date = v("pv_date") || todayISO();

        return `
          <div class="doc-title">Resumo do atendimento</div>
          ${line("Paciente", patient.name)}
          ${line("Data", fmtDateBR(date))}
          ${line("Hora", v("pv_time"))}
          ${line("Tipo", v("pv_tipo"))}
          ${block("Evolução", v("pv_evolucao"))}
          ${block("Procedimentos realizados", v("pv_proced"))}
          ${block("Conduta / plano", v("pv_plano"))}

          <p class="small" style="margin-top:10px;color:#334155;">
            Tudo acima é salvo quando você clica “Salvar atendimento”.
          </p>
        `;
      }
    },

    docs: {
      title: "Documentos",
      sub: "Ficha, Receituário, Recibo, Orçamento, Laudo e Atestado. PDF via imprimir.",
      renderForm: async () => {
        const draft = await settingsGet(KEY_DOC_DRAFT, { type:"ficha", date: todayISO() });
        const focus = await getFocusPatient();
        const patient = focus ? await BTXDB.get(PATIENTS, focus) : null;

        return `
          <div class="doc-title">Paciente</div>
          <label>Nome</label>
          <input id="doc_patient" value="${esc(patient?.name || draft.patient || "")}" placeholder="Nome do paciente" />

          <div class="row">
            <div>
              <label>Telefone</label>
              <input id="doc_phone" value="${esc(patient?.phone || draft.phone || "")}" />
            </div>
            <div>
              <label>Data</label>
              <input id="doc_date" type="date" value="${esc(draft.date || todayISO())}" />
            </div>
          </div>

          <div class="doc-title">Tipo de documento</div>
          <select id="doc_type">
            ${[
              ["ficha","Ficha clínica"],
              ["receita","Receituário (livre)"],
              ["recibo","Recibo"],
              ["orcamento","Orçamento"],
              ["laudo","Laudo"],
              ["atestado","Atestado"]
            ].map(([k,l])=>`<option value="${k}" ${draft.type===k?"selected":""}>${l}</option>`).join("")}
          </select>

          <div id="doc_fields"></div>

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnDocSave">Salvar documento</button>
            <button class="btn btn-ghost" type="button" id="btnDocClear">Limpar</button>
          </div>

          <p class="small" style="margin-top:10px;">
            Dica: selecione um paciente em “Pacientes” para preencher automático.
          </p>
        `;
      },
      afterRender: async () => {
        ensureDefaultDates();

        async function getDraft(){
          return settingsGet(KEY_DOC_DRAFT, { type:"ficha", date: todayISO() });
        }

        async function setDraft(d){
          await settingsSet(KEY_DOC_DRAFT, d);
        }

        function fieldsTemplate(type, d){
          if(type==="ficha"){
            return `
              <div class="doc-title">Ficha clínica</div>
              <label>Queixa principal</label>
              <textarea id="d_qp">${esc(d.qp||"")}</textarea>
              <label>Anamnese</label>
              <textarea id="d_anamnese">${esc(d.anamnese||"")}</textarea>
              <label>Planejamento</label>
              <textarea id="d_plan">${esc(d.plan||"")}</textarea>
              <label>Procedimentos realizados hoje</label>
              <textarea id="d_proc">${esc(d.proc||"")}</textarea>
            `;
          }
          if(type==="receita"){
            return `
              <div class="doc-title">Receituário (texto livre)</div>
              <label>Prescrição / Orientações</label>
              <textarea id="d_rx" placeholder="Digite tudo livre…">${esc(d.rx||"")}</textarea>
            `;
          }
          if(type==="recibo"){
            return `
              <div class="doc-title">Recibo</div>
              <div class="row">
                <div>
                  <label>Valor (R$)</label>
                  <input id="d_valor" type="number" step="0.01" value="${esc(d.valor||"")}" />
                </div>
                <div>
                  <label>Forma</label>
                  <input id="d_forma" placeholder="PIX / dinheiro / cartão" value="${esc(d.forma||"")}" />
                </div>
              </div>
              <label>Referente a</label>
              <input id="d_ref" value="${esc(d.ref||"")}" />
              <label>Observações</label>
              <textarea id="d_obs">${esc(d.obs||"")}</textarea>
            `;
          }
          if(type==="orcamento"){
            return `
              <div class="doc-title">Orçamento</div>
              <p class="small">Até 10 itens. Total soma automático.</p>
              ${Array.from({length:10}).map((_,i)=>{
                const n=i+1;
                return `
                  <div class="row">
                    <div>
                      <label>Procedimento ${n}</label>
                      <input id="d_it${n}" value="${esc(d["it"+n]||"")}" />
                    </div>
                    <div>
                      <label>Valor ${n} (R$)</label>
                      <input id="d_v${n}" type="number" step="0.01" value="${esc(d["v"+n]||"")}" />
                    </div>
                  </div>
                `;
              }).join("")}
              <label>Observações</label>
              <textarea id="d_obs">${esc(d.obs||"")}</textarea>
            `;
          }
          if(type==="laudo"){
            return `
              <div class="doc-title">Laudo</div>
              <label>Título</label>
              <input id="d_titulo" value="${esc(d.titulo||"")}" />
              <label>Descrição</label>
              <textarea id="d_desc">${esc(d.desc||"")}</textarea>
              <label>Conclusão</label>
              <textarea id="d_conc">${esc(d.conc||"")}</textarea>
            `;
          }
          if(type==="atestado"){
            return `
              <div class="doc-title">Atestado</div>
              <div class="row">
                <div>
                  <label>Dias de afastamento (opcional)</label>
                  <input id="d_dias" type="number" min="0" step="1" value="${esc(d.dias||"")}" />
                </div>
                <div>
                  <label>Cidade</label>
                  <input id="d_cidade" value="${esc(d.cidade||"")}" />
                </div>
              </div>
              <label>Texto do atestado</label>
              <textarea id="d_texto" placeholder="Atesto para os devidos fins…">${esc(d.texto||"")}</textarea>
            `;
          }
          return `<p class="small">Selecione um tipo.</p>`;
        }

        async function collectDraft(){
          const base = await getDraft();
          const type = $("doc_type").value;

          const pick = (id) => (document.getElementById(id)?.value || "");

          const d = {
            ...base,
            type,
            patient: v("doc_patient"),
            phone: v("doc_phone"),
            date: v("doc_date") || todayISO(),
          };

          if(type==="ficha"){
            d.qp = pick("d_qp");
            d.anamnese = pick("d_anamnese");
            d.plan = pick("d_plan");
            d.proc = pick("d_proc");
          } else if(type==="receita"){
            d.rx = pick("d_rx");
          } else if(type==="recibo"){
            d.valor = pick("d_valor");
            d.forma = pick("d_forma");
            d.ref = pick("d_ref");
            d.obs = pick("d_obs");
          } else if(type==="orcamento"){
            for(let i=1;i<=10;i++){
              d["it"+i] = pick(`d_it${i}`);
              d["v"+i]  = pick(`d_v${i}`);
            }
            d.obs = pick("d_obs");
          } else if(type==="laudo"){
            d.titulo = pick("d_titulo");
            d.desc = pick("d_desc");
            d.conc = pick("d_conc");
          } else if(type==="atestado"){
            d.dias = pick("d_dias");
            d.cidade = pick("d_cidade");
            d.texto = pick("d_texto");
          }

          await setDraft(d);
          return d;
        }

        async function renderFields(){
          const d = await getDraft();
          $("doc_fields").innerHTML = fieldsTemplate(d.type || "ficha", d);

          $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
            el.addEventListener("input", async ()=>{ await collectDraft(); await buildPreview(); });
            el.addEventListener("change", async ()=>{ await collectDraft(); await buildPreview(); });
          });
        }

        $("doc_type").addEventListener("change", async ()=>{
          await collectDraft();
          await renderFields();
          await buildPreview();
        });

        $("btnDocClear").onclick = async ()=>{
          await settingsSet(KEY_DOC_DRAFT, { type: $("doc_type").value, date: todayISO() });
          toast("Documento limpo ✅");
          await renderFields();
          await buildPreview();
        };

        $("btnDocSave").onclick = async ()=>{
          const focus = await getFocusPatient();
          const patient = focus ? await BTXDB.get(PATIENTS, focus) : null;

          const d = await collectDraft();
          if(!d.patient){
            alert("Digite o nome do paciente.");
            return;
          }

          const doc = {
            id: uid("doc"),
            patientId: patient?.id || null,
            patientName: d.patient,
            type: d.type,
            date: d.date || todayISO(),
            payload: d,
            createdAt: new Date().toISOString()
          };

          await BTXDB.set(DOCS, doc);
          toast("Documento salvo ✅");
          await buildPreview();
        };

        await renderFields();
      },
      buildPreviewBody: async () => {
        const d = await settingsGet(KEY_DOC_DRAFT, { type:"ficha", date: todayISO() });
        if(!d.patient){
          return `<p class="doc-line">Digite o paciente para gerar o documento.</p>`;
        }

        const header = `
          ${line("Paciente", d.patient)}
          ${d.phone ? line("Telefone", d.phone) : ""}
          ${line("Data", fmtDateBR(d.date || todayISO()))}
        `;

        const t = d.type || "ficha";

        if(t==="ficha"){
          return [
            `<div class="doc-title">Ficha Clínica</div>`,
            header,
            block("Queixa principal", d.qp||""),
            block("Anamnese", d.anamnese||""),
            block("Planejamento", d.plan||""),
            block("Procedimentos realizados hoje", d.proc||"")
          ].join("");
        }
        if(t==="receita"){
          return [
            `<div class="doc-title">Receituário</div>`,
            header,
            block("Prescrição / Orientações", d.rx||"")
          ].join("");
        }
        if(t==="recibo"){
          const valor = d.valor ? Number(d.valor||0).toFixed(2) : "";
          return [
            `<div class="doc-title">Recibo</div>`,
            header,
            `<p class="doc-line">Recebi de <strong>${esc(d.patient)}</strong> a quantia de <strong>R$ ${esc(valor||"0,00")}</strong>.</p>`,
            d.ref ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(d.ref)}</p>` : "",
            d.forma ? `<p class="doc-line"><strong>Forma:</strong> ${esc(d.forma)}</p>` : "",
            block("Observações", d.obs||"")
          ].filter(Boolean).join("");
        }
        if(t==="orcamento"){
          const itens = [];
          for(let i=1;i<=10;i++){
            const desc = (d["it"+i]||"").trim();
            const vv = Number(d["v"+i]||0);
            if(desc || vv) itens.push({desc, vv});
          }
          const total = itens.reduce((a,b)=>a+(b.vv||0),0);

          const table = itens.length ? `
            <table>
              <thead><tr><th>Procedimento</th><th>Valor (R$)</th></tr></thead>
              <tbody>${itens.map(it=>`<tr><td>${esc(it.desc)}</td><td>${(it.vv||0).toFixed(2)}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td>Total</td><td>${total.toFixed(2)}</td></tr></tfoot>
            </table>
          ` : `<p class="doc-line">Nenhum item.</p>`;

          return [
            `<div class="doc-title">Orçamento</div>`,
            header,
            table,
            block("Observações", d.obs||"")
          ].join("");
        }
        if(t==="laudo"){
          return [
            `<div class="doc-title">Laudo</div>`,
            header,
            d.titulo ? line("Título", d.titulo) : "",
            block("Descrição", d.desc||""),
            block("Conclusão", d.conc||"")
          ].filter(Boolean).join("");
        }
        if(t==="atestado"){
          const dias = Number(d.dias||0);
          const cidade = (d.cidade||"Cidade").trim();
          return [
            `<div class="doc-title">Atestado</div>`,
            header,
            (dias>0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : "",
            block("Texto", d.texto || "Atesto para os devidos fins que o(a) paciente acima esteve sob meus cuidados."),
            `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(fmtDateBR(d.date || todayISO()))}</p>`
          ].filter(Boolean).join("");
        }
        return `<p class="doc-line">Selecione um documento.</p>`;
      }
    },

    backup: {
      title: "Backup",
      sub: "Baixar tudo (JSON) e importar. Isso é teu botão de “baixar” completão.",
      renderForm: async () => `
        <div class="doc-title">Baixar</div>
        <p class="small">
          Exporta tudo do app: pacientes, agenda, prontuários e documentos.
          Isso é o “botão de baixar” que não te deixa na mão.
        </p>

        <div class="actions" style="justify-content:flex-start; margin-top:10px;">
          <button class="btn btn-primary" type="button" id="btnBackupDownload">Baixar backup (JSON)</button>
        </div>

        <div class="doc-title">Importar</div>
        <p class="small">Importa um backup JSON e restaura tudo.</p>

        <input id="backupFile" type="file" accept="application/json" />

        <div class="actions" style="justify-content:flex-start; margin-top:10px;">
          <button class="btn btn-ghost" type="button" id="btnBackupImport">Importar backup</button>
        </div>

        <div class="doc-title">Dica</div>
        <p class="small">Após importar, feche e abra o app para garantir atualização de cache.</p>
      `,
      afterRender: async () => {
        $("btnBackupDownload").onclick = async () => {
          await exportAllBackup();
          toast("Backup baixado ✅");
        };

        $("btnBackupImport").onclick = async () => {
          const file = $("backupFile").files?.[0];
          if(!file){ alert("Selecione um arquivo JSON."); return; }
          const text = await file.text();
          await importBackupFromJSON(text);
          renderTab("agenda");
        };
      },
      buildPreviewBody: async () => {
        const pCount = (await BTXDB.all(PATIENTS)).length;
        const aCount = (await BTXDB.all(APPTS)).length;
        const vCount = (await BTXDB.all(VISITS)).length;
        const dCount = (await BTXDB.all(DOCS)).length;

        return `
          <div class="doc-title">Resumo do banco local</div>
          ${line("Pacientes", String(pCount))}
          ${line("Agendamentos", String(aCount))}
          ${line("Atendimentos (prontuário)", String(vCount))}
          ${line("Documentos salvos", String(dCount))}

          <p class="small" style="margin-top:10px;color:#334155;">
            Esse “backup” é seu seguro: se trocar de celular, você restaura tudo.
          </p>
        `;
      }
    }
  };

  async function renderTab(tab){
    currentTab = tab;

    document.querySelectorAll(".tabbtn").forEach(b=>{
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    $("docTitle").textContent = TABS[tab].title;
    $("docSub").textContent = TABS[tab].sub;

    $("formPanel").innerHTML = await TABS[tab].renderForm();

    // eventos padrão para preview
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      el.addEventListener("input", buildPreview);
      el.addEventListener("change", buildPreview);
    });

    ensureDefaultDates();
    if (typeof TABS[tab].afterRender === "function") await TABS[tab].afterRender();
    await buildPreview();
  }

  async function buildPreview(){
    const now = new Date();
    $("pvMeta").textContent = `${now.toLocaleDateString("pt-BR")} • ${now.toLocaleTimeString("pt-BR").slice(0,5)}`;
    $("pvTitle").textContent = TABS[currentTab].title;
    $("pvSub").textContent = TABS[currentTab].sub;

    const prof = await loadProf();
    const lines = profLines(prof);

    $("profResumo").textContent = (lines.length ? `${lines[0]}${lines[1] ? " — " + lines[1] : ""}` : "—");
    $("topInfo").textContent = lines.length ? `Profissional salvo: ${lines[0]}` : "Preencha os dados do profissional (salva offline).";

    $("pvBody").innerHTML = await TABS[currentTab].buildPreviewBody();

    if (lines.length){
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
      $("pvSign").innerHTML = `<div class="small" style="color:#374151;">(Preencha os dados do profissional para aparecer assinatura.)</div>`;
    }
  }

  /* Buttons gerais */
  $("btnSalvarProf").addEventListener("click", async ()=>{
    const p = readProfFromUI();
    if (!p.nome){
      alert("Digite pelo menos o nome do profissional para salvar.");
      return;
    }
    await saveProf(p);
    toast("Profissional salvo ✅");
    await buildPreview();
  });

  $("btnLimparProf").addEventListener("click", async ()=>{
    await settingsRemove(KEY_PROF);
    setProfToUI(null);
    toast("Profissional limpo ✅");
    await buildPreview();
  });

  $("btnLimparForm").addEventListener("click", async ()=>{
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      // não limpa file inputs
      if(el.type === "file") return;
      el.value = "";
    });
    ensureDefaultDates();
    toast("Formulário limpo ✅");
    await buildPreview();
  });

  $("btnPrint").addEventListener("click", async ()=>{
    await buildPreview();
    window.print();
  });

  $("btnResetAll").addEventListener("click", async ()=>{
    if(!confirm("Tem certeza? Isso apaga tudo do aparelho (pacientes, agenda, prontuário e docs).")) return;
    await settingsRemove(KEY_PROF);
    await settingsRemove(KEY_FOCUS_PATIENT);
    await settingsRemove(KEY_DOC_DRAFT);
    localStorage.removeItem("btx_setting_agenda_date");
    localStorage.removeItem("btx_setting_agenda_view");
    localStorage.removeItem("btx_setting_patients_q");
    localStorage.removeItem("btx_setting_pront_date");
    await BTXDB.wipeAll();
    setProfToUI(null);
    toast("Tudo zerado ✅");
    await renderTab("agenda");
  });

  /* init tabs */
  document.querySelectorAll(".tabbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
  });

  /* init prof + app */
  (async () => {
    setProfToUI(await loadProf());
    await renderTab("agenda");
    toast("BTX pronto ✅ (offline + memória forte)");
  })();
})();
