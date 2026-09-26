"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Dashboard } from "../../dashboard-types";

export type RootPath="/packs"|"/collection"|"/friends"|"/menu";

function rootPath(pathname:string):RootPath|null {
  if(pathname.startsWith("/packs"))return "/packs";
  if(pathname.startsWith("/collection"))return "/collection";
  if(pathname.startsWith("/friends"))return "/friends";
  if(pathname.startsWith("/menu"))return "/menu";
  return null;
}

type AppData = {
  dashboard: Dashboard;
  initializing: boolean;
  refreshing: boolean;
  error: string;
  activeRoot: RootPath|null;
  selectRoot: (path:RootPath) => void;
  refreshDashboard: () => Promise<Dashboard | null>;
};

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children,initialDashboard }: { children: React.ReactNode;initialDashboard:Dashboard }) {
  const pathname=usePathname();
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [optimisticRoot,setOptimisticRoot]=useState<RootPath|null>(null);
  const currentRoot=rootPath(pathname);
  if(optimisticRoot===currentRoot)setOptimisticRoot(null);
  const activeRoot=optimisticRoot??currentRoot;

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "データを読み込めませんでした");
        return null;
      }
      setDashboard(result as Dashboard);
      setError("");
      return result as Dashboard;
    } catch {
      setError("データを読み込めませんでした");
      return null;
    } finally {
      setRefreshing(false);
    }
  }, []);

  const value = useMemo(() => ({ dashboard, initializing:false, refreshing, error, activeRoot, selectRoot:setOptimisticRoot, refreshDashboard }), [dashboard, refreshing, error, activeRoot, refreshDashboard]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}
