import { getOrCreateMember, getSessionIdentity, getSessionSecret } from "@/app/server-auth";
import {
  createGuestSessionToken,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_MAX_AGE,
  guestDisplayName,
  guestPrincipal,
  isSecureRequest,
  sessionCookie,
} from "@/app/session";
import { getRawDb } from "@/db";

export async function POST(request:Request) {
  const currentIdentity=await getSessionIdentity();
  if (currentIdentity) {
    const member=await getOrCreateMember();
    return Response.json({ created:false,member:member?.email ?? currentIdentity.email });
  }
  const secret=getSessionSecret();
  if (!secret) return Response.json({ error:"Session configuration is unavailable" },{ status:500 });
  const guestId=crypto.randomUUID();
  const email=guestPrincipal(guestId);
  await getRawDb().prepare(`INSERT INTO users (email, display_name, role, status, created_at)
    VALUES (?, ?, 'player', 'approved', ?)
    ON CONFLICT(email) DO NOTHING`).bind(email,guestDisplayName(guestId),Date.now()).run();
  const token=await createGuestSessionToken(guestId,secret);
  return Response.json({ created:true },{
    status:201,
    headers:{
      "set-cookie":sessionCookie(GUEST_SESSION_COOKIE,token,GUEST_SESSION_MAX_AGE,isSecureRequest(request)),
      "cache-control":"no-store",
    },
  });
}
