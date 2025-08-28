import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, X, Bell, Settings, Building } from "lucide-react";
import { Link } from "wouter";
import type { Employee, AttendanceRecord } from "@shared/schema";
import ExportModal from "@/components/export-modal";
import SettingsModal from "@/components/settings-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Simple debounce function
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

export default function AttendanceView() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1 <= 12 ? (now.getMonth() + 1).toString() : "12";
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    return now.getFullYear() >= 2025 ? now.getFullYear().toString() : "2025";
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{employeeId: string, day: number, currentStatus: string} | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [showAllEmployees, setShowAllEmployees] = useState(true);
  const [showSelectionPanel, setShowSelectionPanel] = useState(false);
  const [selectedDesignation, setSelectedDesignation] = useState("all");
  const [modalDesignationFilter, setModalDesignationFilter] = useState("all");
  const [modalStatusFilter, setModalStatusFilter] = useState("all"); // Added for status filtering in modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appSettings, setAppSettings] = useState<{ companyName: string; rigName: string } | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"fill" | "clear" | null>(null);

  // Load settings from database
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setAppSettings(settings);
    }
  }, [settings]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: attendanceRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", selectedMonth, selectedYear],
  });

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

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(parseInt(selectedMonth), parseInt(selectedYear));
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Get unique designations for filter in the same order as the database sorting
  const designationOrder = ['Rig I/C', 'Shift I/C', 'Asst Shift I/C', 'Top Man', 'Rig Man'];
  const employeeDesignations = Array.from(new Set(employees.map(emp => emp.designation).filter(Boolean)));
  const uniqueDesignations = designationOrder.filter(d => employeeDesignations.includes(d))
    .concat(employeeDesignations.filter(d => !designationOrder.includes(d)));

  // Filter employees by designation while preserving database sort order
  const filteredEmployees = selectedDesignation === "all" 
    ? employees 
    : employees.filter(emp => emp.designation === selectedDesignation);

  // Filter employees for modal by modal designation filter AND status
  const modalFilteredEmployees = modalDesignationFilter === "all" && modalStatusFilter === "all"
    ? filteredEmployees 
    : filteredEmployees.filter(emp => 
        (modalDesignationFilter === "all" || emp.designation === modalDesignationFilter) &&
        (modalStatusFilter === "all" || (modalStatusFilter === "active" ? emp.isActive : !emp.isActive))
      );

  // Final display employees - already sorted by database (designation_order ASC, name ASC)
  const displayEmployees = showAllEmployees 
    ? filteredEmployees.filter(emp => emp.isActive) // Only show active employees by default
    : filteredEmployees.filter(emp => selectedEmployees.has(emp.id));



  // Reset selections when designation filter changes
  React.useEffect(() => {
    if (selectedDesignation !== "all") {
      // Clear selections that are no longer in the filtered list
      const filteredIds = new Set(filteredEmployees.map(emp => emp.id));
      setSelectedEmployees(prev => new Set([...prev].filter(id => filteredIds.has(id))));
    }
  }, [selectedDesignation, filteredEmployees]);

  // Reset modal designation filter when main designation changes
  React.useEffect(() => {
    setModalDesignationFilter("all");
    setModalStatusFilter("all"); // Reset status filter as well
  }, [selectedDesignation]);

  // Toggle individual employee selection
  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  // Get attendance status for a specific employee and day
  const getAttendanceStatus = (employeeId: string, day: number): string => {
    const record = attendanceRecords.find(r => r.employeeId === employeeId);
    if (!record || !record.attendanceData) return "";

    try {
      const data = JSON.parse(record.attendanceData) as Record<string, string>;
      return data[day.toString()] || "";
    } catch {
      return "";
    }
  };

  // Get remarks for a specific employee
  const getEmployeeRemarks = (employeeId: string): string => {
    const record = attendanceRecords.find(r => r.employeeId === employeeId);
    return record?.remarks || "";
  };

  // Local state for remarks to avoid constant API calls
  const [remarksState, setRemarksState] = useState<Record<string, string>>({});

  // Initialize remarks state when attendance records change (only if not already set)
  React.useEffect(() => {
    const newRemarksState: Record<string, string> = {};
    attendanceRecords.forEach(record => {
      // Only update if we don't already have local state for this employee
      if (record.remarks && !(record.employeeId in remarksState)) {
        newRemarksState[record.employeeId] = record.remarks;
      }
    });

    // Only update if we have new data to set
    if (Object.keys(newRemarksState).length > 0) {
      setRemarksState(prev => ({ ...prev, ...newRemarksState }));
    }
  }, [attendanceRecords]);

  // Debounced remarks update
  const updateRemarksMutation = useMutation({
    mutationFn: async ({ employeeId, remarks }: { employeeId: string, remarks: string }) => {
      const existingRecord = attendanceRecords.find(r => r.employeeId === employeeId);
      let attendanceData: Record<string, string> = {};

      if (existingRecord && existingRecord.attendanceData) {
        try {
          attendanceData = JSON.parse(existingRecord.attendanceData) as Record<string, string>;
        } catch {
          attendanceData = {};
        }
      }

      const response = await apiRequest('POST', '/api/attendance', {
        employeeId,
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        attendanceData: JSON.stringify(attendanceData),
        totalOnDuty: existingRecord?.totalOnDuty || 0,
        otDays: existingRecord?.otDays || 0,
        remarks: remarks.trim() || null
      });

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", selectedMonth, selectedYear] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update remarks",
        variant: "destructive",
      });
    }
  });

  // Debounce remarks updates
  const debouncedUpdateRemarks = React.useCallback(
    debounce((employeeId: string, remarks: string) => {
      updateRemarksMutation.mutate({ employeeId, remarks });
    }, 1000),
    [updateRemarksMutation]
  );

  // Bulk update attendance mutation
  const bulkUpdateAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, startDay, endDay, status }: { employeeId: string, startDay: number, endDay: number, status: string }) => {
      const existingRecord = attendanceRecords.find(r => r.employeeId === employeeId);
      let attendanceData: Record<string, string> = {};

      if (existingRecord && existingRecord.attendanceData) {
        try {
          attendanceData = JSON.parse(existingRecord.attendanceData) as Record<string, string>;
        } catch {
          attendanceData = {};
        }
      }

      // Update all days in the range
      for (let day = startDay; day <= endDay; day++) {
        if (status === "") {
          delete attendanceData[day.toString()];
        } else {
          attendanceData[day.toString()] = status;
        }
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          attendanceData: JSON.stringify(attendanceData)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", selectedMonth, selectedYear] });
      toast({
        title: "Success",
        description: "Attendance updated successfully"
      });
      setShowDateRangeModal(false);
      setSelectedRowId(null);
      setStartDate("");
      setEndDate("");
      setBulkAction(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive"
      });
    }
  });

  // Update attendance mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, day, status }: { employeeId: string, day: number, status: string }) => {
      const existingRecord = attendanceRecords.find(r => r.employeeId === employeeId);
      let attendanceData: Record<string, string> = {};

      if (existingRecord && existingRecord.attendanceData) {
        try {
          attendanceData = JSON.parse(existingRecord.attendanceData) as Record<string, string>;
        } catch {
          attendanceData = {};
        }
      }

      if (status === "") {
        delete attendanceData[day.toString()];
      } else {
        attendanceData[day.toString()] = status;
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          attendanceData: JSON.stringify(attendanceData)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", selectedMonth, selectedYear] });
      toast({
        title: "Success",
        description: "Attendance updated successfully"
      });
      setSelectedCell(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive"
      });
    }
  });

  const handleSettingsUpdate = (settings: { companyName: string; rigName: string }) => {
    setAppSettings(settings);
  };

  // Validate date range
  const validateDateRange = (start: string, end: string): boolean => {
    const startDay = parseInt(start);
    const endDay = parseInt(end);
    
    if (!startDay || !endDay || startDay < 1 || endDay < 1 || startDay > daysInMonth || endDay > daysInMonth) {
      return false;
    }
    
    return startDay <= endDay;
  };

  // Handle bulk fill
  const handleBulkFill = (status: string) => {
    if (!selectedRowId || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select a row and valid date range",
        variant: "destructive"
      });
      return;
    }

    if (!validateDateRange(startDate, endDate)) {
      toast({
        title: "Invalid Range",
        description: `Please enter valid dates between 1 and ${daysInMonth}. Start date must be less than or equal to end date.`,
        variant: "destructive"
      });
      return;
    }

    bulkUpdateAttendanceMutation.mutate({
      employeeId: selectedRowId,
      startDay: parseInt(startDate),
      endDay: parseInt(endDate),
      status
    });
  };

  // Handle bulk clear
  const handleBulkClear = () => {
    if (!selectedRowId || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select a row and valid date range",
        variant: "destructive"
      });
      return;
    }

    if (!validateDateRange(startDate, endDate)) {
      toast({
        title: "Invalid Range",
        description: `Please enter valid dates between 1 and ${daysInMonth}. Start date must be less than or equal to end date.`,
        variant: "destructive"
      });
      return;
    }

    bulkUpdateAttendanceMutation.mutate({
      employeeId: selectedRowId,
      startDay: parseInt(startDate),
      endDay: parseInt(endDate),
      status: ""
    });
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white shadow-material sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Building className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-medium text-on-surface" data-testid="app-title">
                  {appSettings?.companyName || "Loading..."}
                </h1>
                <p className="text-xs text-gray-600">Attendance Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5 text-gray-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setShowSettingsModal(true)}
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub Header */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-medium" data-testid="text-attendance-title">Monthly Attendance</h2>
              <p className="text-sm text-gray-600" data-testid="text-selected-period">
                {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
              </p>
              {!showAllEmployees && (
                <p className="text-xs text-blue-600" data-testid="text-selection-status">
                  {selectedEmployees.size} of {filteredEmployees.length} employees selected
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32" data-testid="select-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableYears().map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40" data-testid="select-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableMonths(parseInt(selectedYear)).map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSelectionPanel(true);
                    if (showAllEmployees) {
                      setShowAllEmployees(false);
                    }
                  }}
                  data-testid="button-toggle-employee-view"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-600 hover:border-blue-700 font-medium px-4 py-2"
                >
                  {showAllEmployees ? "Select Employees" : `Selected (${selectedEmployees.size})`}
                </Button>

                <Button 
                  onClick={() => setShowExportModal(true)}
                  className="bg-secondary hover:bg-secondary-light text-white"
                  data-testid="button-export-attendance"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Selection Modal */}
      <Dialog open={!showAllEmployees && showSelectionPanel} onOpenChange={(open) => !open && setShowSelectionPanel(false)}>
        <DialogContent className="max-w-4xl max-h-[80vh]" aria-describedby="employee-selection-description">
          <DialogHeader>
            <DialogTitle>Select Employees for Attendance</DialogTitle>
          </DialogHeader>

          <div id="employee-selection-description" className="sr-only">
            Select employees to include in the attendance view
          </div>

          <div className="flex flex-col space-y-4">
            {/* Designation and Status Filters for Modal */}
            <div className="pb-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Filter by Designation:</label>
                <Select value={modalDesignationFilter} onValueChange={setModalDesignationFilter}>
                  <SelectTrigger className="w-48" data-testid="select-modal-designation-filter">
                    <SelectValue placeholder="Filter by designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Designations</SelectItem>
                    {uniqueDesignations.filter(designation => 
                      filteredEmployees.some(emp => emp.designation === designation)
                    ).map(designation => (
                      <SelectItem key={designation} value={designation}>
                        {designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
                <Select value={modalStatusFilter} onValueChange={setModalStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-modal-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {modalFilteredEmployees.map(employee => (
                <div 
                  key={employee.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedEmployees.has(employee.id)
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleEmployeeSelection(employee.id)}
                  data-testid={`employee-selection-${employee.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{employee.name}</p>
                      <p className="text-xs text-gray-600">{employee.designation || "No designation"}</p>
                      <p className={`text-xs ${employee.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    {selectedEmployees.has(employee.id) && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {modalFilteredEmployees.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No employees found for the selected filters.
              </p>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-600">
                {selectedEmployees.size} of {filteredEmployees.length} employee(s) selected
                {(modalDesignationFilter !== "all" || modalStatusFilter !== "all") && (
                  <span className="text-gray-500"> • Showing {modalFilteredEmployees.length} for current filters</span>
                )}
              </p>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmployees(new Set(modalFilteredEmployees.map(emp => emp.id)))}
                  data-testid="button-select-all-filtered"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-600 hover:border-blue-700 font-medium px-3 py-1"
                  disabled={modalFilteredEmployees.length === 0}
                >
                  Select All Visible
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmployees(new Set())}
                  data-testid="button-clear-all-selections"
                  className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700 font-medium px-3 py-1"
                >
                  Clear All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSelectionPanel(false)}
                  data-testid="button-cancel-selection"
                  className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700 font-medium px-3 py-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance Table */}
      <div className="max-w-full mx-auto px-4 py-8">
        <style jsx>{`
          /* Row highlighting */
          .attendance-table tbody tr:hover {
            background-color: #f1f5f9 !important;
          }
          .attendance-table tbody tr:hover td {
            background-color: #f1f5f9 !important;
          }
          
          /* Header hover */
          .attendance-table thead th:hover {
            background-color: #e0e7ff !important;
          }
          
          /* Individual cell hover */
          .attendance-table td.day-cell:hover {
            background-color: #dbeafe !important;
            transform: scale(1.05);
            transition: all 0.2s ease;
            z-index: 10;
            position: relative;
          }
          
          /* Column highlighting - when hovering over any cell in a column, highlight the entire column */
          .attendance-table .day-column-0:hover ~ .day-column-0,
          .attendance-table .day-column-0:hover,
          .attendance-table thead .day-column-0:hover,
          .attendance-table tbody .day-column-0:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-1:hover ~ .day-column-1,
          .attendance-table .day-column-1:hover,
          .attendance-table thead .day-column-1:hover,
          .attendance-table tbody .day-column-1:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-2:hover ~ .day-column-2,
          .attendance-table .day-column-2:hover,
          .attendance-table thead .day-column-2:hover,
          .attendance-table tbody .day-column-2:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-3:hover ~ .day-column-3,
          .attendance-table .day-column-3:hover,
          .attendance-table thead .day-column-3:hover,
          .attendance-table tbody .day-column-3:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-4:hover ~ .day-column-4,
          .attendance-table .day-column-4:hover,
          .attendance-table thead .day-column-4:hover,
          .attendance-table tbody .day-column-4:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-5:hover ~ .day-column-5,
          .attendance-table .day-column-5:hover,
          .attendance-table thead .day-column-5:hover,
          .attendance-table tbody .day-column-5:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-6:hover ~ .day-column-6,
          .attendance-table .day-column-6:hover,
          .attendance-table thead .day-column-6:hover,
          .attendance-table tbody .day-column-6:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-7:hover ~ .day-column-7,
          .attendance-table .day-column-7:hover,
          .attendance-table thead .day-column-7:hover,
          .attendance-table tbody .day-column-7:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-8:hover ~ .day-column-8,
          .attendance-table .day-column-8:hover,
          .attendance-table thead .day-column-8:hover,
          .attendance-table tbody .day-column-8:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-9:hover ~ .day-column-9,
          .attendance-table .day-column-9:hover,
          .attendance-table thead .day-column-9:hover,
          .attendance-table tbody .day-column-9:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-10:hover ~ .day-column-10,
          .attendance-table .day-column-10:hover,
          .attendance-table thead .day-column-10:hover,
          .attendance-table tbody .day-column-10:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-11:hover ~ .day-column-11,
          .attendance-table .day-column-11:hover,
          .attendance-table thead .day-column-11:hover,
          .attendance-table tbody .day-column-11:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-12:hover ~ .day-column-12,
          .attendance-table .day-column-12:hover,
          .attendance-table thead .day-column-12:hover,
          .attendance-table tbody .day-column-12:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-13:hover ~ .day-column-13,
          .attendance-table .day-column-13:hover,
          .attendance-table thead .day-column-13:hover,
          .attendance-table tbody .day-column-13:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-14:hover ~ .day-column-14,
          .attendance-table .day-column-14:hover,
          .attendance-table thead .day-column-14:hover,
          .attendance-table tbody .day-column-14:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-15:hover ~ .day-column-15,
          .attendance-table .day-column-15:hover,
          .attendance-table thead .day-column-15:hover,
          .attendance-table tbody .day-column-15:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-16:hover ~ .day-column-16,
          .attendance-table .day-column-16:hover,
          .attendance-table thead .day-column-16:hover,
          .attendance-table tbody .day-column-16:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-17:hover ~ .day-column-17,
          .attendance-table .day-column-17:hover,
          .attendance-table thead .day-column-17:hover,
          .attendance-table tbody .day-column-17:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-18:hover ~ .day-column-18,
          .attendance-table .day-column-18:hover,
          .attendance-table thead .day-column-18:hover,
          .attendance-table tbody .day-column-18:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-19:hover ~ .day-column-19,
          .attendance-table .day-column-19:hover,
          .attendance-table thead .day-column-19:hover,
          .attendance-table tbody .day-column-19:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-20:hover ~ .day-column-20,
          .attendance-table .day-column-20:hover,
          .attendance-table thead .day-column-20:hover,
          .attendance-table tbody .day-column-20:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-21:hover ~ .day-column-21,
          .attendance-table .day-column-21:hover,
          .attendance-table thead .day-column-21:hover,
          .attendance-table tbody .day-column-21:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-22:hover ~ .day-column-22,
          .attendance-table .day-column-22:hover,
          .attendance-table thead .day-column-22:hover,
          .attendance-table tbody .day-column-22:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-23:hover ~ .day-column-23,
          .attendance-table .day-column-23:hover,
          .attendance-table thead .day-column-23:hover,
          .attendance-table tbody .day-column-23:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-24:hover ~ .day-column-24,
          .attendance-table .day-column-24:hover,
          .attendance-table thead .day-column-24:hover,
          .attendance-table tbody .day-column-24:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-25:hover ~ .day-column-25,
          .attendance-table .day-column-25:hover,
          .attendance-table thead .day-column-25:hover,
          .attendance-table tbody .day-column-25:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-26:hover ~ .day-column-26,
          .attendance-table .day-column-26:hover,
          .attendance-table thead .day-column-26:hover,
          .attendance-table tbody .day-column-26:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-27:hover ~ .day-column-27,
          .attendance-table .day-column-27:hover,
          .attendance-table thead .day-column-27:hover,
          .attendance-table tbody .day-column-27:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-28:hover ~ .day-column-28,
          .attendance-table .day-column-28:hover,
          .attendance-table thead .day-column-28:hover,
          .attendance-table tbody .day-column-28:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-29:hover ~ .day-column-29,
          .attendance-table .day-column-29:hover,
          .attendance-table thead .day-column-29:hover,
          .attendance-table tbody .day-column-29:hover {
            background-color: #dbeafe !important;
          }
          
          .attendance-table .day-column-30:hover ~ .day-column-30,
          .attendance-table .day-column-30:hover,
          .attendance-table thead .day-column-30:hover,
          .attendance-table tbody .day-column-30:hover {
            background-color: #dbeafe !important;
          }
        `}</style>
        <Card className="overflow-hidden">
          <CardHeader className="text-center bg-gray-50 border-b">
            <CardTitle className="text-lg font-medium" data-testid="text-company-name">
              {appSettings?.companyName || "Loading..."}
            </CardTitle>
            <p className="text-sm text-gray-600">Attendance</p>
            <p className="text-sm font-medium" data-testid="text-attendance-period">
              {appSettings?.rigName || "Loading..."} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
              MONTH:-{monthNames[parseInt(selectedMonth) - 1].toUpperCase()}. {selectedYear}
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {/* Designation Filter */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Filter by Designation:</label>
                <Select value={selectedDesignation} onValueChange={setSelectedDesignation}>
                  <SelectTrigger className="w-48" data-testid="select-designation-filter">
                    <SelectValue placeholder="Filter by designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Designations</SelectItem>
                    {uniqueDesignations.map(designation => (
                      <SelectItem key={designation} value={designation}>
                        {designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full attendance-table">
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r" data-testid="header-select">
                      SELECT
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r" data-testid="header-sl-no">
                      SL.NO
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r" data-testid="header-name">
                      NAME
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r" data-testid="header-designation">
                      DESIGNATION
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r" data-testid="header-status">
                      STATUS
                    </th>
                    {dayColumns.map((day, dayIndex) => (
                      <th key={day} className={`px-1 py-2 text-center text-xs font-extrabold text-gray-700 border-r w-8 day-header day-column-${dayIndex}`} data-testid={`header-day-${day}`}>
                        {day}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-extrabold text-gray-700 border-r" data-testid="header-total-on-duty">
                      T/ON DUTY
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-extrabold text-gray-700 border-r" data-testid="header-ot-days">
                      OT DAYS
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-extrabold text-gray-700" data-testid="header-remarks">
                      REMARKS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={dayColumns.length + 8} className="text-center py-8 text-gray-500" data-testid="text-no-employees-attendance">
                        {employees.length === 0 ? "No employees found. Add employees to view attendance." : 
                         filteredEmployees.length === 0 ? "No employees match the selected designation." :
                         showAllEmployees ? "No active employees found for the selected designation." : 
                         "No employees selected. Use the employee selection panel above to select employees."}
                      </td>
                    </tr>
                  ) : (
                    displayEmployees.map((employee, index) => {
                      const totalPresent = dayColumns.filter(day => getAttendanceStatus(employee.id, day) === "P").length;
                      const totalOT = dayColumns.filter(day => getAttendanceStatus(employee.id, day) === "OT").length;

                      return (
                        <tr 
                          key={employee.id} 
                          className="hover:bg-gray-50" 
                          data-testid={`row-employee-${employee.id}`}
                        >
                          <td className="px-2 py-2 text-sm border-r text-center" data-testid={`radio-select-${employee.id}`}>
                            <input
                              type="radio"
                              name="selectedEmployee"
                              checked={selectedRowId === employee.id}
                              onChange={() => {
                                setSelectedRowId(employee.id);
                                setShowDateRangeModal(true);
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2 text-sm border-r" data-testid={`text-serial-${employee.id}`}>
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium border-r" data-testid={`text-name-${employee.id}`}>
                            {employee.name}
                          </td>
                          <td className="px-4 py-2 text-sm border-r" data-testid={`text-designation-${employee.id}`}>
                            {employee.designation || "-"}
                          </td>
                          <td className={`px-4 py-2 text-sm border-r font-medium capitalize ${
                            employee.isActive 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`} data-testid={`text-status-${employee.id}`}>
                            {employee.isActive ? 'Active' : 'Inactive'}
                          </td>
                          {dayColumns.map((day, dayIndex) => {
                            const status = getAttendanceStatus(employee.id, day);
                            return (
                              <td 
                                key={day} 
                                className={`px-1 py-2 text-center text-xs border-r cursor-pointer day-cell day-column-${dayIndex} ${
                                  status === "P" ? "bg-green-50 text-green-700" : 
                                  status === "A" ? "bg-red-50 text-red-700" : 
                                  status === "OT" ? "bg-yellow-50 text-yellow-800" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCell({ employeeId: employee.id, day, currentStatus: status });
                                }}
                                data-testid={`cell-attendance-${employee.id}-${day}`}
                                title="Click to edit attendance"
                              >
                                {status}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-center text-sm border-r font-medium" data-testid={`text-total-present-${employee.id}`}>
                            {totalPresent}
                          </td>
                          <td className="px-2 py-2 text-center text-sm border-r font-medium" data-testid={`text-total-ot-${employee.id}`}>
                            {totalOT}
                          </td>
                          <td className="px-4 py-2 text-center text-sm" data-testid={`text-remarks-${employee.id}`}>
                            <input
                              type="text"
                              value={remarksState[employee.id] || ""}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setRemarksState(prev => ({
                                  ...prev,
                                  [employee.id]: newValue
                                }));
                                debouncedUpdateRemarks(employee.id, newValue);
                              }}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Add remarks..."
                              data-testid={`input-remarks-${employee.id}`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultMonth={selectedMonth}
        defaultYear={selectedYear}
        selectedEmployees={selectedEmployees}
        showAllEmployees={showAllEmployees}
      />

      {/* Attendance Status Dialog */}
      {selectedCell && (
        <Dialog open={true} onOpenChange={() => setSelectedCell(null)}>
          <DialogContent className="w-full max-w-sm" aria-describedby="attendance-status-description">
            <DialogHeader>
              <DialogTitle>
                Day {selectedCell.day} Attendance
              </DialogTitle>
            </DialogHeader>

            <div id="attendance-status-description" className="sr-only">
              Select attendance status for the selected day
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select attendance status:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedCell.currentStatus === "" 
                      ? "bg-slate-100 text-slate-900 border-slate-700 shadow-sm" 
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                  onClick={() => updateAttendanceMutation.mutate({
                    employeeId: selectedCell.employeeId,
                    day: selectedCell.day,
                    status: ""
                  })}
                  disabled={updateAttendanceMutation.isPending}
                >
                  Blank
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedCell.currentStatus === "P" 
                      ? "bg-emerald-100 text-emerald-800 border-emerald-600 shadow-sm" 
                      : "bg-emerald-50 text-emerald-700 border-emerald-400 hover:bg-emerald-100 hover:border-emerald-500"
                  }`}
                  onClick={() => updateAttendanceMutation.mutate({
                    employeeId: selectedCell.employeeId,
                    day: selectedCell.day,
                    status: "P"
                  })}
                  disabled={updateAttendanceMutation.isPending}
                >
                  Present (P)
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedCell.currentStatus === "A" 
                      ? "bg-rose-100 text-rose-800 border-rose-600 shadow-sm" 
                      : "bg-rose-50 text-rose-700 border-rose-400 hover:bg-rose-100 hover:border-rose-500"
                  }`}
                  onClick={() => updateAttendanceMutation.mutate({
                    employeeId: selectedCell.employeeId,
                    day: selectedCell.day,
                    status: "A"
                  })}
                  disabled={updateAttendanceMutation.isPending}
                >
                  Absent (A)
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedCell.currentStatus === "OT" 
                      ? "bg-amber-100 text-amber-900 border-amber-600 shadow-sm" 
                      : "bg-amber-50 text-amber-800 border-amber-400 hover:bg-amber-100 hover:border-amber-500"
                  }`}
                  onClick={() => updateAttendanceMutation.mutate({
                    employeeId: selectedCell.employeeId,
                    day: selectedCell.day,
                    status: "OT"
                  })}
                  disabled={updateAttendanceMutation.isPending}
                >
                  Overtime (OT)
                </Button>
              </div>

              {updateAttendanceMutation.isPending && (
                <p className="text-sm text-gray-500 text-center">Updating...</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSettingsUpdate={handleSettingsUpdate}
      />

      {/* Bulk Operations Modal */}
      <Dialog open={showDateRangeModal} onOpenChange={(open) => {
        if (!open) {
          setShowDateRangeModal(false);
          setSelectedRowId(null);
          setStartDate("");
          setEndDate("");
        }
      }}>
        <DialogContent className="max-w-md" aria-describedby="bulk-operations-description">
          <DialogHeader>
            <DialogTitle>Bulk Operations</DialogTitle>
          </DialogHeader>

          <div id="bulk-operations-description" className="sr-only">
            Select date range and operation to apply to selected employee row
          </div>

          <div className="space-y-4">
            {!selectedRowId && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Please select a row first by clicking on an employee row in the table.
                </p>
              </div>
            )}

            {selectedRowId && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Selected Employee: {employees.find(emp => emp.id === selectedRowId)?.name}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="number"
                  min="1"
                  max={daysInMonth}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="number"
                  min="1"
                  max={daysInMonth}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={daysInMonth.toString()}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Valid range: 1 to {daysInMonth} for {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Fill Range With:</p>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleBulkClear}
                  disabled={!selectedRowId || bulkUpdateAttendanceMutation.isPending}
                  variant="outline"
                  className="border-2 border-slate-400 text-slate-600 hover:bg-slate-50 hover:border-slate-500"
                  data-testid="button-fill-blank"
                >
                  Blank
                </Button>
                
                <Button
                  onClick={() => handleBulkFill("P")}
                  disabled={!selectedRowId || bulkUpdateAttendanceMutation.isPending}
                  variant="outline"
                  className="border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500"
                  data-testid="button-fill-present"
                >
                  Present (P)
                </Button>
                
                <Button
                  onClick={() => handleBulkFill("A")}
                  disabled={!selectedRowId || bulkUpdateAttendanceMutation.isPending}
                  variant="outline"
                  className="border-2 border-rose-400 text-rose-700 hover:bg-rose-50 hover:border-rose-500"
                  data-testid="button-fill-absent"
                >
                  Absent (A)
                </Button>
                
                <Button
                  onClick={() => handleBulkFill("OT")}
                  disabled={!selectedRowId || bulkUpdateAttendanceMutation.isPending}
                  variant="outline"
                  className="border-2 border-amber-400 text-amber-800 hover:bg-amber-50 hover:border-amber-500"
                  data-testid="button-fill-overtime"
                >
                  Overtime (OT)
                </Button>
              </div>
            </div>

            {bulkUpdateAttendanceMutation.isPending && (
              <p className="text-sm text-gray-500 text-center">Updating attendance...</p>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                onClick={() => {
                  setShowDateRangeModal(false);
                  setSelectedRowId(null);
                  setStartDate("");
                  setEndDate("");
                }}
                variant="outline"
                className="bg-gray-600 hover:bg-gray-700 text-white border-2 border-gray-600 hover:border-gray-700 font-medium px-4 py-2"
                data-testid="button-cancel-bulk"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowDateRangeModal(false);
                  setSelectedRowId(null);
                  setStartDate("");
                  setEndDate("");
                }}
                variant="outline"
                className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700 font-medium px-4 py-2"
                data-testid="button-close-bulk"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
