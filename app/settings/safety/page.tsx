import AccountGateway from "../../account-gateway";
import SafetyPageClient from "../../components/safety-page-client";
import { getOrCreateMember } from "../../server-auth";
export const dynamic="force-dynamic";
export default async function SafetyPage(){const member=await getOrCreateMember();if(!member)return <AccountGateway google=""/>;return <SafetyPageClient/>}
