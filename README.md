# EduTrack · Momento evaluativo 2

Next.js 14 + PostgreSQL (Supabase). Carpetas: `01_dataset` (CSV), `02_notebook`, `03_informe`, `04_app` (app + SQL + ETL).

## 1. Base de datos (Supabase)
1. Crea un proyecto en supabase.com y guarda la clave de la base.
2. SQL Editor: pega y ejecuta `04_app/sql/01_schema.sql` (crea `students`, `academic_records`, CHECKs, FK, secuencia).
3. Project Settings > Database > Connection string. Copia dos cadenas:
   - **Session pooler / Direct (puerto 5432)**: para el ETL.
   - **Transaction pooler (puerto 6543)**: para la app (Vercel).

## 2. Cargar los datos (ETL repetible)
```bash
cd 04_app
pip install -r etl/requirements.txt
export DATABASE_URL="postgresql://...:5432/postgres"   # PowerShell: $env:DATABASE_URL="..."
python etl/etl.py     # imprime leídos / aceptados / rechazados / nuevos
python etl/etl.py     # 2.ª vez: 0 nuevos (no duplica)
```
Los rechazos (si hay) quedan en `etl/rechazados.csv` con su causa.
Luego ejecuta `sql/02_indexes_explain.sql` en el SQL Editor y guarda captura del plan ANTES y DESPUÉS.

## 3. App en local
```bash
cd 04_app
cp .env.example .env.local    # pega tu DATABASE_URL (puerto 6543)
npm install
npm run dev                   # http://localhost:3000
```

## 4. Desplegar en Vercel
1. Sube el proyecto a GitHub (si subes toda `EduTrack`, en Vercel pon **Root Directory = 04_app**).
2. Vercel > Add New Project > importa el repo.
3. Settings > Environment Variables: `DATABASE_URL` = cadena del Transaction pooler (6543).
4. Deploy. Nunca subas `.env.local` (ya está en `.gitignore`).

## Operaciones (CRUD + rechazo)
| # | Qué | Ruta |
|---|-----|------|
| 1 | Registrar estudiante + registro (1 transacción) | `POST /api/students` |
| 2 | Consultar rendimiento | `GET /api/students/:id` |
| 3 | Actualizar registro | `PATCH /api/records/:record_id` |
| 4 | Rechazo exam_score=150 (la base lo frena, ROLLBACK) | `POST /api/demo-rechazo` |
| 5 | Eliminar estudiante (con sus registros) o un registro | `DELETE /api/students/:id` · `DELETE /api/records/:record_id` |

Todo usa consultas parametrizadas (`$1, $2…`) y la clave viene de `DATABASE_URL`.
