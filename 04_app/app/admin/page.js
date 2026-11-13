"use client";
import { useState } from "react";
import { Barra, llamar, Resultado, useDatos, useYo } from "../_components/ui";
import { BuscadorEstudiantes } from "../_components/buscador";
import { ListaReportes, Perfil, Resumen } from "../_components/ficha";
import { Solicitudes } from "./solicitudes";
import { Usuarios } from "./usuarios";
import { Bitacora } from "./bitacora";

export default function PanelAdmin() {
  const yo = useYo();
  const [tab, setTab] = useState("resumen");
  const [filtroLog, setFiltroLog] = useState({});
  const [sel, setSel] = useState(null);
  const { datos: st, recargar } = useDatos(`/api/stats?t=${tab}`);
  const verHistorial = (entity_type, entity_id) => { setFiltroLog({ entity_type, entity_id }); setTab("bitacora"); };

  const TABS = [["resumen", "Resumen"], ["solicitudes", "Aprobaciones"], ["estudiantes", "Estudiantes"], ["usuarios", "Usuarios"], ["bitacora", "Bitácora"]];
  return (
    <>
      <Barra usuario={yo} />
      <main className="wrap">
        <div className="tabs" role="tablist">
          {TABS.map(([k, t]) => (
            <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); if (k === "bitacora") setFiltroLog({}); }}>
              {t}{k === "solicitudes" && st?.pendientes > 0 && <span className="count">{st.pendientes}</span>}
            </button>
          ))}
        </div>
        {tab === "resumen" && <PanelResumen st={st} ir={setTab} />}
        {tab === "solicitudes" && <Solicitudes alResolver={recargar} verHistorial={verHistorial} />}
        {tab === "estudiantes" && (sel
          ? <FichaAdmin id={sel} volver={() => setSel(null)} verHistorial={verHistorial} />
          : <BuscadorEstudiantes elegir={setSel} />)}
        {tab === "usuarios" && <Usuarios yo={yo} verHistorial={verHistorial} />}
        {tab === "bitacora" && <Bitacora inicial={filtroLog} />}
      </main>
    </>
  );
}

function PanelResumen({ st, ir }) {
  const [demo, setDemo] = useState(null);
  if (!st) return <p className="muted">Cargando…</p>;
  if (!st.ok) return <Resultado r={st} />;
  const n = (v) => (v ?? 0).toLocaleString("es-CO");
  const tiles = [
    ["Solicitudes pendientes", n(st.pendientes), "solicitudes"], ["Estudiantes", n(st.estudiantes), "estudiantes"],
    ["Reportes académicos", n(st.reportes), "estudiantes"], ["Promedio general", st.promedio ?? "—"], ["Aprobación", `${st.aprobacion ?? 0}%`],
    ["Reportes nuevos (7 días)", n(st.reportes7d)], ["Eventos en bitácora (24 h)", n(st.eventos24h), "bitacora"],
    ["Inicios de sesión fallidos (24 h)", n(st.fallidos24h), "bitacora"],
  ];
  const c = st.cuentas || {};
  return (
    <>
      <div className="tiles">
        {tiles.map(([l, v, destino]) => (
          <div key={l} className="tile" style={destino ? { cursor: "pointer" } : undefined} onClick={() => destino && ir(destino)}>
            <div className="v">{v}</div><div className="l">{l}</div>
          </div>
        ))}
      </div>
      <section className="card">
        <h2>Cuentas activas</h2>
        <p style={{ margin: 0 }}>{n(c.student)} estudiantes · {n(c.teacher)} profesores · {n(c.admin)} administrativos</p>
      </section>
      <section className="card">
        <h2>Prueba de integridad de la base</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Envía una nota de 150 directo a PostgreSQL saltándose la validación de la app. La base debe rechazarla (CHECK) y hacer ROLLBACK.</p>
        <button className="btn sec" onClick={async () => setDemo(await llamar("/api/demo-rechazo", "POST"))}>Intentar guardar nota 150</button>
        {demo && (demo.frenadoPor === "base"
          ? <div className="alert ok"><b>La base rechazó la nota 150</b>Regla <code>{demo.regla}</code> (código {demo.codigoPostgres}). Filas guardadas: {demo.filasGuardadas}.</div>
          : <Resultado r={demo} />)}
      </section>
      <PruebaSeguridad />
    </>
  );
}

