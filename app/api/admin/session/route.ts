import { getAdminAccessKey, getSessionSecret } from "@/app/server-auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isSecureRequest,
  secretsEqual,
  sessionCookie,
} from "@/app/session";

export async function POST(request:Request) {
  const accessKey=String((await request.formData()).get("accessKey") ?? "");
  const expected=getAdminAccessKey();
  const secret=getSessionSecret();
  if (!expected || !secret) return new Response("Admin configuration is unavailable",{ status:500 });
  if (!(await secretsEqual(accessKey,expected)))
    return Response.redirect(new URL("/admin-login?error=1",request.url),303);
  const token=await createAdminSessionToken(secret);
  return new Response(null,{
    status:303,
    headers:{
      location:new URL("/",request.url).toString(),
      "set-cookie":sessionCookie(ADMIN_SESSION_COOKIE,token,ADMIN_SESSION_MAX_AGE,isSecureRequest(request)),
      "cache-control":"no-store",
    },
  });
}
