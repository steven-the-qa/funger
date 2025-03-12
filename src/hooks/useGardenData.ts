import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface GardenItem {
  id: string;
  plant_type: string;
  plant_variant: string;
  position_x: number;
  position_y: number;
}

export interface GardenOrnament {
  id: string;
  ornament_type: string;
  position_x: number;
  position_y: number;
}

export interface GardenStats {
  total_sessions_completed: number;
  total_flowers_earned: number;
  flowers_available: number;
  next_upgrade_threshold: number;
}

// Inventory interface to track items the user has earned
export interface ItemInventory {
  [key: string]: number; // type -> count
}

export const useGardenData = (userId: string) => {
  const [gardenItems, setGardenItems] = useState<GardenItem[]>([]);
  const [gardenOrnaments, setGardenOrnaments] = useState<GardenOrnament[]>([]);
  const [gardenStats, setGardenStats] = useState<GardenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<ItemInventory>({});

  const loadGardenData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch garden items
      const { data: itemsData, error: itemsError } = await supabase
        .from('garden_items')
        .select('*')
        .eq('user_id', userId);
        
      if (itemsError) throw itemsError;
      
      // Try to fetch garden ornaments, but handle the case where the table might not exist yet
      let ornamentsData = [];
      try {
        const { data, error } = await supabase
          .from('garden_ornaments')
          .select('*')
          .eq('user_id', userId);
          
        // Only set the data if there was no error
        if (!error) {
          ornamentsData = data || [];
        } else {
          console.log('Garden ornaments table might not exist yet:', error);
        }
      } catch (ornamentError) {
        console.log('Error fetching ornaments (table might not exist yet):', ornamentError);
        // Just continue with empty ornaments data
      }
      
      // Fetch user garden stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_garden_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (statsError && statsError.code !== 'PGRST116') { // Not found is OK for new users
        throw statsError;
      }
      
      // Set the garden data
      setGardenItems(itemsData || []);
      setGardenOrnaments(ornamentsData || []);
      setGardenStats(statsData || {
        total_sessions_completed: 0,
        total_flowers_earned: 0,
        flowers_available: 0,
        next_upgrade_threshold: 5
      });
      
      // Calculate inventory based on existing items (flowers are unlimited if user has enough flower currency)
      calculatePlacedItems(itemsData || [], ornamentsData || []);
      
    } catch (error) {
      console.error('Error loading garden data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Calculate how many of each item type have been placed
  const calculatePlacedItems = (items: GardenItem[], ornaments: GardenOrnament[]) => {
    // Count already placed items
    const placedItems: ItemInventory = {};
    
    // Count placed plants by type
    items.forEach(item => {
      placedItems[item.plant_type] = (placedItems[item.plant_type] || 0) + 1;
    });
    
    // Count placed ornaments by type
    ornaments.forEach(ornament => {
      placedItems[ornament.ornament_type] = (placedItems[ornament.ornament_type] || 0) + 1;
    });
    
    setInventory(placedItems);
  };

  // Get the number of placed items of a specific type
  const getPlacedItemCount = (type: string): number => {
    return inventory[type] || 0;
  };

  // Check if user can afford to place a plant of the given type
  const canAffordPlant = (type: string): boolean => {
    if (!gardenStats) return false;
    
    // Flowers are always affordable
    if (type === 'flower') return true;
    
    // For other plants, check if user has enough flowers to redeem
    const cost = PLANT_COSTS[type] || 0;
    return gardenStats.flowers_available >= cost;
  };

  const createNewPlant = async (type: string, variant: string, gridSize: number) => {
    try {
      // Find an empty position on the grid
      const occupiedPositions = new Set(
        gardenItems.map(item => `${item.position_x},${item.position_y}`)
      );
      
      let position_x = -1;
      let position_y = -1;
      
      // Find first available position
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (!occupiedPositions.has(`${x},${y}`)) {
            position_x = x;
            position_y = y;
            break;
          }
        }
        if (position_x !== -1) break;
      }
      
      // If no space available
      if (position_x === -1) {
        return { success: false, message: "Your garden is full! Consider upgrading your plants instead." };
      }
      
      // Insert new plant
      const { error } = await supabase
        .from('garden_items')
        .insert([
          {
            user_id: userId,
            plant_type: type,
            plant_variant: variant,
            position_x,
            position_y
          }
        ])
        .select();
        
      if (error) throw error;
      
      // Update available flowers count
      if (gardenStats) {
        const cost = type === 'flower' ? 0 : PLANT_COSTS[type] || 0;
        
        const { error: updateError } = await supabase
          .from('user_garden_stats')
          .update({
            flowers_available: (gardenStats.flowers_available || 0) - cost
          })
          .eq('user_id', userId);
          
        if (updateError) throw updateError;
      }
      
      // Refresh garden data
      await loadGardenData();
      return { success: true };
      
    } catch (error) {
      console.error('Error creating new plant:', error);
      return { success: false, message: "Error creating plant. Please try again." };
    }
  };

  return {
    gardenItems,
    gardenOrnaments,
    gardenStats,
    loading,
    loadGardenData,
    createNewPlant,
    getPlacedItemCount,
    canAffordPlant,
    inventory
  };
};

// Constants
export const PLANT_COSTS: Record<string, number> = {
  flower: 0,
  veggie: 5,
  fruit: 10,
  tree: 15,
  luck: 20
}; 