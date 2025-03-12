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
    getPlacedItemCount,
    canAffordPlant
  } = useGardenData(userId || '');
  
  // Local state
  const [selectedPlantType, setSelectedPlantType] = useState('flower');
  const [placingPlant, setPlacingPlant] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<GardenItem | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [placingOrnament, setPlacingOrnament] = useState(false);
  const [selectedOrnamentType, setSelectedOrnamentType] = useState('');
  const [availableOrnaments, setAvailableOrnaments] = useState<Record<string, number>>({});

  // Function to check for and remove excess flowers - memoized with useCallback
  const checkAndRemoveExcessFlowers = useCallback(async () => {
    if (!userId || !gardenStats) return;
    
    // Count how many flower plants are placed
    const placedFlowers = gardenItems.filter(item => item.plant_type === 'flower');
    
    // If there are more flowers placed than available, remove the excess
    if (placedFlowers.length > gardenStats.flowers_available) {
      const excessCount = placedFlowers.length - gardenStats.flowers_available;
      const flowersToRemove = placedFlowers.slice(0, excessCount);
      
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
        
        if (excessCount > 0) {
          alert(`${excessCount} flower${excessCount > 1 ? 's' : ''} removed from your garden because you don't have enough flowers available.`);
        }
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
    }
  }, [userId, loadGardenData]);
  
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

  // Check if any plant type is available to place
  const hasAvailablePlants = (): boolean => {
    // Check if there's at least one plant type the user can afford
    if (!gardenStats) return false;
    
    // If all flowers are already placed, no more plants can be placed
    const placedFlowers = gardenItems.filter(item => item.plant_type === 'flower').length;
    if (placedFlowers >= gardenStats.flowers_available) {
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
        // Insert the new plant
        const { error } = await supabase
          .from('garden_items')
          .insert([
            {
              user_id: userId,
              plant_type: selectedPlantType,
              plant_variant: 'basic', // New plants are always basic
              position_x: x,
              position_y: y
            }
          ]);
          
        if (error) throw error;
        
        // Update available flowers count
        if (gardenStats) {
          const cost = selectedPlantType === 'flower' ? 0 : PLANT_COSTS[selectedPlantType] || 0;
          
          const { error: updateError } = await supabase
            .from('user_garden_stats')
            .update({
              flowers_available: (gardenStats.flowers_available || 0) - cost
            })
            .eq('user_id', userId);
            
          if (updateError) throw updateError;
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
  const handlePlantTypeSelect = (type: string) => {
    setSelectedPlantType(type);
  };

  // Handle starting to place a plant
  const handleStartPlacing = () => {
    // Check if the user can afford this plant type
    if (!canAffordPlant(selectedPlantType)) {
      const cost = PLANT_COSTS[selectedPlantType];
      alert(`Not enough flowers! You need ${cost} flowers to place a ${selectedPlantType}.`);
      return;
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
      
      // Reset selected plant and reload data
      setSelectedPlant(null);
      await loadGardenData();
      
    } catch (error) {
      console.error('Error upgrading plant:', error);
    }
  };

  // Handle returning a plant to inventory
  const handleReturnPlantToInventory = async (plantId: string) => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('garden_items')
        .delete()
        .eq('id', plantId)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Reset selected plant and reload data
      setSelectedPlant(null);
      await loadGardenData();
      
    } catch (error) {
      console.error('Error returning plant to inventory:', error);
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

  // Render plant type selector
  const renderPlantTypeSelector = () => {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Select Plant Type</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLANT_TYPES.map(type => {
            const cost = type === 'flower' ? 0 : PLANT_COSTS[type] || 0;
            const isDisabled = !canAffordPlant(type);
            const placedCount = getPlacedItemCount(type);
            
            return (
              <button
                key={type}
                className={`px-3 py-2 rounded-md border transition-colors ${
                  selectedPlantType === type 
                    ? 'bg-green-100 border-green-400 text-green-800' 
                    : isDisabled
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:bg-green-50 text-gray-700'
                }`}
                onClick={() => handlePlantTypeSelect(type)}
                disabled={isDisabled}
              >
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-1">{getPlantDetails(type, 'basic')?.emoji || '❓'}</span> 
                  <span className="text-sm">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  <span className="text-xs text-gray-600 mt-1">
                    Placed: {placedCount}
                  </span>
                  {cost > 0 && <span className="text-xs text-amber-600 mt-1">{cost} 🌼</span>}
                </div>
              </button>
            );
          })}
        </div>
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

  // Wrap content in a modal if onClose is provided
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
        <div className="flex flex-col sm:flex-row justify-around items-center bg-green-50 p-3 rounded-lg">
          <div className="flex flex-col items-center mb-3 sm:mb-0">
            <span className="text-2xl">🌼</span>
            <span className="text-sm font-medium mt-1">{gardenStats?.flowers_available || 0}</span>
            <span className="text-xs text-gray-500">Flowers</span>
          </div>
          
          <div className="flex flex-col justify-center mb-3 sm:mb-0">
            <div className="text-xs font-medium text-gray-600 mb-1 text-center">In Your Garden</div>
            <div className="flex gap-3 justify-center flex-wrap">
              {PLANT_TYPES.map(type => {
                const emoji = getPlantDetails(type, 'basic')?.emoji || '❓';
                const count = getPlacedItemCount(type);
                const typeName = type.charAt(0).toUpperCase() + type.slice(1);
                
                return (
                  <div key={type} className="flex items-center">
                    <span className="text-lg mr-1">{emoji}</span>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">{typeName}</span>
                      <span className="text-xs font-medium">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-2xl">🪨</span>
            <span className="text-sm font-medium mt-1">{gardenOrnaments.length}</span>
            <span className="text-xs text-gray-500">Ornaments</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-8">
        <div className="md:col-span-3 order-2 md:order-1">
          <div className="mb-4">
            <GardenGrid
              gardenItems={gardenItems}
              gardenOrnaments={gardenOrnaments}
              gridSize={GRID_SIZE}
              placingPlant={placingPlant || placingOrnament}
              selectedPlantDetails={placingPlant ? { type: selectedPlantType, variant: 'basic' } : undefined}
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
                  canPlaceNewPlant && !isSharing
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                onClick={handleStartPlacing}
                disabled={isSharing || !canPlaceNewPlant}
              >
                Edit Garden
              </button>
              {!canPlaceNewPlant && (
                <p className="text-sm text-amber-600 mb-4 text-center">
                  No plants available to place. Sell or remove a plant first.
                </p>
              )}
              
              {renderOrnamentSelector()}
              
              <div className="mt-6">
                <GardenSharing
                  gardenItems={gardenItems}
                  gardenOrnaments={gardenOrnaments}
                  gardenStats={gardenStats}
                  gridSize={GRID_SIZE}
                  isSharing={!!isSharing}
                  setIsSharing={setIsSharing}
                />
              </div>
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