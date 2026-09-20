import AccountGateway from "./account-gateway";
import ArchiveApp, { type ArchiveRoute } from "./archive-app";
import { getOrCreateMember } from "./server-auth";

export const dynamic="force-dynamic";

export default async function ArchiveRoutePage({ route }:{ route:ArchiveRoute }) {
  const member=await getOrCreateMember();
  if (!member) return <AccountGateway google="" />;
  return <ArchiveApp initialName={member.displayName} initialRoute={route} />;
}
