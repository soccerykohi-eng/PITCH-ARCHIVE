import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic="force-dynamic";

const MILESTONES=[
  { id:1010,count:10,reward:100 },
  { id:1025,count:25,reward:250 },
  { id:1050,count:50,reward:500 },
  { id:1100,count:100,reward:1000 },
];

async function state(email:string) {
  const db=getRawDb();
  const [owned,claims,points]=await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM collection WHERE user_email=?").bind(email).first<{ count:number }>(),
    db.prepare("SELECT milestone FROM collection_milestone_claims WHERE user_email=?").bind(email).all<{ milestone:number }>(),
    db.prepare("SELECT points FROM users WHERE email=?").bind(email).first<{ points:number }>(),
  ]);
  const ownedCount=owned?.count ?? 0;
  const claimed=new Set(claims.results.map((item) => item.milestone));
  return {
    owned:ownedCount,
    coins:points?.points ?? 0,
    milestones:MILESTONES.map((item) => ({ ...item,claimed:claimed.has(item.id),available:ownedCount>=item.count && !claimed.has(item.id) })),
  };
}

export async function GET() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  return Response.json(await state(member.email));
}

export async function POST(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const milestone=Number((await request.json().catch(() => null) as { milestone?:number } | null)?.milestone);
  const item=MILESTONES.find((entry) => entry.id===milestone);
  if (!item) return Response.json({ error:"報酬を確認してください" },{ status:400 });
  const current=await state(member.email);
  if (current.owned<item.count) return Response.json({ error:`あと${item.count-current.owned}種類必要です` },{ status:409 });
  if (current.milestones.find((entry) => entry.id===milestone)?.claimed) return Response.json({ error:"この報酬は受取済みです" },{ status:409 });
  const db=getRawDb();
  await db.batch([
    db.prepare("INSERT INTO collection_milestone_claims (user_email,milestone,claimed_at) VALUES (?,?,?)").bind(member.email,milestone,Date.now()),
    db.prepare("UPDATE users SET points=points+? WHERE email=?").bind(item.reward,member.email),
  ]);
  return Response.json(await state(member.email));
}
