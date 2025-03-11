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
  { type: 'bush', label: 'Bush', emoji: '🌿', description: 'A small bush', cost: 5 },
  { type: 'shrub', label: 'Flowering Shrub', emoji: '🌳', description: 'A larger flowering shrub', cost: 10 },
  { type: 'tree', label: 'Small Tree', emoji: '🌲', description: 'A small tree', cost: 15 },
  { type: 'large_tree', label: 'Large Tree', emoji: '🌴', description: 'A majestic large tree', cost: 20 },
];

// Variants for each type
const PLANT_VARIANTS: Record<string, Array<{name: string, emoji: string}>> = {
  flower: [
    { name: 'daisy', emoji: '🌼' },
    { name: 'rose', emoji: '🌹' },
    { name: 'tulip', emoji: '🌷' },
    { name: 'sunflower', emoji: '🌻' },
  ],
  bush: [
    { name: 'herb', emoji: '🌿' },
    { name: 'leafy', emoji: '☘️' },
  ],
  shrub: [
    { name: 'blossom', emoji: '🌳' },
    { name: 'berries', emoji: '🍃' },
  ],
  tree: [
    { name: 'pine', emoji: '🌲' },
    { name: 'deciduous', emoji: '🌳' },
  ],
  large_tree: [
    { name: 'palm', emoji: '🌴' },
    { name: 'redwood', emoji: '🌲' },
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
  
  const handleShare = async () => {
    if (!gardenRef.current) return;
    
    try {
      setIsSharing(true);
      
      // Generate the image from the garden grid
      const canvas = await html2canvas(gardenRef.current, {
        backgroundColor: '#f0fdf4', // Light green background
        scale: 2, // Higher quality
      });
      
      // Convert to image URL
      const imageUrl = canvas.toDataURL('image/png');
      setShareUrl(imageUrl);
      
      // Try using the Web Share API if available
      if (navigator.share) {
        // Create a blob from the image
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], 'my-garden.png', { type: 'image/png' });
        
        try {
          await navigator.share({
            title: 'My Touch Grass Garden',
            text: `I've completed ${gardenStats?.total_sessions_completed || 0} screen breaks and grown ${gardenItems.length} plants in my virtual garden!`,
            files: [file]
          });
        } catch (error) {
          console.error('Error sharing:', error);
          // Fallback to showing the share modal
        }
      }
      
    } catch (error) {
      console.error('Error creating share image:', error);
    } finally {
      setIsSharing(false);
    }
  };
  
  const handleDownload = () => {
    if (!shareUrl) return;
    
    // Create a download link
    const link = document.createElement('a');
    link.href = shareUrl;
    link.download = 'my-garden.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Modal backdrop
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
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
                    onClick={handleShare}
                    disabled={isSharing || gardenItems.length === 0}
                    className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium ${
                      isSharing || gardenItems.length === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                  >
                    <Share2 size={18} />
                    {isSharing ? 'Creating...' : 'Share Garden'}
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
                      const plant = gardenItems.find(
                        item => item.position_x === x && item.position_y === y
                      );
                      
                      return (
                        <div 
                          key={index}
                          className={`aspect-square flex items-center justify-center text-2xl rounded-md ${
                            plant ? 'bg-green-100' : 'bg-green-50 border border-dashed border-green-200'
                          }`}
                        >
                          {plant ? (
                            <span title={`${plant.plant_type} - ${plant.plant_variant}`}>
                              {getPlantEmoji(plant.plant_type, plant.plant_variant)}
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