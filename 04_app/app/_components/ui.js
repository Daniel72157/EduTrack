"use client";
import { useCallback, useEffect, useState } from "react";

/* ---------- textos ---------- */
export const ETIQ = {
  student_id: "ID estudiante", full_name: "Nombre", email: "Correo", age: "Edad", gender: "Género", education_level: "Nivel educativo",
  school_type: "Tipo de colegio", urban_rural: "Zona", family_income: "Ingreso familiar", parent_education: "Educación de los padres",
  internet_access: "Acceso a internet", device_availability: "Dispositivo", record_id: "ID reporte", academic_period: "Periodo",
  subject: "Asignatura", evaluation: "Evaluación", comments: "Observaciones", previous_exam_score: "Nota previa",
  attendance_percentage: "Asistencia %", assignment_completion_rate: "Tareas entregadas %", study_hours_per_day: "Horas de estudio/día",
  sleep_hours: "Horas de sueño", exam_score: "Nota", performance_grade: "Grado", pass_status: "Estado", performance_level: "Nivel",
};
export const OPCIONES = {
  gender: [["Female", "Femenino"], ["Male", "Masculino"], ["Other", "Otro"]],
  education_level: [["High School", "Bachillerato"], ["Undergraduate", "Universidad"]],
  school_type: [["Public", "Público"], ["Private", "Privado"], ["Charter", "Concertado"]],
  urban_rural: [["Urban", "Urbana"], ["Suburban", "Periférica"], ["Rural", "Rural"]],
  family_income: [["", "—"], ["Low", "Bajo"], ["Lower-Middle", "Medio-bajo"], ["Middle", "Medio"], ["Upper-Middle", "Medio-alto"], ["High", "Alto"]],
  parent_education: [["", "—"], ["High School", "Bachillerato"], ["Associate", "Técnico"], ["Bachelor", "Pregrado"], ["Master", "Maestría"], ["Doctorate", "Doctorado"]],
  device_availability: [["", "—"], ["Dedicated", "Propio"], ["Shared", "Compartido"], ["None", "Ninguno"]],
  internet_access: [["", "—"], ["true", "Sí"], ["false", "No"]],
};
const TRAD = Object.fromEntries(Object.values(OPCIONES).flat().filter(([v]) => v !== ""));
const VAL = { ...TRAD, Pass: "Aprobado", Fail: "Reprobado", High: "Alto", Medium: "Medio", Low: "Bajo", true: "Sí", false: "No",
  student: "Estudiante", teacher: "Profesor", admin: "Administrativo",
  pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", cancelled: "Cancelada", update: "Modificar", delete: "Eliminar",
  record: "Reporte", user: "Cuenta", request: "Solicitud" };
export const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" && /^-?\d+\.\d+$/.test(v)) return String(Number(v)); // numeric de PostgreSQL: "64.00" -> "64"
  return VAL[String(v)] ?? String(v);
};
export const fecha = (v) => (v ? new Date(v).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "—");

const REGLAS = {
  ck_exam_score: "La nota debe estar entre 0 y 100", ck_prev_score: "La nota previa debe estar entre 0 y 100",
  ck_attendance: "La asistencia debe estar entre 0 y 100", ck_assignments: "Las tareas entregadas deben estar entre 0 y 100",
  ck_age: "La edad debe estar entre 10 y 100", ck_sleep: "Las horas de sueño deben estar entre 0 y 24",
  ck_study_hours: "Las horas de estudio deben estar entre 0 y 24", ck_derivados: "Grado, estado y nivel no coinciden con la nota",
  uq_record_eval: "Ese estudiante ya tiene un reporte con el mismo periodo, asignatura y evaluación",
  academic_records_student_id_fkey: "El estudiante no existe", ck_record_textos: "Periodo, asignatura y evaluación son obligatorios",
  ck_user_email: "Correo inválido", ck_req_reason: "La razón debe tener al menos 10 caracteres",
};

/* ---------- red ---------- */
export async function llamar(url, method = "GET", body) {
  try {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && !url.includes("/auth/login")) { window.location.href = "/login"; return { http: 401, ok: false }; }
    return { http: r.status, ...(await r.json()) };
  } catch (e) {
    return { http: 0, ok: false, red: true, detalle: e.message };
  }
}

/** Carga una URL y la vuelve a cargar cuando cambia o cuando se llama a recargar(). */
export function useDatos(url) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const recargar = useCallback(async () => {
    if (!url) { setDatos(null); return; }
    setCargando(true);
    setDatos(await llamar(url));
    setCargando(false);
  }, [url]);
  useEffect(() => { recargar(); }, [recargar]);
  return { datos, cargando, recargar };
}

/* ---------- piezas visuales ---------- */
export function Aviso({ tipo = "info", titulo, children }) {
  return <div role={tipo === "err" ? "alert" : "status"} className={`alert ${tipo}`}><b>{titulo}</b>{children}</div>;
}

export function Resultado({ r, exito }) {
  if (!r) return null;
  if (r.ok) return <Aviso tipo="ok" titulo={exito || r.mensaje || "Listo"} />;
  if (r.red) return <Aviso tipo="err" titulo="No se pudo conectar con el servidor">{r.detalle}</Aviso>;
  if (r.frenadoPor === "base")
    return <Aviso tipo="err" titulo="La base de datos rechazó la operación">
      {REGLAS[r.regla] || "Se violó una regla de la base."} {r.regla && <code>{r.regla}</code>} No se guardó nada.
    </Aviso>;
  return <Aviso tipo={r.http === 409 || r.http === 404 ? "warn" : "err"} titulo={r.mensaje || "Ocurrió un error"}>
    {r.errores?.length > 0 && <ul>{r.errores.map((e) => <li key={e}>{e}</li>)}</ul>}
  </Aviso>;
}

