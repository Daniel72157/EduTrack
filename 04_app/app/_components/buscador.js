"use client";
import { useState } from "react";
import { fmt, Paginador, Resultado, useDatos } from "./ui";

/** Busca estudiantes por ID, nombre o correo; `elegir(student_id)` al hacer clic en una fila. */
export function BuscadorEstudiantes({ elegir }) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState({ q: "", conCuenta: true, page: 1 });
  const url = `/api/students?q=${encodeURIComponent(filtro.q)}&page=${filtro.page}&size=15${filtro.conCuenta ? "&con_cuenta=1" : ""}`;
  const { datos, cargando } = useDatos(url);
  const buscar = (e) => { e.preventDefault(); setFiltro({ ...filtro, q: texto.trim(), page: 1 }); };

  return (
    <section className="card">
      <div className="card-head"><h2>Buscar estudiante</h2></div>
      <form className="row" onSubmit={buscar}>
        <label className="f grow">ID (STU_000001), nombre o correo
          <input className="in" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe y pulsa Buscar" />
        </label>
        <button className="btn" disabled={cargando}>{cargando ? "Buscando…" : "Buscar"}</button>
      </form>
      <label className="small" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
        <input type="checkbox" checked={filtro.conCuenta} onChange={(e) => setFiltro({ ...filtro, conCuenta: e.target.checked, page: 1 })} />
        Solo estudiantes con cuenta en la plataforma
      </label>
      {datos && !datos.ok && <Resultado r={datos} />}
      {datos?.ok && (datos.estudiantes.length ? (
        <>
          <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
            <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Nivel</th><th>Reportes</th><th>Promedio</th></tr></thead>
            <tbody>{datos.estudiantes.map((s) => (
              <tr key={s.student_id} className="clickable" onClick={() => elegir(s.student_id)} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && elegir(s.student_id)}>
                <td><b>{s.student_id}</b></td><td>{s.full_name || <span className="muted">sin cuenta</span>}</td><td>{s.email || "—"}</td>
                <td>{fmt(s.education_level)}</td><td>{s.reportes}</td><td>{s.promedio ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <Paginador page={filtro.page} size={15} total={datos.total} set={(p) => setFiltro({ ...filtro, page: p })} />
        </>
      ) : <p className="muted" style={{ marginTop: 12 }}>No se encontraron estudiantes{filtro.conCuenta ? " con cuenta. Desmarca el filtro para buscar en todo el dataset." : "."}</p>)}
    </section>
  );
}
