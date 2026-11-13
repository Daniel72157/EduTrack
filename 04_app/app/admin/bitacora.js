"use client";
import { Fragment, useState } from "react";
import { fecha, fmt, Paginador, Resultado, useDatos } from "../_components/ui";

export const ACCIONES = [
  ["", "Todas las acciones"],
  ["sesion.", "Sesiones (todas)"], ["sesion.iniciada", "Inicio de sesión"], ["sesion.fallida", "Inicio de sesión fallido"],
  ["sesion.bloqueada", "Bloqueo por intentos"], ["sesion.cerrada", "Cierre de sesión"], ["clave.cambiada", "Cambio de contraseña"],
  ["estudiante.consultado", "Consulta de ficha"], ["estudiantes.buscados", "Búsqueda de estudiantes"], ["estudiante.creado", "Ficha creada"],
  ["reporte.", "Reportes (todos)"], ["reporte.creado", "Reporte creado"], ["reporte.modificado", "Reporte modificado"], ["reporte.eliminado", "Reporte eliminado"],
  ["perfil.modificado", "Perfil modificado"],
  ["solicitud.", "Solicitudes (todas)"], ["solicitud.creada", "Solicitud creada"], ["solicitud.aprobada", "Solicitud aprobada"],
  ["solicitud.rechazada", "Solicitud rechazada"], ["solicitud.cancelada", "Solicitud cancelada"],
  ["usuario.", "Cuentas (todas)"], ["usuario.creado", "Cuenta creada"], ["usuario.actualizado", "Cuenta actualizada"],
  ["acceso.denegado", "Acceso denegado"], ["logs.", "Consultas a la bitácora"], ["demo.rechazo", "Prueba de integridad"],
];
const EXTRA = { "logs.consultados": "Bitácora consultada", "logs.exportados": "Bitácora exportada" };
const NOMBRE = { ...Object.fromEntries(ACCIONES), ...EXTRA };
const VACIO = { action: "", email: "", role: "", entity_type: "", entity_id: "", from: "", to: "" };

export function Bitacora({ inicial = {} }) {
  const [f, setF] = useState({ ...VACIO, ...inicial });
  const [aplicado, setAplicado] = useState({ ...VACIO, ...inicial });
  const [page, setPage] = useState(1);
  const [abierto, setAbierto] = useState(null);
  const qs = new URLSearchParams(Object.entries(aplicado).filter(([, v]) => v)).toString();
  const { datos, cargando } = useDatos(`/api/logs?${qs}&page=${page}&size=50`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <section className="card">
      <div className="card-head">
        <h2>Bitácora de auditoría</h2><div className="spacer" />
        <a className="btn sec sm" href={`/api/logs?${qs}&format=csv`}>Exportar CSV</a>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>Registro inmutable de todo lo que ocurre en la plataforma: quién, qué, cuándo, desde dónde y con qué datos.</p>
      <form onSubmit={(e) => { e.preventDefault(); setAplicado(f); setPage(1); }}>
        <div className="grid">
          <label className="f">Acción<select className="in" value={f.action} onChange={set("action")}>{ACCIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          <label className="f">Correo del usuario<input className="in" value={f.email} onChange={set("email")} /></label>
          <label className="f">Rol<select className="in" value={f.role} onChange={set("role")}>
            <option value="">Todos</option><option value="student">Estudiante</option><option value="teacher">Profesor</option><option value="admin">Administrativo</option></select></label>
          <label className="f">Tipo de elemento<select className="in" value={f.entity_type} onChange={set("entity_type")}>
            <option value="">Todos</option><option value="record">Reporte</option><option value="student">Estudiante</option><option value="user">Cuenta</option><option value="request">Solicitud</option></select></label>
          <label className="f">ID del elemento<input className="in" value={f.entity_id} onChange={set("entity_id")} placeholder="STU_000001 o 123" /></label>
          <label className="f">Desde<input className="in" type="date" value={f.from} onChange={set("from")} /></label>
          <label className="f">Hasta<input className="in" type="date" value={f.to} onChange={set("to")} /></label>
        </div>
        <div className="actions">
          <button className="btn" disabled={cargando}>Filtrar</button>
          <button type="button" className="btn sec" onClick={() => { setF(VACIO); setAplicado(VACIO); setPage(1); }}>Limpiar</button>
        </div>
      </form>
      {datos && !datos.ok && <Resultado r={datos} />}
      {datos?.ok && (
        <>
          <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Elemento</th><th>IP</th></tr></thead>
            <tbody>{datos.logs.map((l) => (
              <Fragment key={l.log_id}>
                <tr className="clickable" onClick={() => setAbierto(abierto === l.log_id ? null : l.log_id)}>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{fecha(l.at)}</td>
                  <td>{l.user_email || "—"}<div className="small muted">{fmt(l.user_role)}</div></td>
                  <td><span className={`pill ${/fallida|denegado|bloqueada|rechazada|eliminado/.test(l.action) ? "rejected" : /aprobada|modificado|creado/.test(l.action) ? "approved" : ""}`}>{NOMBRE[l.action] || l.action}</span></td>
                  <td className="small">{l.entity_type ? `${fmt(l.entity_type)} ${l.entity_id}` : "—"}</td>
                  <td className="small muted">{l.ip || "—"}</td>
                </tr>
                {abierto === l.log_id && (
                  <tr><td colSpan={5}>
                    <div className="small muted">#{l.log_id} · {l.action} · {l.user_agent || "sin user-agent"}</div>
                    {l.details ? <pre className="json">{JSON.stringify(l.details, null, 2)}</pre> : <span className="small muted">Sin detalles</span>}
                  </td></tr>
                )}
              </Fragment>
            ))}</tbody>
          </table></div>
          {!datos.logs.length && <p className="muted">No hay eventos con esos filtros.</p>}
          <Paginador page={page} size={50} total={datos.total} set={setPage} />
        </>
      )}
    </section>
  );
}
