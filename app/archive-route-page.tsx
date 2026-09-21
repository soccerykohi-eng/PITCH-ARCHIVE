import AccountGateway from "./account-gateway";
import ArchiveApp, { type RootRoute } from "./archive-app";
import { getOrCreateMember } from "./server-auth";

export const dynamic="force-dynamic";

export default async function ArchiveRoutePage({ route }:{ route:RootRoute }) {
  const member=await getOrCreateMember();
  if (!member) return <AccountGateway google="" />;
  const initialTab=route==="/collection"?"collection":route.startsWith("/friends")?"social":route==="/menu"?"menu":"packs";
  const initialSocialView=route==="/friends/requests"?"requests":route==="/friends/trades"?"trades":"friends";
  return <ArchiveApp initialName={member.displayName} initialTab={initialTab} initialSocialView={initialSocialView} />;
}
