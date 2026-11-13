// Capa 1 (programa): validaciones rápidas antes de tocar la base. La base repite las reglas críticas (CHECK).
export const CATS = {
  gender: ["Female", "Male", "Other"],
  education_level: ["High School", "Undergraduate"],
  school_type: ["Public", "Private", "Charter"],
  urban_rural: ["Urban", "Suburban", "Rural"],
  family_income: ["Low", "Lower-Middle", "Middle", "Upper-Middle", "High"],
  parent_education: ["High School", "Associate", "Bachelor", "Master", "Doctorate"],
  device_availability: ["Dedicated", "Shared", "None"],
};
const OBLIGATORIAS = ["gender", "education_level", "school_type", "urban_rural"];

export const RANGOS = {
  age: [10, 100],
  exam_score: [0, 100], previous_exam_score: [0, 100], attendance_percentage: [0, 100],
  assignment_completion_rate: [0, 100], sleep_hours: [0, 24], study_hours_per_day: [0, 24],
};

export const grade = (s) => (s >= 85 ? "A" : s >= 75 ? "B" : s >= 65 ? "C" : s >= 50 ? "D" : "F");
export const level = (s) => (s >= 80 ? "High" : s >= 60 ? "Medium" : "Low");
export const status = (s) => (s >= 50 ? "Pass" : "Fail");

// Campos de un reporte académico que el profesor puede llenar / pedir modificar.
export const RECORD_NUM = ["exam_score", "previous_exam_score", "attendance_percentage", "assignment_completion_rate",
  "study_hours_per_day", "sleep_hours"];
export const RECORD_TXT = { academic_period: 30, subject: 60, evaluation: 60, comments: 1000 };
export const RECORD_FIELDS = [...Object.keys(RECORD_TXT), ...RECORD_NUM];

// Campos del perfil que el estudiante puede pedir cambiar (full_name vive en users, el resto en students).
export const PROFILE_FIELDS = ["full_name", "age", "gender", "education_level", "school_type", "urban_rural",
  "family_income", "parent_education", "internet_access", "device_availability"];

const vacio = (v) => v === undefined || v === null || v === "";

// ---- Defensa contra código en formularios ----
// 1) Todas las consultas a la base van parametrizadas ($1, $2…): un texto jamás se ejecuta como SQL.
// 2) React escapa todo lo que se dibuja: un texto jamás se ejecuta como HTML o JavaScript.
// 3) Esta capa rechaza de entrada lo que parece código y quita caracteres de control invisibles.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const PARECE_CODIGO = /<\s*[a-zA-Z/!?]|javascript\s*:|\bon\w+\s*=/i;
export const limpiar = (s) => String(s ?? "").replace(CONTROL, "").trim();
export const tieneCodigo = (s) => PARECE_CODIGO.test(String(s ?? ""));
/** Devuelve un mensaje de error si el texto parece código, o null si es seguro. */
export const errorCodigo = (campo, s) => (tieneCodigo(s) ? `${campo} no admite etiquetas HTML ni código` : null);

/**
 * Normaliza y valida un reporte. `parcial` = solo los campos presentes (modificaciones).
 * Devuelve { datos, errores } con los números ya convertidos y los derivados calculados.
 */
export function validarReporte(b, { parcial = false } = {}) {
  const e = [], datos = {};
  for (const [c, max] of Object.entries(RECORD_TXT)) {
    if (!(c in b)) { if (!parcial && c !== "comments") e.push(`${c} es obligatorio`); continue; }
    const v = vacio(b[c]) ? null : limpiar(b[c]) || null;
    if (!v && c !== "comments") { e.push(`${c} es obligatorio`); continue; }
    if (v && v.length > max) e.push(`${c} admite máximo ${max} caracteres`);
    const code = v && errorCodigo(c, v);
    if (code) e.push(code);
    datos[c] = v;
  }
  for (const c of RECORD_NUM) {
    if (!(c in b)) { if (!parcial && c === "exam_score") e.push("exam_score es obligatorio"); continue; }
    if (vacio(b[c])) { if (c === "exam_score") e.push("exam_score es obligatorio"); else datos[c] = null; continue; }
    const n = Number(b[c]);
    if (Number.isNaN(n)) e.push(`${c} debe ser numérico`);
    else if (n < RANGOS[c][0] || n > RANGOS[c][1]) e.push(`${c}=${n} fuera de rango ${RANGOS[c][0]}-${RANGOS[c][1]}`);
    else datos[c] = n;
  }
  if (typeof datos.exam_score === "number") {
    datos.performance_grade = grade(datos.exam_score);
    datos.pass_status = status(datos.exam_score);
    datos.performance_level = level(datos.exam_score);
  }
  return { datos, errores: e };
}

/** Normaliza y valida un perfil de estudiante. `parcial` = solo los campos presentes. */
export function validarPerfil(b, { parcial = false } = {}) {
  const e = [], datos = {};
  for (const c of PROFILE_FIELDS) {
    if (!(c in b)) { if (!parcial && (c === "age" || c === "full_name" || OBLIGATORIAS.includes(c))) e.push(`${c} es obligatorio`); continue; }
    const v = b[c];
    if (c === "full_name") {
      const s = limpiar(v);
      if (s.length < 2 || s.length > 120) e.push("El nombre debe tener entre 2 y 120 caracteres");
      else if (tieneCodigo(s)) e.push(errorCodigo("El nombre", s));
      else datos[c] = s;
    } else if (c === "age") {
      const n = Number(v);
      if (vacio(v) || !Number.isInteger(n) || n < 10 || n > 100) e.push("age debe ser un entero entre 10 y 100"); else datos[c] = n;
    } else if (c === "internet_access") {
      if (vacio(v)) datos[c] = null;
      else if ([true, "true", "1", 1].includes(v)) datos[c] = true;
      else if ([false, "false", "0", 0].includes(v)) datos[c] = false;
      else e.push("internet_access debe ser sí o no");
    } else if (vacio(v)) {
      if (OBLIGATORIAS.includes(c)) e.push(`${c} es obligatorio`); else datos[c] = null;
    } else if (!CATS[c].includes(v)) e.push(`${c} debe ser uno de: ${CATS[c].join(", ")}`);
    else datos[c] = v;
  }
  return { datos, errores: e };
}

/** Devuelve solo los campos cuyo valor nuevo difiere del actual (comparación tolerante a número/texto). */
export function diferencias(nuevos, actuales) {
  const out = {};
  for (const [k, v] of Object.entries(nuevos)) {
    const a = actuales[k];
    const igual = (a === null || a === undefined) ? v === null
      : typeof v === "number" ? Number(a) === v : String(a) === String(v);
    if (!igual) out[k] = v;
  }
  return out;
}
