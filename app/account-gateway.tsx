"use client";

import { useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";

export default function AccountGateway() {
  const [busy,setBusy]=useState<"login" | "create" | null>(null);
  const [message,setMessage]=useState("");

  async function continueWithPasskey() {
    if (!browserSupportsWebAuthn()) {
      setMessage("この端末ではパスキーを利用できません");
      return;
    }
    setBusy("login");
    setMessage("");
    try {
      const optionsResponse=await fetch("/api/passkey/login/options",{ method:"POST" });
      const options=await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.error ?? "パスキーを開始できませんでした");
      const authentication=await startAuthentication({ optionsJSON:options });
      const verifyResponse=await fetch("/api/passkey/login/verify",{
        method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify(authentication),
      });
      const result=await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(result.error ?? "パスキーを確認できませんでした");
      window.location.replace("/");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "NotAllowedError" ? "認証はキャンセルされました" : error instanceof Error ? error.message : "認証はキャンセルされました");
      setBusy(null);
    }
  }

  async function createAccount() {
    setBusy("create");
    setMessage("");
    try {
      const response=await fetch("/api/session/start",{ method:"POST" });
      const result=await response.json();
      if (!response.ok) throw new Error(result.error ?? "アカウントを作成できませんでした");
      window.location.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "アカウントを作成できませんでした");
      setBusy(null);
    }
  }

  return <main className="account-gateway">
    <section>
      <p className="section-kicker">PITCH ARCHIVE</p>
      <h1>カードコレクションへ<br />ようこそ</h1>
      <button type="button" disabled={busy !== null} onClick={() => void continueWithPasskey()}>
        {busy === "login" ? "確認中…" : "パスキーで続ける"}
      </button>
      <small>以前のアカウントを復元できます</small>
      <i aria-hidden="true" />
      <button className="is-secondary" type="button" disabled={busy !== null} onClick={() => void createAccount()}>
        {busy === "create" ? "作成中…" : "新しくはじめる"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </section>
  </main>;
}
