export const PRELOADED_CATEGORIES = [
  { name: "Early NASA Spaceflight", icon: "Rocket", desc: "Mercury, Gemini, and Apollo era technical engineering and mishaps." },
  { name: "The Legend of Zelda", icon: "Sword", desc: "Lore and developmental design secrets from 1986 to today." },
  { name: "Modernist Architecture", icon: "Building", desc: "Bauhaus, Brutalism, and mid-century design pioneers." },
  { name: "90s Alternative Rock", icon: "Music", desc: "Indie pressings, legendary sessions, and forgotten side projects." },
  { name: "The Office (US)", icon: "Briefcase", desc: "The deepest cuts from Dunder Mifflin deleted scenes and table reads." },
  { name: "Roman Empire Military", icon: "Shield", desc: "Tactical formations, specific legion histories, and logistics." },
  { name: "Coffee Brewing Science", icon: "Coffee", desc: "Extraction math, roast chemistry, and equipment mechanics." },
  { name: "Vintage Synthesizers", icon: "Piano", desc: "Circuit designs, module patch limits, and analog synth history." },
  { name: "Pixar Production", icon: "Film", desc: "Render bottlenecks, technical bugs, and story evolution secrets." }
];

export const DIFFICULTY_DESCRIPTIONS = {
  "warm-up": {
    title: "Warm-Up",
    description: "A dedicated fan will find it straightforward. A casual bystander has a fighting chance.",
    color: "from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30"
  },
  "fan": {
    title: "Fan",
    description: "Requires at least a year of deep interest in the topic to get consistently right.",
    color: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30"
  },
  "obsessive": {
    title: "Obsessive",
    description: "Serious deep cuts. You will have to remember tiny credits, specific numbers, and rare releases.",
    color: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30"
  },
  "scholar": {
    title: "Scholar",
    description: "Insider knowledge. Facts usually known only by researchers, original participants, or documentarians.",
    color: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30"
  }
};
