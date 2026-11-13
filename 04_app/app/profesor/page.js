"use client";
import { useState } from "react";
import { Aviso, Barra, Campo, llamar, Resultado, useDatos, useYo } from "../_components/ui";
import { ListaReportes, Perfil, Resumen } from "../_components/ficha";
import { MisSolicitudes } from "../_components/solicitudes";
import { BuscadorEstudiantes } from "../_components/buscador";

const CAMPOS_REPORTE = ["academic_period", "subject", "evaluation", "exam_score", "previous_exam_score", "attendance_percentage",
  "assignment_completion_rate", "study_hours_per_day", "sleep_hours"];
const TEXTO = ["academic_period", "subject", "evaluation"];
// Valores del reporte como texto para el formulario (los numeric de PostgreSQL llegan como "90.00" -> "90").
const aTexto = (r) => Object.fromEntries([...CAMPOS_REPORTE, "comments"].map((c) => {
  const v = r[c];
  if (v === null || v === undefined) return [c, ""];
  return [c, TEXTO.includes(c) || c === "comments" ? String(v) : String(Number(v))];
}));

export default function PanelProfesor() {
  const yo = useYo();
  const [tab, setTab] = useState("estudiantes");
  const [sel, setSel] = useState(null);
  const [version, setVersion] = useState(0);

  return (
    <>
      <Barra usuario={yo} />
      <main className="wrap">
        <div className="tabs" role="tablist">
          {[["estudiantes", "Estudiantes y reportes"], ["solicitudes", "Mis solicitudes"]].map(([k, t]) => (
            <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t}</button>
          ))}
        </div>
        {tab === "estudiantes" && (sel
          ? <FichaProfesor id={sel} volver={() => setSel(null)} alSolicitar={() => setVersion((v) => v + 1)} />
          : <BuscadorEstudiantes elegir={setSel} />)}
        {tab === "solicitudes" && <MisSolicitudes version={version} />}
      </main>
    </>
  );
}

function FichaProfesor({ id, volver, alSolicitar }) {
  const { datos, recargar } = useDatos(`/api/students/${id}`);
  const [nuevo, setNuevo] = useState(false);
  if (!datos) return <p className="muted">Cargando…</p>;
  if (!datos.ok) return <><button className="btn ghost" onClick={volver}>← Volver</button><Resultado r={datos} /></>;
  const { perfil, reportes } = datos;
  return (
    <>
      <button className="btn ghost" onClick={volver}>← Volver a la búsqueda</button>
      <h1 style={{ marginTop: 8 }}>{perfil.full_name || perfil.student_id} <span className="muted small">{perfil.student_id}</span></h1>
      <Resumen reportes={reportes} />
      <section className="card">
        <div className="card-head">
          <h2>Reportes académicos</h2><div className="spacer" />
          <button className="btn" onClick={() => setNuevo(!nuevo)}>{nuevo ? "Cerrar" : "+ Subir reporte"}</button>
        </div>
        {nuevo && <NuevoReporte studentId={perfil.student_id} listo={() => { setNuevo(false); recargar(); }} />}
        <ListaReportes reportes={reportes} acciones={(r) => !r.pendiente && <AccionesReporte r={r} listo={() => { recargar(); alSolicitar(); }} />} />
      </section>
      <section className="card"><h2>Datos del estudiante</h2><Perfil perfil={perfil} /></section>
    </>
  );
}

function FormReporte({ f, setF }) {
  return (
    <>
      <div className="grid">
        {CAMPOS_REPORTE.map((c) => (
          <Campo key={c} name={c} v={f} set={setF} type={TEXTO.includes(c) ? "text" : "number"}
            label={c === "exam_score" ? "Nota (0-100) *" : undefined}
            placeholder={{ academic_period: "Ej: 2026-1", subject: "Ej: Matemáticas", evaluation: "Ej: Parcial 1" }[c]} />
        ))}
      </div>
      <div style={{ marginTop: 12 }}><Campo name="comments" area v={f} set={setF} /></div>
    </>
  );
}

function NuevoReporte({ studentId, listo }) {
  const [f, setF] = useState({ academic_period: "", subject: "", evaluation: "", exam_score: "", comments: "" });
  const [r, setR] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    const res = await llamar("/api/records", "POST", { ...f, student_id: studentId });
    setEnviando(false); setR(res);
    if (res.ok) setTimeout(listo, 900);
  };
  return (
    <form className="sub" onSubmit={enviar} style={{ marginBottom: 16 }}>
      <h3>Nuevo reporte para {studentId}</h3>
      <FormReporte f={f} setF={setF} />
      <div className="actions"><button className="btn" disabled={enviando}>{enviando ? "Guardando…" : "Guardar reporte"}</button></div>
      <Resultado r={r} />
    </form>
  );
}

/** Modificar o eliminar un reporte = crear una solicitud con razón para que la apruebe un administrativo. */
function AccionesReporte({ r: rep, listo }) {
  const [modo, setModo] = useState(null); // null | "update" | "delete"
  const [f, setF] = useState(() => aTexto(rep));
  const [razon, setRazon] = useState("");
  const [r, setR] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    const original = aTexto(rep);
    const changes = modo === "update"
      ? Object.fromEntries(Object.keys(f).filter((c) => f[c] !== original[c]).map((c) => [c, f[c]])) : {};
    if (modo === "update" && !Object.keys(changes).length) return setR({ ok: false, mensaje: "No modificaste ningún campo" });
    const res = await llamar("/api/requests", "POST", { entity_type: "record", entity_id: String(rep.record_id), action: modo, changes, reason: razon });
    setR(res);
    if (res.ok) setTimeout(() => { setModo(null); listo(); }, 1200);
  };

  if (!modo) return (
    <div className="actions">
      <button className="btn sec sm" onClick={() => { setModo("update"); setF(aTexto(rep)); setR(null); }}>Solicitar modificación</button>
      <button className="btn sec sm" onClick={() => { setModo("delete"); setR(null); }}>Solicitar eliminación</button>
    </div>
  );
  return (
    <form className="sub" onSubmit={enviar}>
      <Aviso tipo={modo === "delete" ? "warn" : "info"} titulo={modo === "delete" ? "Solicitar eliminación de este reporte" : "Solicitar modificación de este reporte"}>
        El cambio se aplicará solo cuando un administrativo lo apruebe.
      </Aviso>
      {modo === "update" && <div style={{ marginTop: 12 }}><FormReporte f={f} setF={setF} /></div>}
      <div style={{ marginTop: 12 }}>
        <Campo name="razon" label="Razón del cambio (obligatoria, mínimo 10 caracteres)" area v={{ razon }} set={(o) => setRazon(o.razon)} required minLength={10} />
      </div>
      <div className="actions">
        <button className={`btn ${modo === "delete" ? "danger" : ""}`}>Enviar solicitud</button>
        <button type="button" className="btn sec" onClick={() => setModo(null)}>Cancelar</button>
      </div>
      <Resultado r={r} />
    </form>
  );
}
