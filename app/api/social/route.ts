import { requireApprovedMember } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getCollection, imageUrl } from "@/app/server-data";
import { getRawDb } from "@/db";
import { sendPush } from "@/app/push";
import type { SharedCard } from "@/app/types";

export const dynamic = "force-dynamic";

type UserRow = { email:string;displayName:string;avatarKey:string|null;lastActiveAt:number|null };
type FriendshipRow = { userAEmail:string;userBEmail:string;requestedBy:string;status:"pending"|"accepted" };
type TradeRow = { id:string;proposerEmail:string;recipientEmail:string;offeredCardId:string;requestedCardId:string;status:"pending"|"accepted"|"declined"|"cancelled";createdAt:number };
type CardRow = Omit<SharedCard,"imageUrl"> & { imageKey:string };

const FRIEND_ID_CHARS="23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createFriendId() {
  const bytes=crypto.getRandomValues(new Uint8Array(8));
  return `PA-${Array.from(bytes,(byte) => FRIEND_ID_CHARS[byte%FRIEND_ID_CHARS.length]).join("")}`;
}

async function ensureFriendId(db:D1Database,email:string) {
  const current=await db.prepare("SELECT friend_id AS friendId FROM users WHERE email=?").bind(email).first<{ friendId:string|null }>();
  if (current?.friendId) return current.friendId;
  for (let attempt=0;attempt<5;attempt+=1) {
    const friendId=createFriendId();
    try {
      await db.prepare("UPDATE users SET friend_id=? WHERE email=? AND friend_id IS NULL").bind(friendId,email).run();
      const assigned=await db.prepare("SELECT friend_id AS friendId FROM users WHERE email=?").bind(email).first<{ friendId:string|null }>();
      if (assigned?.friendId) return assigned.friendId;
    } catch { /* A rare ID collision is retried. */ }
  }
  throw new Error("friend_id_assignment_failed");
}

function pair(first:string,second:string) {
  return first < second ? [first,second] as const : [second,first] as const;
}

function notification(db:D1Database,userEmail:string,type:"friend"|"trade",title:string,message:string,now:number) {
  return db.prepare("INSERT INTO notifications (id,user_email,type,title,message,destination,created_at) VALUES (?,?,?,?,?,'social',?)")
    .bind(crypto.randomUUID(),userEmail,type,title,message,now);
}

async function cardById(id:string) {
  const row=await getRawDb().prepare(`SELECT id,name,position,country,team,rarity,series,image_key AS imageKey FROM cards WHERE id=?`).bind(id).first<CardRow>();
  return row ? { ...row,imageUrl:imageUrl(row) } : null;
}

async function showcaseFor(email:string) {
  const rows=await getRawDb().prepare(`SELECT c.id,c.name,c.position,c.country,c.team,c.rarity,c.series,c.image_key AS imageKey
    FROM card_showcase s JOIN cards c ON c.id=s.card_id JOIN collection col ON col.user_email=s.user_email AND col.card_id=s.card_id
    WHERE s.user_email=? ORDER BY s.sort_order LIMIT 5`).bind(email).all<CardRow>();
  return rows.results.map((card) => ({ ...card,imageUrl:imageUrl(card) }));
}

