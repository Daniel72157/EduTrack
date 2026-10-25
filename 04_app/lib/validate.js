// Capa 1 (programa): validaciones rápidas antes de tocar la base. La base repite las reglas críticas (CHECK).
const CATS = {
  gender: ["Female", "Male", "Other"], education_level: ["High School", "Undergraduate"],
  school_type: ["Public", "Private", "Charter"], urban_rural: ["Urban", "Suburban", "Rural"],
};
const RANGOS = {
  age: [10, 100], exam_score: [0, 100], previous_exam_score: [0, 100], attendance_percentage: [0, 100],
  sleep_hours: [0, 24], study_hours_per_day: [0, 24],
};
export const grade = (s) => (s >= 85 ? "A" : s >= 75 ? "B" : s >= 65 ? "C" : s >= 50 ? "D" : "F");
export const level = (s) => (s >= 80 ? "High" : s >= 60 ? "Medium" : "Low");
export const status = (s) => (s >= 50 ? "Pass" : "Fail");

export function validar(b, { soloRegistro = false, requerirEstudiante = true } = {}) {
  const e = [];
  const campos = soloRegistro ? ["exam_score", "previous_exam_score", "attendance_percentage", "sleep_hours", "study_hours_per_day"]
                              : Object.keys(RANGOS);
  for (const c of campos) {
    if (b[c] === undefined || b[c] === "" || b[c] === null) { if (c === "exam_score" || requerirEstudiante && c === "age") e.push(`${c} es obligatorio`); continue; }
    const n = Number(b[c]);
    if (Number.isNaN(n)) e.push(`${c} debe ser numérico`);
    else if (n < RANGOS[c][0] || n > RANGOS[c][1]) e.push(`${c}=${n} fuera de rango ${RANGOS[c][0]}-${RANGOS[c][1]}`);
  }
  if (!soloRegistro && requerirEstudiante)
    for (const [c, ok] of Object.entries(CATS)) if (!ok.includes(b[c])) e.push(`${c} debe ser uno de: ${ok.join(", ")}`);
  return e;
}
