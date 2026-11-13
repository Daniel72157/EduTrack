# EduTrack · Momento evaluativo 3 (texto para el PDF y guía del video)

Cada paso indica **qué decir**, **qué mostrar en la app** (con la captura que debe ir en el PDF) y **dónde está en el código**.
Antes de grabar: ejecutar `sql/03_roles_auditoria.sql` y `sql/04_momento3.sql` en Supabase, definir `AUTH_SECRET` y crear el primer administrativo (ver README).

## Qué corrigieron respecto al Momento 2 (texto corto para el PDF)

En el Momento 2 la propia sección 9.9 reconocía el límite: **no había autenticación y cualquiera con la URL podía escribir o borrar**. Lo corregimos:

1. **Cuentas y roles** (estudiante, profesor, administrativo) con sesión firmada y contraseñas cifradas; antes no existía ninguna.
2. **Un estudiante ahora tiene varios reportes** (periodo + asignatura + evaluación). Antes el UNIQUE `(estudiante, periodo)` permitía uno solo.
3. **Ya no se borra ni se edita nada sin rastro:** toda modificación o eliminación pasa por una solicitud con razón que aprueba un administrativo, y queda en una bitácora que la base no deja alterar.
4. **La demo de rechazo (nota 150) ya no es pública:** solo la ejecuta un administrativo.
5. **Los textos de los formularios** ahora se limpian y se rechazan si traen HTML o código (antes solo se validaban los números).
6. **Datos:** además del ETL por consola, la app tiene una carga masiva de cuentas que no duplica al repetirse.
7. Se eliminó la pantalla única con 5 operaciones sueltas: cada rol tiene su panel.

---

## Paso 1 · La idea
**Problema:** en una institución, las notas y los reportes de cada estudiante viven dispersos; el estudiante no ve su avance, el profesor no deja constancia de por qué corrige una nota y la coordinación no puede saber quién cambió qué.
**Quién la usa:** estudiantes (consultan notas y reportes), profesores (suben reportes y piden correcciones), personal administrativo (aprueba cambios y audita).
**Qué necesita para decidir:** el estudiante, ver todos sus reportes juntos; el profesor, un camino claro para corregir; el administrativo, confianza en que cada cambio tiene razón, autor y fecha.
*Captura:* pantalla de login y panel del estudiante con sus reportes y resumen.

## Paso 2 · La app funcionando (recorrido completo)
Recorrido: **profesor sube un reporte → estudiante lo ve → profesor pide corregir la nota con una razón → administrativo aprueba → el estudiante ve la nota nueva → la bitácora muestra el antes y el después.**
Mostrar además la corrección del Momento 2 (lista de arriba), sobre todo el login y la tabla de varios reportes por estudiante.
*Capturas:* (a) profesor subiendo reporte; (b) solicitud pendiente con tabla antes/después en el panel administrativo; (c) bitácora con el detalle del cambio.
*Código:* `app/api/records`, `app/api/requests`, `lib/requests.js`, `app/admin/bitacora.js`.

## Paso 3 · Los datos (preparación y sin duplicados)
**Cómo se preparan:**
- *ETL del dataset (`etl/etl.py`):* quita espacios, convierte tipos, valida cada fila (rangos, categorías, formato de ID, coherencia nota/grado/estado) y guarda los rechazos con su causa en `rechazados.csv`.
- *Carga masiva de cuentas (`lib/cargaMasiva.js`):* quita espacios y caracteres invisibles, pasa el código a mayúsculas y el correo a minúsculas, detecta separador `,` o `;` y valida cada fila antes de tocar la base.

**Cómo se evita duplicar:** la base lo impone (`PRIMARY KEY`, `UNIQUE(correo)`, `UNIQUE(ficha)`, `UNIQUE(estudiante, periodo, asignatura, evaluación)`) y el ETL usa `ON CONFLICT DO NOTHING`.

**Demostración:**
1. `python etl/etl.py` dos veces: la segunda imprime **0 nuevos**.
2. En *Usuarios → Carga masiva* pegar `docs/ejemplo_cuentas.csv`, pulsar **Crear cuentas**, y volver a pulsar con la misma lista: la segunda vez dice **0 creadas, 2 ya existían** y el total de cuentas no cambia.
*Capturas:* salida de las dos corridas del ETL; resultado de la 1.ª y de la 2.ª carga masiva.

## Paso 4 · Seguridad
**Formularios (evitar que texto se confunda con una orden)** — tres capas:
1. **SQL:** todas las consultas usan parámetros (`$1, $2…`); el texto viaja aparte y nunca se une a la orden. Un `'; DROP TABLE students; --` se busca como texto común.
2. **HTML/JavaScript:** `lib/validate.js` rechaza etiquetas y código (`<script>`, `onerror=`, `javascript:`) y quita caracteres de control; React además escapa lo que dibuja. Un texto legítimo como `nota < 3` sí se acepta.
3. **Navegador:** cabeceras `Content-Security-Policy`, `X-Frame-Options: DENY` y `nosniff` (`next.config.js`).

**Contraseñas:** se guardan con **bcrypt** (costo 10, sal aleatoria): nadie puede leerlas ni revertirlas, y la misma contraseña produce hashes distintos. Las contraseñas temporales son aleatorias, se muestran una sola vez, nunca se escriben en la bitácora y obligan a cambiarlas en el primer ingreso. Además: 5 intentos fallidos bloquean el correo 15 minutos, la sesión es una cookie `httpOnly` de 8 h y desactivar una cuenta corta su sesión.
**Demostración:** panel administrativo → *Resumen → Pruebas de seguridad → Ejecutar pruebas* (muestra A inyección SQL, B script rechazado, C hash bcrypt).
*Capturas:* esa tarjeta; formulario rechazando `<script>`; tabla `users` en Supabase con `password_hash` ilegible.

