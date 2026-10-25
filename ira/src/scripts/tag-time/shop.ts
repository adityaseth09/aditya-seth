/**
 * Ira's coin shop: spend coins earned in-game on outfits and dances.
 * Purchases and selections persist in localStorage.
 */

import { sounds } from "./sounds";

export interface ShopItem {
  id: string;
  name: string;
  kind: "outfit" | "dance";
  price: number;
  emoji: string;
  desc: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "party", name: "Party Hat", kind: "outfit", price: 5, emoji: "🥳", desc: "a hat for parties!" },
  { id: "bowtie", name: "Fancy Bowtie", kind: "outfit", price: 6, emoji: "🎀", desc: "so fancy!" },
  { id: "cape", name: "Super Cape", kind: "outfit", price: 8, emoji: "🦸", desc: "a cape that waves in the wind!" },
  { id: "crown", name: "Golden Crown", kind: "outfit", price: 12, emoji: "👑", desc: "for royalty!" },
  { id: "wiggle", name: "Wiggle Wiggle", kind: "dance", price: 8, emoji: "💃", desc: "wiggle when you win!" },
  { id: "twirl", name: "Super Twirl", kind: "dance", price: 10, emoji: "🌀", desc: "spin around when you win!" },
  { id: "stars", name: "Star Jumps", kind: "dance", price: 12, emoji: "⭐", desc: "jump for joy when you win!" },
];

const LS_OWNED = "tagTime:owned";
const LS_OUTFIT = "tagTime:outfit";
const LS_DANCE = "tagTime:dance";

export function ownedItems(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_OWNED) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveOwned(owned: Set<string>): void {
  localStorage.setItem(LS_OWNED, JSON.stringify([...owned]));
}

export function selectedOutfit(): string | null {
  return localStorage.getItem(LS_OUTFIT);
}

export function selectedDance(): string | null {
  return localStorage.getItem(LS_DANCE);
}

export interface ShopHandle {
  root: HTMLElement;
  open: () => void;
  close: () => void;
  refresh: () => void;
}

/**
 * Build the shop UI inside #shopRow. Callbacks let it read/spend the wallet
 * and notify the game that a selection changed.
 */
export function buildShop(
  getCoins: () => number,
  trySpend: (n: number) => boolean,
  onSelectionChange: () => void,
): ShopHandle {
  const root = document.getElementById("shopOverlay");
  const row = document.getElementById("shopRow");
  const walletEl = document.getElementById("shopCoins");
  if (!root || !row || !walletEl) throw new Error("shop markup missing");

  const render = (): void => {
    const owned = ownedItems();
    walletEl.textContent = `your coins: ${getCoins()}`;
    row.innerHTML = "";
    for (const item of SHOP_ITEMS) {
      const isOwned = owned.has(item.id);
      const isSelected =
        (item.kind === "outfit" && selectedOutfit() === item.id) ||
        (item.kind === "dance" && selectedDance() === item.id);

      const card = document.createElement("div");
      card.className = "sketchy bg-white/80 p-3 text-center";
      card.style.width = "150px";

      const emoji = document.createElement("div");
      emoji.textContent = item.emoji;
      emoji.style.fontSize = "2.2rem";
      card.appendChild(emoji);

      const name = document.createElement("div");
      name.textContent = item.name;
      name.style.fontWeight = "700";
      card.appendChild(name);

      const desc = document.createElement("div");
      desc.textContent = item.desc;
      desc.style.fontSize = "0.85rem";
      desc.style.opacity = "0.7";
      card.appendChild(desc);

      const btn = document.createElement("button");
      if (!isOwned) {
        btn.textContent = `buy  ${item.price} 🪙`;
        btn.className = "crayon-btn";
        (btn as HTMLButtonElement).style.background = "var(--crayon-orange)";
        (btn as HTMLButtonElement).style.fontSize = "1rem";
        btn.addEventListener("click", () => {
          if (!trySpend(item.price)) {
            walletEl.textContent = `not enough coins! you have ${getCoins()} — go play a level!`;
            return;
          }
          owned.add(item.id);
          saveOwned(owned);
          localStorage.setItem(
            item.kind === "outfit" ? LS_OUTFIT : LS_DANCE,
            item.id,
          );
          sounds.coin();
          onSelectionChange();
          render();
        });
      } else if (isSelected) {
        btn.textContent = item.kind === "outfit" ? "wearing it!" : "dancing it!";
        btn.className = "crayon-btn";
        (btn as HTMLButtonElement).style.background = "var(--crayon-green)";
        (btn as HTMLButtonElement).style.fontSize = "1rem";
        btn.addEventListener("click", () => {
          localStorage.removeItem(item.kind === "outfit" ? LS_OUTFIT : LS_DANCE);
          onSelectionChange();
          render();
        });
      } else {
        btn.textContent = item.kind === "outfit" ? "wear it!" : "dance it!";
        btn.className = "crayon-btn";
        (btn as HTMLButtonElement).style.background = "var(--crayon-blue)";
        (btn as HTMLButtonElement).style.fontSize = "1rem";
        btn.addEventListener("click", () => {
          localStorage.setItem(
            item.kind === "outfit" ? LS_OUTFIT : LS_DANCE,
            item.id,
          );
          onSelectionChange();
          render();
        });
      }
      card.appendChild(btn);
      row.appendChild(card);
    }
  };

  return {
    root,
    open: () => {
      render();
      root.classList.remove("hidden");
    },
    close: () => root.classList.add("hidden"),
    refresh: render,
  };
}
