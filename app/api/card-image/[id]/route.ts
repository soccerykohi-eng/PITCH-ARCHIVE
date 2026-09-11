import { getImageStore } from "@/app/server-data";
import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

export async function GET(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const { id }=await params;
  const card=await getRawDb().prepare("SELECT image_key AS imageKey FROM cards WHERE id = ?").bind(id).first<{ imageKey:string }>();
  if (!card || card.imageKey.startsWith("/")) return new Response("Not found",{ status:404 });
  const object=await getImageStore().getWithMetadata<{ contentType?:string }>(card.imageKey,"arrayBuffer");
  if (!object.value) return new Response("Not found",{ status:404 });
  const headers=new Headers({ "content-type":object.metadata?.contentType ?? "image/webp" });
  const version=new URL(request.url).searchParams.get("v");
  headers.set("cache-control",version === card.imageKey ? "private, max-age=31536000, immutable" : "private, max-age=3600");
  return new Response(object.value,{ headers });
}
