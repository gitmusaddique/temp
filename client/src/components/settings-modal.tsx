import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdate: (settings: { companyName: string; rigName: string }) => void;
}

export default function SettingsModal({ isOpen, onClose, onSettingsUpdate }: SettingsModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [rigName, setRigName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch settings from the database
  const { data: settingsData, isLoading, isError, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
  });

  // Update local state when settings are fetched
  useEffect(() => {
    if (settingsData) {
      setCompanyName(settingsData.companyName || "Siddik");
      setRigName(settingsData.rigName || "ROM-100-II");
    }
  }, [settingsData]);

  // Mutation to update settings in the database
  const mutation = useMutation({
    mutationFn: async (newSettings: { companyName: string; rigName: string }) => {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: `Failed to save settings: ${err.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!companyName.trim() || !rigName.trim()) {
      toast({
        title: "Error",
        description: "Company name and rig name are required",
        variant: "destructive",
      });
      return;
    }

    const newSettings = {
      companyName: companyName.trim(),
      rigName: rigName.trim()
    };

    mutation.mutate(newSettings);
  };

  const handleReset = () => {
    // Reset to current database values
    if (settingsData) {
      setCompanyName(settingsData.companyName || "Siddik");
      setRigName(settingsData.rigName || "ROM-100-II");
    } else {
      // Fallback to defaults if no data
      setCompanyName("Siddik");
      setRigName("ROM-100-II");
    }
  };

  if (isLoading) return <Dialog open={isOpen} onOpenChange={onClose}><DialogContent><p>Loading settings...</p></DialogContent></Dialog>;
  if (isError) return <Dialog open={isOpen} onOpenChange={onClose}><DialogContent><p>Error loading settings: {error.message}</p></DialogContent></Dialog>;


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
              onClick={onClose}
              data-testid="button-cancel-settings"
              className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              data-testid="button-save-settings"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}