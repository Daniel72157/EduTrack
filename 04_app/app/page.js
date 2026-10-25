"use client";
import { useState } from "react";

/* ---------- estilos ---------- */
const C = { ok: ["#e8f7ee", "#1e8e4e"], err: ["#fdecea", "#c62828"], warn: ["#fff6e0", "#b26a00"], info: ["#e8f0fe", "#1a56c4"] };
const box = { border: "1px solid #d0d7de", borderRadius: 10, padding: 16, marginBottom: 20, background: "#fff", color: "#1f2328" };
const inp = { display: "block", margin: "4px 0 10px", padding: 8, width: "100%", boxSizing: "border-box", border: "1px solid #b6bec7", borderRadius: 6 };
const btn = (off) => ({ padding: "9px 16px", borderRadius: 6, border: 0, background: off ? "#9aa5b1" : "#1a56c4", color: "#fff", cursor: off ? "wait" : "pointer", fontWeight: 600 });
const td = { padding: "6px 10px", borderBottom: "1px solid #eaeef2", textAlign: "left" };

/* ---------- textos amigables ---------- */
const REGLAS = {
  ck_exam_score: "exam_score debe estar entre 0 y 100", ck_prev_score: "La nota previa debe estar entre 0 y 100",
  ck_attendance: "La asistencia debe estar entre 0 y 100", ck_age: "La edad debe estar entre 10 y 100",
  ck_gpa: "El GPA debe estar entre 0 y 4", ck_sleep: "Las horas de sueño deben estar entre 0 y 24",
  ck_study_hours: "Las horas de estudio deben estar entre 0 y 24", ck_questions: "Las preguntas correctas no pueden superar las intentadas",
  ck_derivados: "Grado, estado y nivel no coinciden con exam_score", uq_student_period: "Ya existe un registro de ese estudiante en ese periodo",
  students_pkey: "Ya existe un estudiante con ese id", academic_records_student_id_fkey: "El registro necesita un estudiante que exista",
};
const ETIQ = { student_id: "ID estudiante", age: "Edad", gender: "Género", education_level: "Nivel educativo", school_type: "Tipo de colegio",
  urban_rural: "Zona", family_income: "Ingreso familiar", internet_access: "Internet", record_id: "ID registro", academic_period: "Periodo",
  previous_exam_score: "Nota previa", attendance_percentage: "Asistencia %", study_hours_per_day: "Horas de estudio/día",
  sleep_hours: "Horas de sueño", exam_score: "Nota del examen", performance_grade: "Grado", pass_status: "Estado", performance_level: "Nivel" };
const VAL = { Pass: "Aprobado", Fail: "Reprobado", High: "Alto", Medium: "Medio", Low: "Bajo", true: "Sí", false: "No" };
const fmt = (v) => (v === null || v === undefined ? "—" : VAL[String(v)] ?? String(v));

async function llamar(url, method, body) {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { http: r.status, ...(await r.json()) };
  } catch (e) {
    return { http: 0, ok: false, red: true, detalle: e.message };
  }
}

