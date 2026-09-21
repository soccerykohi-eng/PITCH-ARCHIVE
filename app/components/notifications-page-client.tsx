"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

type Item={id:string;type:"friend"|"trade"|"pack"|"account";title:string;message:string;destination:string;createdAt:number;readAt:number|null};
type Data={notifications:Item[];unreadCount:number};

export default function NotificationsPageClient(){
  const router=useRouter();
  const [data,setData]=useState<Data>({notifications:[],unreadCount:0});
  const load=useCallback(async()=>{const response=await fetch("/api/notifications",{cache:"no-store"});if(response.ok)setData(await response.json())},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);
  async function open(item:Item){if(item.readAt===null)await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"read",id:item.id})});if(item.destination==="social")router.push(item.type==="trade"?"/friends/trades":"/friends/requests");else if(item.destination==="packs")router.push("/packs");else void load()}
  async function readAll(){const response=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"read-all"})});if(response.ok)void load()}
  return <main className="route-page"><header className="route-page-header"><Link href="/menu">‹ メニュー</Link><div><h1>通知</h1>{data.unreadCount?<Button variant="outline" onClick={()=>void readAll()}>すべて既読</Button>:null}</div></header>{data.notifications.length?<div className="notification-list route-notification-list">{data.notifications.map((item)=><button type="button" key={item.id} className={`notification-item ${item.readAt===null?"is-unread":""}`} onClick={()=>void open(item)}><span className={`notification-icon type-${item.type}`}>{item.type==="friend"?"F":item.type==="trade"?"T":item.type==="pack"?"P":"A"}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></div>{item.readAt===null?<i aria-label="未読"/>:null}</button>)}</div>:<div className="notification-empty"><Bell size={24}/><strong>通知はまだありません</strong><p>新しいお知らせが届くと、ここに表示されます。</p></div>}</main>
}
