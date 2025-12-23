/* BTX Docs Saúde — App principal (offline + memória forte + documentos) */
(() => {
  const $ = (id) => document.getElementById(id);

  const APP_VER = "1.0.0";
  const DEFAULT_KEY = "btx007";
  const LS_AUTH = "btx_auth_ok";

  const toast = (msg) => {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  const esc = (str) => String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");

  const isoToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const fmtBR = (iso) => {
    if(!iso) return "";
    const [y,m,d] = iso.split("-");
    if(!y||!m||!d) return iso;
    return `${d}/${m}/${y}`;
  };

  const nowBR = () => {
    const d = new Date();
    const date = d.toLocaleDateString("pt-BR");
    const time = d.toLocaleTimeString("pt-BR").slice(0,5);
    return `${date} • ${time}`;
  };

  const formVal = (id) => {
    const el = $(id);
    return el ? (el.value ?? "").trim() : "";
  };

  function setDocMeta(prof){
    $("pvMeta").textContent = nowBR();

    // Cabeçalho: "DOCUMENTOS CLÍNICOS • endereço"
    const endereco = (prof?.end || "").trim();
    $("docBrandSub").textContent = endereco
      ? `DOCUMENTOS CLÍNICOS • ${endereco}`
      : `DOCUMENTOS CLÍNICOS • (adicione o endereço do profissional)`;

    const resumo = prof?.nome ? `${prof.nome}${prof.esp ? " — " + prof.esp : ""}` : "—";
    $("profResumo").textContent = resumo;
  }

  async function getProf(){
    const r = await BTX_DB.get(BTX_DB.STORES.profissional, "prof");
    return r?.data || null;
  }

  async function setProf(data){
    await BTX_DB.put(BTX_DB.STORES.profissional, { key:"prof", data });
  }

  function profFromUI(){
    return {
      nome: formVal("profNome"),
      esp: formVal("profEsp"),
      conselho: formVal("profConselho"),
      reg: formVal("profReg"),
      end: formVal("profEnd"),
      tel: formVal("profTel"),
      email: formVal("profEmail"),
    };
  }

  function profToUI(p){
    $("profNome").value = p?.nome || "";
    $("profEsp").value = p?.esp || "";
    $("profConselho").value = p?.conselho || "";
    $("profReg").value = p?.reg || "";
    $("profEnd").value = p?.end || "";
    $("profTel").value = p?.tel || "";
    $("profEmail").value = p?.email || "";
  }

  function footerHTML(prof){
    const nome = prof?.nome || "";
    const esp  = prof?.esp || "";
    const cr   = [prof?.conselho, prof?.reg].filter(Boolean).join(" ").trim();
    const end  = prof?.end || "";
    const tel  = prof?.tel || "";
    const email= prof?.email || "";

    const left = `
      <div class="footer-col">
        <div><b>${esc(nome || "Profissional")}</b>${esp ? ` — ${esc(esp)}` : ""}</div>
        ${cr ? `<div>${esc(cr)}</div>` : ""}
        ${end ? `<div>${esc(end)}</div>` : ""}
        ${(tel || email) ? `<div>${esc(tel)}${tel && email ? " • " : ""}${esc(email)}</div>` : ""}
      </div>
    `;

    const right = `
      <div class="footer-col" style="text-align:right;">
        <div class="sigline"></div>
        <div><b>Assinatura do(a) profissional</b></div>
      </div>
      <div class="footer-col" style="text-align:right;">
        <div class="sigline"></div>
        <div><b>Assinatura do(a) paciente / responsável</b></div>
      </div>
    `;

    return `<div class="footer-row">${left}${right}</div>`;
  }

  /* =========================
     LOGIN (chave simples)
     ========================= */
  function lock(){
    $("loginModal").style.display = "flex";
  }
  function unlock(){
    $("loginModal").style.display = "none";
  }
  function setupLogin(){
    const input = $("loginKey");
    const btn = $("btnLogin");
    const btnForgot = $("btnForgotKey");

    const ok = localStorage.getItem(LS_AUTH) === "1";
    if (ok) unlock(); else lock();

    const tryLogin = () => {
      const typed = (input.value || "").trim().toLowerCase();
      if (typed === DEFAULT_KEY){
        localStorage.setItem(LS_AUTH, "1");
        unlock();
        toast("Acesso liberado ✅");
      } else {
        alert("Chave incorreta. Use: btx007");
        input.focus();
        input.select();
      }
    };

    btn.addEventListener("click", (e) => { e.preventDefault(); tryLogin(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){ e.preventDefault(); tryLogin(); }
    });

    btnForgot.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem(LS_AUTH);
      input.value = "";
      lock();
      toast("Chave resetada (padrão: btx007) ✅");
    });

    // preenche default
    input.value = DEFAULT_KEY;
  }

  /* =========================
     PACIENTES (cadastro leve)
     ========================= */
  async function listPacientes(){
    const all = await BTX_DB.getAll(BTX_DB.STORES.pacientes);
    all.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
    return all;
  }

  async function upsertPaciente({id, nome, tel, nasc, end, obs}){
    const pid = id || BTX_DB.uid("pac");
    const obj = { id: pid, nome:nome||"", tel:tel||"", nasc:nasc||"", end:end||"", obs:obs||"", updatedAt: Date.now() };
    await BTX_DB.put(BTX_DB.STORES.pacientes, obj);
    return pid;
  }

  /* =========================
     AGENDA (dia/semana)
     ========================= */
  function startOfWeekISO(iso){
    const [y,m,d] = iso.split("-").map(Number);
    const dt = new Date(y, m-1, d, 12, 0, 0);
    const day = dt.getDay(); // 0 dom ... 6 sab
    const diff = (day === 0 ? -6 : 1 - day); // segunda como início
    dt.setDate(dt.getDate() + diff);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function addDaysISO(iso, add){
    const [y,m,d] = iso.split("-").map(Number);
    const dt = new Date(y, m-1, d, 12, 0, 0);
    dt.setDate(dt.getDate() + add);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  async function addAgendaItem(item){
    const id = BTX_DB.uid("ag");
    const obj = { id, ...item, createdAt: Date.now() };
    await BTX_DB.put(BTX_DB.STORES.agenda, obj);
    return id;
  }

  async function getAgendaByDate(iso){
    const all = await BTX_DB.getAll(BTX_DB.STORES.agenda);
    return all.filter(a => a.data === iso).sort((a,b)=> (a.hora||"").localeCompare(b.hora||""));
  }

  async function getAgendaWeek(iso){
    const start = startOfWeekISO(iso);
    const days = Array.from({length:7}, (_,i)=> addDaysISO(start, i));
    const all = await BTX_DB.getAll(BTX_DB.STORES.agenda);
    const filtered = all.filter(a => days.includes(a.data));
    filtered.sort((a,b)=> (a.data+" "+(a.hora||"")).localeCompare(b.data+" "+(b.hora||"")));
    return { start, days, items: filtered };
  }

  /* =========================
     PRONTUÁRIO (registros)
     ========================= */
  async function addProntuarioRegistro({pacienteId, data, procedimento, anotacoes}){
    const id = BTX_DB.uid("pr");
    const obj = { id, pacienteId, data, procedimento: procedimento||"", anotacoes: anotacoes||"", createdAt: Date.now() };
    await BTX_DB.put(BTX_DB.STORES.prontuario, obj);
    return id;
  }

  async function getProntuarioByPaciente(pacienteId){
    const all = await BTX_DB.getAll(BTX_DB.STORES.prontuario);
    return all.filter(r => r.pacienteId === pacienteId)
      .sort((a,b)=> (a.data||"").localeCompare(b.data||""));
  }

  /* =========================
     RECEITUÁRIO (presets)
     ========================= */
  // Presets pensados para “1 clique” e você editar. Sem texto marketing no PDF.
  const RX = {
    // Analgésicos
    dipirona: { titulo:"Dipirona 500mg", qtd:"08 comprimidos", texto:"Tomar 01 comprimido a cada 6–8 horas, se dor ou febre, por até 3 dias." },
    paracetamol:{ titulo:"Paracetamol 750mg", qtd:"09 comprimidos", texto:"Tomar 01 comprimido a cada 8 horas, se dor ou febre, por até 3 dias." },

    // Anti-inflamatórios
    ibuprofeno:{ titulo:"Ibuprofeno 400mg", qtd:"09 comprimidos", texto:"Tomar 01 comprimido a cada 8 horas, após alimentação, por 3 dias." },
    nimesulida:{ titulo:"Nimesulida 100mg", qtd:"06 comprimidos", texto:"Tomar 01 comprimido a cada 12 horas, após alimentação, por 3 dias." },
    diclofenaco:{ titulo:"Diclofenaco potássico 50mg", qtd:"09 comprimidos", texto:"Tomar 01 comprimido a cada 8–12 horas, após alimentação, por 3 dias." },

    // Antibióticos
    amoxicilina:{ titulo:"Amoxicilina 500mg", qtd:"21 cápsulas", texto:"Tomar 01 cápsula a cada 8 horas por 7 dias." },
    azitromicina:{ titulo:"Azitromicina 500mg", qtd:"03 comprimidos", texto:"Tomar 01 comprimido ao dia por 3 dias." },
    amoxclav:{ titulo:"Amoxicilina 875mg + Clavulanato 125mg", qtd:"14 comprimidos", texto:"Tomar 01 comprimido a cada 12 horas por 7 dias." },

    // Hipertensão
    losartana:{ titulo:"Losartana 50mg", qtd:"30 comprimidos", texto:"Tomar 01 comprimido ao dia (conforme prescrição)." },
    enalapril:{ titulo:"Enalapril 10mg", qtd:"30 comprimidos", texto:"Tomar 01 comprimido ao dia (conforme prescrição)." },
    amlodipino:{ titulo:"Amlodipino 5mg", qtd:"30 comprimidos", texto:"Tomar 01 comprimido ao dia (conforme prescrição)." },
    hctz:{ titulo:"Hidroclorotiazida 25mg (HCTZ)", qtd:"30 comprimidos", texto:"Tomar 01 comprimido ao dia (conforme prescrição)." },

    // Diabetes
    metformina:{ titulo:"Metformina 500mg", qtd:"60 comprimidos", texto:"Tomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição)." },
    glibenclamida:{ titulo:"Glibenclamida 5mg", qtd:"30 comprimidos", texto:"Tomar 01 comprimido ao dia (conforme prescrição)." },
    gliclazida:{ titulo:"Gliclazida 30mg (liberação modificada)", qtd:"30 comprimidos", texto:"Tomar 01 comprimido ao dia (conforme prescrição)." },

    // Antifúngicos / Dermatológicos
    fluconazol:{ titulo:"Fluconazol 150mg", qtd:"01 cápsula", texto:"Tomar 01 cápsula dose única (ou conforme prescrição)." },
    cetoconazol_creme:{ titulo:"Cetoconazol creme 2%", qtd:"01 bisnaga", texto:"Aplicar fina camada 2x ao dia por 7–14 dias (conforme orientação)." },
    miconazol_creme:{ titulo:"Miconazol creme 2%", qtd:"01 bisnaga", texto:"Aplicar fina camada 2x ao dia por 7–14 dias (conforme orientação)." },
    terbinafina_creme:{ titulo:"Terbinafina creme 1%", qtd:"01 bisnaga", texto:"Aplicar fina camada 1–2x ao dia por 7–14 dias (conforme orientação)." },
    shampoo_cetoconazol:{ titulo:"Shampoo cetoconazol 2%", qtd:"01 frasco", texto:"Aplicar, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas." },
  };

  function rxLine(key){
    const it = RX[key];
    if(!it) return "";
    return `${it.titulo}    ${it.qtd}\n${it.texto}`;
  }

  /* =========================
     TABS & UI
     ========================= */
  let currentTab = "agenda";
  let lastBuiltHTML = ""; // pra baixar html do preview

  function setTabActive(tab){
    document.querySelectorAll(".tabbtn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    currentTab = tab;
  }

  function bindLivePreviewInputs(panel){
    panel.querySelectorAll("input,textarea,select").forEach(el=>{
      el.addEventListener("input", buildPreview);
      el.addEventListener("change", buildPreview);
    });
  }

  function docLine(label, value){
    if(!value) return "";
    return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
  }

  function docBlock(title, value){
    if(!value) return "";
    return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
  }

  async function renderTab(tab){
    setTabActive(tab);

    const map = TABS[tab];
    $("docTitle").textContent = map.title;
    $("docSub").textContent = map.sub;

    const panel = $("formPanel");
    panel.innerHTML = await map.renderForm();
    bindLivePreviewInputs(panel);
    if (map.afterRender) await map.afterRender();
    await buildPreview();
  }

  async function buildPreview(){
    const prof = await getProf();
    setDocMeta(prof);

    $("pvTitle").textContent = TABS[currentTab].title;
    $("pvSub").textContent = TABS[currentTab].sub;

    const body = await TABS[currentTab].build();
    $("pvBody").innerHTML = body;
    $("pvFooter").innerHTML = footerHTML(prof);

    lastBuiltHTML = $("paper").outerHTML;
  }

  /* =========================
     TABS IMPLEMENTAÇÃO
     ========================= */
  const TABS = {

    agenda: {
      title: "Agenda",
      sub: "Dia e Semana, offline, com memória forte.",
      renderForm: async () => {
        const pacientes = await listPacientes();
        const opts = pacientes.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}${p.tel ? " • "+esc(p.tel) : ""}</option>`).join("");

        return `
          <label>Data</label>
          <input id="ag_data" type="date" value="${isoToday()}" />

          <div class="row">
            <div>
              <label>Hora</label>
              <input id="ag_hora" type="time" />
            </div>
            <div>
              <label>Busca rápida (nome ou telefone)</label>
              <input id="ag_busca" placeholder="Digite para filtrar…" />
            </div>
          </div>

          <label>Selecionar paciente (opcional)</label>
          <select id="ag_pacienteId">
            <option value="">— digite acima ou cadastre —</option>
            ${opts}
          </select>

          <div class="row">
            <div>
              <label>Nome do paciente (se não selecionar)</label>
              <input id="ag_pacienteNome" placeholder="Nome do paciente" />
            </div>
            <div>
              <label>Telefone (opcional)</label>
              <input id="ag_pacienteTel" placeholder="(00) 00000-0000" />
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

          <div class="actions" style="justify-content:flex-start;">
            <button class="btn btn-primary" id="btnAgSalvar" type="button">Salvar</button>
            <button class="btn btn-ghost" id="btnAgHoje" type="button">Hoje</button>
            <button class="btn btn-ghost" id="btnAgSemana" type="button">Semana</button>
          </div>

          <hr class="hr" />

          <h2 style="margin-top:0;">Cadastro rápido do paciente</h2>
          <div class="row">
            <div>
              <label>Nome</label>
              <input id="pac_nome" />
            </div>
            <div>
              <label>Telefone</label>
              <input id="pac_tel" />
            </div>
          </div>
          <div class="row">
            <div>
              <label>Nascimento</label>
              <input id="pac_nasc" type="date" />
            </div>
            <div>
              <label>Endereço</label>
              <input id="pac_end" />
            </div>
          </div>
          <label>Observações</label>
          <textarea id="pac_obs"></textarea>

          <div class="actions" style="justify-content:flex-start;">
            <button class="btn btn-ghost" id="btnPacCadastrar" type="button">Cadastrar / Atualizar</button>
          </div>

          <p class="small">Dica: use “Semana” para imprimir a agenda semanal em PDF.</p>
        `;
      },
      afterRender: async () => {
        const pacientes = await listPacientes();

        const select = $("ag_pacienteId");
        const busca = $("ag_busca");

        const filterSelect = () => {
          const q = (busca.value||"").trim().toLowerCase();
          const options = pacientes.filter(p => {
            const a = (p.nome||"").toLowerCase();
            const b = (p.tel||"").toLowerCase();
            return !q || a.includes(q) || b.includes(q);
          }).map(p => `<option value="${esc(p.id)}">${esc(p.nome)}${p.tel ? " • "+esc(p.tel) : ""}</option>`).join("");

          select.innerHTML = `<option value="">— digite acima ou cadastre —</option>${options}`;
        };

        busca.addEventListener("input", filterSelect);

        $("btnPacCadastrar").addEventListener("click", async () => {
          const nome = formVal("pac_nome");
          if(!nome) return alert("Digite o nome do paciente.");
          const tel = formVal("pac_tel");
          const nasc = formVal("pac_nasc");
          const end = formVal("pac_end");
          const obs = formVal("pac_obs");

          const id = await upsertPaciente({ nome, tel, nasc, end, obs });
          toast("Paciente salvo ✅");

          // repõe campos e seleciona
          $("ag_busca").value = nome;
          $("ag_pacienteNome").value = "";
          $("ag_pacienteTel").value = "";
          await renderTab("agenda");
          // tentar selecionar recém criado
          const sel = $("ag_pacienteId");
          sel.value = id;
          await buildPreview();
        });

        $("btnAgSalvar").addEventListener("click", async () => {
          const data = formVal("ag_data") || isoToday();
          const hora = formVal("ag_hora");
          const tipo = formVal("ag_tipo") || "consulta";
          const status = formVal("ag_status") || "aguardando";
          const obs = formVal("ag_obs");

          let pacienteId = formVal("ag_pacienteId");
          let pacienteNome = formVal("ag_pacienteNome");
          let pacienteTel = formVal("ag_pacienteTel");

          // Se escolheu paciente do select, puxar nome/tel do cadastro
          if(pacienteId){
            const p = await BTX_DB.get(BTX_DB.STORES.pacientes, pacienteId);
            pacienteNome = p?.nome || pacienteNome;
            pacienteTel = p?.tel || pacienteTel;
          } else {
            // Se não escolheu e digitou nome, salva/atualiza paciente rápido (opcional, mas ajuda)
            if(pacienteNome){
              pacienteId = await upsertPaciente({ nome: pacienteNome, tel: pacienteTel });
            }
          }

          if(!pacienteNome){
            alert("Digite o nome do paciente (ou selecione).");
            return;
          }

          await addAgendaItem({ data, hora, tipo, status, obs, pacienteId: pacienteId||"", pacienteNome, pacienteTel });
          toast("Agendamento salvo ✅");

          $("ag_hora").value = "";
          $("ag_obs").value = "";

          await buildPreview();
        });

        $("btnAgHoje").addEventListener("click", async () => {
          $("ag_data").value = isoToday();
          await buildPreview();
        });

        $("btnAgSemana").addEventListener("click", async () => {
          // marca um modo interno “semana” usando draft
          await BTX_DB.put(BTX_DB.STORES.drafts, { key:"agenda_mode", value:"week" });
          await buildPreview();
        });

        // padrão agenda mode: day
        const m = await BTX_DB.get(BTX_DB.STORES.drafts, "agenda_mode");
        if(!m) await BTX_DB.put(BTX_DB.STORES.drafts, { key:"agenda_mode", value:"day" });
      },
      build: async () => {
        const modeObj = await BTX_DB.get(BTX_DB.STORES.drafts, "agenda_mode");
        const mode = modeObj?.value || "day";

        const date = formVal("ag_data") || isoToday();

        if(mode === "week"){
          const wk = await getAgendaWeek(date);
          const title = `Agenda semanal (início: ${fmtBR(wk.start)})`;

          const rows = wk.items.map(it => `
            <tr>
              <td>${esc(fmtBR(it.data))}</td>
              <td>${esc(it.hora||"")}</td>
              <td>${esc(it.pacienteNome||"")}</td>
              <td>${esc(it.tipo||"")}</td>
              <td>${esc(it.status||"")}</td>
              <td>${esc(it.obs||"")}</td>
            </tr>
          `).join("");

          return `
            <div class="doc-title">${esc(title)}</div>
            ${rows ? `
              <table>
                <thead><tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            ` : `<p class="doc-line">Nenhum agendamento na semana.</p>`}
          `;
        }

        // day
        const list = await getAgendaByDate(date);
        const title = `Agenda do dia — ${fmtBR(date)}`;

        const rows = list.map(it => `
          <tr>
            <td>${esc(it.hora||"")}</td>
            <td>${esc(it.pacienteNome||"")}</td>
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
            </table>
          ` : `<p class="doc-line">Nenhum agendamento.</p>`}
        `;
      }
    },

    prontuario: {
      title: "Prontuário",
      sub: "Registro clínico por paciente (por data).",
      renderForm: async () => {
        const pacientes = await listPacientes();
        const opts = pacientes.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}${p.tel ? " • "+esc(p.tel) : ""}</option>`).join("");

        return `
          <label>Selecionar paciente</label>
          <select id="pr_pacienteId">
            <option value="">— selecione —</option>
            ${opts}
          </select>

          <div class="row">
            <div>
              <label>Data do atendimento</label>
              <input id="pr_data" type="date" value="${isoToday()}" />
            </div>
            <div>
              <label>Procedimento</label>
              <input id="pr_proced" placeholder="Ex.: restauração, extração, retorno..." />
            </div>
          </div>

          <label>Anotações / Evolução</label>
          <textarea id="pr_anot"></textarea>

          <div class="actions" style="justify-content:flex-start;">
            <button class="btn btn-primary" id="btnPrSalvar" type="button">Salvar registro</button>
          </div>

          <p class="small">O prontuário fica salvo e você pode imprimir por paciente.</p>
        `;
      },
      afterRender: async () => {
        $("btnPrSalvar").addEventListener("click", async () => {
          const pacienteId = formVal("pr_pacienteId");
          if(!pacienteId) return alert("Selecione um paciente.");
          const data = formVal("pr_data") || isoToday();
          const procedimento = formVal("pr_proced");
          const anotacoes = formVal("pr_anot");
          if(!procedimento && !anotacoes) return alert("Digite procedimento ou anotações.");

          await addProntuarioRegistro({ pacienteId, data, procedimento, anotacoes });
          toast("Registro salvo ✅");
          $("pr_proced").value = "";
          $("pr_anot").value = "";
          await buildPreview();
        });
      },
      build: async () => {
        const pacienteId = formVal("pr_pacienteId");
        if(!pacienteId) return `<p class="doc-line">Selecione um paciente para visualizar o prontuário.</p>`;

        const p = await BTX_DB.get(BTX_DB.STORES.pacientes, pacienteId);
        const regs = await getProntuarioByPaciente(pacienteId);

        const head = `
          ${docLine("Paciente", p?.nome || "")}
          ${docLine("Telefone", p?.tel || "")}
          ${docLine("Nascimento", p?.nasc ? fmtBR(p.nasc) : "")}
          ${docLine("Endereço", p?.end || "")}
        `;

        const rows = regs.map(r => `
          <tr>
            <td>${esc(fmtBR(r.data))}</td>
            <td>${esc(r.procedimento || "")}</td>
            <td>${esc(r.anotacoes || "")}</td>
          </tr>
        `).join("");

        return `
          <div class="doc-title">Identificação</div>
          ${head || `<p class="doc-line">—</p>`}

          <div class="doc-title">Registros</div>
          ${rows ? `
            <table>
              <thead><tr><th>Data</th><th>Procedimento</th><th>Anotações</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          ` : `<p class="doc-line">Nenhum registro ainda.</p>`}
        `;
      }
    },

    ficha: {
      title: "Ficha clínica",
      sub: "Identificação do paciente, anamnese e planejamento.",
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
      build: async () => {
        const paciente = formVal("f_paciente");
        return [
          docLine("Paciente", paciente),
          docLine("Nascimento", formVal("f_nasc") ? fmtBR(formVal("f_nasc")) : ""),
          docLine("Telefone", formVal("f_tel")),
          docLine("Endereço", formVal("f_end")),
          docBlock("Motivo da consulta", formVal("f_motivo")),
          docBlock("Anamnese", formVal("f_anamnese")),
          docBlock("Planejamento", formVal("f_plan")),
          docBlock("Procedimentos realizados hoje", formVal("f_proc")),
        ].join("");
      }
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
            <input id="r_data" type="date" value="${isoToday()}" />
          </div>
        </div>

        <div class="doc-title">Medicações (1 clique)</div>

        <div class="small">Analgésicos</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="dipirona">dipirona</button>
          <button class="btn btn-ghost" type="button" data-rx="paracetamol">paracetamol</button>
          <div></div>
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
          <div></div><div></div>
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
          <div></div>
        </div>

        <p class="small" style="margin-top:10px;">
          Clique para inserir. Depois revise e edite (você é o responsável pela prescrição).
        </p>

        <label>Prescrição (editável)</label>
        <textarea id="r_corpo" placeholder="As medicações aparecem aqui…"></textarea>

        <label>Orientações adicionais (opcional)</label>
        <textarea id="r_orient" placeholder="Ex.: repouso, retorno, cuidados…"></textarea>
      `,
      afterRender: async () => {
        // botão RX
        $("formPanel").querySelectorAll("[data-rx]").forEach(btn=>{
          btn.addEventListener("click", async () => {
            const key = btn.dataset.rx;
            const ta = $("r_corpo");
            const insert = rxLine(key);
            if(!insert) return;
            const cur = (ta.value || "").trim();
            ta.value = cur ? (cur + "\n\n" + insert) : insert;

            // salva rascunho (não perde)
            await BTX_DB.put(BTX_DB.STORES.drafts, { key:"rx_draft", value: ta.value });
            await buildPreview();
          });
        });

        // carrega rascunho
        const draft = await BTX_DB.get(BTX_DB.STORES.drafts, "rx_draft");
        if(draft?.value && !$("r_corpo").value){
          $("r_corpo").value = draft.value;
        }

        $("r_corpo").addEventListener("input", async () => {
          await BTX_DB.put(BTX_DB.STORES.drafts, { key:"rx_draft", value: $("r_corpo").value });
        });
      },
      build: async () => {
        const paciente = formVal("r_paciente");
        const cidade = formVal("r_cidade") || "Cidade";
        const dataIso = formVal("r_data") || isoToday();
        const dataBR = fmtBR(dataIso);

        const corpo = formVal("r_corpo");
        const orient = formVal("r_orient");

        const presc = [corpo, orient ? ("\n\nOrientações:\n"+orient) : ""].join("");

        return `
          ${docLine("Paciente", paciente)}
          <div class="doc-title">Prescrição</div>
          <div class="doc-block">${esc(presc || "")}</div>
          <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>
        `;
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
        <input id="rc_referente" placeholder="Ex.: Consulta / Procedimento / Sessão..." />

        <label>Observações (opcional)</label>
        <textarea id="rc_obs"></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rc_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="rc_data" type="date" value="${isoToday()}" />
          </div>
        </div>
      `,
      build: async () => {
        const pagador = formVal("rc_pagador");
        const valor = formVal("rc_valor");
        const referente = formVal("rc_referente");
        const forma = formVal("rc_forma");
        const cidade = formVal("rc_cidade") || "Cidade";
        const dataIso = formVal("rc_data") || isoToday();
        const dataBR = fmtBR(dataIso);

        const valorFmt = valor ? Number(valor).toFixed(2) : "";

        return `
          <div class="doc-title">Declaração de Recibo</div>
          <p class="doc-line">Recebi de <strong>${esc(pagador)}</strong> a quantia de <strong>R$ ${esc(valorFmt || "0,00")}</strong>.</p>
          ${referente ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(referente)}</p>` : ""}
          ${forma ? `<p class="doc-line"><strong>Forma de pagamento:</strong> ${esc(forma)}</p>` : ""}
          ${docBlock("Observações", formVal("rc_obs"))}
          <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>
        `;
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
          <label>Nome do paciente</label>
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
              <input id="o_data" type="date" value="${isoToday()}" />
            </div>
          </div>
        `;
      },
      build: async () => {
        const paciente = formVal("o_paciente");
        const cidade = formVal("o_cidade") || "Cidade";
        const dataIso = formVal("o_data") || isoToday();
        const dataBR = fmtBR(dataIso);

        const itens = [];
        for (let i=1;i<=10;i++){
          const d = formVal(`o_d${i}`);
          const rawV = formVal(`o_v${i}`);
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

        return `
          ${docLine("Paciente", paciente)}
          ${table}
          ${docBlock("Observações", formVal("o_obs"))}
          <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>
        `;
      }
    },

    laudo: {
      title: "Laudo",
      sub: "Relatório estruturado com conclusão.",
      renderForm: async () => `
        <label>Nome do paciente</label>
        <input id="l_paciente" />

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
            <input id="l_data" type="date" value="${isoToday()}" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = formVal("l_paciente");
        const cidade = formVal("l_cidade") || "Cidade";
        const dataIso = formVal("l_data") || isoToday();
        const dataBR = fmtBR(dataIso);

        return `
          ${docLine("Paciente", paciente)}
          ${docLine("Título", formVal("l_titulo"))}
          ${docBlock("Descrição detalhada", formVal("l_desc"))}
          ${docBlock("Conclusão / Impressão diagnóstica", formVal("l_conc"))}
          <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>
        `;
      }
    },

    atestado: {
      title: "Atestado",
      sub: "Justificativa e dias de afastamento (opcional).",
      renderForm: async () => `
        <label>Nome do paciente</label>
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
            <input id="a_data" type="date" value="${isoToday()}" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = formVal("a_paciente");
        const cidade = formVal("a_cidade") || "Cidade";
        const dataIso = formVal("a_data") || isoToday();
        const dataBR = fmtBR(dataIso);
        const diasRaw = formVal("a_dias");
        const dias = diasRaw ? Number(diasRaw) : null;

        return `
          ${docLine("Paciente", paciente)}
          ${(dias && !Number.isNaN(dias) && dias > 0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : ""}
          ${docBlock("Atestado", formVal("a_desc"))}
          <p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(dataBR)}</p>
        `;
      }
    }
  };

  /* =========================
     AÇÕES GERAIS
     ========================= */
  function clearCurrentForm(){
    const panel = $("formPanel");
    panel.querySelectorAll("input,textarea,select").forEach(el=>{
      // mantém dates com hoje quando limpar
      if(el.type === "date"){
        el.value = isoToday();
      } else {
        el.value = "";
      }
    });
  }

  function downloadText(filename, text, mime="text/plain"){
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportJSON(){
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "BTX Docs Saúde",
      version: APP_VER,
      profissional: (await BTX_DB.get(BTX_DB.STORES.profissional, "prof"))?.data || null,
      pacientes: await BTX_DB.getAll(BTX_DB.STORES.pacientes),
      agenda: await BTX_DB.getAll(BTX_DB.STORES.agenda),
      prontuario: await BTX_DB.getAll(BTX_DB.STORES.prontuario),
      drafts: await BTX_DB.getAll(BTX_DB.STORES.drafts),
    };
    downloadText(`btx_backup_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  async function importJSON(file){
    const txt = await file.text();
    const data = JSON.parse(txt);

    if(!data || typeof data !== "object") throw new Error("JSON inválido.");
    // escreve tudo
    if(data.profissional){
      await setProf(data.profissional);
    }
    if(Array.isArray(data.pacientes)){
      for (const p of data.pacientes) await BTX_DB.put(BTX_DB.STORES.pacientes, p);
    }
    if(Array.isArray(data.agenda)){
      for (const a of data.agenda) await BTX_DB.put(BTX_DB.STORES.agenda, a);
    }
    if(Array.isArray(data.prontuario)){
      for (const r of data.prontuario) await BTX_DB.put(BTX_DB.STORES.prontuario, r);
    }
    if(Array.isArray(data.drafts)){
      for (const d of data.drafts) await BTX_DB.put(BTX_DB.STORES.drafts, d);
    }
  }

  async function resetAll(){
    if(!confirm("Tem certeza? Isso apaga tudo no aparelho (profissional, pacientes, agenda e prontuário).")) return;
    await BTX_DB.clear(BTX_DB.STORES.profissional);
    await BTX_DB.clear(BTX_DB.STORES.pacientes);
    await BTX_DB.clear(BTX_DB.STORES.agenda);
    await BTX_DB.clear(BTX_DB.STORES.prontuario);
    await BTX_DB.clear(BTX_DB.STORES.drafts);
    toast("Tudo zerado ✅");
    location.reload();
  }

  /* =========================
     INIT
     ========================= */
  async function init(){
    setupLogin();

    // Profissional
    const prof = await getProf();
    profToUI(prof);

    $("btnProfSalvar").addEventListener("click", async () => {
      const p = profFromUI();
      if(!p.nome) return alert("Digite pelo menos o nome do profissional.");
      await setProf(p);
      toast("Profissional salvo ✅");
      await buildPreview();
    });

    $("btnProfLimpar").addEventListener("click", async () => {
      await BTX_DB.clear(BTX_DB.STORES.profissional);
      profToUI(null);
      toast("Profissional limpo ✅");
      await buildPreview();
    });

    // Tabs
    document.querySelectorAll(".tabbtn").forEach(btn=>{
      btn.addEventListener("click", async () => {
        // agenda volta ao modo day por padrão
        if(btn.dataset.tab === "agenda"){
          await BTX_DB.put(BTX_DB.STORES.drafts, { key:"agenda_mode", value:"day" });
        }
        await renderTab(btn.dataset.tab);
      });
    });

    // Botões preview
    $("btnClearForm").addEventListener("click", async () => {
      clearCurrentForm();
      toast("Formulário limpo ✅");
      await buildPreview();
    });

    $("btnDownloadHTML").addEventListener("click", async () => {
      // baixa o HTML do papel (o que está visível)
      downloadText(`btx_documento_${currentTab}_${Date.now()}.html`, lastBuiltHTML, "text/html");
      toast("HTML baixado ✅");
    });

    $("btnPrint").addEventListener("click", async () => {
      await buildPreview();
      window.print();
    });

    // Backup
    $("btnExportJSON").addEventListener("click", exportJSON);

    $("importFile").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      try{
        await importJSON(file);
        toast("Importado ✅");
        location.reload();
      }catch(err){
        alert("Falha ao importar: " + err.message);
      } finally {
        e.target.value = "";
      }
    });

    $("btnResetAll").addEventListener("click", resetAll);

    // Rede status
    const netPill = $("netPill");
    const setNet = () => {
      netPill.textContent = navigator.onLine ? "Online" : "Offline";
      netPill.style.borderColor = navigator.onLine ? "rgba(25,226,140,.45)" : "rgba(248,113,113,.45)";
    };
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    setNet();

    // Hard refresh (mata cache do SW na prática)
    $("btnHardRefresh").addEventListener("click", async () => {
      try{
        if("serviceWorker" in navigator){
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.update();
        }
      } finally {
        toast("Atualização solicitada ✅");
        location.href = location.pathname + "?v=" + Date.now();
      }
    });

    // start
    await renderTab("agenda");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
