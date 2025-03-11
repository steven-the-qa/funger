import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { supabase, CookieReward, UserCookieStats, COOKIE_ACHIEVEMENTS } from '../lib/supabase';
import { Trophy, BarChart, Share2, Download, Cookie } from 'lucide-react';
import type { ChartData, ChartOptions } from 'chart.js';
import html2canvas from 'html2canvas';

interface CookieJarProps {
  userId: string;
  onClose: () => void;
  isOpen: boolean;
}

// Cookie emoji mapping
const COOKIE_EMOJIS: Record<string, string> = {
  chocolate_chip: '🍪',
  sugar: '🥮',
  rainbow: '🌈🍪',
  golden: '✨🍪✨',
  special: '🏆🍪'
};

const CookieJar: React.FC<CookieJarProps> = ({ userId, onClose, isOpen }) => {
  const [cookies, setCookies] = useState<CookieReward[]>([]);
  const [stats, setStats] = useState<UserCookieStats | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGraph, setShowGraph] = useState(false);
  const [chartData, setChartData] = useState<ChartData<'line'> | null>(null);

  // New state for sharing feature
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const loadCookieData = useCallback(async () => {
    setLoading(true);
    try {
      // Load user's cookies
      const { data: cookieData, error: cookieError } = await supabase
        .from('cookie_rewards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (cookieError) throw cookieError;
      setCookies(cookieData || []);

      // Prepare data for the cookie growth chart
      if (cookieData && cookieData.length > 0) {
        prepareChartData(cookieData);
      }

      // Load user's cookie stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_cookie_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (statsError && statsError.code !== 'PGRST116') throw statsError;
      setStats(statsData || {
        user_id: userId,
        total_cookies: 0,
        current_streak: 0,
        longest_streak: 0,
        last_cookie_date: null
      });

      // Check which achievements have been unlocked
      const unlockedAchievements = COOKIE_ACHIEVEMENTS
        .filter(achievement => {
          if (achievement.isStreak) {
            return (statsData?.current_streak || 0) >= achievement.requirement;
          }
          return (statsData?.total_cookies || 0) >= achievement.requirement;
        })
        .map(a => a.id);
      
      setAchievements(unlockedAchievements);
    } catch (error) {
      console.error('Error loading cookie data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadCookieData();
    }
  }, [isOpen, loadCookieData]);

  const prepareChartData = (cookieData: CookieReward[]) => {
    // Sort cookies by creation date (ascending)
    const sortedCookies = [...cookieData].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Create cumulative count data
    let cookieCount = 0;
    const cumulativeData: Array<{ x: number; y: number }> = sortedCookies.map(cookie => {
      cookieCount++;
      return {
        x: new Date(cookie.created_at).getTime(), // Convert to timestamp for Chart.js
        y: cookieCount
      };
    });

    // Add data point for today if last cookie isn't from today
    const today = new Date();
    const lastCookieDate = sortedCookies.length > 0 
      ? new Date(sortedCookies[sortedCookies.length - 1].created_at) 
      : null;
    
    if (lastCookieDate && 
        (lastCookieDate.getDate() !== today.getDate() || 
         lastCookieDate.getMonth() !== today.getMonth() || 
         lastCookieDate.getFullYear() !== today.getFullYear())) {
      cumulativeData.push({
        x: today.getTime(),
        y: cookieCount
      });
    }

    // Create count by type
    const cookiesByType: Record<string, number[]> = {};
    const dateLabels: number[] = []; // Timestamps
    
    const runningCounts: Record<string, number> = {
      chocolate_chip: 0,
      sugar: 0,
      rainbow: 0,
      golden: 0,
      special: 0
    };
    
    // Process each cookie to build up cumulative counts by type
    sortedCookies.forEach(cookie => {
      const timestamp = new Date(cookie.created_at).getTime();
      dateLabels.push(timestamp);
      
      // Increment the count for this cookie type
      runningCounts[cookie.cookie_type]++;
      
      // Store current counts for all types
      Object.keys(runningCounts).forEach(type => {
        if (!cookiesByType[type]) {
          cookiesByType[type] = [];
        }
        cookiesByType[type].push(runningCounts[type]);
      });
    });

    // Create chart data
    setChartData({
      datasets: [
        {
          label: 'Total Cookies',
          data: cumulativeData,
          borderColor: 'rgb(128, 90, 213)',
          backgroundColor: 'rgba(128, 90, 213, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
        // Optional: add datasets for each cookie type if we want
      ],
    });
  };

  const cookieCounts = cookies.reduce((acc, cookie) => {
    acc[cookie.cookie_type] = (acc[cookie.cookie_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Redesigned sharing functionality to focus on achievements
  const handleShare = async () => {
    try {
      setIsSharing(true);
      
      // Create a dedicated share card rather than using the ref
      const shareCard = document.createElement('div');
      shareCard.style.width = '600px';
      shareCard.style.padding = '24px';
      shareCard.style.backgroundColor = '#FFF8ED';
      shareCard.style.borderRadius = '16px';
      shareCard.style.fontFamily = 'Arial, sans-serif';
      shareCard.style.boxSizing = 'border-box';
      
      // Add app branding
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.marginBottom = '16px';
      
      const title = document.createElement('h2');
      title.textContent = 'Funger - Cookie Collection';
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.color = '#9333EA'; // purple-600
      title.style.margin = '0';
      
      const cookieEmoji = document.createElement('span');
      cookieEmoji.textContent = '🍪';
      cookieEmoji.style.fontSize = '32px';
      cookieEmoji.style.marginRight = '12px';
      
      header.appendChild(cookieEmoji);
      header.appendChild(title);
      shareCard.appendChild(header);
      
      // Add metrics section
      const metricsContainer = document.createElement('div');
      metricsContainer.style.display = 'grid';
      metricsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
      metricsContainer.style.gap = '16px';
      metricsContainer.style.margin = '24px 0';
      metricsContainer.style.padding = '16px';
      metricsContainer.style.backgroundColor = '#F5F3FF'; // purple-50
      metricsContainer.style.borderRadius = '8px';
      
      // Add total cookies
      const totalCookiesCard = document.createElement('div');
      totalCookiesCard.style.textAlign = 'center';
      
      const totalCookiesLabel = document.createElement('p');
      totalCookiesLabel.textContent = 'Total Cookies';
      totalCookiesLabel.style.fontSize = '14px';
      totalCookiesLabel.style.color = '#7E22CE'; // purple-700
      totalCookiesLabel.style.margin = '0 0 4px 0';
      
      const totalCookiesValue = document.createElement('p');
      totalCookiesValue.textContent = String(stats?.total_cookies || 0);
      totalCookiesValue.style.fontSize = '28px';
      totalCookiesValue.style.fontWeight = 'bold';
      totalCookiesValue.style.color = '#9333EA'; // purple-600
      totalCookiesValue.style.margin = '0';
      
      totalCookiesCard.appendChild(totalCookiesLabel);
      totalCookiesCard.appendChild(totalCookiesValue);
      metricsContainer.appendChild(totalCookiesCard);
      
      // Add current streak
      const currentStreakCard = document.createElement('div');
      currentStreakCard.style.textAlign = 'center';
      
      const currentStreakLabel = document.createElement('p');
      currentStreakLabel.textContent = 'Current Streak';
      currentStreakLabel.style.fontSize = '14px';
      currentStreakLabel.style.color = '#7E22CE'; // purple-700
      currentStreakLabel.style.margin = '0 0 4px 0';
      
      const currentStreakValue = document.createElement('p');
      currentStreakValue.textContent = `${stats?.current_streak || 0} 🔥`;
      currentStreakValue.style.fontSize = '28px';
      currentStreakValue.style.fontWeight = 'bold';
      currentStreakValue.style.color = '#9333EA'; // purple-600
      currentStreakValue.style.margin = '0';
      
      currentStreakCard.appendChild(currentStreakLabel);
      currentStreakCard.appendChild(currentStreakValue);
      metricsContainer.appendChild(currentStreakCard);
      
      // Add longest streak
      const longestStreakCard = document.createElement('div');
      longestStreakCard.style.textAlign = 'center';
      
      const longestStreakLabel = document.createElement('p');
      longestStreakLabel.textContent = 'Longest Streak';
      longestStreakLabel.style.fontSize = '14px';
      longestStreakLabel.style.color = '#7E22CE'; // purple-700
      longestStreakLabel.style.margin = '0 0 4px 0';
      
      const longestStreakValue = document.createElement('p');
      longestStreakValue.textContent = String(stats?.longest_streak || 0);
      longestStreakValue.style.fontSize = '28px';
      longestStreakValue.style.fontWeight = 'bold';
      longestStreakValue.style.color = '#9333EA'; // purple-600
      longestStreakValue.style.margin = '0';
      
      longestStreakCard.appendChild(longestStreakLabel);
      longestStreakCard.appendChild(longestStreakValue);
      metricsContainer.appendChild(longestStreakCard);
      
      shareCard.appendChild(metricsContainer);
      
      // Find most recent achievement
      const unlockedAchievements = COOKIE_ACHIEVEMENTS.filter(achievement => {
        if (achievement.isStreak) {
          return (stats?.longest_streak || 0) >= achievement.requirement;
        } else {
          return (stats?.total_cookies || 0) >= achievement.requirement;
        }
        return false;
      });
      
      // Sort by requirement (highest first) to get the most impressive achievement
      const mostImpressiveAchievement = [...unlockedAchievements].sort((a, b) => 
        b.requirement - a.requirement
      )[0];
      
      // Add achievement highlight
      if (mostImpressiveAchievement) {
        const achievementContainer = document.createElement('div');
        achievementContainer.style.backgroundColor = '#FFFBEB'; // amber-50
        achievementContainer.style.border = '2px solid #FCD34D'; // amber-300
        achievementContainer.style.borderRadius = '8px';
        achievementContainer.style.padding = '20px';
        achievementContainer.style.marginBottom = '24px';
        achievementContainer.style.display = 'flex';
        achievementContainer.style.alignItems = 'center';
        
        const achievementEmoji = document.createElement('div');
        achievementEmoji.textContent = '🏆';
        achievementEmoji.style.fontSize = '48px';
        achievementEmoji.style.marginRight = '16px';
        
        const achievementContent = document.createElement('div');
        
        const achievementTitle = document.createElement('h3');
        achievementTitle.textContent = mostImpressiveAchievement.name;
        achievementTitle.style.margin = '0 0 8px 0';
        achievementTitle.style.fontSize = '18px';
        achievementTitle.style.fontWeight = 'bold';
        achievementTitle.style.color = '#B45309'; // amber-700
        
        const achievementDesc = document.createElement('p');
        achievementDesc.textContent = mostImpressiveAchievement.description;
        achievementDesc.style.margin = '0';
        achievementDesc.style.fontSize = '14px';
        achievementDesc.style.color = '#92400E'; // amber-800
        
        achievementContent.appendChild(achievementTitle);
        achievementContent.appendChild(achievementDesc);
        
        achievementContainer.appendChild(achievementEmoji);
        achievementContainer.appendChild(achievementContent);
        
        shareCard.appendChild(achievementContainer);
      }
      
      // Add cookie gallery preview
      const cookieGallery = document.createElement('div');
      cookieGallery.style.marginTop = '20px';
      
      // Add header for cookies
      const cookiesHeader = document.createElement('h3');
      cookiesHeader.textContent = 'My Cookie Collection';
      cookiesHeader.style.margin = '0 0 12px 0';
      cookiesHeader.style.fontSize = '16px';
      cookiesHeader.style.fontWeight = '600';
      cookiesHeader.style.color = '#7E22CE'; // purple-700
      
      cookieGallery.appendChild(cookiesHeader);
      
      // Create cookie grid
      const cookieGrid = document.createElement('div');
      cookieGrid.style.display = 'grid';
      cookieGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
      cookieGrid.style.gap = '8px';
      
      // Get cookie counts by type
      const cookieCounts: Record<string, number> = {};
      cookies.forEach(cookie => {
        const type = cookie.cookie_type;
        cookieCounts[type] = (cookieCounts[type] || 0) + 1;
      });
      
      // Show one of each type, with count
      Object.entries(cookieCounts).forEach(([type, count]) => {
        if (count > 0) {
          const cookieItem = document.createElement('div');
          cookieItem.style.display = 'flex';
          cookieItem.style.flexDirection = 'column';
          cookieItem.style.alignItems = 'center';
          cookieItem.style.backgroundColor = '#FEF3C7'; // amber-100
          cookieItem.style.borderRadius = '8px';
          cookieItem.style.padding = '8px';
          
          const cookieEmoji = document.createElement('div');
          cookieEmoji.textContent = COOKIE_EMOJIS[type] || '🍪';
          cookieEmoji.style.fontSize = '24px';
          
          const cookieCount = document.createElement('div');
          cookieCount.textContent = `x${count}`;
          cookieCount.style.marginTop = '4px';
          cookieCount.style.fontSize = '12px';
          cookieCount.style.fontWeight = '600';
          cookieCount.style.color = '#B45309'; // amber-700
          
          cookieItem.appendChild(cookieEmoji);
          cookieItem.appendChild(cookieCount);
          cookieGrid.appendChild(cookieItem);
        }
      });
      
      cookieGallery.appendChild(cookieGrid);
      shareCard.appendChild(cookieGallery);
      
      // Add app link at bottom
      const footer = document.createElement('div');
      footer.style.marginTop = '16px';
      footer.style.textAlign = 'center';
      footer.style.fontSize = '12px';
      footer.style.color = '#6B7280'; // gray-500
      footer.textContent = 'Conquer your cravings, one cookie at a time! 🍪 funger.netlify.app';
      
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
    
    // Create a download link
    const link = document.createElement('a');
    link.href = shareUrl;
    link.download = 'my-cookie-jar.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  // Cookie growth chart component
  const CookieGrowthChart = () => {
    if (!chartData || chartData.datasets[0].data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-gray-500">Start earning cookies to see your growth!</p>
        </div>
      );
    }

    return (
      <Suspense fallback={<div className="p-8 text-center">Loading chart...</div>}>
        <div className="h-64 p-4">
          <DynamicLineChart data={chartData} />
        </div>
      </Suspense>
    );
  };

  // Dynamic import of Chart component
  const DynamicLineChart = ({ data }: { data: ChartData<'line'> }) => {
    // Use React.ComponentType for the Line component
    const [LineChart, setLineChart] = useState<React.ComponentType<{
      data: ChartData<'line'>;
      options: ChartOptions<'line'>;
    }> | null>(null);

    useEffect(() => {
      const loadChart = async () => {
        try {
          // Import Chart.js and the Line component
          await import('chart.js/auto');
          const { Line } = await import('react-chartjs-2');
          setLineChart(() => Line);
        } catch (error) {
          console.error('Error loading chart components:', error);
        }
      };

      loadChart();
    }, []);

    if (!LineChart) {
      return <div>Loading chart...</div>;
    }

    return (
      <LineChart 
        data={data} 
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                tooltipFormat: 'MMM d, yyyy',
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
                text: 'Cookies'
              },
              ticks: {
                precision: 0, // Only show integers
                stepSize: 1
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: function(context) {
                  const date = new Date(context[0].parsed.x);
                  return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                },
                label: function(context) {
                  return `Total Cookies: ${context.parsed.y}`;
                }
              }
            },
            legend: {
              display: false
            }
          },
          interaction: {
            mode: 'index',
            intersect: false,
          }
        } as ChartOptions<'line'>}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-purple-600 flex items-center">
              <Cookie className="mr-2" size={28} /> Cookie Jar
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center my-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Cookie Stats */}
              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-purple-700">Total Cookies</p>
                    <p className="text-2xl font-bold text-purple-600">{stats?.total_cookies || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-700">Current Streak</p>
                    <p className="text-2xl font-bold text-purple-600">{stats?.current_streak || 0} 🔥</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-700">Longest Streak</p>
                    <p className="text-2xl font-bold text-purple-600">{stats?.longest_streak || 0}</p>
                  </div>
                </div>
              </div>

              {/* Cookie Jar Growth Toggle */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-purple-700">Cookie Collection</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowGraph(!showGraph)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm ${
                      showGraph ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <BarChart size={16} />
                    {showGraph ? 'Hide Graph' : 'Show Growth'}
                  </button>
                  
                  <button
                    onClick={handleShare}
                    disabled={isSharing || cookies.length === 0}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm ${
                      isSharing || cookies.length === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                  >
                    <Share2 size={16} />
                    {isSharing ? 'Creating...' : 'Share'}
                  </button>
                </div>
              </div>

              {/* Share modal */}
              {shareUrl && (
                <div className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
                  <h3 className="font-medium text-gray-700 mb-2">Share Your Cookie Collection</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Save this image to share your cookie achievements!
                  </p>
                  <div className="mb-3 border border-gray-200 rounded-md overflow-hidden">
                    <img 
                      src={shareUrl} 
                      alt="Your cookie collection" 
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

              {/* Cookie Growth Chart */}
              {showGraph ? (
                <div className="bg-white border border-purple-100 rounded-lg p-2 mb-6">
                  <CookieGrowthChart />
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(COOKIE_EMOJIS).map(type => (
                      <div key={type} className="flex items-center">
                        <div className="text-2xl mr-2">{COOKIE_EMOJIS[type]}</div>
                        <div>
                          <p className="font-medium capitalize">{type.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-500">{cookieCounts[type] || 0} collected</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Achievements */}
              <h3 className="font-medium text-purple-700 mb-3">Achievements</h3>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="grid grid-cols-1 gap-3">
                  {COOKIE_ACHIEVEMENTS.map(achievement => {
                    const isUnlocked = achievements.includes(achievement.id);
                    return (
                      <div 
                        key={achievement.id} 
                        className={`flex items-center p-2 rounded ${
                          isUnlocked ? 'bg-blue-100' : 'bg-gray-100 opacity-70'
                        }`}
                      >
                        <div className={`text-xl mr-3 ${isUnlocked ? '' : 'text-gray-400'}`}>
                          {isUnlocked ? <Trophy size={20} className="text-yellow-500" /> : <Lock size={20} />}
                        </div>
                        <div>
                          <p className="font-medium">{achievement.name}</p>
                          <p className="text-sm text-gray-600">{achievement.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Lock icon component
const Lock = ({ size = 24 }: { size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

export default CookieJar; 