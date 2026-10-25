"use client";
import { useState } from "react";

const box = { border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 16 };
const inp = { display: "block", margin: "4px 0 8px", padding: 6, width: "100%", boxSizing: "border-box" };
const out = { background: "#111", color: "#9f9", padding: 10, borderRadius: 6, overflow: "auto", fontSize: 13, whiteSpace: "pre-wrap" };

async function llamar(url, method, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { http: r.status, ...(await r.json()) };
}
function Sel({ name, opts, v, set }) {
  return <select style={inp} value={v[name]} onChange={(e) => set({ ...v, [name]: e.target.value })}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
}
function Num({ name, label, v, set }) {
  return <label>{label}<input style={inp} type="number" step="any" value={v[name]} onChange={(e) => set({ ...v, [name]: e.target.value })} /></label>;
}

export default function Home() {
  const [f, setF] = useState({ age: 18, gender: "Female", education_level: "High School", school_type: "Public", urban_rural: "Urban",
    previous_exam_score: 70, attendance_percentage: 90, study_hours_per_day: 3, sleep_hours: 7, exam_score: 80 });
  const [o1, setO1] = useState(""), [o2, setO2] = useState(""), [o3, setO3] = useState(""), [o4, setO4] = useState("");
  const [id, setId] = useState("STU_000001"), [rid, setRid] = useState(""), [nota, setNota] = useState(90);
  const show = (set) => (r) => set(JSON.stringify(r, null, 2));

  return (
    <main>
      <h1>EduTrack</h1>
      <p>Rendimiento académico · Next.js + Supabase (PostgreSQL). Tablas: <b>students</b> y <b>academic_records</b>.</p>

      <section style={box}>
        <h2>1 · Registrar estudiante + registro académico (1 transacción)</h2>
        <Num name="age" label="Edad" v={f} set={setF} />
        <Sel name="gender" opts={["Female", "Male", "Other"]} v={f} set={setF} />
        <Sel name="education_level" opts={["High School", "Undergraduate"]} v={f} set={setF} />
        <Sel name="school_type" opts={["Public", "Private", "Charter"]} v={f} set={setF} />
        <Sel name="urban_rural" opts={["Urban", "Suburban", "Rural"]} v={f} set={setF} />
        <Num name="previous_exam_score" label="Nota previa (0-100)" v={f} set={setF} />
        <Num name="attendance_percentage" label="Asistencia % (0-100)" v={f} set={setF} />
        <Num name="study_hours_per_day" label="Horas de estudio/día" v={f} set={setF} />
        <Num name="sleep_hours" label="Horas de sueño" v={f} set={setF} />
        <Num name="exam_score" label="exam_score (prueba 150 aquí: lo frena la APP)" v={f} set={setF} />
        <button onClick={async () => show(setO1)(await llamar("/api/students", "POST", f))}>Registrar</button>
        <pre style={out}>{o1}</pre>
      </section>

      <section style={box}>
        <h2>2 · Consultar rendimiento de un estudiante</h2>
        <input style={inp} value={id} onChange={(e) => setId(e.target.value)} placeholder="STU_000001" />
        <button onClick={async () => show(setO2)(await llamar(`/api/students/${encodeURIComponent(id)}`, "GET"))}>Consultar</button>
        <pre style={out}>{o2}</pre>
      </section>

      <section style={box}>
        <h2>3 · Actualizar un registro académico</h2>
        <p>Usa el <code>record_id</code> que aparece en la consulta (operación 2).</p>
        <input style={inp} value={rid} onChange={(e) => setRid(e.target.value)} placeholder="record_id" />
        <input style={inp} type="number" step="any" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="nuevo exam_score" />
        <button onClick={async () => show(setO3)(await llamar(`/api/records/${encodeURIComponent(rid)}`, "PATCH", { exam_score: nota }))}>Actualizar exam_score</button>
        <pre style={out}>{o3}</pre>
      </section>

      <section style={box}>
        <h2>4 · Rechazo: la base frena exam_score = 150</h2>
        <p>Salta la validación de la app a propósito y envía 150 directo a PostgreSQL (CHECK 0-100). Siempre hace ROLLBACK.</p>
        <button onClick={async () => show(setO4)(await llamar("/api/demo-rechazo", "POST"))}>Intentar guardar 150</button>
        <pre style={out}>{o4}</pre>
      </section>
    </main>
  );
}
