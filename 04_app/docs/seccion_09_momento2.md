# 09 · Momento 2 (BORRADOR: ajústenlo con sus palabras; cada integrante debe poder explicarlo)

## 9.1 Correcciones
- **Columna `ernet_access`**: ahora es `internet_access` (boolean) en `sql/01_schema.sql`, igual que el CSV.
- **Índice**: `idx_records_riesgo (exam_score, attendance_percentage)` para la consulta de estudiantes en riesgo. Plan en `sql/02_indexes_explain.sql`. Prueba local con 100.000 filas: Seq Scan ≈ 21,8 ms → Index Scan ≈ 1,0 ms. **Vuelvan a medir en Supabase y peguen sus capturas.**
- **Transacción**: implementada en `app/api/students/route.js` (BEGIN, INSERT students, INSERT academic_records, COMMIT; si falla, ROLLBACK).

## 9.2 Operación conectada: registrar estudiante con su registro académico
1. La persona llena el formulario y pulsa Registrar.
2. El programa valida tipos, rangos (notas y asistencia 0-100, edad 10-100) y categorías, y calcula grado, estado y nivel desde `exam_score`.
3. La base abre una transacción, genera `student_id` (`STU_W000001…`) con una secuencia y guarda estudiante y registro; si algo falla no guarda ninguno.
4. Bien: ve el JSON con lo creado. Con rechazo: ve qué capa lo frenó (`app` o `base`), la regla y que no se guardó nada.
Necesidad: un docente u orientador registra un estudiante completo sin dejar datos a medias.

## 9.3 Dónde guardar
Tablas relacionales (PostgreSQL): relación 1 estudiante → N registros por periodo (FK), integridad que la base hace cumplir (CHECK, UNIQUE, FK), consultas con filtros y JOIN, columnas fijas. Un documento (p. ej. MongoDB) da flexibilidad de esquema pero cede integridad referencial y validación centralizada, y aquí el esquema es estable. **Expliquen qué cambiaría si los registros tuvieran campos muy variables.**

## 9.4 Calidad (cada rechazo tiene causa escrita)
Edad fuera de 10-100; `exam_score`, nota previa o asistencia fuera de 0-100; GPA fuera de 0-4; categorías no permitidas; `student_id` inválido; estudiante repetido; correctas > intentadas; grado/estado/nivel que no coinciden con `exam_score`; registro sin estudiante (lo impide la FK). El ETL guarda cada rechazo con `causa_rechazo` en `etl/rechazados.csv`. Los vacíos (p. ej. asistencia nula en 9.863 filas) no se rechazan: son datos opcionales y se guardan como NULL.

## 9.5 Proceso de datos
CSV → limpiar (espacios, tipos) → validar (9.4) → guardar con staging + `INSERT … ON CONFLICT DO NOTHING`.
Primera corrida (prueba local): **100.000 leídos, 100.000 aceptados, 0 rechazados**; 100.000 estudiantes y 100.000 registros nuevos.
Segunda corrida: 100.000 aceptados, **0 nuevos**. **Repitan en Supabase y peguen la salida.**
Nota: `ON CONFLICT` consume valores de la secuencia de `record_id`, por eso puede haber saltos en ese id (no es un error).

## 9.6 Volumen
Hoy: 100.000 estudiantes y 100.000 registros (≈ uno por estudiante). Estimación a futuro (ajústenla): 20.000 estudiantes activos con 2 registros por año = +40.000/año; en 5 años ≈ 300.000. PostgreSQL lo maneja con los índices actuales; el límite práctico a vigilar es el plan gratuito de Supabase (500 MB).

## 9.7 Decisión: qué revisa la base y qué el programa
- **Base (no se puede saltar):** CHECK de rangos y categorías, NOT NULL, PK, UNIQUE (estudiante+periodo), FK, consistencia de derivados. Gana: ninguna app o script futuro mete datos inválidos. Cede: mensajes técnicos y un viaje a la base por error.
- **Programa:** mensajes claros, campos obligatorios, cálculo de grado/estado/nivel. Gana: respuesta rápida y amable. Cede: sola, es evitable. Riesgo: reglas duplicadas; si cambia un rango hay que cambiarlo en dos sitios.

## 9.8 Punto propio: exam_score = 150
- Desde el formulario (operación 1): **lo frena la app** (`frenadoPor: "app"`); no llega a la base.
- Desde `/api/demo-rechazo` (salta la app a propósito): **lo frena la base** con `ck_exam_score` (código 23514), hace ROLLBACK y `filasGuardadas: 0`.
Conclusión: **las dos**, a propósito (defensa en profundidad). Evidencia: capturas de ambas salidas.

## 9.9 Siguiente paso (Momento 3)
Límite: no hay autenticación; cualquiera con la URL puede escribir. Mejora: Supabase Auth + Row Level Security por rol (docente/administrador), más paginación y consultas agregadas (promedio por grupo) para el volumen de 9.6.
