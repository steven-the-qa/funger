import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  
  return {
    plugins: [
      react(),
      {
        name: 'env-check',
        configResolved() {
          console.log('Building with env vars:', {
            VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ? 'defined' : 'undefined',
            VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined'
          });
        }
      }
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    // Define env variables for client
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    }
  };
});