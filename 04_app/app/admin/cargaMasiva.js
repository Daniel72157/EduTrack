"use client";
import { useState } from "react";
import { Aviso, llamar, Resultado } from "../_components/ui";

const EJEMPLO = "student_id,full_name,email\nSTU_000010,Camila Torres,camila.torres@colegio.edu\nSTU_000011,Andrés Gómez,andres.gomez@colegio.edu";

function descargar(nombre, texto) {
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click(); URL.revokeObjectURL(url);
}
const celda = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));

/** Crea muchas cuentas de estudiante de una vez a partir de una lista (código, nombre, correo). */
export function CargaMasiva({ listo }) {
  const [texto, setTexto] = useState("");
  const [r, setR] = useState(null);
  const [ocupado, setOcupado] = useState("");

  const leerArchivo = async (e) => { const f = e.target.files?.[0]; if (f) { setTexto(await f.text()); setR(null); } };
  const enviar = async (dry_run) => {
    setOcupado(dry_run ? "validar" : "crear"); setR(null);
    const res = await llamar("/api/users/bulk", "POST", { csv: texto, dry_run });
    setR(res); setOcupado("");
    if (res.ok && !dry_run) listo();
  };
  const credenciales = () => descargar("credenciales.csv",
    ["student_id,nombre,correo,contraseña_temporal", ...r.creadas.map((c) => [c.student_id, c.full_name, c.email, c.password].map(celda).join(","))].join("\n"));

  return (
    <div className="sub" style={{ marginBottom: 16 }}>
      <h3>Carga masiva de cuentas de estudiantes</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Pega la lista o sube un CSV con las columnas <code>código, nombre, correo</code> (máximo 100 filas). Las filas con problemas no se crean:
        quedan en una lista de pendientes con el motivo. Si cargas la misma lista otra vez, no se duplica nada.
      </p>
      <label className="f">Lista de estudiantes
        <textarea className="in" style={{ minHeight: 130, fontFamily: "ui-monospace, monospace", fontSize: 13 }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={EJEMPLO} />
      </label>
      <div className="actions">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={leerArchivo} aria-label="Subir archivo CSV" />
        <button type="button" className="btn sec" disabled={!texto.trim() || !!ocupado} onClick={() => enviar(true)}>{ocupado === "validar" ? "Validando…" : "Validar sin crear"}</button>
        <button type="button" className="btn" disabled={!texto.trim() || !!ocupado} onClick={() => enviar(false)}>{ocupado === "crear" ? "Creando…" : "Crear cuentas"}</button>
      </div>
      {r && !r.ok && <Resultado r={r} />}
      {r?.ok && <Informe r={r} credenciales={credenciales} />}
    </div>
  );
}

function Informe({ r, credenciales }) {
  const { resumen: s } = r;
  return (
    <>
      <div className="tiles" style={{ marginTop: 12 }}>
        <div className="tile"><div className="v">{s.leidas}</div><div className="l">Filas leídas</div></div>
        <div className="tile"><div className="v" style={{ color: "var(--ok)" }}>{s.creadas}</div><div className="l">{r.simulacion ? "Se crearían" : "Cuentas creadas"}</div></div>
        <div className="tile"><div className="v">{s.existentes}</div><div className="l">Ya existían (no duplicadas)</div></div>
        <div className="tile"><div className="v" style={{ color: s.pendientes ? "var(--err)" : undefined }}>{s.pendientes}</div><div className="l">Pendientes por revisar</div></div>
      </div>
      {r.simulacion && <Aviso tipo="info" titulo="Simulación: no se creó ninguna cuenta">Revisa el resultado y pulsa “Crear cuentas” para aplicarlo.</Aviso>}
      {!r.simulacion && r.creadas.length > 0 && (
        <Aviso tipo="warn" titulo="Descarga ahora las contraseñas temporales">
          Se muestran una sola vez: en la base solo se guarda su versión cifrada. Cada estudiante deberá cambiarla en su primer ingreso.
          <div className="actions"><button type="button" className="btn sm" onClick={credenciales}>Descargar credenciales (CSV)</button></div>
        </Aviso>
      )}
      {r.pendientes.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Pendientes: no se crearon</h3>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Línea</th><th>Código</th><th>Nombre</th><th>Correo</th><th>Motivo</th></tr></thead>
            <tbody>{r.pendientes.map((p) => (
              <tr key={`${p.linea}-${p.motivo}`}><td>{p.linea}</td><td>{p.student_id || "—"}</td><td>{p.full_name || "—"}</td><td>{p.email || "—"}</td><td style={{ color: "var(--err)" }}>{p.motivo}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}
      {r.creadas.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>{r.simulacion ? "Se crearían" : "Creadas"}</h3>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Línea</th><th>Código</th><th>Nombre</th><th>Correo</th>{!r.simulacion && <th>Contraseña temporal</th>}</tr></thead>
            <tbody>{r.creadas.map((c) => (
              <tr key={c.linea}><td>{c.linea}</td><td>{c.student_id}</td><td>{c.full_name}</td><td>{c.email}</td>{!r.simulacion && <td><code>{c.password}</code></td>}</tr>
            ))}</tbody>
          </table></div>
        </>
      )}
      {r.existentes.length > 0 && <p className="small muted">Ya tenían cuenta con ese correo (se omitieron): {r.existentes.map((e) => e.student_id).join(", ")}.</p>}
    </>
  );
}
