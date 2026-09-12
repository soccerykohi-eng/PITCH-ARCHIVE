import { requireApprovedMember } from "@/app/server-auth";
import { getImageStore } from "@/app/server-data";
import { getRawDb } from "@/db";

export async function GET(_request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const { id }=await params;
  const owner=await getRawDb().prepare("SELECT email FROM users WHERE avatar_key=? AND status='approved'").bind(id).first();
  if (!owner) return new Response("Not found",{ status:404 });
  const object=await getImageStore().getWithMetadata<{ contentType?:string }>(`avatars/${id}`,"arrayBuffer");
  if (!object.value) return new Response("Not found",{ status:404 });
  const headers=new Headers({ "content-type":object.metadata?.contentType ?? "image/webp" });
  headers.set("cache-control","private, max-age=3600");
  headers.set("x-content-type-options","nosniff");
  return new Response(object.value,{ headers });
}
