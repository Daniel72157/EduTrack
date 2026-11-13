import { tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { aplicarSolicitud } from "@/lib/requests";
import { limpiar, tieneCodigo } from "@/lib/validate";
import { fallo, json, leerJson, ruta } from "@/lib/api";

// Resolver una solicitud:
//  - approve / reject: solo administrativos (rechazar exige un comentario).
//  - cancel: solo quien la creó, mientras siga pendiente.
// Aprobar aplica el cambio y lo registra en la bitácora en UNA transacción: si la base rechaza el cambio,
// no se aplica nada y la solicitud sigue pendiente.
export const POST = ruta(async (req, { params, user }) => {
  if (!/^\d+$/.test(params.id)) fallo(400, "Id de solicitud inválido");
  const b = await leerJson(req);
  const decision = b.decision;
  const comentario = limpiar(b.comment) || null;
  if (comentario && tieneCodigo(comentario)) fallo(400, "El comentario no admite etiquetas HTML ni código");
  if (!["approve", "reject", "cancel"].includes(decision)) fallo(400, "decision debe ser approve, reject o cancel");
  if ((decision === "approve" || decision === "reject") && user.role !== "admin") {
    await audit({ user, action: "acceso.denegado", entityType: "request", entityId: params.id, details: { decision }, req });
    fallo(403, "Solo un administrativo puede aprobar o rechazar solicitudes.");
  }
  if (decision === "reject" && (!comentario || comentario.length < 5)) fallo(400, "Indica el motivo del rechazo (mínimo 5 caracteres)");

  const out = await tx(async (db) => {
    const { rows } = await db.query("SELECT * FROM change_requests WHERE request_id = $1 FOR UPDATE", [params.id]);
    const sol = rows[0];
    if (!sol) fallo(404, "La solicitud no existe");
    if (sol.status !== "pending") fallo(409, `La solicitud ya fue resuelta (${sol.status})`);

    if (decision === "cancel") {
      if (sol.requested_by !== user.user_id) fallo(403, "Solo quien creó la solicitud puede cancelarla");
      await db.query("UPDATE change_requests SET status = 'cancelled' WHERE request_id = $1", [sol.request_id]);
      await audit({ db, user, action: "solicitud.cancelada", entityType: sol.entity_type, entityId: sol.entity_id,
        details: { solicitud: sol.request_id }, req });
      return { mensaje: `Solicitud #${sol.request_id} cancelada` };
    }

    let resultado = null;
    if (decision === "approve") resultado = await aplicarSolicitud(db, sol, user, req);
    const estado = decision === "approve" ? "approved" : "rejected";
    await db.query(
      `UPDATE change_requests SET status = $1, reviewed_by = $2, reviewed_at = now(), review_comment = $3 WHERE request_id = $4`,
      [estado, user.user_id, comentario, sol.request_id]);
    await audit({ db, user, action: decision === "approve" ? "solicitud.aprobada" : "solicitud.rechazada",
      entityType: sol.entity_type, entityId: sol.entity_id,
      details: { solicitud: sol.request_id, solicitante: sol.requested_by, comentario }, req });
    return { mensaje: `Solicitud #${sol.request_id} ${decision === "approve" ? "aprobada y aplicada" : "rechazada"}`, resultado };
  });
  return json({ ok: true, ...out });
});
