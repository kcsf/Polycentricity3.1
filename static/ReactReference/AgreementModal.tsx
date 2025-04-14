import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import useGameStore, { AgreementType } from '@/store/gameStore';
import { v4 as uuidv4 } from 'uuid';

const agreementSchema = z.object({
  title: z.string().min(3, "Title is required"),
  summary: z.string().min(10, "Summary should be at least 10 characters"),
  type: z.enum(["Bilateral", "Multilateral", "Symmetric", "Asymmetric"]),
});

type AgreementFormValues = z.infer<typeof agreementSchema>;

type PartyTerms = {
  actorId: string;
  obligations: { id: string; text: string }[];
  benefits: { id: string; text: string }[];
};

export default function AgreementModal() {
  const { 
    actors, 
    showAgreementModal, 
    toggleAgreementModal, 
    addAgreement 
  } = useGameStore();
  
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  const [partyTerms, setPartyTerms] = useState<Record<string, PartyTerms>>({});
  const [newObligation, setNewObligation] = useState<Record<string, string>>({});
  const [newBenefit, setNewBenefit] = useState<Record<string, string>>({});
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      title: '',
      summary: '',
      type: 'Bilateral',
    }
  });
  
  const agreementType = watch('type');

  const resetForm = () => {
    reset();
    setSelectedParties([]);
    setPartyTerms({});
    setNewObligation({});
    setNewBenefit({});
  };
  
  const handleClose = () => {
    resetForm();
    toggleAgreementModal();
  };
  
  const toggleParty = (actorId: string) => {
    setSelectedParties(prev => {
      if (prev.includes(actorId)) {
        // Remove actor and its terms
        const { [actorId]: _, ...rest } = partyTerms;
        setPartyTerms(rest);
        return prev.filter(id => id !== actorId);
      } else {
        // Add actor with empty terms
        setPartyTerms(prev => ({
          ...prev,
          [actorId]: {
            actorId,
            obligations: [],
            benefits: []
          }
        }));
        return [...prev, actorId];
      }
    });
  };
  
  const addPartyObligation = (actorId: string) => {
    if (!newObligation[actorId]?.trim()) return;
    
    setPartyTerms(prev => ({
      ...prev,
      [actorId]: {
        ...prev[actorId],
        obligations: [
          ...prev[actorId].obligations,
          { id: uuidv4(), text: newObligation[actorId] }
        ]
      }
    }));
    
    setNewObligation(prev => ({
      ...prev,
      [actorId]: ''
    }));
  };
  
  const removePartyObligation = (actorId: string, obligationId: string) => {
    setPartyTerms(prev => ({
      ...prev,
      [actorId]: {
        ...prev[actorId],
        obligations: prev[actorId].obligations.filter(o => o.id !== obligationId)
      }
    }));
  };
  
  const addPartyBenefit = (actorId: string) => {
    if (!newBenefit[actorId]?.trim()) return;
    
    setPartyTerms(prev => ({
      ...prev,
      [actorId]: {
        ...prev[actorId],
        benefits: [
          ...prev[actorId].benefits,
          { id: uuidv4(), text: newBenefit[actorId] }
        ]
      }
    }));
    
    setNewBenefit(prev => ({
      ...prev,
      [actorId]: ''
    }));
  };
  
  const removePartyBenefit = (actorId: string, benefitId: string) => {
    setPartyTerms(prev => ({
      ...prev,
      [actorId]: {
        ...prev[actorId],
        benefits: prev[actorId].benefits.filter(b => b.id !== benefitId)
      }
    }));
  };
  
  const onSubmit = (data: AgreementFormValues) => {
    // Validate that we have parties selected
    if (selectedParties.length === 0) {
      return; // Already handled by the disabled button
    }
    
    // Format obligations and benefits for the agreement
    const obligations = Object.values(partyTerms).flatMap(party => 
      party.obligations.map(obligation => ({
        id: obligation.id,
        description: obligation.text, // Changed from text to description
        fromActorId: party.actorId,
      }))
    );
    
    const benefits = Object.values(partyTerms).flatMap(party => 
      party.benefits.map(benefit => ({
        id: benefit.id,
        description: benefit.text, // Changed from text to description
        toActorId: party.actorId,
      }))
    );
    
    // Create the new agreement
    const newAgreement = {
      id: uuidv4(),
      title: data.title,
      summary: data.summary,
      type: data.type as AgreementType,
      parties: selectedParties,
      obligations,
      benefits,
      position: { x: 200, y: 200 }
    };
    
    // Log the agreement being created for debugging
    console.log("Creating new agreement:", newAgreement);
    
    // Add to store and close modal
    addAgreement(newAgreement);
    handleClose();
  };

  const getActorName = (actorId: string) => {
    return actors.find(actor => actor.id === actorId)?.name || 'Unknown Actor';
  };
  
  return (
    <Dialog open={showAgreementModal} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#FCFCF7]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create New Agreement</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Agreement Basic Info */}
          <div>
            <Label htmlFor="title">Agreement Title</Label>
            <Input
              id="title"
              placeholder="Enter a memorable title..."
              {...register('title')}
              className="w-full"
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="summary">Agreement Summary</Label>
            <Textarea
              id="summary"
              placeholder="Briefly describe this agreement..."
              rows={2}
              {...register('summary')}
              className="w-full"
            />
            {errors.summary && (
              <p className="text-xs text-red-500 mt-1">{errors.summary.message}</p>
            )}
          </div>
          
          {/* Agreement Type */}
          <div>
            <Label>Agreement Type</Label>
            <RadioGroup defaultValue="Bilateral" {...register('type')} className="grid grid-cols-2 gap-3 mt-1">
              <div className={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${agreementType === 'Bilateral' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem id="bilateral" value="Bilateral" className="mr-2" />
                <div>
                  <Label htmlFor="bilateral" className="font-medium">Bilateral</Label>
                  <p className="text-xs text-gray-500">Between two parties</p>
                </div>
              </div>
              
              <div className={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${agreementType === 'Multilateral' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem id="multilateral" value="Multilateral" className="mr-2" />
                <div>
                  <Label htmlFor="multilateral" className="font-medium">Multilateral</Label>
                  <p className="text-xs text-gray-500">Three or more parties</p>
                </div>
              </div>
              
              <div className={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${agreementType === 'Symmetric' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem id="symmetric" value="Symmetric" className="mr-2" />
                <div>
                  <Label htmlFor="symmetric" className="font-medium">Symmetric</Label>
                  <p className="text-xs text-gray-500">Equal terms for all parties</p>
                </div>
              </div>
              
              <div className={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${agreementType === 'Asymmetric' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem id="asymmetric" value="Asymmetric" className="mr-2" />
                <div>
                  <Label htmlFor="asymmetric" className="font-medium">Asymmetric</Label>
                  <p className="text-xs text-gray-500">Unequal terms between parties</p>
                </div>
              </div>
            </RadioGroup>
          </div>
          
          {/* Parties Involved */}
          <div>
            <Label>Parties Involved</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedParties.map(actorId => (
                <span key={actorId} className="bg-primary/10 text-primary-dark dark:text-primary-light px-2 py-1 rounded-full text-sm flex items-center">
                  {getActorName(actorId)}
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={() => toggleParty(actorId)}
                    className="ml-1 text-primary-dark/70 hover:text-primary-dark dark:text-primary-light/70 dark:hover:text-primary-light h-5 w-5 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </span>
              ))}
            </div>
            
            <div className="mb-4">
              <Label>Available Actors</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {actors.map(actor => (
                  <Button
                    key={actor.id}
                    type="button"
                    variant={selectedParties.includes(actor.id) ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleParty(actor.id)}
                    className="text-sm"
                  >
                    {actor.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Agreement Details - Per Party */}
          {selectedParties.length > 0 && (
            <div className="space-y-4">
              {selectedParties.map(actorId => (
                <div key={actorId} className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-3">{getActorName(actorId)}</h3>
                  
                  <div className="mb-3">
                    <Label className="text-sm font-medium mb-1">Obligations</Label>
                    <div className="flex items-center space-x-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Add an obligation..."
                        value={newObligation[actorId] || ''}
                        onChange={(e) => setNewObligation(prev => ({ ...prev, [actorId]: e.target.value }))}
                        className="flex-grow"
                      />
                      <Button
                        type="button"
                        onClick={() => addPartyObligation(actorId)}
                        className="bg-primary hover:bg-primary-dark text-white p-2 h-9 w-9"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <ul className="space-y-1">
                      {partyTerms[actorId]?.obligations.map(obligation => (
                        <li key={obligation.id} className="flex items-center justify-between bg-primary/5 dark:bg-primary/10 p-2 rounded">
                          <span className="text-sm">{obligation.text}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePartyObligation(actorId, obligation.id)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 h-6 w-6"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-1">Benefits</Label>
                    <div className="flex items-center space-x-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Add a benefit..."
                        value={newBenefit[actorId] || ''}
                        onChange={(e) => setNewBenefit(prev => ({ ...prev, [actorId]: e.target.value }))}
                        className="flex-grow"
                      />
                      <Button
                        type="button"
                        onClick={() => addPartyBenefit(actorId)}
                        className="bg-accent hover:bg-accent-dark text-white p-2 h-9 w-9"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <ul className="space-y-1">
                      {partyTerms[actorId]?.benefits.map(benefit => (
                        <li key={benefit.id} className="flex items-center justify-between bg-accent/5 dark:bg-accent/10 p-2 rounded">
                          <span className="text-sm">{benefit.text}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePartyBenefit(actorId, benefit.id)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 h-6 w-6"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter className="mt-4 space-x-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={selectedParties.length === 0}
              className="bg-primary hover:bg-primary-dark text-white flex items-center"
            >
              Create Agreement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
