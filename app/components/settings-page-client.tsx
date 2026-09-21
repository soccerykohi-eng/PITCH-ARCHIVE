"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "./app/app-data-provider";

async function optimize(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) { bitmap.close(); throw new Error("画像を処理できませんでした"); }
  context.fillStyle = "#111311"; context.fillRect(0, 0, 512, 512);
  context.drawImage(bitmap, (bitmap.width-size)/2, (bitmap.height-size)/2, size, size, 0, 0, 512, 512);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("画像を処理できませんでした")), "image/webp", .84));
  return new File([blob], "profile.webp", { type: "image/webp", lastModified: Date.now() });
}

export default function SettingsPageClient() {
  const router = useRouter();
  const {dashboard,refreshDashboard}=useAppData();
  const member=dashboard.session;
  const [name, setName] = useState(member.displayName);
  const [image, setImage] = useState<File | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const preview = useMemo(() => image ? URL.createObjectURL(image) : "", [image]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    const path = member.role === "admin" ? "/api/admin/auth/google/status" : "/api/auth/google/status";
    void fetch(path, { cache: "no-store" }).then(async (response) => { if (response.ok) { const result = await response.json(); setLinked(result.linked); setEmail(result.email); } });
  }, [member.role]);
  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      const result = await response.json();
      if (!response.ok) return setNotice(result.error ?? "保存できませんでした");
      if (image) { const form = new FormData(); form.set("avatar", await optimize(image)); const upload = await fetch("/api/profile", { method: "PUT", body: form }); if (!upload.ok) return setNotice((await upload.json()).error ?? "画像を保存できませんでした"); }
      await refreshDashboard();
      router.push("/menu");
    } finally { setBusy(false); }
  }
  async function removeImage() { setBusy(true); const response = await fetch("/api/profile", { method: "DELETE" }); setBusy(false); if (response.ok) await refreshDashboard(); else setNotice((await response.json()).error ?? "画像を削除できませんでした"); }
  async function logout() { setBusy(true); const response = await fetch("/api/session/logout", { method: "POST" }); if (response.ok) { router.push("/");router.refresh(); } else { setBusy(false); setNotice("ログアウトできませんでした"); } }
  return <main className="route-page">
    <header className="route-page-header"><Link href="/menu">‹ メニュー</Link><h1>アカウント設定</h1></header>
    <section className="route-settings-section"><h2>プロフィール</h2><div className="profile-editor">
      <div className="profile-avatar-preview">{preview || member.avatarUrl ? <img src={preview || member.avatarUrl || ""} alt="プロフィール画像のプレビュー" /> : <span>{name.slice(0, 1)}</span>}</div>
      <div className="profile-image-actions"><label htmlFor="profile-image">画像を選択</label><Input id="profile-image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => setImage(event.target.files?.[0] ?? null)} />{member.avatarUrl ? <button type="button" disabled={busy} onClick={() => void removeImage()}>現在の画像を削除</button> : null}</div>
      <div className="profile-name-field"><label htmlFor="profile-name">名前</label><Input id="profile-name" maxLength={24} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} /><small>{name.trim().length} / 24文字</small></div>
      <Button className="profile-save" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "保存中…" : "変更を保存"}</Button>
    </div></section>
    <section className="route-settings-section"><h2>アカウント</h2><div className="account-security-settings"><div><KeyRound /><span><strong>Googleアカウント</strong><small>{linked ? "連携済み" : "未連携"}</small></span></div>{linked ? <p>{email}</p> : member.role === "player" ? <a href="/api/auth/google/start?mode=link">Googleアカウントを連携</a> : <p>運営アカウントの連携は管理画面から行えます。</p>}</div><Link className="settings-row-link" href="/settings/safety">プライバシー・安全 <span>›</span></Link><button className="settings-logout" type="button" disabled={busy} onClick={() => void logout()}>ログアウト</button></section>
    {notice ? <p className="route-notice" role="status">{notice}</p> : null}
  </main>;
}