/* ---------- componentes visuales ---------- */
function Aviso({ tipo, titulo, children }) {
  const [bg, fg] = C[tipo];
  return (
    <div role="alert" style={{ background: bg, borderLeft: `5px solid ${fg}`, color: "#1f2328", padding: "10px 14px", borderRadius: 6, marginTop: 12 }}>
      <b style={{ color: fg }}>{titulo}</b>
      {children && <div style={{ marginTop: 6, fontSize: 14 }}>{children}</div>}
    </div>
  );
}
function Tabla({ datos, campos }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 8, fontSize: 14 }}>
      <tbody>
        {campos.filter((c) => c in datos).map((c) => (
          <tr key={c}><th style={{ ...td, width: "45%", color: "#57606a", fontWeight: 600 }}>{ETIQ[c] || c}</th><td style={td}>{fmt(datos[c])}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
function Insignia({ nota, grado }) {
  const color = nota >= 80 ? "#1e8e4e" : nota >= 50 ? "#b26a00" : "#c62828";
  return <span style={{ background: color, color: "#fff", borderRadius: 20, padding: "3px 12px", fontWeight: 700 }}>{Number(nota)} · {grado}</span>;
}
function Errores({ r }) {
  if (r.red) return <Aviso tipo="err" titulo="No se pudo conectar con el servidor">{r.detalle}. Revisa tu conexión o que DATABASE_URL esté configurada.</Aviso>;
  if (r.frenadoPor === "app")
    return <Aviso tipo="warn" titulo="La aplicación frenó el envío (no llegó a la base)"><ul style={{ margin: 0, paddingLeft: 18 }}>{r.errores.map((e) => <li key={e}>{e}</li>)}</ul></Aviso>;
  if (r.frenadoPor === "base")
    return <Aviso tipo="err" titulo="La base de datos rechazó la operación">
      <div>{REGLAS[r.regla] || (r.regla ? "Se violó una regla de la base." : "La base no pudo completar la operación.")} {r.regla && <code>({r.regla})</code>}</div>
      <div style={{ marginTop: 4 }}>No se guardó nada. {r.detalle && <small style={{ color: "#57606a" }}>Detalle técnico: {r.detalle}</small>}</div>
    </Aviso>;
  return <Aviso tipo="err" titulo={r.mensaje || "Ocurrió un error inesperado"}>{r.detalle}</Aviso>;
}

function Campo({ name, label, v, set, type = "number", opts }) {
  const cambia = (e) => set({ ...v, [name]: e.target.value });
  return (
    <label style={{ fontSize: 14 }}>{label}
      {opts ? <select style={inp} value={v[name]} onChange={cambia}>{opts.map(([val, txt]) => <option key={val} value={val}>{txt}</option>)}</select>
            : <input style={inp} type={type} step="any" value={v[name]} onChange={cambia} />}
    </label>
  );
}

/* ---------- página ---------- */
export default function Home() {
  const [f, setF] = useState({ age: 18, gender: "Female", education_level: "High School", school_type: "Public", urban_rural: "Urban",
    previous_exam_score: 70, attendance_percentage: 90, study_hours_per_day: 3, sleep_hours: 7, exam_score: 80 });
  const [r1, setR1] = useState(null), [r2, setR2] = useState(null), [r3, setR3] = useState(null), [r4, setR4] = useState(null);
  const [id, setId] = useState("STU_000001"), [rid, setRid] = useState(""), [nota, setNota] = useState(90);
  const [r5, setR5] = useState(null), [tipoDel, setTipoDel] = useState("registro"), [idDel, setIdDel] = useState("");
  const [cargando, setCargando] = useState("");
  const correr = async (n, set, fn) => { setCargando(n); set(null); set(await fn()); setCargando(""); };

  // D de CRUD: borra de verdad la fila en la BD (pide confirmación antes)
  const eliminar = async (tipo, ident, origen) => {
    const txt = tipo === "estudiante" ? `¿Eliminar al estudiante ${ident} y TODOS sus registros académicos? No se puede deshacer.`
                                      : `¿Eliminar el registro académico ${ident}? No se puede deshacer.`;
    if (!window.confirm(txt)) return;
    setCargando("5"); setR5(null);
    const url = tipo === "estudiante" ? `/api/students/${encodeURIComponent(ident)}` : `/api/records/${encodeURIComponent(ident)}`;
    const res = await llamar(url, "DELETE");
    setR5({ ...res, origen });
    if (res.ok && origen === "2") {
      if (tipo === "estudiante") setR2(null);
      else setR2(await llamar(`/api/students/${encodeURIComponent(id.trim())}`, "GET"));
    }
    setCargando("");
  };
  const ResEliminar = ({ origen }) => {
    if (!r5 || r5.origen !== origen) return null;
    if (r5.ok) return (
      <Aviso tipo="ok" titulo={r5.tipo === "estudiante" ? `Estudiante ${r5.id} eliminado con éxito` : `Registro ${r5.id} eliminado con éxito`}>
        {r5.tipo === "estudiante" ? `Se borró de la base junto con ${r5.registrosEliminados} registro(s) académico(s).` : `Se borró de la base el registro del estudiante ${r5.student_id}.`}
      </Aviso>
    );
    if (r5.http === 404) return <Aviso tipo="warn" titulo="No se eliminó nada: no existe ese ID">Revisa el ID e inténtalo de nuevo.</Aviso>;
    return <Errores r={r5} />;
  };

  return (
    <main>
      <h1 style={{ marginBottom: 4 }}>EduTrack</h1>
      <p style={{ marginTop: 0, color: "#57606a" }}>Rendimiento académico · CRUD con Next.js + Supabase (PostgreSQL)</p>

      {/* 1 */}
      <section style={box}>
        <h2 style={{ marginTop: 0 }}>1 · Registrar estudiante y registro académico</h2>
        <Campo name="age" label="Edad" v={f} set={setF} />
        <Campo name="gender" label="Género" v={f} set={setF} opts={[["Female", "Femenino"], ["Male", "Masculino"], ["Other", "Otro"]]} />
        <Campo name="education_level" label="Nivel educativo" v={f} set={setF} opts={[["High School", "Bachillerato"], ["Undergraduate", "Universidad"]]} />
        <Campo name="school_type" label="Tipo de colegio" v={f} set={setF} opts={[["Public", "Público"], ["Private", "Privado"], ["Charter", "Concertado"]]} />
        <Campo name="urban_rural" label="Zona" v={f} set={setF} opts={[["Urban", "Urbana"], ["Suburban", "Periférica"], ["Rural", "Rural"]]} />
        <Campo name="previous_exam_score" label="Nota previa (0-100)" v={f} set={setF} />
        <Campo name="attendance_percentage" label="Asistencia % (0-100)" v={f} set={setF} />
        <Campo name="study_hours_per_day" label="Horas de estudio por día" v={f} set={setF} />
        <Campo name="sleep_hours" label="Horas de sueño" v={f} set={setF} />
        <Campo name="exam_score" label="Nota del examen (prueba con 150: lo frena la app)" v={f} set={setF} />
        <button style={btn(cargando === "1")} disabled={!!cargando} onClick={() => correr("1", setR1, () => llamar("/api/students", "POST", f))}>
          {cargando === "1" ? "Guardando…" : "Registrar"}
        </button>
        {r1 && (r1.ok ? (
          <>
            <Aviso tipo="ok" titulo={`Estudiante ${r1.student.student_id} agregado con éxito`}>
              Se guardaron el estudiante y su registro académico en una sola transacción.
            </Aviso>
            <p style={{ marginBottom: 0 }}>Nota del examen: <Insignia nota={r1.record.exam_score} grado={r1.record.performance_grade} /> · {fmt(r1.record.pass_status)}</p>
            <Tabla datos={{ ...r1.student, ...r1.record }} campos={["student_id", "age", "gender", "education_level", "school_type", "urban_rural", "record_id", "academic_period", "previous_exam_score", "attendance_percentage", "study_hours_per_day", "sleep_hours", "performance_level"]} />
          </>
        ) : <Errores r={r1} />)}
      </section>

      {/* 2 */}
      <section style={box}>
        <h2 style={{ marginTop: 0 }}>2 · Consultar rendimiento de un estudiante</h2>
        <input style={inp} value={id} onChange={(e) => setId(e.target.value)} placeholder="Ej: STU_000001" />
        <button style={btn(cargando === "2")} disabled={!!cargando} onClick={() => correr("2", setR2, () => llamar(`/api/students/${encodeURIComponent(id.trim())}`, "GET"))}>
          {cargando === "2" ? "Buscando…" : "Consultar"}
        </button>
        {r2 && (r2.ok ? (
          <>
            <Aviso tipo="info" titulo={`Estudiante ${r2.registros[0].student_id} encontrado`}>{r2.registros.length} registro(s) académico(s)</Aviso>
            <Tabla datos={r2.registros[0]} campos={["student_id", "age", "gender", "education_level", "school_type", "urban_rural"]} />
            <button style={{ ...btn(false), background: "#c62828", marginTop: 12 }} disabled={!!cargando} onClick={() => eliminar("estudiante", r2.registros[0].student_id, "2")}>Eliminar estudiante y sus registros</button>
            {r2.registros.map((x) => (
              <div key={x.record_id} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginTop: 12 }}>
                <b>Periodo {x.academic_period}</b> · <Insignia nota={x.exam_score} grado={x.performance_grade} /> · {fmt(x.pass_status)} · Nivel {fmt(x.performance_level)}
                <Tabla datos={x} campos={["record_id", "previous_exam_score", "attendance_percentage", "study_hours_per_day", "sleep_hours"]} />
                <button style={{ ...btn(false), background: "#57606a", marginTop: 8 }} onClick={() => setRid(String(x.record_id))}>Usar este registro en la operación 3</button>{" "}
                <button style={{ ...btn(false), background: "#c62828", marginTop: 8 }} disabled={!!cargando} onClick={() => eliminar("registro", x.record_id, "2")}>Eliminar este registro</button>
              </div>
            ))}
          </>
        ) : r2.http === 404 ? <Aviso tipo="warn" titulo="No se encontró ningún estudiante con ese ID">Revisa que esté escrito como STU_000001.</Aviso> : <Errores r={r2} />)}
        <ResEliminar origen="2" />
      </section>

      {/* 3 */}
      <section style={box}>
        <h2 style={{ marginTop: 0 }}>3 · Actualizar un registro académico</h2>
        <label style={{ fontSize: 14 }}>ID del registro (lo obtienes en la operación 2)
          <input style={inp} value={rid} onChange={(e) => setRid(e.target.value)} placeholder="Ej: 1" />
        </label>
        <label style={{ fontSize: 14 }}>Nueva nota del examen
          <input style={inp} type="number" step="any" value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
        <button style={btn(cargando === "3")} disabled={!!cargando} onClick={() => correr("3", setR3, () => llamar(`/api/records/${encodeURIComponent(rid.trim())}`, "PATCH", { exam_score: nota }))}>
          {cargando === "3" ? "Actualizando…" : "Actualizar nota"}
        </button>
        {r3 && (r3.ok ? (
          <>
            <Aviso tipo="ok" titulo={`Registro ${r3.record.record_id} actualizado con éxito`}>El grado, el estado y el nivel se recalcularon a partir de la nueva nota.</Aviso>
            <p style={{ marginBottom: 0 }}>Nueva nota: <Insignia nota={r3.record.exam_score} grado={r3.record.performance_grade} /> · {fmt(r3.record.pass_status)} · Nivel {fmt(r3.record.performance_level)}</p>
          </>
        ) : r3.http === 404 ? <Aviso tipo="warn" titulo="Ese registro no existe">Consulta primero un estudiante y usa el ID de registro que aparece.</Aviso> : <Errores r={r3} />)}
      </section>

      {/* 4 */}
      <section style={box}>
        <h2 style={{ marginTop: 0 }}>4 · Rechazo: la base frena una nota de 150</h2>
        <p style={{ marginTop: 0 }}>Salta la validación de la app a propósito y manda <b>exam_score = 150</b> directo a PostgreSQL. Siempre termina deshaciendo todo.</p>
        <button style={btn(cargando === "4")} disabled={!!cargando} onClick={() => correr("4", setR4, () => llamar("/api/demo-rechazo", "POST"))}>
          {cargando === "4" ? "Probando…" : "Intentar guardar 150"}
        </button>
        {r4 && (r4.frenadoPor === "base" ? (
          <Aviso tipo="ok" titulo="Rechazo correcto: la base de datos no aceptó el 150">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>Se intentó guardar una nota de <b>150</b>.</li>
              <li>La regla que lo frenó: <b>{REGLAS[r4.regla] || r4.regla}</b> <code>({r4.regla}, código {r4.codigoPostgres})</code>.</li>
              <li>Se hizo ROLLBACK: filas guardadas = <b>{r4.filasGuardadas}</b>.</li>
            </ol>
          </Aviso>
        ) : <Errores r={r4} />)}
      </section>

      {/* 5 */}
      <section style={box}>
        <h2 style={{ marginTop: 0 }}>5 · Eliminar</h2>
        <p style={{ marginTop: 0 }}>Borra la fila directamente de la base de datos (sin eliminado lógico).</p>
        <label style={{ fontSize: 14 }}>¿Qué quieres eliminar?
          <select style={inp} value={tipoDel} onChange={(e) => { setTipoDel(e.target.value); setIdDel(""); }}>
            <option value="registro">Un registro académico (por ID de registro)</option>
            <option value="estudiante">Un estudiante y todos sus registros (por ID de estudiante)</option>
          </select>
        </label>
        <input style={inp} value={idDel} onChange={(e) => setIdDel(e.target.value)} placeholder={tipoDel === "registro" ? "Ej: 200001" : "Ej: STU_W000001"} />
        <button style={{ ...btn(cargando === "5"), background: cargando === "5" ? "#9aa5b1" : "#c62828" }} disabled={!!cargando || !idDel.trim()} onClick={() => eliminar(tipoDel, idDel.trim(), "5")}>
          {cargando === "5" ? "Eliminando…" : "Eliminar"}
        </button>
        <ResEliminar origen="5" />
      </section>
    </main>
  );
}
