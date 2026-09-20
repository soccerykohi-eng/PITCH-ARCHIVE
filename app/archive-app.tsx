"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LibraryBig,
  KeyRound,
  Menu,
  PackageOpen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { PackView, SessionView, SharedCard } from "./types";
import SocialPanel from "./social-panel";
import AdminOperations from "./admin-operations";
import AdminCardLibrary, { type CatalogCard } from "./admin-card-library";
import PackOpeningExperience from "./components/pack-opening-experience";
import CollectionCardViewer from "./components/collection-card-viewer";
import SafetySettings from "./components/safety-settings";

type UserView = SessionView & {
  createdAt: number;
  points: number;
  lastSeenAt: number | null;
  googleLinked: number;
  cardCount: number;
  packOpeningCount: number;
  friendCount: number;
  tradeCount: number;
};
type PurgePreview = {
  userCount:number;
  googleLinkedCount:number;
  cardCopies:number;
  packOpenings:number;
  friendRelations:number;
  trades:number;
  notifications:number;
  pointsTotal:number;
};
type Dashboard = {
  session: SessionView;
  packs: PackView[];
  collection: SharedCard[];
  users: UserView[];
};
type NotificationItem = {
  id: string;
  type: "friend" | "trade" | "pack" | "account";
  title: string;
  message: string;
  destination: string;
  readAt: number | null;
  createdAt: number;
};
type NotificationData = {
  notifications: NotificationItem[];
  unreadCount: number;
};

const CARD_IMAGE_MAX_SIDE = 1200;
const UPLOAD_TARGET_BYTES = 250 * 1024;
const UPLOAD_CHUNK_BYTES = 160 * 1024;
const MAX_PUBLISHED_PACKS = 3;
const USERS_PER_PAGE = 6;
const PACKS_PER_PAGE = 4;

function localDateTimeValue(value: number) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("画像を変換できませんでした")),
      type,
      quality,
    ),
  );
}

