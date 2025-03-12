import React from 'react';
import { GardenItem, GardenOrnament } from '../../hooks/useGardenData';
import { getPlantEmoji } from '../../utils/plantUtils';
import { getOrnamentDetails } from '../../utils/ornamentUtils';

interface GardenGridProps {
  gardenItems: GardenItem[];
  gardenOrnaments: GardenOrnament[];
  gridSize: number;
  placingPlant: boolean;
  selectedPlantDetails: { type: string; variant: string } | undefined;
  onPlantClick: (item: GardenItem) => void;
  onGridCellClick: (x: number, y: number) => void;
}

function getOrnamentEmoji(ornamentType: string): string {
  const details = getOrnamentDetails(ornamentType);
  return details?.emoji || '❓';
}

export const GardenGrid: React.FC<GardenGridProps> = ({
  gardenItems,
  gardenOrnaments,
  gridSize,
  placingPlant,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedPlantDetails, // Keeping this parameter to satisfy the interface but we don't use it
  onPlantClick,
  onGridCellClick,
}) => {
  // Create a map of occupied positions
  const occupiedPositions = new Map<string, { type: string; item: GardenItem | GardenOrnament }>();
  
  // Add garden items to the map
  gardenItems.forEach(item => {
    occupiedPositions.set(`${item.position_x},${item.position_y}`, { 
      type: 'plant', 
      item 
    });
  });
  
  // Add garden ornaments to the map
  gardenOrnaments.forEach(ornament => {
    occupiedPositions.set(`${ornament.position_x},${ornament.position_y}`, { 
      type: 'ornament', 
      item: ornament 
    });
  });

  // Create the grid cells
  const renderGridCells = () => {
    const cells = [];
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const posKey = `${x},${y}`;
        const occupied = occupiedPositions.get(posKey);
        
        let cellContent;
        let cellClasses = "w-full h-full aspect-square bg-green-50 border border-green-200 rounded-md flex items-center justify-center cursor-pointer transition-all hover:bg-green-100";
        
        if (occupied) {
          if (occupied.type === 'plant') {
            const plant = occupied.item as GardenItem;
            cellContent = getPlantEmoji(plant.plant_type, plant.plant_variant);
            cellClasses += " bg-green-100 shadow-inner";
            
            // Special styling for luck plants (four-leaf clovers)
            if (plant.plant_type === 'luck') {
              if (plant.plant_variant === 'rare') {
                cellClasses += " clover-rare";
              } else if (plant.plant_variant === 'epic') {
                cellClasses += " clover-epic";
              } else if (plant.plant_variant === 'legendary') {
                cellClasses += " clover-legendary";
              }
            }
            
            // If in edit mode, add a subtle visual cue that plant can be replaced
            if (placingPlant) {
              cellClasses += " hover:bg-amber-100 hover:border-amber-300";
            }
          } else if (occupied.type === 'ornament') {
            const ornament = occupied.item as GardenOrnament;
            cellContent = getOrnamentEmoji(ornament.ornament_type);
            cellClasses += " bg-amber-50";
          }
        } else {
          // Don't show the emoji in empty cells when in placing mode
          // Just keep the cell content null, but still apply the animation class
          cellContent = null;
          
          if (placingPlant) {
            cellClasses += " garden-cell-placing";
          }
        }
        
        cells.push(
          <div 
            key={posKey}
            className={cellClasses}
            onClick={() => {
              if (occupied) {
                if (occupied.type === 'plant') {
                  // If in placing mode, treat the cell like an empty one for replacement
                  if (placingPlant) {
                    onGridCellClick(x, y);
                  } else {
                    // Otherwise, normal plant selection behavior
                    onPlantClick(occupied.item as GardenItem);
                  }
                } else {
                  // Ornaments can't be replaced currently
                  if (!placingPlant) {
                    // Maybe show some info or future feature?
                  }
                }
              } else {
                // Empty cell click
                onGridCellClick(x, y);
              }
            }}
          >
            {occupied && occupied.type === 'plant' && (occupied.item as GardenItem).plant_type === 'luck' ? (
              <span className="text-xl sm:text-3xl flex items-center justify-center">{cellContent}</span>
            ) : (
              <span className="text-xl sm:text-3xl">{cellContent}</span>
            )}
          </div>
        );
      }
    }
    
    return cells;
  };

  return (
    <div 
      className="w-full grid gap-1 sm:gap-2"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
      }}
    >
      {renderGridCells()}
    </div>
  );
};

export default GardenGrid; 