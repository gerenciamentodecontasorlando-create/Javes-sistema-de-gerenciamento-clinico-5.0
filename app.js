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
            Dica: “Ver semana” monta o PDF da semana. Para registrar procedimentos, use a aba <b>Prontuário</b>.
          </p>
        `;
      },
      build: async () => {
        const dateISO = $("ag_date")?.value || todayISO();
        const mode = window.__agendaMode || "day";
        if(mode === "week"){
          const start = weekStartISO(dateISO);
          const list = await listAgendaWeek(start);
          return `
            <div class="doc-title">Semana (início): ${esc(brDate(start))}</div>
            ${agendaTableHTML(list)}
          `;
        }
        const list = await listAgendaByDate(dateISO);
        return `
          <div class="doc-title">Agenda do dia — ${esc(brDate(dateISO))}</div>
          ${agendaTableHTML(list)}
        `;
      },
      afterRender: async () => {
        window.__agendaMode = "day";

        const search = $("ag_search");
        const pick = $("ag_patientPick");
        async function refreshPick(){
          const term = search.value;
          const found = await patientSearch(term);
          pick.innerHTML = `<option value="">— digite acima ou cadastre pelo nome —</option>` +
            found.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.phone ? " • " + esc(p.phone) : ""}</option>`).join("");
        }

        search.addEventListener("input", refreshPick);
        await refreshPick();

        $("btnAgSave").addEventListener("click", async () => {
          const date = $("ag_date").value || todayISO();
          const time = $("ag_time").value || "";
          const name = $("ag_name").value.trim();
          const phone = $("ag_phone").value.trim();
          const patientPick = pick.value;

          let patientId = "";
          if(patientPick){
            patientId = patientPick;
          } else {
            if(!name){
              alert("Digite o nome do paciente.");
              return;
            }
            const p = await upsertPatient({ name, phone });
            patientId = p?.id || "";
          }

          // se escolheu paciente, preenche nome/telefone pra agenda
          let patientName = name;
          let patientPhone = phone;
          if(patientPick){
            const p = await BTXDB.get(BTXDB.STORES.patients, patientPick);
            patientName = p?.name || name || "";
            patientPhone = p?.phone || phone || "";
          }

          await addAgendaItem({
            date, time,
            patientName, patientPhone,
            patientId,
            type: $("ag_type").value,
            status: $("ag_status").value,
            obs: $("ag_obs").value
          });

          $("ag_time").value = "";
          $("ag_obs").value = "";
          $("ag_name").value = "";
          $("ag_phone").value = "";
          toast("Agendamento salvo ✅");
          await buildPreview();
        });

        $("btnAgDay").addEventListener("click", async () => {
          window.__agendaMode = "day";
          toast("Modo: agenda do dia ✅");
          await buildPreview();
        });

        $("btnAgWeek").addEventListener("click", async () => {
          window.__agendaMode = "week";
          toast("Modo: agenda da semana ✅");
          await buildPreview();
        });
      }
    },

    prontuario: {
      title: "Prontuário",
      sub: "Registro do que foi feito no paciente — por dia/semana, tudo salvo.",
      renderForm: async () => {
        const d0 = todayISO();
        return `
          <label>Buscar paciente (nome/telefone)</label>
          <input id="pr_search" placeholder="Digite para buscar..." />

          <label>Selecionar paciente</label>
          <select id="pr_pick">
            <option value="">— selecione —</option>
          </select>

          <div class="row">
            <div>
              <label>Data do atendimento</label>
              <input id="pr_date" type="date" value="${esc(d0)}" />
            </div>
            <div>
              <label>Status</label>
              <select id="pr_status">
                <option value="atendido">atendido</option>
                <option value="retorno">retorno</option>
                <option value="em acompanhamento">em acompanhamento</option>
              </select>
            </div>
          </div>

          <label>Título (opcional)</label>
          <input id="pr_title" placeholder="Ex.: Pós-op 7 dias / Revisão / Queixa principal..." />

          <label>Procedimentos realizados</label>
          <textarea id="pr_proc" placeholder="Ex.: raspagem, restauração, curativo, orientação..." ></textarea>

          <label>Evolução / Observações</label>
          <textarea id="pr_text" placeholder="Escreva a evolução do paciente..." ></textarea>

          <div class="actions" style="justify-content:flex-start; margin-top:10px;">
            <button class="btn btn-primary" type="button" id="btnPrSave">Salvar atendimento</button>
            <button class="btn btn-ghost" type="button" id="btnPrWeek">Exportar semana</button>
          </div>

          <p class="small" style="margin-top:10px;">
            “Exportar semana” gera um prontuário semanal no preview pronto pra PDF.
          </p>
        `;
      },
      build: async () => {
        const pid = $("pr_pick")?.value || "";
        if(!pid) return `<p class="doc-line">Selecione um paciente para visualizar o prontuário.</p>`;

        const p = await BTXDB.get(BTXDB.STORES.patients, pid);
        const notes = await getNotesByPatient(pid);

        if(!notes.length){
          return `
            ${line("Paciente", p?.name || "")}
            <p class="doc-line">Sem registros ainda. Salve um atendimento para começar.</p>
          `;
        }

        // modo semana?
        const mode = window.__prMode || "all";
        if(mode === "week"){
          const base = $("pr_date")?.value || todayISO();
          const start = weekStartISO(base);
          const end = addDaysISO(start, 6);
          const wk = notes.filter(n => n.dateISO >= start && n.dateISO <= end);

          if(!wk.length){
            return `
              ${line("Paciente", p?.name || "")}
              <div class="doc-title">Semana ${esc(brDate(start))} a ${esc(brDate(end))}</div>
              <p class="doc-line">Nenhum atendimento nessa semana.</p>
            `;
          }

          return `
            ${line("Paciente", p?.name || "")}
            <div class="doc-title">Prontuário semanal — ${esc(brDate(start))} a ${esc(brDate(end))}</div>
            ${wk.map(n => `
              <div class="doc-block">
                <b>${esc(brDate(n.dateISO))}</b> • ${esc(n.status || "")}${n.title ? ` • ${esc(n.title)}` : ""}

                ${n.procedure ? `\n\nProcedimentos:\n${esc(n.procedure)}` : ""}

                ${n.text ? `\n\nEvolução:\n${esc(n.text)}` : ""}
              </div>
            `).join("")}
          `;
        }

        return `
          ${line("Paciente", p?.name || "")}
          <div class="doc-title">Registros</div>
          ${notes.map(n => `
            <div class="doc-block">
              <b>${esc(brDate(n.dateISO))}</b> • ${esc(n.status || "")}${n.title ? ` • ${esc(n.title)}` : ""}

              ${n.procedure ? `\n\nProcedimentos:\n${esc(n.procedure)}` : ""}

              ${n.text ? `\n\nEvolução:\n${esc(n.text)}` : ""}
            </div>
          `).join("")}
        `;
      },
      afterRender: async () => {
        window.__prMode = "all";
        const search = $("pr_search");
        const pick = $("pr_pick");

        async function refreshPick(){
          const term = search.value;
          const found = await patientSearch(term);
          pick.innerHTML = `<option value="">— selecione —</option>` +
            found.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.phone ? " • " + esc(p.phone) : ""}</option>`).join("");
        }

        search.addEventListener("input", refreshPick);
        pick.addEventListener("change", buildPreview);
        await refreshPick();

        $("btnPrSave").addEventListener("click", async () => {
          const pid = pick.value;
          if(!pid){ alert("Selecione um paciente."); return; }

          await addNote({
            patientId: pid,
            dateISO: $("pr_date").value || todayISO(),
            status: $("pr_status").value || "atendido",
            title: $("pr_title").value,
            procedure: $("pr_proc").value,
            text: $("pr_text").value
          });

          $("pr_title").value = "";
          $("pr_proc").value = "";
          $("pr_text").value = "";
          toast("Atendimento salvo ✅");
          await buildPreview();
        });

        $("btnPrWeek").addEventListener("click", async () => {
          window.__prMode = "week";
          toast("Prontuário semanal no preview ✅");
          await buildPreview();
        });
      }
    },

    ficha: {
      title: "Ficha clínica",
      sub: "Identificação do paciente, anamnese e planejamento.",
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

        <label>Procedimentos realizados</label>
        <textarea id="f_proc"></textarea>
      `,
      build: async () => {
        return [
          line("Paciente", $("f_paciente")?.value.trim()),
          line("Nascimento", brDate($("f_nasc")?.value || "")),
          line("Telefone", $("f_tel")?.value.trim()),
          line("Endereço", $("f_end")?.value.trim()),
          block("Motivo da consulta", $("f_motivo")?.value.trim()),
          block("Anamnese", $("f_anamnese")?.value.trim()),
          block("Planejamento", $("f_plan")?.value.trim()),
          block("Procedimentos realizados", $("f_proc")?.value.trim()),
        ].join("");
      }
    },

    receita: {
      title: "Receituário",
      sub: "Limpo, profissional e editável. Só imprime o que você revisou.",
      renderForm: async () => {
        const draft = await getDraft("draft_receita") || {};
        const d0 = draft.data || todayISO();
        return `
          <label>Paciente</label>
          <input id="r_paciente" value="${esc(draft.paciente || "")}" />

          <div class="row">
            <div>
              <label>Cidade</label>
              <input id="r_cidade" value="${esc(draft.cidade || "")}" placeholder="Cidade" />
            </div>
            <div>
              <label>Data</label>
              <input id="r_data" type="date" value="${esc(d0)}" />
            </div>
          </div>

          <div class="doc-title">Modelos rápidos (1 clique) — revise antes do PDF</div>

          <div class="small" style="margin:6px 0 0;">Analgésicos</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="dipirona">dipirona</button>
            <button class="btn btn-ghost" type="button" data-rx="paracetamol">paracetamol</button>
          </div>

          <div class="small" style="margin:10px 0 0;">Anti-inflamatórios</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="ibuprofeno">ibuprofeno</button>
            <button class="btn btn-ghost" type="button" data-rx="nimesulida">nimesulida</button>
            <button class="btn btn-ghost" type="button" data-rx="diclofenaco">diclofenaco</button>
          </div>

          <div class="small" style="margin:10px 0 0;">Antibióticos</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="amoxicilina">amoxicilina</button>
            <button class="btn btn-ghost" type="button" data-rx="azitromicina">azitromicina</button>
            <button class="btn btn-ghost" type="button" data-rx="amoxclav">amox+clav</button>
          </div>

          <div class="small" style="margin:10px 0 0;">Hipertensão</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="losartana">losartana</button>
            <button class="btn btn-ghost" type="button" data-rx="enalapril">enalapril</button>
            <button class="btn btn-ghost" type="button" data-rx="anlodipino">anlodipino</button>
            <button class="btn btn-ghost" type="button" data-rx="hidrocloro">HCTZ</button>
          </div>

          <div class="small" style="margin:10px 0 0;">Diabetes</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="metformina">metformina 500</button>
            <button class="btn btn-ghost" type="button" data-rx="metformina850">metformina 850</button>
            <button class="btn btn-ghost" type="button" data-rx="glibenclamida">glibenclamida</button>
            <button class="btn btn-ghost" type="button" data-rx="gliclazida">gliclazida MR</button>
          </div>

          <div class="small" style="margin:10px 0 0;">Antifúngicos</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="fluconazol">fluconazol</button>
            <button class="btn btn-ghost" type="button" data-rx="cetoconazolCreme">cetoconazol creme</button>
            <button class="btn btn-ghost" type="button" data-rx="miconazolCreme">miconazol creme</button>
            <button class="btn btn-ghost" type="button" data-rx="shampooCeto">shampoo ceto</button>
            <button class="btn btn-ghost" type="button" data-rx="nistatina">nistatina</button>
          </div>

          <div class="small" style="margin:10px 0 0;">Dermatológicos / Alergia</div>
          <div class="quickgrid">
            <button class="btn btn-ghost" type="button" data-rx="hidrocortisona">hidrocortisona</button>
            <button class="btn btn-ghost" type="button" data-rx="mupirocina">mupirocina</button>
            <button class="btn btn-ghost" type="button" data-rx="dexclorfeniramina">dexclorfeniramina</button>
          </div>

          <label style="margin-top:12px;">Prescrição (campo final — é isso que vai pro PDF)</label>
          <textarea id="r_texto" placeholder="Escreva/edite aqui…">${esc(draft.texto || "")}</textarea>

          <label>Observações (opcional — aparece no PDF se você escrever)</label>
          <textarea id="r_obs" placeholder="Ex.: orientações, retorno...">${esc(draft.obs || "")}</textarea>
        `;
      },
      build: async () => {
        const paciente = $("r_paciente")?.value.trim();
        const cidade = $("r_cidade")?.value.trim();
        const dataISO = $("r_data")?.value || todayISO();
        const texto = $("r_texto")?.value.trim();
        const obs = $("r_obs")?.value.trim();

        // obrigatório: paciente + prescrição
        const header = [
          line("Paciente", paciente || "—")
        ].join("");

        const presc = texto
          ? `<div class="doc-title">Prescrição</div><div class="doc-block">${esc(texto)}</div>`
          : `<p class="doc-line">Preencha a prescrição.</p>`;

        const obsBlock = obs ? block("Observações", obs) : "";

        const rodape = `<p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(brDate(dataISO))}</p>`;

        // salva rascunho (memória forte)
        await setDraft("draft_receita", {
          paciente, cidade, data: dataISO, texto, obs
        });

        return header + presc + obsBlock + rodape;
      },
      afterRender: async () => {
        $("formPanel").querySelectorAll("[data-rx]").forEach(btn=>{
          btn.addEventListener("click", ()=>appendRx(btn.dataset.rx));
        });
      }
    },

    recibo: {
      title: "Recibo",
      sub: "Comprovação de pagamento / prestação de serviço.",
      renderForm: async () => `
        <label>Pagador (paciente)</label>
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
        <input id="rc_ref" placeholder="Ex.: consulta / procedimento..." />

        <label>Observações (opcional)</label>
        <textarea id="rc_obs"></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rc_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="rc_data" type="date" value="${esc(todayISO())}" />
          </div>
        </div>
      `,
      build: async () => {
        const pag = $("rc_pagador")?.value.trim();
        const valor = $("rc_valor")?.value.trim();
        const forma = $("rc_forma")?.value.trim();
        const ref = $("rc_ref")?.value.trim();
        const obs = $("rc_obs")?.value.trim();
        const cidade = $("rc_cidade")?.value.trim();
        const data = $("rc_data")?.value || todayISO();

        const valorFmt = valor ? Number(valor).toFixed(2) : "0.00";

        return `
          <div class="doc-title">Recibo</div>
          <p class="doc-line">Recebi de <strong>${esc(pag || "—")}</strong> a quantia de <strong>R$ ${esc(valorFmt)}</strong>.</p>
          ${ref ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(ref)}</p>` : ""}
          ${forma ? `<p class="doc-line"><strong>Forma:</strong> ${esc(forma)}</p>` : ""}
          ${obs ? block("Observações", obs) : ""}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(brDate(data))}</p>
        `;
      }
    },

    orcamento: {
      title: "Orçamento",
      sub: "Procedimentos e valores (até 10 itens).",
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

          <div class="small" style="margin:10px 0 6px;">Itens:</div>
          ${rows}

          <div class="row">
            <div>
              <label>Cidade</label>
              <input id="o_cidade" />
            </div>
            <div>
              <label>Data</label>
              <input id="o_data" type="date" value="${esc(todayISO())}" />
            </div>
          </div>
        `;
      },
      build: async () => {
        const paciente = $("o_paciente")?.value.trim();
        const cidade = $("o_cidade")?.value.trim();
        const data = $("o_data")?.value || todayISO();

        const itens = [];
        for (let i=1;i<=10;i++){
          const d = ($(`o_d${i}`)?.value || "").trim();
          const rawV = ($(`o_v${i}`)?.value || "").trim();
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
          ${line("Paciente", paciente || "—")}
          ${table}
          ${($("o_obs")?.value.trim()) ? block("Observações", $("o_obs").value.trim()) : ""}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(brDate(data))}</p>
        `;
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
            <input id="l_data" type="date" value="${esc(todayISO())}" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = $("l_paciente")?.value.trim();
        const cidade = $("l_cidade")?.value.trim();
        const data = $("l_data")?.value || todayISO();
        return `
          ${line("Paciente", paciente || "—")}
          ${$("l_titulo")?.value.trim() ? line("Título", $("l_titulo").value.trim()) : ""}
          ${$("l_desc")?.value.trim() ? block("Descrição", $("l_desc").value.trim()) : ""}
          ${$("l_conc")?.value.trim() ? block("Conclusão", $("l_conc").value.trim()) : ""}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(brDate(data))}</p>
        `;
      }
    },

    atestado: {
      title: "Atestado",
      sub: "Justificativa e afastamento (opcional).",
      renderForm: async () => `
        <label>Paciente</label>
        <input id="a_paciente" />

        <label>Dias de afastamento (opcional)</label>
        <input id="a_dias" type="number" min="0" step="1" placeholder="Ex.: 2" />

        <label>Texto do atestado</label>
        <textarea id="a_desc" placeholder="Ex.: Atesto para os devidos fins..."></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="a_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="a_data" type="date" value="${esc(todayISO())}" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = $("a_paciente")?.value.trim();
        const cidade = $("a_cidade")?.value.trim();
        const data = $("a_data")?.value || todayISO();
        const diasRaw = $("a_dias")?.value.trim();
        const dias = diasRaw ? Number(diasRaw) : null;

        return `
          ${line("Paciente", paciente || "—")}
          ${(dias && !Number.isNaN(dias) && dias > 0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : ""}
          ${$("a_desc")?.value.trim() ? block("Atestado", $("a_desc").value.trim()) : `<p class="doc-line">Preencha o texto do atestado.</p>`}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(brDate(data))}</p>
        `;
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

    $("formPanel").innerHTML = await TABS[tab].renderForm();

    // listeners
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      el.addEventListener("input", buildPreview);
      el.addEventListener("change", buildPreview);
    });

    if (typeof TABS[tab].afterRender === "function") await TABS[tab].afterRender();

    await buildPreview();
  }

  async function buildPreview(){
    const prof = await BTXDB.getKV(KV_PROF);

    $("profResumo").textContent = profResumo(prof);
    $("pvMeta").textContent = nowBR();

    $("pvHeader").innerHTML = headerHTML(prof);
    $("pvTitle").textContent = TABS[currentTab].title;
    $("pvSub").textContent = TABS[currentTab].sub;

    $("pvBody").innerHTML = await TABS[currentTab].build();
    $("pvSign").innerHTML = signHTML(prof);
  }

  /* ===== BOTÕES GERAIS ===== */
  $("btnSalvarProf").addEventListener("click", async ()=>{
    const p = readProfFromUI();
    if (!p.nome){
      alert("Digite pelo menos o nome do profissional para salvar.");
      return;
    }
    await BTXDB.setKV(KV_PROF, p);
    toast("Profissional salvo ✅");
    await buildPreview();
  });

  $("btnLimparProf").addEventListener("click", async ()=>{
    await BTXDB.delKV(KV_PROF);
    setProfToUI(null);
    toast("Profissional limpo ✅");
    await buildPreview();
  });

  $("btnLimparForm").addEventListener("click", async ()=>{
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=> el.value = "");
    toast("Formulário limpo ✅");
    await buildPreview();
  });

  $("btnPrint").addEventListener("click", async ()=>{
    await buildPreview();
    window.print();
  });

  $("btnResetAll").addEventListener("click", async ()=>{
    if(!confirm("Tem certeza? Isso apaga TUDO (profissional, agenda, pacientes, prontuário e rascunhos).")) return;
    await BTXDB.resetAll();
    setProfToUI(null);
    toast("Tudo zerado ✅");
    await renderTab("agenda");
  });

  // Export/Import
  $("btnExport").addEventListener("click", async ()=>{
    const data = await BTXDB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BTX_Docs_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup exportado ✅");
  });

  $("btnImport").addEventListener("click", ()=> $("fileImport").click());

  $("fileImport").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      await BTXDB.importAll(data);
      // recarrega prof na UI
      setProfToUI(await BTXDB.getKV(KV_PROF));
      toast("Backup importado ✅");
      await renderTab(currentTab);
    }catch(err){
      alert("Falha ao importar backup: " + (err?.message || err));
    }finally{
      e.target.value = "";
    }
  });

  // Atualizar (força update SW + reload)
  $("btnUpdate").addEventListener("click", async ()=>{
    try{
      if(navigator.serviceWorker?.getRegistration){
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
      toast("Atualizando offline…");
      setTimeout(()=>location.reload(), 600);
    }catch{
      location.reload();
    }
  });

  /* init tabs */
  document.querySelectorAll(".tabbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
  });

  // init
  (async () => {
    setProfToUI(await BTXDB.getKV(KV_PROF));
    await renderTab("agenda");
    toast("BTX Docs carregado ✅");
  })();
})();