export async function GET() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const db=getRawDb();
  const [ownFriendId,friendshipsResult,tradesResult]=await Promise.all([
    ensureFriendId(db,member.email),
    db.prepare(`SELECT user_a_email AS userAEmail,user_b_email AS userBEmail,requested_by AS requestedBy,status FROM friendships WHERE user_a_email=? OR user_b_email=? ORDER BY updated_at DESC`).bind(member.email,member.email).all<FriendshipRow>(),
    db.prepare(`SELECT id,proposer_email AS proposerEmail,recipient_email AS recipientEmail,offered_card_id AS offeredCardId,requested_card_id AS requestedCardId,status,created_at AS createdAt FROM trades WHERE proposer_email=? OR recipient_email=? ORDER BY created_at DESC LIMIT 30`).bind(member.email,member.email).all<TradeRow>(),
  ]);
  const relatedEmails=Array.from(new Set([
    ...friendshipsResult.results.map((friendship) => friendship.userAEmail === member.email ? friendship.userBEmail : friendship.userAEmail),
    ...tradesResult.results.map((trade) => trade.proposerEmail === member.email ? trade.recipientEmail : trade.proposerEmail),
  ]));
  const usersResult=relatedEmails.length
    ? await db.prepare(`SELECT email,display_name AS displayName,avatar_key AS avatarKey,last_seen_at AS lastActiveAt FROM users WHERE status='approved' AND email IN (${relatedEmails.map(() => "?").join(",")})`).bind(...relatedEmails).all<UserRow>()
    : { results:[] as UserRow[] };
  const names=new Map(usersResult.results.map((user) => [user.email,user.displayName]));
  const avatars=new Map(usersResult.results.map((user) => [user.email,user.avatarKey ? `/api/avatar/${encodeURIComponent(user.avatarKey)}` : null]));
  const relationships=new Map<string,{ status:"pending"|"accepted";direction:"incoming"|"outgoing"|"friend" }>();
  for (const friendship of friendshipsResult.results) {
    const other=friendship.userAEmail === member.email ? friendship.userBEmail : friendship.userAEmail;
    relationships.set(other,{ status:friendship.status,direction:friendship.status === "accepted" ? "friend" : friendship.requestedBy === member.email ? "outgoing" : "incoming" });
  }
  const people=usersResult.results.flatMap(({ avatarKey,...user }) => {
    const relationship=relationships.get(user.email)?.direction;
    return relationship ? [{ ...user,avatarUrl:avatarKey ? `/api/avatar/${encodeURIComponent(avatarKey)}` : null,relationship }] : [];
  });
  const friendPeople=people.filter((person) => person.relationship === "friend");
  const friends=(await Promise.all(friendPeople.map(async (person) => { const [cards,showcase]=await Promise.all([getCollection(person.email),showcaseFor(person.email)]);return { ...person,cards,showcase }; }))).sort((first,second) => (second.lastActiveAt ?? 0)-(first.lastActiveAt ?? 0));
  const trades=await Promise.all(tradesResult.results.map(async (trade) => {
    const incoming=trade.recipientEmail === member.email;
    const otherEmail=incoming ? trade.proposerEmail : trade.recipientEmail;
    const [offeredCard,requestedCard]=await Promise.all([cardById(trade.offeredCardId),cardById(trade.requestedCardId)]);
    return { ...trade,direction:incoming ? "incoming" : "outgoing",otherEmail,otherName:names.get(otherEmail) ?? "参加者",otherAvatarUrl:avatars.get(otherEmail) ?? null,offeredCard,requestedCard };
  }));
  return Response.json({ ownFriendId,people,friends,trades,ownShowcase:await showcaseFor(member.email) });
}

