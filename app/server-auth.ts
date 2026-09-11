import { env } from "cloudflare:workers";
import { getChatGPTUser } from "./chatgpt-auth";
import { getRawDb } from "@/db";

export type AppMember = {
  email:string;
  displayName:string;
  avatarUrl:string | null;
  role:"admin" | "player";
  status:"pending" | "approved" | "suspended";
  points:number;
};

type RuntimeEnv = { ADMIN_EMAIL?:string };

export async function getOrCreateMember(): Promise<AppMember | null> {
  const identity = await getChatGPTUser();
  if (!identity) return null;
  const email = identity.email.trim().toLowerCase();
  const adminEmail = String((env as unknown as RuntimeEnv).ADMIN_EMAIL ?? "").trim().toLowerCase();
  const isAdmin = Boolean(adminEmail) && email === adminEmail;
  const db = getRawDb();
  await db.prepare(`INSERT INTO users (email, display_name, role, status, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(email) DO NOTHING`).bind(email,identity.displayName,isAdmin ? "admin" : "player",isAdmin ? "approved" : "pending",Date.now()).run();
  await db.prepare("UPDATE users SET last_seen_at=? WHERE email=?").bind(Date.now(),email).run();
  if (isAdmin) await db.prepare("UPDATE users SET role = 'admin', status = 'approved' WHERE email = ?").bind(email).run();
  const member=await db.prepare("SELECT email, display_name AS displayName, avatar_key AS avatarKey, role, status, points FROM users WHERE email = ?").bind(email).first<Omit<AppMember,"avatarUrl"> & { avatarKey:string | null }>();
  return member ? { email:member.email,displayName:member.displayName,avatarUrl:member.avatarKey ? `/api/avatar/${encodeURIComponent(member.avatarKey)}` : null,role:member.role,status:member.status,points:member.points } : null;
}

export async function requireMember() {
  const member = await getOrCreateMember();
  if (!member) return { member:null,response:Response.json({ error:"ログインが必要です" },{ status:401 }) };
  return { member,response:null };
}

export async function requireApprovedMember() {
  const result = await requireMember();
  if (!result.member || result.response) return result;
  if (result.member.status !== "approved") return { member:result.member,response:Response.json({ error:"運営の承認待ちです" },{ status:403 }) };
  return result;
}

export async function requireAdmin() {
  const result = await requireApprovedMember();
  if (!result.member || result.response) return result;
  if (result.member.role !== "admin") return { member:result.member,response:Response.json({ error:"運営専用です" },{ status:403 }) };
  return result;
}
