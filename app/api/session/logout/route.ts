import { ADMIN_GOOGLE_VERIFIED_COOKIE,ADMIN_SESSION_COOKIE,GUEST_SESSION_COOKIE,isSecureRequest,sessionCookie } from "@/app/session";

export async function POST(request:Request){const secure=isSecureRequest(request);const headers=new Headers({"cache-control":"no-store"});for(const name of [GUEST_SESSION_COOKIE,ADMIN_SESSION_COOKIE,ADMIN_GOOGLE_VERIFIED_COOKIE])headers.append("set-cookie",sessionCookie(name,"",0,secure));return Response.json({ok:true},{headers})}
