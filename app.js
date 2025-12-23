/* BTX Docs Saúde — App principal */
(() => {
  const $ = (id) => document.getElementById(id);

  // UI helpers
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

  function fmtBRDate(iso){
    if(!iso) return "";
    const [y,m,d] = iso.split("-");
    if(!y||!m||!d) return iso;
    return `${d}/${m}/${y}`;
  }

  function nowBR(){
    const d = new Date();
    const data = d.toLocaleDateString("pt-BR");
    const hora = d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
    return `${data} • ${hora}`;
  }

  function dlText(filename, text, mime="text/plain"){
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

  // Online/offline pill
  function updateNetPill(){
    const pill = $("netPill");
    if(!pill) return;
    const on = navigator.onLine;
    pill.textContent = on ? "Online" : "Offline";
    pill.classList.toggle("ok", on);
    pill.classList.toggle("bad", !on);
  }
  window.addEventListener("online", updateNetPill);
  window.addEventListener("offline", updateNetPill);

  // ======== STATE =========
  let currentTab = "agenda";
  let selectedPatientId = null;

  // ======== PROFISSIONAL =========
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
    const n = p?.nome?.trim();
    const e = p?.esp?.trim();
    if(!n) return "—";
    return e ? `${n} — ${e}` : n;
  }

  function profHeadLines(p){
    const lines = [];
    if(p?.nome) lines.push(p.nome);
    if(p?.esp) lines.push(p.esp);
    const cr = [p?.conselho, p?.reg].filter(Boolean).join(" ").trim();
    if(cr) lines.push(cr);
    if(p?.end) lines.push(p.end);
    if(p?.tel) lines.push(p.tel);
    if(p?.email) lines.push(p.email);
    return lines;
  }

  // ======== PACIENTES =========
  function readPatientFromUI(){
    return {
      id: selectedPatientId || undefined,
      name: $("pNome").value.trim(),
      phone: $("pTel").value.trim(),
      birth: $("pNasc").value,
      doc: $("pDoc").value.trim(),
      address: $("pEnd").value.trim(),
    };
  }

  function setPatientToUI(p){
    $("pNome").value = p?.name || "";
    $("pTel").value = p?.phone || "";
    $("pNasc").value = p?.birth || "";
    $("pDoc").value = p?.doc || "";
    $("pEnd").value = p?.address || "";
  }

  async function pickPatient(p){
    selectedPatientId = p?.id || null;
    await BTXDB.metaSet("lastPatientId", selectedPatientId);
    $("pacienteSel").textContent = p?.name ? `${p.name}${p.phone ? " • " + p.phone : ""}` : "—";
    buildPreview();
    if(currentTab === "prontuario") renderTab("prontuario");
  }

  // Busca rápida: ao digitar, se achar 1º match, seleciona em background
  let __searchTimer = null;
  $("pBusca").addEventListener("input", ()=>{
    clearTimeout(__searchTimer);
    __searchTimer = setTimeout(async ()=>{
      const q = $("pBusca").value.trim();
      const list = await BTXDB.patientSearch(q);
      if(list.length === 1){
        pickPatient(list[0]);
        toast("Paciente selecionado ✅");
      }
    }, 250);
  });

  // ======== RECEITUÁRIO (PRESETS) =========
  // IMPORTANTE: isso é só “atalho de texto”. Quem responde pela prescrição é o profissional.
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
    anlodipino: "Amlodipino 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    hidroclorotiazida: "Hidroclorotiazida 25mg\nTomar 01 comprimido ao dia (conforme prescrição).",

    // Diabetes
    metformina: "Metformina 500mg\nTomar 01 comprimido 2x ao dia, junto às refeições (conforme prescrição).",
    glibenclamida: "Glibenclamida 5mg\nTomar 01 comprimido ao dia (conforme prescrição).",
    gliclazida: "Gliclazida 30mg (liberação modificada)\nTomar 01 comprimido ao dia (conforme prescrição).",

    // Antifúngicos / Dermatológicos
    fluconazol: "Fluconazol 150mg\nTomar 01 cápsula dose única (ou conforme prescrição).",
    cetoconazol_creme: "Cetoconazol creme 2%\nAplicar 2x ao dia por 2–4 semanas (conforme orientação).",
    miconazol_creme: "Miconazol creme 2%\nAplicar 2x ao dia por 2–4 semanas (conforme orientação).",
    terbinafina_creme: "Terbinafina creme 1%\nAplicar 1–2x ao dia por 1–2 semanas (conforme orientação).",
    cetoconazol_shampoo: "Shampoo cetoconazol 2%\nAplicar, deixar agir 3–5 min e enxaguar; usar 2–3x/semana por 2–4 semanas."
  };

  function getRxTextarea(){
    return $("r_texto");
  }

  function appendRx(key){
    const ta = getRxTextarea();
    const txt = RX[key];
    if(!ta || !txt) return;
    const cur = (ta.value || "").trim();
    ta.value = cur ? (cur + "\n\n" + txt) : txt;
    ta.dispatchEvent(new Event("input", { bubbles:true }));
  }

  // ======== AGENDA / PRONTUÁRIO =========
  function startOfWeekISO(anyISO){
    // semana começa segunda
    const d0 = anyISO ? new Date(anyISO+"T12:00:00") : new Date();
    const day = d0.getDay(); // 0 dom ... 6 sáb
    const diff = (day === 0 ? -6 : 1 - day);
    const d = new Date(d0);
    d.setDate(d0.getDate() + diff);
    return d.toISOString().slice(0,10);
  }

  function addDaysISO(iso, days){
    const d = new Date(iso+"T12:00:00");
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  }

  // ======== DOCUMENTO (cabeçalho + assinatura) =========
  async function buildHeadbox(){
    const prof = await BTXDB.metaGet("profissional");
    const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;

    const profLines = profHeadLines(prof);
    const ptLine = p?.name ? `${p.name}${p.phone ? " • " + p.phone : ""}${p.birth ? " • Nasc: " + fmtBRDate(p.birth) : ""}` : "—";

    const profText = profLines.length ? profLines.join(" • ") : "—";
    $("profResumo").textContent = profResumo(prof);

    $("pvHeadbox").innerHTML = `
      <div class="line"><b>Profissional:</b> ${esc(profText)}</div>
      <div class="line"><b>Paciente:</b> ${esc(ptLine)}</div>
    `;
  }

  async function buildSignature(){
    const prof = await BTXDB.metaGet("profissional");
    const lines = profHeadLines(prof);
    if(lines.length){
      const nome = lines[0] || "";
      const conselhoReg = lines[2] || "";
      $("pvSign").innerHTML = `
        <div class="sigrow">
          <div class="sig">
            <div class="line"></div>
            <div><b>${esc(nome)}</b></div>
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
      $("pvSign").innerHTML = `<div class="small" style="color:#475569;">(Preencha os dados do profissional para assinatura.)</div>`;
    }
  }

  function line(label, value){
    if(!value) return "";
    return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
  }
  function block(title, value){
    if(!value) return "";
    return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
  }

  // ======== TABS =========
  const TABS = {
    agenda: {
      title: "Agenda",
      sub: "Semana inteira + vínculo com paciente e status.",
      renderForm: async () => {
        const pts = await BTXDB.patientSearch($("pBusca").value.trim());
        const options = pts.slice(0, 25).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.phone ? " • " + esc(p.phone) : ""}</option>`).join("");

        return `
          <div class="doc-title">Agendar / Atualizar</div>

          <label>Semana (início)</label>
          <input id="ag_semana" type="date" />

          <div class="row">
            <div>
              <label>Data</label>
              <input id="ag_data" type="date" />
            </div>
            <div>
              <label>Hora</label>
              <input id="ag_hora" type="time" />
            </div>
          </div>

          <label>Paciente (busca rápida)</label>
          <input id="ag_busca" placeholder="Digite nome ou telefone..." />

          <label>Selecionar paciente (opcional)</label>
          <select id="ag_patient">
            <option value="">— digite acima ou cadastre —</option>
            ${options}
          </select>

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
          <input id="ag_obs" placeholder="Ex: retorno pós-op, dor, etc." />

          <div class="actions left">
            <button class="btn btn-primary" type="button" id="btnAgSalvar">Salvar</button>
            <button class="btn btn-ghost" type="button" id="btnAgHoje">Hoje</button>
            <button class="btn btn-ghost" type="button" id="btnAgSemana">Semana</button>
          </div>

          <p class="small">
            Dica: para registrar procedimento/atendimento clínico, use a aba “Prontuário” e salve o atendimento do dia.
          </p>
        `;
      },
      build: async () => {
        const base = $("ag_semana")?.value || startOfWeekISO(todayISO());
        const start = startOfWeekISO(base);
        const end = addDaysISO(start, 6);
        const list = await BTXDB.agendaByDateRange(start, end);

        const title = `Agenda da semana (${fmtBRDate(start)} a ${fmtBRDate(end)})`;
        const rows = list.map(a=>{
          return `
            <tr>
              <td>${esc(fmtBRDate(a.date))}</td>
              <td>${esc(a.time||"")}</td>
              <td>${esc(a.patientName||"")}</td>
              <td>${esc(a.type||"")}</td>
              <td>${esc(a.status||"")}</td>
              <td>${esc(a.obs||"")}</td>
            </tr>
          `;
        }).join("");

        return `
          <div class="doc-title">${esc(title)}</div>
          ${rows ? `
            <table>
              <thead><tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          ` : `<p class="doc-line">Nenhum agendamento nesta semana.</p>`}
        `;
      },
      afterRender: async () => {
        const agSemana = $("ag_semana");
        const agData = $("ag_data");
        if(agSemana && !agSemana.value) agSemana.value = startOfWeekISO(todayISO());
        if(agData && !agData.value) agData.value = todayISO();

        // busca rápida agenda -> tenta selecionar paciente pelo texto
        $("ag_busca").addEventListener("input", async ()=>{
          const q = $("ag_busca").value.trim();
          const list = await BTXDB.patientSearch(q);
          if(list.length){
            $("ag_patient").value = list[0].id;
          }
        });

        $("btnAgHoje").addEventListener("click", ()=>{
          $("ag_data").value = todayISO();
          buildPreview();
        });

        $("btnAgSemana").addEventListener("click", ()=>{
          $("ag_semana").value = startOfWeekISO(todayISO());
          buildPreview();
        });

        $("btnAgSalvar").addEventListener("click", async ()=>{
          const date = $("ag_data").value || todayISO();
          const time = $("ag_hora").value || "";
          const type = $("ag_tipo").value || "consulta";
          const status = $("ag_status").value || "aguardando";
          const obs = $("ag_obs").value.trim();

          let patientId = $("ag_patient").value || "";
          let patientName = "";
          if(patientId){
            const p = await BTXDB.patientGet(patientId);
            patientName = p?.name || "";
          } else if(selectedPatientId){
            const p = await BTXDB.patientGet(selectedPatientId);
            patientId = selectedPatientId;
            patientName = p?.name || "";
          }

          if(!patientName){
            alert("Selecione um paciente (ou cadastre e selecione).");
            return;
          }

          await BTXDB.agendaUpsert({
            date, time, type, status, obs,
            patientId, patientName
          });

          toast("Agendamento salvo ✅");
          $("ag_hora").value = "";
          $("ag_obs").value = "";
          buildPreview();
        });
      }
    },

    prontuario: {
      title: "Prontuário",
      sub: "Registro clínico por paciente (semana inteira / histórico).",
      renderForm: async () => {
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        const pname = p?.name || "";

        return `
          <div class="doc-title">Atendimento / Evolução</div>

          <p class="small">
            Paciente selecionado: <b>${esc(pname || "—")}</b><br/>
            (Selecione/cadastre um paciente na lateral.)
          </p>

          <label>Data</label>
          <input id="pr_data" type="date" />

          <label>Queixa / Motivo</label>
          <textarea id="pr_queixa" placeholder="Ex.: dor, retorno, avaliação..."></textarea>

          <label>Anamnese / Achados</label>
          <textarea id="pr_achados" placeholder="Ex.: sinais, sintomas, exame físico..."></textarea>

          <label>Procedimentos realizados</label>
          <textarea id="pr_proc" placeholder="Ex.: restauração, exodontia, orientação..."></textarea>

          <label>Conduta / Plano</label>
          <textarea id="pr_plano" placeholder="Ex.: medicação, retorno, exames..."></textarea>

          <label>Observações</label>
          <textarea id="pr_obs" placeholder="Livre..."></textarea>

          <div class="actions left">
            <button class="btn btn-primary" type="button" id="btnPrSalvar">Salvar atendimento</button>
            <button class="btn btn-ghost" type="button" id="btnPrSemana">Ver semana</button>
          </div>

          <div class="doc-title">Histórico do paciente</div>
          <div id="pr_hist" class="small">Carregando…</div>
        `;
      },
      build: async () => {
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(!p) return `<p class="doc-line">Selecione um paciente para ver o prontuário.</p>`;

        const data = $("pr_data")?.value || todayISO();
        const title = `Prontuário — ${p.name} — ${fmtBRDate(data)}`;

        const queixa = $("pr_queixa")?.value?.trim() || "";
        const achados = $("pr_achados")?.value?.trim() || "";
        const proc = $("pr_proc")?.value?.trim() || "";
        const plano = $("pr_plano")?.value?.trim() || "";
        const obs = $("pr_obs")?.value?.trim() || "";

        return `
          <div class="doc-title">${esc(title)}</div>
          ${block("Queixa / Motivo", queixa)}
          ${block("Anamnese / Achados", achados)}
          ${block("Procedimentos realizados", proc)}
          ${block("Conduta / Plano", plano)}
          ${block("Observações", obs)}
        `;
      },
      afterRender: async () => {
        if($("pr_data") && !$("pr_data").value) $("pr_data").value = todayISO();

        async function renderHist(){
          const box = $("pr_hist");
          const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
          if(!p){
            box.innerHTML = "Selecione um paciente.";
            return;
          }
          const list = await BTXDB.visitsByPatient(p.id);
          if(!list.length){
            box.innerHTML = "Sem atendimentos registrados ainda.";
            return;
          }
          box.innerHTML = list.slice(0,30).map(v=>{
            return `
              <div style="border:1px solid #1f2937; border-radius:12px; padding:10px; margin:8px 0; background:#050a08;">
                <div style="font-weight:900; color:#e9fff5;">${esc(fmtBRDate(v.date))} • ${esc(v.title || "Atendimento")}</div>
                <div style="color:#a9c8ba; font-size:12px; margin-top:4px;">${esc((v.summary||"").slice(0,160))}${(v.summary||"").length>160?"…":""}</div>
                <div class="row" style="margin-top:8px;">
                  <button class="btn btn-ghost" type="button" data-open="${esc(v.id)}">Abrir</button>
                  <button class="btn btn-danger" type="button" data-del="${esc(v.id)}">Excluir</button>
                </div>
              </div>
            `;
          }).join("");

          box.querySelectorAll("[data-open]").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
              const id = btn.getAttribute("data-open");
              const all = await BTXDB.visitsByPatient(p.id);
              const v = all.find(x=>x.id===id);
              if(!v) return;
              $("pr_data").value = v.date || todayISO();
              $("pr_queixa").value = v.queixa || "";
              $("pr_achados").value = v.achados || "";
              $("pr_proc").value = v.procedimentos || "";
              $("pr_plano").value = v.plano || "";
              $("pr_obs").value = v.obs || "";
              toast("Atendimento carregado ✅");
              buildPreview();
            });
          });

          box.querySelectorAll("[data-del]").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
              const id = btn.getAttribute("data-del");
              if(!confirm("Excluir esse atendimento?")) return;
              await BTXDB.visitDelete(id);
              toast("Excluído ✅");
              renderHist();
              buildPreview();
            });
          });
        }

        await renderHist();

        $("btnPrSalvar").addEventListener("click", async ()=>{
          const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
          if(!p){
            alert("Selecione um paciente antes de salvar o prontuário.");
            return;
          }

          const date = $("pr_data").value || todayISO();
          const queixa = $("pr_queixa").value.trim();
          const achados = $("pr_achados").value.trim();
          const procedimentos = $("pr_proc").value.trim();
          const plano = $("pr_plano").value.trim();
          const obs = $("pr_obs").value.trim();

          const title = (queixa || "Atendimento").slice(0, 60);
          const summary = [queixa, procedimentos, plano].filter(Boolean).join(" | ");

          await BTXDB.visitUpsert({
            patientId: p.id,
            patientName: p.name,
            date,
            title,
            queixa, achados, procedimentos, plano, obs,
            summary
          });

          toast("Atendimento salvo ✅");
          await renderHist();
          buildPreview();
        });

        $("btnPrSemana").addEventListener("click", async ()=>{
          const d = $("pr_data").value || todayISO();
          const start = startOfWeekISO(d);
          const end = addDaysISO(start, 6);

          const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
          if(!p) return;

          const all = await BTXDB.visitsByPatient(p.id);
          const week = all.filter(v => v.date >= start && v.date <= end);

          if(!week.length){
            toast("Sem atendimentos nessa semana.");
            return;
          }

          // monta no preview um resumo semanal
          const rows = week.map(v=>`
            <tr>
              <td>${esc(fmtBRDate(v.date))}</td>
              <td>${esc(v.title||"")}</td>
              <td>${esc((v.summary||"").slice(0,120))}${(v.summary||"").length>120?"…":""}</td>
            </tr>
          `).join("");

          $("pvTitle").textContent = "Prontuário (Semana)";
          $("pvSub").textContent = `Resumo semanal do paciente • ${fmtBRDate(start)} a ${fmtBRDate(end)}`;
          $("pvBody").innerHTML = `
            <div class="doc-title">Resumo semanal — ${esc(p.name)}</div>
            <table>
              <thead><tr><th>Data</th><th>Título</th><th>Resumo</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          `;
          await buildHeadbox();
          await buildSignature();
          toast("Resumo semanal gerado ✅");
        });
      }
    },

    ficha: {
      title: "Ficha clínica",
      sub: "Identificação + anamnese + planejamento (documento).",
      renderForm: async () => `
        <label>Paciente</label>
        <input id="f_paciente" placeholder="(auto pelo selecionado, mas pode digitar)" />

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
        const paciente = $("f_paciente")?.value.trim() || "";
        return `
          ${line("Paciente", paciente)}
          ${line("Nascimento", $("f_nasc")?.value || "")}
          ${line("Telefone", $("f_tel")?.value.trim() || "")}
          ${line("Endereço", $("f_end")?.value.trim() || "")}
          ${block("Motivo da consulta", $("f_motivo")?.value.trim() || "")}
          ${block("Anamnese", $("f_anamnese")?.value.trim() || "")}
          ${block("Planejamento", $("f_plan")?.value.trim() || "")}
          ${block("Procedimentos realizados hoje", $("f_proc")?.value.trim() || "")}
        `;
      },
      afterRender: async () => {
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(p){
          $("f_paciente").value = p.name || "";
          $("f_nasc").value = p.birth || "";
          $("f_tel").value = p.phone || "";
          $("f_end").value = p.address || "";
        }
      }
    },

    receita: {
      title: "Receituário",
      sub: "Limpo, profissional e editável. Só imprime o que você revisou.",
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
            <input id="r_data" type="date" />
          </div>
        </div>

        <div class="doc-title">Modelos rápidos (1 clique)</div>

        <div class="small">Analgésicos</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="dipirona">dipirona</button>
          <button class="btn btn-ghost" type="button" data-rx="paracetamol">paracetamol</button>
        </div>

        <div class="small" style="margin-top:8px;">Anti-inflamatórios</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="ibuprofeno">ibuprofeno</button>
          <button class="btn btn-ghost" type="button" data-rx="nimesulida">nimesulida</button>
          <button class="btn btn-ghost" type="button" data-rx="diclofenaco">diclofenaco</button>
        </div>

        <div class="small" style="margin-top:8px;">Antibióticos</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="amoxicilina">amoxicilina</button>
          <button class="btn btn-ghost" type="button" data-rx="azitromicina">azitromicina</button>
          <button class="btn btn-ghost" type="button" data-rx="amoxclav">amox+clav</button>
        </div>

        <div class="small" style="margin-top:8px;">Hipertensão</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="losartana">losartana</button>
          <button class="btn btn-ghost" type="button" data-rx="enalapril">enalapril</button>
          <button class="btn btn-ghost" type="button" data-rx="anlodipino">amlodipino</button>
          <button class="btn btn-ghost" type="button" data-rx="hidroclorotiazida">HCTZ</button>
        </div>

        <div class="small" style="margin-top:8px;">Diabetes</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="metformina">metformina</button>
          <button class="btn btn-ghost" type="button" data-rx="glibenclamida">glibenclamida</button>
          <button class="btn btn-ghost" type="button" data-rx="gliclazida">gliclazida</button>
        </div>

        <div class="small" style="margin-top:8px;">Antifúngicos / Dermatológicos</div>
        <div class="quickgrid">
          <button class="btn btn-ghost" type="button" data-rx="fluconazol">fluconazol</button>
          <button class="btn btn-ghost" type="button" data-rx="cetoconazol_creme">cetoconazol creme</button>
          <button class="btn btn-ghost" type="button" data-rx="miconazol_creme">miconazol creme</button>
          <button class="btn btn-ghost" type="button" data-rx="terbinafina_creme">terbinafina creme</button>
          <button class="btn btn-ghost" type="button" data-rx="cetoconazol_shampoo">shampoo cetoconazol</button>
        </div>

        <p class="small">Clique para inserir a posologia. Depois revise e edite (você é o responsável pela prescrição).</p>

        <label>Prescrição (editável)</label>
        <textarea id="r_texto" placeholder="As medicações escolhidas vão aparecer aqui..."></textarea>

        <label>Orientações adicionais (opcional)</label>
        <textarea id="r_orient" placeholder="Ex.: repouso, retorno, cuidados..."></textarea>
      `,
      build: async () => {
        const paciente = $("r_paciente")?.value.trim() || "";
        const cidade = $("r_cidade")?.value.trim() || "";
        const dataISO = $("r_data")?.value || todayISO();
        const dataBR = fmtBRDate(dataISO);

        const texto = $("r_texto")?.value.trim() || "";
        const orient = $("r_orient")?.value.trim() || "";

        const full = [texto, orient ? ("\n\nOrientações:\n"+orient) : ""].filter(Boolean).join("");

        // Receita NÃO deve mostrar “lista de botões”, só o texto final.
        return `
          ${line("Paciente", paciente)}
          <div class="doc-title">Prescrição</div>
          <div class="doc-block">${esc(full || "—")}</div>
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(dataBR)}</p>
        `;
      },
      afterRender: async () => {
        if($("r_data") && !$("r_data").value) $("r_data").value = todayISO();
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(p) $("r_paciente").value = p.name || "";

        document.querySelectorAll("[data-rx]").forEach(btn=>{
          btn.addEventListener("click", ()=>appendRx(btn.dataset.rx));
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
        <input id="rc_referente" placeholder="Ex.: Consulta / Procedimento..." />

        <label>Observações (opcional)</label>
        <textarea id="rc_obs"></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rc_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="rc_data" type="date" />
          </div>
        </div>
      `,
      build: async () => {
        const pagador = $("rc_pagador")?.value.trim() || "";
        const valor = $("rc_valor")?.value || "";
        const referente = $("rc_referente")?.value.trim() || "";
        const forma = $("rc_forma")?.value.trim() || "";
        const cidade = $("rc_cidade")?.value.trim() || "";
        const dataISO = $("rc_data")?.value || todayISO();
        const dataBR = fmtBRDate(dataISO);

        const valorFmt = valor ? Number(valor).toFixed(2) : "";

        return `
          <div class="doc-title">Recibo</div>
          <p class="doc-line">Recebi de <strong>${esc(pagador)}</strong> a quantia de <strong>R$ ${esc(valorFmt || "0,00")}</strong>.</p>
          ${referente ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(referente)}</p>` : ""}
          ${forma ? `<p class="doc-line"><strong>Forma de pagamento:</strong> ${esc(forma)}</p>` : ""}
          ${block("Observações", $("rc_obs")?.value.trim() || "")}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(dataBR)}</p>
        `;
      },
      afterRender: async () => {
        if($("rc_data") && !$("rc_data").value) $("rc_data").value = todayISO();
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(p) $("rc_pagador").value = p.name || "";
      }
    },

    orcamento: {
      title: "Orçamento",
      sub: "Procedimentos e valores (documento).",
      renderForm: async () => {
        let rows = "";
        for(let i=1;i<=10;i++){
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

          <div class="small" style="margin:10px 0 6px;">Até 10 itens:</div>
          ${rows}

          <div class="row">
            <div>
              <label>Cidade</label>
              <input id="o_cidade" />
            </div>
            <div>
              <label>Data</label>
              <input id="o_data" type="date" />
            </div>
          </div>
        `;
      },
      build: async () => {
        const paciente = $("o_paciente")?.value.trim() || "";
        const cidade = $("o_cidade")?.value.trim() || "";
        const dataISO = $("o_data")?.value || todayISO();
        const dataBR = fmtBRDate(dataISO);

        const itens = [];
        for(let i=1;i<=10;i++){
          const d = ($(`o_d${i}`)?.value || "").trim();
          const rawV = ($(`o_v${i}`)?.value || "").trim();
          if(d || rawV){
            itens.push({ desc: d || "", valor: rawV ? Number(rawV) : 0 });
          }
        }

        let table = "";
        if(itens.length){
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
          ${line("Paciente", paciente)}
          ${table}
          ${block("Observações", $("o_obs")?.value.trim() || "")}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(dataBR)}</p>
        `;
      },
      afterRender: async () => {
        if($("o_data") && !$("o_data").value) $("o_data").value = todayISO();
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(p) $("o_paciente").value = p.name || "";
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
            <input id="l_data" type="date" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = $("l_paciente")?.value.trim() || "";
        const cidade = $("l_cidade")?.value.trim() || "";
        const dataISO = $("l_data")?.value || todayISO();
        const dataBR = fmtBRDate(dataISO);

        return `
          ${line("Paciente", paciente)}
          ${line("Título", $("l_titulo")?.value.trim() || "")}
          ${block("Descrição detalhada", $("l_desc")?.value.trim() || "")}
          ${block("Conclusão / Impressão diagnóstica", $("l_conc")?.value.trim() || "")}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(dataBR)}</p>
        `;
      },
      afterRender: async () => {
        if($("l_data") && !$("l_data").value) $("l_data").value = todayISO();
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(p) $("l_paciente").value = p.name || "";
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

        <label>Declaração / Justificativa</label>
        <textarea id="a_desc" placeholder="Ex.: Declaro que o(a) paciente necessita afastamento..."></textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="a_cidade" />
          </div>
          <div>
            <label>Data</label>
            <input id="a_data" type="date" />
          </div>
        </div>
      `,
      build: async () => {
        const paciente = $("a_paciente")?.value.trim() || "";
        const cidade = $("a_cidade")?.value.trim() || "";
        const dataISO = $("a_data")?.value || todayISO();
        const dataBR = fmtBRDate(dataISO);
        const diasRaw = $("a_dias")?.value || "";
        const dias = diasRaw ? Number(diasRaw) : null;

        return `
          ${line("Paciente", paciente)}
          ${dias && !Number.isNaN(dias) && dias > 0 ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : ""}
          ${block("Declaração", $("a_desc")?.value.trim() || "")}
          <p class="doc-line"><strong>${esc(cidade || "Cidade")}</strong>, ${esc(dataBR)}</p>
        `;
      },
      afterRender: async () => {
        if($("a_data") && !$("a_data").value) $("a_data").value = todayISO();
        const p = selectedPatientId ? await BTXDB.patientGet(selectedPatientId) : null;
        if(p) $("a_paciente").value = p.name || "";
      }
    }
  };

  // ======== RENDER =========
  async function renderTab(tab){
    currentTab = tab;

    document.querySelectorAll(".tabbtn").forEach(b=>{
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    $("docTitle").textContent = TABS[tab].title;
    $("docSub").textContent = TABS[tab].sub;

    $("formPanel").innerHTML = await TABS[tab].renderForm();

    // listeners -> preview ao digitar
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      el.addEventListener("input", buildPreview);
      el.addEventListener("change", buildPreview);
    });

    if(typeof TABS[tab].afterRender === "function"){
      await TABS[tab].afterRender();
    }

    await buildPreview();
  }

  async function buildPreview(){
    $("pvMeta").textContent = nowBR();

    $("pvTitle").textContent = TABS[currentTab].title;
    $("pvSub").textContent = TABS[currentTab].sub;

    await buildHeadbox();
    $("pvBody").innerHTML = await TABS[currentTab].build();
    await buildSignature();
  }

  // ======== Buttons global =========
  $("btnReload").addEventListener("click", ()=>location.reload());

  $("btnPrint").addEventListener("click", async ()=>{
    await buildPreview();
    window.print();
  });

  $("btnLimparForm").addEventListener("click", async ()=>{
    $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
      // não limpar datas por padrão (só texto)
      if(el.type === "date") return;
      if(el.type === "time") { el.value = ""; return; }
      el.value = "";
    });
    toast("Formulário limpo ✅");
    await buildPreview();
  });

  $("btnBaixarDoc").addEventListener("click", async ()=>{
    await buildPreview();
    const html = `
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BTX Docs — Documento</title>
<style>${document.querySelector("link[href='./style.css']") ? "" : ""}</style>
</head><body>${$("paper").outerHTML}</body></html>`;
    // baixar só o documento (HTML)
    dlText(`btx_documento_${currentTab}_${Date.now()}.html`, html, "text/html");
    toast("Documento baixado (HTML) ✅");
  });

  // PROF
  $("btnProfSalvar").addEventListener("click", async ()=>{
    const p = readProfFromUI();
    if(!p.nome){
      alert("Digite pelo menos o nome do profissional.");
      return;
    }
    if(!p.end){
      // você pediu: endereço é principal -> vamos cobrar
      if(!confirm("Endereço está vazio. Para documento completo, preencha o endereço. Salvar mesmo assim?")) return;
    }
    await BTXDB.metaSet("profissional", p);
    toast("Profissional salvo ✅");
    await buildPreview();
  });

  $("btnProfLimpar").addEventListener("click", async ()=>{
    await BTXDB.metaDel("profissional");
    setProfToUI(null);
    toast("Profissional limpo ✅");
    await buildPreview();
  });

  // PACIENTE
  $("btnPacienteNovo").addEventListener("click", async ()=>{
    selectedPatientId = null;
    setPatientToUI(null);
    $("pacienteSel").textContent = "—";
    toast("Novo paciente ✅");
    await buildPreview();
  });

  $("btnPacienteSalvar").addEventListener("click", async ()=>{
    const p = readPatientFromUI();
    if(!p.name){
      alert("Digite o nome do paciente.");
      return;
    }
    const saved = await BTXDB.patientUpsert(p);
    // Recarrega o objeto salvo
    const list = await BTXDB.patientSearch(p.name);
    const found = list.find(x=>x.name===p.name && x.phone===p.phone) || list[0];
    if(found) await pickPatient(found);
    toast("Paciente salvo ✅");
    await buildPreview();
  });

  // Backup
  $("btnExport").addEventListener("click", async ()=>{
    const payload = await BTXDB.exportAll();
    dlText(`btx_backup_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast("Backup exportado ✅");
  });

  $("importFile").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const txt = await f.text();
    try{
      const payload = JSON.parse(txt);
      await BTXDB.importAll(payload);
      toast("Backup importado ✅");
      await boot();
    }catch(err){
      console.error(err);
      alert("Falha ao importar. Arquivo inválido.");
    }finally{
      e.target.value = "";
    }
  });

  $("btnZerarTudo").addEventListener("click", async ()=>{
    if(!confirm("Tem certeza? Isso apaga tudo do aparelho (profissional, pacientes, agenda e prontuário).")) return;
    await BTXDB.clearAll();
    toast("Tudo zerado ✅");
    await boot();
  });

  // Tabs
  document.querySelectorAll(".tabbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
  });

  // ======== BOOT =========
  async function boot(){
    updateNetPill();

    // carrega profissional
    const prof = await BTXDB.metaGet("profissional");
    setProfToUI(prof);

    // carrega último paciente
    const last = await BTXDB.metaGet("lastPatientId");
    if(last){
      const p = await BTXDB.patientGet(last);
      if(p) await pickPatient(p);
    } else {
      $("pacienteSel").textContent = "—";
    }

    await renderTab("agenda");
  }

  boot();
})();
