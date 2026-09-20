import AccountGateway from "./account-gateway";
import { getOrCreateMember } from "./server-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }:{ searchParams:Promise<{ google?:string }> }) {
  const member=await getOrCreateMember();
  if (!member) return <AccountGateway google={(await searchParams).google ?? ""} />;
  redirect("/packs");
}
