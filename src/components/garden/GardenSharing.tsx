import React, { useRef, useState } from 'react';
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
}

export const GardenSharing: React.FC<GardenSharingProps> = ({
  gardenItems,
  gardenOrnaments,
  gardenStats,
  gridSize,
  isSharing,
  setIsSharing,
}) => {
  const [shareCard, setShareCard] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Generate the share card HTML
  const generateShareCard = () => {
    const grid = createGardenGrid();
    const gridText = grid.map(row => row.join('')).join('\n');
    
    // Create the share text
    let shareText = "🌱 My Garden 🌱\n\n";
    shareText += gridText + "\n\n";
    
    if (gardenStats) {
      shareText += `🌿 Plants: ${gardenItems.length}\n`;
      shareText += `🪨 Ornaments: ${gardenOrnaments.length}\n\n`;
    }
    
    shareText += "30 minutes of fresh air = 1 fake flower\n";
    shareText += "https://funger.netlify.app";
    
    return shareText;
  };

  // Handle sharing button click - now creates both text and image
  const handleShareClick = async () => {
    setIsSharing(true);
    setGeneratingImage(true);
    setShowShareModal(true);

    // Generate shareText but don't set shareCard state yet
    const shareText = generateShareCard();
    
    try {
      // Create a dedicated share card for image creation
      const shareCard = document.createElement('div');
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
      
      // Add garden stats
      if (gardenStats) {
        const statsContainer = document.createElement('div');
        statsContainer.style.display = 'flex';
        statsContainer.style.justifyContent = 'space-around';
        statsContainer.style.marginBottom = '16px';
        
        const createStatItem = (emoji: string, label: string, value: number) => {
          const statItem = document.createElement('div');
          statItem.style.display = 'flex';
          statItem.style.flexDirection = 'column';
          statItem.style.alignItems = 'center';
          
          const statEmoji = document.createElement('div');
          statEmoji.textContent = emoji;
          statEmoji.style.fontSize = '24px';
          statEmoji.style.marginBottom = '4px';
          
          const statValue = document.createElement('div');
          statValue.textContent = value.toString();
          statValue.style.fontWeight = 'bold';
          statValue.style.fontSize = '16px';
          
          const statLabel = document.createElement('div');
          statLabel.textContent = label;
          statLabel.style.fontSize = '12px';
          statLabel.style.color = '#047857'; // green-700
          
          statItem.appendChild(statEmoji);
          statItem.appendChild(statValue);
          statItem.appendChild(statLabel);
          
          return statItem;
        };
        
        statsContainer.appendChild(createStatItem('🌿', 'Plants', gardenItems.length));
        statsContainer.appendChild(createStatItem('🪨', 'Ornaments', gardenOrnaments.length));
        
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
      const canvas = await html2canvas(shareCard, {
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });
      
      // Remove temporary element
      document.body.removeChild(shareCard);
      
      // Convert to image URL
      const imageUrl = canvas.toDataURL('image/png');
      
      // Once the image is ready, set both states
      setShareUrl(imageUrl);
      setShareCard(shareText);
      
    } catch (error) {
      console.error('Error creating share image:', error);
      // In case of error, still show the text version
      setShareCard(shareText);
    } finally {
      setGeneratingImage(false);
    }
  };

  // Handle downloading the image
  const handleDownload = () => {
    if (!shareUrl) return;
    
    // Check if this is a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share) {
      // Use Web Share API on mobile if available
      fetch(shareUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'my-funger-garden.png', { type: 'image/png' });
          
          navigator.share({
            files: [file],
            title: 'My Funger Garden',
            text: 'Check out my virtual garden in Funger!'
          }).catch(error => {
            console.error('Error sharing:', error);
            // Fall back to traditional download if sharing fails
            performDownload();
          });
        });
    } else {
      // For desktop or if Web Share API isn't available
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
        disabled={isSharing || (gardenItems.length === 0 && gardenOrnaments.length === 0)}
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GardenSharing; 