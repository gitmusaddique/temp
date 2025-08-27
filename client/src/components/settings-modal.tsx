
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdate: (settings: { companyName: string; rigName: string }) => void;
}

export default function SettingsModal({ isOpen, onClose, onSettingsUpdate }: SettingsModalProps) {
  const [companyName, setCompanyName] = useState("Siddik");
  const [rigName, setRigName] = useState("ROM-100-II");
  const { toast } = useToast();

  useEffect(() => {
    // Load settings from localStorage on component mount
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setCompanyName(settings.companyName || "Siddik");
        setRigName(settings.rigName || "ROM-100-II");
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }
  }, []);

  const handleSave = () => {
    if (!companyName.trim() || !rigName.trim()) {
      toast({
        title: "Error",
        description: "Company name and rig name are required",
        variant: "destructive",
      });
      return;
    }

    const settings = {
      companyName: companyName.trim(),
      rigName: rigName.trim()
    };

    // Save to localStorage
    localStorage.setItem('appSettings', JSON.stringify(settings));
    
    // Notify parent component
    onSettingsUpdate(settings);
    
    toast({
      title: "Success",
      description: "Settings saved successfully",
    });
    
    onClose();
  };

  const handleReset = () => {
    setCompanyName("Siddik");
    setRigName("ROM-100-II");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="settings-description">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
        </DialogHeader>

        <div id="settings-description" className="sr-only">
          Configure company name and rig name for the application
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="company-name" className="text-sm font-medium">
              Company Name *
            </Label>
            <Input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              className="mt-1"
              data-testid="input-company-name"
            />
          </div>

          <div>
            <Label htmlFor="rig-name" className="text-sm font-medium">
              Rig Name *
            </Label>
            <Input
              id="rig-name"
              type="text"
              value={rigName}
              onChange={(e) => setRigName(e.target.value)}
              placeholder="Enter rig name"
              className="mt-1"
              data-testid="input-rig-name"
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset-settings"
            >
              Reset to Default
            </Button>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-settings"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                data-testid="button-save-settings"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
