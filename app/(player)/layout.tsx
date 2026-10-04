import AccountGateway from "../account-gateway";
import BottomNavigation from "../components/app/bottom-navigation";
import { AppDataProvider } from "../components/app/app-data-provider";
import { getOrCreateMember } from "../server-auth";
import { getDashboardData } from "../server-dashboard";

export const dynamic = "force-dynamic";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const member = await getOrCreateMember();
  if (!member) return <AccountGateway google="" />;
  const dashboard=await getDashboardData(member);
  return <AppDataProvider initialDashboard={dashboard}><div className="player-app-shell"><BottomNavigation />{children}</div></AppDataProvider>;
}
