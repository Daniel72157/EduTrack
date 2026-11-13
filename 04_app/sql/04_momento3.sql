-- EduTrack · Momento 3 · cuentas con contraseña temporal. Idempotente.
-- Las cuentas creadas por carga masiva o con contraseña restablecida por un administrativo
-- obligan a elegir una contraseña propia en el primer ingreso.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
