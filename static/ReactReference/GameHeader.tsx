import { useState, useEffect } from "react";
import { Bell, HelpCircle, Moon, Settings, Sun, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import useGameStore from "@/store/gameStore";

export default function GameHeader() {
  const { logoutMutation } = useAuth();
  const { 
    currentPhase, 
    timeRemaining, 
    timerActive, 
    startTimer, 
    stopTimer, 
    decrementTimer 
  } = useGameStore();
  
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    let timer: number;
    if (timerActive) {
      timer = window.setInterval(() => {
        decrementTimer();
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timerActive, decrementTimer]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    if (timerActive) {
      stopTimer();
    } else {
      startTimer();
    }
  };

  return (
    <header className="bg-gray-800 text-white p-3 shadow-md">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-xl md:text-3xl font-bold">
            <span className="font-serif text-white">Polycentricity</span>
          </h1>
          <span className="ml-4 text-sm bg-blue-600 px-2 py-1 rounded text-white">Beta</span>
        </div>
        
        {/* Timer and Phase Display */}
        <div className="flex items-center space-x-4">
          <div className="bg-white/20 rounded-lg px-3 py-1 text-white">
            <span className="text-sm font-medium">{currentPhase} Phase</span>
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1 flex items-center text-white">
            <span className="text-sm mr-1">⏱️</span>
            <span className="text-sm font-mono">{formatTime(timeRemaining)}</span>
          </div>
          <Button 
            variant="ghost" 
            onClick={toggleTimer}
            className="bg-accent hover:bg-accent-dark text-white rounded-lg px-3 py-1 text-sm flex items-center h-8"
          >
            {timerActive ? (
              <>
                <Pause className="h-4 w-4 mr-1" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" /> Start
              </>
            )}
          </Button>
        </div>
        
        {/* Controls for larger screens */}
        <div className="hidden md:flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 w-10"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 w-10"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 w-10"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 w-10"
            onClick={() => logoutMutation.mutate()}
          >
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
