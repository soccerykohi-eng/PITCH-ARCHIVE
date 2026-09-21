"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SharedCard } from "../types";

type Card=SharedCard&{price:number;owned:boolean};
export default function ExchangePageClient({initialPoints}:{initialPoints:number}){
  const [points,setPoints]=useState(initialPoints);const [cards,setCards]=useState<Card[]>([]);const [busy,setBusy]=useState("");const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{const [bonus,shop]=await Promise.all([fetch("/api/login-bonus",{cache:"no-store"}),fetch("/api/exchange",{cache:"no-store"})]);if(bonus.ok)setPoints((await bonus.json()).points??0);if(shop.ok)setCards((await shop.json()).cards??[])},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);
  async function exchange(card:Card){setBusy(card.id);const response=await fetch("/api/exchange",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({cardId:card.id})});const result=await response.json();setBusy("");if(!response.ok)return setNotice(result.error??"カードを交換できませんでした");setNotice(`${card.name}を交換しました`);void load()}
  return <main className="route-page"><header className="route-page-header"><a href="/menu">‹ メニュー</a><h1>カード交換所</h1><p><strong>{points}</strong> COINS</p></header>{notice?<p className="route-notice" role="status">{notice}</p>:null}<div className="exchange-grid route-exchange-grid">{cards.map((card)=><article key={card.id}><img src={card.imageUrl} alt="" loading="lazy" decoding="async"/><div><span>{card.rarity}</span><strong>{card.name}</strong><small>{card.owned?"交換済み":card.team||card.country}</small></div><Button disabled={Boolean(busy)||card.owned||points<card.price} onClick={()=>void exchange(card)}>{card.owned?"交換済み":`${card.price} COINS`}</Button></article>)}</div></main>
}
