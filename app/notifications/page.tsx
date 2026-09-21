import AccountGateway from "../account-gateway";
import NotificationsPageClient from "../components/notifications-page-client";
import { getOrCreateMember } from "../server-auth";
export const dynamic="force-dynamic";
export default async function NotificationsPage(){const member=await getOrCreateMember();if(!member)return <AccountGateway google=""/>;return <NotificationsPageClient/>}
