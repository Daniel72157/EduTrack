"use client";
import { ETIQ, fecha, fmt, Insignia, KV } from "./ui";

export const PERFIL_CAMPOS = ["student_id", "full_name", "email", "age", "gender", "education_level", "school_type", "urban_rural",
  "family_income", "parent_education", "internet_access", "device_availability"];
const DETALLE = ["previous_exam_score", "attendance_percentage", "assignment_completion_rate", "study_hours_per_day", "sleep_hours"];

/** Resumen numérico de los reportes de un estudiante. */
export function Resumen({ reportes }) {
  const n = reportes.length;
  const prom = n ? reportes.reduce((s, r) => s + Number(r.exam_score), 0) / n : 0;
  const aprob = reportes.filter((r) => r.pass_status === "Pass").length;
  const periodos = new Set(reportes.map((r) => r.academic_period)).size;
  return (
    <div className="tiles">
      <div className="tile"><div className="v">{n}</div><div className="l">Reportes académicos</div></div>
      <div className="tile"><div className="v">{n ? prom.toFixed(1) : "—"}</div><div className="l">Promedio de notas</div></div>
      <div className="tile"><div className="v">{n ? `${Math.round((100 * aprob) / n)}%` : "—"}</div><div className="l">Evaluaciones aprobadas</div></div>
      <div className="tile"><div className="v">{periodos}</div><div className="l">Periodos</div></div>
    </div>
  );
}

/** Un reporte académico. `acciones` se dibuja debajo (botones del profesor, etc.). */
export function Reporte({ r, children }) {
  const detalle = DETALLE.filter((c) => r[c] !== null && r[c] !== undefined);
  return (
    <div className="report">
      <div className="report-head">
        <span className="title">{r.subject} · {r.evaluation}</span>
        <Insignia nota={r.exam_score} grado={r.performance_grade} />
        <span className="pill">{fmt(r.pass_status)}</span>
        <span className="pill">Nivel {fmt(r.performance_level)}</span>
        {r.pendiente && <span className="pill pending">Cambio pendiente de aprobación ({fmt(r.pendiente.action)})</span>}
        <div className="spacer" />
        <span className="small muted">#{r.record_id}</span>
      </div>
      {detalle.length > 0 && (
        <div className="small" style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {detalle.map((c) => <span key={c}><span className="muted">{ETIQ[c]}:</span> {Number(r[c])}</span>)}
        </div>
      )}
      {r.comments && <p className="small" style={{ margin: "8px 0 0" }}><span className="muted">Observaciones:</span> {r.comments}</p>}
      <div className="small muted" style={{ marginTop: 6 }}>
        {r.profesor ? `Subido por ${r.profesor}` : "Importado del dataset"} · {fecha(r.created_at)}
        {r.updated_at && ` · modificado ${fecha(r.updated_at)}`}
      </div>
      {children}
    </div>
  );
}

/** Reportes agrupados por periodo (más reciente primero). */
export function ListaReportes({ reportes, acciones }) {
  if (!reportes.length) return <p className="muted">Aún no hay reportes académicos.</p>;
  const grupos = reportes.reduce((g, r) => ((g[r.academic_period] ||= []).push(r), g), {});
  return Object.entries(grupos).map(([periodo, lista]) => (
    <div key={periodo} style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 0 }}>Periodo {periodo} <span className="muted small">({lista.length})</span></h3>
      {lista.map((r) => <Reporte key={r.record_id} r={r}>{acciones?.(r)}</Reporte>)}
    </div>
  ));
}

export function Perfil({ perfil }) {
  return <KV datos={perfil} campos={PERFIL_CAMPOS} />;
}
