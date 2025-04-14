import { useState } from 'react';
import { X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useGameStore from '@/store/gameStore';

export default function NodeDetailsPanel() {
  const { 
    showNodeDetailsPanel, 
    toggleNodeDetailsPanel, 
    selectedNodeId, 
    selectedNodeType, 
    actors, 
    agreements, 
    clearSelectedNode,
    selectNode
  } = useGameStore();
  
  const [showEdit, setShowEdit] = useState(false);
  
  if (!selectedNodeId || !selectedNodeType) return null;
  
  const handleClose = () => {
    clearSelectedNode();
  };
  
  const handleEditClick = () => {
    setShowEdit(true);
    // Implementation would open edit form for the current node
  };
  
  if (selectedNodeType === 'actor') {
    const actor = actors.find(a => a.id === selectedNodeId);
    if (!actor) return null;
    
    return (
      <div className={`absolute bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-80 z-40 ${!showNodeDetailsPanel ? 'hidden' : ''}`}>
        <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-serif font-medium">{actor.name}</h3>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEditClick}
              className="p-1 rounded h-7 w-7"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="p-1 rounded h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-3 max-h-[50vh] overflow-y-auto">
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-secondary">Backstory</span>
              <p className="text-sm">{actor.backstory}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Values</span>
              <p className="text-sm">{actor.values}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Goals</span>
              <p className="text-sm">{actor.goals}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Obligations</span>
              <p className="text-sm">{actor.obligations}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Capabilities</span>
              <ul className="mt-1 list-disc list-inside">
                {actor.capabilities.map((capability, index) => (
                  <li key={index} className="text-xs">{capability}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Resources</span>
              <ul className="mt-1 list-disc list-inside">
                {actor.resources.map((resource, index) => (
                  <li key={index} className="text-xs">{resource}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Agreement details
    const agreement = agreements.find(a => a.id === selectedNodeId);
    if (!agreement) return null;
    
    return (
      <div className={`absolute bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-80 z-40 ${!showNodeDetailsPanel ? 'hidden' : ''}`}>
        <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-serif font-medium">{agreement.title}</h3>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEditClick}
              className="p-1 rounded h-7 w-7"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="p-1 rounded h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-3 max-h-[50vh] overflow-y-auto">
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-secondary">Description</span>
              <p className="text-sm">{agreement.summary}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Parties Involved</span>
              <div className="mt-1 space-y-1">
                {agreement.parties.map(partyId => {
                  const actor = actors.find(a => a.id === partyId);
                  return (
                    <div key={partyId} className="flex items-center justify-between text-sm">
                      <span>{actor?.name || 'Unknown Actor'}</span>
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={() => {
                          clearSelectedNode();
                          setTimeout(() => selectNode(partyId, 'actor'), 100);
                        }}
                        className="text-primary hover:text-primary-dark text-xs h-6"
                      >
                        View Details
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <span className="text-xs font-medium text-secondary">Agreement Terms</span>
              <div className="mt-1 space-y-3">
                <div>
                  <div className="text-xs font-medium text-primary flex items-center">
                    <span className="mr-1">→</span>
                    Obligations
                  </div>
                  <ul className="mt-1 space-y-1">
                    {agreement.obligations.map(obligation => (
                      <li key={obligation.id} className="text-xs bg-primary/5 dark:bg-primary/10 p-1.5 rounded">
                        {obligation.description}
                        <span className="block text-[10px] text-gray-500 mt-1">
                          From: {actors.find(a => a.id === obligation.fromActorId)?.name || 'Unknown Actor'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-accent flex items-center">
                    <span className="mr-1">←</span>
                    Benefits
                  </div>
                  <ul className="mt-1 space-y-1">
                    {agreement.benefits.map(benefit => (
                      <li key={benefit.id} className="text-xs bg-accent/5 dark:bg-accent/10 p-1.5 rounded">
                        {benefit.description}
                        <span className="block text-[10px] text-gray-500 mt-1">
                          To: {actors.find(a => a.id === benefit.toActorId)?.name || 'Unknown Actor'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
