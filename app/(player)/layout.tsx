import AccountGateway from "../account-gateway";
import BottomNavigation from "../components/app/bottom-navigation";
import { AppDataProvider } from "../components/app/app-data-provider";
import { getOrCreateMember } from "../server-auth";

export const dynamic = "force-dynamic";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const member = await getOrCreateMember();
  if (!member) return <AccountGateway google="" />;
  return <AppDataProvider><div className="player-app-shell"><BottomNavigation />{children}</div></AppDataProvider>;
}
