import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, X } from "lucide-react";
import { Link } from "wouter";
import type { Employee, AttendanceRecord } from "@shared/schema";
import ExportModal from "@/components/export-modal";
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

  // Get unique designations for filter (employees are already sorted by designation_order)
  const uniqueDesignations = Array.from(new Set(employees.map(emp => emp.designation).filter(Boolean)));

  // Filter employees by designation while preserving database sort order
  const filteredEmployees = selectedDesignation === "all" 
    ? employees 
    : employees.filter(emp => emp.designation === selectedDesignation);

  // Filter employees for modal by modal designation filter
  const modalFilteredEmployees = modalDesignationFilter === "all" 
    ? filteredEmployees 
    : filteredEmployees.filter(emp => emp.designation === modalDesignationFilter);

  // Final display employees - filtered by selection if not showing all
  const displayEmployees = showAllEmployees 
    ? filteredEmployees
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

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-white shadow-material">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
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
                  variant={showAllEmployees ? "default" : "outline"}
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
            {/* Designation Filter for Modal */}
            <div className="pb-4 border-b">
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
                {modalDesignationFilter !== "all" && (
                  <span className="text-gray-500"> • Showing {modalFilteredEmployees.length} for {modalDesignationFilter}</span>
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
        <Card className="overflow-hidden">
          <CardHeader className="text-center bg-gray-50 border-b">
            <CardTitle className="text-lg font-medium" data-testid="text-company-name">
              South Asia Consultancy
            </CardTitle>
            <p className="text-sm text-gray-600">Attendance</p>
            <p className="text-sm font-medium" data-testid="text-attendance-period">
              ROM-100-II &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
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
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-r" data-testid="header-sl-no">
                      SL.NO
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-r" data-testid="header-name">
                      NAME
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-r" data-testid="header-designation">
                      DESIGNATION
                    </th>
                    {dayColumns.map(day => (
                      <th key={day} className="px-1 py-2 text-center text-xs font-medium text-gray-500 border-r w-8" data-testid={`header-day-${day}`}>
                        {day}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 border-r" data-testid="header-total-on-duty">
                      T/ON DUTY
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 border-r" data-testid="header-ot-days">
                      OT DAYS
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500" data-testid="header-remarks">
                      REMARKS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={dayColumns.length + 6} className="text-center py-8 text-gray-500" data-testid="text-no-employees-attendance">
                        {employees.length === 0 ? "No employees found. Add employees to view attendance." : 
                         filteredEmployees.length === 0 ? "No employees match the selected designation." :
                         showAllEmployees ? "No employees match the selected designation." : 
                         "No employees selected. Use the employee selection panel above to select employees."}
                      </td>
                    </tr>
                  ) : (
                    displayEmployees.map((employee, index) => {
                      const totalPresent = dayColumns.filter(day => getAttendanceStatus(employee.id, day) === "P").length;
                      const totalOT = dayColumns.filter(day => getAttendanceStatus(employee.id, day) === "OT").length;

                      return (
                        <tr key={employee.id} className="hover:bg-gray-50" data-testid={`row-employee-${employee.id}`}>
                          <td className="px-2 py-2 text-sm border-r" data-testid={`text-serial-${employee.id}`}>
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium border-r" data-testid={`text-name-${employee.id}`}>
                            {employee.name}
                          </td>
                          <td className="px-4 py-2 text-sm border-r" data-testid={`text-designation-${employee.id}`}>
                            {employee.designation || "-"}
                          </td>
                          {dayColumns.map(day => {
                            const status = getAttendanceStatus(employee.id, day);
                            return (
                              <td 
                                key={day} 
                                className={`px-1 py-2 text-center text-xs border-r cursor-pointer hover:bg-blue-50 ${
                                  status === "P" ? "bg-green-50 text-green-700" : 
                                  status === "A" ? "bg-red-50 text-red-700" : 
                                  status === "OT" ? "bg-yellow-50 text-yellow-800" : "hover:bg-gray-100"
                                }`}
                                onClick={() => setSelectedCell({ employeeId: employee.id, day, currentStatus: status })}
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
    </div>
  );
}