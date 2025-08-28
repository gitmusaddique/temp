import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, X, Bell, Settings, Building } from "lucide-react";
import { Link, useParams } from "wouter";
import type { Employee, AttendanceRecord, ShiftAttendanceRecord } from "@shared/schema";
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
  const { workspaceId } = useParams();
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
  const [modalStatusFilter, setModalStatusFilter] = useState("active"); // Default to active filter
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appSettings, setAppSettings] = useState<{ companyName: string; rigName: string } | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"fill" | "clear" | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [selectedRemarksEmployee, setSelectedRemarksEmployee] = useState<{id: string, name: string} | null>(null);
  const [tableView, setTableView] = useState<"attendance" | "shift">("attendance");
  const [selectedShiftCell, setSelectedShiftCell] = useState<{employeeId: string, day: number, currentShift: string} | null>(null);
  const [selectedBulkShift, setSelectedBulkShift] = useState<string>("D");
  const [selectedIndividualShift, setSelectedIndividualShift] = useState<string>("D");

  // Fetch workspace info
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      return response.json();
    },
  });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  if (!workspaceId) {
    return <div>Invalid workspace</div>;
  }

  // Load settings from database
  const { data: settings } = useQuery({
    queryKey: ["/api/settings", workspaceId],
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (settings) {
      setAppSettings(settings);
    }
  }, [settings]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const response = await fetch(`/api/employees/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      return response.json();
    },
    enabled: !!workspaceId,
  });

  // Fetch attendance records
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', workspaceId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!workspaceId) return [];
      const response = await fetch(`/api/attendance/${workspaceId}/${selectedMonth}/${selectedYear}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      return response.json();
    },
    enabled: !!workspaceId,
  });

  // Fetch shift attendance records
  const { data: shiftAttendanceRecords = [], isLoading: shiftLoading } = useQuery({
    queryKey: ['shift-attendance', workspaceId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!workspaceId) return [];
      const response = await fetch(`/api/shift-attendance/${workspaceId}/${selectedMonth}/${selectedYear}`);
      if (!response.ok) {
        throw new Error('Failed to fetch shift attendance records');
      }
      return response.json();
    },
    enabled: !!workspaceId,
  });

  if (employeesLoading || attendanceLoading || shiftLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading attendance data...</h2>
          <p className="text-gray-600">Please wait while we fetch the latest information.</p>
        </div>
      </div>
    );
  }

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

  // Initialize selectedEmployees with all active employees when data loads
  React.useEffect(() => {
    if (employees.length > 0 && selectedEmployees.size === 0) {
      const activeEmployeeIds = employees.filter(emp => emp.isActive).map(emp => emp.id);
      setSelectedEmployees(new Set(activeEmployeeIds));
    }
  }, [employees]);

  // Reset modal designation filter when main designation changes
  React.useEffect(() => {
    setModalDesignationFilter("all");
    setModalStatusFilter("active"); // Reset to active filter
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

  // Get shift attendance for a specific employee and day
  const getShiftAttendance = (employeeId: string, day: number): string => {
    const record = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
    if (!record || !record.shiftData) return "";

    try {
      const data = JSON.parse(record.shiftData) as Record<string, string>;
      return data[day.toString()] || "";
    } catch {
      return "";
    }
  };

  // Check if day has P or OT status (required for shift entry)
  const canEnterShift = (employeeId: string, day: number): boolean => {
    const status = getAttendanceStatus(employeeId, day);
    return status === "P" || status === "OT";
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

      const response = await apiRequest('POST', `/api/attendance/${workspaceId}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", workspaceId, selectedMonth, selectedYear] });
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

  // Update shift attendance mutation
  const updateShiftAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, day, shift }: { employeeId: string, day: number, shift: string }) => {
      const existingRecord = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
      let shiftData: Record<string, string> = {};

      if (existingRecord && existingRecord.shiftData) {
        try {
          shiftData = JSON.parse(existingRecord.shiftData) as Record<string, string>;
        } catch {
          shiftData = {};
        }
      }

      if (shift === "blank") {
        delete shiftData[day.toString()];
      } else {
        shiftData[day.toString()] = shift;
      }

      const response = await fetch(`/api/shift-attendance/${workspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          shiftData: JSON.stringify(shiftData),
          totalOnDuty: Object.values(shiftData).filter(s => s === "P").length
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update shift attendance');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-attendance", workspaceId, selectedMonth, selectedYear] });
      toast({
        title: "Success",
        description: "Shift attendance updated successfully"
      });
      setSelectedShiftCell(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update shift attendance",
        variant: "destructive"
      });
    }
  });

  // Bulk update shift attendance mutation
  const bulkUpdateShiftAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, startDay, endDay, shift }: { employeeId: string, startDay: number, endDay: number, shift: string }) => {
      const existingRecord = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
      let shiftData: Record<string, string> = {};

      if (existingRecord && existingRecord.shiftData) {
        try {
          shiftData = JSON.parse(existingRecord.shiftData) as Record<string, string>;
        } catch {
          shiftData = {};
        }
      }

      // Update all days in the range (only if main attendance is P or OT)
      for (let day = startDay; day <= endDay; day++) {
        const canEnter = canEnterShift(employeeId, day);
        if (canEnter) {
          if (shift === "blank") {
            delete shiftData[day.toString()];
          } else {
            shiftData[day.toString()] = shift;
          }
        }
      }

      const response = await fetch(`/api/shift-attendance/${workspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          shiftData: JSON.stringify(shiftData),
          totalOnDuty: Object.values(shiftData).filter(s => s === "P").length
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update shift attendance');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-attendance", workspaceId, selectedMonth, selectedYear] });
      toast({
        title: "Success",
        description: "Shift attendance updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update shift attendance",
        variant: "destructive"
      });
    }
  });

  // Bulk update attendance mutation
  const bulkUpdateAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, startDay, endDay, status, shift }: { employeeId: string, startDay: number, endDay: number, status: string, shift?: string }) => {
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
        if (status === "blank") {
          delete attendanceData[day.toString()];
        } else {
          attendanceData[day.toString()] = status;
        }
      }

      const response = await fetch(`/api/attendance/${workspaceId}`, {
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

      // If status is P or OT and shift is provided, update shift data for the range
      if ((status === "P" || status === "OT") && shift) {
        const existingShiftRecord = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
        let shiftData: Record<string, string> = {};

        if (existingShiftRecord && existingShiftRecord.shiftData) {
          try {
            shiftData = JSON.parse(existingShiftRecord.shiftData) as Record<string, string>;
          } catch {
            shiftData = {};
          }
        }

        // Update all days in the range
        for (let day = startDay; day <= endDay; day++) {
          shiftData[day.toString()] = shift;
        }

        await fetch(`/api/shift-attendance/${workspaceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            employeeId,
            month: parseInt(selectedMonth),
            year: parseInt(selectedYear),
            shiftData: JSON.stringify(shiftData),
            totalOnDuty: Object.values(shiftData).filter(s => s === "P").length
          })
        });
      } else if (status === "" || status === "A") {
        // Clear shift data for the range if attendance is cleared or absent
        const existingShiftRecord = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
        if (existingShiftRecord && existingShiftRecord.shiftData) {
          let shiftData: Record<string, string> = {};
          try {
            shiftData = JSON.parse(existingShiftRecord.shiftData) as Record<string, string>;
          } catch {
            shiftData = {};
          }

          // Clear all days in the range
          for (let day = startDay; day <= endDay; day++) {
            delete shiftData[day.toString()];
          }

          await fetch(`/api/shift-attendance/${workspaceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              employeeId,
              month: parseInt(selectedMonth),
              year: parseInt(selectedYear),
              shiftData: JSON.stringify(shiftData),
              totalOnDuty: Object.values(shiftData).filter(s => s === "P").length
            })
          });
        }
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", workspaceId, selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-attendance", workspaceId, selectedMonth, selectedYear] });
      toast({
        title: "Success",
        description: "Attendance and shift updated successfully"
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
        description: "Failed to update attendance or shift",
        variant: "destructive"
      });
    }
  });

  // Update attendance mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, day, status, shift }: { employeeId: string, day: number, status: string, shift?: string }) => {
      const existingRecord = attendanceRecords.find(r => r.employeeId === employeeId);
      let attendanceData: Record<string, string> = {};

      if (existingRecord && existingRecord.attendanceData) {
        try {
          attendanceData = JSON.parse(existingRecord.attendanceData) as Record<string, string>;
        } catch {
          attendanceData = {};
        }
      }

      if (status === "blank") {
        delete attendanceData[day.toString()];
      } else {
        attendanceData[day.toString()] = status;
      }

      const response = await fetch(`/api/attendance/${workspaceId}`, {
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

      // If status is P or OT and shift is provided, update shift data
      if ((status === "P" || status === "OT") && shift) {
        const existingShiftRecord = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
        let shiftData: Record<string, string> = {};

        if (existingShiftRecord && existingShiftRecord.shiftData) {
          try {
            shiftData = JSON.parse(existingShiftRecord.shiftData) as Record<string, string>;
          } catch {
            shiftData = {};
          }
        }

        shiftData[day.toString()] = shift;

        await fetch(`/api/shift-attendance/${workspaceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            employeeId,
            month: parseInt(selectedMonth),
            year: parseInt(selectedYear),
            shiftData: JSON.stringify(shiftData),
            totalOnDuty: Object.values(shiftData).filter(s => s === "P").length
          })
        });
      } else if (status === "" || status === "A") {
        // Clear shift data if attendance is cleared or absent
        const existingShiftRecord = shiftAttendanceRecords.find(r => r.employeeId === employeeId);
        if (existingShiftRecord && existingShiftRecord.shiftData) {
          let shiftData: Record<string, string> = {};
          try {
            shiftData = JSON.parse(existingShiftRecord.shiftData) as Record<string, string>;
          } catch {
            shiftData = {};
          }

          delete shiftData[day.toString()];

          await fetch(`/api/shift-attendance/${workspaceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              employeeId,
              month: parseInt(selectedMonth),
              year: parseInt(selectedYear),
              shiftData: JSON.stringify(shiftData),
              totalOnDuty: Object.values(shiftData).filter(s => s === "P").length
            })
          });
        }
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", workspaceId, selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-attendance", workspaceId, selectedMonth, selectedYear] });
      toast({
        title: "Success",
        description: "Attendance and shift updated successfully"
      });
      setSelectedCell(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attendance or shift",
        variant: "destructive"
      });
    }
  });

  const handleSettingsUpdate = (settings: { companyName: string; rigName: string }) => {
    setAppSettings(settings);
  };

  // Validate date range
  const validateDateRange = (start: string, end: string): boolean => {
    if (!start || !end || start.trim() === "" || end.trim() === "") {
      return false;
    }

    const startDay = parseInt(start);
    const endDay = parseInt(end);

    if (isNaN(startDay) || isNaN(endDay) || startDay < 1 || endDay < 1 || startDay > daysInMonth || endDay > daysInMonth) {
      return false;
    }

    return startDay <= endDay;
  };

  // Handle bulk fill
  const handleBulkFill = (status: string) => {
    if (!selectedRowId) {
      toast({
        title: "Error", 
        description: "Please select an employee first by clicking the radio button",
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate || startDate.trim() === "" || endDate.trim() === "") {
      toast({
        title: "Error",
        description: "Please enter both start and end dates",
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

    const shiftToUse = (status === "P" || status === "OT") ? selectedBulkShift : "";

    bulkUpdateAttendanceMutation.mutate({
      employeeId: selectedRowId,
      startDay: parseInt(startDate),
      endDay: parseInt(endDate),
      status,
      shift: shiftToUse
    });
  };

  // Handle bulk clear
  const handleBulkClear = () => {
    if (!selectedRowId) {
      toast({
        title: "Error",
        description: "Please select an employee first by clicking the radio button", 
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate || startDate.trim() === "" || endDate.trim() === "") {
      toast({
        title: "Error",
        description: "Please enter both start and end dates",
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
      status: "blank" // Use "blank" to clear
    });
  };

  // Handle bulk shift fill
  const handleBulkShiftFill = (shift: string) => {
    if (!selectedRowId) {
      toast({
        title: "Error",
        description: "Please select an employee first by clicking the radio button",
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate || startDate.trim() === "" || endDate.trim() === "") {
      toast({
        title: "Error",
        description: "Please enter both start and end dates",
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

    bulkUpdateShiftAttendanceMutation.mutate({
      employeeId: selectedRowId,
      startDay: parseInt(startDate),
      endDay: parseInt(endDate),
      shift
    });
  };

  // Column highlighting handlers
  const handleColumnMouseEnter = (dayIndex: number) => {
    setHoveredColumn(dayIndex);
  };

  const handleColumnMouseLeave = () => {
    setHoveredColumn(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Attendance Management - {currentWorkspace?.name || workspaceId}
              </h1>
              <p className="text-gray-600">Track and manage employee attendance</p>
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
                    setShowAllEmployees(false);
                  }}
                  data-testid="button-toggle-employee-view"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-600 hover:border-blue-700 font-medium px-4 py-2"
                >
                  {showAllEmployees ? `Selected (${selectedEmployees.size})` : `Selected (${selectedEmployees.size})`}
                </Button>

                <Select value={tableView} onValueChange={(value: "attendance" | "shift") => setTableView(value)}>
                  <SelectTrigger className="w-40 bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-600 hover:border-purple-700 font-medium" data-testid="select-table-view">
                    <SelectValue placeholder="Select table view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance Table</SelectItem>
                    <SelectItem value="shift">Shift Table</SelectItem>
                  </SelectContent>
                </Select>

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
        <DialogContent className="w-full max-w-4xl h-[80vh] flex flex-col" aria-describedby="employee-selection-description">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Select Employees for Attendance</DialogTitle>
          </DialogHeader>

          <div id="employee-selection-description" className="sr-only">
            Select employees to include in the attendance view
          </div>

          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Designation and Status Filters for Modal */}
            <div className="flex-shrink-0 pb-4 border-b flex justify-between items-center">
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

            {/* Employee Grid - Scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {modalFilteredEmployees.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-center text-gray-500 py-8">
                    No employees found for the selected filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
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
              )}
            </div>

            {/* Footer with buttons - Fixed at bottom */}
            <div className="flex-shrink-0 pt-4 border-t bg-white">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {selectedEmployees.size} of {filteredEmployees.length} employee(s) selected
                  {(modalDesignationFilter !== "all" || modalStatusFilter !== "all") && (
                    <span className="text-gray-500"> • Showing {modalFilteredEmployees.length} for current filters</span>
                  )}
                </p>
              </div>
              <div className="flex justify-end space-x-2">
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

      {/* Table Container */}
      <div className="max-w-full mx-auto px-4 py-8">
        <style jsx>{`
          .attendance-table tbody tr:hover {
            background-color: #f8fafc !important;
          }
          .attendance-table tbody tr:hover td {
            background-color: #f8fafc !important;
          }
          .attendance-table td.day-cell:hover {
            background-color: #dbeafe !important;
            transform: scale(1.02);
            transition: all 0.15s ease;
            position: relative;
            z-index: 10;
          }
          .attendance-table th.column-highlighted {
            background-color: #e0e7ff !important;
            position: relative;
          }
          .attendance-table td.column-highlighted {
            background-color: #dbeafe !important;
            position: relative;
          }
          .attendance-table th.sticky {
            position: sticky;
            z-index: 10;
          }
          .attendance-table td.sticky {
            position: sticky;
            z-index: 5;
          }
          .attendance-table tbody tr:hover td.sticky {
            background-color: #f8fafc !important;
          }
        `}</style>

        {tableView === "attendance" ? (
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
                      <th 
                        key={day} 
                        className={`px-1 py-2 text-center text-xs font-extrabold text-gray-700 border-r w-8 day-header ${
                          hoveredColumn === dayIndex ? 'column-highlighted' : ''
                        }`} 
                        data-testid={`header-day-${day}`}
                        onMouseEnter={() => handleColumnMouseEnter(dayIndex)}
                        onMouseLeave={handleColumnMouseLeave}
                      >
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
                                className={`px-1 py-2 text-center text-xs border-r cursor-pointer day-cell ${
                                  hoveredColumn === dayIndex ? 'column-highlighted' : ''
                                } ${
                                  status === "P" ? "bg-green-50 text-green-700" : 
                                  status === "A" ? "bg-red-50 text-red-700" : 
                                  status === "OT" ? "bg-yellow-50 text-yellow-800" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Pass the current shift if available, otherwise empty string
                                  const currentShift = getShiftAttendance(employee.id, day);
                                  setSelectedCell({ employeeId: employee.id, day, currentStatus: status });
                                }}
                                onMouseEnter={() => handleColumnMouseEnter(dayIndex)}
                                onMouseLeave={handleColumnMouseLeave}
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
                            <div
                              onClick={() => setSelectedRemarksEmployee({id: employee.id, name: employee.name})}
                              className="min-h-[28px] px-2 py-1 text-xs border border-gray-200 rounded cursor-pointer hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all max-w-32 mx-auto"
                              data-testid={`input-remarks-${employee.id}`}
                              title="Click to edit remarks"
                            >
                              {remarksState[employee.id] ? (
                                <span className="text-gray-900 truncate block">
                                  {remarksState[employee.id]}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">
                                  Add remarks...
                                </span>
                              )}
                            </div>
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
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="text-center bg-gray-50 border-b">
              <CardTitle className="text-lg font-medium">
                {appSettings?.companyName || "Loading..."} - Shift Attendance
              </CardTitle>
              <p className="text-sm text-gray-600">Day & Night Shifts</p>
              <p className="text-sm font-medium">
                {appSettings?.rigName || "Loading..."} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                MONTH:-{monthNames[parseInt(selectedMonth) - 1].toUpperCase()}. {selectedYear}
              </p>
            </CardHeader>

            <CardContent className="p-0">
              {/* Designation Filter for Shift Table */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Filter by Designation:</label>
                  <Select value={selectedDesignation} onValueChange={setSelectedDesignation}>
                    <SelectTrigger className="w-48" data-testid="select-designation-filter-shift">
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
                      <th className="px-2 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r sticky left-0 bg-gray-50 z-20">
                        SL.NO
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r sticky left-12 bg-gray-50 z-20 min-w-[200px]">
                        NAME
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-extrabold text-gray-700 uppercase border-r sticky left-60 bg-gray-50 z-20 min-w-[150px]">
                        DESIGNATION
                      </th>
                      {dayColumns.map((day, dayIndex) => (
                        <th key={day} className="border-r">
                          <div className="text-center">
                            <div className="px-1 py-1 text-xs font-extrabold text-gray-700 border-b">
                              {day}
                            </div>
                            <div className="grid grid-cols-2">
                              <div className="px-1 py-1 text-xs font-extrabold text-gray-700 border-r bg-blue-50">
                                D
                              </div>
                              <div className="px-1 py-1 text-xs font-extrabold text-gray-700 bg-indigo-50">
                                N
                              </div>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center text-xs font-extrabold text-gray-700">
                        T/ON DUTY
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={dayColumns.length + 4} className="text-center py-8 text-gray-500">
                          {employees.length === 0 ? "No employees found. Add employees to view shift attendance." : 
                           filteredEmployees.length === 0 ? "No employees match the selected designation." :
                           showAllEmployees ? "No active employees found for the selected designation." : 
                           "No employees selected. Use the employee selection panel above to select employees."}
                        </td>
                      </tr>
                    ) : (
                      displayEmployees.map((employee, index) => {
                        const totalShiftPresent = dayColumns.filter(day => getShiftAttendance(employee.id, day) === "P").length;

                        return (
                          <tr key={employee.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2 text-sm border-r sticky left-0 bg-white z-10">
                              {index + 1}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium border-r sticky left-12 bg-white z-10 min-w-[200px]">
                              {employee.name}
                            </td>
                            <td className="px-4 py-2 text-sm border-r sticky left-60 bg-white z-10 min-w-[150px]">
                              {employee.designation || "-"}
                            </td>
                            {dayColumns.map((day) => {
                              const canEnter = canEnterShift(employee.id, day);
                              const currentShift = getShiftAttendance(employee.id, day);

                              return (
                                <td key={day} className="border-r">
                                  <div className="grid grid-cols-2 h-full">
                                    <div 
                                      className={`px-1 py-2 text-center text-xs border-r cursor-pointer ${
                                        !canEnter ? "bg-gray-100 cursor-not-allowed" :
                                        currentShift === "D" ? "bg-blue-100 text-blue-800" : "hover:bg-blue-50"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (canEnter) {
                                          setSelectedShiftCell({ 
                                            employeeId: employee.id, 
                                            day, 
                                            currentShift: currentShift || ""
                                          });
                                        }
                                      }}
                                      title={!canEnter ? "Employee must have P or OT status to enter shift" : "Click to edit Day shift"}
                                      data-testid={`cell-day-shift-${employee.id}-${day}`}
                                    >
                                      {currentShift === "D" ? "P" : ""}
                                    </div>
                                    <div 
                                      className={`px-1 py-2 text-center text-xs cursor-pointer ${
                                        !canEnter ? "bg-gray-100 cursor-not-allowed" :
                                        currentShift === "N" ? "bg-indigo-100 text-indigo-800" : "hover:bg-indigo-50"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (canEnter) {
                                          setSelectedShiftCell({ 
                                            employeeId: employee.id, 
                                            day, 
                                            currentShift: currentShift || ""
                                          });
                                        }
                                      }}
                                      title={!canEnter ? "Employee must have P or OT status to enter shift" : "Click to edit Night shift"}
                                      data-testid={`cell-night-shift-${employee.id}-${day}`}
                                    >
                                      {currentShift === "N" ? "P" : ""}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-center text-sm font-medium">
                              {totalShiftPresent}
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
        )}
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultMonth={selectedMonth}
        defaultYear={selectedYear}
        selectedEmployees={selectedEmployees}
        showAllEmployees={showAllEmployees}
      />

      {/* Shift Selection Dialog */}
      {selectedShiftCell && (
        <Dialog open={true} onOpenChange={() => setSelectedShiftCell(null)}>
          <DialogContent className="w-full max-w-sm" aria-describedby="shift-selection-description">
            <DialogHeader>
              <DialogTitle>
                Day {selectedShiftCell.day} Shift Selection
              </DialogTitle>
            </DialogHeader>

            <div id="shift-selection-description" className="sr-only">
              Select shift (Day or Night) for the selected day
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select shift:
              </p>

              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedShiftCell.currentShift === "blank" 
                      ? "bg-slate-100 text-slate-900 border-slate-700 shadow-sm" 
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                  onClick={() => updateShiftAttendanceMutation.mutate({
                    employeeId: selectedShiftCell.employeeId,
                    day: selectedShiftCell.day,
                    shift: "blank"
                  })}
                  disabled={updateShiftAttendanceMutation.isPending}
                >
                  Clear
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedShiftCell.currentShift === "D" 
                      ? "bg-blue-100 text-blue-800 border-blue-600 shadow-sm" 
                      : "bg-blue-50 text-blue-700 border-blue-400 hover:bg-blue-100 hover:border-blue-500"
                  }`}
                  onClick={() => updateShiftAttendanceMutation.mutate({
                    employeeId: selectedShiftCell.employeeId,
                    day: selectedShiftCell.day,
                    shift: "D"
                  })}
                  disabled={updateShiftAttendanceMutation.isPending}
                >
                  Day (D)
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start border-2 transition-all duration-200 ${
                    selectedShiftCell.currentShift === "N" 
                      ? "bg-indigo-100 text-indigo-800 border-indigo-600 shadow-sm" 
                      : "bg-indigo-50 text-indigo-700 border-indigo-400 hover:bg-indigo-100 hover:border-indigo-500"
                  }`}
                  onClick={() => updateShiftAttendanceMutation.mutate({
                    employeeId: selectedShiftCell.employeeId,
                    day: selectedShiftCell.day,
                    shift: "N"
                  })}
                  disabled={updateShiftAttendanceMutation.isPending}
                >
                  Night (N)
                </Button>
              </div>

              {updateShiftAttendanceMutation.isPending && (
                <p className="text-sm text-gray-500 text-center">Updating shift...</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

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
              Select attendance status and shift for the selected day
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Attendance Status:
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
                      status: "blank",
                      shift: "" // Clear shift when attendance is cleared
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
                      status: "P",
                      shift: selectedIndividualShift || "D"
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
                      status: "A",
                      shift: "" // Clear shift when 'A' is selected
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
                      status: "OT",
                      shift: selectedIndividualShift || "D"
                    })}
                    disabled={updateAttendanceMutation.isPending}
                  >
                    Overtime (OT)
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Shift (for P/OT status):
                </p>
                <Select value={selectedIndividualShift} onValueChange={setSelectedIndividualShift}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Blank</SelectItem>
                    <SelectItem value="D">Day (D)</SelectItem>
                    <SelectItem value="N">Night (N)</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Remarks Modal */}
      <Dialog open={!!selectedRemarksEmployee} onOpenChange={(open) => {
        if (!open) {
          setSelectedRemarksEmployee(null);
        }
      }}>
        <DialogContent className="max-w-lg" aria-describedby="remarks-modal-description">
          <DialogHeader>
            <DialogTitle>
              Edit Remarks - {selectedRemarksEmployee?.name}
            </DialogTitle>
          </DialogHeader>

          <div id="remarks-modal-description" className="sr-only">
            Edit remarks for the selected employee
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks
              </label>
              <textarea
                value={selectedRemarksEmployee ? (remarksState[selectedRemarksEmployee.id] || "") : ""}
                onChange={(e) => {
                  if (selectedRemarksEmployee) {
                    const newValue = e.target.value;
                    setRemarksState(prev => ({
                      ...prev,
                      [selectedRemarksEmployee.id]: newValue
                    }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none"
                placeholder="Enter remarks for this employee..."
                data-testid="textarea-remarks"
                rows={5}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setSelectedRemarksEmployee(null)}
                data-testid="button-cancel-remarks"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedRemarksEmployee) {
                    const remarksValue = remarksState[selectedRemarksEmployee.id] || "";
                    debouncedUpdateRemarks(selectedRemarksEmployee.id, remarksValue);
                    setSelectedRemarksEmployee(null);
                  }
                }}
                disabled={updateRemarksMutation.isPending}
                data-testid="button-save-remarks"
              >
                {updateRemarksMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty or valid numbers only
                    if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= daysInMonth)) {
                      setStartDate(value);
                    }
                  }}
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
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty or valid numbers only
                    if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= daysInMonth)) {
                      setEndDate(value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={daysInMonth.toString()}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Valid range: 1 to {daysInMonth} for {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
            </p>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Attendance Status:</p>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleBulkClear()}
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

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Shift (for P/OT status):</p>
                <Select value={selectedBulkShift} onValueChange={setSelectedBulkShift}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Blank</SelectItem>
                    <SelectItem value="D">Day (D)</SelectItem>
                    <SelectItem value="N">Night (N)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tableView === "shift" && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Fill Shift Range With:</p>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        onClick={() => handleBulkShiftFill("blank")}
                        disabled={!selectedRowId || bulkUpdateShiftAttendanceMutation.isPending}
                        variant="outline"
                        className="border-2 border-slate-400 text-slate-600 hover:bg-slate-50 hover:border-slate-500"
                        data-testid="button-fill-shift-blank"
                      >
                        Clear Shift
                      </Button>

                      <Button
                        onClick={() => handleBulkShiftFill("D")}
                        disabled={!selectedRowId || bulkUpdateShiftAttendanceMutation.isPending}
                        variant="outline"
                        className="border-2 border-blue-400 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                        data-testid="button-fill-day-shift"
                      >
                        Day (D)
                      </Button>

                      <Button
                        onClick={() => handleBulkShiftFill("N")}
                        disabled={!selectedRowId || bulkUpdateShiftAttendanceMutation.isPending}
                        variant="outline"
                        className="border-2 border-indigo-400 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500"
                        data-testid="button-fill-night-shift"
                      >
                        Night (N)
                      </Button>
                    </div>
                  </div>
                </>
              )}
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