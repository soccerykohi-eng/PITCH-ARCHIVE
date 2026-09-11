export function auditStatement(db:D1Database,actorEmail:string,action:string,targetType:string,targetId:string,detail="") {
  return db.prepare("INSERT INTO audit_logs (id,actor_email,action,target_type,target_id,detail,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),actorEmail,action,targetType,targetId,detail,Date.now());
}
