import type { Parts, Combo } from "@ncblast/shared";

/**
 * The full Beyblade X parts library — blades, ratchets, bits.
 * These seed the user's parts library on first load; users can add/remove
 * items but the defaults are merged back in via `mergeWithDefaults`.
 */
export const DEFAULT_PARTS: Parts = {
  blades: ["Wizard Rod","Shark Scale","Cobalt Dragoon","Aero Pegasus","Hover Wyvern","Golem Rock","Meteor Dragoon","Phoenix Wing","Silver Wolf","Clock Mirage","Antler","Arc","Bear Scratch","Bite Croc","Black Shell","Blast","Blitz","Brave","Brush","Bullet Griffon","Bumblebee","Captain America","Chewbacca","Cobalt Drake","Crimson Garuda","Cutter Shinobi","Dark","Darth Vader","Draciel Shield","Dragoon Storm","Dran Buster","Dran Dagger","Dran Strike","Dran Sword","Dranzer Spiral","Driger S","Eclipse","Fang","Flame","Flare","Fort","Fortress","General Grievous","Ghost Circle","Gill Shark","Goat Tackle","Green Goblin","Hack Viking","Hells Chain","Hells Hammer","Hells Scythe","Hunt","Impact Drake","Iron Man","Knight Lance","Knight Mail","Knight Shield","Leon Claw","Leon Crest","Lightning L-Drago","Luke Skywalker","Megatron","Might","Miles Morales","Moff Gideon","Mosasaurus","Mummy Curse","Obi-Wan Kenobi","Optimus Primal","Optimus Prime","Orochi Cluster","Phoenix Feather","Phoenix Rudder","Ptera Wing","Quetzalcoatlus","Rage","Rampart Aegis","Reaper","Red Hulk","Rhino Horn","Ridge Triceratops","Ring Aether","Rock Leone","Samurai Calibur","Samurai Saber","Samurai Steel","Scorpio Spear","Shadow Shinobi","Shark Edge","Shelter Drake","Shinobi Knife","Soundwave","Sphinx Cowl","Spider-Man","Spinosaurus","Starscream","Storm Pegasus","Storm Spriggan","Storm Trooper","Stun Medusa","T.Rex","Thanos","The Mandalorian","Tricera Press","Tusk Mammoth","Tyranno Beat","Tyranno Roar","Unicorn Sting","Valor Bison","Venom","Victory Valkyrie","Viper Tail","Volt","Weiss Tiger","Whale Wave","Wizard Arrow","Wriggle","Wyvern Gale","Xeno Xcalibur","Yell Kong"],
  ratchets: ["1-60","3-60","9-60","7-60","5-60","1-70","1-50","7-70","7-55","8-70","0-60","0-70","0-80","1-80","2-60","2-70","2-80","3-70","3-80","3-85","4-50","4-55","4-60","4-70","4-80","5-70","5-80","6-60","6-70","6-80","7-80","9-65","9-70","9-80","M-85","Operate","Turbo"],
  bits: ["Elevate","Rush","Low-Rush","Free-Ball","Hexa","Low-Orb","Kick","Level","Ball","Jolt","Accel","Bound-Spike","Cyclone","Disk-Ball","Disk-Spike","Dot","Flat","Free-Flat","Gear-Ball","Gear-Flat","Gear-Needle","Gear-Point","Gear-Rush","Glide","High-Needle","High-Taper","Ignition","Low-Flat","Merge","Needle","Orb","Point","Quake","Rubber-Accel","Spike","Taper","Trans-Kick","Trans-Point","Under-Flat","Under-Needle","Unite","Vortex","Wall-Ball","Wall-Wedge","Wedge","Yielding","Zap"],
};

// Crossover blades (collapsible section at bottom of blade picker)
export const CROSSOVER_BLADES: string[] = ["Bumblebee", "Captain America", "Chewbacca", "Darth Vader", "Draciel Shield", "Dragoon Storm", "Dranzer Spiral", "Driger S", "General Grievous", "Green Goblin", "Iron Man", "Lightning L-Drago", "Luke Skywalker", "Megatron", "Miles Morales", "Moff Gideon", "Mosasaurus", "Obi-Wan Kenobi", "Optimus Primal", "Optimus Prime", "Quetzalcoatlus", "Red Hulk", "Rock Leone", "Soundwave", "Spider-Man", "Spinosaurus", "Starscream", "Storm Pegasus", "Storm Spriggan", "Storm Trooper", "T.Rex", "Thanos", "The Mandalorian", "Venom", "Victory Valkyrie", "Xeno Xcalibur"];

