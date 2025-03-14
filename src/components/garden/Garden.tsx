import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useGardenData, PLANT_COSTS, GardenItem } from '../../hooks/useGardenData';
import GardenGrid from './GardenGrid';
import PlantUpgradePanel from './PlantUpgradePanel';
import GardenSharing from './GardenSharing';
import { getNextVariant, getPlantDetails } from '../../utils/plantUtils';
import { getOrnamentDetails, ORNAMENT_TYPES } from '../../utils/ornamentUtils';
import './garden-styles.css';

const GRID_SIZE = 5;
const PLANT_TYPES = ['flower', 'veggie', 'fruit', 'tree', 'luck'];

interface GardenProps {
  userId?: string; // Optional prop override
  isOpen?: boolean; // For modal support
  onClose?: () => void; // For modal support
}

export const Garden: React.FC<GardenProps> = ({
  userId: propUserId,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const userId = propUserId || user?.id;
  
  // Garden data from the custom hook
  const {
    gardenItems,
    gardenOrnaments,
    gardenStats,
    loading,
    loadGardenData,
    canAffordPlant
  } = useGardenData(userId || '');
  
  // Local state
  const [selectedPlantType, setSelectedPlantType] = useState('flower');
  const [selectedPlantVariant, setSelectedPlantVariant] = useState('basic');
  const [placingPlant, setPlacingPlant] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<GardenItem | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [placingOrnament, setPlacingOrnament] = useState(false);
  const [selectedOrnamentType, setSelectedOrnamentType] = useState('');
  const [availableOrnaments, setAvailableOrnaments] = useState<Record<string, number>>({});
  const [isPlantMenuOpen, setIsPlantMenuOpen] = useState(false);
  const [inventoryPlants, setInventoryPlants] = useState<Record<string, Record<string, number>>>({});

  // Function to check for and remove excess flowers - memoized with useCallback
  const checkAndRemoveExcessFlowers = useCallback(async () => {
    if (!userId || !gardenStats) return;
    
    // Count how many basic flower plants are placed (only regular/basic flowers count against the limit)
    const placedBasicFlowers = gardenItems.filter(item => 
      item.plant_type === 'flower' && item.plant_variant === 'basic'
    );
    
    // If there are more basic flowers placed than available, remove the excess
    if (placedBasicFlowers.length > gardenStats.flowers_available) {
      const excessCount = placedBasicFlowers.length - gardenStats.flowers_available;
      const flowersToRemove = placedBasicFlowers.slice(0, excessCount);
      
      try {
        for (const flower of flowersToRemove) {
          await supabase
            .from('garden_items')
            .delete()
            .eq('id', flower.id)
            .eq('user_id', userId);
        }
        
        // Reload data after removing excess flowers
        await loadGardenData();
        
        // Remove the alert message - users don't need to know about flowers being removed
      } catch (error) {
        console.error('Error removing excess flowers:', error);
      }
    }
  }, [userId, gardenStats, gardenItems, loadGardenData]);

  // Load garden data on initial render
  useEffect(() => {
    if (userId) {
      loadGardenData();
      loadAvailableOrnaments();
      loadPlantInventory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadGardenData]);
  
  // Set initial selected plant based on available inventory
  useEffect(() => {
    // Only run this if inventory plants are loaded and we haven't placed a plant yet
    if (Object.keys(inventoryPlants).length > 0 && !placingPlant) {
      // Find the first plant in inventory
      for (const type of PLANT_TYPES) {
        for (const variant of ['legendary', 'epic', 'rare', 'basic']) {
          if (inventoryPlants[type]?.[variant] > 0) {
            setSelectedPlantType(type);
            setSelectedPlantVariant(variant);
            return;
          }
        }
      }
    }
  }, [inventoryPlants, placingPlant]);
  
  // Check for excess flowers whenever flower balance changes
  useEffect(() => {
    if (userId && gardenStats) {
      checkAndRemoveExcessFlowers();
    }
  }, [userId, gardenStats, checkAndRemoveExcessFlowers]);

  // Function to load available ornaments from user data
  const loadAvailableOrnaments = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('user_ornament_inventory')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // Not found is OK for new users
        console.error('Error loading ornament inventory:', error);
        return;
      }
      
      // If user has no inventory record yet, create one with default values
      if (!data) {
        setAvailableOrnaments({});
        return;
      }
      
      // Extract ornament inventory data, excluding user_id and id fields
      const ornamentInventory: Record<string, number> = {};
      Object.keys(data).forEach(key => {
        if (key !== 'user_id' && key !== 'id' && ORNAMENT_TYPES.includes(key)) {
          ornamentInventory[key] = data[key] || 0;
        }
      });
      
      setAvailableOrnaments(ornamentInventory);
    } catch (error) {
      console.error('Error loading ornament inventory:', error);
    }
  };

  // Function to load plant inventory from user data
  const loadPlantInventory = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('user_plant_inventory')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // Not found is OK for new users
        console.error('Error loading plant inventory:', error);
        return;
      }
      
      // If user has no inventory record yet, create one with default values
      if (!data) {
        const defaultInventory: Record<string, Record<string, number>> = {};
        
        // Initialize inventory structure for all plant types
        PLANT_TYPES.forEach(type => {
          defaultInventory[type] = {
            basic: 0,
            rare: 0,
            epic: 0,
            legendary: 0
          };
        });
        
        setInventoryPlants(defaultInventory);
        
        // Create initial inventory record
        const { error: createError } = await supabase
          .from('user_plant_inventory')
          .insert([
            {
              user_id: userId,
              ...createFlatInventoryObject(defaultInventory)
            }
          ]);
          
        if (createError) {
          console.error('Error creating plant inventory:', createError);
        }
        
        return;
      }
      
      // Convert flat inventory data to structured format
      const structuredInventory: Record<string, Record<string, number>> = {};
      
      PLANT_TYPES.forEach(type => {
        structuredInventory[type] = {
          basic: data[`${type}_basic`] || 0,
          rare: data[`${type}_rare`] || 0,
          epic: data[`${type}_epic`] || 0,
          legendary: data[`${type}_legendary`] || 0
        };
      });
      
      setInventoryPlants(structuredInventory);
      
    } catch (error) {
      console.error('Error loading plant inventory:', error);
    }
  };
  
  // Helper function to convert structured inventory to flat object for DB storage
  const createFlatInventoryObject = (inventory: Record<string, Record<string, number>>) => {
    const flatObj: Record<string, number> = {};
    
    PLANT_TYPES.forEach(type => {
      ['basic', 'rare', 'epic', 'legendary'].forEach(variant => {
        flatObj[`${type}_${variant}`] = inventory[type][variant];
      });
    });
    
    return flatObj;
  };

  // Check if any plant type is available to place
  const hasAvailablePlants = (): boolean => {
    // Check if there's at least one plant type the user can afford
    if (!gardenStats) return false;
    
    // Check if the user has any plants in inventory
    const hasInventoryPlants = Object.keys(inventoryPlants).some(type => 
      Object.keys(inventoryPlants[type]).some(variant => 
        inventoryPlants[type][variant] > 0
      )
    );
    
    // If there are plants in inventory, they can be placed
    if (hasInventoryPlants) {
      return true;
    }
    
    // If the user has available Daisies, they can be placed
    if (gardenStats.flowers_available > 0) {
      return true;
    }
    
    // If all flowers are already placed, no more regular plants can be placed
    const placedDaisies = gardenItems.filter(item => 
      item.plant_type === 'flower' && item.plant_variant === 'basic'
    ).length;
    
    if (placedDaisies >= gardenStats.flowers_available) {
      return false;
    }
    
    // Check if any other plant type can be afforded
    return PLANT_TYPES.some(type => canAffordPlant(type));
  };

  // Handle plant selection from the grid
  const handlePlantClick = (plant: GardenItem) => {
    setSelectedPlant(plant);
    setPlacingPlant(false);
  };

  // Handle clicking on an empty grid cell
  const handleGridCellClick = async (x: number, y: number) => {
    if ((!placingPlant && !placingOrnament) || !userId) return;
    
    try {
      // Find an empty position or check if occupied by a plant
      const occupiedPositions = new Map();
      
      // Create a map for faster lookups
      gardenItems.forEach(item => {
        occupiedPositions.set(`${item.position_x},${item.position_y}`, item);
      });
      
      gardenOrnaments.forEach(ornament => {
        occupiedPositions.set(`${ornament.position_x},${ornament.position_y}`, ornament);
      });
      
      const posKey = `${x},${y}`;
      const existingItem = occupiedPositions.get(posKey);
      
      // If position is occupied
      if (existingItem) {
        if (placingPlant && 'plant_type' in existingItem) { // It's a plant
          const plantType = existingItem.plant_type;
          const plantVariant = existingItem.plant_variant;
          const plantEmoji = getPlantDetails(plantType, plantVariant)?.emoji || '🌱';
          
          // Ask for confirmation before replacing
          const confirmReplace = window.confirm(
            `This spot already has a ${plantVariant} ${plantType} ${plantEmoji}. Do you want to replace it with a ${selectedPlantType}?`
          );
          
          if (!confirmReplace) {
            return; // User canceled the replacement
          }
          
          // Delete the existing plant
          const { error: deleteError } = await supabase
            .from('garden_items')
            .delete()
            .eq('id', existingItem.id)
            .eq('user_id', userId);
            
          if (deleteError) throw deleteError;
          
          // Add the replaced plant to inventory
          const updatedInventory = { ...inventoryPlants };
          updatedInventory[plantType][plantVariant] = (updatedInventory[plantType][plantVariant] || 0) + 1;
          
          // Update inventory in database
          const { error: updateInvError } = await supabase
            .from('user_plant_inventory')
            .update(createFlatInventoryObject(updatedInventory))
            .eq('user_id', userId);
            
          if (updateInvError) throw updateInvError;
          
          // Update local state
          setInventoryPlants(updatedInventory);
          
          // If it was a flower, need to update stats
          if (plantType === 'flower') {
            const { error: updateFlowerError } = await supabase
              .from('user_garden_stats')
              .update({
                flowers_available: (gardenStats?.flowers_available || 0) + 1 // Add the flower back
              })
              .eq('user_id', userId);
              
            if (updateFlowerError) throw updateFlowerError;
          }
        } else {
          // It's an ornament or we're placing an ornament, don't allow replacement
          alert(placingOrnament ? 
            "This spot is already occupied. Choose an empty spot for your ornament." : 
            "You can't replace ornaments with plants.");
          return;
        }
      }
      
      // Insert the new item
      if (placingPlant) {
        // Check if we can place from inventory first
        const inventoryCount = inventoryPlants[selectedPlantType][selectedPlantVariant] || 0;
        let useFromInventory = false;
        
        if (inventoryCount > 0) {
          useFromInventory = true;
          
          // Update inventory - remove from inventory
          const updatedInventory = { ...inventoryPlants };
          updatedInventory[selectedPlantType][selectedPlantVariant] -= 1;
          
          // Update inventory in database
          const { error: updateInvError } = await supabase
            .from('user_plant_inventory')
            .update(createFlatInventoryObject(updatedInventory))
            .eq('user_id', userId);
            
          if (updateInvError) throw updateInvError;
          
          // Update local state
          setInventoryPlants(updatedInventory);
        }
        
        // Insert the new plant
        const { error } = await supabase
          .from('garden_items')
          .insert([
            {
              user_id: userId,
              plant_type: selectedPlantType,
              plant_variant: selectedPlantVariant,
              position_x: x,
              position_y: y
            }
          ]);
          
        if (error) throw error;
        
        // Calculate cost based on variant (only if not using from inventory)
        if (!useFromInventory && gardenStats) {
          let cost = 0;
          const inventory = calculateInventoryBreakdown();
          const hasVariant = inventory[selectedPlantType][selectedPlantVariant] > 0;
          
          // Case 1: Basic plants - standard cost
          if (selectedPlantVariant === 'basic') {
            cost = selectedPlantType === 'flower' ? 0 : PLANT_COSTS[selectedPlantType] || 0;
          } 
          // Case 2: Upgraded variants that need to be purchased
          else if (!hasVariant) {
            const upgradeVariantCosts = { rare: 5, epic: 10, legendary: 15 };
            cost = upgradeVariantCosts[selectedPlantVariant as keyof typeof upgradeVariantCosts] || 0;
          }
          
          // Update available flowers count if there's a cost
          if (cost > 0) {
            const { error: updateError } = await supabase
              .from('user_garden_stats')
              .update({
                flowers_available: (gardenStats.flowers_available || 0) - cost
              })
              .eq('user_id', userId);
              
            if (updateError) throw updateError;
            
            // Show success message for direct upgrade placement
            if (selectedPlantVariant !== 'basic') {
              const details = getPlantDetails(selectedPlantType, selectedPlantVariant);
              alert(`Upgrade successful! A beautiful ${details?.name || selectedPlantVariant + ' ' + selectedPlantType} has been added to your garden! 🎉`);
            }
          }
        }
      } else if (placingOrnament) {
        // Insert the new ornament
        const { error } = await supabase
          .from('garden_ornaments')
          .insert([
            {
              user_id: userId,
              ornament_type: selectedOrnamentType,
              position_x: x,
              position_y: y
            }
          ]);
          
        if (error) throw error;
        
        // Update available ornaments count in inventory
        if (availableOrnaments[selectedOrnamentType] > 0) {
          // Create a copy of available ornaments and decrease count
          const updatedInventory = { ...availableOrnaments };
          updatedInventory[selectedOrnamentType]--;
          
          // Update in database
          const { error: updateError } = await supabase
            .from('user_ornament_inventory')
            .update({
              [selectedOrnamentType]: updatedInventory[selectedOrnamentType]
            })
            .eq('user_id', userId);
            
          if (updateError) throw updateError;
          
          // Update local state
          setAvailableOrnaments(updatedInventory);
        }
      }
      
      // Reset state and reload data
      setPlacingPlant(false);
      setPlacingOrnament(false);
      await loadGardenData();
      
    } catch (error) {
      console.error('Error placing item:', error);
    }
  };

  // Handle plant type selection
  const handlePlantTypeSelect = (type: string, variant: string = 'basic') => {
    setSelectedPlantType(type);
    setSelectedPlantVariant(variant);
  };

  // Helper function to determine if the currently selected plant can be placed
  const canPlaceSelectedPlant = (): boolean => {
    if (!gardenStats) return false;
    
    // Check if the selected plant is a Daisy
    const isDaisy = selectedPlantType === 'flower' && selectedPlantVariant === 'basic';
    
    // Count how many of this plant type and variant are already placed in the garden
    const placedCount = gardenItems.filter(
      item => item.plant_type === selectedPlantType && item.plant_variant === selectedPlantVariant
    ).length;
    
    // Count how many of this plant type and variant are in inventory
    const inventoryCount = inventoryPlants[selectedPlantType]?.[selectedPlantVariant] || 0;
    
    // For basic Daisies, check both inventory and available flower currency together
    if (isDaisy) {
      // Total available = inventory + flower currency
      const totalAvailable = inventoryCount + gardenStats.flowers_available;
      
      // Can only place if we haven't placed all available Daisies
      return placedCount < totalAvailable;
    }
    
    // For all other plants, check if we have more in inventory than already placed
    if (inventoryCount > 0) {
      return placedCount < inventoryCount;
    }
    
    // If none in inventory, check if we can purchase a new one (for basic variants)
    if (selectedPlantVariant === 'basic') {
      return canAffordPlant(selectedPlantType);
    }
    
    // For upgraded plants, check if we can afford the upgrade and have prerequisites
    const upgradeVariantCosts = { rare: 5, epic: 10, legendary: 15 };
    const upgradeCost = upgradeVariantCosts[selectedPlantVariant as keyof typeof upgradeVariantCosts] || 0;
    
    // Check flowers cost
    if (gardenStats.flowers_available < upgradeCost) {
      return false;
    }
    
    // Check prerequisites for non-flower plants
    if (selectedPlantType !== 'flower') {
      const inventory = calculateInventoryBreakdown();
      const hasPrerequisite = selectedPlantVariant === 'rare' 
        ? inventory[selectedPlantType].basic > 0
        : selectedPlantVariant === 'epic'
          ? inventory[selectedPlantType].rare > 0
          : inventory[selectedPlantType].epic > 0;
          
      return hasPrerequisite;
    }
    
    return true;
  };

  // Handle starting to place a plant
  const handleStartPlacing = () => {
    // Check if the user can afford this plant (either basic or upgraded)
    if (!gardenStats) return;
    
    // Check if the selected plant is a Daisy
    const isDaisy = selectedPlantType === 'flower' && selectedPlantVariant === 'basic';
    
    // Case 1: Check if it's in inventory first
    const inventoryCount = inventoryPlants[selectedPlantType]?.[selectedPlantVariant] || 0;
    if (inventoryCount > 0) {
      // Use from inventory
      setPlacingPlant(true);
      setPlacingOrnament(false);
      setSelectedPlant(null);
      return;
    }
    
    // Don't proceed if we can't place the selected plant
    if (!canPlaceSelectedPlant()) {
      if (isDaisy) {
        alert("You don't have any Daisies available to place.");
      } else {
        alert(`You can't place this plant. Check your inventory or Daisy balance.`);
      }
      return;
    }
    
    // Case 2: Basic variant of non-flower plants - check standard cost
    if (selectedPlantVariant === 'basic') {
      // For basic flowers (Daisies), check if we can place from available Daisies
      if (isDaisy) {
        if (gardenStats.flowers_available <= 0) {
          alert("You don't have any Daisies available to place.");
          return;
        }
      } else if (!canAffordPlant(selectedPlantType)) {
        // For other plant types, check standard cost
        const cost = PLANT_COSTS[selectedPlantType];
        alert(`Not enough Daisies! You need ${cost} Daisies to place a ${selectedPlantType}.`);
        return;
      }
    }
    
    // Case 3: Upgraded variant that user doesn't own - check upgrade cost and prerequisites
    const upgradeVariantCosts = { rare: 5, epic: 10, legendary: 15 };
    const inventory = calculateInventoryBreakdown();
    
    if (selectedPlantVariant !== 'basic' && inventory[selectedPlantType][selectedPlantVariant] === 0) {
      const upgradeCost = upgradeVariantCosts[selectedPlantVariant as keyof typeof upgradeVariantCosts] || 0;
      
      // Check flower cost
      if (gardenStats.flowers_available < upgradeCost) {
        alert(`Not enough Daisies! You need ${upgradeCost} Daisies to place a ${getPlantDetails(selectedPlantType, selectedPlantVariant)?.name || selectedPlantVariant + ' ' + selectedPlantType}.`);
        return;
      }
      
      // Check prerequisites for non-flower plants
      if (selectedPlantType !== 'flower') {
        const hasPrerequisite = selectedPlantVariant === 'rare' 
          ? inventory[selectedPlantType].basic > 0
          : selectedPlantVariant === 'epic'
            ? inventory[selectedPlantType].rare > 0
            : inventory[selectedPlantType].epic > 0;
            
        if (!hasPrerequisite) {
          const prerequisiteVariant = selectedPlantVariant === 'rare' ? 'basic' : selectedPlantVariant === 'epic' ? 'rare' : 'epic';
          const prerequisiteName = getPlantDetails(selectedPlantType, prerequisiteVariant)?.name || 
            `${prerequisiteVariant.charAt(0).toUpperCase() + prerequisiteVariant.slice(1)} ${selectedPlantType}`;
          
          alert(`You need to own a ${prerequisiteName} before you can place a ${getPlantDetails(selectedPlantType, selectedPlantVariant)?.name || selectedPlantVariant + ' ' + selectedPlantType}.`);
          return;
        }
      }
    }
    
    setPlacingPlant(true);
    setPlacingOrnament(false);
    setSelectedPlant(null);
  };
  
  // Handle starting to place an ornament
  const handleStartPlacingOrnament = (ornamentType: string) => {
    if (!availableOrnaments[ornamentType] || availableOrnaments[ornamentType] <= 0) {
      alert(`You don't have any ${getOrnamentDetails(ornamentType)?.name || ornamentType} ornaments available.`);
      return;
    }
    
    setSelectedOrnamentType(ornamentType);
    setPlacingOrnament(true);
    setPlacingPlant(false);
    setSelectedPlant(null);
  };

  // Handle upgrading a plant
  const handleUpgradePlant = async (plantId: string) => {
    if (!userId || !selectedPlant) return;
    
    try {
      const nextVariant = getNextVariant(selectedPlant.plant_variant);
      if (!nextVariant) return;
      
      const upgradeCost = selectedPlant.plant_variant === 'basic' ? 5 
        : selectedPlant.plant_variant === 'rare' ? 10 
        : 15; // epic -> legendary
      
      // Update plant variant
      const { error } = await supabase
        .from('garden_items')
        .update({ plant_variant: nextVariant })
        .eq('id', plantId)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Update available flowers count
      if (gardenStats) {
        const { error: updateError } = await supabase
          .from('user_garden_stats')
          .update({
            flowers_available: (gardenStats.flowers_available || 0) - upgradeCost
          })
          .eq('user_id', userId);
          
        if (updateError) throw updateError;
      }
      
      // Show success message
      const plantDetails = getPlantDetails(selectedPlant.plant_type, selectedPlant.plant_variant);
      const nextPlantDetails = getPlantDetails(selectedPlant.plant_type, nextVariant);
      alert(`Upgrade successful! Your ${plantDetails?.name || 'plant'} has evolved into a beautiful ${nextPlantDetails?.name || 'upgraded plant'}! 🎉`);
      
      // Reset selected plant and reload data
      setSelectedPlant(null);
      await loadGardenData();
      
    } catch (error) {
      console.error('Error upgrading plant:', error);
      alert('Sorry, there was a problem upgrading your plant. Please try again.');
    }
  };

  // Handle returning a plant to inventory
  const handleReturnPlantToInventory = async (plantId: string) => {
    if (!userId || !selectedPlant) return;
    
    try {
      const plantType = selectedPlant.plant_type;
      const plantVariant = selectedPlant.plant_variant;
      
      // Delete the plant from garden
      const { error } = await supabase
        .from('garden_items')
        .delete()
        .eq('id', plantId)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Update inventory count - add to inventory
      const updatedInventory = { ...inventoryPlants };
      updatedInventory[plantType][plantVariant] = (updatedInventory[plantType][plantVariant] || 0) + 1;
      
      // Update inventory in database
      const { error: updateError } = await supabase
        .from('user_plant_inventory')
        .update(createFlatInventoryObject(updatedInventory))
        .eq('user_id', userId);
        
      if (updateError) throw updateError;
      
      // Update local state
      setInventoryPlants(updatedInventory);
      
      // Reset selected plant and reload data
      setSelectedPlant(null);
      await loadGardenData();
      
      // Show confirmation
      const details = getPlantDetails(plantType, plantVariant);
      alert(`${details?.name || plantType} returned to your inventory.`);
      
    } catch (error) {
      console.error('Error returning plant to inventory:', error);
      alert('Sorry, there was a problem returning the plant to your inventory.');
    }
  };
  
  // Handle selling a plant for flowers
  const handleSellPlant = async (plantId: string, plantType: string, plantVariant: string) => {
    if (!userId || !gardenStats) return;
    
    try {
      // Calculate the sell value based on plant type and variant
      let sellValue = plantType === 'flower' ? 1 : PLANT_COSTS[plantType] || 0;
      
      // Add value for upgrades
      if (plantVariant === 'rare') {
        sellValue += 5; // Cost to upgrade from basic to rare
      } else if (plantVariant === 'epic') {
        sellValue += 15; // Cost to upgrade from basic to rare (5) and rare to epic (10)
      } else if (plantVariant === 'legendary') {
        sellValue += 30; // Cost to upgrade from basic to legendary (5 + 10 + 15)
      }
      
      // Delete the plant
      const { error } = await supabase
        .from('garden_items')
        .delete()
        .eq('id', plantId)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Update available flowers count
      const { error: updateError } = await supabase
        .from('user_garden_stats')
        .update({
          flowers_available: (gardenStats.flowers_available || 0) + sellValue
        })
        .eq('user_id', userId);
        
      if (updateError) throw updateError;
      
      // Reset selected plant and reload data
      setSelectedPlant(null);
      await loadGardenData();
      
    } catch (error) {
      console.error('Error selling plant:', error);
    }
  };

  // Handle cancel placing
  const handleCancelPlacing = () => {
    setPlacingPlant(false);
    setPlacingOrnament(false);
  };

  // Handle closing the plant upgrade panel
  const handleClosePanel = () => {
    setSelectedPlant(null);
  };

  // Calculate inventory breakdown by plant type and variant
  const calculateInventoryBreakdown = (): Record<string, Record<string, number>> => {
    const breakdown: Record<string, Record<string, number>> = {};
    
    // Initialize breakdown structure for all plant types
    PLANT_TYPES.forEach(type => {
      breakdown[type] = {
        basic: 0,
        rare: 0,
        epic: 0,
        legendary: 0
      };
    });
    
    // Count each plant by type and variant
    gardenItems.forEach(item => {
      if (breakdown[item.plant_type]) {
        breakdown[item.plant_type][item.plant_variant] = 
          (breakdown[item.plant_type][item.plant_variant] || 0) + 1;
      }
    });
    
    return breakdown;
  };

  // Render plant selector using a dropdown menu
  const renderPlantTypeSelector = () => {
    const breakdown = calculateInventoryBreakdown();
    
    // Check if user can afford an upgrade
    const canAffordUpgrade = (variant: string): boolean => {
      if (!gardenStats) return false;
      
      const upgradeCost = variant === 'rare' ? 5 : variant === 'epic' ? 10 : variant === 'legendary' ? 15 : 0;
      return gardenStats.flowers_available >= upgradeCost;
    };
    
    // Check if the previous variant is owned or is basic
    const hasPrerequisiteVariant = (variant: string, type: string): boolean => {
      // Special handling for flowers - they're essentially our currency
      if (type === 'flower') {
        // For flowers, we only need to check if user has enough flowers available (currency)
        // No need to own any plant as prerequisite
        return true;
      }
      
      // For non-flower plants:
      if (variant === 'rare') {
        // For rare variants of non-flowers, we need to check if the user actually owns a basic version
        return breakdown[type].basic > 0;
      }
      
      // For epic and legendary, check if the user owns the previous tier variant
      const previousVariant = variant === 'epic' ? 'rare' : variant === 'legendary' ? 'epic' : '';
      return breakdown[type][previousVariant] > 0;
    };
    
    // Get the currently selected plant details
    const selectedDetails = getPlantDetails(selectedPlantType, selectedPlantVariant);
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-700">Select Plant</h3>
          
          {/* Add Daisy counter - simplified to just show number and emoji */}
          {gardenStats && (
            <div className="text-sm bg-amber-50 px-3 py-1 rounded-full flex items-center">
              <span className="text-amber-700 font-medium">🌼 {gardenStats.flowers_available}</span>
            </div>
          )}
        </div>
        
        {/* Dropdown button */}
        <div className="relative">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={() => setIsPlantMenuOpen(!isPlantMenuOpen)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-2">{selectedDetails?.emoji || '🌱'}</span>
              <div className="flex flex-col items-start">
                <span className="font-medium">{selectedDetails?.name || 'Select a plant'}</span>
                <span className="text-xs text-gray-500">{selectedPlantType.charAt(0).toUpperCase() + selectedPlantType.slice(1)} · {selectedPlantVariant.charAt(0).toUpperCase() + selectedPlantVariant.slice(1)}</span>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isPlantMenuOpen ? 'transform rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Dropdown menu */}
          {isPlantMenuOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-96 overflow-y-auto">
              {PLANT_TYPES.map(type => {
                // Show all plant types, even if not currently available
                const canAfford = canAffordPlant(type);
                const isPremiumType = type !== 'flower';
                
                return (
                  <div key={type} className="border-b border-gray-100 last:border-0">
                    <div className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50">
                      {type.charAt(0).toUpperCase() + type.slice(1)}s
                    </div>
                    
                    <div className="py-1">
                      {/* Basic variant - show even if not affordable */}
                      <button
                        className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-gray-50 ${
                          selectedPlantType === type && selectedPlantVariant === 'basic' ? 'bg-green-50' : ''
                        } ${
                          // Disable if:
                          // 1. It's a non-flower and not affordable, OR
                          // 2. It's a Daisy (basic flower) and no flowers available AND none in inventory
                          (isPremiumType && !canAfford) || 
                          (type === 'flower' && (!gardenStats || gardenStats.flowers_available <= 0) && (!inventoryPlants.flower || inventoryPlants.flower.basic <= 0))
                            ? 'opacity-50 cursor-not-allowed' 
                            : ''
                        }`}
                        onClick={() => {
                          // Enable click if:
                          // 1. It's affordable (for non-flowers), OR
                          // 2. It's a Daisy and either has flowers available OR has Daisies in inventory
                          if ((isPremiumType && canAfford) || 
                              (type === 'flower' && (gardenStats && gardenStats.flowers_available > 0 || inventoryPlants.flower && inventoryPlants.flower.basic > 0))) {
                            handlePlantTypeSelect(type, 'basic');
                            setIsPlantMenuOpen(false);
                          }
                        }}
                        disabled={(isPremiumType && !canAfford) || 
                                 (type === 'flower' && (!gardenStats || gardenStats.flowers_available <= 0) && (!inventoryPlants.flower || inventoryPlants.flower.basic <= 0))}
                        title={
                          isPremiumType && !canAfford 
                            ? `Need ${PLANT_COSTS[type]} Daisies` 
                            : type === 'flower' && (!gardenStats || gardenStats.flowers_available <= 0) && (!inventoryPlants.flower || inventoryPlants.flower.basic <= 0)
                                ? "No Daisies available" 
                                : undefined
                        }
                      >
                        <div className="flex items-center">
                          <span className="text-xl mr-2">{getPlantDetails(type, 'basic')?.emoji || '❓'}</span>
                          <div className="flex flex-col">
                            <span>{getPlantDetails(type, 'basic')?.name || 'Basic'}</span>
                            <span className="text-xs text-gray-500">Basic</span>
                            {!canAfford && isPremiumType && (
                              <span className="text-xs text-red-500">Need {PLANT_COSTS[type]} Daisies</span>
                            )}
                            {type === 'flower' && (!gardenStats || gardenStats.flowers_available <= 0) && (!inventoryPlants.flower || inventoryPlants.flower.basic <= 0) && (
                              <span className="text-xs text-red-500">No Daisies available</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          {type !== 'flower' && (
                            <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
                              {PLANT_COSTS[type]} 🌼
                            </span>
                          )}
                          {breakdown[type].basic > 0 && (
                            <span className="ml-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                              {breakdown[type].basic} Placed
                            </span>
                          )}
                          {/* Show inventory count */}
                          {inventoryPlants[type]?.basic > 0 && (
                            <span className="ml-2 text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
                              {inventoryPlants[type].basic} in Inventory
                            </span>
                          )}
                        </div>
                      </button>
                      
                      {/* Upgraded variants */}
                      {['rare', 'epic', 'legendary'].map(variant => {
                        const count = breakdown[type][variant] || 0;
                        const inventoryCount = inventoryPlants[type]?.[variant] || 0;
                        const details = getPlantDetails(type, variant);
                        const canUpgrade = hasPrerequisiteVariant(variant, type) && canAffordUpgrade(variant);
                        
                        // Instead of skipping completely, show the option but make it clear why it's disabled
                        const hasFlowers = gardenStats && 
                          gardenStats.flowers_available >= (variant === 'rare' ? 5 : variant === 'epic' ? 10 : 15);
                        const hasPrerequisite = hasPrerequisiteVariant(variant, type);
                        
                        // For flowers, we only care about having enough flowers
                        const canPurchase = type === 'flower' ? hasFlowers : canUpgrade;
                        
                        // Display disabled reason
                        let disabledReason = '';
                        if (type === 'flower') {
                          // For flowers, only check if they have enough flowers
                          if (!hasFlowers) {
                            const upgradeCost = variant === 'rare' ? 5 : variant === 'epic' ? 10 : 15;
                            disabledReason = `Need ${upgradeCost} Daisies`;
                          }
                        } else {
                          // For non-flowers, check both prerequisites and flowers
                          if (!hasPrerequisite) {
                            // Get the name of the prerequisite
                            const prerequisiteVariant = variant === 'rare' ? 'basic' : variant === 'epic' ? 'rare' : 'epic';
                            const prerequisiteName = getPlantDetails(type, prerequisiteVariant)?.name || 
                              `${prerequisiteVariant.charAt(0).toUpperCase() + prerequisiteVariant.slice(1)} ${type}`;
                            disabledReason = `Requires ${prerequisiteName}`;
                          } else if (!hasFlowers) {
                            const upgradeCost = variant === 'rare' ? 5 : variant === 'epic' ? 10 : 15;
                            disabledReason = `Need ${upgradeCost} Daisies`;
                          }
                        }
                        
                        const upgradeCost = variant === 'rare' ? 5 : variant === 'epic' ? 10 : 15;
                        const variantName = variant.charAt(0).toUpperCase() + variant.slice(1);
                        
                        return (
                          <button
                            key={variant}
                            className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-gray-50 ${
                              selectedPlantType === type && selectedPlantVariant === variant ? 'bg-green-50' : ''
                            } ${count === 0 && inventoryCount === 0 && !canPurchase ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (count > 0 || inventoryCount > 0 || canPurchase) {
                                handlePlantTypeSelect(type, variant);
                                setIsPlantMenuOpen(false);
                              }
                            }}
                            disabled={count === 0 && inventoryCount === 0 && !canPurchase}
                            title={disabledReason ? disabledReason : undefined}
                          >
                            <div className="flex items-center">
                              <span className="text-xl mr-2">{details?.emoji || '❓'}</span>
                              <div className="flex flex-col">
                                <span>{details?.name || `${variantName} ${type}`}</span>
                                <span className="text-xs text-gray-500">{variantName}</span>
                                {disabledReason && count === 0 && inventoryCount === 0 && !canPurchase && (
                                  <span className="text-xs text-red-500">{disabledReason}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center flex-wrap justify-end">
                              {count === 0 && inventoryCount === 0 && canPurchase && (
                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
                                  {upgradeCost} 🌼
                                </span>
                              )}
                              {count > 0 && (
                                <span className="ml-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                                  {count} Placed
                                </span>
                              )}
                              {/* Show inventory count */}
                              {inventoryCount > 0 && (
                                <span className="ml-2 text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
                                  {inventoryCount} in Inventory
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Click away handler for dropdown */}
        {isPlantMenuOpen && (
          <div 
            className="fixed inset-0 z-0" 
            onClick={() => setIsPlantMenuOpen(false)}
          />
        )}
      </div>
    );
  };

  // Render ornament selector
  const renderOrnamentSelector = () => {
    // Filter to only show ornament types the user has available
    const userOrnamentTypes = Object.keys(availableOrnaments).filter(
      type => availableOrnaments[type] > 0
    );
    
    if (userOrnamentTypes.length === 0) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-700 mb-3">Ornaments</h3>
          <p className="text-sm text-gray-500 text-center bg-amber-50 p-3 rounded-md">
            You don't have any ornaments available yet. 
            Complete the Touch Grass Challenge to earn special ornaments!
          </p>
        </div>
      );
    }
    
    return (
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Place Ornaments</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {userOrnamentTypes.map(type => {
            const details = getOrnamentDetails(type);
            const count = availableOrnaments[type] || 0;
            
            return (
              <button
                key={type}
                className={`px-3 py-2 rounded-md border transition-colors ${
                  selectedOrnamentType === type && placingOrnament
                    ? 'bg-amber-100 border-amber-400 text-amber-800' 
                    : count > 0
                      ? 'bg-white border-amber-200 hover:bg-amber-50 text-gray-700'
                      : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                onClick={() => handleStartPlacingOrnament(type)}
                disabled={count <= 0}
              >
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-1">{details?.emoji || '❓'}</span> 
                  <span className="text-sm">{details?.name || type}</span>
                  <span className="text-xs text-gray-600 mt-1">
                    Available: {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render sharing controls
  const renderSharingControls = () => {
    return (
      <div className="mt-6">
        <GardenSharing
          gardenItems={gardenItems}
          gardenOrnaments={gardenOrnaments}
          gardenStats={gardenStats}
          gridSize={GRID_SIZE}
          isSharing={!!isSharing}
          setIsSharing={setIsSharing}
          inventoryPlants={inventoryPlants}
        />
      </div>
    );
  };

  // Helper function to determine if we should show the "no plants available" message
  const showNoPlantMessage = () => {
    if (canPlaceNewPlant) return null;
    
    // Check if there are any plants in inventory
    const hasInventoryPlants = Object.keys(inventoryPlants).some(type => 
      Object.keys(inventoryPlants[type]).some(variant => 
        inventoryPlants[type][variant] > 0
      )
    );
    
    if (hasInventoryPlants) return null;
    
    return (
      <p className="text-sm text-amber-600 mb-4 text-center">
        No plants available to place. Sell or remove a plant first, or complete a Touch Grass session to earn more Daisies.
      </p>
    );
  };

  // Helper function to show a message when all available plants are already placed
  const showAlreadyPlacedMessage = () => {
    // Check if the selected plant is a Daisy
    const isDaisy = selectedPlantType === 'flower' && selectedPlantVariant === 'basic';
    
    // Count how many of this plant type and variant are already placed in the garden
    const placedCount = gardenItems.filter(
      item => item.plant_type === selectedPlantType && item.plant_variant === selectedPlantVariant
    ).length;
    
    // Count how many of this plant type and variant are in inventory
    const inventoryCount = inventoryPlants[selectedPlantType]?.[selectedPlantVariant] || 0;
    
    // Skip if no plants are placed
    if (placedCount === 0) {
      return null;
    }
    
    // For Daisies, check both inventory and available flower currency
    if (isDaisy) {
      // Total available = inventory + flower currency
      const totalAvailable = inventoryCount + (gardenStats?.flowers_available || 0);
      
      // Only show message if all available Daisies have been placed
      if (placedCount < totalAvailable) {
        return null;
      }
    } 
    // For other plants, check if all inventory is placed
    else if (inventoryCount > 0 && placedCount < inventoryCount) {
      return null; // Still have plants in inventory
    }
    
    // If we can buy a new basic plant (non-Daisy), no message needed
    if (selectedPlantVariant === 'basic' && !isDaisy && canAffordPlant(selectedPlantType)) {
      return null;
    }
    
    // If we've reached this point, show the message as all available plants of this type are placed
    const plantDetails = getPlantDetails(selectedPlantType, selectedPlantVariant);
    
    return (
      <p className="text-sm text-blue-600 mb-4 text-center">
        You've placed all your {properPlural(plantDetails?.name || `${selectedPlantVariant} ${selectedPlantType}`)}. 
        Select one and click "Return to Inventory" first to move it.
      </p>
    );
  };

  // Helper function to properly pluralize plant names
  const properPlural = (name: string): string => {
    if (!name) return '';
    
    // Handle words ending in 'y' (e.g., Daisy → Daisies)
    if (name.endsWith('y')) {
      return name.slice(0, -1) + 'ies';
    }
    
    // Handle words ending in 's', 'x', 'z', 'ch', 'sh' (e.g., Peach → Peaches)
    if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z') || 
        name.endsWith('ch') || name.endsWith('sh')) {
      return name + 'es';
    }
    
    // Default case: just add 's'
    return name + 's';
  };

  // For modal support
  if (isOpen === false) {
    return null;
  }

  if (!userId) {
    return <div className="p-6 text-center text-gray-500">Please log in to view your garden.</div>;
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading your garden...</div>;
  }

  // Check if any plant type is available for placing
  const canPlaceNewPlant = hasAvailablePlants();

  // Render the main content with the garden UI
  const content = (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      {onClose && (
        <div className="flex justify-end mb-2">
          <button 
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
            aria-label="Close garden"
          >
            ✕
          </button>
        </div>
      )}
    
      <div className="mb-6">
        <h2 className="text-xl font-bold text-green-700 mb-4">Your Garden</h2>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-8">
        <div className="md:col-span-3 order-2 md:order-1">
          <div className="mb-4">
            <GardenGrid
              gardenItems={gardenItems}
              gardenOrnaments={gardenOrnaments}
              gridSize={GRID_SIZE}
              placingPlant={placingPlant || placingOrnament}
              selectedPlantDetails={placingPlant ? { type: selectedPlantType, variant: selectedPlantVariant } : undefined}
              onPlantClick={handlePlantClick}
              onGridCellClick={handleGridCellClick}
            />
          </div>
          
          {(placingPlant || placingOrnament) && (
            <div className="bg-green-50 p-4 rounded-md text-center">
              <p className="text-green-700 mb-3">
                {placingPlant 
                  ? "Click on an empty cell to place your plant" 
                  : `Click on an empty cell to place your ${getOrnamentDetails(selectedOrnamentType)?.name || 'ornament'}`
                }
              </p>
              <button 
                className="py-2 px-4 bg-white border border-green-300 hover:bg-green-50 text-green-700 rounded-md transition-colors"
                onClick={handleCancelPlacing}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        <div className="md:col-span-2 order-1 md:order-2 mb-6 md:mb-0">
          {!placingPlant && !placingOrnament && !selectedPlant && (
            <>
              {renderPlantTypeSelector()}
              <button
                className={`w-full py-2 px-4 text-white rounded-md font-medium transition-colors mb-4 ${
                  (canPlaceSelectedPlant()) && !isSharing
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                onClick={handleStartPlacing}
                disabled={!canPlaceSelectedPlant() || isSharing}
              >
                Add to Garden
              </button>
              
              {/* Show message when no plants are available */}
              {showNoPlantMessage()}
              
              {/* Show message when selected plant is already placed */}
              {showAlreadyPlacedMessage()}
              
              {renderOrnamentSelector()}
              
              {renderSharingControls()}
            </>
          )}
          
          {selectedPlant && (
            <PlantUpgradePanel
              selectedPlant={selectedPlant}
              gardenStats={gardenStats}
              onUpgradePlant={handleUpgradePlant}
              onDeletePlant={handleReturnPlantToInventory}
              onSellPlant={handleSellPlant}
              onClosePanel={handleClosePanel}
            />
          )}
        </div>
      </div>
    </div>
  );

  // If onClose is provided, it's a modal
  if (onClose) {
    return (
      <div className="garden-modal-overlay">
        <div className="garden-modal-content">
          {content}
        </div>
      </div>
    );
  }

  // Otherwise, render normally
  return (
    <div className="garden-container">
      {content}
    </div>
  );
};

export default Garden; 