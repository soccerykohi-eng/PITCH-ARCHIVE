import ArchiveApp from "./archive-app";
import AccountGateway from "./account-gateway";
import { getOrCreateMember } from "./server-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const member=await getOrCreateMember();
  if (!member) return <AccountGateway />;
  return <ArchiveApp initialName={member.displayName} />;
}
