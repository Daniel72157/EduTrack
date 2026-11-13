"use client";
import { useState } from "react";
import { Diferencias, Estado, fecha, fmt, llamar, Paginador, Resultado, useDatos } from "./ui";

/** Solicitudes creadas por el usuario actual (profesor o estudiante), con opción de cancelar las pendientes. */
export function MisSolicitudes({ version = 0, alCambiar }) {
  const [page, setPage] = useState(1);
  const { datos, recargar } = useDatos(`/api/requests?page=${page}&size=10&v=${version}`);
  const [r, setR] = useState(null);
  const cancelar = async (id) => {
    if (!window.confirm(`¿Cancelar la solicitud #${id}?`)) return;
    const res = await llamar(`/api/requests/${id}`, "POST", { decision: "cancel" });
    setR(res); recargar(); alCambiar?.();
  };
  const lista = datos?.solicitudes || [];
  return (
    <section className="card">
      <div className="card-head"><h2>Mis solicitudes de cambio</h2></div>
      <Resultado r={r} />
      {!lista.length && <p className="muted">No has enviado solicitudes.</p>}
      {lista.map((s) => (
        <div key={s.request_id} className="report">
          <div className="report-head">
            <span className="title">#{s.request_id} · {fmt(s.action)} {s.entity_type === "record" ? `reporte #${s.entity_id}` : "mi perfil"}</span>
            <Estado s={s.status} />
            <div className="spacer" />
            <span className="small muted">{fecha(s.created_at)}</span>
          </div>
          {s.entity_type === "record" && s.subject && <div className="small muted">{s.student_id} · {s.academic_period} · {s.subject} · {s.evaluation}</div>}
          <p className="small" style={{ margin: "8px 0" }}><span className="muted">Razón:</span> {s.reason}</p>
          <Diferencias sol={s} />
          {s.reviewed_at && (
            <p className="small" style={{ margin: "8px 0 0" }}>
              <span className="muted">Revisada por {s.revisor} · {fecha(s.reviewed_at)}</span>
              {s.review_comment && <> · “{s.review_comment}”</>}
            </p>
          )}
          {s.status === "pending" && <div className="actions"><button className="btn sec sm" onClick={() => cancelar(s.request_id)}>Cancelar solicitud</button></div>}
        </div>
      ))}
      {datos && <Paginador page={page} size={10} total={datos.total} set={setPage} />}
    </section>
  );
}
