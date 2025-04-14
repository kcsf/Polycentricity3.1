import { Edit, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import useGameStore from "@/store/gameStore";

export default function PlayerSidebar({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const { currentRoleCard } = useGameStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-white dark:bg-neutral-800/80 shadow-lg z-10 overflow-y-auto border-r border-gray-200 dark:border-gray-700 h-full">
      {/* Player Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-serif font-bold">Player Information</h2>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="text-accent hover:text-accent-dark h-8 w-8 p-0">
              <Edit className="h-5 w-5" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:text-gray-800 h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-medium text-lg">
            <span>{user ? getInitials(user.username) : "?"}</span>
          </div>
          <div className="ml-3">
            <div className="font-medium">{user?.username || "Anonymous"}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Active Player</div>
          </div>
        </div>
      </div>
      
      {/* Role Card */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800">
        <h2 className="text-lg font-serif font-bold mb-3">Your Role</h2>
        
        {currentRoleCard ? (
          <div className="bg-white dark:bg-gray-800/80 rounded-lg p-4 shadow border actor-node">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-serif text-primary dark:text-primary-light text-lg">{currentRoleCard.title}</h3>
              <span className="text-accent">✨</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-secondary">Backstory</h4>
                <p className="text-sm">{currentRoleCard.backstory}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-secondary">Values</h4>
                <p className="text-sm">{currentRoleCard.values}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-secondary">Goals</h4>
                <p className="text-sm">{currentRoleCard.goals}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h4 className="text-sm font-medium text-secondary">Capabilities</h4>
                  <ul className="text-sm list-disc list-inside">
                    {currentRoleCard.capabilities.map((capability, index) => (
                      <li key={index}>{capability}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-secondary">Resources</h4>
                  <ul className="text-sm list-disc list-inside">
                    {currentRoleCard.resources.map((resource, index) => (
                      <li key={index}>{resource}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-secondary">Obligations</h4>
                <p className="text-sm">{currentRoleCard.obligations}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800/80 rounded-lg p-4 shadow border border-dashed">
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No role has been assigned yet.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
