import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Flower, LeafyGreen, ArrowUpCircle, Info, Share2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface GardenProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface GardenItem {
  id: string;
  plant_type: string;
  plant_variant: string;
  position_x: number;
  position_y: number;
}

interface GardenStats {
  total_sessions_completed: number;
  total_flowers_earned: number;
  flowers_available: number;
  next_upgrade_threshold: number;
}

// Plant types in order of upgrade path
const PLANT_TYPES = [
  { type: 'flower', label: 'Flower', emoji: '🌼', description: 'A simple flower' },
  { type: 'veggie', label: 'Vegetable', emoji: '🥕', description: 'A nutritious vegetable', cost: 5 },
  { type: 'fruit', label: 'Fruit', emoji: '🍓', description: 'A delicious fruit', cost: 10 },
  { type: 'tree', label: 'Tree', emoji: '🌴', description: 'A majestic tree', cost: 15 },
  { type: 'luck', label: 'Lucky Charm', emoji: '🍀', description: 'A rare lucky find', cost: 20 },
];

// Variants for each type
const PLANT_VARIANTS: Record<string, Array<{name: string, emoji: string}>> = {
  flower: [
    { name: 'daisy', emoji: '🌼' },
    { name: 'rose', emoji: '🌹' },
    { name: 'tulip', emoji: '🌷' },
    { name: 'sunflower', emoji: '🌻' },
  ],
  veggie: [
    { name: 'carrot', emoji: '🥕' },
    { name: 'onion', emoji: '🧅' },
    { name: 'potato', emoji: '🥔' },
  ],
  fruit: [
    { name: 'strawberry', emoji: '🍓' },
    { name: 'kiwi', emoji: '🥝' },
    { name: 'watermelon', emoji: '🍉' },
  ],
  tree: [
    { name: 'palm', emoji: '🌴' },
    { name: 'pine', emoji: '🌲' },
    { name: 'deciduous', emoji: '🌳' },
  ],
  luck: [
    { name: 'four-leaf-clover', emoji: '🍀' },
  ],
};

