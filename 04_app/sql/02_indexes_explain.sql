-- Corrección M1: índice para la consulta más usada + plan ANTES y DESPUÉS.
-- Consulta analítica más usada: estudiantes en riesgo (poca asistencia y nota baja).
-- (La búsqueda por student_id ya usa el índice de uq_student_period.)
DROP INDEX IF EXISTS idx_records_riesgo;

-- ANTES: Seq Scan sobre todo academic_records
EXPLAIN (ANALYZE, BUFFERS)
SELECT student_id, attendance_percentage, exam_score FROM academic_records
WHERE attendance_percentage < 60 AND exam_score < 40
ORDER BY exam_score LIMIT 50;

CREATE INDEX idx_records_riesgo ON academic_records (exam_score, attendance_percentage);
ANALYZE academic_records;

-- DESPUÉS: Index Scan sobre idx_records_riesgo
EXPLAIN (ANALYZE, BUFFERS)
SELECT student_id, attendance_percentage, exam_score FROM academic_records
WHERE attendance_percentage < 60 AND exam_score < 40
ORDER BY exam_score LIMIT 50;
