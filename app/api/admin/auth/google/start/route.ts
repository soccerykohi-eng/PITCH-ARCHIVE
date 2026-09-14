import { beginGoogleOAuth } from "@/app/google-auth";
import { getRawDb } from "@/db";

export async function GET(request:Request) {
  const linked=await getRawDb().prepare("SELECT 1 FROM admin_google_identities LIMIT 1").first();
  if (!linked) return Response.redirect(new URL("/admin-login?error=google-not-linked",request.url),303);
  const flow=await beginGoogleOAuth(request,{ mode:"admin-login" },true);
  if (!flow) return Response.redirect(new URL("/admin-login?error=google-config",request.url),303);
  return new Response(null,{ status:303,headers:{ location:flow.url,"set-cookie":flow.cookie,"cache-control":"no-store" } });
}
