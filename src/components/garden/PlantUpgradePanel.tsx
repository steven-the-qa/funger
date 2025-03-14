import React from 'react';
import { GardenItem, GardenStats, PLANT_COSTS } from '../../hooks/useGardenData';
import { getPlantDetails, getUpgradeCost, getNextVariant } from '../../utils/plantUtils';

interface PlantUpgradePanelProps {
  selectedPlant: GardenItem | null;
  gardenStats: GardenStats | null;
  onUpgradePlant: (plantId: string) => Promise<void>;
  onDeletePlant: (plantId: string) => Promise<void>;
  onSellPlant: (plantId: string, plantType: string, plantVariant: string) => Promise<void>;
  onClosePanel: () => void;
}

export const PlantUpgradePanel: React.FC<PlantUpgradePanelProps> = ({
  selectedPlant,
  gardenStats,
  onUpgradePlant,
  onDeletePlant: onReturnPlantToInventory,
  onSellPlant,
  onClosePanel,
}) => {
  if (!selectedPlant) {
    return null;
  }

  const plantDetails = getPlantDetails(selectedPlant.plant_type, selectedPlant.plant_variant);
  const nextVariant = getNextVariant(selectedPlant.plant_variant);
  const upgradeCost = getUpgradeCost(selectedPlant.plant_variant);
  const canUpgrade = nextVariant && gardenStats && gardenStats.flowers_available >= upgradeCost;
  
  // Calculate sell value based on plant type and variant
  const getSellValue = (): number => {
    // Base value from plant type
    let value = selectedPlant.plant_type === 'flower' ? 1 : PLANT_COSTS[selectedPlant.plant_type] || 0;
    
    // Add value for upgrades
    if (selectedPlant.plant_variant === 'rare') {
      value += 5; // Cost to upgrade from basic to rare
    } else if (selectedPlant.plant_variant === 'epic') {
      value += 15; // Cost to upgrade from basic to rare (5) and rare to epic (10)
    } else if (selectedPlant.plant_variant === 'legendary') {
      value += 30; // Cost to upgrade from basic to legendary (5 + 10 + 15)
    }
    
    return value;
  };
  
  const sellValue = getSellValue();
  const isFlower = selectedPlant.plant_type === 'flower';

  // Handle upgrade button click
  const handleUpgrade = async () => {
    if (canUpgrade) {
      await onUpgradePlant(selectedPlant.id);
    }
  };

  // Handle return to inventory button click
  const handleReturn = async () => {
    if (confirm('Are you sure you want to return this plant to your inventory?')) {
      await onReturnPlantToInventory(selectedPlant.id);
    }
  };
  
  // Handle sell button click
  const handleSell = async () => {
    if (confirm(`Are you sure you want to sell this ${plantDetails?.name || 'plant'} for ${sellValue} Daisies?`)) {
      await onSellPlant(selectedPlant.id, selectedPlant.plant_type, selectedPlant.plant_variant);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-semibold flex items-center">
          <span className="text-3xl mr-2">{plantDetails?.emoji || '❓'}</span>
          {plantDetails?.name || 'Unknown Plant'}
        </h3>
        <button 
          className="text-gray-500 hover:text-gray-700 text-xl"
          onClick={onClosePanel}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-3">{plantDetails?.description || 'No description available.'}</p>
        <p className="text-sm text-gray-500">Type: <span className="font-medium text-gray-700">{selectedPlant.plant_type.charAt(0).toUpperCase() + selectedPlant.plant_type.slice(1)}</span></p>
        <p className="text-sm text-gray-500">Variant: <span className="font-medium text-gray-700">{selectedPlant.plant_variant.charAt(0).toUpperCase() + selectedPlant.plant_variant.slice(1)}</span></p>
      </div>
      
      <div className="space-y-4">
        {nextVariant ? (
          <div className="bg-green-50 p-4 rounded-md">
            <p className="mb-3 text-gray-700">
              Upgrade to <span className="font-medium">{nextVariant.charAt(0).toUpperCase() + nextVariant.slice(1)}</span> for 
              <span className="text-amber-600 font-bold"> {upgradeCost} 🌼 Daisies</span>
            </p>
            <button
              className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                canUpgrade
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canUpgrade}
              onClick={handleUpgrade}
            >
              Upgrade Plant
            </button>
            {!canUpgrade && gardenStats && (
              <p className="mt-2 text-sm text-red-600">
                Not enough Daisies! You need {upgradeCost - gardenStats.flowers_available} more.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-purple-50 p-4 rounded-md">
            <p className="text-purple-700 font-medium">This plant is already at its maximum level!</p>
          </div>
        )}
        
        {/* Sell option - only show for non-flower plants */}
        {!isFlower && (
          <div className="bg-amber-50 p-4 rounded-md">
            <p className="mb-3 text-gray-700">
              Sell this plant for <span className="text-amber-600 font-bold">{sellValue} 🌼 Daisies</span>
            </p>
            <button
              className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium transition-colors"
              onClick={handleSell}
            >
              Sell Plant
            </button>
          </div>
        )}
        
        <button
          className="w-full py-2 px-4 mt-4 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md font-medium transition-colors"
          onClick={handleReturn}
        >
          Return to Inventory
        </button>
      </div>
    </div>
  );
};

export default PlantUpgradePanel; 