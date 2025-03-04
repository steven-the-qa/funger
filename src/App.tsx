import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import HungerTracker from './components/HungerTracker';
import { CookingPot } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

// Loading component that matches the app's design
const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <CookingPot size={48} className="mx-auto mb-4 text-purple-600 animate-bounce" />
      <h1 className="text-2xl font-bold mb-2 text-purple-600">Funger</h1>
      <p className="text-gray-600 mb-4">Loading your hunger data...</p>
      <div className="w-24 h-1 mx-auto bg-purple-200 rounded-full overflow-hidden">
        <div className="w-full h-full bg-purple-600 animate-pulse"></div>
      </div>
    </div>
  </div>
);

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

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
        setSession(session);
        setAuthChecked(true);
        
        // If user signed out, ensure UI reflects that
        if (event === 'SIGNED_OUT') {
          setSession(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Show the loading screen until auth is checked AND Supabase is connected
  if (!authChecked || !supabaseConnected) {
    return <LoadingScreen />;
  }

  // Render the appropriate UI based on authentication state
  return (
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
          <HungerTracker />
        )}
      </div>
    </div>
  );
}

export default App;