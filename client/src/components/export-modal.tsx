import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Checkbox } from "@/components/ui/checkbox";
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
  showShiftTable?: boolean;
}

export default function ExportModal({
  isOpen,
  onClose,
  defaultMonth = new Date().getMonth() + 1 <= 12 ? (new Date().getMonth() + 1).toString() : "12",
  defaultYear = new Date().getFullYear().toString(),
  selectedEmployees = new Set(),
  showAllEmployees = true,
  showShiftTable = false
}: ExportModalProps) {
  const [exportData, setExportData] = useState({
    month: defaultMonth,
    year: defaultYear,
    withColors: true,
    tableType: "attendance" as "attendance" | "shifts",
  });
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [appSettings, setAppSettings] = useState<{ companyName: string; rigName: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        setAppSettings(JSON.parse(saved));
      } catch {
        setAppSettings(null);
      }
    }
  }, [isOpen]);


  const handleExport = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/export/xlsx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            month: parseInt(exportData.month),
            year: parseInt(exportData.year),
            selectedEmployees: showAllEmployees ? undefined : Array.from(selectedEmployees),
            companyName: appSettings?.companyName || 'Siddik',
            rigName: appSettings?.rigName || 'ROM-100-II',
            withColors: exportData.withColors,
            tableType: exportData.tableType
          }),
      });

      if (!response.ok) {
        throw new Error(`Failed to export Excel file`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `attendance_${exportData.month}_${exportData.year}.xlsx`;
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
        description: `Excel file downloaded successfully`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to export Excel file`,
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

  // Generate available months and years (current and previous only)
  const getCurrentDate = () => new Date();
  const currentDate = getCurrentDate();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const getAvailableYears = () => {
    const years = [];
    for (let year = 2025; year <= currentYear; year++) {
      years.push(year);
    }
    return years.reverse(); // Show most recent first
  };

  const getAvailableMonths = (year: number) => {
    const months = [];
    const maxMonth = year === currentYear ? currentMonth : 12;

    for (let month = 1; month <= maxMonth; month++) {
      months.push({
        value: month,
        label: monthNames[month - 1]
      });
    }
    return months.reverse(); // Show most recent first
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md max-h-[80vh] overflow-y-auto" data-testid="modal-export" aria-describedby="export-description">
        <DialogHeader>
          <DialogTitle>
            Export Attendance
          </DialogTitle>
        </DialogHeader>

        <div id="export-description" className="sr-only">
          Export attendance data for a specific month and year in XLSX format.
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Month</Label>
            <Select value={exportData.month} onValueChange={(value) => setExportData({ ...exportData, month: value })}>
              <SelectTrigger data-testid="select-export-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableMonths(parseInt(exportData.year)).map(({ value, label }) => (
                  <SelectItem key={value} value={value.toString()}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Year</Label>
            <Select value={exportData.year} onValueChange={(value) => {
              const newYear = parseInt(value);
              const availableMonths = getAvailableMonths(newYear);
              const currentMonthValue = parseInt(exportData.month);
              
              // If current month is not available in the new year, reset to the latest available month
              const isCurrentMonthAvailable = availableMonths.some(m => m.value === currentMonthValue);
              const newMonth = isCurrentMonthAvailable ? exportData.month : availableMonths[0]?.value.toString() || "1";
              
              setExportData({ ...exportData, year: value, month: newMonth });
            }}>
              <SelectTrigger data-testid="select-export-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableYears().map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Table Type</Label>
            <Select 
              value={exportData.tableType} 
              onValueChange={(value: "attendance" | "shifts") => 
                setExportData({ ...exportData, tableType: value })
              }
            >
              <SelectTrigger data-testid="select-export-table-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance">
                  Attendance Table (Main)
                </SelectItem>
                {showShiftTable && (
                  <SelectItem value="shifts">
                    Shift Table (Day/Night)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2">Export Options</Label>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="withColors"
                  checked={exportData.withColors}
                  onCheckedChange={(checked) => 
                    setExportData({ ...exportData, withColors: !!checked })
                  }
                  data-testid="checkbox-with-colors"
                />
                <Label htmlFor="withColors" className="text-sm font-medium">
                  Export with colors
                </Label>
              </div>
              <p className="text-xs text-gray-600 ml-6 mt-1">
                When enabled, attendance cells will have background colors (green for Present, red for Absent, yellow for Overtime)
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800" data-testid="text-export-info">
                  Excel export will include {showAllEmployees ? 'all employees' : `${selectedEmployees.size} selected employee(s)`} with the {
                    exportData.tableType === "attendance" ? "main attendance table" :
                    "shift table (Day/Night)"
                  } for selected month/year.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end space-x-2 pt-4">
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
                Export XLSX
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}