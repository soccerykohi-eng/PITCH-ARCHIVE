import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー | PITCH ARCHIVE",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-shell">
      <article className="privacy-card">
        <p className="section-kicker">PITCH ARCHIVE</p>
        <h1>プライバシーポリシー</h1>
        <p className="privacy-updated">最終更新日：2026年9月19日</p>

        <section>
          <h2>取得する情報</h2>
          <p>Googleログインを利用した場合、Googleから提供されるアカウント識別子、メールアドレス、表示名を取得します。また、ゲームの進行、所持カード、フレンド、トレード、コイン、操作履歴など、サービス利用に必要な情報を保存します。</p>
        </section>

        <section>
          <h2>利用目的</h2>
          <p>本人確認、アカウントのログイン・復元、ゲーム機能の提供、不正利用の防止、障害調査およびサービス改善のために利用します。</p>
        </section>

        <section>
          <h2>Google認証</h2>
          <p>Google OAuthのアクセストークンおよびリフレッシュトークンは保存しません。Googleから受け取った情報を、広告配信や販売の目的には利用しません。</p>
        </section>

        <section>
          <h2>保存先と外部サービス</h2>
          <p>サービス提供のため、Googleの認証サービスおよびCloudflareのWorkers・D1・KVを利用します。法令に基づく場合を除き、取得した個人情報を目的外で第三者へ提供しません。</p>
        </section>

        <section>
          <h2>Cookie</h2>
          <p>ログイン状態を安全に維持するため、必要なCookieを使用します。広告や行動追跡を目的とするCookieは使用しません。</p>
        </section>

        <section>
          <h2>保存期間・削除</h2>
          <p>情報はサービス提供に必要な期間保存します。アカウント情報の確認や削除を希望する場合は、下記の連絡先へお問い合わせください。</p>
        </section>

        <section>
          <h2>お問い合わせ</h2>
          <p><a href="mailto:soccerykohi@gmail.com">soccerykohi@gmail.com</a></p>
        </section>

        <Link className="privacy-back" href="/">PITCH ARCHIVEへ戻る</Link>
      </article>
    </main>
  );
}
