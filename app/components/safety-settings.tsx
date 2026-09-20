"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BlockedPerson={email:string;displayName:string;avatarUrl:string|null};

export default function SafetySettings({onBack,onNotice}:{onBack:()=>void;onNotice:(message:string)=>void}){
  const [people,setPeople]=useState<BlockedPerson[]>([]);const [busy,setBusy]=useState("");
  async function load(){const response=await fetch("/api/safety",{cache:"no-store"});if(response.ok){const result=await response.json();setPeople(result.blockedPeople??[])}}
  useEffect(()=>{const controller=new AbortController();void fetch("/api/safety",{cache:"no-store",signal:controller.signal}).then(async(response)=>{if(response.ok){const result=await response.json();setPeople(result.blockedPeople??[])}});return()=>controller.abort()},[]);
  async function unblock(email:string){setBusy(email);try{const response=await fetch("/api/safety",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"unblock",targetEmail:email})});const result=await response.json();if(!response.ok)onNotice(result.error??"ブロックを解除できませんでした");else{onNotice("ブロックを解除しました");await load()}}finally{setBusy("")}}
  return <section className="native-subpage safety-settings"><header><button type="button" onClick={onBack}>‹ メニュー</button></header><p className="section-kicker">PRIVACY & SAFETY</p><h2>プライバシー・安全</h2><section><div><strong>ブロック中のユーザー</strong><span>{people.length}人</span></div>{people.length?<div className="blocked-user-list">{people.map((person)=><div key={person.email}><i className={person.avatarUrl?"has-photo":""} style={person.avatarUrl?{backgroundImage:`url(${person.avatarUrl})`}:undefined}>{person.avatarUrl?"":person.displayName.slice(0,1)}</i><strong>{person.displayName}</strong><Button variant="outline" disabled={busy===person.email} onClick={()=>void unblock(person.email)}>解除</Button></div>)}</div>:<p>ブロック中のユーザーはいません。</p>}</section><section><strong>フレンドIDについて</strong><p>IDを知っている人だけが、あなたへフレンド申請できます。参加者一覧は公開されません。</p></section></section>
}
