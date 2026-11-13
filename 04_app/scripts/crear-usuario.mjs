// Crea una cuenta desde la terminal (sirve para el PRIMER administrativo; los demás se crean desde el panel).
// Uso:
//   npm run crear-usuario -- --rol admin --email admin@colegio.edu --nombre "Ana Admin" --clave "Clave123"
//   npm run crear-usuario -- --rol student --email est@colegio.edu --nombre "Luis" --clave "Clave123" --estudiante STU_000001
import pg from "pg";
import bcrypt from "bcryptjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const { rol, email, nombre, clave, estudiante } = args;
const uso = () => { console.error('Uso: --rol admin|teacher|student --email X --nombre "X" --clave X [--estudiante STU_...]'); process.exit(1); };
if (!["admin", "teacher", "student"].includes(rol) || !email || !nombre || !clave) uso();
if (rol === "student" && !estudiante) { console.error("Para un estudiante indica --estudiante STU_..."); process.exit(1); }
if (clave.length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) { console.error("La clave necesita 8+ caracteres con letras y números"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL (ponla en .env.local)"); process.exit(1); }

const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, student_id) VALUES ($1,$2,$3,$4,$5) RETURNING user_id, email, role, student_id`,
    [email.trim().toLowerCase(), await bcrypt.hash(clave, 10), nombre.trim(), rol, rol === "student" ? estudiante.toUpperCase() : null]);
  await client.query(
    `INSERT INTO audit_log (user_email, user_role, action, entity_type, entity_id, details)
     VALUES ('terminal', 'sistema', 'usuario.creado', 'user', $1, $2)`,
    [String(rows[0].user_id), JSON.stringify({ email: rows[0].email, role: rol, student_id: rows[0].student_id, origen: "scripts/crear-usuario.mjs" })]);
  await client.query("COMMIT");
  console.log("Cuenta creada:", rows[0]);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("No se creó la cuenta:", err.constraint || "", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
