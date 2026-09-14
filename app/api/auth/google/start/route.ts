import { beginGoogleOAuth } from "@/app/google-auth";
import { getSessionIdentity } from "@/app/server-auth";

export async function GET(request:Request) {
  const mode=new URL(request.url).searchParams.get("mode") === "link" ? "link" : "login";
  const identity=await getSessionIdentity();
  if (mode === "link" && identity?.kind !== "guest") return Response.json({ error:"プレイヤーセッションが必要です" },{ status:401 });
  const flow=await beginGoogleOAuth(request,{ mode,userEmail:mode === "link" ? identity?.email : undefined });
  if (!flow) return Response.json({ error:"Googleログイン設定が利用できません" },{ status:503 });
  return new Response(null,{ status:302,headers:{ location:flow.url,"set-cookie":flow.cookie,"cache-control":"no-store" } });
}
