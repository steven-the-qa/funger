import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface GardenOrnament {
  id: string;
  ornament_type: string;
  position_x: number;
  position_y: number;
}

// Define garden ornament types with their emojis
export const GARDEN_ORNAMENTS = [
  { type: 'flamingo', emoji: '🦩', name: 'Pink Flamingo' },
  { type: 'rock', emoji: '🪨', name: 'Garden Rock' },
  { type: 'gnome', emoji: '🧙‍♂️', name: 'Garden Gnome' },
  { type: 'mushroom', emoji: '🍄', name: 'Decorative Mushroom' },
  { type: 'birdbath', emoji: '🐦', name: 'Bird Bath' },
];

export const getOrnamentDetails = (type: string) => {
  return GARDEN_ORNAMENTS.find(o => o.type === type) || { type, emoji: '❓', name: 'Unknown Ornament' };
};

export const useOrnaments = (userId: string, isEnabled: boolean = true) => {
  const [ornaments, setOrnaments] = useState<GardenOrnament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrnaments = useCallback(async () => {
    if (!userId || !isEnabled) return;

    try {
      setLoading(true);
      setError(null);

      // Try to fetch ornaments, handling the case where the table might not exist yet
      const { data, error } = await supabase
        .from('garden_ornaments')
        .select('*')
        .eq('user_id', userId);

      // If there's a PostgreSQL error, it might mean the table doesn't exist yet
      if (error && error.code !== 'PGRST116') {
        console.log('Ornaments table might not exist yet, or there was an error:', error);
        setOrnaments([]);
      } else {
        setOrnaments(data || []);
      }
    } catch (err) {
      console.error('Error fetching garden ornaments:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching ornaments'));
      setOrnaments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, isEnabled]);

  // Fetch ornaments when the component mounts or userId changes
  useEffect(() => {
    fetchOrnaments();
  }, [fetchOrnaments]);

  return {
    ornaments,
    loading,
    error,
    refetch: fetchOrnaments,
    getOrnamentEmoji: (type: string) => getOrnamentDetails(type).emoji,
    getOrnamentName: (type: string) => getOrnamentDetails(type).name,
  };
}; 