"""EduTrack · ETL: CSV original -> limpiar -> validar -> guardar en students / academic_records.
Idempotente: correrlo 2 veces no duplica nada (ON CONFLICT DO NOTHING).
Uso:  DATABASE_URL=postgresql://... python etl/etl.py [ruta_csv]
"""
import os, sys, io
import pandas as pd
import psycopg

CSV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "01_dataset", "student_exam_performance.csv")
OUT_RECHAZOS = os.path.join(os.path.dirname(__file__), "rechazados.csv")
PERIODO = "CSV-2026"

STUDENT_COLS = ["student_id","age","gender","education_level","school_type","family_income",
                "parent_education","urban_rural","internet_access","device_availability"]
RECORD_COLS = ["student_id","academic_period","previous_exam_score","previous_gpa","attendance_percentage",
  "assignment_completion_rate","class_participation","study_hours_per_day","self_study_hours","private_tuition",
  "online_learning_hours","study_consistency","study_environment","study_method","revision_frequency",
  "practice_tests_completed","notes_quality","sleep_hours","sleep_quality","daily_screen_time",
  "physical_activity_hours","break_frequency","stress_level","motivation_level","educational_app_usage",
  "online_course_hours","exam_difficulty","exam_preparation_days","questions_attempted","questions_correct",
  "time_management_score","exam_anxiety_level","exam_score","performance_grade","pass_status","performance_level"]

CATS = {"gender": {"Female","Male","Other"}, "education_level": {"High School","Undergraduate"},
        "school_type": {"Public","Private","Charter"}, "urban_rural": {"Urban","Suburban","Rural"}}

def grade(s):  return "A" if s>=85 else "B" if s>=75 else "C" if s>=65 else "D" if s>=50 else "F"
def level(s):  return "High" if s>=80 else "Medium" if s>=60 else "Low"
def passs(s):  return "Pass" if s>=50 else "Fail"

# ---------- 1. LEER Y LIMPIAR ----------
df = pd.read_csv(CSV)
total = len(df)
for c in df.select_dtypes(include=["object","string"]).columns:
    df[c] = df[c].astype("string").str.strip()          # quita espacios
df["academic_period"] = PERIODO

# ---------- 2. VALIDAR (cada rechazo tiene una causa escrita) ----------
causa = pd.Series("", index=df.index)
def marca(mask, texto):
    global causa
    mask = mask.fillna(True)
    causa = causa.where(~mask | (causa != ""), texto)   # conserva la primera causa

marca(~df.student_id.astype("string").str.match(r"^STU_[0-9A-Z]{6,}$"), "student_id con formato inválido o vacío")
marca(df.student_id.duplicated(keep="first"), "estudiante repetido en el archivo")
marca(~df.age.between(10, 100), "edad fuera de rango 10-100")
for col, ok in CATS.items():
    marca(~df[col].isin(ok), f"{col} con valor no permitido")
marca(~df.exam_score.between(0, 100), "exam_score fuera de rango 0-100")
marca(~df.previous_exam_score.between(0, 100) & df.previous_exam_score.notna(), "previous_exam_score fuera de rango 0-100")
marca(~df.attendance_percentage.between(0, 100) & df.attendance_percentage.notna(), "asistencia fuera de rango 0-100")
marca(~df.previous_gpa.between(0, 4) & df.previous_gpa.notna(), "GPA fuera de rango 0-4")
marca(~df.sleep_hours.between(0, 24), "sleep_hours fuera de rango 0-24")
marca(~df.study_hours_per_day.between(0, 24), "study_hours_per_day fuera de rango 0-24")
marca(df.questions_correct > df.questions_attempted, "preguntas correctas > intentadas")
marca((df.performance_grade != df.exam_score.map(grade)) | (df.pass_status != df.exam_score.map(passs))
      | (df.performance_level != df.exam_score.map(level)), "grado/estado/nivel no coinciden con exam_score")

rech = df[causa != ""].copy(); rech["causa_rechazo"] = causa[causa != ""]
ok = df[causa == ""].copy()
rech.to_csv(OUT_RECHAZOS, index=False)

# ---------- 3. GUARDAR (staging + upsert idempotente) ----------
def copiar(cur, tabla, frame, cols):
    buf = io.StringIO(); frame[cols].to_csv(buf, index=False, header=False); buf.seek(0)
    with cur.copy(f"COPY {tabla} ({','.join(cols)}) FROM STDIN WITH (FORMAT csv)") as cp:
        cp.write(buf.read())

with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
    cur.execute("CREATE TEMP TABLE stg_s (LIKE students) ON COMMIT DROP")
    cur.execute("CREATE TEMP TABLE stg_r (LIKE academic_records) ON COMMIT DROP")
    cur.execute("ALTER TABLE stg_r DROP COLUMN record_id")
    copiar(cur, "stg_s", ok, STUDENT_COLS)
    copiar(cur, "stg_r", ok, RECORD_COLS)
    cur.execute(f"INSERT INTO students ({','.join(STUDENT_COLS)}) SELECT {','.join(STUDENT_COLS)} FROM stg_s ON CONFLICT (student_id) DO NOTHING")
    nuevos_s = cur.rowcount
    cur.execute(f"INSERT INTO academic_records ({','.join(RECORD_COLS)}) SELECT {','.join(RECORD_COLS)} FROM stg_r ON CONFLICT (student_id, academic_period) DO NOTHING")
    nuevos_r = cur.rowcount
    conn.commit()
    cur.execute("SELECT (SELECT count(*) FROM students),(SELECT count(*) FROM academic_records)")
    en_s, en_r = cur.fetchone()

print("=== RESUMEN ETL ===")
print(f"Registros leídos del CSV      : {total}")
print(f"Aceptados (pasan validación)  : {len(ok)}")
print(f"Rechazados (ver rechazados.csv): {len(rech)}")
if len(rech): print(rech.causa_rechazo.value_counts().to_string())
print(f"Estudiantes nuevos insertados : {nuevos_s}  (ya existían: {len(ok)-nuevos_s})")
print(f"Registros académicos nuevos   : {nuevos_r}  (ya existían: {len(ok)-nuevos_r})")
print(f"Totales en la base            : students={en_s}, academic_records={en_r}")
