import { openDB, put, del, get, all, kvSet, kvGet } from "./db.js";

const $ = (id)=>document.getElementById(id);
const uid = ()=> (crypto?.randomUUID ? crypto.randomUUID() : ("id_"+Date.now()+"_"+Math.random().toString(16).slice(2)));

const esc = (s)=> String(s ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#39;");

const todayISO = ()=> new Date().toISOString().slice(0,10);
const nowBR = ()=>{
  const d = new Date();
  return `${d.toLocaleDateString("pt-BR")} • ${d.toLocaleTimeString("pt-BR").slice(0,5)}`;
};

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__t);
  window.__t = setTimeout(()=>t.classList.remove("show"), 2400);
}

function line(label, value){
  if(!value) return "";
  return `<p class="doc-line"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
}
function block(title, value){
  if(!value) return "";
  return `<div><div class="doc-title">${esc(title)}</div><div class="doc-block">${esc(value)}</div></div>`;
}

function downloadFile(filename, content, mime="text/plain"){
  const blob = new Blob([content], { type:mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
}

await openDB();

let currentTab = "agenda";

/* ---------------------------
   Profissional (KV)
----------------------------*/
async function loadProf(){ return await kvGet("prof", null); }
async function saveProf(p){ await kvSet("prof", p); }

function profResumo(p){
  if(!p?.nome) return "—";
  return `${p.nome}${p.esp ? " — "+p.esp : ""}`;
}
function profConselhoReg(p){
  const cr = `${p?.conselho || ""} ${p?.reg || ""}`.trim();
  return cr || "";
}
async function updateProfUI(){
  const p = await loadProf();
  $("profResumo").textContent = profResumo(p);
  $("statusLine").textContent = navigator.onLine ? "online/offline ok" : "offline ok";

  $("pvSign").innerHTML = p?.nome
    ? `<div class="line"></div><div><b>${esc(p.nome)}</b></div><div style="font-size:12px;color:#334155;">${esc(profConselhoReg(p))}</div>`
    : `<div style="font-size:12px;color:#334155;">(Preencha o profissional para assinatura.)</div>`;
}

function setProfToInputs(p){
  $("profNome").value = p?.nome || "";
  $("profEsp").value = p?.esp || "";
  $("profConselho").value = p?.conselho || "";
  $("profReg").value = p?.reg || "";
  $("profEnd").value = p?.end || "";
  $("profTel").value = p?.tel || "";
  $("profEmail").value = p?.email || "";
}

$("btnProfSalvar").addEventListener("click", async ()=>{
  const p = {
    nome: $("profNome").value.trim(),
    esp: $("profEsp").value.trim(),
    conselho: $("profConselho").value.trim(),
    reg: $("profReg").value.trim(),
    end: $("profEnd").value.trim(),
    tel: $("profTel").value.trim(),
    email: $("profEmail").value.trim()
  };
  if(!p.nome) return alert("Digite o nome do profissional.");
  await saveProf(p);
  toast("Profissional salvo ✅");
  await updateProfUI();
  await buildPreview();
});

$("btnProfLimpar").addEventListener("click", async ()=>{
  await kvSet("prof", null);
  setProfToInputs(null);
  toast("Profissional limpo ✅");
  await updateProfUI();
  await buildPreview();
});

/* ---------------------------
   Draft (memória do formulário)
----------------------------*/
async function draftSave(tab){
  const data = {};
  $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
    if(!el.id) return;
    if(el.type === "file") return;
    data[el.id] = el.value;
  });
  await kvSet(`draft_${tab}`, data);
}

async function draftLoad(tab){
  return await kvGet(`draft_${tab}`, {});
}

function attachDraftAutosave(tab){
  $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
    el.addEventListener("input", ()=> draftSave(tab));
    el.addEventListener("change", ()=> draftSave(tab));
  });
}

/* ---------------------------
   Receituário presets (1 clique)
----------------------------*/
const RX_PRESETS = {
  dipirona: "Dipirona 500mg\nTomar 01 comprimido a cada 6–8 horas, se dor ou febre, por até 3 dias.",
  paracetamol: "Paracetamol 750mg\nTomar 01 comprimido a cada 8 horas, se dor ou febre, por até 3 dias.",

  ibuprofeno: "Ibuprofeno 400mg\nTomar 01 comprimido a cada 8 horas, após alimentação, por 3 dias.",
  nimesulida: "Nimesulida 100mg\nTomar 01 comprimido a cada 12 horas, após alimentação, por 3 dias.",
  diclofenaco: "Diclofenaco de potássio 50mg\nTomar 01 comprimido a cada 8–12 horas, após alimentação, por 3 dias.",

  amoxicilina: "Amoxicilina 500mg\nTomar 01 cápsula a cada 8 horas por 7 dias.",
  azitromicina: "Azitromicina 500mg\nTomar 01 comprimido ao dia por 3 dias.",
  amoxclav: "Amoxicilina 875mg + Clavulanato 125mg (Clavulim)\nTomar 01 comprimido a cada 12 horas por 7 dias."
};

function appendRxPreset(key){
  const ta = $("r_corpo");
  if(!ta) return;
  const txt = RX_PRESETS[key];
  if(!txt) return;
  const cur = ta.value.trim();
  ta.value = cur ? (cur + "\n\n" + txt) : txt;
}

/* ---------------------------
   Tabs (Agenda + Docs)
----------------------------*/
function setHeader(title, sub){
  $("docTitle").textContent = title;
  $("docSub").textContent = sub;
  $("pvTitle").textContent = title;
  $("pvSub").textContent = sub;
  $("pvMeta").textContent = nowBR();
}

async function agendaGetAll(){
  const list = await all("agenda");
  list.sort((a,b)=> (a.data+a.hora).localeCompare(b.data+b.hora));
  return list;
}

function startOfWeek(d){
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12,0,0);
  const day = dt.getDay(); // 0 domingo
  dt.setDate(dt.getDate() - day);
  return dt;
}
function endOfWeek(start){
  const e = new Date(start);
  e.setDate(e.getDate()+7);
  return e;
}
function fmtBR(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
}

const TABS = {
  agenda: {
    title:"Agenda",
    sub:"Agendamento dia/semana + registro do que foi feito (salvo offline).",
    form: async ()=>{
      const draft = await draftLoad("agenda");
      const d = draft.ag_data || todayISO();
      return `
        <label>Data</label>
        <input id="ag_data" type="date" value="${esc(d)}" />

        <div class="row">
          <div>
            <label>Hora</label>
            <input id="ag_hora" type="time" value="${esc(draft.ag_hora||"")}" />
          </div>
          <div>
            <label>Paciente</label>
            <input id="ag_paciente" placeholder="Nome do paciente" value="${esc(draft.ag_paciente||"")}" />
          </div>
        </div>

        <div class="row">
          <div>
            <label>Tipo</label>
            <select id="ag_tipo">
              ${["consulta","retorno","procedimento","avaliacao"].map(v=>`<option ${draft.ag_tipo===v?"selected":""} value="${v}">${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="ag_status">
              ${["aguardando","confirmado","remarcado","faltou","concluido"].map(v=>`<option ${draft.ag_status===v?"selected":""} value="${v}">${v}</option>`).join("")}
            </select>
          </div>
        </div>

        <label>Observações do agendamento</label>
        <input id="ag_obs" placeholder="Ex: retorno pós-op, dor, etc." value="${esc(draft.ag_obs||"")}" />

        <label>Registro do que foi feito (prontuário do dia)</label>
        <textarea id="ag_registro" placeholder="Descreva procedimentos, evolução, materiais, orientações...">${esc(draft.ag_registro||"")}</textarea>

        <div class="actions left" style="margin-top:10px;">
          <button class="btn btn-primary" id="btnAgSalvar" type="button">Salvar na agenda</button>
          <button class="btn btn-ghost" id="btnAgHoje" type="button">Ver hoje</button>
          <button class="btn btn-ghost" id="btnAgSemana" type="button">Ver semana</button>
        </div>
      `;
    },
    after: ()=>{
      $("btnAgSalvar").onclick = async ()=>{
        const item = {
          id: uid(),
          data: $("ag_data").value || todayISO(),
          hora: $("ag_hora").value || "",
          paciente: $("ag_paciente").value.trim(),
          tipo: $("ag_tipo").value || "consulta",
          status: $("ag_status").value || "aguardando",
          obs: $("ag_obs").value.trim(),
          registro: $("ag_registro").value.trim(),
          createdAt: Date.now()
        };
        if(!item.paciente) return alert("Digite o nome do paciente.");
        await put("agenda", item);
        toast("Salvo ✅");
        await buildPreview({ scope:"day" });
      };

      $("btnAgHoje").onclick = async ()=>{
        $("ag_data").value = todayISO();
        await draftSave("agenda");
        await buildPreview({ scope:"day" });
      };

      $("btnAgSemana").onclick = async ()=>{
        await draftSave("agenda");
        await buildPreview({ scope:"week" });
      };
    },
    build: async (opts={ scope:"day" })=>{
      const list = await agendaGetAll();
      const baseISO = $("ag_data")?.value || todayISO();

      const d0 = new Date(baseISO+"T12:00:00");
      const sw = startOfWeek(d0);
      const ew = endOfWeek(sw);

      let rows = list;
      if(opts.scope === "week"){
        rows = rows.filter(it=>{
          const dt = new Date((it.data||todayISO())+"T12:00:00");
          return dt >= sw && dt < ew;
        });
      } else {
        rows = rows.filter(it=> it.data === baseISO);
      }

      if(!rows.length) return `<p class="doc-line">Nenhum agendamento encontrado.</p>`;

      const title = (opts.scope === "week")
        ? `Agenda da semana (${sw.toLocaleDateString("pt-BR")} até ${new Date(ew-1).toLocaleDateString("pt-BR")})`
        : `Agenda do dia ${fmtBR(baseISO)}`;

      const tr = rows.map(it=>`
        <tr>
          <td>${esc(it.hora||"")}</td>
          <td>${esc(it.paciente||"")}</td>
          <td>${esc(it.tipo||"")}</td>
          <td>${esc(it.status||"")}</td>
          <td>${esc(it.obs||"")}</td>
        </tr>
      `).join("");

      const regs = rows
        .filter(it=> it.registro && it.registro.trim())
        .map(it=>`
          <div class="doc-title">${esc(fmtBR(it.data))}${it.hora ? " • "+esc(it.hora):""} — ${esc(it.paciente||"")}</div>
          <div class="doc-block">${esc(it.registro)}</div>
        `).join("");

      return `
        <div class="doc-title">${esc(title)}</div>
        <table>
          <thead><tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
        ${regs ? `<div class="doc-title">Registros do que foi feito</div>${regs}` : `<p class="doc-line">Sem registros clínicos no período.</p>`}
      `;
    }
  },

  ficha: {
    title:"Ficha clínica",
    sub:"Identificação, anamnese e procedimentos. Salva como rascunho automático.",
    form: async ()=>{
      const d = await draftLoad("ficha");
      return `
        <label>Nome do paciente</label>
        <input id="f_paciente" value="${esc(d.f_paciente||"")}" />

        <div class="row">
          <div>
            <label>Nascimento</label>
            <input id="f_nasc" type="date" value="${esc(d.f_nasc||"")}" />
          </div>
          <div>
            <label>Telefone</label>
            <input id="f_tel" value="${esc(d.f_tel||"")}" />
          </div>
        </div>

        <label>Endereço</label>
        <input id="f_end" value="${esc(d.f_end||"")}" />

        <label>Motivo da consulta</label>
        <textarea id="f_motivo">${esc(d.f_motivo||"")}</textarea>

        <label>Anamnese</label>
        <textarea id="f_anamnese">${esc(d.f_anamnese||"")}</textarea>

        <label>Planejamento</label>
        <textarea id="f_plan">${esc(d.f_plan||"")}</textarea>

        <label>Procedimentos realizados hoje</label>
        <textarea id="f_proc">${esc(d.f_proc||"")}</textarea>
      `;
    },
    build: async ()=>{
      return [
        line("Paciente", $("f_paciente")?.value.trim() || ""),
        line("Nascimento", $("f_nasc")?.value || ""),
        line("Telefone", $("f_tel")?.value.trim() || ""),
        line("Endereço", $("f_end")?.value.trim() || ""),
        block("Motivo da consulta", $("f_motivo")?.value || ""),
        block("Anamnese", $("f_anamnese")?.value || ""),
        block("Planejamento", $("f_plan")?.value || ""),
        block("Procedimentos realizados hoje", $("f_proc")?.value || ""),
      ].join("");
    }
  },

  receita: {
    title:"Receituário",
    sub:"Botões de medicação (1 clique) + campo livre. Salva como rascunho.",
    form: async ()=>{
      const d = await draftLoad("receita");
      const data = d.r_data || todayISO();
      return `
        <label>Nome do paciente</label>
        <input id="r_paciente" value="${esc(d.r_paciente||"")}" />

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="r_cidade" value="${esc(d.r_cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="r_data" type="date" value="${esc(data)}" />
          </div>
        </div>

        <div class="doc-title">Medicações rápidas (1 clique)</div>
        <div class="quickgrid" id="rxGrid">
          ${Object.keys(RX_PRESETS).map(k=>`<button class="btn btn-ghost" type="button" data-rx="${k}">${k}</button>`).join("")}
        </div>

        <p class="small">Clique para inserir a posologia no corpo. Você pode editar.</p>

        <label>Corpo da prescrição (editável)</label>
        <textarea id="r_corpo" placeholder="As medicações escolhidas vão aparecer aqui...">${esc(d.r_corpo||"")}</textarea>

        <label>Outras medicações (digitadas pelo profissional)</label>
        <textarea id="r_extras" placeholder="Espaço livre">${esc(d.r_extras||"")}</textarea>
      `;
    },
    after: ()=>{
      $("formPanel").querySelectorAll("[data-rx]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          appendRxPreset(btn.dataset.rx);
          await draftSave("receita");
          await buildPreview();
        });
      });
    },
    build: async ()=>{
      const paciente = $("r_paciente")?.value.trim() || "";
      const cidade = $("r_cidade")?.value.trim() || "Cidade";
      const data = $("r_data")?.value || todayISO();
      const corpo = $("r_corpo")?.value || "";
      const extras = $("r_extras")?.value || "";
      const full = [corpo.trim(), extras.trim()].filter(Boolean).join("\n\n");

      return [
        line("Paciente", paciente),
        `<div class="doc-title">Prescrição</div>`,
        `<div class="doc-block">${esc(full)}</div>`,
        `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(data)}</p>`
      ].join("");
    }
  },

  recibo: {
    title:"Recibo",
    sub:"Comprovação de pagamento / prestação de serviço.",
    form: async ()=>{
      const d = await draftLoad("recibo");
      const data = d.rc_data || todayISO();
      return `
        <label>Nome do pagador (paciente)</label>
        <input id="rc_pagador" value="${esc(d.rc_pagador||"")}" />

        <div class="row">
          <div>
            <label>Valor recebido (R$)</label>
            <input id="rc_valor" type="number" step="0.01" value="${esc(d.rc_valor||"")}" placeholder="Ex.: 150.00" />
          </div>
          <div>
            <label>Forma de pagamento</label>
            <input id="rc_forma" value="${esc(d.rc_forma||"")}" placeholder="PIX / dinheiro / cartão" />
          </div>
        </div>

        <label>Referente a</label>
        <input id="rc_referente" value="${esc(d.rc_referente||"")}" placeholder="Ex.: Consulta / Procedimento" />

        <label>Observações (opcional)</label>
        <textarea id="rc_obs">${esc(d.rc_obs||"")}</textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="rc_cidade" value="${esc(d.rc_cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="rc_data" type="date" value="${esc(data)}" />
          </div>
        </div>
      `;
    },
    build: async ()=>{
      const pagador = $("rc_pagador")?.value.trim() || "";
      const valor = $("rc_valor")?.value || "";
      const referente = $("rc_referente")?.value.trim() || "";
      const forma = $("rc_forma")?.value.trim() || "";
      const cidade = $("rc_cidade")?.value.trim() || "Cidade";
      const data = $("rc_data")?.value || todayISO();
      const valorFmt = valor ? Number(valor).toFixed(2) : "0.00";

      return [
        `<div class="doc-title">Declaração de Recibo</div>`,
        `<p class="doc-line">Recebi de <strong>${esc(pagador)}</strong> a quantia de <strong>R$ ${esc(valorFmt)}</strong>.</p>`,
        referente ? `<p class="doc-line"><strong>Referente a:</strong> ${esc(referente)}</p>` : "",
        forma ? `<p class="doc-line"><strong>Forma de pagamento:</strong> ${esc(forma)}</p>` : "",
        block("Observações", $("rc_obs")?.value || ""),
        `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(data)}</p>`
      ].join("");
    }
  },

  laudo: {
    title:"Laudo",
    sub:"Relatório estruturado com conclusão.",
    form: async ()=>{
      const d = await draftLoad("laudo");
      const data = d.l_data || todayISO();
      return `
        <label>Nome do paciente</label>
        <input id="l_paciente" value="${esc(d.l_paciente||"")}" />

        <label>Título</label>
        <input id="l_titulo" value="${esc(d.l_titulo||"")}" placeholder="Ex.: Laudo clínico / radiográfico" />

        <label>Descrição detalhada</label>
        <textarea id="l_desc">${esc(d.l_desc||"")}</textarea>

        <label>Conclusão / Impressão diagnóstica</label>
        <textarea id="l_conc">${esc(d.l_conc||"")}</textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="l_cidade" value="${esc(d.l_cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="l_data" type="date" value="${esc(data)}" />
          </div>
        </div>
      `;
    },
    build: async ()=>{
      const paciente = $("l_paciente")?.value.trim() || "";
      const cidade = $("l_cidade")?.value.trim() || "Cidade";
      const data = $("l_data")?.value || todayISO();
      return [
        line("Paciente", paciente),
        line("Título", $("l_titulo")?.value.trim() || ""),
        block("Descrição detalhada", $("l_desc")?.value || ""),
        block("Conclusão / Impressão diagnóstica", $("l_conc")?.value || ""),
        `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(data)}</p>`
      ].join("");
    }
  },

  atestado: {
    title:"Atestado",
    sub:"Justificativa e dias de afastamento (opcional).",
    form: async ()=>{
      const d = await draftLoad("atestado");
      const data = d.a_data || todayISO();
      return `
        <label>Nome do paciente</label>
        <input id="a_paciente" value="${esc(d.a_paciente||"")}" />

        <label>Dias de afastamento (opcional)</label>
        <input id="a_dias" type="number" min="0" step="1" value="${esc(d.a_dias||"")}" placeholder="Ex.: 2" />

        <label>Texto do atestado</label>
        <textarea id="a_desc" placeholder="Ex.: Necessita afastamento de suas atividades por motivo de saúde.">${esc(d.a_desc||"")}</textarea>

        <div class="row">
          <div>
            <label>Cidade</label>
            <input id="a_cidade" value="${esc(d.a_cidade||"")}" />
          </div>
          <div>
            <label>Data</label>
            <input id="a_data" type="date" value="${esc(data)}" />
          </div>
        </div>
      `;
    },
    build: async ()=>{
      const paciente = $("a_paciente")?.value.trim() || "";
      const cidade = $("a_cidade")?.value.trim() || "Cidade";
      const data = $("a_data")?.value || todayISO();
      const diasRaw = $("a_dias")?.value || "";
      const dias = diasRaw ? Number(diasRaw) : null;

      return [
        line("Paciente", paciente),
        (dias && !Number.isNaN(dias) && dias > 0) ? `<p class="doc-line"><strong>Afastamento:</strong> ${dias} dia(s).</p>` : "",
        block("Atestado", $("a_desc")?.value || ""),
        `<p class="doc-line"><strong>${esc(cidade)}</strong>, ${esc(data)}</p>`
      ].join("");
    }
  },

  backup: {
    title:"Backup",
    sub:"Exporta tudo (JSON) e restaura. Segurança total da sua memória.",
    form: async ()=>{
      return `
        <div class="actions left">
          <button class="btn btn-primary" id="btnBackup" type="button">Exportar backup (JSON)</button>
          <label class="btn btn-ghost" style="cursor:pointer;">
            Restaurar (JSON)
            <input id="fileRestore" type="file" accept="application/json" style="display:none;">
          </label>
        </div>

        <p class="small">
          Backup inclui: profissional, rascunhos dos formulários e agenda completa.
        </p>
      `;
    },
    after: ()=>{
      $("btnBackup").onclick = async ()=>{
        const payload = await exportAll();
        downloadFile(`btx_backup_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
        toast("Backup gerado ✅");
      };

      $("fileRestore").onchange = async (e)=>{
        const f = e.target.files?.[0];
        if(!f) return;
        const text = await f.text();
        let obj;
        try{ obj = JSON.parse(text); }catch{ return alert("JSON inválido."); }
        await restoreAll(obj);
        toast("Backup restaurado ✅");
        await renderTab("agenda");
      };
    },
    build: async ()=>{
      const prof = await loadProf();
      const agenda = await all("agenda");
      return `
        <div class="doc-title">Resumo</div>
        ${line("Profissional", prof?.nome || "—")}
        ${line("Itens na agenda", String(agenda.length))}
        <p class="doc-line">Use os botões para exportar/restaurar.</p>
      `;
    }
  }
};

async function renderTab(tab){
  currentTab = tab;
  document.querySelectorAll(".tabbtn").forEach(b=> b.classList.toggle("active", b.dataset.tab === tab));

  const T = TABS[tab];
  setHeader(T.title, T.sub);

  $("formPanel").innerHTML = await T.form();

  attachDraftAutosave(tab);

  if(typeof T.after === "function") T.after();

  await buildPreview();
}

async function buildPreview(opts){
  $("pvMeta").textContent = nowBR();
  const T = TABS[currentTab];
  $("pvTitle").textContent = T.title;
  $("pvSub").textContent = T.sub;
  await updateProfUI();
  $("pvBody").innerHTML = await T.build(opts);
}

/* ---------------------------
   Botões gerais
----------------------------*/
$("btnPrint").addEventListener("click", async ()=>{
  await buildPreview();
  window.print();
});

$("btnBaixar").addEventListener("click", async ()=>{
  await buildPreview();
  // baixa o conteúdo do relatório em HTML (leve e funciona sempre)
  downloadFile("btx_relatorio.html", $("paper").outerHTML, "text/html");
  toast("Baixado ✅");
});

$("btnLimparForm").addEventListener("click", async ()=>{
  $("formPanel").querySelectorAll("input,textarea,select").forEach(el=>{
    if(el.type === "file") return;
    if(el.type === "date") el.value = todayISO();
    else el.value = "";
  });
  await draftSave(currentTab);
  toast("Form limpo ✅");
  await buildPreview();
});

$("btnZerarTudo").addEventListener("click", async ()=>{
  if(!confirm("Tem certeza? Isso apaga tudo deste aparelho.")) return;

  // limpa stores
  const stores = ["kv","agenda","docs"];
  for(const s of stores){
    const items = await all(s);
    for(const it of items) await del(s, it.id);
  }

  toast("Tudo zerado ✅");
  await renderTab("agenda");
});

$("btnHardRefresh").addEventListener("click", async ()=>{
  try{
    const keys = await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    toast("Cache limpo ✅ Feche e abra o app.");
  }catch{
    toast("Não consegui limpar cache aqui.");
  }
});

/* ---------------------------
   Backup / Restore
----------------------------*/
async function exportAll(){
  const kvProf = await kvGet("prof", null);

  // exporta também todos drafts (um por tab)
  const drafts = {};
  for(const k of ["agenda","ficha","receita","recibo","laudo","atestado"]){
    drafts[k] = await kvGet(`draft_${k}`, {});
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    prof: kvProf,
    drafts,
    agenda: await all("agenda"),
  };
}

async function restoreAll(obj){
  if(obj?.prof !== undefined) await kvSet("prof", obj.prof);

  if(obj?.drafts){
    for(const [k,v] of Object.entries(obj.drafts)){
      await kvSet(`draft_${k}`, v);
    }
  }

  if(Array.isArray(obj?.agenda)){
    for(const it of obj.agenda){
      // garante id
      if(!it.id) it.id = uid();
      await put("agenda", it);
    }
  }
}

/* ---------------------------
   Init
----------------------------*/
document.querySelectorAll(".tabbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>renderTab(btn.dataset.tab));
});

setProfToInputs(await loadProf());
await updateProfUI();
await renderTab("agenda");
