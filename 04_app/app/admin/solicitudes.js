"use client";
import { useState } from "react";
import { Diferencias, Estado, fecha, fmt, llamar, Paginador, Resultado, useDatos } from "../_components/ui";

const FILTROS = [["pending", "Pendientes"], ["approved", "Aprobadas"], ["rejected", "Rechazadas"], ["cancelled", "Canceladas"], ["", "Todas"]];

export function Solicitudes({ alResolver, verHistorial }) {
  const [estado, setEstado] = useState("pending");
  const [page, setPage] = useState(1);
  const { datos, recargar } = useDatos(`/api/requests?status=${estado}&page=${page}&size=10`);
  const lista = datos?.solicitudes || [];
  return (
    <section className="card">
      <div className="card-head">
        <h2>Solicitudes de cambio</h2><div className="spacer" />
        <select className="in" style={{ width: "auto", marginTop: 0 }} value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          {FILTROS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      {datos && !datos.ok && <Resultado r={datos} />}
      {datos?.ok && !lista.length && <p className="muted">No hay solicitudes {estado === "pending" ? "pendientes" : "en este filtro"}.</p>}
      {lista.map((s) => <Tarjeta key={s.request_id} s={s} verHistorial={verHistorial} listo={() => { recargar(); alResolver(); }} />)}
      {datos?.ok && <Paginador page={page} size={10} total={datos.total} set={setPage} />}
    </section>
  );
}

function Tarjeta({ s, listo, verHistorial }) {
  const [comentario, setComentario] = useState("");
  const [r, setR] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const resolver = async (decision) => {
    if (decision === "reject" && comentario.trim().length < 5) return setR({ ok: false, mensaje: "Escribe el motivo del rechazo (mínimo 5 caracteres)" });
    if (decision === "approve" && s.action === "delete" && !window.confirm(`Aprobar eliminará definitivamente el reporte #${s.entity_id}. ¿Continuar?`)) return;
    setEnviando(true);
    const res = await llamar(`/api/requests/${s.request_id}`, "POST", { decision, comment: comentario });
    setEnviando(false); setR(res);
    if (res.ok) setTimeout(listo, 1000);
  };
  const objetivo = s.entity_type === "record"
    ? <>reporte <b>#{s.entity_id}</b> de <b>{s.student_id || "?"}</b>{s.subject && <> · {s.academic_period} · {s.subject} · {s.evaluation}</>}</>
    : <>perfil de <b>{s.entity_id}</b></>;

  return (
    <div className="report">
      <div className="report-head">
        <span className="title">#{s.request_id} · {fmt(s.action)} {objetivo}</span>
        <Estado s={s.status} />
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => verHistorial(s.entity_type, s.entity_id)}>Historial</button>
      </div>
      <div className="small muted">Solicitada por {s.solicitante} ({fmt(s.solicitante_rol)}, {s.solicitante_email}) · {fecha(s.created_at)}</div>
      <p style={{ margin: "8px 0" }}><span className="muted small">Razón:</span> {s.reason}</p>
      <Diferencias sol={s} />
      {s.reviewed_at && (
        <p className="small" style={{ margin: "8px 0 0" }}>
          <span className="muted">{fmt(s.status)} por {s.revisor} · {fecha(s.reviewed_at)}</span>{s.review_comment && <> · “{s.review_comment}”</>}
        </p>
      )}
      {s.status === "pending" && (
        <div className="sub">
          <label className="f">Comentario (obligatorio si rechazas)
            <textarea className="in" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn ok" disabled={enviando} onClick={() => resolver("approve")}>Aprobar y aplicar</button>
            <button className="btn danger" disabled={enviando} onClick={() => resolver("reject")}>Rechazar</button>
          </div>
        </div>
      )}
      <Resultado r={r} />
    </div>
  );
}
