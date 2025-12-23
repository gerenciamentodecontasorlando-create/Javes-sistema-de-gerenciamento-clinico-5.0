/* BTX Docs Saúde — App */
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

  function pad(n){ return String(n).padStart(2,"0"); }

  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function nowBR(){
    const d = new Date();
    const dt = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
    const hh = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${dt} • ${hh}`;
  }

  function fmtBRFromISO(iso){
    if(!iso) return "";
    const [y,m,d] = iso.split("-");
    if(!y||!m||!d) return iso;
    return `${d}/${m}/${y}`;
  }

  function weekStartISO(iso){
    // Monday as start
    const d = iso ? new Date(iso+"T12:00:00") : new Date();
    const day = d.getDay(); // 0=Sun
    const diff = (day===0 ? -6 : 1) - day; // move to Monday
    d.setDate(d.getDate()+diff);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function addDaysISO(iso, n){
    const d = new Date((iso||todayISO()) + "T12:00:00");
    d.setDate(d.getDate()+n);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function line(label, value){
    if (!value) return "";
    return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
  }

  function block(title, value){
    if (!value) return "";
    return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
  }

  function downloadText(filename, content, type="text/plain;charset=utf-8"){
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  /* =========================
     LOGIN (chave simples)
     ========================= */
  const DEFAULT_KEY = "btx007";
  async function getSavedKey(){
    return await BTXDB.getSetting("login_key", DEFAULT_KEY);
  }
  async function setSavedKey(key){
    await BTXDB.setSetting("login_key", key);
  }
  async function isUnlocked(){
    return await BTXDB.getSetting("unlocked", false);
  }
  async function setUnlocked(v){
    await BTXDB.setSetting("unlocked", !!v);
  }

  async function showLogin(force=false){
    const overlay = $("loginOverlay");
    if(!overlay) return;

    if(!force){
      const unlocked = await isUnlocked();
      if(unlocked){
        overlay.style.display = "none";
        return;
      }
    }

    overlay.style.display = "flex";
    $("loginKey").value = "";

    $("btnLogin").onclick = async ()=>{
      const typed = ($("loginKey").value || "").trim().toLowerCase();
      const saved = (await getSavedKey()).toLowerCase();
      if(typed && typed === saved){
        await setUnlocked(true);
        overlay.style.display = "none";
        toast("Acesso liberado ✅");
      }else{
        toast("Chave incorreta ❌");
      }
    };

    $("btnResetLock").onclick = async ()=>{
      // permite trocar chave se usuário souber a atual
      const cur = prompt("Digite a chave atual para trocar:");
      if(!cur) return;
      const saved = (await getSavedKey()).toLowerCase();
      if(cur.trim().toLowerCase() !== saved){
        toast("Chave atual incorreta ❌");
        return;
      }
      const nova = prompt("Nova chave (minúsculo, sem espaços):", saved);
      if(!nova) return;
      await setSavedKey(nova.trim().toLowerCase());
      await setUnlocked(false);
      toast("Chave trocada ✅ Faça login novamente.");
      overlay.style.display = "flex";
    };
  }

  /* =========================
     PROFISSIONAL
     ========================= */
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

  /* =========================
     RX PRESETS (completo)
     - Conteúdo é para "atalho", mas o PDF só imprime o que estiver no campo.
     ========================= */
  const RX_PRESETS = {
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
    hctz: "Hidroclorotiazida 25mg (HCTZ)\nTomar 01 comprimido ao dia (conforme prescrição).",

    // Diabetes
    metformina: "Metformina 500mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição).",
    glibenclamida: "Glibenclamida 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    gliclazida: "Gliclazida 30mg (liberação prolongada)\nTomar 01 comprimido ao dia (conforme prescrição).",

    // Antifúngicos / dermatológicos
    fluconazol: "Fluconazol 150mg\nTomar 01 cápsula dose única (ou conforme prescrição).",
    cetoconazol_creme: "Cetoconazol creme 2%\nAplicar fina camada 2x ao dia por 14 dias (conforme orientação).",
    miconazol_creme: "Miconazol creme 2%\nAplicar fina camada 2x ao dia por 14 dias (conforme orientação).",
    terbinafina_creme: "Terbinafina creme 1%\nAplicar 1–2x ao dia por 7–14 dias (conforme orientação).",
    shampoo_cetoconazol: "Shampoo cetoconazol 2%\nAplicar no couro cabeludo, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas."
  };

  function appendRxPreset(key){
    const ta = $("r_corpo");
    if(!ta) return;
    const txt = RX_PRESETS[key];
    if(!txt) return;
    const cur = ta.value.trim();
    ta.value = cur ? (cur + "\n\n" + txt) : txt;

    // salva rascunho
    saveDraftForTab("receita");
    buildPreview();
  }

  /* =========================
     DRAFTS (rascunho de documentos)
     ========================= */
  async function saveDraftForTab(tab){
    const data = {};
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      if(!el.id) return;
      data[el.id] = el.value;
    });
    await BTXDB.saveDraft("draft_"+tab, { tab, data });
  }

  async function loadDraftForTab(tab){
    const d = await BTXDB.getDraft("draft_"+tab);
    return d?.data || null;
  }

  async function applyDraftToForm(draft){
    if(!draft) return;
    for(const [k,v] of Object.entries(draft)){
      const el = $(k);
      if(el) el.value = v;
    }
  }

  /* =========================
     AGENDA + PACIENTES + PRONTUÁRIO
     ========================= */
  async function ensurePacienteFromInput(nome, tel=""){
    nome = (nome||"").trim();
    tel = (tel||"").trim();
    if(!nome) return null;

    // tenta achar por nome+tel
    const all = await BTXDB.listPacientes();
    const found = all.find(p =>
      (p.nome||"").toLowerCase() === nome.toLowerCase() &&
      ((tel && (p.tel||"")===tel) || (!tel))
    );
    if(found) return found;

    return await BTXDB.upsertPaciente({ nome, tel });
  }

  function agendaRowHTML(it, pacienteNome){
    return `
      <tr>
        <td>${esc(it.hora||"")}</td>
        <td>${esc(pacienteNome||it.pacienteNome||"")}</td>
        <td>${esc(it.tipo||"")}</td>
        <td>${esc(it.status||"")}</td>
        <td>${esc(it.obs||"")}</td>
      </tr>
    `;
  }

  async function agendaTableHTML(list){
    if(!list.length){
      return `<p class="doc-line">Nenhum agendamento encontrado.</p>`;
    }
    // resolve nomes
    const pacientes = await BTXDB.listPacientes();
    const map = new Map(pacientes.map(p=>[p.id,p]));

    const rows = list.map(it=>{
      const p = it.pacienteId ? map.get(it.pacienteId) : null;
      const nome = p?.nome || it.pacienteNome || "";
      return agendaRowHTML(it, nome);
    }).join("");

    return `
      <div class="doc-title">Agendamentos</div>
      <table>
        <thead><tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  async function listAgendaByDay(iso){
    const all = await BTXDB.listAgenda();
    return all
      .filter(it=>it.data === iso)
      .sort((a,b)=> (a.hora||"").localeCompare(b.hora||""));
  }

  async function listAgendaWeek(weekStart){
    const days = Array.from({length:7}, (_,i)=>addDaysISO(weekStart,i));
    const all = await BTXDB.listAgenda();
    return all
      .filter(it=> days.includes(it.data))
      .sort((a,b)=> (a.data+" "+(a.hora||"")).localeCompare(b.data+" "+(b.hora||"")));
  }

  async function atendimentosTableHTML(pacienteId){
    const p = await BTXDB.getPaciente(pacienteId);
    const list = await BTXDB.listAtendimentosByPaciente(pacienteId);
    list.sort((a,b)=>(a.data||"").localeCompare(b.data||""));

    if(!list.length){
      return `<p class="doc-line">Nenhum atendimento registrado ainda.</p>`;
    }

    const rows = list.map(it=>`
      <tr>
        <td>${esc(fmtBRFromISO(it.data||""))}</td>
        <td>${esc(it.tipo||"")}</td>
        <td>${esc(it.descricao||"")}</td>
        <td>${esc(it.conduta||"")}</td>
      </tr>
    `).join("");

    return `
      ${p?.nome ? `<div class="doc-title">Histórico — ${esc(p.nome)}</div>` : `<div class="doc-title">Histórico</div>`}
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Conduta</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* =========================
     TABS
     ========================= */
  const TABS = {
    agenda: {
      title: "Agenda",
      sub: "Dia e semana, offline com memória forte.",
      renderForm: async () => {
        const today = todayISO();
        return `
          <label>Data</label>
          <input id="ag_data" type="date" value="${today}" />

          <div class="row">
            <div>
              <label>Hora</label>
              <input id="ag_hora" type="time" />
            </div>
            <div>
              <label>Paciente (nome)</label>
              <input id="ag_paciente_nome" placeholder="Digite o nome do paciente" />
            </div>
          </div>

          <div class="row">
            <div>
              <label>Telefone (opcional)</label>
              <input id="ag_paciente_tel" placeholder="(00) 00000-0000" />
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
              <label>Observações</label>
              <input id="ag_obs" placeholder="Ex: retorno pós-op, dor, etc." />
            </div>
          </div>

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnAgSalvar">Salvar</button>
            <button class="btn btn-ghost" type="button" id="btnAgHoje">Hoje</button>
            <button class="btn btn-ghost" type="button" id="btnAgSemana">Semana</button>
          </div>

          <p class="small" style="margin-top:10px;">
            Dica: “Semana” monta a visão semanal no PDF. “Salvar” grava o nome do paciente corretamente.
          </p>
        `;
      },
      build: async () => {
        const day = ($("ag_data")?.value || todayISO());
        const mode = window.__agendaMode || "day";
        if(mode === "week"){
          const ws = weekStartISO(day);
          const list = await listAgendaWeek(ws);
          return `
            <div class="doc-title">Semana (início): ${esc(fmtBRFromISO(ws))}</div>
            ${await agendaTableHTML(list)}
          `;
        } else {
          const list = await listAgendaByDay(day);
          return `
            <div class="doc-title">Agenda do dia — ${esc(fmtBRFromISO(day))}</div>
            ${await agendaTableHTML(list)}
          `;
        }
      },
      afterRender: async () => {
        window.__agendaMode = "day";

        $("btnAgSalvar").addEventListener("click", async ()=>{
          const data = $("ag_data").value || todayISO();
          const hora = ($("ag_hora").value || "").trim();
          const nome = ($("ag_paciente_nome").value || "").trim();
          const tel = ($("ag_paciente_tel").value || "").trim();
          if(!nome){
            toast("Digite o nome do paciente ❌");
            return;
          }

          const p = await ensurePacienteFromInput(nome, tel);

          await BTXDB.addAgenda({
            data,
            hora,
            pacienteId: p?.id || null,
            pacienteNome: p?.nome || nome,
            tipo: $("ag_tipo").value || "consulta",
            status: $("ag_status").value || "aguardando",
            obs: $("ag_obs").value || ""
          });

          $("ag_hora").value = "";
          $("ag_paciente_nome").value = "";
          $("ag_paciente_tel").value = "";
          $("ag_obs").value = "";

          toast("Agendamento salvo ✅");
          await saveDraftForTab("agenda");
          await buildPreview();
        });

        $("btnAgHoje").addEventListener("click", async ()=>{
          window.__agendaMode = "day";
          $("ag_data").value = todayISO();
          await saveDraftForTab("agenda");
          await buildPreview();
        });

        $("btnAgSemana").addEventListener("click", async ()=>{
          window.__agendaMode = "week";
          await saveDraftForTab("agenda");
          await buildPreview();
        });
      }
    },

    prontuario: {
      title: "Prontuário",
      sub: "Registro clínico por paciente (salva tudo).",
      renderForm: async () => {
        const pacientes = await BTXDB.listPacientes();
        const opts = pacientes
          .sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))
          .map(p=> `<option value="${esc(p.id)}">${esc(p.nome)}${p.tel?(" • "+esc(p.tel)):""}</option>`)
          .join("");

        return `
          <div class="doc-title">Selecionar ou cadastrar paciente</div>

          <label>Buscar rápido (nome/telefone)</label>
          <input id="p_busca" placeholder="Digite para filtrar..." />

          <label>Paciente</label>
          <select id="p_select">
            <option value="">— selecione —</option>
            ${opts}
          </select>

          <div class="doc-title">Cadastrar novo</div>

          <label>Nome</label>
          <input id="p_nome" placeholder="Nome do paciente" />

          <div class="row">
            <div>
              <label>Telefone</label>
              <input id="p_tel" />
            </div>
            <div>
              <label>Nascimento</label>
              <input id="p_nasc" type="date" />
            </div>
          </div>

          <label>Endereço</label>
          <input id="p_end" />

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnPCriar">Salvar paciente</button>
            <button class="btn btn-ghost" type="button" id="btnPVer">Ver histórico</button>
          </div>

          <hr class="sep" />

          <div class="doc-title">Registrar atendimento (no paciente selecionado)</div>

          <div class="row">
            <div>
              <label>Data</label>
              <input id="at_data" type="date" value="${todayISO()}" />
            </div>
            <div>
              <label>Tipo</label>
              <select id="at_tipo">
                <option value="consulta">consulta</option>
                <option value="retorno">retorno</option>
                <option value="procedimento">procedimento</option>
                <option value="avaliacao">avaliação</option>
                <option value="urgencia">urgência</option>
              </select>
            </div>
          </div>

          <label>Descrição do que foi feito</label>
          <textarea id="at_desc" placeholder="Ex.: anamnese, exame, procedimento realizado..."></textarea>

          <label>Conduta / orientações</label>
          <textarea id="at_cond" placeholder="Ex.: medicação, retorno, cuidados, encaminhamentos..."></textarea>

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnATSalvar">Salvar atendimento</button>
            <button class="btn btn-ghost" type="button" id="btnATSemana">Ver semana</button>
          </div>
        `;
      },
      build: async () => {
        const pacienteId = $("p_select")?.value || "";
        if(!pacienteId){
          return `<p class="doc-line">Selecione um paciente para ver o histórico.</p>`;
        }
        return await atendimentosTableHTML(pacienteId);
      },
      afterRender: async () => {
        const refreshSelect = async (keepId="")=>{
          const pacientes = await BTXDB.listPacientes();
          const sel = $("p_select");
          const old = keepId || sel.value;
          sel.innerHTML = `<option value="">— selecione —</option>` +
            pacientes.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))
              .map(p=> `<option value="${esc(p.id)}">${esc(p.nome)}${p.tel?(" • "+esc(p.tel)):""}</option>`).join("");
          sel.value = old;
        };

        $("btnPCriar").addEventListener("click", async ()=>{
          const nome = ($("p_nome").value||"").trim();
          if(!nome){ toast("Digite o nome do paciente ❌"); return; }
          const p = await BTXDB.upsertPaciente({
            nome,
            tel: ($("p_tel").value||"").trim(),
            nasc: $("p_nasc").value || "",
            end: ($("p_end").value||"").trim(),
          });
          toast("Paciente salvo ✅");
          await refreshSelect(p.id);
          $("p_nome").value = ""; $("p_tel").value=""; $("p_nasc").value=""; $("p_end").value="";
          await saveDraftForTab("prontuario");
          await buildPreview();
        });

        $("btnPVer").addEventListener("click", async ()=>{
          await saveDraftForTab("prontuario");
          await buildPreview();
        });

        $("btnATSalvar").addEventListener("click", async ()=>{
          const pacienteId = $("p_select").value;
          if(!pacienteId){ toast("Selecione um paciente ❌"); return; }
          const data = $("at_data").value || todayISO();
          const tipo = $("at_tipo").value || "consulta";
          const desc = ($("at_desc").value||"").trim();
          const cond = ($("at_cond").value||"").trim();
          if(!desc){ toast("Descreva o atendimento ❌"); return; }

          await BTXDB.addAtendimento({
            pacienteId,
            data,
            tipo,
            descricao: desc,
            conduta: cond
          });

          $("at_desc").value = "";
          $("at_cond").value = "";
          toast("Atendimento salvo ✅");
          await saveDraftForTab("prontuario");
          await buildPreview();
        });

        $("btnATSemana").addEventListener("click", async ()=>{
          const pacienteId = $("p_select").value;
          if(!pacienteId){ toast("Selecione um paciente ❌"); return; }

          const iso = $("at_data").value || todayISO();
          const ws = weekStartISO(iso);
          const we = addDaysISO(ws, 6);

          const p = await BTXDB.getPaciente(pacienteId);
          const list = await BTXDB.listAtendimentosByPaciente(pacienteId);
          const weekItems = list
            .filter(it => (it.data >= ws && it.data <= we))
            .sort((a,b)=>(a.data||"").localeCompare(b.data||""));

          const rows = weekItems.map(it=>`
            <tr>
              <td>${esc(fmtBRFromISO(it.data||""))}</td>
              <td>${esc(it.tipo||"")}</td>
              <td>${esc(it.descricao||"")}</td>
              <td>${esc(it.conduta||"")}</td>
            </tr>
          `).join("");

          $("pvBody").innerHTML = `
            <div class="doc-title">Semana de atendimentos</div>
            ${line("Paciente", p?.nome || "")}
            ${line("Período", `${fmtBRFromISO(ws)} a ${fmtBRFromISO(we)}`)}
            ${rows ? `
              <table>
                <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Conduta</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            ` : `<p class="doc-line">Nenhum atendimento nesta semana.</p>`}
          `;
          toast("Semana carregada ✅");
          await saveDraftForTab("prontuario");
          // mantém assinatura/footer atual
        });

        // busca rápida
        $("p_busca").addEventListener("input", async ()=>{
          const q = $("p_busca").value;
          const found = q ? await BTXDB.searchPacientes(q) : await BTXDB.listPacientes();
          const sel = $("p_select");
          const old = sel.value;
          sel.innerHTML = `<option value="">— selecione —</option>` +
            found.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))
              .map(p=> `<option value="${esc(p.id)}">${esc(p.nome)}${p.tel?(" • "+esc(p.tel)):""}</option>`).join("");
          sel.value = old;
        });

        $("p_select").addEventListener("change", async ()=>{
          await saveDraftForTab("prontuario");
          await buildPreview();
        });
      }
    },

    ficha: {
      title: "Ficha clínica",
      sub: "Identificação, anamnese e planejamento.",
      renderForm: async () => `
        <label>Nome do paciente</label>
        <input id="f_paciente" required />

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
      build: async () => {
        return [
          line("Paciente", $("f_paciente")?.value?.trim()),
          line("Nascimento", fmtBRFromISO($("f_nasc")?.value)),
          line("Telefone", $("f_tel")?.value?.trim()),
          line("Endereço", $("f_end")?.value?.trim()),
          block("Motivo da consulta", $("f_motivo")?.value),
          block("Anamnese", $("f_anamnese")?.value),
          block("Planejamento", $("f_plan")?.value),
          block("Procedimentos realizados hoje", $("f_proc")?.value),
        ].join("");
      }
    },

    receita: {
      title: "Receituário",
      sub: "Somente o essencial no PDF. Botões 1-clique + campo editável.",
      renderForm: async () => `
        <label>Paciente</label>
        <input id="r_paciente" required />

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="r_cidade" placeholder="Ex.: Belém" />
          </div>
          <div>
            <label>Data</label>
            <input id="r_data" type="date" value="${todayISO()}" />
          </div>
        </div>

        <div class="doc-title">Medicações rápidas (1 clique)</div>

        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="dipirona">dipirona</button>
          <button class="btn btn-ghost" type="button" data-rx="paracetamol">paracetamol</button>

          <button class="btn btn-ghost" type="button" data-rx="ibuprofeno">ibuprofeno</button>
          <button class="btn btn-ghost" type="button" data-rx="nimesulida">nimesulida</button>
          <button class="btn btn-ghost" type="button" data-rx="diclofenaco">diclofenaco</button>

          <button class="btn btn-ghost" type="button" data-rx="amoxicilina">amoxicilina</button>
          <button class="btn btn-ghost" type="button" data-rx="azitromicina">azitromicina</button>
          <button class="btn btn-ghost" type="button" data-rx="amoxclav">amox+clav</button>

          <button class="btn btn-ghost" type="button" data-rx="losartana">losartana</button>
          <button class="btn btn-ghost" type="button" data-rx="enalapril">enalapril</button>
          <button class="btn btn-ghost" type="button" data-rx="amlodipino">amlodipino</button>
          <button class="btn btn-ghost" type="button" data-rx="hctz">HCTZ</button>

          <button class="btn btn-ghost" type="button" data-rx="metformina">metformina</button>
          <button class="btn btn-ghost" type="button" data-rx="glibenclamida">glibenclamida</button>
          <button class="btn btn-ghost" type="button" data-rx="gliclazida">gliclazida</button>

          <button class="btn btn-ghost" type="button" data-rx="fluconazol">fluconazol</button>
          <button class="btn btn-ghost" type="button" data-rx="cetoconazol_creme">cetoconazol creme</button>
          <button class="btn btn-ghost" type="button" data-rx="miconazol_creme">miconazol creme</button>
          <button class="btn btn-ghost" type="button" data-rx="terbinafina_creme">terbinafina creme</button>
          <button class="btn btn-ghost" type="button" data-rx="shampoo_cetoconazol">shampoo cetoconazol</button>
        </div>

        <p class="small">Clique para inserir no campo de prescrição. O PDF só imprime o que estiver no campo abaixo.</p>

        <label>Prescrição (editável)</label>
        <textarea id="r_corpo" placeholder="As medicações escolhidas aparecem aqui..."></textarea>

        <label>Orientações adicionais (opcional)</label>
        <textarea id="r_orient" placeholder="Ex.: repouso, retorno, cuidados..."></textarea>
      `,
      build: async () => {
        const paciente = ($("r_paciente").value||"").trim();
        const cidade = ($("r_cidade").value||"").trim() || "Cidade";
        const dataIso = $("r_data").value || todayISO();
        const dataBR = fmtBRFromISO(dataIso);
        const corpo = ($("r_corpo").value||"").trim();
        const orient = ($("r_orient").value||"").trim();

        return [
          line("Paciente", paciente),
          `<div class="doc-title">Prescrição</div>`,
          corpo ? `<div class="doc-block">${esc(corpo)}</div>` : `<p class="doc-line">—</p>`,
          orient ? block("Orientações", orient) : "",
          `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>`
        ].join("");
      },
      afterRender: async () => {
        // bind preset buttons
        $("formPanel").querySelectorAll("[data-rx]").forEach(btn=>{
          btn.addEventListener("click", ()=>appendRxPreset(btn.dataset.rx));
        });
      }
    },

    recibo: {
      title: "Recibo",
      sub: "Comprovação de pagamento / prestação de serviço.",
      renderForm: async () => `
        <label>Nome do pagador (paciente)</label>
        <input id="rc_pagador" required />

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
        <input id="rc_ref" placeholder="Ex.: Consulta / Procedimento / Sessão..." />

        <label>Observações (opcional)</label>
        <textarea id="rc_obs" placeholder="Ex.: serviço prestado, condições..."></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rc_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="rc_data" type="date" value="${todayISO()}" />
          </div>
        </div>
      `,
      build: async () => {
        const pagador = ($("rc_pagador").value||"").trim();
        const valor = ($("rc_valor").value||"").trim();
        const ref = ($("rc_ref").value||"").trim();
        const forma = ($("rc_forma").value||"").trim();
        const cidade = ($("rc_cidade").value||"").trim() || "Cidade";
        const dataBR = fmtBRFromISO($("rc_data").value || todayISO());

        const valorFmt = valor ? Number(valor).toFixed(2) : "";

        return [
          `<div class="doc-title">Recibo</div>`,
          `<p class="doc-line">Recebi de <strong>${esc(pagador)}</strong> a quantia de <strong>R$ ${esc(valorFmt || "0,00")}</strong>.</p>`,
          ref ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(ref)}</p>` : "",
          forma ? `<p class="doc-line"><strong>Forma de pagamento:</strong> ${esc(forma)}</p>` : "",
          block("Observações", $("rc_obs").value),
          `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>`
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
          <input id="o_paciente" required />

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
              <input id="o_data" type="date" value="${todayISO()}" />
            </div>
          </div>
        `;
      },
      build: async () => {
        const paciente = ($("o_paciente").value||"").trim();
        const cidade = ($("o_cidade").value||"").trim() || "Cidade";
        const dataBR = fmtBRFromISO($("o_data").value || todayISO());

        const itens = [];
        for (let i=1;i<=10;i++){
          const d = ($(`o_d${i}`)?.value||"").trim();
          const rawV = ($(`o_v${i}`)?.value||"").trim();
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
          line("Paciente", paciente),
          table,
          block("Observações", $("o_obs").value),
          `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>`
        ].join("");
      }
    },

    laudo: {
      title: "Laudo",
      sub: "Relatório estruturado com conclusão.",
      renderForm: async () => `
        <label>Paciente</label>
        <input id="l_paciente" required />

        <label>Título</label>
        <input id="l_titulo" placeholder="Ex.: Laudo clínico / radiográfico..." />

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
            <input id="l_data" type="date" value="${todayISO()}" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = ($("l_paciente").value||"").trim();
        const cidade = ($("l_cidade").value||"").trim() || "Cidade";
        const dataBR = fmtBRFromISO($("l_data").value || todayISO());
        return [
          line("Paciente", paciente),
          line("Título", $("l_titulo").value),
          block("Descrição detalhada", $("l_desc").value),
          block("Conclusão / Impressão diagnóstica", $("l_conc").value),
          `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>`
        ].join("");
      }
    },

    atestado: {
      title: "Atestado",
      sub: "Justificativa e dias de afastamento (opcional).",
      renderForm: async () => `
        <label>Paciente</label>
        <input id="a_paciente" required />

        <label>Dias de afastamento (opcional)</label>
        <input id="a_dias" type="number" min="0" step="1" placeholder="Ex.: 2" />

        <label>Texto do atestado</label>
        <textarea id="a_desc" placeholder="Ex.: Atesto para fins..."></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="a_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="a_data" type="date" value="${todayISO()}" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = ($("a_paciente").value||"").trim();
        const cidade = ($("a_cidade").value||"").trim() || "Cidade";
        const dataBR = fmtBRFromISO($("a_data").value || todayISO());
        const diasRaw = ($("a_dias").value||"").trim();
        const dias = diasRaw ? Number(diasRaw) : null;

        return [
          line("Paciente", paciente),
          (dias && !Number.isNaN(dias) && dias > 0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : "",
          block("Atestado", $("a_desc").value),
          `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>`
        ].join("");
      }
    }
  };

  let currentTab = "agenda";

  async function renderTab(tab){
    currentTab = tab;

    document.querySelectorAll(".tabbtn").forEach(b=>{
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    $("docTitle").textContent = TABS[tab].title;
    $("docSub").textContent = TABS[tab].sub;

    const formHTML = await TABS[tab].renderForm();
    $("formPanel").innerHTML = formHTML;

    // apply draft
    const draft = await loadDraftForTab(tab);
    await applyDraftToForm(draft);

    // listeners
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      el.addEventListener("input", async ()=>{
        await saveDraftForTab(tab);
        await buildPreview();
      });
      el.addEventListener("change", async ()=>{
        await saveDraftForTab(tab);
        await buildPreview();
      });
    });

    if (typeof TABS[tab].afterRender === "function") await TABS[tab].afterRender();

    await buildPreview();
  }

  async function buildPreview(){
    const prof = await BTXDB.getProfissional();
    const lines = profLines(prof);

    $("profResumo").textContent = (lines.length ? `${lines[0]}${lines[1] ? " — " + lines[1] : ""}` : "—");

    // Header right: address + datetime
    const end = prof?.end || "";
    $("pvAddr").textContent = end || "Endereço não informado";
    $("pvDateTime").textContent = nowBR();

    // Prof block (abaixo do título)
    const conselhoReg = (prof?.conselho || prof?.reg) ? `${prof.conselho || ""} ${prof.reg || ""}`.trim() : "";
    const profBlock = `
      <div class="line strong">${esc(prof?.nome || "—")}</div>
      <div class="line">${esc(prof?.esp || "")}</div>
      <div class="line">${esc(conselhoReg || "")}</div>
      <div class="line">${esc(prof?.tel || "")}${prof?.email ? (" • "+esc(prof.email)) : ""}</div>
    `;
    $("pvProfBlock").innerHTML = prof?.nome ? profBlock : `<div class="line">Preencha o profissional para assinatura e rodapé.</div>`;

    // Title/sub
    $("pvTitle").textContent = TABS[currentTab].title;
    $("pvSub").textContent = TABS[currentTab].sub;

    // Body
    $("pvBody").innerHTML = await TABS[currentTab].build();

    // Footer: endereço + contato (o que você pediu)
    const footer = prof?.nome ? `
      <div><b>${esc(prof.nome)}</b>${prof.esp?(" • "+esc(prof.esp)):""}</div>
      <div>${esc((prof.end||"").trim())}</div>
      <div>${esc((prof.tel||"").trim())}${prof.email?(" • "+esc(prof.email)):""}</div>
    ` : `Preencha os dados do profissional para completar o rodapé.`;
    $("pvFooter").innerHTML = footer;

    // Signatures
    if (prof?.nome){
      $("pvSign").innerHTML = `
        <div class="sigrow">
          <div class="sig">
            <div class="line"></div>
            <div><b>${esc(prof.nome)}</b></div>
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
      $("pvSign").innerHTML = `<div class="small" style="color:#334155;">(Preencha o profissional para assinatura.)</div>`;
    }
  }

  /* =========================
     Buttons (UI)
     ========================= */
  $("btnSalvarProf").addEventListener("click", async ()=>{
    const p = readProfFromUI();
    if (!p.nome){
      toast("Digite pelo menos o nome do profissional ❌");
      return;
    }
    await BTXDB.saveProfissional(p);
    toast("Profissional salvo ✅");
    await buildPreview();
  });

  $("btnLimparProf").addEventListener("click", async ()=>{
    await BTXDB.clearProfissional();
    setProfToUI(null);
    toast("Profissional limpo ✅");
    await buildPreview();
  });

  $("btnLimparForm").addEventListener("click", async ()=>{
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      el.value = "";
    });
    // padrão de datas
    $("formPanel").querySelectorAll('input[type="date"]').forEach(el=> el.value = todayISO());
    toast("Formulário limpo ✅");
    await saveDraftForTab(currentTab);
    await buildPreview();
  });

  $("btnPrint").addEventListener("click", async ()=>{
    await buildPreview();
    window.print();
  });

  $("btnDownload").addEventListener("click", async ()=>{
    await buildPreview();
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BTX Docs — Export</title>
      <style>body{font-family:Arial,sans-serif;background:#fff;margin:0;padding:14px;} .paper{max-width:900px;margin:0 auto}</style>
      </head><body>${$("paper").outerHTML}</body></html>`;
    const name = `BTX_${currentTab}_${Date.now()}.html`;
    downloadText(name, html, "text/html;charset=utf-8");
    toast("Baixado ✅");
  });

  $("btnExportAll").addEventListener("click", async ()=>{
    const data = await BTXDB.exportAll();
    downloadText(`BTX_Backup_${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
    toast("Backup baixado ✅");
  });

  $("btnResetAll").addEventListener("click", async ()=>{
    if(!confirm("Tem certeza? Isso apaga TODOS os dados do aparelho (profissional, pacientes, agenda, prontuário).")) return;
    await BTXDB.nukeAll();
    toast("Tudo zerado ✅");
    location.reload();
  });

  $("btnChangeKey").addEventListener("click", async ()=>{
    const cur = prompt("Digite a chave atual:");
    if(!cur) return;
    const saved = (await getSavedKey()).toLowerCase();
    if(cur.trim().toLowerCase() !== saved){
      toast("Chave incorreta ❌");
      return;
    }
    const nova = prompt("Nova chave (minúsculo):", saved);
    if(!nova) return;
    await setSavedKey(nova.trim().toLowerCase());
    await setUnlocked(false);
    toast("Chave alterada ✅ Faça login de novo.");
    await showLogin(true);
  });

  $("btnForceUpdate").addEventListener("click", async ()=>{
    // força reload (e ajuda com cache)
    toast("Atualizando…");
    location.href = location.pathname + "?v=" + Date.now();
  });

  /* Tabs init */
  document.querySelectorAll(".tabbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
  });

  /* Net pill */
  function updateNet(){
    $("netPill").textContent = navigator.onLine ? "Online" : "Offline";
  }
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);

  /* Init app */
  async function init(){
    updateNet();

    const prof = await BTXDB.getProfissional();
    setProfToUI(prof);

    // defaults for key
    const savedKey = await BTXDB.getSetting("login_key", null);
    if(!savedKey) await setSavedKey(DEFAULT_KEY);

    await showLogin(false);

    await renderTab("agenda");
  }

  init();
})();
