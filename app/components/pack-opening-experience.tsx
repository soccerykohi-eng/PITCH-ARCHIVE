"use client";

import { useEffect,useRef,useState,type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { PackView,SharedCard } from "../types";

type PackOpeningPhase="ready" | "opening" | "reveal" | "result" | "error" | "closing";
type Props={
  pack:PackView;
  onClaimed:(card:SharedCard | null) => void;
  onClose:() => void;
  onViewCollection:() => void;
};

const THRESHOLD=104;
const MAX_SWIPE=148;
const MIN_OPENING_MS=700;

export default function PackOpeningExperience({ pack,onClaimed,onClose,onViewCollection }:Props) {
  const [phase,setPhase]=useState<PackOpeningPhase>("ready");
  const [swipeDistance,setSwipeDistance]=useState(0);
  const [swiping,setSwiping]=useState(false);
  const [resultCard,setResultCard]=useState<SharedCard | null>(null);
  const [error,setError]=useState("");
  const pointerOrigin=useRef<number | null>(null);
  const requestStarted=useRef(false);

  useEffect(() => {
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return () => { document.body.style.overflow=previous; };
  },[]);

  function close() {
    if (phase === "opening") return;
    setPhase("closing");
    window.setTimeout(onClose,180);
  }
  function viewCollection() {
    setPhase("closing");
    window.setTimeout(onViewCollection,180);
  }

  async function openPack() {
    if (requestStarted.current) return;
    requestStarted.current=true;
    setSwipeDistance(0);
    setSwiping(false);
    setPhase("opening");
    const minimum=new Promise((resolve) => window.setTimeout(resolve,MIN_OPENING_MS));
    try {
      const responsePromise=fetch(`/api/packs/${pack.id}/claim`,{ method:"POST" });
      const [response]=await Promise.all([responsePromise,minimum]);
      const result=await response.json() as { error?:string;cardId?:string };
      if (!response.ok) throw new Error(result.error ?? "パックを開封できませんでした");
      const card=pack.cards.find((item) => item.id === result.cardId) ?? null;
      if (!card) throw new Error("獲得したカードを表示できませんでした");
      setResultCard(card);
      onClaimed(card);
      setPhase("reveal");
      window.setTimeout(() => setPhase("result"),650);
    } catch (cause) {
      await minimum;
      setError(cause instanceof Error ? cause.message : "パックを開封できませんでした");
      setPhase("error");
    }
  }

  function beginSwipe(event:ReactPointerEvent<HTMLDivElement>) {
    if (phase !== "ready") return;
    pointerOrigin.current=event.clientX;
    setSwiping(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveSwipe(event:ReactPointerEvent<HTMLDivElement>) {
    if (pointerOrigin.current === null || phase !== "ready") return;
    setSwipeDistance(Math.max(0,Math.min(MAX_SWIPE,event.clientX-pointerOrigin.current)));
  }
  function endSwipe(event:ReactPointerEvent<HTMLDivElement>) {
    if (pointerOrigin.current === null) return;
    const distance=Math.max(0,Math.min(MAX_SWIPE,event.clientX-pointerOrigin.current));
    pointerOrigin.current=null;
    setSwiping(false);
    if (distance >= THRESHOLD) void openPack();
    else setSwipeDistance(0);
  }
  function cancelSwipe() { pointerOrigin.current=null;setSwiping(false);setSwipeDistance(0); }

  const overlay=(
    <div className={`pack-opening-overlay phase-${phase} rarity-${resultCard?.rarity.toLowerCase() ?? "core"}`} role="dialog" aria-modal="true" aria-label={`${pack.name}のパック開封`}>
      <div className="pack-opening-scene">
        {phase === "ready" ? <button type="button" className="pack-opening-close" onClick={close} aria-label="開封画面を閉じる">×</button> : null}
        <header className="pack-opening-header"><span>PITCH ARCHIVE</span><strong>{phase === "result" ? "NEW CARD" : "PACK OPENING"}</strong></header>
        {phase === "error" ? <div className="pack-opening-error"><strong>パックを開封できませんでした</strong><p>{error}</p><button type="button" onClick={close}>戻る</button></div> : null}
        {phase !== "error" && !resultCard ? <>
          <div className={`native-pack-stage ${swiping ? "is-swiping" : ""}`} onPointerDown={beginSwipe} onPointerMove={moveSwipe} onPointerUp={endSwipe} onPointerCancel={cancelSwipe} role="slider" aria-label="パックを右にスワイプして開封" aria-valuemin={0} aria-valuemax={THRESHOLD} aria-valuenow={Math.min(THRESHOLD,swipeDistance)}>
            <div className="native-pack" style={{ transform:phase === "ready" ? `translateX(${swipeDistance}px) scale(${1+swipeDistance/1800})` : undefined }}>
              <div className="native-pack-top"><span>PA</span><small>FOOTBALL CARD</small></div>
              {pack.cards[0] ? <img src={pack.cards[0].imageUrl} alt="" /> : null}
              <div className="native-pack-bottom"><strong>{pack.name}</strong><small>1 RANDOM CARD</small></div>
              <i aria-hidden="true" />
            </div>
          </div>
          <div className="native-swipe-guide" aria-hidden="true"><span>SWIPE TO OPEN</span><i><b style={{ width:`${Math.min(100,swipeDistance/THRESHOLD*100)}%` }} /></i><em>→</em></div>
          {phase === "opening" ? <p className="pack-opening-wait">OPENING...</p> : <button type="button" className="pack-opening-accessible-action" onClick={() => void openPack()}>右へスワイプして開封</button>}
        </> : null}
        {resultCard ? <div className="pack-opening-result">
          <div className="native-revealed-card"><img src={resultCard.imageUrl} alt={`${resultCard.name}のカード`} /></div>
          <div className="pack-result-copy"><span>{resultCard.rarity}</span><h2>{resultCard.name}</h2><p>{resultCard.rarity} · {resultCard.series}</p></div>
          <div className="pack-result-actions"><button type="button" onClick={viewCollection}>コレクションで見る</button><button type="button" onClick={close}>閉じる</button></div>
        </div> : null}
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(overlay,document.body);
}
