import AccountGateway from "../account-gateway";
import { AppDataProvider } from "../components/app/app-data-provider";
import PersistentPlayerShell from "../components/app/persistent-player-shell";
import { getOrCreateMember } from "../server-auth";
import { getDashboardData } from "../server-dashboard";

export const dynamic = "force-dynamic";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const member = await getOrCreateMember();
  if (!member) return <AccountGateway google="" />;
  const dashboard=await getDashboardData(member);
  return <AppDataProvider initialDashboard={dashboard}><PersistentPlayerShell>{children}</PersistentPlayerShell></AppDataProvider>;
}
