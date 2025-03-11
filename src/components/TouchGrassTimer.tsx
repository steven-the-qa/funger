import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Timer, Flower, X } from 'lucide-react';

interface TouchGrassTimerProps {
  userId: string;
  onSessionCompleted: () => void;
}

const TouchGrassTimer: React.FC<TouchGrassTimerProps> = ({ userId, onSessionCompleted }) => {
  const [activeSession, setActiveSession] = useState<{ id: string; startTime: Date } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Check for any active sessions on component mount
  useEffect(() => {
    checkForActiveSession();
  }, []);

  const completeSession = useCallback(async (sessionId?: string) => {
    const id = sessionId || (activeSession?.id);
    if (!id) return;

    try {
      const { error } = await supabase
        .from('grass_sessions')
        .update({
          end_time: new Date().toISOString(),
          completed: true,
        })
        .eq('id', id);

      if (error) throw error;

      setIsCompleted(true);
      setShowCelebration(true);
      
      // Show celebration for 3 seconds, then reset
      setTimeout(() => {
        setShowCelebration(false);
        setActiveSession(null);
        setTimeRemaining(null);
        onSessionCompleted();
      }, 3000);
    } catch (error) {
      console.error('Error completing touch grass session:', error);
    }
  }, [activeSession, onSessionCompleted]);

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

  const checkForActiveSession = async () => {
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
        if (remainingSeconds === 0) {
          completeSession(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error checking for active session:', error);
    }
  };

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

  const Celebration = () => (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="text-center">
        <div className="text-7xl animate-bounce mb-2">🌼</div>
        <div className="bg-green-600 text-white px-4 py-2 rounded-full text-lg font-bold animate-pulse">
          You earned a flower!
        </div>
      </div>
    </div>
  );

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
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-lg font-medium text-gray-700">Need a screen break?</p>
              <p className="text-sm text-gray-500">
                Start a 30-minute "Touch Grass" session and earn a flower for your garden!
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