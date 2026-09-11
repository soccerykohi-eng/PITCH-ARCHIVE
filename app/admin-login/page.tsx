import { redirect } from "next/navigation";
import { getSessionIdentity } from "../server-auth";

export const dynamic = "force-dynamic";

export default async function AdminLogin({ searchParams }:{ searchParams:Promise<{ error?:string }> }) {
  if ((await getSessionIdentity())?.kind === "admin") redirect("/");
  const { error }=await searchParams;
  return <main className="login-shell"><section className="login-card"><p className="section-kicker">ADMIN ACCESS</p><h1>運営ログイン</h1><p>運営用アクセスキーを入力してください。</p><form className="admin-login-form" action="/api/admin/session" method="post"><label htmlFor="admin-access-key">アクセスキー</label><input id="admin-access-key" name="accessKey" type="password" autoComplete="current-password" required />{error ? <span role="alert">アクセスキーを確認してください。</span> : null}<button type="submit">運営画面へ進む</button></form></section></main>;
}
