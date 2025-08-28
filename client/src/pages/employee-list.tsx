
import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { EmployeeCard } from "@/components/employee-card";
import { CreateEmployeeModal } from "@/components/create-employee-modal";
import type { Employee } from "@shared/schema";

export default function EmployeeList() {
  const { workspaceId } = useParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workspace, setWorkspace] = useState<{id: string, name: string} | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;

    // Fetch workspace info
    fetch(`/api/workspaces`)
      .then(res => res.json())
      .then((workspaces: {id: string, name: string}[]) => {
        const foundWorkspace = workspaces.find(w => w.id === workspaceId);
        setWorkspace(foundWorkspace || null);
      })
      .catch(error => console.error('Failed to fetch workspace info:', error));

    // Fetch employees
    fetch(`/api/employees/${workspaceId}`)
      .then(res => res.json())
      .then(data => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to fetch employees:', error);
        setLoading(false);
      });
  }, [workspaceId]);

  const handleEmployeeCreated = (newEmployee: Employee) => {
    setEmployees(prev => [...prev, newEmployee]);
    setShowCreateModal(false);
  };

  const handleEmployeeUpdated = (updatedEmployee: Employee) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === updatedEmployee.id ? updatedEmployee : emp
    ));
  };

  const handleEmployeeDeleted = (deletedEmployeeId: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== deletedEmployeeId));
  };

  if (!workspaceId) {
    return <div>Invalid workspace</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
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
                Manage Employees - {workspace?.name || workspaceId}
              </h1>
              <p className="text-gray-600">Add, edit, and manage employee records</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employee List ({employees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No employees found in this workspace.</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Employee
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {employees.map(employee => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    onEmployeeUpdated={handleEmployeeUpdated}
                    onEmployeeDeleted={handleEmployeeDeleted}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {showCreateModal && workspaceId && (
          <CreateEmployeeModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onEmployeeCreated={handleEmployeeCreated}
            workspaceId={workspaceId}
          />
        )}
      </div>
    </div>
  );
}
