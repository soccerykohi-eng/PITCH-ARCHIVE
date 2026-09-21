import AccountGateway from "../account-gateway";
import ExchangePageClient from "../components/exchange-page-client";
import { getOrCreateMember } from "../server-auth";
export const dynamic="force-dynamic";
export default async function ExchangePage(){const member=await getOrCreateMember();if(!member)return <AccountGateway google=""/>;return <ExchangePageClient initialPoints={member.points}/>}
