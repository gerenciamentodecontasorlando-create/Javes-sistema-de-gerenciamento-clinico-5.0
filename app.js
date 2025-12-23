import { openDB, save, getAll } from "./db.js";

const $ = (id) => document.getElementById(id);

function uid() {
  return crypto.randomUUID();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ===== INIT ===== */
let DB;

openDB().then((db) => {
  DB = db;
  renderAgendaHoje();
});

/* ===== PROFISSIONAL (localStorage simples) ===== */
const PROF_KEY = "btx_profissional";

$("btnSalvarProf").onclick = () => {
  const prof = {
    nome: $("profNome").value,
    esp: $("profEsp").value,
    conselho: $("profConselho").value,
    reg: $("profReg").value,
    end: $("profEnd").value,
    tel: $("profTel").value,
    email: $("profEmail").value
  };
  localStorage.setItem(PROF_KEY, JSON.stringify(prof));
  toast("Profissional salvo");
};

/* ===== AGENDA ===== */
$("btnAgSalvar").onclick = async () => {
  const item = {
    id: uid(),
    data: $("ag_data").value || todayISO(),
    hora: $("ag_hora").value,
    paciente: $("ag_paciente").value,
    tipo: $("ag_tipo").value,
    status: $("ag_status").value,
    obs: $("ag_obs").value
  };

  if (!item.paciente) {
    alert("Informe o paciente");
    return;
  }

  await save("agenda", item);
  toast("Agendamento salvo");
  renderAgendaHoje();
};

async function renderAgendaHoje() {
  const list = await getAll("agenda");
  const hoje = todayISO();

  const body = list
    .filter(a => a.data === hoje)
    .map(a => `
      <tr>
        <td>${a.hora}</td>
        <td>${a.paciente}</td>
        <td>${a.tipo}</td>
        <td>${a.status}</td>
        <td>${a.obs || ""}</td>
      </tr>
    `)
    .join("");

  $("pvBody").innerHTML = body
    ? `<table>
        <tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Obs</th></tr>
        ${body}
      </table>`
    : "<p>Nenhum atendimento hoje.</p>";
}

/* ===== PRONTUÁRIO ===== */
window.salvarProntuario = async () => {
  const pront = {
    id: uid(),
    paciente: $("f_paciente").value,
    data: todayISO(),
    motivo: $("f_motivo").value,
    anamnese: $("f_anamnese").value,
    plano: $("f_plan").value,
    procedimentos: $("f_proc").value
  };

  await save("prontuario", pront);
  toast("Prontuário salvo");
};

/* ===== EXPORTAÇÃO ===== */
window.exportarTudo = async () => {
  const dados = {
    profissional: JSON.parse(localStorage.getItem(PROF_KEY) || "{}"),
    agenda: await getAll("agenda"),
    prontuario: await getAll("prontuario")
  };

  const blob = new Blob([JSON.stringify(dados, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "btx-backup.json";
  a.click();
};
