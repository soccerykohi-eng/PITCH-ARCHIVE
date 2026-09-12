"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { SharedCard } from "./types";

type Person = { email:string;displayName:string;avatarUrl:string|null;relationship:"none"|"incoming"|"outgoing"|"friend";lastActiveAt?:number|null };
type Friend = Person & { cards:SharedCard[];showcase:SharedCard[] };
type Trade = {
  id:string;direction:"incoming"|"outgoing";otherEmail:string;otherName:string;otherAvatarUrl:string|null;
  status:"pending"|"accepted"|"declined"|"cancelled";createdAt:number;
  offeredCard:SharedCard | null;requestedCard:SharedCard | null;
};
type SocialData = { ownFriendId:string;people:Person[];friends:Friend[];trades:Trade[];ownShowcase:SharedCard[] };
type SafetyData = { blockedPeople:Array<{ email:string;displayName:string;avatarUrl:string|null }> };

function MiniCard({ card,selected,onClick }:{ card:SharedCard;selected?:boolean;onClick?:()=>void }) {
  const content=<><img src={card.imageUrl} alt={`${card.name}のカード`} loading="lazy" decoding="async" /><span><strong>{card.name}</strong><small>{card.rarity} · {card.team || card.country}</small></span></>;
  return onClick ? <button type="button" className={`social-card ${selected ? "is-selected" : ""}`} onClick={onClick}>{content}</button> : <div className="social-card">{content}</div>;
}

function PersonAvatar({ person }:{ person:{ displayName:string;avatarUrl:string|null } }) {
  return person.avatarUrl ? <img className="person-avatar" src={person.avatarUrl} alt="" /> : <div className="person-avatar">{person.displayName.slice(0,1)}</div>;
}

function FriendCard({ friend,ownCards,busy,onTrade,onSafety,onRemove }:{ friend:Friend;ownCards:SharedCard[];busy:boolean;onTrade:(friend:Friend)=>void;onSafety:(friend:Friend)=>void;onRemove:(friend:Friend)=>void }) {
  return <article className="friend-card"><div className="friend-head"><PersonAvatar person={friend} /><div><strong>{friend.displayName}</strong><small>{friend.cards.length}枚所持</small></div><button type="button" onClick={() => onSafety(friend)}>ブロック設定</button><button type="button" onClick={() => onRemove(friend)}>解除</button></div>{friend.showcase.length ? <><span className="showcase-label">FAVORITE SHOWCASE</span><div className="friend-card-strip showcase-strip">{friend.showcase.map((card) => <MiniCard key={card.id} card={card} />)}</div></> : <p className="social-empty">ショーケースは未設定です</p>}<Button disabled={busy || !friend.cards.length || !ownCards.length} onClick={() => onTrade(friend)}>トレードを提案</Button></article>;
}

