import { redirect } from "next/navigation";
import ArchiveApp from "./archive-app";
import { getOrCreateMember } from "./server-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const member=await getOrCreateMember();
  if (!member) redirect("/api/session/start");
  return <ArchiveApp initialName={member.displayName} />;
}