export async function POST(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { action?:string;friendId?:string;targetEmail?:string;tradeId?:string;offeredCardId?:string;requestedCardId?:string;cardIds?:string[] } | null;
  const action=String(body?.action ?? "");
  let targetEmail=String(body?.targetEmail ?? "").trim().toLowerCase();
  const db=getRawDb();
  const now=Date.now();

  if (action === "showcase.save") {
    const cardIds=Array.isArray(body?.cardIds) ? body.cardIds.map(String) : [];
    if (cardIds.length>5 || new Set(cardIds).size!==cardIds.length) return Response.json({ error:"お気に入りは5枚まで選べます" },{ status:400 });
    if (cardIds.length) {
      const owned=await db.prepare(`SELECT card_id AS cardId FROM collection WHERE user_email=? AND card_id IN (${cardIds.map(() => "?").join(",")})`).bind(member.email,...cardIds).all<{ cardId:string }>();
      if (owned.results.length!==cardIds.length) return Response.json({ error:"所持していないカードが含まれています" },{ status:409 });
    }
    await db.batch([db.prepare("DELETE FROM card_showcase WHERE user_email=?").bind(member.email),...cardIds.map((cardId,index) => db.prepare("INSERT INTO card_showcase (user_email,card_id,sort_order) VALUES (?,?,?)").bind(member.email,cardId,index))]);
    return Response.json({ ok:true });
  }

  if (action.startsWith("friend.")) {
    if (action === "friend.request") {
      const friendId=String(body?.friendId ?? "").trim().toUpperCase();
      if (!/^PA-[2-9A-HJ-NP-Z]{8}$/.test(friendId)) return Response.json({ error:"フレンドIDを確認してください" },{ status:400 });
      const targetById=await db.prepare("SELECT email FROM users WHERE friend_id=? AND status='approved'").bind(friendId).first<{ email:string }>();
      if (!targetById) return Response.json({ error:"フレンドIDが見つかりません" },{ status:404 });
      targetEmail=targetById.email;
    }
    if (!targetEmail || targetEmail === member.email) return Response.json({ error:"参加者を確認してください" },{ status:400 });
    const target=await db.prepare("SELECT email FROM users WHERE email=? AND status='approved'").bind(targetEmail).first();
    if (!target) return Response.json({ error:"参加者が見つかりません" },{ status:404 });
    const [userA,userB]=pair(member.email,targetEmail);
    const blocked=await db.prepare("SELECT 1 FROM blocks WHERE (blocker_email=? AND blocked_email=?) OR (blocker_email=? AND blocked_email=?)").bind(member.email,targetEmail,targetEmail,member.email).first();
    if (blocked) return Response.json({ error:"この参加者とはフレンド操作ができません" },{ status:403 });
    if (action === "friend.request") {
      const existing=await db.prepare("SELECT status FROM friendships WHERE user_a_email=? AND user_b_email=?").bind(userA,userB).first();
      if (existing) return Response.json({ error:"すでに申請またはフレンド登録されています" },{ status:409 });
      await db.batch([
        db.prepare("INSERT INTO friendships (user_a_email,user_b_email,requested_by,status,created_at,updated_at) VALUES (?,?,?,'pending',?,?)").bind(userA,userB,member.email,now,now),
        notification(db,targetEmail,"friend",`${member.displayName}さんからフレンド申請`,"フレンド画面で申請を確認できます",now),
      ]);
      await sendPush(targetEmail,`${member.displayName}さんからフレンド申請`,`フレンド画面で申請を確認できます`,`social`);
      return Response.json({ ok:true });
    }
    if (action === "friend.accept") {
      const pending=await db.prepare("SELECT requested_by FROM friendships WHERE user_a_email=? AND user_b_email=? AND status='pending'").bind(userA,userB).first<{ requested_by:string }>();
      if (!pending || pending.requested_by !== targetEmail) return Response.json({ error:"承認できる申請がありません" },{ status:409 });
      await db.batch([
        db.prepare("UPDATE friendships SET status='accepted',updated_at=? WHERE user_a_email=? AND user_b_email=?").bind(now,userA,userB),
        notification(db,targetEmail,"friend",`${member.displayName}さんとフレンドになりました`,"カードの確認やトレードができるようになりました",now),
      ]);
      await sendPush(targetEmail,`${member.displayName}さんとフレンドになりました`,`カードの確認やトレードができるようになりました`,`social`);
      return Response.json({ ok:true });
    }
    if (action === "friend.decline" || action === "friend.remove") {
      const statements=[
        db.prepare("DELETE FROM friendships WHERE user_a_email=? AND user_b_email=?").bind(userA,userB),
        db.prepare("UPDATE trades SET status='cancelled',updated_at=? WHERE status='pending' AND ((proposer_email=? AND recipient_email=?) OR (proposer_email=? AND recipient_email=?))").bind(now,member.email,targetEmail,targetEmail,member.email),
      ];
      if (action === "friend.decline") statements.push(notification(db,targetEmail,"friend",`${member.displayName}さんが申請を辞退しました`,"フレンド申請の結果をお知らせします",now));
      await db.batch(statements);
      if (action === "friend.decline") await sendPush(targetEmail,`${member.displayName}さんが申請を辞退しました`,`フレンド申請の結果をお知らせします`,`social`);
      return Response.json({ ok:true });
    }
  }

  if (action === "trade.create") {
    const offeredCardId=String(body?.offeredCardId ?? "");
    const requestedCardId=String(body?.requestedCardId ?? "");
    if (!targetEmail || !offeredCardId || !requestedCardId || offeredCardId === requestedCardId) return Response.json({ error:"交換するカードを確認してください" },{ status:400 });
    const [userA,userB]=pair(member.email,targetEmail);
    const blocked=await db.prepare("SELECT 1 FROM blocks WHERE (blocker_email=? AND blocked_email=?) OR (blocker_email=? AND blocked_email=?)").bind(member.email,targetEmail,targetEmail,member.email).first();
    if (blocked) return Response.json({ error:"この参加者とはトレードできません" },{ status:403 });
    const friendship=await db.prepare("SELECT status FROM friendships WHERE user_a_email=? AND user_b_email=? AND status='accepted'").bind(userA,userB).first();
    if (!friendship) return Response.json({ error:"フレンドとのみ交換できます" },{ status:403 });
    const [offeredOwned,requestedOwned,alreadyRequested,alreadyOwned]=await Promise.all([
      db.prepare("SELECT card_id FROM collection WHERE user_email=? AND card_id=?").bind(member.email,offeredCardId).first(),
      db.prepare("SELECT card_id FROM collection WHERE user_email=? AND card_id=?").bind(targetEmail,requestedCardId).first(),
      db.prepare("SELECT card_id FROM collection WHERE user_email=? AND card_id=?").bind(member.email,requestedCardId).first(),
      db.prepare("SELECT card_id FROM collection WHERE user_email=? AND card_id=?").bind(targetEmail,offeredCardId).first(),
    ]);
    if (!offeredOwned || !requestedOwned) return Response.json({ error:"所持状況が変わったため申請できません" },{ status:409 });
    if (alreadyRequested || alreadyOwned) return Response.json({ error:"どちらかがすでに交換後のカードを所持しています" },{ status:409 });
    const duplicate=await db.prepare("SELECT id FROM trades WHERE proposer_email=? AND recipient_email=? AND offered_card_id=? AND requested_card_id=? AND status='pending'").bind(member.email,targetEmail,offeredCardId,requestedCardId).first();
    if (duplicate) return Response.json({ error:"同じ交換を申請済みです" },{ status:409 });
    await db.batch([
      db.prepare("INSERT INTO trades (id,proposer_email,recipient_email,offered_card_id,requested_card_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?)").bind(crypto.randomUUID(),member.email,targetEmail,offeredCardId,requestedCardId,now,now),
      notification(db,targetEmail,"trade",`${member.displayName}さんからトレード申請`,"交換するカードをフレンド画面で確認してください",now),
    ]);
    await sendPush(targetEmail,`${member.displayName}さんからトレード申請`,`交換するカードをフレンド画面で確認してください`,`social`);
    return Response.json({ ok:true });
  }

  const tradeId=String(body?.tradeId ?? "");
  if (action === "trade.accept") {
    const trade=await db.prepare(`SELECT id,proposer_email AS proposerEmail,recipient_email AS recipientEmail,offered_card_id AS offeredCardId,requested_card_id AS requestedCardId,status FROM trades WHERE id=?`).bind(tradeId).first<TradeRow>();
    if (!trade || trade.recipientEmail !== member.email || trade.status !== "pending") return Response.json({ error:"承認できる交換申請がありません" },{ status:409 });
    const [userA,userB]=pair(trade.proposerEmail,trade.recipientEmail);
    const [friendship,offeredOwned,requestedOwned,proposerAlreadyOwns,recipientAlreadyOwns]=await Promise.all([
      db.prepare("SELECT status FROM friendships WHERE user_a_email=? AND user_b_email=? AND status='accepted'").bind(userA,userB).first(),
      db.prepare("SELECT quantity FROM collection WHERE user_email=? AND card_id=?").bind(trade.proposerEmail,trade.offeredCardId).first<{ quantity:number }>(),
      db.prepare("SELECT quantity FROM collection WHERE user_email=? AND card_id=?").bind(trade.recipientEmail,trade.requestedCardId).first<{ quantity:number }>(),
      db.prepare("SELECT card_id FROM collection WHERE user_email=? AND card_id=?").bind(trade.proposerEmail,trade.requestedCardId).first(),
      db.prepare("SELECT card_id FROM collection WHERE user_email=? AND card_id=?").bind(trade.recipientEmail,trade.offeredCardId).first(),
    ]);
    if (!friendship || !offeredOwned || !requestedOwned || proposerAlreadyOwns || recipientAlreadyOwns) {
      await db.prepare("UPDATE trades SET status='cancelled',updated_at=? WHERE id=? AND status='pending'").bind(now,tradeId).run();
      return Response.json({ error:"所持状況が変わったため、この交換は無効になりました" },{ status:409 });
    }
    const depletedCardIds=[offeredOwned.quantity===1 ? trade.offeredCardId : null,requestedOwned.quantity===1 ? trade.requestedCardId : null].filter((id):id is string => Boolean(id));
    const transferStatements=[
      db.prepare("UPDATE collection SET quantity=quantity-1 WHERE user_email=? AND card_id=? AND quantity>1").bind(trade.proposerEmail,trade.offeredCardId),
      db.prepare("DELETE FROM collection WHERE user_email=? AND card_id=? AND quantity=1").bind(trade.proposerEmail,trade.offeredCardId),
      db.prepare("UPDATE collection SET quantity=quantity-1 WHERE user_email=? AND card_id=? AND quantity>1").bind(trade.recipientEmail,trade.requestedCardId),
      db.prepare("DELETE FROM collection WHERE user_email=? AND card_id=? AND quantity=1").bind(trade.recipientEmail,trade.requestedCardId),
      db.prepare("INSERT INTO collection (user_email,card_id,quantity,source_pack_id,acquired_at) VALUES (?,?,1,NULL,?)").bind(trade.proposerEmail,trade.requestedCardId,now),
      db.prepare("INSERT INTO collection (user_email,card_id,quantity,source_pack_id,acquired_at) VALUES (?,?,1,NULL,?)").bind(trade.recipientEmail,trade.offeredCardId,now),
      db.prepare("UPDATE trades SET status='accepted',updated_at=? WHERE id=? AND status='pending'").bind(now,tradeId),
      notification(db,trade.proposerEmail,"trade",`${member.displayName}さんとのトレードが成立`,"コレクションのカードが交換されました",now),
      auditStatement(db,member.email,"trade.accept","trade",tradeId,`${trade.offeredCardId} ⇄ ${trade.requestedCardId}`),
    ];
    if (depletedCardIds.length) {
      const placeholders=depletedCardIds.map(() => "?").join(",");
      transferStatements.push(db.prepare(`UPDATE trades SET status='cancelled',updated_at=? WHERE id<>? AND status='pending' AND (offered_card_id IN (${placeholders}) OR requested_card_id IN (${placeholders}))`).bind(now,tradeId,...depletedCardIds,...depletedCardIds));
    }
    await db.batch(transferStatements);
    await sendPush(trade.proposerEmail,`${member.displayName}さんとのトレードが成立`,`コレクションのカードが交換されました`,`social`);
    return Response.json({ ok:true });
  }
  if (action === "trade.decline" || action === "trade.cancel") {
    const ownerColumn=action === "trade.decline" ? "recipient_email" : "proposer_email";
    const nextStatus=action === "trade.decline" ? "declined" : "cancelled";
    const trade=await db.prepare("SELECT proposer_email AS proposerEmail,recipient_email AS recipientEmail,status FROM trades WHERE id=?").bind(tradeId).first<{ proposerEmail:string;recipientEmail:string;status:string }>();
    if (!trade || trade.status !== "pending" || (action === "trade.decline" ? trade.recipientEmail : trade.proposerEmail) !== member.email) return Response.json({ error:"操作できる交換申請がありません" },{ status:409 });
    const notifyEmail=action === "trade.decline" ? trade.proposerEmail : trade.recipientEmail;
    await db.batch([
      db.prepare(`UPDATE trades SET status=?,updated_at=? WHERE id=? AND ${ownerColumn}=? AND status='pending'`).bind(nextStatus,now,tradeId,member.email),
      notification(db,notifyEmail,"trade",action === "trade.decline" ? `${member.displayName}さんがトレードを辞退しました` : `${member.displayName}さんがトレード申請を取り消しました`,"フレンド画面でトレード状況を確認できます",now),
    ]);
    await sendPush(notifyEmail,action === "trade.decline" ? `${member.displayName}さんがトレードを辞退しました` : `${member.displayName}さんがトレード申請を取り消しました`,`フレンド画面でトレード状況を確認できます`,`social`);
    return Response.json({ ok:true });
  }
  return Response.json({ error:"操作を確認してください" },{ status:400 });
}
