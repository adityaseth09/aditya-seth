/**
 * Ira's coin shop: spend coins earned in-game on outfits and dances.
 * Purchases and selections persist in localStorage.
 */

import { sounds, currentSongId, setSong } from "./sounds";

export interface ShopItem {
  id: string;
  name: string;
  kind: "outfit" | "dance" | "song" | "pet";
  price: number;
  emoji: string;
  desc: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "ira", name: "Ira's Tune", kind: "song", price: 0, emoji: "🎶", desc: "the classic song — free!" },
  { id: "bouncy", name: "Bouncy Song", kind: "song", price: 10, emoji: "🎵", desc: "fast and bouncy!" },
  { id: "sleepy", name: "Sleepy Song", kind: "song", price: 10, emoji: "🌙", desc: "slow and calm…" },
  { id: "space", name: "Space Song", kind: "song", price: 12, emoji: "🚀", desc: "music from the stars!" },
  { id: "rain", name: "Rainy Day", kind: "song", price: 10, emoji: "🌧️", desc: "pitter patter…" },
  { id: "race", name: "Race Song", kind: "song", price: 15, emoji: "🏁", desc: "super fast!" },
  { id: "monster", name: "Monster Parade", kind: "song", price: 14, emoji: "👹", desc: "stompy monster music!" },
  { id: "gusty", name: "Gusty Song", kind: "song", price: 12, emoji: "💨", desc: "whooshy wind planet music!" },
  { id: "volcano", name: "Volcano Song", kind: "song", price: 14, emoji: "🌋", desc: "a big stompy volcano march!" },
  { id: "party", name: "Party Hat", kind: "outfit", price: 5, emoji: "🥳", desc: "a hat for parties!" },
  { id: "bowtie", name: "Fancy Bowtie", kind: "outfit", price: 6, emoji: "🎀", desc: "so fancy!" },
  { id: "cape", name: "Super Cape", kind: "outfit", price: 8, emoji: "🦸", desc: "a cape that waves in the wind!" },
  { id: "crown", name: "Golden Crown", kind: "outfit", price: 12, emoji: "👑", desc: "for royalty!" },
  { id: "wings", name: "Flutter Wings", kind: "outfit", price: 10, emoji: "🪽", desc: "wings that flap when you run!" },
  { id: "helmet", name: "Space Helmet", kind: "outfit", price: 12, emoji: "👩‍🚀", desc: "a bubble helmet for the planets!" },
  { id: "shades", name: "Cool Sunglasses", kind: "outfit", price: 8, emoji: "😎", desc: "look super cool!" },
  { id: "socks", name: "Rainbow Socks", kind: "outfit", price: 6, emoji: "🧦", desc: "rainbow stripes on your feet!" },
  { id: "wiggle", name: "Wiggle Wiggle", kind: "dance", price: 8, emoji: "💃", desc: "wiggle when you win!" },
  { id: "twirl", name: "Super Twirl", kind: "dance", price: 10, emoji: "🌀", desc: "spin around when you win!" },
  { id: "stars", name: "Star Jumps", kind: "dance", price: 12, emoji: "⭐", desc: "jump for joy when you win!" },
  { id: "moonwalk", name: "Moonwalk", kind: "dance", price: 10, emoji: "🚶", desc: "glide backwards when you win!" },
  { id: "robot", name: "Robot Dance", kind: "dance", price: 12, emoji: "🤖", desc: "beep boop! do the robot!" },
  { id: "backflip", name: "Backflip", kind: "dance", price: 14, emoji: "🤸", desc: "flip all the way around!" },
  { id: "petStar", name: "Twinkle the Star", kind: "pet", price: 15, emoji: "⭐", desc: "a little star that follows you!" },
  { id: "petAlien", name: "Zorp the Alien", kind: "pet", price: 18, emoji: "👽", desc: "a green buddy from space!" },
];

const LS_OWNED = "tagTime:owned";
const LS_OUTFIT = "tagTime:outfit";
const LS_DANCE = "tagTime:dance";
const LS_PET = "tagTime:pet";

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

export function selectedPet(): string | null {
  return localStorage.getItem(LS_PET);
}

function storageKeyFor(item: ShopItem): string {
  if (item.kind === "outfit") return LS_OUTFIT;
  if (item.kind === "dance") return LS_DANCE;
  if (item.kind === "pet") return LS_PET;
  return "tagTime:song";
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
      // the default song is always owned (it's free)
      const isOwned = item.kind === "song" && item.price === 0 ? true : owned.has(item.id);
      const isSelected =
        (item.kind === "outfit" && selectedOutfit() === item.id) ||
        (item.kind === "dance" && selectedDance() === item.id) ||
        (item.kind === "pet" && selectedPet() === item.id) ||
        (item.kind === "song" && currentSongId() === item.id);

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
          localStorage.setItem(storageKeyFor(item), item.id);
          if (item.kind === "song") setSong(item.id);
          sounds.coin();
          onSelectionChange();
          render();
        });
      } else if (isSelected) {
        btn.textContent =
          item.kind === "outfit"
            ? "wearing it!"
            : item.kind === "dance"
              ? "dancing it!"
              : item.kind === "pet"
                ? "following you!"
                : "playing it!";
        btn.className = "crayon-btn";
        (btn as HTMLButtonElement).style.background = "var(--crayon-green)";
        (btn as HTMLButtonElement).style.fontSize = "1rem";
        btn.addEventListener("click", () => {
          if (item.kind === "outfit") localStorage.removeItem(LS_OUTFIT);
          else if (item.kind === "dance") localStorage.removeItem(LS_DANCE);
          else if (item.kind === "pet") localStorage.removeItem(LS_PET);
          else if (item.kind === "song") setSong("ira"); // back to the free tune
          onSelectionChange();
          render();
        });
      } else {
        btn.textContent =
          item.kind === "outfit"
            ? "wear it!"
            : item.kind === "dance"
              ? "dance it!"
              : item.kind === "pet"
                ? "follow me!"
                : "play it!";
        btn.className = "crayon-btn";
        (btn as HTMLButtonElement).style.background = "var(--crayon-blue)";
        (btn as HTMLButtonElement).style.fontSize = "1rem";
        btn.addEventListener("click", () => {
          localStorage.setItem(storageKeyFor(item), item.id);
          if (item.kind === "song") setSong(item.id);
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
