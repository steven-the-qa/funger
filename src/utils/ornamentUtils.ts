export interface OrnamentDetails {
  emoji: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// Ornament types and details
const ORNAMENT_DETAILS: Record<string, OrnamentDetails> = {
  // Common ornaments
  rock: {
    emoji: '🪨',
    name: 'Garden Rock',
    description: 'A decorative rock for your garden.',
    rarity: 'common'
  },
  mushroom: {
    emoji: '🍄',
    name: 'Mushroom',
    description: 'A cute garden mushroom.',
    rarity: 'common'
  },
  
  // Uncommon ornaments
  fountain: {
    emoji: '⛲',
    name: 'Fountain',
    description: 'A beautiful water fountain.',
    rarity: 'uncommon'
  },
  bench: {
    emoji: '🪑',
    name: 'Garden Bench',
    description: 'A cozy place to rest.',
    rarity: 'uncommon'
  },
  
  // Rare ornaments
  gnome: {
    emoji: '🧙',
    name: 'Garden Gnome',
    description: 'A friendly garden gnome.',
    rarity: 'rare'
  },
  flamingo: {
    emoji: '🦩',
    name: 'Pink Flamingo',
    description: 'A classic lawn ornament.',
    rarity: 'rare'
  },
  
  // Epic ornaments
  statue: {
    emoji: '🗿',
    name: 'Garden Statue',
    description: 'An impressive stone statue.',
    rarity: 'epic'
  },
  pond: {
    emoji: '🌊',
    name: 'Garden Pond',
    description: 'A peaceful pond for your garden.',
    rarity: 'epic'
  },
  
  // Legendary ornaments
  golden_statue: {
    emoji: '🏆',
    name: 'Golden Statue',
    description: 'A magnificent golden statue.',
    rarity: 'legendary'
  },
  rainbow_fountain: {
    emoji: '🌈',
    name: 'Rainbow Fountain',
    description: 'A magical rainbow fountain.',
    rarity: 'legendary'
  }
};

// All available ornament types
export const ORNAMENT_TYPES = Object.keys(ORNAMENT_DETAILS);

// Get ornament details by type
export const getOrnamentDetails = (type: string): OrnamentDetails | null => {
  return ORNAMENT_DETAILS[type] || null;
};

// Get all ornaments of a specific rarity
export const getOrnamentsByRarity = (rarity: string): string[] => {
  return ORNAMENT_TYPES.filter(type => ORNAMENT_DETAILS[type].rarity === rarity);
};

// Get a random ornament type based on rarity distribution
export const getRandomOrnamentType = (): string => {
  // Probability distribution for ornament rarities
  const rarityProbabilities = {
    common: 0.5,     // 50% chance
    uncommon: 0.3,   // 30% chance
    rare: 0.15,      // 15% chance
    epic: 0.04,      // 4% chance
    legendary: 0.01  // 1% chance
  };
  
  const random = Math.random();
  let cumulativeProbability = 0;
  
  // Determine rarity based on probability
  let selectedRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
  
  for (const [rarity, probability] of Object.entries(rarityProbabilities)) {
    cumulativeProbability += probability;
    
    if (random <= cumulativeProbability) {
      selectedRarity = rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
      break;
    }
  }
  
  // Get ornaments of the selected rarity
  const ornaments = getOrnamentsByRarity(selectedRarity);
  
  // Select a random ornament from that rarity
  const randomIndex = Math.floor(Math.random() * ornaments.length);
  return ornaments[randomIndex];
}; 