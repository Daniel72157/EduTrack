"use client";
import { useState } from "react";
import { Campo, fecha, fmt, llamar, Paginador, Resultado, useDatos } from "../_components/ui";
import { CargaMasiva } from "./cargaMasiva";

const PERFIL_NUEVO = { age: "", gender: "Female", education_level: "High School", school_type: "Public", urban_rural: "Urban",
  family_income: "", parent_education: "", internet_access: "", device_availability: "" };

export function Usuarios({ yo, verHistorial }) {
  const [filtro, setFiltro] = useState({ q: "", role: "", page: 1 });
  const [texto, setTexto] = useState("");
  const [crear, setCrear] = useState(false);
  const [masiva, setMasiva] = useState(false);
  const { datos, recargar } = useDatos(`/api/users?q=${encodeURIComponent(filtro.q)}&role=${filtro.role}&page=${filtro.page}&size=20`);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Cuentas</h2><div className="spacer" />
          <button className="btn sec" onClick={() => setMasiva(!masiva)}>{masiva ? "Cerrar carga masiva" : "Carga masiva"}</button>
          <button className="btn" onClick={() => setCrear(!crear)}>{crear ? "Cerrar" : "+ Nueva cuenta"}</button>
        </div>
        {masiva && <CargaMasiva listo={recargar} />}
        {crear && <NuevaCuenta listo={() => { setCrear(false); recargar(); }} />}
        <form className="row" onSubmit={(e) => { e.preventDefault(); setFiltro({ ...filtro, q: texto.trim(), page: 1 }); }}>
          <label className="f grow">Buscar por nombre, correo o ID de estudiante
            <input className="in" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <label className="f">Rol
            <select className="in" value={filtro.role} onChange={(e) => setFiltro({ ...filtro, role: e.target.value, page: 1 })}>
              <option value="">Todos</option><option value="student">Estudiantes</option><option value="teacher">Profesores</option><option value="admin">Administrativos</option>
            </select>
          </label>
          <button className="btn sec">Buscar</button>
        </form>
        {datos && !datos.ok && <Resultado r={datos} />}
        {datos?.ok && (
          <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estudiante</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
            <tbody>{datos.usuarios.map((u) => <FilaUsuario key={u.user_id} u={u} esYo={yo?.user_id === u.user_id} listo={recargar} verHistorial={verHistorial} />)}</tbody>
          </table></div>
        )}
        {datos?.ok && <Paginador page={filtro.page} size={20} total={datos.total} set={(p) => setFiltro({ ...filtro, page: p })} />}
      </section>
    </>
  );
}

function FilaUsuario({ u, esYo, listo, verHistorial }) {
  const [r, setR] = useState(null);
  const actualizar = async (body, confirmar) => {
    if (confirmar && !window.confirm(confirmar)) return;
    const res = await llamar(`/api/users/${u.user_id}`, "PATCH", body);
    setR(res);
    if (res.ok) listo();
  };
  const restablecer = () => {
    const clave = window.prompt(`Nueva contraseña para ${u.email} (8+ caracteres, letras y números):`);
    if (clave) actualizar({ password: clave });
  };
  return (
    <>
      <tr>
        <td>{u.full_name}{esYo && <span className="muted small"> (tú)</span>}</td><td>{u.email}</td><td>{fmt(u.role)}</td>
        <td>{u.student_id || "—"}</td>
        <td><span className={`pill ${u.active ? "approved" : "rejected"}`}>{u.active ? "Activa" : "Desactivada"}</span></td>
        <td className="small">{fecha(u.last_login_at)}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          {!esYo && <button className="btn ghost sm" onClick={() => actualizar({ active: !u.active }, `¿${u.active ? "Desactivar" : "Activar"} la cuenta de ${u.email}?`)}>{u.active ? "Desactivar" : "Activar"}</button>}
          <button className="btn ghost sm" onClick={restablecer}>Restablecer clave</button>
          <button className="btn ghost sm" onClick={() => verHistorial("user", String(u.user_id))}>Historial</button>
        </td>
      </tr>
      {r && !r.ok && <tr><td colSpan={7}><Resultado r={r} /></td></tr>}
    </>
  );
}

function NuevaCuenta({ listo }) {
  const [f, setF] = useState({ role: "teacher", email: "", full_name: "", password: "", vinculo: "existente", student_id: "" });
  const [perfil, setPerfil] = useState(PERFIL_NUEVO);
  const [r, setR] = useState(null);
  const enviar = async (e) => {
    e.preventDefault();
    const body = { role: f.role, email: f.email, full_name: f.full_name, password: f.password };
    if (f.role === "student") { if (f.vinculo === "existente") body.student_id = f.student_id; else body.perfil = perfil; }
    const res = await llamar("/api/users", "POST", body);
    setR(res);
    if (res.ok) setTimeout(listo, 1200);
  };
  return (
    <form className="sub" onSubmit={enviar} style={{ marginBottom: 16 }}>
      <h3>Nueva cuenta</h3>
      <div className="grid">
        <Campo name="role" label="Rol" v={f} set={setF} opts={[["teacher", "Profesor"], ["student", "Estudiante"], ["admin", "Administrativo"]]} />
        <Campo name="full_name" label="Nombre completo" type="text" v={f} set={setF} required />
        <Campo name="email" label="Correo" type="email" v={f} set={setF} required />
        <Campo name="password" label="Contraseña inicial" type="text" v={f} set={setF} required minLength={8} />
      </div>
      {f.role === "student" && (
        <div className="sub">
          <Campo name="vinculo" label="Ficha del estudiante" v={f} set={setF}
            opts={[["existente", "Vincular a una ficha existente (p. ej. del dataset)"], ["nueva", "Crear una ficha nueva"]]} />
          <div style={{ marginTop: 10 }}>
            {f.vinculo === "existente"
              ? <Campo name="student_id" label="ID del estudiante" type="text" v={f} set={setF} placeholder="STU_000001" required />
              : <div className="grid">{Object.keys(PERFIL_NUEVO).map((c) => <Campo key={c} name={c} v={perfil} set={setPerfil} type="number" />)}</div>}
          </div>
        </div>
      )}
      <div className="actions"><button className="btn">Crear cuenta</button></div>
      <Resultado r={r} />
    </form>
  );
}
