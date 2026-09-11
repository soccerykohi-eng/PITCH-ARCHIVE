import { requireApprovedMember } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getImageStore } from "@/app/server-data";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp"]);
const MAX_AVATAR_BYTES=700 * 1024;

export async function PATCH(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { displayName?:string } | null;
  const displayName=String(body?.displayName ?? "").trim().replace(/\s+/g," ");
  if (!displayName) return Response.json({ error:"アカウント名を入力してください" },{ status:400 });
  if (displayName.length > 24) return Response.json({ error:"アカウント名は24文字以内にしてください" },{ status:400 });
  const db=getRawDb();await db.batch([db.prepare("UPDATE users SET display_name=? WHERE email=?").bind(displayName,member.email),auditStatement(db,member.email,"profile.name","user",member.email,displayName)]);
  return Response.json({ ok:true,displayName });
}

export async function PUT(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const form=await request.formData().catch(() => null);
  const avatar=form?.get("avatar");
  if (!(avatar instanceof File)) return Response.json({ error:"画像を選択してください" },{ status:400 });
  if (!ALLOWED_TYPES.has(avatar.type)) return Response.json({ error:"PNG・JPEG・WebP画像を選択してください" },{ status:400 });
  if (avatar.size > MAX_AVATAR_BYTES) return Response.json({ error:"画像を700KB以下にしてください" },{ status:413 });

  const db=getRawDb();
  const current=await db.prepare("SELECT avatar_key AS avatarKey FROM users WHERE email=?").bind(member.email).first<{ avatarKey:string|null }>();
  const avatarKey=crypto.randomUUID();
  await getImageStore().put(`avatars/${avatarKey}`,await avatar.arrayBuffer(),{ metadata:{ contentType:avatar.type } });
  await db.batch([db.prepare("UPDATE users SET avatar_key=? WHERE email=?").bind(avatarKey,member.email),auditStatement(db,member.email,"profile.avatar","user",member.email,"updated")]);
  if (current?.avatarKey) await getImageStore().delete(`avatars/${current.avatarKey}`).catch(() => undefined);
  return Response.json({ ok:true,avatarUrl:`/api/avatar/${encodeURIComponent(avatarKey)}` });
}

export async function DELETE() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const db=getRawDb();
  const current=await db.prepare("SELECT avatar_key AS avatarKey FROM users WHERE email=?").bind(member.email).first<{ avatarKey:string|null }>();
  await db.batch([db.prepare("UPDATE users SET avatar_key=NULL WHERE email=?").bind(member.email),auditStatement(db,member.email,"profile.avatar","user",member.email,"removed")]);
  if (current?.avatarKey) await getImageStore().delete(`avatars/${current.avatarKey}`).catch(() => undefined);
  return Response.json({ ok:true });
}
