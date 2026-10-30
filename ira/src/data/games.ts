/**
 * Ira's game shelf. Every game on ira.seth.ltd is listed here once — the
 * homepage cards and the in-game "switch game" buttons read from this list.
 * To add a new game: add an entry here + a page in src/pages/games/.
 */
export interface GameInfo {
  id: string;
  title: string;
  href: string;
  emoji: string;
  /** crayon color for the card + buttons */
  color: string;
  tagline: string;
  /** little sticker badges on the card */
  badges: string[];
  sketch: { src: string; alt: string };
  isNew?: boolean;
}

export const GAMES: GameInfo[] = [
  {
    id: "food-run",
    title: "Food Run!",
    href: "/games/food-run/",
    emoji: "🍕",
    color: "var(--crayon-orange)",
    tagline:
      "Eat lots of food and find the best food in the world! Grab the Energy Bar to go super fast — and when you find a sack of sugar… do you want sugar? yes or no?",
    badges: ["👫 1 or 2 players", "🐶 5 characters", "🌍 4 food worlds", "🍔 20 levels"],
    sketch: { src: "/ira-sketch-food-run.jpg", alt: "Ira's hand-drawn design for Food Run, with Mia, Ziggy, Stella the dog, Robo and Ira" },
    isNew: true,
  },
  {
    id: "tag-time",
    title: "Tag Time!",
    href: "/games/tag-time/",
    emoji: "🔑",
    color: "var(--crayon-red)",
    tagline:
      "Jump over the lava and spikes, dodge the beasts and birds (or jump on their heads!), find both keys, push the lever… and open the doors to win!",
    badges: ["👫 1 or 2 players", "🪐 6 planets", "⭐ 60 levels"],
    sketch: { src: "/ira-sketch-tag-time.jpg", alt: "Ira's hand-drawn sketch of Tag Time!" },
  },
];