// CX (Customize Xtend) system parts
export const CX_CHIPS: string[] = ["Standard","Emperor","Valkyrie"];
export const CX_BLADES: string[] = ["Blast","Arc","Antler","Brave","Brush","Dark","Eclipse","Fang","Flare","Flame","Fort","Hunt","Might","Reaper","Volt","Wriggle"];
export const CXE_BLADES: string[] = ["Blitz","Fortress","Rage"];
export const CXE_OVER_BLADES: string[] = ["Break","Guard","Flow"];
export const CX_ASSISTS: string[] = ["Accel", "Bound", "Defense", "Dual", "Flare", "Flow", "Forge", "Free", "Guard", "Heavy", "High", "Jolt", "Low", "Normal", "Rush", "Slash", "Spike", "Tail", "Taper", "Trans", "Wheel", "Wide", "Xtend"];
export const CX_ASSIST_TOP5: string[] = ["Heavy", "Wheel", "Slash", "Free", "Dual"];

// Quick full combos for blade picker shortcuts
export const QUICK_COMBOS: Required<Combo>[] = [
  {blade:"Wizard Rod",  ratchet:"1-60", bit:"Hexa",         updatedAt: 0},
  {blade:"Wizard Rod",  ratchet:"1-60", bit:"Low-Orb",      updatedAt: 0},
  {blade:"Cobalt Dragoon", ratchet:"5-60", bit:"Elevate",   updatedAt: 0},
  {blade:"Cobalt Dragoon", ratchet:"9-60", bit:"Elevate",   updatedAt: 0},
  {blade:"Shark Scale", ratchet:"3-60", bit:"Low-Rush",     updatedAt: 0},
  {blade:"Shark Scale", ratchet:"3-60", bit:"Free-Ball",    updatedAt: 0},
  {blade:"Golem Rock",  ratchet:"9-60", bit:"Free-Ball",    updatedAt: 0},
  {blade:"Aero Pegasus", ratchet:"1-50", bit:"Rush",        updatedAt: 0},
  {blade:"Hover Wyvern", ratchet:"9-60", bit:"Kick",        updatedAt: 0},
  {blade:"Meteor Dragoon", ratchet:"7-70", bit:"Level",     updatedAt: 0},
  {blade:"Meteor Dragoon", ratchet:"7-60", bit:"Level",     updatedAt: 0},
  {blade:"Clock Mirage", ratchet:"7-55", bit:"Free-Ball",   updatedAt: 0},
];

// Top 10 priority items per category (displayed first as a group)
export const TOP10: Record<"blades"|"ratchets"|"bits", string[]> = {
  blades: ["Wizard Rod","Shark Scale","Cobalt Dragoon","Aero Pegasus","Hover Wyvern","Golem Rock","Meteor Dragoon","Phoenix Wing","Silver Wolf","Clock Mirage"],
  ratchets: ["1-50","1-60","1-70","3-60","5-60","7-55","7-60","7-70","8-70","9-60"],
  bits: ["Ball","Elevate","Free-Ball","Hexa","Jolt","Kick","Level","Low-Orb","Low-Rush","Rush"],
};

// Individual colors for top 10 blades
export const BLADE_COLORS: Record<string, string> = {
  "Wizard Rod":    "#EAB308", // yellow
  "Shark Scale":   "#7C3AED", // purple
  "Cobalt Dragoon":"#1E40AF", // dark blue
  "Aero Pegasus":  "#0D9488", // teal
  "Hover Wyvern":  "#15803D", // green
  "Golem Rock":    "#EA580C", // orange
  "Meteor Dragoon":"#A855F7", // light purple
  "Phoenix Wing":  "#DC2626", // red
  "Silver Wolf":   "#64748B", // grey
  "Clock Mirage":  "#065F46", // dark green
};

export function mergeWithDefaults(saved: Partial<Parts>): Parts {
  // Merge: defaults keep their order (pinned first), user extras appended alphabetically
  function mergeList(defaults: string[], savedList: string[] | undefined): string[] {
    const extras = (savedList || []).filter((x) => !defaults.includes(x)).sort();
    return [...new Set([...defaults, ...extras])];
  }
  return {
    blades: mergeList(DEFAULT_PARTS.blades, saved.blades),
    ratchets: mergeList(DEFAULT_PARTS.ratchets, saved.ratchets),
    bits: mergeList(DEFAULT_PARTS.bits, saved.bits),
  };
}
