import { getSessionIdentity, getSessionSecret } from "@/app/server-auth";
import {
  createGuestSessionToken,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_MAX_AGE,
  isSecureRequest,
  sessionCookie,
} from "@/app/session";

export async function GET(request:Request) {
  if (await getSessionIdentity())
    return Response.redirect(new URL("/",request.url),302);
  const secret=getSessionSecret();
  if (!secret) return new Response("Session configuration is unavailable",{ status:500 });
  const token=await createGuestSessionToken(crypto.randomUUID(),secret);
  return new Response(null,{
    status:302,
    headers:{
      location:new URL("/",request.url).toString(),
      "set-cookie":sessionCookie(GUEST_SESSION_COOKIE,token,GUEST_SESSION_MAX_AGE,isSecureRequest(request)),
      "cache-control":"no-store",
    },
  });
}
