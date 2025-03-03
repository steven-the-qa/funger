import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import HungerTracker from './components/HungerTracker';
import { CookingPot } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!supabaseConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md text-center">
          <CookingPot size={48} className="mx-auto mb-4 text-purple-600" />
          <h1 className="text-2xl font-bold mb-4 text-purple-600">Funger</h1>
          <p className="mb-6 text-gray-600">
            Please connect to Supabase to use this application.
          </p>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p className="text-yellow-700">
              Click the "Connect to Supabase" button in the top right corner to set up your database.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            This app tracks your hunger patterns and helps you understand your eating habits.
          </p>
        </div>
      </div>
    );
  }

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