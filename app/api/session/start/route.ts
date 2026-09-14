export async function POST() {
  return Response.json({ error:"Googleアカウントで続けてください" },{ status:410,headers:{ "cache-control":"no-store" } });
}
