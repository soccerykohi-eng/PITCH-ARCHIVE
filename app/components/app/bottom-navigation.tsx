"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, Menu, PackageOpen, UsersRound } from "lucide-react";
import { useAppData } from "./app-data-provider";

const items = [
  { href: "/packs", label: "パック", icon: PackageOpen, active: (path: string) => path.startsWith("/packs") },
  { href: "/collection", label: "コレクション", icon: LibraryBig, active: (path: string) => path.startsWith("/collection") },
  { href: "/friends", label: "フレンド", icon: UsersRound, active: (path: string) => path.startsWith("/friends") },
  { href: "/menu", label: "メニュー", icon: Menu, active: (path: string) => path.startsWith("/menu") },
] as const;
const rootPaths=new Set(items.map((item)=>item.href));

export default function BottomNavigation() {
  const pathname = usePathname();
  const { dashboard,activeRoot,selectRoot } = useAppData();
  if (!rootPaths.has(pathname as typeof items[number]["href"])) return null;
  return <nav className="network-nav app-bottom-navigation" aria-label="メインナビゲーション">
    {items.map((item) => {
      const Icon = item.icon;
      const badge = item.href === "/collection" ? dashboard?.collection.length : 0;
      const active=activeRoot===item.href;
      return <Link key={item.href} href={item.href} prefetch onClick={()=>selectRoot(item.href)} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
        <Icon aria-hidden="true" />
        <small>{item.label}</small>
        {badge ? <span>{badge}</span> : null}
      </Link>;
    })}
  </nav>;
}
