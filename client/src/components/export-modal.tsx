import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X, Download, Info, Loader2 } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMonth?: string;
  defaultYear?: string;
  selectedEmployees?: Set<string>;
  showAllEmployees?: boolean;
}

export default function ExportModal({ 
  isOpen, 
  onClose, 
  defaultMonth = new Date().getMonth() + 1 <= 12 ? (new Date().getMonth() + 1).toString() : "12", 
  defaultYear = new Date().getFullYear().toString(), 
  selectedEmployees = new Set(),
  showAllEmployees = true 
}: ExportModalProps) {
  const [exportData, setExportData] = useState({
    month: defaultMonth,
    year: defaultYear,
    format: "xlsx",
  });
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [appSettings, setAppSettings] = useState({ companyName: "Siddik", rigName: "ROM-100-II" });

  useEffect(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        setAppSettings(JSON.parse(saved));
      } catch {
        setAppSettings({ companyName: "Siddik", rigName: "ROM-100-II" });
      }
    }
  }, [isOpen]);


  const handleExport = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/export/${exportData.format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: parseInt(exportData.month),
          year: parseInt(exportData.year),
          selectedEmployees: showAllEmployees ? undefined : Array.from(selectedEmployees),
          companyName: appSettings.companyName,
          rigName: appSettings.rigName
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to export ${exportData.format.toUpperCase()}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `attendance_${exportData.month}_${exportData.year}.${exportData.format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `${exportData.format.toUpperCase()} file downloaded successfully`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to export ${exportData.format.toUpperCase()}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md" data-testid="modal-export" aria-describedby="export-description">
        <DialogHeader>
          <DialogTitle>
            Export Attendance
          </DialogTitle>
        </DialogHeader>

        <div id="export-description" className="sr-only">
          Export attendance data for a specific month and year in XLSX or PDF format.
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Month</Label>
            <Select value={exportData.month} onValueChange={(value) => setExportData({ ...exportData, month: value })}>
              <SelectTrigger data-testid="select-export-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Year</Label>
            <Select value={exportData.year} onValueChange={(value) => setExportData({ ...exportData, year: value })}>
              <SelectTrigger data-testid="select-export-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2">Export Format</Label>
            <RadioGroup 
              value={exportData.format} 
              onValueChange={(value) => setExportData({ ...exportData, format: value })}
              className="space-y-2"
              data-testid="radio-export-format"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="text-sm">Excel (XLSX)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="text-sm">PDF Document</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 mr-2" />
              <div>
                <p className="text-sm text-blue-800" data-testid="text-export-info">
                  Export will include {showAllEmployees ? 'all employees' : `${selectedEmployees.size} selected employee(s)`} with attendance grid for selected month/year.
                </p>
              </div>
            </div>
          </div>

          <div className="modal-buttons">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700 font-medium"
            >
              Cancel
            </Button>
            <Button variant="default" onClick={handleExport} className="min-w-24" disabled={isLoading} data-testid="button-generate-export">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {exportData.format.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}