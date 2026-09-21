import ArchiveApp, { type RootRoute } from "./archive-app";

export default function ArchiveRoutePage({ route }:{ route:RootRoute }) {
  const initialTab=route==="/collection"?"collection":route.startsWith("/friends")?"social":route==="/menu"?"menu":"packs";
  const initialSocialView=route==="/friends/requests"?"requests":route==="/friends/trades"?"trades":"friends";
  return <ArchiveApp initialTab={initialTab} initialSocialView={initialSocialView} />;
}