function PruebaSeguridad() {
  const [d, setD] = useState(null);
  const Fila = ({ ok, children }) => <li style={{ color: ok ? "var(--ok)" : "var(--err)" }}>{ok ? "✔" : "✘"} <span style={{ color: "var(--text)" }}>{children}</span></li>;
  return (
    <section className="card">
      <h2>Pruebas de seguridad</h2>
      <p className="muted small" style={{ marginTop: 0 }}>No modifica datos. Muestra que un texto con código no se ejecuta y que las contraseñas no se guardan legibles.</p>
      <button className="btn sec" onClick={async () => setD(await llamar("/api/demo-seguridad", "POST"))}>Ejecutar pruebas</button>
      {d && !d.ok && <Resultado r={d} />}
      {d?.ok && (
        <div style={{ marginTop: 12 }}>
          <h3>A · Inyección SQL</h3>
          <p className="small" style={{ margin: "0 0 4px" }}>Texto enviado: <code>{d.sql.textoEnviado}</code></p>
          <p className="small muted" style={{ margin: "0 0 4px" }}>Si se pegara dentro de la consulta: <code>{d.sql.consultaSiSeConcatenara}</code></p>
          <p className="small muted" style={{ margin: "0 0 4px" }}>Lo que hace la app: <code>{d.sql.consultaReal}</code></p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <Fila ok={d.sql.coincidencias === 0}>Se buscó como texto común: {d.sql.coincidencias} coincidencias</Fila>
            <Fila ok={d.sql.loginInyectadoEncontro === 0}>Un login con <code>admin@x.com&apos; OR &apos;1&apos;=&apos;1</code> no encontró ninguna cuenta</Fila>
            <Fila ok={d.sql.tablaExisteDespues && d.sql.filasAntes === d.sql.filasDespues}>La tabla students sigue existiendo: {d.sql.filasAntes.toLocaleString("es-CO")} → {d.sql.filasDespues.toLocaleString("es-CO")} filas</Fila>
          </ul>
          <h3 style={{ marginTop: 14 }}>B · Código en un formulario</h3>
          <p className="small" style={{ margin: "0 0 4px" }}>Texto enviado en “asignatura”: <code>{d.html.textoEnviado}</code></p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <Fila ok={d.html.rechazado}>Rechazado por la app: {d.html.errores.join("; ")}</Fila>
          </ul>
          <p className="small muted">Aunque llegara a guardarse, React lo dibuja como texto (escapado) y las cabeceras CSP impiden ejecutar scripts ajenos.</p>
          <h3 style={{ marginTop: 14 }}>C · Contraseñas</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <Fila ok={d.clave.algoritmo === "$2a$" || d.clave.algoritmo === "$2b$"}>Tu contraseña se guarda como bcrypt (costo {d.clave.costo}): <code>{d.clave.hashGuardado}</code> ({d.clave.longitud} caracteres, no se puede revertir)</Fila>
            <Fila ok={!d.clave.hashesIguales && d.clave.ambosVerifican}>La misma contraseña genera hashes distintos (sal aleatoria): <code>{d.clave.mismaClaveDosHashes[0]}</code> y <code>{d.clave.mismaClaveDosHashes[1]}</code>, y ambos validan</Fila>
          </ul>
        </div>
      )}
    </section>
  );
}

function FichaAdmin({ id, volver, verHistorial }) {
  const { datos } = useDatos(`/api/students/${id}`);
  if (!datos) return <p className="muted">Cargando…</p>;
  if (!datos.ok) return <><button className="btn ghost" onClick={volver}>← Volver</button><Resultado r={datos} /></>;
  const { perfil, reportes } = datos;
  return (
    <>
      <button className="btn ghost" onClick={volver}>← Volver a la búsqueda</button>
      <div className="card-head" style={{ marginTop: 8 }}>
        <h1 style={{ margin: 0 }}>{perfil.full_name || perfil.student_id} <span className="muted small">{perfil.student_id}</span></h1>
        <div className="spacer" />
        <button className="btn sec sm" onClick={() => verHistorial("student", perfil.student_id)}>Historial del perfil</button>
      </div>
      <Resumen reportes={reportes} />
      <section className="card">
        <h2>Reportes académicos</h2>
        <ListaReportes reportes={reportes} acciones={(r) => (
          <div className="actions"><button className="btn ghost sm" onClick={() => verHistorial("record", String(r.record_id))}>Ver historial del reporte</button></div>
        )} />
      </section>
      <section className="card"><h2>Datos del estudiante</h2><Perfil perfil={perfil} />
        {perfil.user_id && <p className="small muted">Cuenta {perfil.active ? "activa" : "desactivada"} · {perfil.email}</p>}
      </section>
    </>
  );
}
