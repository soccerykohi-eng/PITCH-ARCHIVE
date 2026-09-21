import AccountGateway from "../account-gateway";
import SettingsPageClient from "../components/settings-page-client";
import { getOrCreateMember } from "../server-auth";
export const dynamic="force-dynamic";
export default async function SettingsPage(){const member=await getOrCreateMember();if(!member)return <AccountGateway google=""/>;return <SettingsPageClient member={member}/>}
