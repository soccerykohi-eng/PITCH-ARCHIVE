import { env } from "cloudflare:workers";
import webpush from "web-push";
import { getRawDb } from "@/db";

type PushSubscription = { endpoint:string;keys:{ p256dh:string;auth:string } };
type PushEnv = { WEB_PUSH_PUBLIC_KEY?:string;WEB_PUSH_PRIVATE_KEY?:string };

function config() {
  const runtime=env as unknown as PushEnv;
  if (!runtime.WEB_PUSH_PUBLIC_KEY || !runtime.WEB_PUSH_PRIVATE_KEY) return null;
  webpush.setVapidDetails("mailto:notifications@pitch-archive.app",runtime.WEB_PUSH_PUBLIC_KEY,runtime.WEB_PUSH_PRIVATE_KEY);
  return { publicKey:runtime.WEB_PUSH_PUBLIC_KEY };
}

export function getPushPublicKey() { return config()?.publicKey ?? null; }

export async function sendPush(userEmail:string,title:string,message:string,destination:string) {
  if (!config()) return;
  const subscriptions=await getRawDb().prepare("SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_email=?").bind(userEmail).all<{ endpoint:string;p256dh:string;auth:string }>();
  const payload=JSON.stringify({ title,body:message,url:destination === "social" ? "/#social" : "/#packs" });
  await Promise.all(subscriptions.results.map(async (item) => {
    try {
      await webpush.sendNotification({ endpoint:item.endpoint,keys:{ p256dh:item.p256dh,auth:item.auth } } as PushSubscription,payload);
    } catch (error) {
      const statusCode=(error as { statusCode?:number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await getRawDb().prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(item.endpoint).run();
    }
  }));
}