const Garden: React.FC<GardenProps> = ({ userId, isOpen, onClose }) => {
  const [gardenItems, setGardenItems] = useState<GardenItem[]>([]);
  const [gardenStats, setGardenStats] = useState<GardenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlantType, setSelectedPlantType] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const gardenRef = useRef<HTMLDivElement>(null);

  // Garden grid configuration
  const GRID_SIZE = 5; // 5x5 grid

  const loadGardenData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch garden items
      const { data: itemsData, error: itemsError } = await supabase
        .from('garden_items')
        .select('*')
        .eq('user_id', userId);
        
      if (itemsError) throw itemsError;
      
      // Fetch user garden stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_garden_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (statsError && statsError.code !== 'PGRST116') { // Not found is OK for new users
        throw statsError;
      }
      
      setGardenItems(itemsData || []);
      setGardenStats(statsData || {
        total_sessions_completed: 0,
        total_flowers_earned: 0,
        flowers_available: 0,
        next_upgrade_threshold: 5
      });
      
    } catch (error) {
      console.error('Error loading garden data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadGardenData();
    }
  }, [isOpen, userId, loadGardenData]);
  
  const createNewPlant = async (type: string, variant: string) => {
    try {
      // Find an empty position on the grid
      const occupiedPositions = new Set(
        gardenItems.map(item => `${item.position_x},${item.position_y}`)
      );
      
      let position_x = -1;
      let position_y = -1;
      
      // Find first available position
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
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
        alert("Your garden is full! Consider upgrading your plants instead.");
        return false;
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
        const cost = type === 'flower' ? 0 : PLANT_TYPES.find(p => p.type === type)?.cost || 0;
        
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
      return true;
      
    } catch (error) {
      console.error('Error creating new plant:', error);
      return false;
    }
  };
  
  const upgradePlant = () => {
    if (!selectedPlantType || !selectedVariant) {
      alert("Please select a plant type and variant");
      return;
    }
    
    const plantTypeDef = PLANT_TYPES.find(p => p.type === selectedPlantType);
    if (!plantTypeDef) return;
    
    const cost = plantTypeDef.cost || 0;
    
    if (gardenStats && gardenStats.flowers_available < cost) {
      alert(`You need ${cost} flowers to create a ${plantTypeDef.label}`);
      return;
    }
    
    createNewPlant(selectedPlantType, selectedVariant);
    setShowUpgradePanel(false);
  };
  
  const getPlantEmoji = (type: string, variant: string) => {
    const variantList = PLANT_VARIANTS[type] || [];
    const plantVariant = variantList.find(v => v.name === variant);
    return plantVariant ? plantVariant.emoji : '🌱';
  };
  
  // Improved sharing functionality
  const handleShare = async () => {
    try {
      setIsSharing(true);
      
      // Create a dedicated share card
      const shareCard = document.createElement('div');
      shareCard.style.width = '600px';
      shareCard.style.padding = '24px';
      shareCard.style.backgroundColor = '#F0FDF4'; // green-50
      shareCard.style.borderRadius = '16px';
      shareCard.style.fontFamily = 'Arial, sans-serif';
      shareCard.style.boxSizing = 'border-box';
      
      // Add app branding
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.marginBottom = '16px';
      
      const title = document.createElement('h2');
      title.textContent = 'Funger - My Garden';
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.color = '#15803D'; // green-700
      title.style.margin = '0';
      
      const gardenEmoji = document.createElement('span');
      gardenEmoji.textContent = '🌱';
      gardenEmoji.style.fontSize = '32px';
      gardenEmoji.style.marginRight = '12px';
      
      header.appendChild(gardenEmoji);
      header.appendChild(title);
      shareCard.appendChild(header);
      
      // Add metrics section
      const metricsContainer = document.createElement('div');
      metricsContainer.style.display = 'grid';
      metricsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
      metricsContainer.style.gap = '16px';
      metricsContainer.style.margin = '24px 0';
      metricsContainer.style.padding = '16px';
      metricsContainer.style.backgroundColor = '#DCFCE7'; // green-100
      metricsContainer.style.borderRadius = '8px';
      
      // Sessions completed
      const sessionsCard = document.createElement('div');
      sessionsCard.style.textAlign = 'center';
      
      const sessionsLabel = document.createElement('p');
      sessionsLabel.textContent = 'Sessions Completed';
      sessionsLabel.style.fontSize = '14px';
      sessionsLabel.style.color = '#166534'; // green-800
      sessionsLabel.style.margin = '0 0 4px 0';
      
      const sessionsValue = document.createElement('p');
      sessionsValue.textContent = String(gardenStats?.total_sessions_completed || 0);
      sessionsValue.style.fontSize = '28px';
      sessionsValue.style.fontWeight = 'bold';
      sessionsValue.style.color = '#15803D'; // green-700
      sessionsValue.style.margin = '0';
      
      sessionsCard.appendChild(sessionsLabel);
      sessionsCard.appendChild(sessionsValue);
      metricsContainer.appendChild(sessionsCard);
      
      // Flowers earned
      const flowersCard = document.createElement('div');
      flowersCard.style.textAlign = 'center';
      
      const flowersLabel = document.createElement('p');
      flowersLabel.textContent = 'Flowers Earned';
      flowersLabel.style.fontSize = '14px';
      flowersLabel.style.color = '#166534'; // green-800
      flowersLabel.style.margin = '0 0 4px 0';
      
      const flowersValue = document.createElement('p');
      flowersValue.textContent = String(gardenStats?.total_flowers_earned || 0);
      flowersValue.style.fontSize = '28px';
      flowersValue.style.fontWeight = 'bold';
      flowersValue.style.color = '#15803D'; // green-700
      flowersValue.style.margin = '0';
      
      flowersCard.appendChild(flowersLabel);
      flowersCard.appendChild(flowersValue);
      metricsContainer.appendChild(flowersCard);
      
      // Flowers available
      const availableCard = document.createElement('div');
      availableCard.style.textAlign = 'center';
      
      const availableLabel = document.createElement('p');
      availableLabel.textContent = 'Available Flowers';
      availableLabel.style.fontSize = '14px';
      availableLabel.style.color = '#166534'; // green-800
      availableLabel.style.margin = '0 0 4px 0';
      
      const availableValue = document.createElement('p');
      availableValue.textContent = String(gardenStats?.flowers_available || 0);
      availableValue.style.fontSize = '28px';
      availableValue.style.fontWeight = 'bold';
      availableValue.style.color = '#15803D'; // green-700
      availableValue.style.margin = '0';
      
      availableCard.appendChild(availableLabel);
      availableCard.appendChild(availableValue);
      metricsContainer.appendChild(availableCard);
      
      shareCard.appendChild(metricsContainer);
      
      // Add garden highlight - most impressive plant
      // Sort plants by type importance
      const plantTypeRanking: Record<string, number> = {
        'flower': 1,
        'veggie': 2,
        'fruit': 3,
        'tree': 4,
        'luck': 5
      };
      
      const sortedPlants = [...gardenItems].sort((a, b) => {
        return (plantTypeRanking[b.plant_type] || 0) - (plantTypeRanking[a.plant_type] || 0);
      });
      
      const bestPlant = sortedPlants[0];
      
      if (bestPlant) {
        const plantInfo = PLANT_TYPES.find(p => p.type === bestPlant.plant_type);
        
        // Create achievement-like container for best plant
        const achievementContainer = document.createElement('div');
        achievementContainer.style.backgroundColor = '#ECFDF5'; // green-50
        achievementContainer.style.border = '2px solid #6EE7B7'; // green-300
        achievementContainer.style.borderRadius = '8px';
        achievementContainer.style.padding = '20px';
        achievementContainer.style.marginBottom = '24px';
        achievementContainer.style.display = 'flex';
        achievementContainer.style.alignItems = 'center';
        
        // Get the plant emoji
        const variantList = PLANT_VARIANTS[bestPlant.plant_type] || [];
        const plantVariant = variantList.find(v => v.name === bestPlant.plant_variant);
        const plantEmoji = plantVariant ? plantVariant.emoji : '🌱';
        
        const emojiEl = document.createElement('div');
        emojiEl.textContent = plantEmoji;
        emojiEl.style.fontSize = '48px';
        emojiEl.style.marginRight = '16px';
        
        const achievementContent = document.createElement('div');
        
        const achievementTitle = document.createElement('h3');
        achievementTitle.textContent = `${plantInfo?.label || 'Plant'} Master`;
        achievementTitle.style.margin = '0 0 8px 0';
        achievementTitle.style.fontSize = '18px';
        achievementTitle.style.fontWeight = 'bold';
        achievementTitle.style.color = '#065F46'; // green-800
        
        const achievementDesc = document.createElement('p');
        achievementDesc.textContent = `You've grown a beautiful ${plantInfo?.label.toLowerCase() || 'plant'} in your garden!`;
        achievementDesc.style.margin = '0';
        achievementDesc.style.fontSize = '14px';
        achievementDesc.style.color = '#047857'; // green-700
        
        achievementContent.appendChild(achievementTitle);
        achievementContent.appendChild(achievementDesc);
        
        achievementContainer.appendChild(emojiEl);
        achievementContainer.appendChild(achievementContent);
        
        shareCard.appendChild(achievementContainer);
      }
      
      // Add garden preview
      const gardenPreview = document.createElement('div');
      gardenPreview.style.marginTop = '20px';
      
      // Add header for garden
      const gardenHeader = document.createElement('h3');
      gardenHeader.textContent = 'My Garden';
      gardenHeader.style.margin = '0 0 12px 0';
      gardenHeader.style.fontSize = '16px';
      gardenHeader.style.fontWeight = '600';
      gardenHeader.style.color = '#166534'; // green-800
      
      gardenPreview.appendChild(gardenHeader);
      
      // Create garden grid
      const gardenGrid = document.createElement('div');
      gardenGrid.style.display = 'grid';
      gardenGrid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
      gardenGrid.style.gap = '8px';
      gardenGrid.style.backgroundColor = '#D1FAE5'; // green-100
      gardenGrid.style.padding = '8px';
      gardenGrid.style.borderRadius = '8px';
      
      // Populate the grid with plants
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const index = y * GRID_SIZE + x;
          const plant = gardenItems.find(
            item => item.position_x === x && item.position_y === y
          );
          
          // Calculate which cells should show available flowers
          const occupiedCells = gardenItems.length;
          const flowerIndex = index - occupiedCells;
          const showIndividualFlower = !plant && 
            flowerIndex >= 0 &&
            flowerIndex < (gardenStats?.flowers_available || 0);
          
          const cell = document.createElement('div');
          cell.style.aspectRatio = '1/1';
          cell.style.display = 'flex';
          cell.style.alignItems = 'center';
          cell.style.justifyContent = 'center';
          cell.style.fontSize = '24px';
          
          // Different background colors for plants, flowers, and empty cells
          if (plant) {
            cell.style.backgroundColor = '#A7F3D0'; // green-200 for plants
          } else if (showIndividualFlower) {
            cell.style.backgroundColor = '#FEF3C7'; // amber-100 for flowers
          } else {
            cell.style.backgroundColor = '#ECFDF5'; // green-50 for empty cells
          }
          
          cell.style.borderRadius = '4px';
          
          if (plant) {
            cell.textContent = getPlantEmoji(plant.plant_type, plant.plant_variant);
          } else if (showIndividualFlower) {
            const flowerVariants = PLANT_VARIANTS.flower;
            cell.textContent = flowerVariants[flowerIndex % flowerVariants.length].emoji;
          }
          
          gardenGrid.appendChild(cell);
        }
      }
      
      gardenPreview.appendChild(gardenGrid);
      shareCard.appendChild(gardenPreview);
      
      // Plant variety summary
      const plantSummary = document.createElement('div');
      plantSummary.style.marginTop = '16px';
      
      // Count types of plants
      const plantCounts: Record<string, number> = {};
      gardenItems.forEach(item => {
        plantCounts[item.plant_type] = (plantCounts[item.plant_type] || 0) + 1;
      });
      
      // Create summary text
      const summaryText = document.createElement('p');
      summaryText.style.fontSize = '14px';
      summaryText.style.color = '#374151'; // gray-700
      summaryText.style.margin = '0';
      
      const plantTypeTexts: string[] = [];
      Object.entries(plantCounts).forEach(([type, count]) => {
        const plantInfo = PLANT_TYPES.find(p => p.type === type);
        if (plantInfo) {
          plantTypeTexts.push(`${count} ${plantInfo.label.toLowerCase()}${count > 1 ? 's' : ''}`);
        }
      });
      
      if (plantTypeTexts.length > 0) {
        summaryText.textContent = `My garden has: ${plantTypeTexts.join(', ')}`;
        plantSummary.appendChild(summaryText);
        shareCard.appendChild(plantSummary);
      }
      
      // Add app link at bottom
      const footer = document.createElement('div');
      footer.style.marginTop = '24px';
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
      setShareUrl(imageUrl);
      
    } catch (error) {
      console.error('Error creating share image:', error);
    } finally {
      setIsSharing(false);
    }
  };
  
  const handleDownload = () => {
    if (!shareUrl) return;
    
    // Check if this is a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share) {
      // Use Web Share API on mobile if available - this typically gives better options
      fetch(shareUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'my-garden.png', { type: 'image/png' });
          
          navigator.share({
            files: [file],
            title: 'My Garden',
            text: 'Check out my garden in Funger!'
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
    link.download = 'my-garden.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Inside the component, add a handler to toggle the share image
  const toggleShare = async () => {
    if (shareUrl) {
      // If image is already showing, just hide it
      setShareUrl(null);
      return;
    }
    
    // Otherwise, generate the image
    await handleShare();
  };
  
  // Modal backdrop
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-green-600 flex items-center">
              <LeafyGreen className="mr-2" /> Your Garden
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading your garden...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-medium text-gray-700">Garden Stats</h3>
                    <p className="text-sm text-gray-500">
                      You've completed {gardenStats?.total_sessions_completed || 0} sessions
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                    <Flower size={18} />
                    <span className="font-medium">{gardenStats?.flowers_available || 0}</span>
                    <span className="text-xs ml-1">flowers available</span>
                  </div>
                </div>
                
                {/* Buttons for adding/upgrading and sharing */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowUpgradePanel(!showUpgradePanel)}
                    disabled={(gardenStats?.flowers_available || 0) < 5}
                    className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium ${
                      (gardenStats?.flowers_available || 0) < 5 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    <ArrowUpCircle size={18} />
                    Upgrade Plant
                    {(gardenStats?.flowers_available || 0) < 5 && (
                      <span className="ml-1 text-xs">(Need 5 flowers)</span>
                    )}
                  </button>
                  
                  <button
                    onClick={toggleShare}
                    disabled={isSharing || gardenItems.length === 0}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                      isSharing || gardenItems.length === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : shareUrl 
                          ? 'bg-red-100 hover:bg-red-200 text-red-700'
                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                  >
                    <Share2 size={18} />
                    {isSharing ? 'Creating...' : shareUrl ? 'Hide Image' : 'Share Garden'}
                  </button>
                </div>
              </div>
              
              {/* Share modal */}
              {shareUrl && (
                <div className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
                  <h3 className="font-medium text-gray-700 mb-2">Share Your Garden</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Save this image to share your garden progress!
                  </p>
                  <div className="mb-3 border border-gray-200 rounded-md overflow-hidden">
                    <img 
                      src={shareUrl} 
                      alt="Your garden" 
                      className="w-full h-auto"
                    />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md"
                  >
                    <Download size={18} />
                    Download Image
                  </button>
                </div>
              )}
              
              {/* Upgrade panel */}
              {showUpgradePanel && (
                <div className="mb-6 bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium text-green-700 mb-2">Upgrade to a New Plant</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Trade in your flowers for more advanced plants!
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plant Type
                    </label>
                    <select
                      value={selectedPlantType}
                      onChange={(e) => {
                        setSelectedPlantType(e.target.value);
                        // Reset variant when plant type changes
                        setSelectedVariant('');
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select plant type</option>
                      {PLANT_TYPES.filter(plant => plant.type !== 'flower').map((plant) => (
                        <option 
                          key={plant.type} 
                          value={plant.type}
                          disabled={(gardenStats?.flowers_available || 0) < (plant.cost || 0)}
                        >
                          {plant.emoji} {plant.label} ({plant.cost} flowers)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedPlantType && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Variant
                      </label>
                      <select
                        value={selectedVariant}
                        onChange={(e) => setSelectedVariant(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select variant</option>
                        {PLANT_VARIANTS[selectedPlantType]?.map((variant) => (
                          <option key={variant.name} value={variant.name}>
                            {variant.emoji} {variant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <button
                    onClick={upgradePlant}
                    disabled={!selectedPlantType || !selectedVariant}
                    className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    <ArrowUpCircle size={18} />
                    Get New Plant
                  </button>
                </div>
              )}
              
              {/* Garden grid */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Your Plants</h3>
                <div 
                  ref={gardenRef}
                  className="border border-green-200 rounded-lg bg-green-50 p-2"
                >
                  <div 
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
                  >
                    {/* Generate garden grid */}
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                      const x = index % GRID_SIZE;
                      const y = Math.floor(index / GRID_SIZE);
                      
                      // First check for planted items
                      const plant = gardenItems.find(
                        item => item.position_x === x && item.position_y === y
                      );
                      
                      // Calculate total cells already occupied by planted items
                      const occupiedCells = gardenItems.length;
                      
                      // For cells that don't have a planted item, show individual flowers if available
                      // We'll show flowers in the first empty cells after any planted items
                      const flowerIndex = index - occupiedCells;
                      const showIndividualFlower = !plant && 
                        gardenStats && 
                        flowerIndex >= 0 &&
                        flowerIndex < (gardenStats.flowers_available || 0);
                      
                      return (
                        <div 
                          key={index}
                          className={`aspect-square flex items-center justify-center text-2xl rounded-md ${
                            plant ? 'bg-green-100' : showIndividualFlower ? 'bg-amber-50' : 'bg-green-50 border border-dashed border-green-200'
                          }`}
                        >
                          {plant ? (
                            <span title={`${plant.plant_type} - ${plant.plant_variant}`}>
                              {getPlantEmoji(plant.plant_type, plant.plant_variant)}
                            </span>
                          ) : showIndividualFlower ? (
                            <span title="Available Flower">
                              {PLANT_VARIANTS.flower[flowerIndex % PLANT_VARIANTS.flower.length].emoji}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded-md text-yellow-800 text-sm flex items-start">
                <Info size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p>Complete 30-minute "Touch Grass" sessions to earn flowers for your garden.</p>
                  {gardenStats && (gardenStats.flowers_available || 0) >= 5 && (
                    <p className="mt-1 font-medium">
                      You have enough flowers to upgrade to a new plant type!
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Garden; 