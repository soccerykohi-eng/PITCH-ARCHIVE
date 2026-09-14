import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getRawDb } from "@/db";
import { ADMIN_GOOGLE_VERIFIED_COOKIE, verifySignedFlowToken } from "../session";
import { getSessionIdentity, getSessionSecret } from "../server-auth";

export const dynamic = "force-dynamic";

export default async function AdminLogin({ searchParams }:{ searchParams:Promise<{ error?:string;verified?:string }> }) {
  if ((await getSessionIdentity())?.kind === "admin") redirect("/");
  const { error }=await searchParams;
  const identity=await getRawDb().prepare("SELECT google_email AS googleEmail FROM admin_google_identities WHERE admin_email='admin@pitcharchive.local'").first<{ googleEmail:string | null }>();
  const verified=identity ? await verifySignedFlowToken((await cookies()).get(ADMIN_GOOGLE_VERIFIED_COOKIE)?.value,getSessionSecret()) : null;
  const googleVerified=verified?.purpose === "admin-google-verified" && verified.userEmail === "admin@pitcharchive.local";
  const message=error === "google-required" ? "先にGoogleアカウントで本人確認してください。" : error?.startsWith("google") ? "管理者Googleアカウントを確認できませんでした。" : error ? "アクセスキーを確認してください。" : "";
  return <main className="login-shell"><section className="login-card"><p className="section-kicker">ADMIN ACCESS</p><h1>運営ログイン</h1>{identity && !googleVerified ? <><p>最初に連携済みGoogleアカウントで本人確認してください。</p><a className="google-login-button" href="/api/admin/auth/google/start"><b aria-hidden="true">G</b>Googleで本人確認</a></> : <><p>{identity ? `${verified?.googleEmail ?? identity.googleEmail ?? "Googleアカウント"} の確認が完了しました。運営用アクセスキーを入力してください。` : "初回連携前のため、運営用アクセスキーでログインしてください。"}</p><form className="admin-login-form" action="/api/admin/session" method="post"><label htmlFor="admin-access-key">アクセスキー</label><input id="admin-access-key" name="accessKey" type="password" autoComplete="current-password" required /><button type="submit">運営画面へ進む</button></form></>}{message ? <span role="alert">{message}</span> : null}</section></main>;
}
