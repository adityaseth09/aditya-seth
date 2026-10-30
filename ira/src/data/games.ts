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
  sketch: { src: string; alt: string; caption?: string };
  isNew?: boolean;
}

export const GAMES: GameInfo[] = [
  {
    id: "clam-collector",
    title: "Clam Collector!",
    href: "/games/clam-collector/",
    emoji: "🐙",
    color: "var(--crayon-blue)",
    tagline:
      "Swim through the sea, collect every key, and open the clam to find the pearl! Watch out — coral sticks to you, and the fish, jellies and eels send you back to the start.",
    badges: ["👫 1 or 2 players", "🐙 5 octopuses", "🌊 3 seas", "🐚 8 levels"],
    sketch: {
      src: "/clam-collector-card.svg",
      alt: "An octopus swimming past keys and coral toward a clam with a pearl",
      caption: "swim, grab the keys, open the clam!",
    },
    isNew: true,
  },
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
