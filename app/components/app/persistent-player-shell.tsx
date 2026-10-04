"use client";

import { usePathname } from "next/navigation";
import ArchiveApp from "../../archive-app";
import BottomNavigation from "./bottom-navigation";

const playerRoots = new Set([
  "/packs",
  "/collection",
  "/friends",
  "/friends/requests",
  "/friends/trades",
  "/menu",
]);

export default function PersistentPlayerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPlayerRoot = playerRoots.has(pathname);

  return <div className="player-app-shell">
    {isPlayerRoot ? <>
      <BottomNavigation />
      <ArchiveApp />
    </> : children}
  </div>;
}
