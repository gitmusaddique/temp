import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import { User, Edit2, Trash2, Check, X } from "lucide-react";

interface EmployeeCardProps {
  employee: Employee;
  onDelete: () => void;
}

export default function EmployeeCard({ employee, onDelete }: EmployeeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editData, setEditData] = useState({
    name: employee.name,
    designation: employee.designation || "",
    status: employee.status,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: Omit<typeof editData, 'id'> & { id: string | number }) => {
      await apiRequest("PUT", `/api/employees/${employee.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!editData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!editData.designation.trim()) {
      newErrors.designation = "Designation is required";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      updateEmployeeMutation.mutate({
        id: employee.id,
        name: editData.name,
        designation: editData.designation,
        status: editData.status,
      });
    }
  };

  const handleCancel = () => {
    setEditData({
      name: employee.name,
      designation: employee.designation || "",
      status: employee.status,
    });
    setIsEditing(false);
    setErrors({});
  };

  return (
    <Card className="hover:shadow-material-lg transition-shadow" data-testid={`card-employee-${employee.id}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="font-medium text-lg"
                    data-testid={`input-edit-name-${employee.id}`}
                  />
                  {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
                  <Input
                    value={editData.designation}
                    onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                    placeholder="Designation"
                    className="text-sm"
                    data-testid={`input-edit-designation-${employee.id}`}
                  />
                  {errors.designation && <p className="text-red-500 text-xs">{errors.designation}</p>}
                </div>
              ) : (
                <div>
                  <h3 className="font-medium text-lg" data-testid={`text-employee-name-${employee.id}`}>
                    {employee.name}
                  </h3>
                  <p className="text-sm text-gray-600" data-testid={`text-employee-designation-${employee.id}`}>
                    {employee.designation || "No designation"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-full hover:bg-green-50"
                  onClick={handleSave}
                  disabled={updateEmployeeMutation.isPending}
                  data-testid={`button-save-${employee.id}`}
                >
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-full hover:bg-gray-100"
                  onClick={handleCancel}
                  disabled={updateEmployeeMutation.isPending}
                  data-testid={`button-cancel-${employee.id}`}
                >
                  <X className="w-4 h-4 text-gray-600" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-full hover:bg-gray-100"
                  onClick={() => setIsEditing(true)}
                  data-testid={`button-edit-${employee.id}`}
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-full hover:bg-red-50"
                  onClick={onDelete}
                  data-testid={`button-delete-${employee.id}`}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Employee ID:</span>
            <span className="text-sm font-medium" data-testid={`text-employee-id-${employee.id}`}>
              {employee.employeeId}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Status:</span>
            {isEditing ? (
              <Select
                value={editData.status}
                onValueChange={(value) => setEditData({ ...editData, status: value as "Active" | "Inactive" })}
              >
                <SelectTrigger className="w-24 h-8" data-testid={`select-edit-status-${employee.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant={employee.status === "Active" ? "default" : "secondary"}
                className={employee.status === "Active" ? "bg-green-100 text-green-800" : ""}
                data-testid={`badge-employee-status-${employee.id}`}
              >
                {employee.status}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}