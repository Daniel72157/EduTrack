# EduTrack · Momento 3

Next.js 14 + PostgreSQL (Supabase). Plataforma de seguimiento académico con **cuentas por rol**, **varios reportes por estudiante**, **solicitudes de cambio con aprobación** y **bitácora de auditoría inmutable**.

Carpetas: `01_dataset` (CSV), `02_notebook`, `03_informe`, `04_app` (app + SQL + ETL).

## Roles

| Rol | Puede |
|-----|-------|
| **Estudiante** | Ver sus notas y todos sus reportes académicos. Solicitar cambios a su información personal (con razón). Ver y cancelar sus solicitudes. Cambiar su contraseña. |
| **Profesor** | Buscar estudiantes y ver sus fichas. Subir reportes nuevos. Solicitar **modificar** o **eliminar** un reporte, siempre con una razón. Ver y cancelar sus solicitudes. |
| **Administrativo** | Aprobar o rechazar solicitudes (al aprobar, el cambio se aplica; para rechazar debe escribir un motivo). Ver toda la información (estudiantes, reportes, estadísticas). Crear, activar, desactivar y restablecer cuentas. Consultar, filtrar y exportar la **bitácora**. |

Ningún cambio a un reporte existente o a un perfil se aplica sin la aprobación de un administrativo.

## Cómo funciona

- **Sesión:** JWT firmado con `AUTH_SECRET` en una cookie httpOnly que dura 8 h, y contraseñas con bcrypt. Tras 5 intentos fallidos en 15 minutos, el correo queda bloqueado temporalmente. El middleware protege `/estudiante`, `/profesor` y `/admin`, y cada API vuelve a verificar el rol y que la cuenta siga activa: desactivar a alguien corta su sesión al instante.
- **Varios reportes:** cada reporte tiene periodo, asignatura y evaluación. La base exige `UNIQUE (student_id, academic_period, subject, evaluation)`. Los datos del CSV quedan como asignatura `General`, evaluación `Examen`.
- **Solicitudes (`change_requests`):** guardan la razón, los valores propuestos y la foto de los valores anteriores. La base solo permite **una solicitud pendiente por elemento**. Al aprobar, el cambio se revalida y se aplica en **una transacción** junto con su registro en la bitácora; si la base lo rechaza, no se aplica nada y la solicitud sigue pendiente.
- **Bitácora (`audit_log`):** guarda quién, qué, cuándo, IP, navegador y detalles con el **antes y el después**. Registra inicios de sesión (también los fallidos), consultas de fichas, búsquedas, reportes creados, modificados y eliminados, solicitudes y su resolución, cambios de cuentas, accesos denegados y consultas a la propia bitácora. Un trigger impide hacer `UPDATE` o `DELETE` sobre ella.

## Momento 3
La guía de entrega (los 7 pasos, qué mostrar, qué se corrigió del Momento 2 y el guion del video) está en [`04_app/docs/momento3.md`](04_app/docs/momento3.md). Novedades:
- **Carga masiva de cuentas** (Usuarios → Carga masiva): reglas deterministas, simulación previa, pendientes con motivo, sin duplicados al repetir la carga y contraseñas temporales de un solo uso. Archivo de prueba: `04_app/docs/ejemplo_cuentas.csv`.
- **Seguridad:** textos con HTML o código rechazados, cabeceras CSP, y la tarjeta *Resumen → Pruebas de seguridad* que lo demuestra (inyección SQL, script en formulario, hash bcrypt).

## 1. Base de datos (Supabase)
1. Crea un proyecto en supabase.com.
2. En el SQL Editor, ejecuta **en orden**:
   1. `04_app/sql/01_schema.sql`: tablas base.
   2. `04_app/sql/03_roles_auditoria.sql`: usuarios, solicitudes, bitácora y varios reportes. Es idempotente y sirve también sobre una base que ya tiene datos.
   3. `04_app/sql/04_momento3.sql`: contraseñas temporales (cambio obligatorio en el primer ingreso).
3. Project Settings > Database > Connection string. Copia dos cadenas:
   - **Session pooler / Direct (puerto 5432):** para el ETL.
   - **Transaction pooler (puerto 6543):** para la app.

## 2. Cargar los datos (ETL repetible)
```bash
cd 04_app
pip install -r etl/requirements.txt
export DATABASE_URL="postgresql://...:5432/postgres"   # PowerShell: $env:DATABASE_URL="..."
python etl/etl.py     # imprime leídos / aceptados / rechazados / nuevos
python etl/etl.py     # 2.ª vez: 0 nuevos (no duplica)
```
Luego ejecuta `sql/02_indexes_explain.sql` y guarda capturas del plan antes y después.

## 3. App en local
```bash
cd 04_app
cp .env.example .env.local    # pega DATABASE_URL (puerto 6543) y un AUTH_SECRET largo
npm install
# Primer administrativo (las demás cuentas se crean desde el panel):
npm run crear-usuario -- --rol admin --email admin@colegio.edu --nombre "Ana Admin" --clave "Clave1234"
npm run dev                   # http://localhost:3000
```
Genera `AUTH_SECRET` con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

Para dar cuenta a un estudiante del dataset: **Usuarios > Nueva cuenta > Estudiante > Vincular a una ficha existente** (p. ej. `STU_000001`). También se puede crear una ficha nueva (`STU_W000001`…).

## 4. Desplegar en Vercel
1. Sube el proyecto a GitHub. Si subes toda la carpeta `EduTrack`, en Vercel pon **Root Directory = 04_app**.
2. En Settings > Environment Variables define `DATABASE_URL` (Transaction pooler, 6543) y `AUTH_SECRET`.
3. Deploy. Nunca subas `.env.local`.

## API
| Método y ruta | Rol | Qué hace |
|---------------|-----|----------|
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/password` | todos | Sesión y contraseña |
| `GET /api/students?q=&con_cuenta=1&page=` | profesor, admin | Buscar estudiantes |
| `GET /api/students/:id` | estudiante (solo el suyo), profesor, admin | Ficha con todos sus reportes |
| `POST /api/records` | profesor | Subir un reporte |
| `GET /api/requests?status=` · `POST /api/requests` | todos / profesor, estudiante | Listar o crear solicitudes de cambio |
| `POST /api/requests/:id` `{decision: approve\|reject\|cancel}` | admin (cancel: el autor) | Resolver una solicitud |
| `GET/POST /api/users` · `PATCH /api/users/:id` | admin | Gestionar cuentas |
| `POST /api/users/bulk` `{csv, dry_run}` | admin | Carga masiva de cuentas de estudiante (máx. 100 filas) |
| `POST /api/demo-seguridad` | admin | Pruebas de seguridad sin modificar datos |
| `GET /api/logs?action=&email=&role=&entity_type=&entity_id=&from=&to=&format=csv` | admin | Bitácora |
| `GET /api/stats` · `POST /api/demo-rechazo` | admin | Resumen y prueba de integridad (nota 150 → CHECK + ROLLBACK) |

Todo usa consultas parametrizadas, y las claves vienen de variables de entorno.
