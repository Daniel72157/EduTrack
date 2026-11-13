"use client";
import { useState } from "react";
import { Aviso, Barra, Campo, Diferencias, llamar, Resultado, useDatos, useYo } from "../_components/ui";
import { ListaReportes, Perfil, Resumen } from "../_components/ficha";
import { MisSolicitudes } from "../_components/solicitudes";

const EDITABLES = ["full_name", "age", "gender", "education_level", "school_type", "urban_rural",
  "family_income", "parent_education", "internet_access", "device_availability"];

export default function PanelEstudiante() {
  const yo = useYo();
  const { datos, recargar } = useDatos(yo?.student_id ? `/api/students/${yo.student_id}` : null);
  const [tab, setTab] = useState("reportes");
  const [version, setVersion] = useState(0);

  return (
    <>
      <Barra usuario={yo} />
      <main className="wrap">
        <h1>Hola, {yo?.full_name?.split(" ")[0] || "…"}</h1>
        <div className="tabs" role="tablist">
          {[["reportes", "Mis notas y reportes"], ["perfil", "Mi información"], ["solicitudes", "Mis solicitudes"]].map(([k, t]) => (
            <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t}</button>
          ))}
        </div>

        {datos && !datos.ok && <Resultado r={datos} />}
        {datos?.ok && tab === "reportes" && (
          <section>
            <Resumen reportes={datos.reportes} />
            <div className="card"><ListaReportes reportes={datos.reportes} /></div>
          </section>
        )}
        {datos?.ok && tab === "perfil" && (
          <MiPerfil datos={datos} alEnviar={() => { recargar(); setVersion((v) => v + 1); }} />
        )}
        {tab === "solicitudes" && <MisSolicitudes version={version} alCambiar={recargar} />}
      </main>
    </>
  );
}

function MiPerfil({ datos, alEnviar }) {
  const { perfil, perfilPendiente } = datos;
  const inicial = () => Object.fromEntries(EDITABLES.map((c) => [c, perfil[c] === null ? "" : String(perfil[c])]));
  const [editar, setEditar] = useState(false);
  const [f, setF] = useState(inicial);
  const [razon, setRazon] = useState("");
  const [r, setR] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    // Solo se envían los campos que realmente cambiaron.
    const changes = Object.fromEntries(EDITABLES.filter((c) => f[c] !== inicial()[c]).map((c) => [c, f[c]]));
    if (!Object.keys(changes).length) return setR({ ok: false, mensaje: "No cambiaste ningún dato" });
    const res = await llamar("/api/requests", "POST", { entity_type: "student", action: "update", changes, reason: razon });
    setR(res);
    if (res.ok) { setEditar(false); setRazon(""); alEnviar(); }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>Mi información</h2><div className="spacer" />
        {!editar && !perfilPendiente && <button className="btn sec" onClick={() => { setF(inicial()); setEditar(true); setR(null); }}>Solicitar cambio de datos</button>}
      </div>
      {perfilPendiente && (
        <Aviso tipo="warn" titulo="Tienes un cambio de datos pendiente de aprobación">
          <Diferencias sol={{ action: "update", changes: perfilPendiente.changes, previous: perfil }} />
          <span className="small">Razón: {perfilPendiente.reason}</span>
        </Aviso>
      )}
      {!editar && <Perfil perfil={perfil} />}
      {editar && (
        <form onSubmit={enviar}>
          <Aviso tipo="info" titulo="Los cambios no se aplican de inmediato">Un administrativo revisará tu solicitud y la aprobará o rechazará.</Aviso>
          <div className="grid" style={{ marginTop: 12 }}>
            {EDITABLES.map((c) => <Campo key={c} name={c} v={f} set={setF} type={c === "age" ? "number" : "text"} />)}
          </div>
          <div style={{ marginTop: 12 }}>
            <Campo name="razon" label="¿Por qué necesitas el cambio? (obligatorio, mínimo 10 caracteres)" area v={{ razon }} set={(o) => setRazon(o.razon)} required minLength={10} />
          </div>
          <div className="actions">
            <button className="btn">Enviar solicitud</button>
            <button type="button" className="btn sec" onClick={() => setEditar(false)}>Cancelar</button>
          </div>
        </form>
      )}
      <Resultado r={r} />
    </section>
  );
}
