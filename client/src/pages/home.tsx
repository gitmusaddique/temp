import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import EmployeeCard from "@/components/employee-card";
import CreateEmployeeModal from "@/components/create-employee-modal";
import ExportModal from "@/components/export-modal";
import DeleteConfirmationModal from "@/components/delete-confirmation-modal";
import EditEmployeeModal from "@/components/edit-employee-modal";
import SettingsModal from "@/components/settings-modal";
import { Building, Download, CalendarDays, Search, Plus, Bell, Settings, User, Pencil, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appSettings, setAppSettings] = useState<{ companyName: string; rigName: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch app settings from the database
  const { data: settings, isLoading: isLoadingSettings } = useQuery<{ companyName: string; rigName: string }>({
    queryKey: ["/api/settings"],
  });

  // Update app settings when data is fetched
  useEffect(() => {
    if (settings) {
      setAppSettings(settings);
    }
  }, [settings]);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { companyName: string; rigName: string }) => {
      await apiRequest("POST", "/api/settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
      setShowSettingsModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  // Extract unique designations for the filter in the same order as database sorting
  const designationOrder = ['Rig I/C', 'Shift I/C', 'Asst Shift I/C', 'Top Man', 'Rig Man'];
  const employeeDesignations = Array.from(new Set(employees.map(emp => emp.designation).filter(Boolean) as string[]));
  const uniqueDesignations = designationOrder.filter(d => employeeDesignations.includes(d))
    .concat(employeeDesignations.filter(d => !designationOrder.includes(d)));

  // Filter employees based on search, designation, and status
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDesignation = selectedDesignation === "all" || employee.designation === selectedDesignation;
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
    return matchesSearch && matchesDesignation && matchesStatus;
  });

  const handleDeleteEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedEmployee) {
      deleteEmployeeMutation.mutate(selectedEmployee.id);
    }
  };

  const handleSettingsUpdate = (settings: { companyName: string; rigName: string }) => {
    updateSettingsMutation.mutate(settings);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white shadow-material sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="hover:shadow-material-lg transition-shadow cursor-pointer"
              onClick={() => setShowCreateModal(true)}
              data-testid="card-add-employee"
            >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium">Add Employee</h3>
                    <p className="text-sm text-gray-600">Create new employee record</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-material-lg transition-shadow cursor-pointer"
              onClick={() => setShowExportModal(true)}
              data-testid="card-export-data"
            >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Download className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium">Export Data</h3>
                    <p className="text-sm text-gray-600">Generate XLSX or PDF reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Link href="/attendance">
              <Card
                className="hover:shadow-material-lg transition-shadow cursor-pointer"
                data-testid="card-view-attendance"
              >
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                      <CalendarDays className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium">View Attendance</h3>
                      <p className="text-sm text-gray-600">Monthly attendance overview</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Employee List */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-medium" data-testid="text-employees-heading">Employees</h2>
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                  data-testid="input-search-employees"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status-filter-home">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
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

          <div className={filteredEmployees.length > 10 ? "max-h-[calc(100vh-400px)] overflow-y-auto" : ""}>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2" data-testid="text-no-employees">
                    {searchQuery || selectedDesignation !== "all" || statusFilter !== "all" ? "No employees found" : "No employees yet"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery || selectedDesignation !== "all" || statusFilter !== "all"
                      ? "Try adjusting your search or filter terms"
                      : "Start by adding your first employee to the system"
                    }
                  </p>
                  {!searchQuery && selectedDesignation === "all" && statusFilter === "all" && (
                    <Button onClick={() => setShowCreateModal(true)} data-testid="button-add-first-employee">
                      Add Employee
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredEmployees.map((employee, index) => (
                  <Card key={employee.id} className="hover:shadow-md transition-shadow" data-testid={`employee-card-${employee.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">{index + 1}</span>
                          </div>
                          <div className="flex items-center space-x-8 flex-1">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-base truncate" data-testid={`employee-name-${employee.id}`}>
                                {employee.name}
                              </h3>
                              <p className="text-sm text-gray-600 truncate">
                                ID: {employee.serialNumber}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <Badge variant="secondary" className="text-sm" data-testid={`employee-designation-${employee.id}`}>
                                {employee.designation}
                              </Badge>
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`text-sm font-medium px-2 py-1 rounded-full ${employee.status === 'Active' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                                {employee.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowEditModal(true);
                            }}
                            data-testid={`button-edit-${employee.id}`}
                            className="h-8 w-8"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEmployee(employee)}
                            data-testid={`button-delete-${employee.id}`}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateEmployeeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        employee={selectedEmployee}
        onConfirm={confirmDelete}
        isDeleting={deleteEmployeeMutation.isPending}
      />

      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        employee={selectedEmployee}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSettingsUpdate={handleSettingsUpdate}
      />
    </div>
  );
}