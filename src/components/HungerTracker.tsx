import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, differenceInSeconds } from 'date-fns';
import { History, BarChart3, Skull, ThumbsUpIcon } from 'lucide-react';
import type { HungerRecord } from '../lib/supabase';
import type { ChartData, ChartOptions, Point, TooltipItem } from 'chart.js';

const HungerTracker: React.FC = () => {
  const [isHungry, setIsHungry] = useState(false);
  const [currentSession, setCurrentSession] = useState<{
    id: string;
    startTime: Date;
  } | null>(null);
  const [records, setRecords] = useState<HungerRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
    checkForActiveSession();
  }, []);

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
    } catch (error) {
      console.error('Error stopping hunger session:', error);
    }
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-purple-600">Funger</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Logout
        </button>
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
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-full text-lg font-medium transition-colors shadow-md"
              >
                <Skull size={24} />
                I'm Hungry
              </button>
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
    </div>
  );
};

const HungerGraph: React.FC<{ records: HungerRecord[] }> = ({ records }) => {
  const [chartData, setChartData] = useState<ChartData<'line', Point[], unknown> | null>(null);

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
  }, [records]);

  // Define Point interface matching Chart.js Point
  interface DataPoint {
    x: Date | string | number;  // Support Date objects directly
    y: number;
  }

  const processDataForChart = (records: HungerRecord[]) => {
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
  };

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