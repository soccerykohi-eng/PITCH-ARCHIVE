import { requireApprovedMember } from "@/app/server-auth";
import { getBucket } from "@/app/server-data";
import { getRawDb } from "@/db";

export async function GET(_request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const { id }=await params;
  const owner=await getRawDb().prepare("SELECT email FROM users WHERE avatar_key=? AND status='approved'").bind(id).first();
  if (!owner) return new Response("Not found",{ status:404 });
  const object=await getBucket().get(`avatars/${id}`);
  if (!object) return new Response("Not found",{ status:404 });
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag",object.httpEtag);
  headers.set("cache-control","private, max-age=3600");
  headers.set("x-content-type-options","nosniff");
  return new Response(object.body,{ headers });
}
