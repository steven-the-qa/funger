import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import HungerTracker from './components/HungerTracker';
import LoadingScreen from './components/LoadingScreen';
import { CookingPot } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import AuthProvider from './contexts/AuthContext';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Check if Supabase is connected
    const checkSupabaseConnection = async () => {
      try {
        const { error } = await supabase.from('hunger_records').select('count', { count: 'exact', head: true });
        if (!error) {
          setSupabaseConnected(true);
        }
      } catch (error) {
        console.error('Supabase connection error:', error);
      }
    };

    checkSupabaseConnection();

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_OUT') {
          // When user signs out, update both states at once to prevent flashing
          setSession(null);
          setIsLoggingOut(true);
        } else {
          setSession(session);
        }
        
        setAuthChecked(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Export logout function to be used by child components
  const handleLogout = async () => {
    // Set logging out flag before calling auth signOut
    setIsLoggingOut(true);
    await supabase.auth.signOut();
  };

  // Show the loading screen until auth is checked AND Supabase is connected
  // But NOT during logout process
  if ((!authChecked || !supabaseConnected) && !isLoggingOut) {
    return <LoadingScreen />;
  }

  // Render the appropriate UI based on authentication state
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto pt-8">
          {!session ? (
            <div className="text-center mb-8">
              <CookingPot size={48} className="mx-auto mb-4 text-purple-600" />
              <h1 className="text-3xl font-bold mb-2 text-purple-600">Funger</h1>
              <p className="text-gray-600 mb-8">Track your hunger patterns.</p>
              <Auth onLogin={() => {}} />
            </div>
          ) : (
            <HungerTracker onLogout={handleLogout} />
          )}
        </div>
      </div>
    </AuthProvider>
  );
}

export default App;