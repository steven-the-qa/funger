import React, { useRef, useState, useEffect } from 'react';
import { GardenItem, GardenOrnament, GardenStats } from '../../hooks/useGardenData';
import { getPlantEmoji } from '../../utils/plantUtils';
import { getOrnamentDetails } from '../../utils/ornamentUtils';
import html2canvas from 'html2canvas';
import { Download, Share2 } from 'lucide-react';

interface GardenSharingProps {
  gardenItems: GardenItem[];
  gardenOrnaments: GardenOrnament[];
  gardenStats: GardenStats | null;
  gridSize: number;
  isSharing: boolean;
  setIsSharing: (isSharing: boolean) => void;
  inventoryPlants?: Record<string, Record<string, number>>; // New prop for inventory plants
}

export const GardenSharing: React.FC<GardenSharingProps> = ({
  gardenItems,
  gardenOrnaments,
  gardenStats,
  gridSize,
  setIsSharing,
  inventoryPlants = {}, // Default to empty object
}) => {
  const [shareCard, setShareCard] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Check if html2canvas is available
  useEffect(() => {
    if (typeof html2canvas !== 'function') {
      console.error('html2canvas is not properly loaded:', html2canvas);
    } else {
      console.log('html2canvas is available');
    }
  }, []);

  // Helper function to get ornament emoji
  const getOrnamentEmoji = (type: string): string => {
    const details = getOrnamentDetails(type);
    return details?.emoji || '❓';
  };

  // Create the shareable garden grid
  const createGardenGrid = () => {
    // Create a grid filled with empty cells
    const grid: string[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill('⬜'));

    // Place plants on the grid
    gardenItems.forEach(item => {
      const { position_x, position_y, plant_type, plant_variant } = item;
      if (position_x >= 0 && position_x < gridSize && position_y >= 0 && position_y < gridSize) {
        grid[position_y][position_x] = getPlantEmoji(plant_type, plant_variant);
      }
    });

    // Place ornaments on the grid
    gardenOrnaments.forEach(ornament => {
      const { position_x, position_y, ornament_type } = ornament;
      if (position_x >= 0 && position_x < gridSize && position_y >= 0 && position_y < gridSize) {
        grid[position_y][position_x] = getOrnamentEmoji(ornament_type);
      }
    });

    return grid;
  };

  // Helper function to get inventory summary
  const getInventorySummary = () => {
    const summary: Record<string, number> = {};
    const plantTypes = Object.keys(inventoryPlants);
    
    // Count total inventory by plant type (sum all variants)
    plantTypes.forEach(type => {
      const variantCounts = inventoryPlants[type];
      const totalTypeCount = Object.values(variantCounts).reduce((sum, count) => sum + count, 0);
      if (totalTypeCount > 0) {
        summary[type] = totalTypeCount;
      }
    });
    
    return summary;
  };

  // Generate the share card HTML
  const generateShareCard = () => {
    const grid = createGardenGrid();
    const gridText = grid.map(row => row.join('')).join('\n');
    
    // Create the share text
    let shareText = "🌱 My Garden 🌱\n\n";
    shareText += gridText + "\n\n";
    
    // Add inventory info
    const inventorySummary = getInventorySummary();
    if (Object.keys(inventorySummary).length > 0) {
      shareText += "🎒 My Inventory:\n";
      
      Object.entries(inventorySummary).forEach(([type, count]) => {
        const emoji = getPlantEmoji(type, 'basic');
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        shareText += `${emoji} ${typeName}s: ${count}\n`;
      });
      
      shareText += "\n";
    }
    
    // Get the actual Touch Grass sessions completed from database
    let touchGrassSessions = 0;
    
    if (gardenStats) {
      // Use the actual value from the database
      touchGrassSessions = gardenStats.total_sessions_completed || 0;
    }
    
    // Add celebratory message based on actual sessions
    let celebrationMessage = "";
    if (touchGrassSessions === 0) {
      celebrationMessage = "🌱 Just getting started with Touch Grass!\n";
    } else if (touchGrassSessions <= 5) {
      celebrationMessage = `🌿 I've completed ${touchGrassSessions} Touch Grass sessions. Fresh air feels great!\n`;
    } else if (touchGrassSessions <= 15) {
      celebrationMessage = `🌿 Wow! I've spent ${touchGrassSessions} half-hours outdoors. Nature is my friend!\n`;
    } else if (touchGrassSessions <= 30) {
      celebrationMessage = `🌲 An outdoor enthusiast with ${touchGrassSessions} Touch Grass sessions. The sun high-fives me!\n`;
    } else {
      celebrationMessage = `🌳 ${touchGrassSessions} Touch Grass sessions - I'm practically photosynthesizing at this point!\n`;
    }
    
    shareText += celebrationMessage + "\n";
    shareText += "30 minutes of fresh air = 1 fake flower\n";
    shareText += "https://funger.netlify.app";
    
    return shareText;
  };

  // Create a simpler version of the share card if the full one fails
  const createFallbackShareCard = () => {
    // If full image generation fails, create a simple text version
    const shareText = generateShareCard();
    setShareCard(shareText);
    setGeneratingImage(false);
    console.log("Fallback share card created");
  };

  // Handle sharing button click - now creates both text and image
  const handleShareClick = async () => {
    console.log("Share button clicked"); // Debug log
    
    // Force the modal to open regardless of other conditions
    setIsSharing(true);
    setGeneratingImage(true);
    setShowShareModal(true);

    try {
      // First, create and set the text version as a fallback
      const shareText = generateShareCard();
      setShareCard(shareText);
      
      // Then attempt to create the image version
      await createShareImage();
    } catch (error) {
      console.error("Share error:", error);
      createFallbackShareCard();
    } finally {
      // Always ensure we set generatingImage to false
      setGeneratingImage(false);
    }
  };
  
  // Separate function to create the share image
  const createShareImage = async () => {
    let tempElement = null;
    
    try {
      console.log("Starting to create share card"); // Debug log
      
      // Create a dedicated share card for image creation
      const shareCard = document.createElement('div');
      tempElement = shareCard; // Store reference for cleanup in finally block
      shareCard.style.width = '600px';
      shareCard.style.padding = '24px';
      shareCard.style.backgroundColor = '#F0FDF4'; // Green tint
      shareCard.style.borderRadius = '16px';
      shareCard.style.fontFamily = 'Arial, sans-serif';
      shareCard.style.boxSizing = 'border-box';
      
      // Add app branding
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.marginBottom = '16px';
      
      const title = document.createElement('h2');
      title.textContent = 'My Garden';
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.color = '#16A34A'; // green-600
      title.style.margin = '0';
      
      const plantEmoji = document.createElement('span');
      plantEmoji.textContent = '🌱';
      plantEmoji.style.fontSize = '32px';
      plantEmoji.style.marginRight = '12px';
      
      header.appendChild(plantEmoji);
      header.appendChild(title);
      shareCard.appendChild(header);
      
      // Add garden grid
      const gardenContainer = document.createElement('div');
      gardenContainer.style.backgroundColor = '#ECFDF5'; // green-50
      gardenContainer.style.border = '2px solid #A7F3D0'; // green-200
      gardenContainer.style.borderRadius = '8px';
      gardenContainer.style.padding = '16px';
      gardenContainer.style.marginBottom = '20px';
      
      const grid = createGardenGrid();
      const gridEl = document.createElement('div');
      gridEl.style.display = 'grid';
      gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
      gridEl.style.gap = '4px';
      
      grid.forEach(row => {
        row.forEach(cell => {
          const cellEl = document.createElement('div');
          cellEl.style.width = '40px';
          cellEl.style.height = '40px';
          cellEl.style.backgroundColor = '#FFFFFF';
          cellEl.style.border = '1px solid #D1FAE5'; // green-100
          cellEl.style.borderRadius = '4px';
          cellEl.style.display = 'flex';
          cellEl.style.justifyContent = 'center';
          cellEl.style.alignItems = 'center';
          cellEl.style.fontSize = '24px';
          cellEl.textContent = cell;
          gridEl.appendChild(cellEl);
        });
      });
      
      gardenContainer.appendChild(gridEl);
      shareCard.appendChild(gardenContainer);
      
      // Add inventory summary
      const inventorySummary = getInventorySummary();
      if (Object.keys(inventorySummary).length > 0) {
        const inventoryContainer = document.createElement('div');
        inventoryContainer.style.backgroundColor = '#F5F3FF'; // Purple-50
        inventoryContainer.style.border = '2px solid #DDD6FE'; // Purple-200
        inventoryContainer.style.borderRadius = '8px';
        inventoryContainer.style.padding = '16px';
        inventoryContainer.style.marginBottom = '20px';
        
        const inventoryTitle = document.createElement('div');
        inventoryTitle.textContent = '🎒 My Inventory';
        inventoryTitle.style.fontSize = '16px';
        inventoryTitle.style.fontWeight = 'bold';
        inventoryTitle.style.color = '#7C3AED'; // Purple-600
        inventoryTitle.style.marginBottom = '12px';
        inventoryContainer.appendChild(inventoryTitle);
        
        const inventoryGrid = document.createElement('div');
        inventoryGrid.style.display = 'grid';
        inventoryGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        inventoryGrid.style.gap = '8px';
        
        Object.entries(inventorySummary).forEach(([type, count]) => {
          const itemEl = document.createElement('div');
          itemEl.style.display = 'flex';
          itemEl.style.alignItems = 'center';
          itemEl.style.padding = '8px';
          itemEl.style.backgroundColor = '#FFFFFF';
          itemEl.style.borderRadius = '4px';
          itemEl.style.border = '1px solid #EDE9FE'; // Purple-100
          
          const emoji = document.createElement('span');
          emoji.textContent = getPlantEmoji(type, 'basic');
          emoji.style.fontSize = '20px';
          emoji.style.marginRight = '8px';
          
          const typeInfo = document.createElement('div');
          typeInfo.style.display = 'flex';
          typeInfo.style.flexDirection = 'column';
          
          const typeName = document.createElement('span');
          typeName.textContent = type.charAt(0).toUpperCase() + type.slice(1) + 's';
          typeName.style.fontSize = '14px';
          typeName.style.fontWeight = 'bold';
          
          const typeCount = document.createElement('span');
          typeCount.textContent = `${count} in inventory`;
          typeCount.style.fontSize = '12px';
          typeCount.style.color = '#6B7280'; // Gray-500
          
          typeInfo.appendChild(typeName);
          typeInfo.appendChild(typeCount);
          
          itemEl.appendChild(emoji);
          itemEl.appendChild(typeInfo);
          inventoryGrid.appendChild(itemEl);
        });
        
        inventoryContainer.appendChild(inventoryGrid);
        shareCard.appendChild(inventoryContainer);
      }
      
      // Add garden stats - REPLACED WITH CELEBRATION MESSAGE
      if (gardenStats) {
        const statsContainer = document.createElement('div');
        statsContainer.style.display = 'flex';
        statsContainer.style.flexDirection = 'column';
        statsContainer.style.alignItems = 'center';
        statsContainer.style.textAlign = 'center';
        statsContainer.style.marginBottom = '16px';
        statsContainer.style.padding = '12px';
        statsContainer.style.backgroundColor = '#ECFDF5';
        statsContainer.style.borderRadius = '8px';
        
        // Get the actual Touch Grass sessions completed from database
        const touchGrassSessions = gardenStats.total_sessions_completed || 0;
        
        // Add celebratory emoji
        const celebrationEmoji = document.createElement('div');
        celebrationEmoji.style.fontSize = '32px';
        celebrationEmoji.style.marginBottom = '8px';
        
        let celebrationText = "";
        
        if (touchGrassSessions === 0) {
          celebrationEmoji.textContent = '🌱';
          celebrationText = "Just getting started with Touch Grass!";
        } else if (touchGrassSessions <= 5) {
          celebrationEmoji.textContent = '🌿';
          celebrationText = `I've completed ${touchGrassSessions} Touch Grass sessions. Fresh air feels great!`;
        } else if (touchGrassSessions <= 15) {
          celebrationEmoji.textContent = '🌿✨';
          celebrationText = `Wow! I've spent ${touchGrassSessions} half-hours outdoors. Nature is my friend!`;
        } else if (touchGrassSessions <= 30) {
          celebrationEmoji.textContent = '🌲🌞';
          celebrationText = `An outdoor enthusiast with ${touchGrassSessions} Touch Grass sessions. The sun high-fives me!`;
        } else {
          celebrationEmoji.textContent = '🌳🏆';
          celebrationText = `${touchGrassSessions} Touch Grass sessions - I'm practically photosynthesizing at this point!`;
        }
        
        statsContainer.appendChild(celebrationEmoji);
        
        const celebrationMessage = document.createElement('div');
        celebrationMessage.textContent = celebrationText;
        celebrationMessage.style.fontSize = '14px';
        celebrationMessage.style.fontWeight = 'bold';
        celebrationMessage.style.color = '#047857';
        celebrationMessage.style.margin = '0 auto';
        celebrationMessage.style.maxWidth = '400px';
        celebrationMessage.style.lineHeight = '1.4';
        
        statsContainer.appendChild(celebrationMessage);
        shareCard.appendChild(statsContainer);
      }
      
      // Add app link at bottom
      const footer = document.createElement('div');
      footer.style.marginTop = '16px';
      footer.style.textAlign = 'center';
      footer.style.fontSize = '12px';
      footer.style.color = '#6B7280'; // gray-500
      footer.textContent = '30 minutes of fresh air = 1 fake flower 🌱 funger.netlify.app';
      
      shareCard.appendChild(footer);
      
      // Temporarily add to body but make invisible
      shareCard.style.position = 'absolute';
      shareCard.style.left = '-9999px';
      document.body.appendChild(shareCard);
      
      // Generate image
      try {
        console.log("Starting html2canvas rendering"); // Debug log
        
        // Use a simpler html2canvas configuration
        const canvas = await html2canvas(shareCard, {
          scale: 1, // Lower resolution to avoid memory issues
          logging: true, // Enable logging
          useCORS: true
        });
        
        console.log("html2canvas rendering complete"); // Debug log
        
        // Get data URL and set states
        const imageUrl = canvas.toDataURL('image/png');
        setShareUrl(imageUrl);
        console.log("Image URL created and state updated"); // Debug log
      } catch (canvasError) {
        console.error("Error in html2canvas:", canvasError);
        throw canvasError; // Re-throw to be caught by the outer try-catch
      }
    } catch (error) {
      console.error('Error creating share card:', error);
      throw error; // Re-throw to be caught by the main handler
    } finally {
      // Clean up the temporary DOM element if it exists
      if (tempElement && tempElement.parentNode) {
        try {
          document.body.removeChild(tempElement);
        } catch (e) {
          console.error('Error cleaning up temporary element:', e);
        }
      }
    }
  };

  // Handle copying the share text to clipboard
  const handleCopyText = () => {
    if (shareCard) {
      navigator.clipboard.writeText(shareCard)
        .then(() => {
          alert('Garden share text copied to clipboard!');
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    }
  };

  // Handle download
  const handleDownload = () => {
    // Check if it's an iOS device to handle differently
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      performDownload();
    } else {
      // For all other devices
      performDownload();
    }
  };

  const performDownload = () => {
    // For iOS specifically, we need a different approach
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && shareUrl) {
      // Open image in new tab - iOS users can then long-press to save to camera roll
      window.open(shareUrl, '_blank');
      return;
    }

    // Traditional download for other devices
    const link = document.createElement('a');
    link.href = shareUrl || '';
    link.download = 'my-funger-garden.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle closing the share card
  const handleCloseClick = () => {
    setIsSharing(false);
    setShareCard(null);
    setShareUrl(null);
    setShowShareModal(false);
  };

  return (
    <>
      <button
        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
        onClick={handleShareClick}
      >
        <Share2 size={18} />
        Share Garden
      </button>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 share-card-animate" ref={cardRef}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-green-600">Share Your Garden</h3>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl"
                onClick={handleCloseClick}
                aria-label="Close share card"
              >
                ✕
              </button>
            </div>

            {/* Show loading spinner while generating */}
            {generatingImage && !shareUrl && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin h-12 w-12 mb-4 border-4 border-green-600 rounded-full border-t-transparent"></div>
                <p className="text-gray-600 font-medium">Creating your garden image...</p>
              </div>
            )}

            {/* Show image when ready */}
            {shareUrl && (
              <div className="mb-6">
                <div className="mb-3 border border-gray-200 rounded-md overflow-hidden">
                  <img 
                    src={shareUrl} 
                    alt="Your garden" 
                    className="w-full h-auto"
                  />
                </div>
                <button
                  className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                  onClick={handleDownload}
                >
                  <Download size={18} />
                  Download Image
                </button>
              </div>
            )}

            {/* Show text version only if image generation failed */}
            {shareCard && !shareUrl && !generatingImage && (
              <div className="mb-6">
                <div className="bg-amber-50 p-3 mb-3 rounded-md text-amber-700 text-sm">
                  Unable to create image. You can still share the text version below.
                </div>
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm mb-4 whitespace-pre-wrap font-mono">{shareCard}</pre>
                <button
                  className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                  onClick={handleCopyText}
                >
                  Copy Text to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GardenSharing; 