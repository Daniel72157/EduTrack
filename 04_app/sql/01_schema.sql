-- EduTrack · Momento 2 · esquema PostgreSQL (Supabase). Idempotente.
-- Corrección M1: la columna se llama internet_access (antes "ernet_access").

CREATE TABLE IF NOT EXISTS students (
  student_id          text PRIMARY KEY,
  age                 smallint NOT NULL,
  gender              text     NOT NULL,
  education_level     text     NOT NULL,
  school_type         text     NOT NULL,
  family_income       text,
  parent_education    text,
  urban_rural         text     NOT NULL,
  internet_access     boolean,
  device_availability text,
  CONSTRAINT ck_student_id  CHECK (student_id ~ '^STU_[0-9A-Z]{6,}$'),
  CONSTRAINT ck_age         CHECK (age BETWEEN 10 AND 100),
  CONSTRAINT ck_gender      CHECK (gender IN ('Female','Male','Other')),
  CONSTRAINT ck_education   CHECK (education_level IN ('High School','Undergraduate')),
  CONSTRAINT ck_school_type CHECK (school_type IN ('Public','Private','Charter')),
  CONSTRAINT ck_urban_rural CHECK (urban_rural IN ('Urban','Suburban','Rural'))
);

CREATE TABLE IF NOT EXISTS academic_records (
  record_id       bigserial PRIMARY KEY,
  student_id      text NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  academic_period text NOT NULL DEFAULT 'CSV-2026',
  previous_exam_score        numeric(6,2),
  previous_gpa               numeric(4,2),
  attendance_percentage      numeric(5,2),
  assignment_completion_rate numeric(5,2),
  class_participation        text,
  study_hours_per_day        numeric(5,2),
  self_study_hours           numeric(5,2),
  private_tuition            boolean,
  online_learning_hours      numeric(5,2),
  study_consistency          text,
  study_environment          text,
  study_method               text,
  revision_frequency         text,
  practice_tests_completed   smallint,
  notes_quality              text,
  sleep_hours                numeric(4,2),
  sleep_quality              text,
  daily_screen_time          numeric(5,2),
  physical_activity_hours    numeric(5,2),
  break_frequency            text,
  stress_level               smallint,
  motivation_level           text,
  educational_app_usage      text,
  online_course_hours        numeric(5,2),
  exam_difficulty            text,
  exam_preparation_days      smallint,
  questions_attempted        smallint,
  questions_correct          smallint,
  time_management_score      numeric(5,2),
  exam_anxiety_level         numeric(4,2),
  exam_score        numeric(5,2) NOT NULL,
  performance_grade char(1)      NOT NULL,
  pass_status       text         NOT NULL,
  performance_level text         NOT NULL,
  CONSTRAINT uq_student_period UNIQUE (student_id, academic_period),
  CONSTRAINT ck_exam_score  CHECK (exam_score BETWEEN 0 AND 100),
  CONSTRAINT ck_prev_score  CHECK (previous_exam_score BETWEEN 0 AND 100),
  CONSTRAINT ck_gpa         CHECK (previous_gpa BETWEEN 0 AND 4),
  CONSTRAINT ck_attendance  CHECK (attendance_percentage BETWEEN 0 AND 100),
  CONSTRAINT ck_assignments CHECK (assignment_completion_rate BETWEEN 0 AND 100),
  CONSTRAINT ck_sleep       CHECK (sleep_hours BETWEEN 0 AND 24),
  CONSTRAINT ck_study_hours CHECK (study_hours_per_day BETWEEN 0 AND 24),
  CONSTRAINT ck_questions   CHECK (questions_correct <= questions_attempted),
  CONSTRAINT ck_derivados   CHECK (
    pass_status = CASE WHEN exam_score >= 50 THEN 'Pass' ELSE 'Fail' END
    AND performance_grade = CASE WHEN exam_score >= 85 THEN 'A' WHEN exam_score >= 75 THEN 'B'
                                 WHEN exam_score >= 65 THEN 'C' WHEN exam_score >= 50 THEN 'D' ELSE 'F' END
    AND performance_level = CASE WHEN exam_score >= 80 THEN 'High' WHEN exam_score >= 60 THEN 'Medium' ELSE 'Low' END)
);

-- Ids de estudiantes creados desde la app: STU_W000001, STU_W000002...
CREATE SEQUENCE IF NOT EXISTS web_student_seq;
