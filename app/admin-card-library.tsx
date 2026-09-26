"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { SharedCard } from "./types";

export type CatalogCard=SharedCard & { packCount:number;ownerCount:number };
const CARDS_PER_PAGE=12;

type EditValues={ name:string;position:string;country:string;team:string;rarity:string;series:string };
type PurgeImpact={ owners:number;copies:number;packs:number;openingsPreserved:number;claimsPreserved:number;trades:number;exchangeOffers:number;activePacks:number };

function valuesFrom(card:CatalogCard):EditValues {
  return { name:card.name,position:card.position,country:card.country,team:card.team,rarity:card.rarity,series:card.series };
}

export default function AdminCardLibrary({ cards,onChanged,onNotice }:{ cards:CatalogCard[];onChanged:()=>void;onNotice:(message:string)=>void }) {
  const [search,setSearch]=useState("");
  const [rarity,setRarity]=useState("ALL");
  const [usage,setUsage]=useState("ALL");
  const [sort,setSort]=useState("newest");
  const [page,setPage]=useState(1);
  const [editCard,setEditCard]=useState<CatalogCard|null>(null);
  const [values,setValues]=useState<EditValues|null>(null);
  const [deleteCard,setDeleteCard]=useState<CatalogCard|null>(null);
  const [purgeCard,setPurgeCard]=useState<CatalogCard|null>(null);
  const [purgeImpact,setPurgeImpact]=useState<PurgeImpact|null>(null);
  const [purgeConfirm,setPurgeConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const visible=useMemo(() => {
    const query=search.trim().toLocaleLowerCase();
    const filtered=cards.filter((card) => {
      const usageMatch=usage === "ALL" || (usage === "unused" && card.packCount === 0 && card.ownerCount === 0) || (usage === "pack" && card.packCount > 0) || (usage === "owned" && card.ownerCount > 0);
      return usageMatch && (rarity === "ALL" || card.rarity === rarity) && (!query || `${card.name} ${card.team} ${card.country} ${card.series} ${card.id}`.toLocaleLowerCase().includes(query));
    });
    return [...filtered].sort((a,b) => sort === "name" ? a.name.localeCompare(b.name,"ja") : 0);
  },[cards,rarity,search,sort,usage]);
  const pageCount=Math.max(1,Math.ceil(visible.length/CARDS_PER_PAGE));
  const currentPage=Math.min(page,pageCount);
  const pagedCards=visible.slice((currentPage-1)*CARDS_PER_PAGE,currentPage*CARDS_PER_PAGE);

  function openEdit(card:CatalogCard) { setEditCard(card);setValues(valuesFrom(card)); }
  function update(key:keyof EditValues,value:string) { setValues((current) => current ? { ...current,[key]:value } : current); }

  async function save() {
    if (!editCard || !values) return;
    setBusy(true);
    try {
      const response=await fetch("/api/admin/cards",{ method:"PATCH",headers:{ "content-type":"application/json" },body:JSON.stringify({ id:editCard.id,...values }) });
      const result=await response.json();
      if (!response.ok) return onNotice(result.error ?? "カード情報を保存できませんでした");
      setEditCard(null);setValues(null);onNotice("カード情報を更新しました");onChanged();
    } catch { onNotice("通信に失敗しました。もう一度お試しください"); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteCard) return;
    setBusy(true);
    try {
      const response=await fetch(`/api/admin/cards?id=${encodeURIComponent(deleteCard.id)}`,{ method:"DELETE" });
      const result=await response.json();
      if (!response.ok) return onNotice(result.error ?? "カードを削除できませんでした");
      setDeleteCard(null);onNotice("登録済みカードを削除しました");onChanged();
    } catch { onNotice("通信に失敗しました。もう一度お試しください"); }
    finally { setBusy(false); }
  }

  async function openPurge(card:CatalogCard) {
    setPurgeCard(card);setPurgeImpact(null);setPurgeConfirm("");
    try {
      const response=await fetch(`/api/admin/cards/purge?id=${encodeURIComponent(card.id)}`,{ cache:"no-store" });
      const result=await response.json();
      if (!response.ok) { setPurgeCard(null);return onNotice(result.error ?? "削除対象を確認できませんでした"); }
      setPurgeImpact(result.impact);
    } catch { setPurgeCard(null);onNotice("通信に失敗しました。もう一度お試しください"); }
  }

  async function purge() {
    if (!purgeCard || !purgeImpact || purgeConfirm !== purgeCard.name) return;
    setBusy(true);
    try {
      const response=await fetch("/api/admin/cards/purge",{ method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify({ id:purgeCard.id,confirmName:purgeConfirm }) });
      const result=await response.json();
      if (!response.ok) return onNotice(result.error ?? "カードを完全削除できませんでした");
      setPurgeCard(null);setPurgeImpact(null);setPurgeConfirm("");
      onNotice(result.imageDeleted === false ? "カードを完全削除しました（画像削除のみ失敗）" : "カードを全ユーザーから完全削除しました");onChanged();
    } catch { onNotice("通信に失敗しました。もう一度お試しください"); }
    finally { setBusy(false); }
  }

  return <section className="admin-compact-panel card-library-panel"><div className="admin-compact-title"><div><h3>登録済みカード</h3><p>情報の編集・使用状況の確認・削除</p></div><span>{visible.length} / {cards.length}</span></div><div className="card-library-tools"><Input value={search} onChange={(event) => { setSearch(event.target.value);setPage(1); }} placeholder="選手名・クラブ・IDで検索" aria-label="登録カードを検索" /><select value={rarity} onChange={(event) => { setRarity(event.target.value);setPage(1); }} aria-label="レアリティで絞り込み"><option value="ALL">全レアリティ</option><option value="CORE">CORE</option><option value="RARE">RARE</option><option value="ELITE">ELITE</option><option value="ICON">ICON</option></select><select value={usage} onChange={(event) => { setUsage(event.target.value);setPage(1); }} aria-label="使用状況で絞り込み"><option value="ALL">すべての状態</option><option value="pack">パック収録中</option><option value="owned">所持者あり</option><option value="unused">未使用・削除可能</option></select><select value={sort} onChange={(event) => { setSort(event.target.value);setPage(1); }} aria-label="カードの並び順"><option value="newest">登録順</option><option value="name">名前順</option></select></div>{visible.length ? <><div className="card-library-grid">{pagedCards.map((card) => { const inUse=card.packCount > 0 || card.ownerCount > 0;return <article key={card.id}><img src={card.imageUrl} alt={`${card.name}のカード`} loading="lazy" decoding="async" /><div><span>{card.rarity}</span><strong>{card.name}</strong><small>{card.team || card.country}</small><em>パック {card.packCount} · 所持者 {card.ownerCount}</em><b className={inUse ? "card-use-badge is-used" : "card-use-badge"}>{inUse ? "使用中" : "削除可能"}</b></div><div className="card-library-actions"><Button variant="outline" onClick={() => openEdit(card)}>編集</Button><Button variant="outline" disabled={inUse} title={inUse ? "使用中のため削除できません" : undefined} onClick={() => setDeleteCard(card)}>{inUse ? "保護中" : "削除"}</Button><Button variant="outline" className="card-purge-button" onClick={() => void openPurge(card)}>完全削除</Button></div></article>; })}</div>{pageCount > 1 ? <div className="admin-pagination card-library-pagination"><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>前へ</Button><span>{currentPage} / {pageCount}</span><Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}>次へ</Button></div> : null}</> : <p className="ops-empty">条件に合うカードはありません</p>}
    <Dialog open={Boolean(editCard)} onOpenChange={(open) => { if (!open) { setEditCard(null);setValues(null); } }}><DialogContent className="card-edit-dialog">{editCard && values ? <><DialogHeader><p className="section-kicker">CARD EDITOR</p><DialogTitle>{editCard.name}</DialogTitle><DialogDescription>カードIDと画像は変更されません。</DialogDescription></DialogHeader><div className="card-edit-layout"><img src={editCard.imageUrl} alt="" /><div className="card-edit-form"><label>選手名<Input value={values.name} onChange={(event) => update("name",event.target.value)} /></label><label>ポジション<Input value={values.position} onChange={(event) => update("position",event.target.value)} /></label><label>国<Input value={values.country} onChange={(event) => update("country",event.target.value)} /></label><label>チーム<Input value={values.team} onChange={(event) => update("team",event.target.value)} /></label><label>レアリティ<select value={values.rarity} onChange={(event) => update("rarity",event.target.value)}><option>CORE</option><option>RARE</option><option>ELITE</option><option>ICON</option></select></label><label>シリーズ<Input value={values.series} onChange={(event) => update("series",event.target.value)} /></label></div></div><Button className="card-edit-save" disabled={busy || !values.name.trim() || !values.position.trim() || !values.country.trim() || !values.series.trim()} onClick={() => void save()}>{busy ? "保存中…" : "変更を保存"}</Button></> : null}</DialogContent></Dialog>
    <AlertDialog open={Boolean(deleteCard)} onOpenChange={(open) => { if (!open) setDeleteCard(null); }}><AlertDialogContent className="delete-pack-dialog"><AlertDialogHeader><AlertDialogTitle>「{deleteCard?.name}」を削除しますか？</AlertDialogTitle><AlertDialogDescription>登録情報とカード画像を削除します。この操作は元に戻せません。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>戻る</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void remove()}>{busy ? "削除中…" : "カードを削除"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(purgeCard)} onOpenChange={(open) => { if (!open && !busy) { setPurgeCard(null);setPurgeImpact(null);setPurgeConfirm(""); } }}><AlertDialogContent className="delete-pack-dialog card-purge-dialog"><AlertDialogHeader><AlertDialogTitle>カードを完全削除</AlertDialogTitle><AlertDialogDescription>「{purgeCard?.name}」をすべてのユーザーのコレクション、パック、交換・トレードから削除します。</AlertDialogDescription></AlertDialogHeader>{purgeImpact ? <><dl><div><dt>所有者</dt><dd>{purgeImpact.owners}人</dd></div><div><dt>合計枚数</dt><dd>{purgeImpact.copies}枚</dd></div><div><dt>収録パック</dt><dd>{purgeImpact.packs}</dd></div><div><dt>関連トレード</dt><dd>{purgeImpact.trades}</dd></div><div><dt>交換所掲載</dt><dd>{purgeImpact.exchangeOffers}</dd></div><div><dt>開封履歴</dt><dd>{purgeImpact.openingsPreserved}件</dd></div><div><dt>旧パック履歴</dt><dd>{purgeImpact.claimsPreserved}件</dd></div></dl><p className="purge-history-note">過去のパック開封回数は維持されます。</p>{purgeImpact.activePacks ? <p className="purge-blocked-note">公開中または公開予定のパックに含まれるため、現在は完全削除できません。</p> : <label>確認のためカード名を入力してください<Input value={purgeConfirm} disabled={busy} onChange={(event) => setPurgeConfirm(event.target.value)} /></label>}</> : <p className="purge-loading">影響範囲を確認中…</p>}<p className="purge-danger-note">この操作は元に戻せません。</p><AlertDialogFooter><AlertDialogCancel disabled={busy}>戻る</AlertDialogCancel><AlertDialogAction disabled={busy || !purgeImpact || purgeImpact.activePacks > 0 || purgeConfirm !== purgeCard?.name} onClick={() => void purge()}>{busy ? "完全削除中…" : "完全削除する"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
