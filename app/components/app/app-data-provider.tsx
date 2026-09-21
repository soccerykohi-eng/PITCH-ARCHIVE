"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Dashboard } from "../../dashboard-types";

type AppData = {
  dashboard: Dashboard | null;
  loading: boolean;
  error: string;
  unreadCount: number;
  refreshDashboard: () => Promise<Dashboard | null>;
  refreshNotifications: () => Promise<void>;
};

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshDashboard = useCallback(async () => {
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
      setLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const result = (await response.json()) as { unreadCount?: number };
    setUnreadCount(result.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshDashboard]);
  useEffect(() => {
    if (dashboard?.session.status !== "approved") return;
    const initialTimer = window.setTimeout(() => void refreshNotifications(), 0);
    const timer = window.setInterval(() => void refreshNotifications(), 30000);
    return () => { window.clearTimeout(initialTimer);window.clearInterval(timer); };
  }, [dashboard?.session.status, refreshNotifications]);

  const value = useMemo(() => ({ dashboard, loading, error, unreadCount, refreshDashboard, refreshNotifications }), [dashboard, loading, error, unreadCount, refreshDashboard, refreshNotifications]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}
