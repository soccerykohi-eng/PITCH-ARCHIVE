import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getRawDb } from "@/db";
import {
  ADMIN_SESSION_COOKIE,
  GUEST_SESSION_COOKIE,
  guestDisplayName,
  guestPrincipal,
  verifyAdminSessionToken,
  verifyGuestSessionToken,
} from "./session";

export type AppMember = {
  email:string;
  displayName:string;
  avatarUrl:string | null;
  role:"admin" | "player";
  status:"pending" | "approved" | "suspended";
  points:number;
};

type RuntimeEnv = { SESSION_SECRET?:string;ADMIN_ACCESS_KEY?:string;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string };

type SessionIdentity =
  | { kind:"guest";email:string;displayName:string }
  | { kind:"admin";email:string;displayName:string };

export function getSessionSecret() {
  return String((env as unknown as RuntimeEnv).SESSION_SECRET ?? "");
}

export function getAdminAccessKey() {
  return String((env as unknown as RuntimeEnv).ADMIN_ACCESS_KEY ?? "");
}

export function getGoogleClient() {
  const runtime=env as unknown as RuntimeEnv;
  return { clientId:String(runtime.GOOGLE_CLIENT_ID ?? ""),clientSecret:String(runtime.GOOGLE_CLIENT_SECRET ?? "") };
}

export async function getSessionIdentity():Promise<SessionIdentity | null> {
  const secret=getSessionSecret();
  if (!secret) return null;
  const cookieStore=await cookies();
  if (await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value,secret)) {
    return { kind:"admin",email:"admin@pitcharchive.local",displayName:"PITCH ARCHIVE ADMIN" };
  }
  const guestId=await verifyGuestSessionToken(cookieStore.get(GUEST_SESSION_COOKIE)?.value,secret);
  return guestId ? { kind:"guest",email:guestPrincipal(guestId),displayName:guestDisplayName(guestId) } : null;
}

export async function getOrCreateMember(): Promise<AppMember | null> {
  const identity = await getSessionIdentity();
  if (!identity) return null;
  const isAdmin = identity.kind === "admin";
  const db = getRawDb();
  await db.prepare(`INSERT INTO users (email, display_name, role, status, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(email) DO NOTHING`).bind(identity.email,identity.displayName,isAdmin ? "admin" : "player","approved",Date.now()).run();
  await db.prepare("UPDATE users SET last_seen_at=? WHERE email=?").bind(Date.now(),identity.email).run();
  if (isAdmin) await db.prepare("UPDATE users SET role = 'admin', status = 'approved' WHERE email = ?").bind(identity.email).run();
  const member=await db.prepare("SELECT email, display_name AS displayName, avatar_key AS avatarKey, role, status, points FROM users WHERE email = ?").bind(identity.email).first<Omit<AppMember,"avatarUrl"> & { avatarKey:string | null }>();
  return member ? { email:member.email,displayName:member.displayName,avatarUrl:member.avatarKey ? `/api/avatar/${encodeURIComponent(member.avatarKey)}` : null,role:member.role,status:member.status,points:member.points } : null;
}

export async function requireMember() {
  const member = await getOrCreateMember();
  if (!member) return { member:null,response:Response.json({ error:"有効なセッションが必要です" },{ status:401 }) };
  return { member,response:null };
}

export async function requireApprovedMember() {
  const result = await requireMember();
  if (!result.member || result.response) return result;
  if (result.member.status !== "approved") return { member:result.member,response:Response.json({ error:"このセッションは利用できません" },{ status:403 }) };
  return result;
}

export async function requireAdmin() {
  const identity=await getSessionIdentity();
  if (identity?.kind !== "admin") return { member:null,response:Response.json({ error:"運営専用です" },{ status:403 }) };
  const result = await requireApprovedMember();
  if (!result.member || result.response) return result;
  if (result.member.role !== "admin") return { member:result.member,response:Response.json({ error:"運営専用です" },{ status:403 }) };
  return result;
}