async function optimizeCardImage(file: File) {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const canvas = document.createElement("canvas");
  const initialScale = Math.min(
    1,
    CARD_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
  );
  let width = Math.max(1, Math.round(bitmap.width * initialScale));
  let height = Math.max(1, Math.round(bitmap.height * initialScale));
  let output: Blob | null = null;
  try {
    while (true) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("画像を処理できませんでした");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#090a09";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.82, 0.76, 0.7, 0.64, 0.58]) {
        output = await canvasBlob(canvas, "image/webp", quality);
        if (output.size <= UPLOAD_TARGET_BYTES) break;
      }
      if (!output) throw new Error("画像を圧縮できませんでした");
      if (
        output.size <= UPLOAD_TARGET_BYTES ||
        Math.max(width, height) <= 480
      )
        break;
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
  } finally {
    bitmap.close();
  }
  if (!output) throw new Error("画像を圧縮できませんでした");
  const base = file.name.replace(/\.[^.]+$/, "") || "card";
  return new File([output], `${base}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

async function optimizeAvatarImage(file: File) {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const size = Math.min(bitmap.width, bitmap.height);
  const sourceX = (bitmap.width - size) / 2;
  const sourceY = (bitmap.height - size) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error("画像を処理できませんでした");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#111311";
  context.fillRect(0, 0, 512, 512);
  context.drawImage(bitmap, sourceX, sourceY, size, size, 0, 0, 512, 512);
  bitmap.close();
  const blob = await canvasBlob(canvas, "image/webp", 0.84);
  return new File([blob], "profile.webp", {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

function CardTile({
  card,
  onSelect,
}: {
  card: SharedCard;
  onSelect?: () => void;
}) {
  const content = (
    <>
      {(card.quantity ?? 1) > 1 ? (
        <b
          className="duplicate-card-badge"
          aria-label={`${card.quantity}枚所持`}
        >
          ×{card.quantity}
        </b>
      ) : null}
      <img
        src={card.imageUrl}
        alt={`${card.name}のカード`}
        loading="lazy"
        decoding="async"
      />
      <div className="shared-card-meta">
        <span>{card.rarity}</span>
        <strong>{card.name}</strong>
        <small>
          {card.team || card.country} · {card.position}
        </small>
      </div>
    </>
  );
  return onSelect ? (
    <button
      type="button"
      className="shared-card shared-card-button"
      onClick={onSelect}
      aria-label={`${card.name}の詳細を見る`}
    >
      {content}
    </button>
  ) : (
    <article className="shared-card">{content}</article>
  );
}

function PublicPack({
  pack,
  onOpen,
  onViewCards,
}: {
  pack: PackView;
  onOpen: () => void;
  onViewCards: () => void;
}) {
  const previewCards = pack.cards.slice(0, 3);
  const completed = pack.openCount >= pack.openLimit;
  const remaining = Math.max(0, pack.openLimit - pack.openCount);
  const openingStatus = completed
    ? "開封済み"
    : pack.openLimit === 1
      ? "あと1回開封できます"
      : `残り ${remaining} / ${pack.openLimit}回`;
  return (
    <section className={`featured-pack ${completed ? "is-opened" : ""}`}>
      <div className="featured-pack-top">
        <span>CURRENT PACK</span>
        <small>{pack.cards.length} CARDS</small>
      </div>
      <div className="pack-showcase" aria-hidden="true">
        <div className="pack-orbit" />
        {previewCards.length ? (
          previewCards.map((card, index) => (
            <img
              key={card.id}
              src={card.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ "--card-index": index } as React.CSSProperties}
            />
          ))
        ) : (
          <div className="empty-pack-mark">
            <PackageOpen size={42} />
          </div>
        )}
      </div>
      <div className="featured-pack-copy">
        <p className="section-kicker">PITCH ARCHIVE RELEASE</p>
        <h2>{pack.name}</h2>
        <p>{pack.description || "新しいカードコレクション"}</p>
      </div>
      <div className="featured-pack-status">
        <div>
          <span>{openingStatus}</span>
          <strong>
            {pack.cards.length}種類から1枚獲得
          </strong>
        </div>
        <i aria-hidden="true" />
      </div>
      <div className="featured-pack-actions">
        <Button disabled={completed || !pack.cards.length} onClick={onOpen}>
          <Sparkles size={16} />
          {completed ? "開封済み" : "パックを開ける"}
        </Button>
        <button type="button" onClick={onViewCards}>
          収録カードを見る
          <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}

function PackCardCatalog({
  pack,
  onBack,
  onCardSelect,
}: {
  pack: PackView;
  onBack: () => void;
  onCardSelect: (card: SharedCard) => void;
}) {
  return (
    <section className="pack-catalog-page">
      <header className="pack-catalog-header">
        <button type="button" onClick={onBack}>
          <ChevronLeft aria-hidden="true" />
          パック
        </button>
        <div>
          <p className="section-kicker">CARD LIST</p>
          <h1>{pack.name}</h1>
          <span>{pack.cards.length} CARDS</span>
        </div>
      </header>
      <div className="pack-catalog-grid">
        {pack.cards.map((card, index) => (
          <div
            className={`select-card ${pack.claimedCardId === card.id ? "is-selected" : ""}`}
            key={card.id}
          >
            <i className="pack-card-number">
              {String(index + 1).padStart(2, "0")}
            </i>
            <CardTile card={card} onSelect={() => onCardSelect(card)} />
            {pack.claimedCardId === card.id ? (
              <span className="drawn-label">所持</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function DailyAndExchange({
  onChanged,
  onNotice,
}: {
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  type LoginBonus = {
    date: string;
    reward: number;
    claimed: boolean;
    available: boolean;
    points: number;
    streak: number;
    streakDay: number;
    nextStreakReward: number;
    bonusType: "daily" | "wednesday" | "streak";
  };
  const [daily, setDaily] = useState<LoginBonus | null>(null);
  const [cards, setCards] = useState<
    Array<SharedCard & { price: number; owned: boolean }>
  >([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [dailyResponse, shopResponse] = await Promise.all([
      fetch("/api/login-bonus", { cache: "no-store" }),
      fetch("/api/exchange", { cache: "no-store" }),
    ]);
    if (dailyResponse.ok) setDaily(await dailyResponse.json());
    if (shopResponse.ok) setCards((await shopResponse.json()).cards ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function claim() {
    setBusy(true);
    const response = await fetch("/api/login-bonus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok)
      return onNotice(data.error ?? "報酬を受け取れませんでした");
    onNotice(`${data.reward}コインを受け取りました`);
    void load();
    onChanged();
  }
  async function exchange(card: SharedCard & { price: number }) {
    setBusy(true);
    const response = await fetch("/api/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok)
      return onNotice(data.error ?? "カードを交換できませんでした");
    onNotice(`${card.name}を交換しました`);
    void load();
    onChanged();
  }
  return (
    <section className="daily-exchange">
      <div className="login-bonus-card">
        <header>
          <div>
            <p className="section-kicker">
              {daily?.bonusType === "streak"
                ? "7 DAY LOGIN BONUS"
                : daily?.bonusType === "wednesday"
                  ? "WEDNESDAY BONUS"
                  : "DAILY BONUS"}
            </p>
            <strong>ログインボーナス</strong>
          </div>
          <small>毎日 0:00 更新</small>
        </header>
        <strong className="login-bonus-reward">{daily?.reward ?? 30} COINS</strong>
        <Button disabled={!daily?.available || busy} onClick={() => void claim()}>
          {daily?.claimed ? "受取済み" : "受け取る"}
        </Button>
        <div className="login-bonus-streak">
          <strong>連続ログイン {daily?.streakDay ?? 1}日目</strong>
          <small>7日目 {daily?.nextStreakReward ?? 100} COINS</small>
        </div>
      </div>
      <button
        type="button"
        className="exchange-entry"
        onClick={() => setShopOpen(true)}
      >
        <span>
          <strong>カード交換所</strong>
          <small>毎日更新される6枚から好きなカードを獲得</small>
        </span>
        <b>{daily?.points ?? 0} COINS</b>
        <ChevronRight />
      </button>
      <Dialog open={shopOpen} onOpenChange={setShopOpen}>
        <DialogContent className="exchange-dialog">
          <DialogHeader>
            <p className="section-kicker">TODAY'S 6 CARDS</p>
            <DialogTitle>今日のカード交換所</DialogTitle>
            <DialogDescription>
              毎日ランダムで選ばれる6枚のうち、好きな未所持カードを獲得できます。
            </DialogDescription>
          </DialogHeader>
          <div className="exchange-balance">
            所持コイン <strong>{daily?.points ?? 0}</strong>
          </div>
          <div className="exchange-grid">
            {cards.map((card) => (
              <article key={card.id}>
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <span>{card.rarity}</span>
                  <strong>{card.name}</strong>
                  <small>
                    {card.owned ? "交換済み" : card.team || card.country}
                  </small>
                </div>
                <Button
                  disabled={
                    busy || card.owned || (daily?.points ?? 0) < card.price
                  }
                  onClick={() => void exchange(card)}
                >
                  {card.owned ? "交換済み" : `${card.price} COINS`}
                </Button>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CollectionMilestones({
  onChanged,
  onNotice,
}: {
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  const [data, setData] = useState<{
    owned: number;
    coins: number;
    milestones: Array<{
      id: number;
      count: number;
      reward: number;
      claimed: boolean;
      available: boolean;
    }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/collection-milestones", {
      cache: "no-store",
    });
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function claim(milestone: number, count: number) {
    setBusy(true);
    try {
      const response = await fetch("/api/collection-milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ milestone }),
      });
      const result = (await response.json()) as typeof data & {
        error?: string;
      };
      if (!response.ok)
        return onNotice(result.error ?? "報酬を受け取れませんでした");
      setData(result);
      onNotice(`${count}種類達成報酬を受け取りました`);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  if (!data) return null;
  const next=data.milestones.find((item) => !item.claimed) ?? data.milestones.at(-1);
  return (
    <section className="collection-milestones">
      <div className="collection-milestones-head">
        <div>
          <p className="section-kicker">COLLECTION REWARDS</p>
          <h2>次の報酬まで</h2>
          <p>{data.owned} / {next?.count ?? data.owned}種類</p>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "閉じる" : "詳細を見る ›"}</button>
      </div>
      {expanded ? <div className="reward-board">
        {data.milestones.map((item) => (
          <article className="reward-row" key={item.id}>
            <div>
              <span>{item.count} CARDS</span>
              <strong>{item.reward} コイン</strong>
              <small>
                {item.claimed
                  ? "受取済み"
                  : item.available
                    ? "受取可能です"
                    : `あと${Math.max(0, item.count - data.owned)}種類`}
              </small>
            </div>
            <Button
              disabled={busy || item.claimed || !item.available}
              onClick={() => void claim(item.id, item.count)}
            >
              {item.claimed
                ? "受取済み"
                : item.available
                  ? "受け取る"
                  : "未達成"}
            </Button>
          </article>
        ))}
      </div> : null}
    </section>
  );
}

function AdminPack({
  pack,
  catalog,
  publishedCount,
  onChanged,
  onNotice,
}: {
  pack: PackView;
  catalog: SharedCard[];
  publishedCount: number;
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  const [json, setJson] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("追加中…");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editName, setEditName] = useState(pack.name);
  const [editDescription, setEditDescription] = useState(pack.description);
  const [publishAtInput, setPublishAtInput] = useState(
    localDateTimeValue(Date.now() + 24 * 60 * 60 * 1000),
  );
  const [endAtInput, setEndAtInput] = useState(
    localDateTimeValue(Date.now() + 8 * 24 * 60 * 60 * 1000),
  );
  const [openLimitInput, setOpenLimitInput] = useState(
    String(pack.openLimit || 1),
  );
  const [notificationMessage, setNotificationMessage] = useState(
    pack.notificationMessage || pack.name,
  );
  const [catalogSearch, setCatalogSearch] = useState("");
  const imagePreview = useMemo(
    () => (image ? URL.createObjectURL(image) : ""),
    [image],
  );
  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const packCardIds = useMemo(
    () => new Set(pack.cards.map((card) => card.id)),
    [pack.cards],
  );
  const availableCards = useMemo(() => {
    const query = catalogSearch.trim().toLocaleLowerCase();
    return catalog.filter(
      (card) =>
        !packCardIds.has(card.id) &&
        (!query ||
          `${card.name} ${card.team} ${card.country} ${card.series} ${card.rarity}`
            .toLocaleLowerCase()
            .includes(query)),
    );
  }, [catalog, catalogSearch, packCardIds]);

  let jsonPreview: {
    name?: string;
    rarity?: string;
    series?: string;
  } | null = null;
  if (json.trim()) {
    try {
      const normalized = json
        .replace(/&#(?:x20|32);/gi, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      jsonPreview = JSON.parse(
        normalized.slice(
          normalized.indexOf("{"),
          normalized.lastIndexOf("}") + 1,
        ),
      );
    } catch {
      jsonPreview = null;
    }
  }

  async function uploadCard() {
    if (!image || !json.trim())
      return onNotice("画像とJSONを両方選択してください");
    setBusy(true);
    setBusyLabel("画像を最適化中…");
    try {
      const uploadImage = await optimizeCardImage(image);
      const uploadId = crypto.randomUUID();
      const totalChunks = Math.ceil(uploadImage.size / UPLOAD_CHUNK_BYTES);
      for (let index = 0; index < totalChunks; index++) {
        setBusyLabel(`画像を送信中… ${index + 1}/${totalChunks}`);
        const start = index * UPLOAD_CHUNK_BYTES;
        const chunkForm = new FormData();
        chunkForm.set("uploadId", uploadId);
        chunkForm.set("index", String(index));
        chunkForm.set(
          "chunk",
          uploadImage.slice(
            start,
            Math.min(start + UPLOAD_CHUNK_BYTES, uploadImage.size),
          ),
          `chunk-${index}`,
        );
        const chunkResponse = await fetch(`/api/admin/packs/${pack.id}/cards`, {
          method: "PUT",
          body: chunkForm,
        });
        const chunkRaw = await chunkResponse.text();
        let chunkResult: { error?: string } = {};
        try {
          chunkResult = chunkRaw ? JSON.parse(chunkRaw) : {};
        } catch {
          chunkResult = {};
        }
        if (!chunkResponse.ok)
          throw new Error(
            chunkResult.error ??
              `画像の送信に失敗しました（${chunkResponse.status}）`,
          );
      }
      setBusyLabel("カード情報を保存中…");
      const response = await fetch(`/api/admin/packs/${pack.id}/cards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploadId,
          totalChunks,
          json,
          contentType: uploadImage.type,
          fileName: uploadImage.name,
        }),
      });
      const raw = await response.text();
      let result: { error?: string; id?: string } = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        result = {};
      }
      if (!response.ok)
        onNotice(
          result.error ?? `カードを追加できませんでした（${response.status}）`,
        );
      else {
        setJson("");
        setImage(null);
        setFileKey((value) => value + 1);
        onNotice("カードをパックに追加しました");
        onChanged();
      }
    } catch (error) {
      onNotice(
        error instanceof Error
          ? error.message
          : "画像の処理または通信に失敗しました",
      );
    } finally {
      setBusy(false);
      setBusyLabel("追加中…");
    }
  }

  async function changeReleaseStatus(
    next: "draft" | "scheduled" | "published" | "archived",
  ) {
    if (next === "published" && publishedCount >= MAX_PUBLISHED_PACKS)
      return onNotice(
        "公開上限は3パックです。公開中のパックを終了してください",
      );
    const response = await fetch(`/api/admin/packs/${pack.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: next,
        publishAt: new Date(publishAtInput).getTime(),
        endAt:
          next === "published"
            ? Date.now() + 7 * 24 * 60 * 60 * 1000
            : new Date(endAtInput).getTime(),
        openLimit: Number(openLimitInput),
        notificationMessage,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      onNotice(result.error ?? "公開状態を変更できませんでした");
    else {
      setScheduleOpen(false);
      onNotice(
        next === "scheduled"
          ? "公開を予約しました"
          : next === "published"
            ? "パックを公開しました"
            : next === "draft"
              ? "公開予約を取り消しました"
              : "パックの公開を終了しました",
      );
      onChanged();
    }
  }

  async function duplicatePack() {
    const response = await fetch(`/api/admin/packs/${pack.id}/duplicate`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) onNotice(result.error ?? "パックを複製できませんでした");
    else {
      onNotice("カードを引き継いだ下書きを作成しました");
      onChanged();
    }
  }

  async function saveDetails() {
    const response = await fetch(`/api/admin/packs/${pack.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDescription }),
    });
    const result = await response.json();
    if (!response.ok)
      onNotice(result.error ?? "基本情報を保存できませんでした");
    else {
      setEditOpen(false);
      onNotice("リリース情報を保存しました");
      onChanged();
    }
  }

  async function changePackCard(cardId: string, action: "add" | "remove") {
    const response = await fetch(`/api/admin/packs/${pack.id}/cards`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId, action }),
    });
    const result = await response.json();
    if (!response.ok)
      onNotice(result.error ?? "収録カードを変更できませんでした");
    else {
      onNotice(
        action === "add"
          ? "登録済みカードを追加しました"
          : "パックからカードを外しました",
      );
      onChanged();
    }
  }

  async function deletePack() {
    const response = await fetch(`/api/admin/packs/${pack.id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    setDeleteOpen(false);
    if (!response.ok) onNotice(result.error ?? "パックを削除できませんでした");
    else {
      onNotice("パックを削除しました");
      onChanged();
    }
  }

  const statusLabel =
    pack.status === "published"
      ? "公開中"
      : pack.status === "scheduled"
        ? "公開予約"
        : pack.status === "archived"
          ? "終了"
          : "下書き";
  return (
    <article className={`admin-pack ${manageOpen ? "is-managing" : ""}`}>
      <div className="admin-pack-head">
        <div>
          <div className="admin-pack-meta">
            <span className={`pack-status status-${pack.status}`}>
              {statusLabel}
            </span>
            <span>{pack.cards.length}枚</span>
            {pack.status === "scheduled" && pack.publishAt ? (
              <span>
                {new Date(pack.publishAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>
          <h3>{pack.name}</h3>
          <p>{pack.description || "説明なし"}</p>
        </div>
        <div className="admin-pack-actions">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            プレビュー
          </Button>
          <Button onClick={() => setManageOpen((value) => !value)}>
            {manageOpen ? "閉じる" : "管理"}
          </Button>
        </div>
      </div>
      <div className="admin-card-strip">
        {pack.cards.length ? (
          pack.cards.map((card) => (
            <div className="admin-card-item" key={card.id}>
              <CardTile card={card} />
              {pack.status === "draft" ? (
                <button
                  type="button"
                  className="remove-pack-card"
                  onClick={() => void changePackCard(card.id, "remove")}
                  aria-label={`${card.name}をパックから外す`}
                >
                  外す
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="mini-empty">カードはまだありません</p>
        )}
      </div>
      {manageOpen ? (
        <div className="admin-pack-manager">
          <div className="admin-pack-commandbar">
            {pack.status === "draft" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditName(pack.name);
                    setEditDescription(pack.description);
                    setEditOpen(true);
                  }}
                >
                  基本情報
                </Button>
                <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                  公開予約
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void changeReleaseStatus("published")}
                >
                  今すぐ公開
                </Button>
              </>
            ) : null}
            {pack.status === "scheduled" ? (
              <Button
                variant="outline"
                onClick={() => void changeReleaseStatus("draft")}
              >
                予約取消
              </Button>
            ) : null}
            {pack.status === "published" ? (
              <Button
                variant="outline"
                onClick={() => void changeReleaseStatus("archived")}
              >
                公開終了
              </Button>
            ) : null}
            <Button variant="outline" onClick={duplicatePack}>
              複製
            </Button>
            {pack.status !== "published" ? (
              <Button
                variant="outline"
                className="delete-pack-button"
                onClick={() => setDeleteOpen(true)}
              >
                削除
              </Button>
            ) : null}
          </div>
          {pack.status === "draft" ? (
            <>
              <div className="card-upload-head">
                <div>
                  <strong>収録カード</strong>
                  <small>登録済みから選択、または新しいカードを登録</small>
                </div>
                <Button variant="outline" onClick={() => setPickerOpen(true)}>
                  収録カードを選ぶ
                </Button>
              </div>
              <div className="card-upload">
                <div className={`image-drop ${image ? "has-image" : ""}`}>
                  <label htmlFor={`card-image-${pack.id}`}>
                    完成カード画像
                  </label>
                  <Input
                    key={fileKey}
                    id={`card-image-${pack.id}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setImage(event.target.files?.[0] ?? null)
                    }
                  />
                  {image ? (
                    <div className="upload-preview">
                      <img
                        src={imagePreview}
                        alt="追加するカードのプレビュー"
                      />
                      <span>
                        <strong>{image.name}</strong>
                        <small>
                          {(image.size / 1024 / 1024).toFixed(1)} MB
                        </small>
                      </span>
                    </div>
                  ) : (
                    <p>PNG・JPEG・WebP</p>
                  )}
                </div>
                <div className="json-field">
                  <label htmlFor={`card-json-${pack.id}`}>専用GPTのJSON</label>
                  <Textarea
                    id={`card-json-${pack.id}`}
                    rows={7}
                    value={json}
                    onChange={(event) => setJson(event.target.value)}
                    placeholder={'{"schema":"pitch-archive-card-v1", ...}'}
                  />
                  {json.trim() ? (
                    <div
                      className={`json-check ${jsonPreview ? "is-valid" : "is-invalid"}`}
                    >
                      {jsonPreview ? (
                        <>
                          <strong>{jsonPreview.name || "選手名なし"}</strong>
                          <span>
                            {jsonPreview.rarity || "RARITYなし"} ·{" "}
                            {jsonPreview.series || "SERIESなし"}
                          </span>
                        </>
                      ) : (
                        <span>JSONの形式を確認してください</span>
                      )}
                    </div>
                  ) : null}
                </div>
                <Button
                  className="upload-submit"
                  onClick={uploadCard}
                  disabled={busy || !image || !jsonPreview}
                >
                  {busy ? busyLabel : "カードを追加"}
                </Button>
              </div>
            </>
          ) : (
            <div className="pack-locked">
              <strong>
                {pack.status === "published"
                  ? "公開中の内容は固定されています"
                  : "終了したパックです"}
              </strong>
              <p>
                内容を変更する場合は複製して新しい下書きを作成してください。
              </p>
            </div>
          )}
        </div>
      ) : null}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="delete-pack-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>「{pack.name}」を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              パックと選択履歴は削除されます。この操作は元に戻せません。参加者が獲得済みのカードと登録済みカード画像は残ります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deletePack}>
              パックを削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="pack-create-dialog">
          <DialogHeader>
            <p className="section-kicker">EDIT RELEASE</p>
            <DialogTitle>基本情報を編集</DialogTitle>
            <DialogDescription>
              下書きの名前と説明を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="pack-create-form">
            <div>
              <label htmlFor={`edit-name-${pack.id}`}>リリース名</label>
              <Input
                id={`edit-name-${pack.id}`}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`edit-description-${pack.id}`}>説明</label>
              <Textarea
                id={`edit-description-${pack.id}`}
                rows={4}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>
            <Button onClick={saveDetails} disabled={!editName.trim()}>
              変更を保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="pack-create-dialog">
          <DialogHeader>
            <p className="section-kicker">SCHEDULE RELEASE</p>
            <DialogTitle>公開を予約</DialogTitle>
            <DialogDescription>
              指定した日時に自動公開し、終了日時に過去パックへ移動します。
            </DialogDescription>
          </DialogHeader>
          <div className="pack-create-form schedule-form">
            <div>
              <label htmlFor={`publish-at-${pack.id}`}>公開日時</label>
              <Input
                id={`publish-at-${pack.id}`}
                type="datetime-local"
                value={publishAtInput}
                onChange={(event) => setPublishAtInput(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`end-at-${pack.id}`}>終了日時</label>
              <Input
                id={`end-at-${pack.id}`}
                type="datetime-local"
                value={endAtInput}
                onChange={(event) => setEndAtInput(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`open-limit-${pack.id}`}>
                1人あたりの無料開封回数
              </label>
              <Select value={openLimitInput} onValueChange={setOpenLimitInput}>
                <SelectTrigger id={`open-limit-${pack.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1回</SelectItem>
                  <SelectItem value="2">2回</SelectItem>
                  <SelectItem value="3">3回</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor={`pack-notice-${pack.id}`}>公開通知</label>
              <Input
                id={`pack-notice-${pack.id}`}
                maxLength={120}
                value={notificationMessage}
                onChange={(event) => setNotificationMessage(event.target.value)}
                placeholder={pack.name}
              />
            </div>
            <Button
              onClick={() => void changeReleaseStatus("scheduled")}
              disabled={!publishAtInput || !endAtInput}
            >
              この内容で予約
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="card-picker-dialog">
          <DialogHeader>
            <p className="section-kicker">CARD LIBRARY</p>
            <DialogTitle>収録カードを選択</DialogTitle>
            <DialogDescription>
              登録済みカードを「{pack.name}
              」に追加します。追加済みのカードは表示されません。
            </DialogDescription>
          </DialogHeader>
          <div className="card-picker-summary">
            <span>
              現在の収録<strong>{pack.cards.length}枚</strong>
            </span>
            <span>
              追加可能<strong>{availableCards.length}枚</strong>
            </span>
          </div>
          <Input
            className="card-picker-search"
            value={catalogSearch}
            onChange={(event) => setCatalogSearch(event.target.value)}
            placeholder="選手名・チーム・シリーズで検索"
          />
          {availableCards.length ? (
            <div className="card-picker-grid">
              {availableCards.map((card) => (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => void changePackCard(card.id, "add")}
                >
                  <img
                    src={card.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    <strong>{card.name}</strong>
                    <small>
                      {card.rarity} · {card.team || card.country}
                    </small>
                  </span>
                  <b>収録する</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="picker-empty">
              条件に合う追加可能なカードはありません
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="pack-preview-dialog">
          <DialogHeader>
            <p className="section-kicker">PLAYER PREVIEW</p>
            <DialogTitle>参加者画面のプレビュー</DialogTitle>
            <DialogDescription>
              公開前にリリースの表示を確認できます。
            </DialogDescription>
          </DialogHeader>
          <section className="public-pack preview-pack">
            <div className="public-pack-head">
              <div>
                <p className="section-kicker">RANDOM DRAW</p>
                <h3>{pack.name}</h3>
                <p>{pack.description || "説明はまだありません"}</p>
              </div>
              <div className="pack-badges">
                <span>{pack.cards.length} CARDS</span>
                <strong>1 RANDOM</strong>
              </div>
            </div>
            {pack.cards.length ? (
              <>
                <div className="public-card-grid">
                  {pack.cards.map((card) => (
                    <div className="select-card" key={card.id}>
                      <CardTile card={card} />
                    </div>
                  ))}
                </div>
                <div className="pack-draw-bar">
                  <span>収録カードから1枚をランダムで獲得</span>
                  <Button disabled>パックを開ける</Button>
                </div>
              </>
            ) : (
              <div className="picker-empty">
                カードを追加するとここに表示されます
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export default function ArchiveApp({ initialName }: { initialName: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [cardCatalog, setCardCatalog] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [packName, setPackName] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [creatingPack, setCreatingPack] = useState(false);
  const [claim, setClaim] = useState<PackView | null>(null);
  const [viewingPack, setViewingPack] = useState<PackView | null>(null);
  const [packView, setPackView] = useState<"active" | "past">("active");
  const [selectedCardScope, setSelectedCardScope] = useState<SharedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<SharedCard | null>(null);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [seriesFilter, setSeriesFilter] = useState("ALL");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [adminPackFilter, setAdminPackFilter] = useState<
    "ALL" | PackView["status"]
  >("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "unlinked" | "candidate">("all");
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [purgePreview, setPurgePreview] = useState<PurgePreview | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [purgingUsers, setPurgingUsers] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [adminPackSearch, setAdminPackSearch] = useState("");
  const [adminPackPage, setAdminPackPage] = useState(1);
  const [adminView, setAdminView] = useState<
    "players" | "packs" | "cards" | "operations"
  >("packs");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileFileKey, setProfileFileKey] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [adminGoogleLinked, setAdminGoogleLinked] = useState<boolean | null>(null);
  const [adminGoogleEmail, setAdminGoogleEmail] = useState<string | null>(null);
  const [adminLinkKey, setAdminLinkKey] = useState("");
  const [linkingAdminGoogle, setLinkingAdminGoogle] = useState(false);
  const [managedUser, setManagedUser] = useState<UserView | null>(null);
  const [activeTab, setActiveTab] = useState("packs");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [socialSubpageOpen, setSocialSubpageOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [socialInitialView, setSocialInitialView] = useState<"friends" | "requests" | "trades">("friends");
  const [notificationData, setNotificationData] = useState<NotificationData>({
    notifications: [],
    unreadCount: 0,
  });
  const profilePreview = useMemo(
    () => (profileImage ? URL.createObjectURL(profileImage) : ""),
    [profileImage],
  );
  useEffect(
    () => () => {
      if (profilePreview) URL.revokeObjectURL(profilePreview);
    },
    [profilePreview],
  );

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) {
      setDashboard(result);
      if (result.session?.role === "admin") {
        const cardsResponse = await fetch("/api/admin/cards", {
          cache: "no-store",
        });
        const cardsResult = await cardsResponse.json();
        if (cardsResponse.ok) setCardCatalog(cardsResult.cards ?? []);
      }
    } else setNotice(result.error ?? "データを読み込めませんでした");
    setLoading(false);
  }, []);
  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const result = (await response.json()) as NotificationData;
    setNotificationData(result);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/dashboard", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          setNotice(result.error ?? "データを読み込めませんでした");
          setLoading(false);
          return;
        }
        setDashboard(result);
        if (result.session?.role === "admin") {
          const cardsResponse = await fetch("/api/admin/cards", {
            cache: "no-store",
            signal: controller.signal,
          });
          const cardsResult = await cardsResponse.json();
          if (cardsResponse.ok) setCardCatalog(cardsResult.cards ?? []);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setNotice("データを読み込めませんでした");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (dashboard?.session.status !== "approved") return;
    const initialTimer = window.setTimeout(() => void loadNotifications(), 0);
    const timer = window.setInterval(() => void loadNotifications(), 30000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [dashboard?.session.status, loadNotifications]);
  useEffect(() => {
    if (!dashboard || dashboard.session.role === "admin") return;
    const controller=new AbortController();
    void fetch("/api/auth/google/status",{ cache:"no-store",signal:controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result=await response.json() as { linked:boolean;email:string | null };
        setGoogleLinked(result.linked);setGoogleEmail(result.email);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [dashboard]);
  useEffect(() => {
    if (!dashboard || dashboard.session.role !== "admin") return;
    const controller=new AbortController();
    void fetch("/api/admin/auth/google/status",{ cache:"no-store",signal:controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result=await response.json() as { linked:boolean;email:string | null };
        setAdminGoogleLinked(result.linked);setAdminGoogleEmail(result.email);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [dashboard]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function createPack() {
    if (!packName.trim()) return setNotice("パック名を入力してください");
    setCreatingPack(true);
    try {
      const response = await fetch("/api/admin/packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: packName, description: packDescription }),
      });
      const result = await response.json();
      if (!response.ok)
        return setNotice(result.error ?? "パックを作成できませんでした");
      setPackName("");
      setPackDescription("");
      setPackDialogOpen(false);
      setNotice("新しいパックを作成しました");
      void load();
    } catch {
      setNotice("通信に失敗しました。もう一度お試しください");
    } finally {
      setCreatingPack(false);
    }
  }

  async function linkAdminGoogle() {
    if (!adminLinkKey) return setNotice("運営用アクセスキーを入力してください");
    setLinkingAdminGoogle(true);
    try {
      const response=await fetch("/api/admin/auth/google/link/start",{ method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify({ accessKey:adminLinkKey }) });
      const result=await response.json() as { url?:string;error?:string };
      if (!response.ok || !result.url) return setNotice(result.error ?? "Google連携を開始できませんでした");
      window.location.assign(result.url);
    } catch { setNotice("Google連携を開始できませんでした"); }
    finally { setLinkingAdminGoogle(false); }
  }

  function seedInitialPack() {
    setAdminView("cards");
    setNotice("登録済みカード一覧を開きました");
  }

  async function updateUser(
    email: string,
    status: "approved" | "pending" | "suspended",
  ) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, status }),
    });
    const result = await response.json();
    if (!response.ok)
      return setNotice(result.error ?? "参加者を更新できませんでした");
    setNotice(
      status === "approved"
        ? "参加を承認しました"
        : status === "suspended"
          ? "アカウントを停止しました"
          : "承認を取り消しました",
    );
    setManagedUser(null);
    void load();
  }

  async function resetUserProfile(email: string) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, action: "reset-profile" }),
    });
    const result = await response.json();
    if (!response.ok)
      return setNotice(result.error ?? "プロフィールを初期化できませんでした");
    setNotice("名前とプロフィール画像を初期化しました");
    setManagedUser(null);
    void load();
  }

  async function previewUserPurge() {
    if (!selectedUserEmails.length) return;
    try {
      const response=await fetch("/api/admin/users/purge-preview",{
        method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify({ emails:selectedUserEmails }),
      });
      const result=await response.json() as PurgePreview & { error?:string };
      if (!response.ok) return setNotice(result.error ?? "削除内容を確認できませんでした");
      setPurgeConfirmation("");
      setPurgePreview(result);
    } catch { setNotice("削除内容を確認できませんでした"); }
  }

  async function purgeSelectedUsers() {
    if (!purgePreview) return;
    setPurgingUsers(true);
    try {
      const response=await fetch("/api/admin/users/purge",{
        method:"POST",headers:{ "content-type":"application/json" },body:JSON.stringify({ emails:selectedUserEmails,confirmation:purgeConfirmation }),
      });
      const result=await response.json() as { error?:string;userCount?:number };
      if (!response.ok) {
        setPurgePreview(null);
        return setNotice(result.error ?? "アカウントを削除できませんでした");
      }
      setNotice(`${result.userCount ?? selectedUserEmails.length}件のアカウントを削除しました`);
      setSelectedUserEmails([]);
      setPurgePreview(null);
      setPurgeConfirmation("");
      void load();
    } catch { setNotice("アカウントを削除できませんでした"); }
    finally { setPurgingUsers(false); }
  }

  function openSettings() {
    if (!dashboard) return;
    setProfileName(dashboard.session.displayName);
    setProfileImage(null);
    setProfileFileKey((value) => value + 1);
    setSettingsOpen(true);
  }

  async function saveProfile() {
    if (!profileName.trim()) return setNotice("アカウント名を入力してください");
    setSavingProfile(true);
    try {
      const nameResponse = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: profileName }),
      });
      const nameResult = await nameResponse.json();
      if (!nameResponse.ok)
        return setNotice(
          nameResult.error ?? "アカウント名を変更できませんでした",
        );
      if (profileImage) {
        const optimized = await optimizeAvatarImage(profileImage);
        const form = new FormData();
        form.set("avatar", optimized);
        const imageResponse = await fetch("/api/profile", {
          method: "PUT",
          body: form,
        });
        const imageResult = await imageResponse.json();
        if (!imageResponse.ok)
          return setNotice(
            imageResult.error ?? "プロフィール画像を変更できませんでした",
          );
      }
      setSettingsOpen(false);
      setNotice("アカウント設定を保存しました");
      await load();
    } catch {
      setNotice("通信に失敗しました。もう一度お試しください");
    } finally {
      setSavingProfile(false);
    }
  }

  async function removeProfileImage() {
    setSavingProfile(true);
    try {
      const response = await fetch("/api/profile", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok)
        return setNotice(
          result.error ?? "プロフィール画像を削除できませんでした",
        );
      setProfileImage(null);
      setProfileFileKey((value) => value + 1);
      setNotice("プロフィール画像を削除しました");
      await load();
    } catch {
      setNotice("通信に失敗しました。もう一度お試しください");
    } finally {
      setSavingProfile(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (item.readAt === null) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read", id: item.id }),
      });
    }
    if (item.destination === "social") {
      setSocialInitialView(item.type === "trade" ? "trades" : "requests");
      setActiveTab("social");
    } else if (item.destination === "packs") setActiveTab(item.destination);
    setNotificationsOpen(false);
    void loadNotifications();
  }

  async function readAllNotifications() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    });
    if (response.ok) void loadNotifications();
  }

  function openCard(card: SharedCard, cards: SharedCard[]) {
    setSelectedCardScope(cards);
    setSelectedCard(card);
  }

  function openPackCatalog(pack: PackView) {
    setViewingPack(pack);
  }

  if (loading)
    return (
      <main className="state-shell">
        <div className="loading-mark">PA</div>
        <p>アーカイブを読み込んでいます</p>
      </main>
    );
  if (!dashboard)
    return (
      <main className="state-shell">
        <p>データを読み込めませんでした。</p>
        <Button onClick={() => location.reload()}>再読み込み</Button>
      </main>
    );
  if (dashboard.session.status === "suspended")
    return (
      <main className="state-shell">
        <div className="pending-card">
          <img src="/icon-192.png" alt="" />
          <p className="section-kicker">ACCOUNT SUSPENDED</p>
          <h1>アカウントは停止中です</h1>
          <p>利用状況については運営へ確認してください。</p>
        </div>
      </main>
    );
  if (dashboard.session.status === "pending")
    return (
      <main className="state-shell">
        <div className="pending-card">
          <img src="/icon-192.png" alt="" />
          <p className="section-kicker">SESSION UNAVAILABLE</p>
          <h1>現在利用できません</h1>
          <p>{initialName}さんの利用状況については運営へ確認してください。</p>
        </div>
      </main>
    );

  const isAdmin = dashboard.session.role === "admin";
  const pendingUsers = dashboard.users.filter(
    (user) => user.status === "pending",
  );
  const publishedPacks = dashboard.packs.filter(
    (pack) => pack.status === "published",
  );
  const archivedPacks = dashboard.packs.filter(
    (pack) => pack.status === "archived",
  );
  const playerUsers = dashboard.users.filter((user) => user.role === "player");
  const normalizedUserSearch = userSearch.trim().toLocaleLowerCase();
  const isCleanupCandidate=(user:UserView) => !user.googleLinked && user.cardCount === 0 && user.friendCount === 0 && user.tradeCount === 0 && user.packOpeningCount === 0;
  const filteredUsers = playerUsers.filter((user) =>
    (userFilter === "all" || (userFilter === "unlinked" && !user.googleLinked) || (userFilter === "candidate" && isCleanupCandidate(user))) &&
    (!normalizedUserSearch || `${user.displayName} ${user.email}`.toLocaleLowerCase().includes(normalizedUserSearch)),
  );
  const userPageCount = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE),
  );
  const currentUserPage = Math.min(userPage, userPageCount);
  const pagedUsers = filteredUsers.slice(
    (currentUserPage - 1) * USERS_PER_PAGE,
    currentUserPage * USERS_PER_PAGE,
  );
  const normalizedPackSearch = adminPackSearch.trim().toLocaleLowerCase();
  const filteredAdminPacks = dashboard.packs.filter(
    (pack) =>
      (adminPackFilter === "ALL" || pack.status === adminPackFilter) &&
      (!normalizedPackSearch ||
        `${pack.name} ${pack.description}`
          .toLocaleLowerCase()
          .includes(normalizedPackSearch)),
  );
  const adminPackPageCount = Math.max(
    1,
    Math.ceil(filteredAdminPacks.length / PACKS_PER_PAGE),
  );
  const currentAdminPackPage = Math.min(adminPackPage, adminPackPageCount);
  const visibleAdminPacks = filteredAdminPacks.slice(
    (currentAdminPackPage - 1) * PACKS_PER_PAGE,
    currentAdminPackPage * PACKS_PER_PAGE,
  );
  const seriesOptions = Array.from(
    new Set(dashboard.collection.map((card) => card.series)),
  ).sort();
  const normalizedCollectionSearch = collectionSearch
    .trim()
    .toLocaleLowerCase();
  const visibleCollection = dashboard.collection.filter(
    (card) =>
      (!duplicatesOnly || (card.quantity ?? 1) > 1) &&
      (rarityFilter === "ALL" || card.rarity === rarityFilter) &&
      (seriesFilter === "ALL" || card.series === seriesFilter) &&
      (!normalizedCollectionSearch ||
        `${card.name} ${card.team} ${card.country} ${card.series}`
          .toLocaleLowerCase()
          .includes(normalizedCollectionSearch)),
  );
  const totalCardCount = dashboard.collection.reduce(
    (total, card) => total + (card.quantity ?? 1),
    0,
  );
  const duplicateCardCount = totalCardCount - dashboard.collection.length;
  const managedCardCount = new Set(
    dashboard.packs.flatMap((pack) => pack.cards.map((card) => card.id)),
  ).size;
  const selectedCardList = selectedCardScope.length
    ? selectedCardScope
    : selectedCard &&
        visibleCollection.some((card) => card.id === selectedCard.id)
      ? visibleCollection
      : dashboard.collection;

  return (
    <main className={`network-shell ${socialSubpageOpen || safetyOpen || settingsOpen || notificationsOpen || viewingPack || selectedCard || claim ? "has-native-subpage" : ""}`}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="network-tabs"
      >
        <TabsList className="network-nav">
          <TabsTrigger value="packs">
            <PackageOpen aria-hidden="true" />
            <small>パック</small>
          </TabsTrigger>
          <TabsTrigger value="collection">
            <LibraryBig aria-hidden="true" />
            <small>コレクション</small>
            <span>{dashboard.collection.length}</span>
          </TabsTrigger>
          <TabsTrigger value="social">
            <UsersRound aria-hidden="true" />
            <small>フレンド</small>
          </TabsTrigger>
          <TabsTrigger value="menu">
            <Menu aria-hidden="true" />
            <small>メニュー</small>
            {notificationData.unreadCount ? (
              <span>{notificationData.unreadCount}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="packs"
          className={`network-page ${packView === "past" && !viewingPack ? "is-past-pack-view" : ""}`}
        >
          {viewingPack ? (
            <PackCardCatalog
              pack={viewingPack}
              onBack={() => setViewingPack(null)}
              onCardSelect={(card) => openCard(card, viewingPack.cards)}
            />
          ) : (
            <>
              <section className="packs-heading">
                <div>
                  <p className="section-kicker">
                    {packView === "active"
                      ? "BOOSTER RELEASES"
                      : "PAST RELEASES"}
                  </p>
                  <h1>{packView === "active" ? "パック" : "過去パック"}</h1>
                </div>
                <span>
                  {packView === "active"
                    ? publishedPacks.filter(
                        (pack) => pack.openCount < pack.openLimit,
                      ).length
                    : archivedPacks.length}
                  <small>{packView === "active" ? "READY" : "PACKS"}</small>
                </span>
              </section>
              <Tabs
                value={packView}
                onValueChange={(value) =>
                  setPackView(value as "active" | "past")
                }
                className="pack-view-tabs"
              >
                <TabsList
                  className="pack-view-switch"
                  aria-label="パックの表示を切り替え"
                >
                  <TabsTrigger value="active">
                    開催中<span>{publishedPacks.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="past">
                    過去<span>{archivedPacks.length}</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="pack-view-content">
                  {publishedPacks.length ? (
                    <div className="featured-pack-rail">
                      {publishedPacks.map((pack) => (
                        <PublicPack
                          key={pack.id}
                          pack={pack}
                          onOpen={() => setClaim(pack)}
                          onViewCards={() => openPackCatalog(pack)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="network-empty pack-empty">
                      <PackageOpen size={30} />
                      <strong>公開中のリリースはありません</strong>
                      <p>新しいパックが公開されると、ここに表示されます。</p>
                    </div>
                  )}
                  {publishedPacks.length > 1 ? (
                    <div className="rail-hint">
                      <span>横にスワイプしてパックを選択</span>
                      <div>
                        {publishedPacks.map((pack, index) => (
                          <i
                            key={pack.id}
                            className={index === 0 ? "is-active" : ""}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </TabsContent>
                <TabsContent value="past" className="pack-view-content">
                  {archivedPacks.length ? (
                    <section
                      className="past-packs"
                      aria-label="公開終了したパック"
                    >
                      <div className="past-pack-list">
                        {archivedPacks.map((pack) => (
                          <button
                            type="button"
                            key={pack.id}
                            aria-label={`${pack.name}の収録カードを見る`}
                            onClick={() => openPackCatalog(pack)}
                          >
                            <div>
                              <strong>{pack.name}</strong>
                              <small>
                                {pack.cards.length} CARDS
                                {pack.endAt
                                  ? ` · ${new Date(pack.endAt).toLocaleDateString("ja-JP")}`
                                  : ""}
                              </small>
                            </div>
                            <span>
                              <b>カードを見る</b>
                              <ChevronRight />
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <div className="network-empty pack-empty">
                      <PackageOpen size={30} />
                      <strong>過去パックはありません</strong>
                      <p>公開が終了したパックがここに表示されます。</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </TabsContent>
        <TabsContent value="collection" className="network-page">
          <section className="collection-dashboard">
            <div>
              <p className="section-kicker">MY ARCHIVE</p>
              <h1>コレクション</h1>
              <p>
                {dashboard.collection.length}種類 · {totalCardCount}枚
                <small>{duplicateCardCount ? `${duplicateCardCount}枚の重複` : "重複なし"}</small>
              </p>
            </div>
          </section>
          <CollectionMilestones onChanged={() => void load()} onNotice={setNotice} />
          {dashboard.collection.length ? (
            <>
              <div className="collection-tools">
                <label className="collection-search">
                  <Search size={17} aria-hidden="true" />
                  <Input
                    value={collectionSearch}
                    onChange={(event) =>
                      setCollectionSearch(event.target.value)
                    }
                    placeholder="選手名・クラブ・シリーズで検索"
                    aria-label="カードを検索"
                  />
                </label>
                <div className="rarity-chips" aria-label="レアリティで絞り込み">
                  {(["ALL","CORE","RARE","ELITE","ICON"] as const).map((rarity) => <button type="button" key={rarity} className={rarityFilter === rarity ? "is-active" : ""} onClick={() => setRarityFilter(rarity)}>{rarity === "ALL" ? "すべて" : rarity}</button>)}
                </div>
                <div className="collection-filters">
                  <Select value={seriesFilter} onValueChange={setSeriesFilter}>
                    <SelectTrigger
                      className="filter-select"
                      aria-label="シリーズで絞り込み"
                    >
                      <SelectValue placeholder="シリーズ" />
                    </SelectTrigger>
                    <SelectContent className="filter-select-content">
                      <SelectItem value="ALL">すべてのシリーズ</SelectItem>
                      {seriesOptions.map((series) => (
                        <SelectItem key={series} value={series}>
                          {series}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className={`duplicate-filter ${duplicatesOnly ? "is-active" : ""}`}
                    aria-pressed={duplicatesOnly}
                    onClick={() => setDuplicatesOnly((value) => !value)}
                  >
                    重複のみ
                    {duplicateCardCount ? <b>{duplicateCardCount}</b> : null}
                  </button>
                  <span>{visibleCollection.length}件</span>
                </div>
              </div>
              {visibleCollection.length ? (
                <div className="owned-grid collection-grid">
                  {visibleCollection.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      onSelect={() => openCard(card, visibleCollection)}
                    />
                  ))}
                </div>
              ) : (
                <div className="network-empty">
                  <Search size={26} />
                  <strong>
                    {duplicatesOnly
                      ? "重複カードはありません"
                      : "条件に合うカードがありません"}
                  </strong>
                  <p>
                    {duplicatesOnly
                      ? "同じカードを2枚以上獲得すると、ここに表示されます。"
                      : "検索または絞り込み条件を変更してください。"}
                  </p>
                  <Button variant="outline" onClick={() => { setCollectionSearch("");setRarityFilter("ALL");setSeriesFilter("ALL");setDuplicatesOnly(false); }}>絞り込みをリセット</Button>
                </div>
              )}
            </>
          ) : (
            <div className="network-empty collection-empty">
              <LibraryBig size={32} />
              <strong>最初のカードを集めよう</strong>
              <p>公開パックを開けると、獲得したカードがここに並びます。</p>
              <Button onClick={() => setActiveTab("packs")}>
                パックを見る
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="social" className="network-page">
          <SocialPanel
            key={socialInitialView}
            ownCards={dashboard.collection}
            onNotice={setNotice}
            onCollectionChanged={() => void load()}
            onSubpageChange={setSocialSubpageOpen}
            initialView={socialInitialView}
          />
        </TabsContent>
        <TabsContent value="menu" className="network-page">
          {safetyOpen ? <SafetySettings onBack={() => setSafetyOpen(false)} onNotice={setNotice} /> : <section className="menu-page"><h1 className="root-page-title">メニュー</h1>
            <div className="menu-profile">
              {dashboard.session.avatarUrl ? (
                <img src={dashboard.session.avatarUrl} alt="" />
              ) : (
                <span>{dashboard.session.displayName.slice(0, 1)}</span>
              )}
              <div>
                <small>
                  {isAdmin ? "ADMINISTRATOR" : "PITCH ARCHIVE MEMBER"}
                </small>
                <h2>{dashboard.session.displayName}</h2>
                <p>{totalCardCount} cards · {dashboard.session.points} coins</p>
              </div>
            </div>
            {!isAdmin && googleLinked === false ? (
              <section className="account-protection-card">
                <KeyRound aria-hidden="true" />
                <div>
                  <strong>このアカウントを保護</strong>
                  <p>Googleアカウントを連携すると、ブラウザのデータを消してもこのアカウントに戻れます。</p>
                </div>
                <a href="/api/auth/google/start?mode=link">Googleアカウントを連携</a>
              </section>
            ) : null}
            {isAdmin && adminGoogleLinked === false ? (
              <section className="account-protection-card">
                <KeyRound aria-hidden="true" />
                <div><strong>管理者Googleアカウントを連携してください</strong><p>次回以降の運営ログインは、Google本人確認とアクセスキーの2段階になります。</p></div>
                <button type="button" onClick={() => setSettingsOpen(true)}>連携設定を開く</button>
              </section>
            ) : null}
            <p className="menu-section-label">TODAY</p><DailyAndExchange
              onChanged={() => void load()}
              onNotice={setNotice}
            />
            <p className="menu-section-label">ACCOUNT</p><div className="menu-list">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(true);
                  void loadNotifications();
                }}
              >
                <Bell />
                <span>
                  <strong>通知</strong>
                  <small>ゲーム内イベントのお知らせ</small>
                </span>
                {notificationData.unreadCount ? (
                  <b>{notificationData.unreadCount}</b>
                ) : null}
                <ChevronRight />
              </button>
              <button type="button" onClick={openSettings}>
                <Settings />
                <span>
                  <strong>アカウント設定</strong>
                  <small>名前とプロフィール画像を変更</small>
                </span>
                <ChevronRight />
              </button>
              <button type="button" onClick={() => setSafetyOpen(true)}>
                <ShieldCheck />
                <span><strong>プライバシー・安全</strong><small>ブロック中のユーザーとフレンドID</small></span>
                <ChevronRight />
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className="admin-menu-link"
                  onClick={() => setActiveTab("admin")}
                >
                  <ShieldCheck />
                  <span>
                    <strong>運営ダッシュボード</strong>
                    <small>参加者・パック・操作ログを管理</small>
                  </span>
                  {pendingUsers.length ? <b>{pendingUsers.length}</b> : null}
                  <ChevronRight />
                </button>
              ) : null}
            </div>
            <p className="menu-section-label">ABOUT</p><a className="menu-policy-link" href="/privacy">プライバシーポリシー <ChevronRight /></a>
          </section>}
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="admin" className="network-page">
            <section className="admin-compact-header">
              <div>
                <p className="section-kicker">ADMIN CONTROL</p>
                <h2>運営</h2>
              </div>
              <Button onClick={() => setPackDialogOpen(true)}>
                ＋ パック作成
              </Button>
            </section>
            <section className="admin-stats" aria-label="運営状況">
              <div>
                <span>公開中</span>
                <strong>{publishedPacks.length}</strong>
                <small>/ {MAX_PUBLISHED_PACKS}</small>
              </div>
              <div>
                <span>公開予約</span>
                <strong>
                  {
                    dashboard.packs.filter(
                      (pack) => pack.status === "scheduled",
                    ).length
                  }
                </strong>
                <small>SCHEDULED</small>
              </div>
              <div>
                <span>下書き</span>
                <strong>
                  {
                    dashboard.packs.filter((pack) => pack.status === "draft")
                      .length
                  }
                </strong>
                <small>DRAFTS</small>
              </div>
              <div>
                <span>終了</span>
                <strong>{archivedPacks.length}</strong>
                <small>ARCHIVED</small>
              </div>
            </section>
            <nav className="admin-view-nav" aria-label="運営機能">
              <button
                type="button"
                className={adminView === "packs" ? "is-active" : ""}
                onClick={() => setAdminView("packs")}
              >
                <PackageOpen />
                パック<span>{dashboard.packs.length}</span>
              </button>
              <button
                type="button"
                className={adminView === "cards" ? "is-active" : ""}
                onClick={() => setAdminView("cards")}
              >
                <LibraryBig />
                カード<span>{cardCatalog.length}</span>
              </button>
              <button
                type="button"
                className={adminView === "players" ? "is-active" : ""}
                onClick={() => setAdminView("players")}
              >
                <UsersRound />
                参加者
                {pendingUsers.length ? (
                  <span>{pendingUsers.length}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={adminView === "operations" ? "is-active" : ""}
                onClick={() => setAdminView("operations")}
              >
                <ShieldCheck />
                ツール
              </button>
            </nav>
            {adminView === "players" ? (
              <section className="admin-section admin-compact-panel">
                <div className="admin-section-head">
                  <div>
                    <h3>参加者管理</h3>
                    <p>承認・停止・プロフィール初期化</p>
                  </div>
                  <span>{pendingUsers.length} PENDING</span>
                </div>
                <div className="admin-list-toolbar">
                  <Input
                    value={userSearch}
                    onChange={(event) => {
                      setUserSearch(event.target.value);
                      setUserPage(1);
                      setSelectedUserEmails([]);
                    }}
                    placeholder="名前・メールで検索"
                    aria-label="参加者を検索"
                  />
                  <span>{filteredUsers.length}人</span>
                </div>
                <div className="user-cleanup-filters" aria-label="参加者フィルター">
                  {([ ["all","全員"],["unlinked","Google未連携"],["candidate","整理候補"] ] as const).map(([value,label]) => (
                    <button type="button" className={userFilter === value ? "is-active" : ""} key={value} onClick={() => { setUserFilter(value);setUserPage(1);setSelectedUserEmails([]); }}>{label}</button>
                  ))}
                  <button type="button" onClick={() => {
                    const selectable=filteredUsers.filter((user) => !user.googleLinked).slice(0,50).map((user) => user.email);
                    setSelectedUserEmails(selectedUserEmails.length === selectable.length && selectable.every((email) => selectedUserEmails.includes(email)) ? [] : selectable);
                  }}>表示中を全選択</button>
                </div>
                <div className="user-list">
                  {pagedUsers.length ? (
                    pagedUsers.map((user) => (
                      <div className="user-row" key={user.email}>
                        <div>
                          <input className="user-select-checkbox" type="checkbox" aria-label={`${user.displayName}を選択`} disabled={Boolean(user.googleLinked)} checked={selectedUserEmails.includes(user.email)} onChange={(event) => setSelectedUserEmails((current) => event.target.checked ? [...current,user.email].slice(0,50) : current.filter((email) => email !== user.email))} />
                          {user.avatarUrl ? (
                            <img
                              className="admin-user-avatar"
                              src={user.avatarUrl}
                              alt=""
                            />
                          ) : null}
                          <span>
                            <strong>{user.displayName}</strong>
                            <small>{user.email}</small>
                            <em>
                              {user.cardCount}カード · {user.friendCount}フレンド · {user.packOpeningCount}開封 · {user.tradeCount}トレード
                            </em>
                            <em className={user.googleLinked ? "google-linked" : "google-unlinked"}>{user.googleLinked ? "Google 連携済み" : "Google 未連携"}</em>
                            <em>コイン {user.points} · 最終利用 {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleDateString("ja-JP",{ timeZone:"Asia/Tokyo" }) : "記録なし"}</em>
                            {isCleanupCandidate(user) ? <b className="cleanup-candidate">整理候補</b> : null}
                          </span>
                        </div>
                        <div>
                          <span className={`user-status status-${user.status}`}>
                            {user.status === "approved"
                              ? "利用中"
                              : user.status === "suspended"
                                ? "停止中"
                                : "承認待ち"}
                          </span>
                          <Button
                            variant="outline"
                            onClick={() => setManagedUser(user)}
                          >
                            管理
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="mini-empty">
                      {playerUsers.length
                        ? "条件に合う参加者はいません"
                        : "参加申請はまだありません"}
                    </p>
                  )}
                </div>
                {selectedUserEmails.length ? (
                  <div className="user-selection-bar"><strong>{selectedUserEmails.length}件選択中</strong><Button onClick={() => void previewUserPurge()}>削除内容を確認</Button></div>
                ) : null}
                {filteredUsers.length > USERS_PER_PAGE ? (
                  <div className="admin-pagination">
                    <Button
                      variant="outline"
                      disabled={currentUserPage === 1}
                      onClick={() => setUserPage(currentUserPage - 1)}
                    >
                      前へ
                    </Button>
                    <span>
                      {currentUserPage} / {userPageCount}
                    </span>
                    <Button
                      variant="outline"
                      disabled={currentUserPage === userPageCount}
                      onClick={() => setUserPage(currentUserPage + 1)}
                    >
                      次へ
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
            {adminView === "packs" ? (
              <section className="admin-compact-panel">
                <div className="admin-compact-title">
                  <div>
                    <h3>パック管理</h3>
                    <p>下書き・予約・公開・カード追加</p>
                  </div>
                  <Button variant="outline" onClick={seedInitialPack}>
                    既存カード登録
                  </Button>
                </div>
                <div className="admin-pack-controls">
                  <div className="admin-pack-filters">
                    {(
                      [
                        "ALL",
                        "draft",
                        "scheduled",
                        "published",
                        "archived",
                      ] as const
                    ).map((status) => (
                      <button
                        type="button"
                        className={
                          adminPackFilter === status ? "is-active" : ""
                        }
                        key={status}
                        onClick={() => {
                          setAdminPackFilter(status);
                          setAdminPackPage(1);
                        }}
                      >
                        {status === "ALL"
                          ? "すべて"
                          : status === "draft"
                            ? "下書き"
                            : status === "scheduled"
                              ? "予約"
                              : status === "published"
                                ? "公開中"
                                : "終了"}
                        <span>
                          {status === "ALL"
                            ? dashboard.packs.length
                            : dashboard.packs.filter(
                                (pack) => pack.status === status,
                              ).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="admin-list-toolbar pack-search">
                    <Input
                      value={adminPackSearch}
                      onChange={(event) => {
                        setAdminPackSearch(event.target.value);
                        setAdminPackPage(1);
                      }}
                      placeholder="パックを検索"
                      aria-label="パックを検索"
                    />
                    <span>{filteredAdminPacks.length}件</span>
                  </div>
                </div>
                <div className="admin-pack-list">
                  {visibleAdminPacks.length ? (
                    visibleAdminPacks.map((pack) => (
                      <AdminPack
                        key={pack.id}
                        pack={pack}
                        catalog={cardCatalog}
                        publishedCount={publishedPacks.length}
                        onChanged={() => void load()}
                        onNotice={setNotice}
                      />
                    ))
                  ) : (
                    <div className="network-empty">
                      <strong>該当するパックはありません</strong>
                      <p>新しいパックを作成してください。</p>
                    </div>
                  )}
                </div>
                {filteredAdminPacks.length > PACKS_PER_PAGE ? (
                  <div className="admin-pagination pack-pagination">
                    <Button
                      variant="outline"
                      disabled={currentAdminPackPage === 1}
                      onClick={() => setAdminPackPage(currentAdminPackPage - 1)}
                    >
                      前へ
                    </Button>
                    <span>
                      {currentAdminPackPage} / {adminPackPageCount}
                    </span>
                    <Button
                      variant="outline"
                      disabled={currentAdminPackPage === adminPackPageCount}
                      onClick={() => setAdminPackPage(currentAdminPackPage + 1)}
                    >
                      次へ
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
            {adminView === "cards" ? (
              <AdminCardLibrary
                cards={cardCatalog}
                onChanged={() => void load()}
                onNotice={setNotice}
              />
            ) : null}
            {adminView === "operations" ? (
              <AdminOperations />
            ) : null}
          </TabsContent>
        ) : null}
      </Tabs>
      {notice ? (
        <button className="toast" onClick={() => setNotice("")} type="button">
          {notice}
        </button>
      ) : null}
      {claim ? <PackOpeningExperience pack={claim} onClose={() => setClaim(null)} onClaimed={(card) => { setNotice(card ? `${card.name}を獲得しました` : "カードを獲得しました");void load(); }} onViewCollection={() => { setClaim(null);setActiveTab("collection"); }} /> : null}
      <AlertDialog open={Boolean(purgePreview)} onOpenChange={(open) => { if (!open && !purgingUsers) { setPurgePreview(null);setPurgeConfirmation(""); } }}>
        <AlertDialogContent className="user-purge-dialog">
          <AlertDialogHeader>
            <p className="section-kicker">ADMIN ACCOUNT CLEANUP</p>
            <AlertDialogTitle>アカウントを完全削除</AlertDialogTitle>
            <AlertDialogDescription>アカウントと関連データは完全に削除されます。この操作は元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          {purgePreview ? <div className="purge-summary">
            <span>対象アカウント<strong>{purgePreview.userCount}</strong></span>
            <span>Google連携<strong>{purgePreview.googleLinkedCount}</strong></span>
            <span>所持カード<strong>{purgePreview.cardCopies}</strong></span>
            <span>パック開封履歴<strong>{purgePreview.packOpenings}</strong></span>
            <span>フレンド関係<strong>{purgePreview.friendRelations}</strong></span>
            <span>トレード<strong>{purgePreview.trades}</strong></span>
            <span>通知<strong>{purgePreview.notifications}</strong></span>
            <span>所持コイン<strong>{purgePreview.pointsTotal}</strong></span>
          </div> : null}
          {purgePreview ? <div className="purge-confirmation"><label htmlFor="purge-confirmation">確認のため <strong>{`DELETE ${purgePreview.userCount} ACCOUNTS`}</strong> と入力</label><Input id="purge-confirmation" value={purgeConfirmation} onChange={(event) => setPurgeConfirmation(event.target.value)} autoComplete="off" /></div> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgingUsers}>キャンセル</AlertDialogCancel>
            <AlertDialogAction className="purge-users-button" disabled={!purgePreview || purgeConfirmation !== `DELETE ${purgePreview.userCount} ACCOUNTS` || purgePreview.googleLinkedCount > 0 || purgingUsers} onClick={(event) => { event.preventDefault();void purgeSelectedUsers(); }}>{purgingUsers ? "削除中..." : "完全削除する"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {selectedCard ? <CollectionCardViewer card={selectedCard} cards={selectedCardList} onChange={setSelectedCard} onClose={() => { setSelectedCard(null);setSelectedCardScope([]); }} /> : null}
      <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
        <DialogContent className="pack-create-dialog">
          <DialogHeader>
            <p className="section-kicker">CREATE NEW RELEASE</p>
            <DialogTitle>新しいリリースを作成</DialogTitle>
            <DialogDescription>
              下書きとして作成し、カードを追加した後で公開します。
            </DialogDescription>
          </DialogHeader>
          <div className="pack-create-form">
            <div>
              <label htmlFor="pack-name">リリース名</label>
              <Input
                id="pack-name"
                value={packName}
                onChange={(event) => setPackName(event.target.value)}
                placeholder="例：FIRST EDITION"
              />
            </div>
            <div>
              <label htmlFor="pack-description">説明</label>
              <Textarea
                id="pack-description"
                rows={3}
                value={packDescription}
                onChange={(event) => setPackDescription(event.target.value)}
                placeholder="収録テーマや説明を入力"
              />
            </div>
            <Button
              onClick={createPack}
              disabled={creatingPack || !packName.trim()}
            >
              {creatingPack ? "作成中…" : "下書きを作成"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          if (!savingProfile) setSettingsOpen(open);
        }}
      >
        <DialogContent className="account-settings-dialog">
          <DialogHeader>
            <p className="section-kicker">ACCOUNT SETTINGS</p>
            <DialogTitle>アカウント設定</DialogTitle>
            <DialogDescription>
              参加者に表示される名前とプロフィール画像を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="profile-editor">
            <div className="profile-avatar-preview">
              {profilePreview || dashboard.session.avatarUrl ? (
                <img
                  src={profilePreview || dashboard.session.avatarUrl || ""}
                  alt="プロフィール画像のプレビュー"
                />
              ) : (
                <span>
                  {(profileName || dashboard.session.displayName).slice(0, 1)}
                </span>
              )}
            </div>
            <div className="profile-image-actions">
              <label htmlFor="profile-image">画像を選択</label>
              <Input
                key={profileFileKey}
                id="profile-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={savingProfile}
                onChange={(event) =>
                  setProfileImage(event.target.files?.[0] ?? null)
                }
              />
              {dashboard.session.avatarUrl ? (
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => void removeProfileImage()}
                >
                  現在の画像を削除
                </button>
              ) : null}
            </div>
            <div className="profile-name-field">
              <label htmlFor="profile-name">アカウント名</label>
              <Input
                id="profile-name"
                maxLength={24}
                value={profileName}
                disabled={savingProfile}
                onChange={(event) => setProfileName(event.target.value)}
              />
              <small>{profileName.trim().length} / 24文字</small>
            </div>
            <Button
              className="profile-save"
              disabled={savingProfile || !profileName.trim()}
              onClick={() => void saveProfile()}
            >
              {savingProfile ? "保存中…" : "変更を保存"}
            </Button>
            {!isAdmin ? (
              <section className="account-security-settings google-account-settings">
                <div>
                  <KeyRound aria-hidden="true" />
                  <span>
                    <strong>アカウント保護</strong>
                    <small>Googleアカウント　{googleLinked ? "連携済み" : "未連携"}</small>
                  </span>
                </div>
                {googleLinked ? (
                  <p>{googleEmail}<br />Googleアカウントで復元できます</p>
                ) : (
                  <a href="/api/auth/google/start?mode=link">Googleアカウントを連携</a>
                )}
              </section>
            ) : (
              <section className="account-security-settings google-account-settings">
                <div><KeyRound aria-hidden="true" /><span><strong>管理者2段階認証</strong><small>Googleアカウント　{adminGoogleLinked ? "連携済み" : "未連携"}</small></span></div>
                {adminGoogleLinked ? <p>{adminGoogleEmail}<br />次回からGoogle確認とアクセスキーが必要です</p> : <div className="admin-google-link-form"><Input type="password" autoComplete="current-password" placeholder="運営用アクセスキーを再入力" value={adminLinkKey} onChange={(event) => setAdminLinkKey(event.target.value)} /><Button disabled={linkingAdminGoogle || !adminLinkKey} onClick={() => void linkAdminGoogle()}>{linkingAdminGoogle ? "連携開始中…" : "Googleアカウントを連携"}</Button></div>}
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="notifications-dialog">
          <DialogHeader>
            <div className="notifications-heading">
              <div>
                <p className="section-kicker">NOTIFICATIONS</p>
                <DialogTitle>通知</DialogTitle>
              </div>
              {notificationData.unreadCount ? (
                <Button
                  variant="outline"
                  onClick={() => void readAllNotifications()}
                >
                  すべて既読
                </Button>
              ) : null}
            </div>
            <DialogDescription>
              パック、フレンド、トレードなどゲーム内イベントの通知です。
            </DialogDescription>
          </DialogHeader>
          {notificationData.notifications.length ? (
            <div className="notification-list">
              {notificationData.notifications.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${item.readAt === null ? "is-unread" : ""}`}
                  onClick={() => void openNotification(item)}
                >
                  <span className={`notification-icon type-${item.type}`}>
                    {item.type === "friend"
                      ? "F"
                      : item.type === "trade"
                        ? "T"
                        : item.type === "pack"
                          ? "P"
                          : "A"}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small>
                      {new Date(item.createdAt).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  {item.readAt === null ? <i aria-label="未読" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="notification-empty">
              <Bell size={24} aria-hidden="true" />
              <strong>通知はまだありません</strong>
              <p>新しいお知らせが届くと、ここに表示されます。</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(managedUser)}
        onOpenChange={(open) => {
          if (!open) setManagedUser(null);
        }}
      >
        <DialogContent className="user-manage-dialog">
          {managedUser ? (
            <>
              <DialogHeader>
                <p className="section-kicker">PLAYER MANAGEMENT</p>
                <DialogTitle>{managedUser.displayName}</DialogTitle>
                <DialogDescription>
                  {managedUser.email} · {managedUser.friendCount}フレンド ·{" "}
                  {managedUser.tradeCount}トレード
                </DialogDescription>
              </DialogHeader>
              <div className="user-manage-actions">
                {managedUser.status !== "approved" ? (
                  <Button
                    onClick={() =>
                      void updateUser(managedUser.email, "approved")
                    }
                  >
                    利用を承認・再開
                  </Button>
                ) : null}
                {managedUser.status === "approved" ? (
                  <Button
                    variant="outline"
                    className="suspend-user-button"
                    onClick={() =>
                      void updateUser(managedUser.email, "suspended")
                    }
                  >
                    アカウントを停止
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => void resetUserProfile(managedUser.email)}
                >
                  名前・画像を初期化
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
