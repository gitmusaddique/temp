import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Employee } from "@shared/schema";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  employee, 
  onConfirm, 
  isDeleting 
}: DeleteConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm" data-testid="modal-delete-confirmation" aria-describedby="delete-description">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium" data-testid="text-delete-title">Delete Employee</h3>
            <p className="text-sm text-gray-600">This action cannot be undone.</p>
          </div>
        </div>

        <div id="delete-description" className="sr-only">
          Permanently delete employee record and all associated data.
        </div>

        <p className="text-gray-700 mb-6" data-testid="text-delete-confirmation">
          Are you sure you want to delete{" "}
          <span className="font-medium" data-testid="text-employee-to-delete">
            {employee?.name || "this employee"}
          </span>
          ? All associated data will be permanently removed.
        </p>

        <div className="modal-buttons">
          <Button 
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="button-confirm-delete"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}