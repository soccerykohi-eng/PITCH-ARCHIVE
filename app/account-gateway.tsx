"use client";

import { useState } from "react";
import Link from "next/link";

const messages:Record<string,string>={ cancelled:"Googleログインをキャンセルしました",invalid:"認証情報を確認できませんでした",failed:"Googleログインに失敗しました","link-conflict":"このGoogleアカウントは別のPITCH ARCHIVEアカウントに連携されています" };

export default function AccountGateway({ google }:{ google:string }) {
  const newAccount=google === "new";
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(google && google !== "new" ? messages[google] ?? "" : "");
  async function createAccount() {
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/auth/google/create",{ method:"POST" });const result=await response.json();
      if (!response.ok) throw new Error(result.error ?? "アカウントを作成できませんでした");
      window.location.replace("/");
    } catch (error) { setMessage(error instanceof Error ? error.message : "アカウントを作成できませんでした");setBusy(false); }
  }
  return <main className="account-gateway"><section><p className="section-kicker">PITCH ARCHIVE</p><h1>カードコレクションへ<br />ようこそ</h1>{newAccount ? <><p className="gateway-new-copy">このGoogleアカウントにはPITCH ARCHIVEアカウントがありません。</p><button type="button" disabled={busy} onClick={() => void createAccount()}>{busy ? "作成中…" : "このGoogleアカウントで新しく始める"}</button><Link className="gateway-back" href="/">戻る</Link></> : <><a className="google-login-button" href="/api/auth/google/start?mode=login"><b aria-hidden="true">G</b>Googleで続ける</a><small>Googleアカウントで<br />ログイン・アカウント復元できます</small></>}{message ? <p role="status">{message}</p> : null}</section></main>;
}