export default function SocialPanel({ ownCards,onNotice,onCollectionChanged }:{ ownCards:SharedCard[];onNotice:(message:string)=>void;onCollectionChanged:()=>void }) {
  const [data,setData]=useState<SocialData | null>(null);
  const [friendIdInput,setFriendIdInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [tradeFriend,setTradeFriend]=useState<Friend | null>(null);
  const [offeredCardId,setOfferedCardId]=useState("");
  const [requestedCardId,setRequestedCardId]=useState("");
  const [removeFriend,setRemoveFriend]=useState<Friend | null>(null);
  const [acceptTrade,setAcceptTrade]=useState<Trade | null>(null);
  const [safetyData,setSafetyData]=useState<SafetyData>({ blockedPeople:[] });
  const [safetyTarget,setSafetyTarget]=useState<Person | Friend | null>(null);
  const [showAllFriends,setShowAllFriends]=useState(false);
  const [showcaseOpen,setShowcaseOpen]=useState(false);
  const [showcaseIds,setShowcaseIds]=useState<string[]>([]);
  const [socialView,setSocialView]=useState<"friends"|"requests"|"trades">("friends");

  const load=useCallback(async () => {
    const [response,safetyResponse]=await Promise.all([fetch("/api/social",{ cache:"no-store" }),fetch("/api/safety",{ cache:"no-store" })]);
    const result=await response.json();if (response.ok) setData(result);else onNotice(result.error ?? "フレンド情報を読み込めませんでした");
    if (safetyResponse.ok) setSafetyData(await safetyResponse.json());
  },[onNotice]);
  useEffect(() => {
    const controller=new AbortController();
    void Promise.all([
      fetch("/api/social",{ cache:"no-store",signal:controller.signal }),
      fetch("/api/safety",{ cache:"no-store",signal:controller.signal }),
    ]).then(async ([response,safetyResponse]) => {
      const result=await response.json();
      if (response.ok) setData(result);
      else onNotice(result.error ?? "フレンド情報を読み込めませんでした");
      if (safetyResponse.ok) setSafetyData(await safetyResponse.json());
    }).catch((error) => { if (error instanceof Error && error.name !== "AbortError") onNotice("フレンド情報を読み込めませんでした"); });
    return () => controller.abort();
  },[onNotice]);

  async function act(payload:Record<string,unknown>,success:string,collectionChanged=false) {
    setBusy(true);
    try {
      const response=await fetch("/api/social",{ method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify(payload) });
      const result=await response.json();
      if (!response.ok) onNotice(result.error ?? "操作を完了できませんでした");
      else {
        onNotice(success);
        await load();
        if (collectionChanged) onCollectionChanged();
      }
      return response.ok;
    } catch { onNotice("通信に失敗しました。もう一度お試しください");return false; }
    finally { setBusy(false); }
  }

  async function safetyAction(action:"block"|"unblock",targetEmail:string) {
    setBusy(true);try { const response=await fetch("/api/safety",{ method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify({ action,targetEmail }) });const result=await response.json();if (!response.ok) return onNotice(result.error ?? "操作を完了できませんでした");onNotice(action === "block" ? "参加者をブロックしました" : "ブロックを解除しました");setSafetyTarget(null);await load(); } finally { setBusy(false); }
  }

  const incomingFriends=(data?.people ?? []).filter((person) => person.relationship === "incoming");
  const outgoingFriends=(data?.people ?? []).filter((person) => person.relationship === "outgoing");
  const pendingTrades=(data?.trades ?? []).filter((trade) => trade.status === "pending");
  const tradeHistory=(data?.trades ?? []).filter((trade) => trade.status !== "pending").slice(0,6);
  const recentFriends=(data?.friends ?? []).slice(0,3);
  const selectedOffer=useMemo(() => ownCards.find((card) => card.id === offeredCardId),[ownCards,offeredCardId]);
  const selectedRequest=useMemo(() => tradeFriend?.cards.find((card) => card.id === requestedCardId),[tradeFriend,requestedCardId]);

  function beginTrade(friend:Friend) {
    setTradeFriend(friend);setOfferedCardId("");setRequestedCardId("");
  }
  async function submitTrade() {
    if (!tradeFriend || !selectedOffer || !selectedRequest) return;
    const ok=await act({ action:"trade.create",targetEmail:tradeFriend.email,offeredCardId:selectedOffer.id,requestedCardId:selectedRequest.id },"交換申請を送りました");
    if (ok) setTradeFriend(null);
  }

  async function requestFriend() {
    const friendId=friendIdInput.trim().toUpperCase();
    if (!friendId) return onNotice("フレンドIDを入力してください");
    const ok=await act({ action:"friend.request",friendId },"フレンド申請を送りました");
    if (ok) setFriendIdInput("");
  }

  async function copyFriendId() {
    try { await navigator.clipboard.writeText(data?.ownFriendId ?? "");onNotice("フレンドIDをコピーしました"); }
    catch { onNotice("コピーできませんでした。IDを長押ししてコピーしてください"); }
  }
  function openShowcase() { setShowcaseIds(data?.ownShowcase.map((card) => card.id) ?? []);setShowcaseOpen(true); }
  function toggleShowcase(cardId:string) { setShowcaseIds((items) => items.includes(cardId) ? items.filter((id) => id!==cardId) : items.length<5 ? [...items,cardId] : items); }
  function moveShowcase(index:number,offset:number) { setShowcaseIds((items) => { const next=[...items];const target=index+offset;if (target<0||target>=next.length) return items;[next[index],next[target]]=[next[target],next[index]];return next; }); }
  async function saveShowcase() { const ok=await act({ action:"showcase.save",cardIds:showcaseIds },"お気に入りショーケースを保存しました");if (ok) setShowcaseOpen(false); }

  if (!data) return <section className="social-loading">フレンド情報を読み込んでいます</section>;
  return <div className="social-page">
    <section className="network-title social-title"><p className="section-kicker">FRIENDS & TRADES</p><h2>フレンド</h2><p>参加者とつながり、お互いのカードを1枚ずつ交換できます。</p></section>

    {!showAllFriends ? <nav className="social-subnav" aria-label="フレンド画面"><button type="button" className={socialView === "friends" ? "is-active" : ""} aria-pressed={socialView === "friends"} onClick={() => setSocialView("friends")}><span>フレンド</span><b>{data.friends.length}</b></button><button type="button" className={socialView === "requests" ? "is-active" : ""} aria-pressed={socialView === "requests"} onClick={() => setSocialView("requests")}><span>申請</span><b>{incomingFriends.length+outgoingFriends.length}</b></button><button type="button" className={socialView === "trades" ? "is-active" : ""} aria-pressed={socialView === "trades"} onClick={() => setSocialView("trades")}><span>トレード</span><b>{pendingTrades.length}</b></button></nav> : null}

    <section hidden={socialView !== "friends" || showAllFriends} className="social-section own-showcase"><div className="social-section-head"><div><span>MY FAVORITES</span><h3>お気に入りショーケース</h3></div><Button variant="outline" onClick={openShowcase}>編集</Button></div>{data.ownShowcase.length ? <div className="own-showcase-strip">{data.ownShowcase.map((card,index) => <div key={card.id}><em>{index+1}</em><MiniCard card={card} /></div>)}</div> : <p className="social-empty boxed">お気に入りのカードを最大5枚まで展示できます</p>}</section>

    {showAllFriends ? <section className="social-section friend-directory-page"><div className="friend-directory-head"><button type="button" onClick={() => setShowAllFriends(false)}>‹ フレンドへ戻る</button><div><span>ALL FRIENDS</span><h3>すべてのフレンド</h3><p>{data.friends.length}人のフレンドを表示中</p></div></div>{data.friends.length ? <div className="friend-grid friend-directory-grid">{data.friends.map((friend) => <FriendCard key={friend.email} friend={friend} ownCards={ownCards} busy={busy} onTrade={beginTrade} onSafety={setSafetyTarget} onRemove={setRemoveFriend} />)}</div> : <p className="social-empty boxed">フレンドはまだいません</p>}</section> : <>

    {incomingFriends.length ? <section hidden={socialView !== "requests"} className="social-section"><div className="social-section-head"><div><span>REQUESTS</span><h3>フレンド申請</h3></div><b>{incomingFriends.length}</b></div><div className="people-list">{incomingFriends.map((person) => <div className="person-row" key={person.email}><PersonAvatar person={person} /><strong>{person.displayName}</strong><div><Button variant="outline" disabled={busy} onClick={() => void act({ action:"friend.decline",targetEmail:person.email },"申請を辞退しました")}>辞退</Button><Button disabled={busy} onClick={() => void act({ action:"friend.accept",targetEmail:person.email },"フレンドになりました")}>承認</Button></div></div>)}</div></section> : null}

    <section hidden={socialView !== "requests"} className="social-section friend-id-section"><div className="social-section-head"><div><span>FRIEND ID</span><h3>フレンドIDで申請</h3></div></div><p className="friend-id-help">相手から教えてもらったIDを入力してください。参加者の一覧は公開されません。</p><div className="own-friend-id"><span>あなたのフレンドID</span><strong>{data.ownFriendId}</strong><Button variant="outline" onClick={() => void copyFriendId()}>コピー</Button></div><div className="friend-id-form"><Input value={friendIdInput} onChange={(event) => setFriendIdInput(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") void requestFriend(); }} placeholder="PA-XXXXXXXX" aria-label="相手のフレンドID" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={11} /><Button disabled={busy || !friendIdInput.trim()} onClick={() => void requestFriend()}>{busy ? "送信中…" : "申請する"}</Button></div></section>

    {outgoingFriends.length ? <section hidden={socialView !== "requests"} className="social-section"><div className="social-section-head"><div><span>SENT</span><h3>申請中</h3></div><b>{outgoingFriends.length}</b></div><div className="people-list">{outgoingFriends.map((person) => <div className="person-row" key={person.email}><PersonAvatar person={person} /><strong>{person.displayName}</strong><Button variant="outline" disabled={busy} onClick={() => void act({ action:"friend.remove",targetEmail:person.email },"フレンド申請を取り消しました")}>取り消す</Button></div>)}</div></section> : null}

    <section hidden={socialView !== "friends"} className="social-section"><div className="social-section-head"><div><span>RECENTLY ACTIVE</span><h3>最近ゲームを開いたフレンド</h3></div><b>{data.friends.length}</b></div>{data.friends.length ? <><div className="friend-grid">{recentFriends.map((friend) => <FriendCard key={friend.email} friend={friend} ownCards={ownCards} busy={busy} onTrade={beginTrade} onSafety={setSafetyTarget} onRemove={setRemoveFriend} />)}</div>{data.friends.length > 3 ? <button type="button" className="show-all-friends-button" onClick={() => setShowAllFriends(true)}>フレンド全員を見る <span>{data.friends.length}人</span></button> : null}</> : <p className="social-empty boxed">フレンドはまだいません</p>}</section>

    {safetyData.blockedPeople.length ? <section hidden={socialView !== "friends"} className="social-section blocked-section"><div className="social-section-head"><div><span>BLOCKED</span><h3>ブロック中</h3></div><b>{safetyData.blockedPeople.length}</b></div><div className="people-list">{safetyData.blockedPeople.map((person) => <div className="person-row" key={person.email}><PersonAvatar person={person} /><strong>{person.displayName}</strong><Button variant="outline" disabled={busy} onClick={() => void safetyAction("unblock",person.email)}>解除</Button></div>)}</div></section> : null}

    <section hidden={socialView !== "trades"} className="social-section"><div className="social-section-head"><div><span>TRADE OFFERS</span><h3>トレード申請</h3></div><b>{pendingTrades.length}</b></div>{pendingTrades.length ? <div className="trade-list">{pendingTrades.map((trade) => <article className="trade-row" key={trade.id}><div className="trade-name"><span>{trade.direction === "incoming" ? "受信" : "送信"}</span><strong>{trade.otherName}</strong></div><div className="trade-cards"><div><small>{trade.direction === "incoming" ? "受け取る" : "渡す"}</small>{trade.offeredCard ? <MiniCard card={trade.offeredCard} /> : null}</div><b>⇄</b><div><small>{trade.direction === "incoming" ? "渡す" : "受け取る"}</small>{trade.requestedCard ? <MiniCard card={trade.requestedCard} /> : null}</div></div><div className="trade-actions">{trade.direction === "incoming" ? <><Button variant="outline" disabled={busy} onClick={() => void act({ action:"trade.decline",tradeId:trade.id },"交換申請を辞退しました")}>辞退</Button><Button disabled={busy} onClick={() => setAcceptTrade(trade)}>交換する</Button></> : <Button variant="outline" disabled={busy} onClick={() => void act({ action:"trade.cancel",tradeId:trade.id },"交換申請を取り消しました")}>取り消す</Button>}</div></article>)}</div> : <p className="social-empty boxed">進行中のトレードはありません</p>}
      {tradeHistory.length ? <div className="trade-history"><strong>最近の履歴</strong>{tradeHistory.map((trade) => <div key={trade.id}><span>{trade.otherName}</span><small>{trade.status === "accepted" ? "成立" : trade.status === "declined" ? "辞退" : "取消"}</small></div>)}</div> : null}
    </section>
    </>}

    <Dialog open={showcaseOpen} onOpenChange={setShowcaseOpen}><DialogContent className="showcase-dialog"><DialogHeader><p className="section-kicker">MY FAVORITES</p><DialogTitle>お気に入りを選ぶ</DialogTitle><DialogDescription>所持カードから最大5枚を選び、公開する順番を整えます。</DialogDescription></DialogHeader><div className="showcase-order">{showcaseIds.map((id,index) => { const card=ownCards.find((item) => item.id===id);return card ? <div key={id}><span>{index+1}</span><strong>{card.name}</strong><button type="button" aria-label={`${card.name}を前へ`} disabled={index===0} onClick={() => moveShowcase(index,-1)}>↑</button><button type="button" aria-label={`${card.name}を後ろへ`} disabled={index===showcaseIds.length-1} onClick={() => moveShowcase(index,1)}>↓</button></div> : null; })}</div><div className="showcase-picker">{ownCards.map((card) => <MiniCard key={card.id} card={card} selected={showcaseIds.includes(card.id)} onClick={() => toggleShowcase(card.id)} />)}</div><div className="showcase-save"><span>{showcaseIds.length} / 5枚</span><Button disabled={busy} onClick={() => void saveShowcase()}>{busy ? "保存中…" : "ショーケースを保存"}</Button></div></DialogContent></Dialog>

    <Dialog open={Boolean(tradeFriend)} onOpenChange={(open) => { if (!open) setTradeFriend(null); }}><DialogContent className="trade-dialog">{tradeFriend ? <><DialogHeader><p className="section-kicker">NEW TRADE</p><DialogTitle>{tradeFriend.displayName}さんに提案</DialogTitle><DialogDescription>自分が渡すカードと、相手から受け取るカードを1枚ずつ選択します。</DialogDescription></DialogHeader><div className="trade-picker"><section><h4>自分が渡すカード</h4><div>{ownCards.map((card) => <MiniCard key={card.id} card={card} selected={offeredCardId === card.id} onClick={() => setOfferedCardId(card.id)} />)}</div></section><section><h4>受け取りたいカード</h4><div>{tradeFriend.cards.map((card) => <MiniCard key={card.id} card={card} selected={requestedCardId === card.id} onClick={() => setRequestedCardId(card.id)} />)}</div></section></div><Button className="trade-submit" disabled={busy || !selectedOffer || !selectedRequest} onClick={submitTrade}>{busy ? "送信中…" : "この内容で申請する"}</Button></> : null}</DialogContent></Dialog>

    <AlertDialog open={Boolean(removeFriend)} onOpenChange={(open) => { if (!open) setRemoveFriend(null); }}><AlertDialogContent className="delete-pack-dialog"><AlertDialogHeader><AlertDialogTitle>フレンドを解除しますか？</AlertDialogTitle><AlertDialogDescription>{removeFriend ? `${removeFriend.displayName}さんとのフレンド登録を解除します。進行中のトレード申請も取り消されます。` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>戻る</AlertDialogCancel><AlertDialogAction onClick={() => { if (removeFriend) void act({ action:"friend.remove",targetEmail:removeFriend.email },"フレンドを解除しました");setRemoveFriend(null); }}>解除する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(acceptTrade)} onOpenChange={(open) => { if (!open) setAcceptTrade(null); }}><AlertDialogContent className="claim-dialog"><AlertDialogHeader><AlertDialogTitle>このカードを交換しますか？</AlertDialogTitle><AlertDialogDescription>承認すると双方のコレクションがすぐに更新されます。成立後は取り消せません。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>戻る</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => { if (acceptTrade) void act({ action:"trade.accept",tradeId:acceptTrade.id },"トレードが成立しました",true);setAcceptTrade(null); }}>交換を確定</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={Boolean(safetyTarget)} onOpenChange={(open) => { if (!open) setSafetyTarget(null); }}><DialogContent className="safety-dialog">{safetyTarget ? <><DialogHeader><p className="section-kicker">BLOCK</p><DialogTitle>{safetyTarget.displayName}さんをブロック</DialogTitle><DialogDescription>ブロックするとフレンド登録と進行中のトレードも解除されます。</DialogDescription></DialogHeader><div className="block-form"><Button className="block-user-button" disabled={busy} onClick={() => void safetyAction("block",safetyTarget.email)}>この参加者をブロック</Button></div></> : null}</DialogContent></Dialog>
  </div>;
}
