import React from 'react';
import { CookingPot } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Loading your hunger data..." 
}) => (
  <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <CookingPot size={48} className="mx-auto mb-4 text-purple-600 animate-bounce" />
      <h1 className="text-2xl font-bold mb-2 text-purple-600">Funger</h1>
      <p className="text-gray-500 mb-4">{message}</p>
      <div className="w-24 h-1 mx-auto bg-purple-200 rounded-full overflow-hidden">
        <div className="w-full h-full bg-purple-600 animate-pulse"></div>
      </div>
    </div>
  </div>
);

export default LoadingScreen; 