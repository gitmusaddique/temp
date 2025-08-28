import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DESIGNATION_OPTIONS } from "@shared/schema";
import { X } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  designation: string;
  designationOrder: number;
  status: "Active" | "Inactive";
  workspaceId: string;
}

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeCreated: (employee: Employee) => void;
  workspaceId: string;
}

export function CreateEmployeeModal({ isOpen, onClose, onEmployeeCreated, workspaceId }: CreateEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    designationOrder: 999,
    status: "Active" as const,
  });

  const getDesignationOrder = (designation: string): number => {
    const designationNumbers: Record<string, number> = {
      'Rig I/C': 1,
      'Shift I/C': 2,
      'Asst Shift I/C': 3,
      'Top Man': 4,
      'Rig Man': 5
    };

    return designationNumbers[designation] || 999;
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const employeeData = { ...data, workspaceId };
      const response = await fetch(`/api/employees/${workspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employeeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create employee");
      }

      const createdEmployee: Employee = await response.json();
      return createdEmployee;
    },
    onSuccess: (newEmployee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", workspaceId] });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
      onEmployeeCreated(newEmployee);
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.designation.trim()) {
      newErrors.designation = "Designation is required";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const designationOrder = getDesignationOrder(formData.designation);
      createEmployeeMutation.mutate({ ...formData, designationOrder });
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      designation: "",
      designationOrder: 999,
      status: "Active",
    });
    setErrors({});
    onClose();
  };

  const designationOptions = DESIGNATION_OPTIONS;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md" data-testid="modal-create-employee" aria-describedby="create-employee-description">
        <DialogHeader>
          <DialogTitle>
            Add New Employee
          </DialogTitle>
        </DialogHeader>

        <div id="create-employee-description" className="sr-only">
          Create a new employee record with name, designation, and department information.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-4 rounded-lg">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter full name"
              className={errors.name ? "border-red-500" : ""}
              data-testid="input-employee-name"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1" data-testid="error-employee-name">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="designation" className="text-sm font-medium text-foreground">
              Designation *
            </Label>
            <Select
              value={formData.designation}
              onValueChange={(value) => {
                setFormData({ ...formData, designation: value });
              }}
            >
              <SelectTrigger className={errors.designation ? "border-red-500" : ""} data-testid="select-employee-designation">
                <SelectValue placeholder="Select designation" />
              </SelectTrigger>
              <SelectContent>
                {designationOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.designation && (
              <p className="text-sm text-red-600 mt-1" data-testid="error-employee-designation">
                {errors.designation}
              </p>
            )}
          </div>

          <div className="modal-buttons">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
              className="min-w-24 bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              data-testid="button-submit"
              className="min-w-32"
            >
              Create Employee
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateEmployeeModal;