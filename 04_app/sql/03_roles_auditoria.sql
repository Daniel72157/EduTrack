-- EduTrack · Momento 3 · cuentas con roles, varios reportes por estudiante,
-- solicitudes de cambio con aprobación y bitácora de auditoría.
-- Idempotente: se puede ejecutar sobre una base nueva (después de 01_schema.sql) o sobre la que ya tiene datos.

-- ============ 1. Varios reportes académicos por estudiante ============
-- Antes: UNIQUE (student_id, academic_period) => un solo reporte por periodo.
-- Ahora: un reporte por (estudiante, periodo, asignatura, evaluación) => muchos reportes por estudiante.
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS subject    text NOT NULL DEFAULT 'General';
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS evaluation text NOT NULL DEFAULT 'Examen';
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS comments   text;
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS created_by bigint;
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE academic_records DROP CONSTRAINT IF EXISTS uq_student_period;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_record_eval') THEN
    ALTER TABLE academic_records ADD CONSTRAINT uq_record_eval UNIQUE (student_id, academic_period, subject, evaluation);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_record_textos') THEN
    ALTER TABLE academic_records ADD CONSTRAINT ck_record_textos CHECK (
      length(btrim(academic_period)) BETWEEN 1 AND 30 AND length(btrim(subject)) BETWEEN 1 AND 60
      AND length(btrim(evaluation)) BETWEEN 1 AND 60);
  END IF;
END $$;
-- La búsqueda por estudiante ya no tiene el índice de la UNIQUE vieja como prefijo exacto: lo cubre uq_record_eval.

-- ============ 2. Usuarios y roles ============
CREATE TABLE IF NOT EXISTS users (
  user_id        bigserial PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  full_name      text NOT NULL,
  role           text NOT NULL,
  student_id     text UNIQUE REFERENCES students(student_id) ON DELETE RESTRICT,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz,
  CONSTRAINT ck_user_role   CHECK (role IN ('student','teacher','admin')),
  CONSTRAINT ck_user_email  CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT ck_user_name   CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
  -- Un estudiante SIEMPRE está ligado a su ficha; profesores y administrativos nunca.
  CONSTRAINT ck_user_student CHECK ((role = 'student') = (student_id IS NOT NULL))
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_record_created_by') THEN
    ALTER TABLE academic_records ADD CONSTRAINT fk_record_created_by
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============ 3. Solicitudes de cambio (requieren aprobación del administrativo) ============
CREATE TABLE IF NOT EXISTS change_requests (
  request_id     bigserial PRIMARY KEY,
  entity_type    text NOT NULL,          -- 'record' (reporte académico) | 'student' (perfil)
  entity_id      text NOT NULL,          -- record_id o student_id
  action         text NOT NULL,          -- 'update' | 'delete'
  changes        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- valores nuevos propuestos
  previous       jsonb,                  -- foto de los valores al momento de solicitar
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  requested_by   bigint NOT NULL REFERENCES users(user_id),
  reviewed_by    bigint REFERENCES users(user_id),
  review_comment text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz,
  CONSTRAINT ck_req_entity CHECK (entity_type IN ('record','student')),
  CONSTRAINT ck_req_action CHECK (action IN ('update','delete') AND NOT (entity_type = 'student' AND action = 'delete')),
  CONSTRAINT ck_req_status CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT ck_req_reason CHECK (length(btrim(reason)) >= 10),
  CONSTRAINT ck_req_review CHECK ((status IN ('approved','rejected')) = (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
-- Solo una solicitud pendiente por elemento: evita aprobar cambios sobre datos que ya cambiaron.
CREATE UNIQUE INDEX IF NOT EXISTS uq_req_pending ON change_requests (entity_type, entity_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_req_status ON change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_req_user   ON change_requests (requested_by, created_at DESC);

-- ============ 4. Bitácora de auditoría (trazabilidad) ============
CREATE TABLE IF NOT EXISTS audit_log (
  log_id      bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  user_id     bigint REFERENCES users(user_id) ON DELETE SET NULL,
  user_email  text,
  user_role   text,
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  details     jsonb,
  ip          text,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS idx_audit_at     ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log (user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_email  ON audit_log (user_email, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);

-- La bitácora es de solo escritura: nadie (ni la app) puede editar o borrar lo que ya quedó registrado.
CREATE OR REPLACE FUNCTION audit_log_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo inserción (intento de %)', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;
DROP TRIGGER IF EXISTS trg_audit_inmutable ON audit_log;
CREATE TRIGGER trg_audit_inmutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_inmutable();