export function Insignia({ nota, grado }) {
  const color = nota >= 80 ? "#1d7f49" : nota >= 50 ? "#b26a00" : "#b42318";
  return <span className="badge" style={{ background: color }}>{Number(nota)} · {grado}</span>;
}

export const Estado = ({ s }) => <span className={`pill ${s}`}>{fmt(s)}</span>;

export function KV({ datos, campos }) {
  return (
    <table className="t kv"><tbody>
      {campos.map((c) => <tr key={c}><th>{ETIQ[c] || c}</th><td>{fmt(datos[c])}</td></tr>)}
    </tbody></table>
  );
}

/** Campo de formulario controlado sobre un objeto `v`. */
export function Campo({ name, label, v, set, type = "number", opts, area, ...rest }) {
  const val = v[name] === null || v[name] === undefined ? "" : String(v[name]);
  const cambia = (e) => set({ ...v, [name]: e.target.value });
  const o = opts || OPCIONES[name];
  return (
    <label className="f">{label || ETIQ[name] || name}
      {o ? <select className="in" value={val} onChange={cambia}>{o.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        : area ? <textarea className="in" value={val} onChange={cambia} {...rest} />
        : <input className="in" type={type} step={type === "number" ? "any" : undefined} value={val} onChange={cambia} {...rest} />}
    </label>
  );
}

export function Paginador({ page, size, total, set }) {
  const paginas = Math.max(1, Math.ceil((total || 0) / size));
  if (!total) return null;
  return (
    <div className="pager">
      <span className="muted">{total.toLocaleString("es-CO")} resultado(s) · página {page} de {paginas}</span>
      <button className="btn sec sm" disabled={page <= 1} onClick={() => set(page - 1)}>Anterior</button>
      <button className="btn sec sm" disabled={page >= paginas} onClick={() => set(page + 1)}>Siguiente</button>
    </div>
  );
}

/** Tabla “campo · antes · después” de una solicitud de cambio. */
export function Diferencias({ sol }) {
  if (sol.action === "delete")
    return <Aviso tipo="warn" titulo="Se solicita ELIMINAR el reporte">
      {sol.previous && <span className="small">{sol.previous.academic_period} · {sol.previous.subject} · {sol.previous.evaluation} · nota {sol.previous.exam_score}</span>}
    </Aviso>;
  const campos = Object.keys(sol.changes || {}).filter((c) => !["performance_grade", "pass_status", "performance_level"].includes(c));
  return (
    <div className="table-wrap"><table className="t diff">
      <thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
      <tbody>{campos.map((c) => (
        <tr key={c}><td>{ETIQ[c] || c}</td><td>{fmt(sol.previous?.[c])}</td><td>{fmt(sol.changes[c])}</td></tr>
      ))}</tbody>
    </table></div>
  );
}

/* ---------- barra superior (sesión) ---------- */
export function Barra({ usuario, children }) {
  const [clave, setClave] = useState(false);
  const forzada = !!usuario?.must_change_password;
  useEffect(() => { if (forzada) setClave(true); }, [forzada]);
  const salir = async () => { await llamar("/api/auth/logout", "POST"); window.location.href = "/login"; };
  return (
    <>
      <header className="topbar"><div className="wrap">
        <div className="brand">Edu<span>Track</span></div>
        {children}
        <div className="spacer" />
        {usuario && <div className="who"><b>{usuario.full_name}</b><br />{fmt(usuario.role)} · {usuario.email}</div>}
        <button className="btn sec sm" onClick={() => setClave(!clave)}>Contraseña</button>
        <button className="btn sec sm" onClick={salir}>Salir</button>
      </div></header>
      {clave && <div className="wrap" style={{ paddingBottom: 0 }}><CambiarClave forzada={forzada} cerrar={() => setClave(false)} /></div>}
    </>
  );
}

function CambiarClave({ cerrar, forzada }) {
  const [f, setF] = useState({ actual: "", nueva: "", repetir: "" });
  const [r, setR] = useState(null);
  const enviar = async (e) => {
    e.preventDefault();
    if (f.nueva !== f.repetir) return setR({ ok: false, mensaje: "Las contraseñas nuevas no coinciden" });
    const res = await llamar("/api/auth/password", "POST", f);
    setR(res);
    if (res.ok) { setF({ actual: "", nueva: "", repetir: "" }); if (forzada) setTimeout(() => window.location.reload(), 900); }
  };
  return (
    <form className="card" onSubmit={enviar}>
      <div className="card-head"><h2>Cambiar contraseña</h2><div className="spacer" />{!forzada && <button type="button" className="btn ghost" onClick={cerrar}>Cerrar</button>}</div>
      {forzada && <Aviso tipo="warn" titulo="Tu contraseña es temporal">Elige una contraseña propia ahora: la actual la conoce quien creó tu cuenta.</Aviso>}
      <div className="grid">
        <Campo name="actual" label="Contraseña actual" type="password" v={f} set={setF} autoComplete="current-password" />
        <Campo name="nueva" label="Nueva (8+ caracteres, letras y números)" type="password" v={f} set={setF} autoComplete="new-password" />
        <Campo name="repetir" label="Repite la nueva" type="password" v={f} set={setF} autoComplete="new-password" />
      </div>
      <div className="actions"><button className="btn">Guardar</button></div>
      <Resultado r={r} />
    </form>
  );
}

/** Usuario de la sesión (para la barra). */
export function useYo() {
  const { datos } = useDatos("/api/auth/me");
  return datos?.usuario || null;
}
