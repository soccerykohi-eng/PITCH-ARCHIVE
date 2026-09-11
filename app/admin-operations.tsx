"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/components/ui/alert-dialog";

type User = { email:string;displayName:string;status:"pending"|"approved"|"suspended" };
type Announcement = { id:string;title:string;message:string;audience:"all"|"selected";publishAt:number;recipientEmails:string[] };
type Report = { id:string;reporterName:string;targetName:string;targetEmail:string;reason:string;details:string;status:"open"|"resolved";createdAt:number };
type Log = { id:string;actorEmail:string;action:string;targetType:string;targetId:string;detail:string;createdAt:number };

function localDateInput(timestamp:number) {
  const date=new Date(timestamp-dateOffset(timestamp));return date.toISOString().slice(0,16);
}
function dateOffset(timestamp:number) { return new Date(timestamp).getTimezoneOffset()*60000; }

export default function AdminOperations({ users,onNotice }:{ users:User[];onNotice:(message:string)=>void }) {
  const [announcements,setAnnouncements]=useState<Announcement[]>([]);const [reports,setReports]=useState<Report[]>([]);const [logs,setLogs]=useState<Log[]>([]);
  const [title,setTitle]=useState("");const [message,setMessage]=useState("");const [audience,setAudience]=useState<"all"|"selected">("all");
  const [publishAt,setPublishAt]=useState("");const [clock,setClock]=useState(0);const [recipients,setRecipients]=useState<string[]>([]);const [editingId,setEditingId]=useState<string|null>(null);
  const [deleteAnnouncement,setDeleteAnnouncement]=useState<Announcement|null>(null);const [logSearch,setLogSearch]=useState("");const [busy,setBusy]=useState(false);
  const approvedUsers=useMemo(() => users.filter((user) => user.status === "approved"),[users]);
  const load=useCallback(async () => {
    const [a,r,l]=await Promise.all([fetch("/api/admin/announcements",{ cache:"no-store" }),fetch("/api/admin/moderation",{ cache:"no-store" }),fetch("/api/admin/logs",{ cache:"no-store" })]);
    if (a.ok) setAnnouncements((await a.json()).announcements ?? []);if (r.ok) setReports((await r.json()).reports ?? []);if (l.ok) setLogs((await l.json()).logs ?? []);
  },[]);
  useEffect(() => { const timer=window.setTimeout(() => { const now=Date.now();setClock(now);setPublishAt((current) => current || localDateInput(now));void load(); },0);return () => window.clearTimeout(timer); },[load]);

  function resetForm() { setTitle("");setMessage("");setAudience("all");setPublishAt(localDateInput(Date.now()));setRecipients([]);setEditingId(null); }
  function edit(item:Announcement) { setEditingId(item.id);setTitle(item.title);setMessage(item.message);setAudience(item.audience);setPublishAt(localDateInput(item.publishAt));setRecipients(item.recipientEmails); }
  async function saveAnnouncement() {
    if (!title.trim() || !message.trim()) return onNotice("お知らせのタイトルと本文を入力してください");
    setBusy(true);try {
      const response=await fetch("/api/admin/announcements",{ method:editingId ? "PATCH" : "POST",headers:{ "content-type":"application/json" },body:JSON.stringify({ id:editingId,title,message,audience,publishAt:new Date(publishAt).getTime(),recipientEmails:recipients }) });
      const result=await response.json();if (!response.ok) return onNotice(result.error ?? "お知らせを保存できませんでした");
      onNotice(editingId ? "お知らせを更新しました" : "お知らせを登録しました");resetForm();await load();
    } finally { setBusy(false); }
  }
  async function removeAnnouncement() { if (!deleteAnnouncement) return;const response=await fetch("/api/admin/announcements",{ method:"DELETE",headers:{ "content-type":"application/json" },body:JSON.stringify({ id:deleteAnnouncement.id }) });if (response.ok) { onNotice("お知らせを削除しました");await load(); }setDeleteAnnouncement(null); }
  async function resolveReport(report:Report) { const response=await fetch("/api/admin/moderation",{ method:"PATCH",headers:{ "content-type":"application/json" },body:JSON.stringify({ id:report.id,status:report.status === "open" ? "resolved" : "open" }) });if (response.ok) { onNotice(report.status === "open" ? "通報を対応済みにしました" : "通報を未対応に戻しました");await load(); } }
  async function searchLogs() { const response=await fetch(`/api/admin/logs?q=${encodeURIComponent(logSearch)}`,{ cache:"no-store" });if (response.ok) setLogs((await response.json()).logs ?? []); }

  return <section className="admin-operations"><div className="admin-library-head"><div><p className="admin-step">03 / OPERATIONS</p><h3>運営センター</h3><p>お知らせ、通報、操作履歴をまとめて管理します。</p></div></div>
    <Tabs defaultValue="announcements" className="operations-tabs"><TabsList className="operations-nav"><TabsTrigger value="announcements">お知らせ</TabsTrigger><TabsTrigger value="reports">通報 <span>{reports.filter((item) => item.status === "open").length}</span></TabsTrigger><TabsTrigger value="logs">操作ログ</TabsTrigger></TabsList>
      <TabsContent value="announcements" className="operations-page"><div className="announcement-compose"><div className="compose-head"><div><strong>{editingId ? "お知らせを編集" : "新しいお知らせ"}</strong><small>すぐに送信するか、日時を指定して予約できます。</small></div>{editingId ? <button type="button" onClick={resetForm}>編集をやめる</button> : null}</div><Input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} placeholder="タイトル" /><Textarea rows={4} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="参加者へのお知らせ" /><div className="compose-grid"><label>公開日時<Input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} /></label><label>送信先<select value={audience} onChange={(event) => setAudience(event.target.value as "all"|"selected")}><option value="all">承認済みの全参加者</option><option value="selected">参加者を選択</option></select></label></div>{audience === "selected" ? <div className="recipient-picker">{approvedUsers.map((user) => <label key={user.email}><input type="checkbox" checked={recipients.includes(user.email)} onChange={(event) => setRecipients(event.target.checked ? [...recipients,user.email] : recipients.filter((email) => email !== user.email))} />{user.displayName}</label>)}</div> : null}<Button disabled={busy || !title.trim() || !message.trim()} onClick={() => void saveAnnouncement()}>{busy ? "保存中…" : editingId ? "変更を保存" : new Date(publishAt).getTime() > clock ? "配信を予約" : "お知らせを送信"}</Button></div>
        <div className="announcement-list">{announcements.length ? announcements.map((item) => <article key={item.id}><div><span>{item.publishAt > clock ? "予約" : "配信済み"}</span><strong>{item.title}</strong><p>{item.message}</p><small>{item.audience === "all" ? "全参加者" : `${item.recipientEmails.length}人`} · {new Date(item.publishAt).toLocaleString("ja-JP")}</small></div><div><Button variant="outline" onClick={() => edit(item)}>編集</Button><Button variant="outline" onClick={() => setDeleteAnnouncement(item)}>削除</Button></div></article>) : <p className="ops-empty">お知らせはまだありません</p>}</div></TabsContent>
      <TabsContent value="reports" className="operations-page"><div className="report-list">{reports.length ? reports.map((report) => <article className={report.status === "open" ? "is-open" : ""} key={report.id}><div><span>{report.status === "open" ? "未対応" : "対応済み"}</span><strong>{report.targetName}さんへの通報</strong><small>通報者：{report.reporterName} · {new Date(report.createdAt).toLocaleString("ja-JP")}</small><p>{report.reason}{report.details ? `｜${report.details}` : ""}</p></div><Button variant="outline" onClick={() => void resolveReport(report)}>{report.status === "open" ? "対応済みにする" : "未対応に戻す"}</Button></article>) : <p className="ops-empty">通報はありません</p>}</div></TabsContent>
      <TabsContent value="logs" className="operations-page"><div className="log-search"><Input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchLogs(); }} placeholder="操作・対象・メールで検索" /><Button variant="outline" onClick={() => void searchLogs()}>検索</Button></div><div className="audit-list">{logs.length ? logs.map((log) => <article key={log.id}><time>{new Date(log.createdAt).toLocaleString("ja-JP")}</time><strong>{log.action}</strong><span>{log.detail || `${log.targetType}: ${log.targetId}`}</span><small>{log.actorEmail}</small></article>) : <p className="ops-empty">操作ログはまだありません</p>}</div></TabsContent>
    </Tabs>
    <AlertDialog open={Boolean(deleteAnnouncement)} onOpenChange={(open) => { if (!open) setDeleteAnnouncement(null); }}><AlertDialogContent className="delete-pack-dialog"><AlertDialogHeader><AlertDialogTitle>お知らせを削除しますか？</AlertDialogTitle><AlertDialogDescription>参加者の通知一覧からも削除されます。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>戻る</AlertDialogCancel><AlertDialogAction onClick={() => void removeAnnouncement()}>削除する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
