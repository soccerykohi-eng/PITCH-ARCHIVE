export type Rarity = "CORE" | "RARE" | "ELITE" | "ICON";

export type SharedCard = {
  id:string;
  name:string;
  position:string;
  country:string;
  team:string;
  rarity:Rarity;
  series:string;
  imageUrl:string;
  quantity?:number;
};

export type PackView = {
  id:string;
  name:string;
  description:string;
  status:"draft" | "scheduled" | "published" | "archived";
  claimedCardId:string | null;
  openCount:number;
  openLimit:number;
  publishAt:number | null;
  endAt:number | null;
  cards:SharedCard[];
};

export type SessionView = {
  email:string;
  displayName:string;
  avatarUrl:string | null;
  role:"admin" | "player";
  status:"pending" | "approved" | "suspended";
  points:number;
};
