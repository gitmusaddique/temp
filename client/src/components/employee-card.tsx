
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DESIGNATION_OPTIONS } from "@shared/schema";
import type { Employee } from "@shared/schema";
import { Pencil, Trash2, User } from "lucide-react";

interface EmployeeCardProps {
  employee: Employee;
  onDelete: () => void;
}

export default function EmployeeCard({ employee, onDelete }: EmployeeCardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: employee.name,
    designation: employee.designation,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
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

      const updateData = {
        ...data,
        designationOrder: getDesignationOrder(data.designation)
      };

      await apiRequest("PUT", `/api/employees/${employee.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
      setShowEditModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
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
      updateEmployeeMutation.mutate(formData);
    }
  };

  const handleEditClick = () => {
    setFormData({
      name: employee.name,
      designation: employee.designation,
    });
    setErrors({});
    setShowEditModal(true);
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow" data-testid={`employee-card-${employee.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-lg" data-testid={`employee-name-${employee.id}`}>
                  {employee.name}
                </h3>
                <Badge variant="secondary" className="text-xs" data-testid={`employee-designation-${employee.id}`}>
                  {employee.designation}
                </Badge>
                <p className="text-sm text-gray-600 mt-1">
                  ID: {employee.employeeId}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEditClick}
                data-testid={`button-edit-${employee.id}`}
                className="h-8 w-8"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                data-testid={`button-delete-${employee.id}`}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="w-full max-w-md" data-testid="modal-edit-employee">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Name *
              </Label>
              <Input
                id="edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
                className={errors.name ? "border-red-500" : ""}
                data-testid="input-edit-employee-name"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-designation" className="text-sm font-medium">
                Designation *
              </Label>
              <Select
                value={formData.designation}
                onValueChange={(value) => setFormData({ ...formData, designation: value })}
              >
                <SelectTrigger className={errors.designation ? "border-red-500" : ""} data-testid="select-edit-employee-designation">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {DESIGNATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.designation && (
                <p className="text-sm text-red-600 mt-1">{errors.designation}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateEmployeeMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateEmployeeMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
