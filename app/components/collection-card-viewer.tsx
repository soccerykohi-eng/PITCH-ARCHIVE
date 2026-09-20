"use client";

import { useEffect,useRef,useState,type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { SharedCard } from "../types";

type Props={ card:SharedCard;cards:SharedCard[];onChange:(card:SharedCard) => void;onClose:() => void };

export default function CollectionCardViewer({ card,cards,onChange,onClose }:Props) {
  const [closing,setClosing]=useState(false);
  const swipeOrigin=useRef<number | null>(null);
  const index=Math.max(0,cards.findIndex((item) => item.id === card.id));
  useEffect(() => { const previous=document.body.style.overflow;document.body.style.overflow="hidden";return () => { document.body.style.overflow=previous; }; },[]);
  function move(offset:number) { if (cards.length < 2) return;onChange(cards[(index+offset+cards.length)%cards.length]); }
  function close() { setClosing(true);window.setTimeout(onClose,180); }
  function startSwipe(event:ReactPointerEvent<HTMLDivElement>) { swipeOrigin.current=event.clientX;event.currentTarget.setPointerCapture(event.pointerId); }
  function endSwipe(event:ReactPointerEvent<HTMLDivElement>) { if (swipeOrigin.current === null) return;const distance=event.clientX-swipeOrigin.current;swipeOrigin.current=null;if (Math.abs(distance) >= 50) move(distance < 0 ? 1 : -1); }
  const viewer=<div className={`collection-viewer ${closing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label={`${card.name}のカード詳細`}>
    <div className="collection-viewer-shell">
      <button type="button" className="collection-viewer-back" onClick={close}>‹ <span>コレクション</span></button>
      <div className="collection-viewer-art" onPointerDown={startSwipe} onPointerUp={endSwipe} onPointerCancel={() => { swipeOrigin.current=null; }}>
        <img src={card.imageUrl} alt={`${card.name}のカード`} />
      </div>
      <div className="collection-viewer-info"><h2>{card.name}</h2><p>{card.rarity} · {card.series}</p><span>{card.team || card.country} · {card.position}</span><strong>×{card.quantity ?? 1} 所有</strong></div>
      <nav className="collection-viewer-pager" aria-label="カードを移動"><button type="button" onClick={() => move(-1)} disabled={cards.length < 2} aria-label="前のカード">‹</button><span>{index+1} / {cards.length}</span><button type="button" onClick={() => move(1)} disabled={cards.length < 2} aria-label="次のカード">›</button></nav>
    </div>
  </div>;
  return typeof document === "undefined" ? null : createPortal(viewer,document.body);
}
