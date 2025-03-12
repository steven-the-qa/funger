export interface PlantDetails {
  emoji: string;
  name: string;
  description: string;
}

type PlantType = 'flower' | 'veggie' | 'fruit' | 'tree' | 'luck';
type PlantVariant = 'basic' | 'rare' | 'epic' | 'legendary';

// Plant emoji mappings
const PLANT_EMOJIS: Record<PlantType, Record<PlantVariant, string>> = {
  flower: {
    basic: '🌼',
    rare: '🌸',
    epic: '🌺',
    legendary: '🌹'
  },
  veggie: {
    basic: '🥕',
    rare: '🥦',
    epic: '🌽',
    legendary: '🍆'
  },
  fruit: {
    basic: '🍎',
    rare: '🍐',
    epic: '🍓',
    legendary: '🍑'
  },
  tree: {
    basic: '🌳',
    rare: '🌲',
    epic: '🌴',
    legendary: '🎄'
  },
  luck: {
    basic: '🍀',
    rare: '🍀',
    epic: '🍀',
    legendary: '🍀'
  }
};

// Plant names and descriptions
const PLANT_DETAILS: Record<PlantType, Record<PlantVariant, PlantDetails>> = {
  flower: {
    basic: { 
      emoji: PLANT_EMOJIS.flower.basic, 
      name: 'Daisy', 
      description: 'A simple but beautiful daisy.' 
    },
    rare: { 
      emoji: PLANT_EMOJIS.flower.rare, 
      name: 'Cherry Blossom', 
      description: 'A delicate cherry blossom.' 
    },
    epic: { 
      emoji: PLANT_EMOJIS.flower.epic, 
      name: 'Hibiscus', 
      description: 'A vibrant tropical hibiscus.' 
    },
    legendary: { 
      emoji: PLANT_EMOJIS.flower.legendary, 
      name: 'Rose', 
      description: 'A beautiful rose in full bloom.' 
    }
  },
  veggie: {
    basic: { 
      emoji: PLANT_EMOJIS.veggie.basic, 
      name: 'Carrot', 
      description: 'A crunchy carrot.' 
    },
    rare: { 
      emoji: PLANT_EMOJIS.veggie.rare, 
      name: 'Broccoli', 
      description: 'A healthy broccoli.' 
    },
    epic: { 
      emoji: PLANT_EMOJIS.veggie.epic, 
      name: 'Corn', 
      description: 'A sweet corn on the cob.' 
    },
    legendary: { 
      emoji: PLANT_EMOJIS.veggie.legendary, 
      name: 'Eggplant', 
      description: 'A ripe eggplant.' 
    }
  },
  fruit: {
    basic: { 
      emoji: PLANT_EMOJIS.fruit.basic, 
      name: 'Apple', 
      description: 'A juicy apple.' 
    },
    rare: { 
      emoji: PLANT_EMOJIS.fruit.rare, 
      name: 'Pear', 
      description: 'A sweet pear.' 
    },
    epic: { 
      emoji: PLANT_EMOJIS.fruit.epic, 
      name: 'Strawberry', 
      description: 'A ripe strawberry.' 
    },
    legendary: { 
      emoji: PLANT_EMOJIS.fruit.legendary, 
      name: 'Peach', 
      description: 'A fuzzy peach.' 
    }
  },
  tree: {
    basic: { 
      emoji: PLANT_EMOJIS.tree.basic, 
      name: 'Oak Tree', 
      description: 'A sturdy oak tree.' 
    },
    rare: { 
      emoji: PLANT_EMOJIS.tree.rare, 
      name: 'Pine Tree', 
      description: 'A fragrant pine tree.' 
    },
    epic: { 
      emoji: PLANT_EMOJIS.tree.epic, 
      name: 'Palm Tree', 
      description: 'A tropical palm tree.' 
    },
    legendary: { 
      emoji: PLANT_EMOJIS.tree.legendary, 
      name: 'Festive Tree', 
      description: 'A special festive tree.' 
    }
  },
  luck: {
    basic: { 
      emoji: PLANT_EMOJIS.luck.basic, 
      name: 'Lucky Clover', 
      description: 'A lucky four-leaf clover.' 
    },
    rare: { 
      emoji: PLANT_EMOJIS.luck.rare, 
      name: 'Big Lucky Clover', 
      description: 'A bigger, luckier four-leaf clover.' 
    },
    epic: { 
      emoji: PLANT_EMOJIS.luck.epic, 
      name: 'Grand Lucky Clover', 
      description: 'An impressively large four-leaf clover radiating luck.' 
    },
    legendary: { 
      emoji: PLANT_EMOJIS.luck.legendary, 
      name: 'Legendary Lucky Clover', 
      description: 'An enormous four-leaf clover with extraordinary luck powers.' 
    }
  }
};

// Get the emoji for a plant
export const getPlantEmoji = (type: string, variant: string): string => {
  if (!type || !variant) return '❓';
  
  const plantType = type as PlantType;
  const plantVariant = variant as PlantVariant;
  
  return PLANT_EMOJIS[plantType]?.[plantVariant] || '❓';
};

// Get plant details
export const getPlantDetails = (type: string, variant: string): PlantDetails | null => {
  if (!type || !variant) return null;
  
  const plantType = type as PlantType;
  const plantVariant = variant as PlantVariant;
  
  return PLANT_DETAILS[plantType]?.[plantVariant] || null;
};

// Get upgrade cost (in flowers)
export const getUpgradeCost = (currentVariant: string): number => {
  switch (currentVariant) {
    case 'basic': return 5;
    case 'rare': return 10;
    case 'epic': return 15;
    default: return 0; // Legendary plants can't be upgraded
  }
};

// Get next variant
export const getNextVariant = (currentVariant: string): PlantVariant | null => {
  switch (currentVariant) {
    case 'basic': return 'rare';
    case 'rare': return 'epic';
    case 'epic': return 'legendary';
    default: return null; // Legendary plants can't be upgraded
  }
}; 