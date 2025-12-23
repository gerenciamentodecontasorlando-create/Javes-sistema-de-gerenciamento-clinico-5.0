/* BTX Docs Saúde — App Principal (Agenda + Prontuário + Documentos) */
(() => {
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

  function brDate(iso){
    if(!iso) return "";
    const [y,m,d] = iso.split("-");
    if(!y||!m||!d) return iso;
    return `${d}/${m}/${y}`;
  }

  function nowBR(){
    const n = new Date();
    const d = n.toLocaleDateString("pt-BR");
    const t = n.toLocaleTimeString("pt-BR").slice(0,5);
    return `${d} • ${t}`;
  }

  function weekStartISO(dateISO){
    const d = dateISO ? new Date(dateISO+"T12:00:00") : new Date();
    const day = d.getDay(); // 0 dom
    const diff = (day === 0 ? -6 : 1) - day; // segunda como início
    d.setDate(d.getDate() + diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function addDaysISO(iso, days){
    const d = new Date(iso+"T12:00:00");
    d.setDate(d.getDate()+days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function uid(prefix="id"){
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async function setDraft(key, value){
    await BTXDB.put(BTXDB.STORES.drafts, { key, value });
  }
  async function getDraft(key){
    const row = await BTXDB.get(BTXDB.STORES.drafts, key);
    return row ? row.value : null;
  }

  /* ===== PROFISSIONAL ===== */
  const KV_PROF = "profissional_v1";

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

  function profResumo(p){
    if(!p?.nome) return "—";
    return `${p.nome}${p.esp ? " — " + p.esp : ""}`;
  }

  function headerHTML(p){
    const cr = [p?.conselho, p?.reg].filter(Boolean).join(" ").trim();
    const lines = [
      p?.nome ? `<p class="pname">${esc(p.nome)}</p>` : "",
      `<p class="pline">${esc(p?.esp || "")}${cr ? ` • <b>${esc(cr)}</b>` : ""}</p>`,
      p?.end ? `<p class="pline"><b>Endereço:</b> ${esc(p.end)}</p>` : `<p class="pline"><b>Endereço:</b> —</p>`,
      (p?.tel || p?.email) ? `<p class="pline"><b>Contato:</b> ${esc(p.tel || "")}${p.tel && p.email ? " • " : ""}${esc(p.email || "")}</p>` : `<p class="pline"><b>Contato:</b> —</p>`
    ].filter(Boolean).join("");
    return lines || `<p class="pline">Preencha os dados do profissional para cabeçalho completo.</p>`;
  }

  function signHTML(p){
    const cr = [p?.conselho, p?.reg].filter(Boolean).join(" ").trim();
    if(!p?.nome){
      return `<div class="small" style="color:#374151;">(Preencha o profissional para aparecer assinatura.)</div>`;
    }
    return `
      <div class="sigrow">
        <div class="sig">
          <div class="line"></div>
          <div><b>${esc(p.nome)}</b></div>
          <div style="font-size:12px;color:#334155;">${esc(cr || "")}</div>
        </div>
        <div class="sig">
          <div class="line"></div>
          <div><b>Assinatura do(a) paciente / responsável</b></div>
          <div style="font-size:12px;color:#334155;">(quando aplicável)</div>
        </div>
      </div>
    `;
  }

  /* ===== PACIENTES + PRONTUÁRIO ===== */
  async function upsertPatient({ name, phone }){
    const nameTrim = (name||"").trim();
    if(!nameTrim) return null;

    // tenta achar por nome+telefone
    const all = await BTXDB.getAll(BTXDB.STORES.patients);
    const phoneNorm = (phone||"").trim();
    const found = all.find(p => p.nameLower === nameTrim.toLowerCase() && (phoneNorm ? p.phone === phoneNorm : true));
    if(found) return found;

    const p = {
      id: uid("pat"),
      name: nameTrim,
      nameLower: nameTrim.toLowerCase(),
      phone: phoneNorm || "",
      createdAt: new Date().toISOString()
    };
    await BTXDB.put(BTXDB.STORES.patients, p);
    return p;
  }

  async function patientSearch(term){
    const t = (term||"").trim().toLowerCase();
    if(!t) return [];
    const all = await BTXDB.getAll(BTXDB.STORES.patients);
    return all
      .filter(p => p.nameLower.includes(t) || (p.phone||"").includes(t))
      .slice(0, 20);
  }

  async function addNote({ patientId, dateISO, title, text, procedure, status }){
    const note = {
      id: uid("note"),
      patientId,
      dateISO: dateISO || todayISO(),
      title: (title||"").trim(),
      procedure: (procedure||"").trim(),
      status: (status||"").trim(),
      text: (text||"").trim(),
      createdAt: new Date().toISOString()
    };
    await BTXDB.put(BTXDB.STORES.notes, note);
    return note;
  }

  async function getNotesByPatient(patientId){
    const all = await BTXDB.getAll(BTXDB.STORES.notes);
    return all
      .filter(n => n.patientId === patientId)
      .sort((a,b)=> (a.dateISO||"").localeCompare(b.dateISO||""));
  }

  /* ===== AGENDA ===== */
  async function addAgendaItem({ date, time, patientName, patientPhone, type, status, obs, patientId }){
    const item = {
      id: uid("ag"),
      date: date || todayISO(),
      time: time || "",
      patientName: (patientName||"").trim(),
      patientPhone: (patientPhone||"").trim(),
      patientId: patientId || "",
      type: type || "consulta",
      status: status || "aguardando",
      obs: (obs||"").trim(),
      createdAt: new Date().toISOString()
    };
    await BTXDB.put(BTXDB.STORES.agenda, item);
    return item;
  }

  async function listAgenda(){
    const all = await BTXDB.getAll(BTXDB.STORES.agenda);
    return all.sort((a,b)=> ((a.date||"")+" "+(a.time||"")).localeCompare((b.date||"")+" "+(b.time||"")));
  }

  async function listAgendaByDate(iso){
    const all = await listAgenda();
    return all.filter(x => x.date === iso);
  }

  async function listAgendaWeek(startISO){
    const endISO = addDaysISO(startISO, 6);
    const all = await listAgenda();
    return all.filter(x => x.date >= startISO && x.date <= endISO);
  }

  function agendaTableHTML(list){
    if(!list.length) return `<p class="doc-line">Nenhum agendamento encontrado.</p>`;

    const rows = list.map(it => `
      <tr>
        <td>${esc(brDate(it.date))}</td>
        <td>${esc(it.time||"")}</td>
        <td>${esc(it.patientName||"")}${it.patientPhone ? `<br><span style="color:#64748b;font-size:12px">${esc(it.patientPhone)}</span>` : ""}</td>
        <td>${esc(it.type||"")}</td>
        <td>${esc(it.status||"")}</td>
        <td>${esc(it.obs||"")}</td>
      </tr>
    `).join("");

    return `
      <div class="doc-title">Agendamentos</div>
      <table>
        <thead><tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ===== RECEITUÁRIO (botões 1 clique, limpo) =====
     Regra: PDF só espelha o campo final. Sem texto "nada a ver".
  */
  const RX = {
    // ANALGÉSICOS / ANTITÉRMICOS
    dipirona: "Dipirona 500mg\nTomar 01 comprimido a cada 6–8 horas, se dor ou febre, por até 3 dias.",
    paracetamol: "Paracetamol 750mg\nTomar 01 comprimido a cada 8 horas, se dor ou febre, por até 3 dias.",

    // ANTI-INFLAMATÓRIOS
    ibuprofeno: "Ibuprofeno 400mg\nTomar 01 comprimido a cada 8 horas, após alimentação, por 3 dias.",
    nimesulida: "Nimesulida 100mg\nTomar 01 comprimido a cada 12 horas, após alimentação, por 3 dias.",
    diclofenaco: "Diclofenaco de potássio 50mg\nTomar 01 comprimido a cada 8–12 horas, após alimentação, por 3 dias.",

    // ANTIBIÓTICOS
    amoxicilina: "Amoxicilina 500mg\nTomar 01 cápsula a cada 8 horas por 7 dias.",
    azitromicina: "Azitromicina 500mg\nTomar 01 comprimido ao dia por 3 dias.",
    amoxclav: "Amoxicilina 875mg + Clavulanato 125mg\nTomar 01 comprimido a cada 12 horas por 7 dias.",

    // HIPERTENSÃO (modelos)
    losartana: "Losartana 50mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    enalapril: "Enalapril 10mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    anlodipino: "Anlodipino 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    hidrocloro: "Hidroclorotiazida 25mg\nTomar 01 comprimido ao dia (conforme prescrição).",

    // DIABETES (modelos)
    metformina: "Metformina 500mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição).",
    metformina850: "Metformina 850mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição).",
    glibenclamida: "Glibenclamida 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    gliclazida: "Gliclazida MR 30mg\nTomar 01 comprimido ao dia (conforme prescrição).",

    // ANTIFÚNGICOS (clínico + dermato)
    fluconazol: "Fluconazol 150mg\nTomar 01 cápsula dose única (ou conforme prescrição).",
    cetoconazolCreme: "Cetoconazol creme 2%\nAplicar fina camada 2x ao dia por 14 dias (conforme orientação).",
    miconazolCreme: "Miconazol creme 2%\nAplicar fina camada 2x ao dia por 14 dias (conforme orientação).",
    nistatina: "Nistatina (suspensão oral)\nUsar conforme orientação (ex.: bochechar/aplicar 4x ao dia por 7–14 dias).",
    shampooCeto: "Shampoo cetoconazol 2%\nAplicar no couro cabeludo, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas.",

    // DERMATOLÓGICOS (alguns úteis no dia a dia)
    hidrocortisona: "Hidrocortisona creme 1%\nAplicar fina camada 2x ao dia por 5–7 dias (conforme orientação).",
    mupirocina: "Mupirocina pomada\nAplicar 2–3x ao dia por 5–7 dias (conforme orientação).",
    dexclorfeniramina: "Dexclorfeniramina 2mg\nTomar 01 comprimido a cada 8–12 horas se alergia (conforme prescrição)."
  };

  function appendRx(key){
    const ta = $("r_texto");
    if(!ta) return;
    const txt = RX[key];
    if(!txt) return;
    const cur = ta.value.trim();
    ta.value = cur ? (cur + "\n\n" + txt) : txt;
    ta.dispatchEvent(new Event("input"));
  }

  /* ===== TEMPLATE HELPERS ===== */
  function line(label, value){
    if (!value) return "";
    return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
  }

  function block(title, value){
    if (!value) return "";
    return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
  }

  /* ===== TABS ===== */
  const TABS = {
    agenda: {
      title: "Agenda semanal",
      sub: "Dia, semana, agenda e atendimentos — tudo salvo no aparelho.",
      renderForm: async () => {
        const d0 = todayISO();
        return `
          <label>Data (dia)</label>
          <input id="ag_date" type="date" value="${esc(d0)}" />

          <div class="row">
            <div>
              <label>Hora</label>
              <input id="ag_time" type="time" />
            </div>
            <div>
              <label>Paciente (nome)</label>
              <input id="ag_name" placeholder="Nome do paciente" />
            </div>
          </div>

          <div class="row">
            <div>
              <label>Telefone (opcional)</label>
              <input id="ag_phone" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label>Busca rápida (nome/telefone)</label>
              <input id="ag_search" placeholder="Digite para buscar paciente..." />
            </div>
          </div>

          <label>Selecionar paciente (opcional)</label>
          <select id="ag_patientPick">
            <option value="">— digite acima ou cadastre pelo nome —</option>
          </select>

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
          <input id="ag_obs" placeholder="Ex.: retorno pós-op, dor, etc." />

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnAgSave">Salvar</button>
            <button class="btn btn-ghost" type="button" id="btnAgDay">Ver dia</button>
            <button class="btn btn-ghost" type="button" id="btnAgWeek">Ver semana</button>
          </div>

          <p class="small" style="margin-top:10px;">
            Dica
