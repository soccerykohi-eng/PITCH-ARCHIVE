import type { PackView, SessionView, SharedCard } from "./types";

export type DashboardUser = SessionView & {
  createdAt: number;
  points: number;
  lastSeenAt: number | null;
  googleLinked: number;
  cardCount: number;
  packOpeningCount: number;
  friendCount: number;
  tradeCount: number;
};

export type Dashboard = {
  session: SessionView;
  packs: PackView[];
  collection: SharedCard[];
  users: DashboardUser[];
};
