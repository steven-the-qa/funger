import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Timer, Flower, X } from 'lucide-react';

interface TouchGrassTimerProps {
  userId: string;
  onSessionCompleted: () => void;
}

// Define garden ornament types
const GARDEN_ORNAMENTS = [
  { type: 'flamingo', emoji: '🦩' },
  { type: 'rock', emoji: '🪨' },
  { type: 'gnome', emoji: '🧙‍♂️' },
  { type: 'mushroom', emoji: '🍄' },
  { type: 'birdbath', emoji: '🐦' },
];

const TouchGrassTimer: React.FC<TouchGrassTimerProps> = ({ userId, onSessionCompleted }) => {
  const [activeSession, setActiveSession] = useState<{ id: string; startTime: Date } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [rewardType, setRewardType] = useState<'flower' | 'ornament' | null>(null);
  const [ornamentType, setOrnamentType] = useState<string | null>(null);
  
  // Use useRef to break the circular dependency
  const completeSessionRef = useRef<(sessionId?: string) => Promise<void>>();

  const completeSession = useCallback(async (sessionId?: string) => {
    const id = sessionId || (activeSession?.id);
    if (!id) return;

    try {
      // Update the session to completed
      const { error } = await supabase
        .from('grass_sessions')
        .update({
          end_time: new Date().toISOString(),
          completed: true,
        })
        .eq('id', id);

      if (error) throw error;

      // Check if the ornaments feature is enabled by checking if the table exists
      let ornamentFeatureEnabled = false;
      try {
        // Use a simple query that will fail with a specific error if the table doesn't exist
        await supabase.rpc('check_if_table_exists', { table_name: 'garden_ornaments' });
        ornamentFeatureEnabled = true;
      } catch (_) {
        console.log('Garden ornaments feature is not enabled yet');
        ornamentFeatureEnabled = false;
      }

      // Determine reward type (the actual determination happens in the DB trigger)
      // We'll simulate it here but the real result will be in the garden stats
      const random = Math.random();
      const isOrnament = ornamentFeatureEnabled && random < 0.2; // 20% chance for ornament only if feature is enabled
      
      setRewardType(isOrnament ? 'ornament' : 'flower');
      
      // If it's an ornament AND the feature is enabled, select a random one from our list
      if (isOrnament) {
        const randomOrnamentIndex = Math.floor(Math.random() * GARDEN_ORNAMENTS.length);
        const selectedOrnament = GARDEN_ORNAMENTS[randomOrnamentIndex];
        setOrnamentType(selectedOrnament.type);
        
        // Only attempt to add an ornament if the feature is enabled
        if (ornamentFeatureEnabled) {
          // Find empty position in the garden - safely handling potential missing tables
          let gardenItems: Array<{position_x: number, position_y: number}> = [];
          let gardenOrnaments: Array<{position_x: number, position_y: number}> = [];
          
          try {
            const { data: items } = await supabase
              .from('garden_items')
              .select('position_x, position_y')
              .eq('user_id', userId);
            gardenItems = items || [];
          } catch (_) {
            console.log('Could not fetch garden items, continuing with empty array');
          }
            
          try {
            const { data: ornaments } = await supabase
              .from('garden_ornaments')
              .select('position_x, position_y')
              .eq('user_id', userId);
            gardenOrnaments = ornaments || [];
          } catch (_) {
            console.log('Could not fetch garden ornaments, continuing with empty array');
          }
          
          // Combine all occupied positions
          const occupiedPositions = new Set();
          
          gardenItems.forEach(item => {
            occupiedPositions.add(`${item.position_x},${item.position_y}`);
          });
          
          gardenOrnaments.forEach(item => {
            occupiedPositions.add(`${item.position_x},${item.position_y}`);
          });
          
          // Find first empty position
          const GRID_SIZE = 5;
          let position_x = -1;
          let position_y = -1;
          
          outerLoop:
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              if (!occupiedPositions.has(`${x},${y}`)) {
                position_x = x;
                position_y = y;
                break outerLoop;
              }
            }
          }
          
          // If we found a position, add the ornament
          if (position_x !== -1 && position_y !== -1) {
            // Try to add the ornament, but if it fails (table doesn't exist yet), don't break the flow
            try {
              await supabase
                .from('garden_ornaments')
                .insert([{
                  user_id: userId,
                  ornament_type: selectedOrnament.type,
                  position_x,
                  position_y
                }]);
            } catch (_) {
              // Silently catch errors when the ornament feature is not fully enabled yet
              console.log('Ornament feature not fully enabled yet, skipping ornament creation');
              // The user will still see the celebration for an ornament, but it won't be added to the DB
              // This allows for a smoother rollout of the feature
            }
          }
        }
      }

      setIsCompleted(true);
      setShowCelebration(true);
      
      // Show celebration for 3 seconds, then reset
      setTimeout(() => {
        setShowCelebration(false);
        setActiveSession(null);
        setTimeRemaining(null);
        setRewardType(null);
        setOrnamentType(null);
        onSessionCompleted();
      }, 3000);
    } catch (error) {
      console.error('Error completing touch grass session:', error);
    }
  }, [activeSession, onSessionCompleted, userId]);
  
  // Update the ref whenever completeSession changes
  useEffect(() => {
    completeSessionRef.current = completeSession;
  }, [completeSession]);

  const checkForActiveSession = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('grass_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('end_time', null)
        .eq('completed', false)
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setActiveSession({
          id: data[0].id,
          startTime: new Date(data[0].start_time),
        });
        
        // Calculate remaining time for existing session
        const elapsedSeconds = Math.floor((Date.now() - new Date(data[0].start_time).getTime()) / 1000);
        const remainingSeconds = Math.max(0, 30 * 60 - elapsedSeconds);
        setTimeRemaining(remainingSeconds);
        
        // If the session should already be complete (browser was closed etc.)
        if (remainingSeconds === 0 && completeSessionRef.current) {
          completeSessionRef.current(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error checking for active session:', error);
    }
  }, [userId]); // Remove completeSession from dependencies

  // Check for any active sessions on component mount
  useEffect(() => {
    checkForActiveSession();
  }, [checkForActiveSession]);

  // Timer countdown effect
  useEffect(() => {
    if (!activeSession) return;

    const intervalId = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - activeSession.startTime.getTime()) / 1000);
      const remainingSeconds = Math.max(0, 30 * 60 - elapsedSeconds);
      
      setTimeRemaining(remainingSeconds);
      
      // Check if timer is complete
      if (remainingSeconds === 0 && !isCompleted) {
        completeSession();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSession, isCompleted, completeSession]);

  const startSession = async () => {
    if (isStarting || activeSession) return;
    
    try {
      setIsStarting(true);
      const startTime = new Date();
      
      setTimeRemaining(30 * 60);
      
      const { data, error } = await supabase
        .from('grass_sessions')
        .insert([
          {
            user_id: userId,
            start_time: startTime.toISOString(),
            completed: false,
            duration_minutes: 30
          },
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setActiveSession({
          id: data[0].id,
          startTime,
        });
        setIsCompleted(false);
      }
    } catch (error) {
      console.error('Error starting touch grass session:', error);
      setTimeRemaining(null);
    } finally {
      setIsStarting(false);
    }
  };

  const cancelSession = async () => {
    if (!activeSession) return;

    try {
      const { error } = await supabase
        .from('grass_sessions')
        .update({
          end_time: new Date().toISOString(),
          completed: false,
        })
        .eq('id', activeSession.id);

      if (error) throw error;

      setActiveSession(null);
      setTimeRemaining(null);
    } catch (error) {
      console.error('Error canceling touch grass session:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const Celebration = () => {
    let emoji = '🌼'; // Default flower emoji
    let message = 'You earned a flower!';
    
    if (rewardType === 'ornament' && ornamentType) {
      const ornament = GARDEN_ORNAMENTS.find(o => o.type === ornamentType);
      emoji = ornament?.emoji || '🏆';
      message = `You found a garden ${ornamentType}!`;
    }
    
    return (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
        <div className="text-center">
          <div className="text-7xl animate-bounce mb-2">{emoji}</div>
          <div className="bg-green-600 text-white px-4 py-2 rounded-full text-lg font-bold animate-pulse">
            {message}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-green-600 mb-4 flex items-center">
        <Flower className="mr-2" /> Touch Grass Challenge
      </h2>
      
      {showCelebration && <Celebration />}
      
      <div className="flex flex-col items-center">
        {activeSession || timeRemaining ? (
          <>
            <div className="text-center mb-4">
              <p className="text-lg font-medium text-gray-700">Time to touch some grass!</p>
              <p className="text-sm text-gray-500">
                Get away from screens for a while.
              </p>
              
              <div className="mt-4 bg-green-50 rounded-full px-6 py-3 flex items-center justify-center">
                <Timer className="text-green-600 mr-2" />
                <span className="text-2xl font-bold text-green-600">
                  {timeRemaining !== null ? formatTime(timeRemaining) : "30:00"}
                </span>
              </div>
            </div>
            
            <button
              onClick={cancelSession}
              className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 py-2 px-4 rounded-md text-sm font-medium transition-colors mt-4"
            >
              <X size={18} />
              Cancel Session
            </button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Stepping away from screens for 30 minutes helps reset your focus and reduce eye strain.
              {timeRemaining && timeRemaining < 30 * 60 && (
                <span className="block mt-1 font-medium">
                  Don't end this session early - your garden needs you to complete the full time!
                </span>
              )}
              <span className="block mt-1">Complete the session to earn a flower or maybe even a special garden ornament (20% chance)!</span>
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-lg font-medium text-gray-700">Need a screen break?</p>
              <p className="text-sm text-gray-500">
                Start a 30-minute "Touch Grass" session and earn a flower for your garden! You might even find a special ornament (20% chance).
              </p>
            </div>
            <button
              onClick={startSession}
              disabled={isStarting}
              className={`flex items-center justify-center gap-2 ${
                isStarting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white py-3 px-6 rounded-full text-lg font-medium transition-colors shadow-md`}
            >
              {isStarting ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Timer size={24} />
                  Start 30-Min Break
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TouchGrassTimer;