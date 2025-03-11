import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, differenceInSeconds } from 'date-fns';
import { History, BarChart3, Skull, ThumbsUpIcon, Cookie } from 'lucide-react';
import LoadingScreen from './LoadingScreen';
import CookieJar from './CookieJar';
import TouchGrassTimer from './TouchGrassTimer';
import Garden from './Garden';
import type { HungerRecord } from '../lib/supabase';
import type { ChartData, ChartOptions, Point, TooltipItem } from 'chart.js';

interface HungerTrackerProps {
  onLogout: () => Promise<void>;
}

const HungerTracker: React.FC<HungerTrackerProps> = ({ onLogout }) => {
  const [isHungry, setIsHungry] = useState(false);
  const [currentSession, setCurrentSession] = useState<{
    id: string;
    startTime: Date;
  } | null>(null);
  const [records, setRecords] = useState<HungerRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cookieCount, setCookieCount] = useState(0);
  const [showCookieJar, setShowCookieJar] = useState(false);
  const [showCookieAnimation, setShowCookieAnimation] = useState(false);
  const [earnedCookieType, setEarnedCookieType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCooldown, setIsCooldown] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGarden, setShowGarden] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchRecords();
    checkForActiveSession();
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      
      // Get cookie stats for the user
      const { data: statsData } = await supabase
        .from('user_cookie_stats')
        .select('total_cookies')
        .eq('user_id', user.id)
        .single();
      
      if (statsData) {
        setCookieCount(statsData.total_cookies);
      }
    }
  };

  const checkForActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('hunger_records')
        .select('*')
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setIsHungry(true);
        setCurrentSession({
          id: data[0].id,
          startTime: new Date(data[0].start_time),
        });
      }
    } catch (error) {
      console.error('Error checking for active session:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('hunger_records')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;

      if (data) {
        setRecords(data as HungerRecord[]);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    }
  };

  const startHunger = async () => {
    try {
      const startTime = new Date();
      
      const { data, error } = await supabase
        .from('hunger_records')
        .insert([
          {
            start_time: startTime.toISOString(),
            user_id: (await supabase.auth.getUser()).data.user?.id,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setIsHungry(true);
        setCurrentSession({
          id: data[0].id,
          startTime,
        });
        await fetchRecords();
      }
    } catch (error) {
      console.error('Error starting hunger session:', error);
    }
  };

  const stopHunger = async () => {
    if (!currentSession) return;

    try {
      const endTime = new Date();
      const durationSeconds = differenceInSeconds(
        endTime,
        currentSession.startTime
      );

      const { error } = await supabase
        .from('hunger_records')
        .update({
          end_time: endTime.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      setIsHungry(false);
      setCurrentSession(null);
      await fetchRecords();
      
      // No longer automatically awarding cookies
    } catch (error) {
      console.error('Error stopping hunger session:', error);
    }
  };

  // Function to earn a cookie manually (no hunger record required)
  const earnCookieManually = async () => {
    if (!userId || isCooldown) return;
    
    try {
      setIsCooldown(true);
      
      // Determine cookie type based on rarity
      const cookieType = determineCookieType();
      
      // First create a placeholder record for this cookie
      const { data: placeholderData, error: placeholderError } = await supabase
        .from('hunger_records')
        .insert([
          {
            user_id: userId,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            duration_seconds: 0,
          }
        ])
        .select();
        
      if (placeholderError) throw placeholderError;
      
      if (placeholderData && placeholderData.length > 0) {
        const placeholderId = placeholderData[0].id;
        
        // Add cookie to rewards table
        const { error: cookieError } = await supabase
          .from('cookie_rewards')
          .insert([
            {
              user_id: userId,
              hunger_record_id: placeholderId,
              cookie_type: cookieType,
              milestone: 'manual',
              streak_count: 1, // Will be updated by trigger
            },
          ]);
  
        if (cookieError) throw cookieError;
  
        // Update user stats (use upsert to handle first cookie)
        const { error: statsError } = await supabase
          .from('user_cookie_stats')
          .upsert(
            {
              user_id: userId,
              total_cookies: cookieCount + 1,
              // Other fields will be handled by database trigger
            },
            { onConflict: 'user_id' }
          );
  
        if (statsError) throw statsError;
        
        // Show animation and update count
        setCookieCount(prevCount => prevCount + 1);
        setEarnedCookieType(cookieType);
        setShowCookieAnimation(true);
        setShowConfetti(true);
  
        // Hide animation after 3 seconds
        setTimeout(() => {
          setShowCookieAnimation(false);
          setEarnedCookieType(null);
          setShowConfetti(false);
        }, 3000);
        
        // Set a cooldown for the manual cookie button (15 seconds)
        setTimeout(() => {
          setIsCooldown(false);
        }, 15000);
      }
    } catch (error) {
      console.error('Error earning manual cookie:', error);
      setIsCooldown(false);
    }
  };

  const determineCookieType = () => {
    const random = Math.random();
    let cumulativeProbability = 0;
    
    // This is a rough implementation - in a real app, we'd import the COOKIE_RARITIES
    const rarities = {
      chocolate_chip: 0.7,
      sugar: 0.2,
      rainbow: 0.08,
      golden: 0.02,
      special: 0
    };
    
    for (const [type, probability] of Object.entries(rarities)) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) {
        return type;
      }
    }
    
    return 'chocolate_chip'; // Default fallback
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return 'In progress';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${remainingSeconds} sec`;
    }
    
    return `${minutes} min ${remainingSeconds} sec`;
  };

  const handleGrassSessionCompleted = () => {
    // Just a placeholder for now - we could refresh garden data here if needed
    console.log('Grass session completed!');
  };

  if (loading) {
    return <LoadingScreen message="Loading your hunger data..." />;
  }

  // Cookie animation component
  const CookieAnimation = () => {
    const cookieEmojis: Record<string, string> = {
      chocolate_chip: '🍪',
      sugar: '🥮',
      rainbow: '🌈🍪',
      golden: '✨🍪✨',
      special: '🏆🍪'
    };

    const emoji = earnedCookieType ? cookieEmojis[earnedCookieType] : '🍪';
    
    return (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
        <div className="text-center">
          <div className="text-7xl animate-bounce mb-2">{emoji}</div>
          <div className="bg-purple-600 text-white px-4 py-2 rounded-full text-lg font-bold animate-pulse">
            Cookie Earned!
          </div>
        </div>
      </div>
    );
  };

  // Confetti Animation Component
  const Confetti = () => {
    // Create an array of 50 confetti pieces
    const pieces = Array.from({ length: 50 }).map((_, i) => {
      const size = Math.random() * 10 + 5; // 5-15px
      const left = Math.random() * 100; // 0-100%
      const animationDuration = Math.random() * 3 + 2; // 2-5s
      const animationDelay = Math.random() * 0.5; // 0-0.5s
      const color = [
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
        '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
        '#009688', '#4caf50', '#8bc34a', '#cddc39', 
        '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
      ][Math.floor(Math.random() * 16)];
      
      return (
        <div 
          key={i}
          className="absolute top-0 rounded"
          style={{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            transform: 'rotate(45deg)',
            animation: `confetti-fall ${animationDuration}s ease-in forwards`,
            animationDelay: `${animationDelay}s`,
            opacity: 0.8,
          }}
        />
      );
    });
    
    return (
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        <style>
          {`
            @keyframes confetti-fall {
              0% {
                transform: translateY(-10vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }
          `}
        </style>
        {pieces}
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-purple-600">Funger</h1>
        <div className="flex items-center">
          <button
            onClick={() => setShowCookieJar(true)}
            className="flex items-center mr-4 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-full"
          >
            <span className="mr-1 text-lg">🍪</span> {cookieCount}
          </button>
          <button
            onClick={() => setShowGarden(true)}
            className="flex items-center mr-4 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-full"
          >
            <span className="mr-1 text-lg">🌼</span> Garden
          </button>
          <button
            onClick={onLogout}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col items-center">
          {isHungry ? (
            <>
              <div className="text-center mb-4">
                <p className="text-lg font-medium text-gray-700">You're currently hungry!</p>
                <p className="text-sm text-gray-500">
                  Started at {currentSession && format(currentSession.startTime, 'h:mm a')}
                </p>
              </div>
              <button
                onClick={stopHunger}
                className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-full text-lg font-medium transition-colors shadow-md"
              >
                <ThumbsUpIcon size={24} />
                I'm OK Now
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-lg font-medium text-gray-700">Track your hunger</p>
                <p className="text-sm text-gray-500">Tap when you start feeling hungry</p>
              </div>
              <button
                onClick={startHunger}
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-full text-lg font-medium transition-colors shadow-md mb-6"
              >
                <Skull size={24} />
                I'm Hungry
              </button>
              
              {/* Manual Cookie Button */}
              <div className="w-full border-t border-gray-200 pt-6 text-center">
                <p className="text-sm text-gray-500 mb-3">Beat a craving recently? Have a cookie!</p>
                <button
                  onClick={earnCookieManually}
                  disabled={isCooldown}
                  className={`flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-md ${
                    isCooldown 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                  }`}
                >
                  <Cookie size={18} />
                  {isCooldown ? 'Baking...' : 'Yes, I deserve it!'}
                </button>
                {isCooldown && (
                  <p className="text-xs text-gray-500 mt-1">The oven needs 15 seconds to bake the next batch</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between mb-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1 px-4 py-2 rounded-md ${
            showHistory ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          <History size={18} />
          {showHistory ? 'Hide History' : 'Show History'}
        </button>
        <button
          onClick={() => setShowHistory(false)}
          className={`flex items-center gap-1 px-4 py-2 rounded-md ${
            !showHistory ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          <BarChart3 size={18} />
          Show Graph
        </button>
      </div>

      {showHistory ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 bg-purple-50 border-b border-purple-100">
            <h2 className="font-medium text-purple-700">Recent Hunger Sessions</h2>
          </div>
          {records.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No hunger sessions recorded yet
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {records.map((record) => (
                <li key={record.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">
                        {format(new Date(record.start_time), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(record.start_time), 'h:mm a')} - 
                        {record.end_time 
                          ? format(new Date(record.end_time), ' h:mm a') 
                          : ' In progress'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-purple-600">
                        {formatDuration(record.duration_seconds)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-4">
          <HungerGraph records={records} />
        </div>
      )}

      {/* Cookie jar modal */}
      {showCookieJar && userId && (
        <CookieJar 
          userId={userId} 
          isOpen={showCookieJar} 
          onClose={() => setShowCookieJar(false)} 
        />
      )}

      {/* Cookie earning animation */}
      {showCookieAnimation && <CookieAnimation />}
      
      {/* Confetti animation */}
      {showConfetti && <Confetti />}

      <TouchGrassTimer 
        userId={userId || ''} 
        onSessionCompleted={handleGrassSessionCompleted} 
      />

      {/* Garden modal */}
      {showGarden && userId && (
        <Garden 
          userId={userId} 
          isOpen={showGarden} 
          onClose={() => setShowGarden(false)} 
        />
      )}
    </div>
  );
};

const HungerGraph: React.FC<{ records: HungerRecord[] }> = ({ records }) => {
  const [chartData, setChartData] = useState<ChartData<'line', Point[], unknown> | null>(null);

  // Define Point interface matching Chart.js Point
  interface DataPoint {
    x: Date | string | number;  // Support Date objects directly
    y: number;
  }

  const processDataForChart = useCallback((records: HungerRecord[]) => {
    // Only include completed records
    const completedRecords = records
      .filter((record) => record.end_time && record.duration_seconds)
      // Sort by date ascending to show chronological progress
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    if (completedRecords.length === 0) {
      return null;
    }

    // Prepare data for individual points and trend line
    const dataPoints = completedRecords.map(record => ({
      x: new Date(record.start_time),  // Use Date object directly
      y: Math.round((record.duration_seconds || 0) / 60) // Convert to minutes
    }));

    // Calculate the rolling average for the trend line
    const calculateMovingAverage = (data: DataPoint[], windowSize: number) => {
      return data.map((point, index) => {
        const window = data.slice(Math.max(0, index - windowSize + 1), index + 1);
        const sum = window.reduce((acc, curr) => acc + curr.y, 0);
        return {
          x: point.x,
          y: Math.round(sum / window.length)
        };
      });
    };

    // Use a window size appropriate for the data volume
    const windowSize = Math.max(3, Math.ceil(completedRecords.length / 10));
    const trendLine = calculateMovingAverage(dataPoints, windowSize);

    return {
      datasets: [
        {
          label: 'Individual Sessions (minutes)',
          data: dataPoints,
          borderColor: 'rgba(147, 51, 234, 0.5)',
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          pointRadius: 5,
          pointHoverRadius: 7,
          showLine: false,
          order: 2,
        },
        {
          label: 'Average Trend',
          data: trendLine,
          borderColor: 'rgb(147, 51, 234)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          order: 1,
        },
      ],
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Import and register all required Chart.js components
      Promise.all([
        import('chart.js/auto'),
        import('chartjs-adapter-date-fns'), // Add date adapter
        import('react-chartjs-2')
      ]).then(([, , ]) => {
        // Process data for chart
        const processedData = processDataForChart(records);
        setChartData(processedData as ChartData<'line', Point[], unknown>);
      });
    }
  }, [records, processDataForChart]);

  // Check for empty completed records first
  if (records.filter(r => r.end_time).length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 p-6 text-center">
        <div className="text-4xl mb-3">🍽️</div>
        <h3 className="text-purple-600 font-medium text-lg mb-2">Hungry for Some Data?</h3>
        <p className="text-gray-600">Your chart is feeling a bit empty! Press "I'm Hungry" when those cravings hit, and we'll cook up some delicious insights for you.</p>
        <p className="mt-2 text-sm text-purple-500">The more hunger sessions you track, the more patterns we can reveal!</p>
      </div>
    );
  }
  
  // Then check if chart data is still loading
  if (!chartData) {
    return (
      <div className="flex flex-col justify-center items-center h-64 p-6 text-center">
        <div className="text-4xl mb-3 animate-bounce">🔄</div>
        <h3 className="text-purple-600 font-medium text-lg mb-2">Cooking Up Your Chart...</h3>
        <p className="text-gray-600">We're stirring the data pot and preparing your hunger insights.</p>
        <div className="mt-4">
          <div className="w-16 h-1 bg-purple-200 rounded-full overflow-hidden">
            <div className="w-full h-full bg-purple-600 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Using dynamic import for React components
  const DynamicLine = React.lazy(() => 
    import('react-chartjs-2').then(module => ({ default: module.Line }))
  );

  return (
    <div>
      <h2 className="font-medium text-purple-700 mb-4">Hunger Duration Trends</h2>
      <div className="h-64">
        <React.Suspense fallback={<div>Loading chart...</div>}>
          <DynamicLine 
            data={chartData as ChartData<'line', Point[], unknown>} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  type: 'time',
                  time: {
                    unit: 'day',
                    tooltipFormat: 'MMM d, yyyy h:mm a',
                    displayFormats: {
                      day: 'MMM d'
                    }
                  },
                  title: {
                    display: true,
                    text: 'Date'
                  }
                },
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Minutes'
                  }
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: function(context: TooltipItem<'line'>) {
                      return `Duration: ${context.parsed.y} minutes`;
                    }
                  }
                },
                legend: {
                  position: 'top',
                }
              }
            } as ChartOptions<'line'>} 
          />
        </React.Suspense>
      </div>
    </div>
  );
};

export default HungerTracker;