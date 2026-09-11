import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import ArchiveApp from "./archive-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user=await getChatGPTUser();
  if (!user) return <main className="login-shell"><section className="login-card"><img src="/icon-192.png" alt="" /><p className="section-kicker">PITCH ARCHIVE</p><h1>カードコレクションを始める</h1><p>参加者ごとに所持カードを保存します。初回ログイン後、運営の承認をお待ちください。</p><a className="login-button" href={chatGPTSignInPath("/")} target="_top">ChatGPTでログイン</a></section></main>;
  return <ArchiveApp initialName={user.displayName} />;
}
