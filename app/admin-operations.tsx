"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Log = { id:string;actorEmail:string;action:string;targetType:string;targetId:string;detail:string;createdAt:number };

export default function AdminOperations() {
  const [logs,setLogs]=useState<Log[]>([]);
  const [logSearch,setLogSearch]=useState("");
  const load=useCallback(async (query="") => {
    const response=await fetch(`/api/admin/logs?q=${encodeURIComponent(query)}`,{ cache:"no-store" });
    if (response.ok) setLogs((await response.json()).logs ?? []);
  },[]);
  useEffect(() => {
    const timer=window.setTimeout(() => void load(),0);
    return () => window.clearTimeout(timer);
  },[load]);

  return <section className="admin-operations">
    <div className="admin-library-head">
      <div><p className="admin-step">03 / OPERATIONS</p><h3>運営センター</h3><p>操作履歴を確認します。</p></div>
    </div>
    <div className="operations-page">
      <div className="log-search"><Input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(logSearch); }} placeholder="操作・対象・メールで検索" /><Button variant="outline" onClick={() => void load(logSearch)}>検索</Button></div>
      <div className="audit-list">{logs.length ? logs.map((log) => <article key={log.id}><time>{new Date(log.createdAt).toLocaleString("ja-JP")}</time><strong>{log.action}</strong><span>{log.detail || `${log.targetType}: ${log.targetId}`}</span><small>{log.actorEmail}</small></article>) : <p className="ops-empty">操作ログはまだありません</p>}</div>
    </div>
  </section>;
}
