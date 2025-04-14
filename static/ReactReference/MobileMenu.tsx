import { Menu, Search, Settings, User, PlusCircle, Clock, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useGameStore from '@/store/gameStore';
import { useAuth } from '@/hooks/use-auth';

export default function MobileMenu() {
  const { 
    showMobileMenu, 
    toggleMobileMenu, 
    timeRemaining, 
    toggleAgreementModal 
  } = useGameStore();
  
  const { logoutMutation } = useAuth();

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleNewAgreement = () => {
    toggleMobileMenu();
    toggleAgreementModal();
  };

  return (
    <>
      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-4 right-4 md:hidden z-40">
        <Button 
          onClick={toggleMobileMenu}
          className="bg-accent hover:bg-accent-dark text-white rounded-full p-3 shadow-lg flex items-center justify-center h-14 w-14"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Mobile Menu Sheet */}
      <div 
        className={`fixed inset-x-0 bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-xl shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          showMobileMenu ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto my-2"></div>
        
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <User className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">Profile</span>
            </button>
            <button 
              className="flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleNewAgreement}
            >
              <PlusCircle className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">New</span>
            </button>
            <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <Search className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">Search</span>
            </button>
            <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <Settings className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">Settings</span>
            </button>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Game Controls</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-accent mr-2" />
                  <span className="text-sm">Next Phase</span>
                </div>
                <span className="text-xs bg-accent/20 text-accent-dark dark:text-accent-light px-2 py-0.5 rounded">
                  {formatTime(timeRemaining)}
                </span>
              </button>
              <button className="w-full flex items-center p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
                <HelpCircle className="h-5 w-5 text-accent mr-2" />
                <span className="text-sm">Help & Rules</span>
              </button>
              <button 
                className="w-full flex items-center p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => logoutMutation.mutate()}
              >
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