## Paso 5 · Inteligencia: elegimos **reglas deterministas**
**Tarea repetitiva:** crear una por una las cuentas de los estudiantes. **Beneficia** al administrativo (ahorra horas y errores), a los estudiantes (acceden más rápido) y a los profesores (encuentran a todos registrados).
**Decisión:** *reglas, no inteligencia artificial.* Implementación: *Usuarios → Carga masiva* (`lib/cargaMasiva.js`, `app/api/users/bulk`).

| Si… | Entonces… |
|---|---|
| el código no tiene formato `STU_XXXXXX` | pendiente |
| el nombre está vacío, es muy corto/largo o trae código | pendiente |
| el correo está vacío o mal escrito | pendiente |
| el código o el correo se repite en la lista | pendiente |
| la ficha no existe | pendiente |
| la ficha ya tiene cuenta con ese correo | "ya existía" (no se duplica) |
| la ficha ya tiene cuenta con otro correo, o el correo es de otra cuenta | pendiente |
| ninguna de las anteriores | se crea con contraseña temporal |

**Por qué reglas:** (1) *datos:* solo hay tres campos por fila y no hay historial para entrenar nada; (2) *necesidad del usuario:* el administrativo necesita saber con exactitud por qué una fila no pasó, y una regla da un motivo claro; (3) *límites:* un error aquí entrega acceso a datos personales de menores a la persona equivocada, así que no se acepta un "probablemente bien". La regla además es determinista: la misma lista da siempre el mismo resultado, que es lo que permite repetirla sin duplicar.
**Qué descartamos:** un modelo de IA que "adivine" correos corregidos o emparejamientos (p. ej. `laura.pena.colegio.edu` → `laura.pena@colegio.edu`). No hay datos para entrenarlo, podría adivinar mal sin avisar y un correo equivocado expone información de otra persona. **Cuándo sí valdría la pena:** por ejemplo, para *sugerir* (nunca aplicar) una corrección de correo que el administrativo confirme, o para redactar mensajes personalizados; ambas cosas sin decidir quién recibe acceso.
**Cómo se compararía:** tiempo y errores de crear 100 cuentas a mano frente a la carga masiva.
*Capturas:* simulación con pendientes y motivos; cuentas creadas con el aviso de descargar las contraseñas.

## Paso 6 · Un dato malo
Probar en la app y mostrar la respuesta (la base de datos es la segunda barrera):

| Dato | Qué responde |
|---|---|
| Nota `abc` (formato) | "exam_score debe ser numérico" · no se guarda |
| Nota `-5` o `150` (fuera de rango) | "fuera de rango 0-100" · no se guarda (con `150` directo a la base: `ck_exam_score`, ROLLBACK, botón *Resumen → Intentar guardar nota 150*) |
| Nota ausente (incompleto) | "exam_score es obligatorio" |
| Correo `laura.pena.colegio.edu` en la carga masiva | Fila pendiente: "correo vacío o inválido (falta la @ o el dominio)"; las demás filas sí se procesan |
| Estudiante inexistente | La base lo frena (`academic_records_student_id_fkey`) |
| Mismo reporte dos veces | La base lo frena (`uq_record_eval`) |

El dato malo nunca se guarda "como si fuera bueno": o se rechaza con su causa o queda en pendientes. En el ETL queda en `rechazados.csv`.
*Capturas:* el mensaje de error en el formulario y la tabla de pendientes de la carga masiva.

## Paso 7 · La decisión
**Decisión:** exigir aprobación de un administrativo para cualquier cambio a reportes y perfiles, guardando la solicitud (razón, valores propuestos y valores anteriores) y aplicando el cambio y su rastro en la bitácora **en una sola transacción**.
**Por qué:** la institución necesita responder "quién cambió qué y por qué"; así ningún cambio ocurre sin razón ni autor, y si la base rechaza el cambio no queda nada a medias. Solo se permite una solicitud pendiente por elemento para no aprobar cambios sobre datos que ya cambiaron.
**Qué descartamos:** (a) *editar directo y registrar después:* un error o abuso ya estaría aplicado y la bitácora solo lo documentaría; (b) *marcar registros como "borrados" sin aprobación:* oculta el problema en lugar de controlarlo.
**Otras decisiones menores:** reglas en vez de IA (Paso 5); validar en la app y en la base a la vez (defensa en profundidad).

---

## Guion sugerido para el video (≤ 8 min)
1. (0:45) Idea y roles · 2. (2:00) Recorrido completo y correcciones · 3. (1:15) Datos y repetir la carga · 4. (1:30) Seguridad: pruebas del Resumen, hash bcrypt · 5. (1:00) Reglas vs IA · 6. (0:45) Dato malo · 7. (0:45) La decisión.
Cada integrante debe poder explicar cualquier paso: repasen la tabla del Paso 5 y el flujo de solicitudes.

## Lista para el buzón
- [ ] PDF con una captura por cada uno de los 7 pasos y el texto "qué corrigieron" de arriba.
- [ ] Enlace al repositorio (hacer `commit` y `push`; **no** subir `.env.local`).
- [ ] Buzón cierra el viernes 13 de noviembre de 2026 a las 23:59 (hora de Bogotá).
