import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateEmployeeModal({ isOpen, onClose }: CreateEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    department: "",
    status: "Active" as "Active" | "Inactive",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
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
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      createEmployeeMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      designation: "",
      department: "",
      status: "Active",
    });
    setErrors({});
    onClose();
  };

  const designationOptions = [
    "Rig I/C",
    "Shift I/C",
    "Asst.Shift I/C",
    "Top-Man",
    "Rig-Man",
  ];

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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
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
            <Label htmlFor="designation" className="text-sm font-medium text-gray-700">
              Designation
            </Label>
            <Select 
              value={formData.designation} 
              onValueChange={(value) => setFormData({ ...formData, designation: value })}
            >
              <SelectTrigger data-testid="select-employee-designation">
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
          </div>
          
          <div>
            <Label htmlFor="department" className="text-sm font-medium text-gray-700">
              Department
            </Label>
            <Input
              id="department"
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="Enter department"
              data-testid="input-employee-department"
            />
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Employee ID
            </Label>
            <Input
              type="text"
              placeholder="Auto-generated"
              disabled
              className="bg-gray-50"
              data-testid="input-employee-id-disabled"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-primary hover:bg-primary-light text-white"
              disabled={createEmployeeMutation.isPending}
              data-testid="button-save-employee"
            >
              {createEmployeeMutation.isPending ? "Saving..." : "Save Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
