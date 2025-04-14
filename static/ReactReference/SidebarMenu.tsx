import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayerSidebar from './PlayerSidebar';

export default function SidebarMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Hamburger toggle button - only visible when sidebar is closed */}
      {!isOpen && (
        <div className="absolute top-20 left-4 z-40">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            className="h-10 w-10 rounded-full bg-white shadow-md border border-gray-200"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Sidebar with slide-in animation */}
      <div
        className={`fixed top-0 left-0 h-full z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <PlayerSidebar onClose={toggleSidebar} />
      </div>

      {/* Overlay when sidebar is open - click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-20"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </>
  );
}