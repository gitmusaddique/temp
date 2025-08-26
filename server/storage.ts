import { type Employee, type InsertEmployee, type AttendanceRecord, type InsertAttendance } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Employee operations
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByEmployeeId(employeeId: string): Promise<Employee | undefined>;
  getAllEmployees(): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  
  // Attendance operations
  getAttendanceRecord(employeeId: string, month: number, year: number): Promise<AttendanceRecord | undefined>;
  createOrUpdateAttendance(attendance: InsertAttendance): Promise<AttendanceRecord>;
  getAttendanceForMonth(month: number, year: number): Promise<AttendanceRecord[]>;
}

export class MemStorage implements IStorage {
  private employees: Map<string, Employee>;
  private attendanceRecords: Map<string, AttendanceRecord>;
  private nextSerialNumber: number;

  constructor() {
    this.employees = new Map();
    this.attendanceRecords = new Map();
    this.nextSerialNumber = 1;
  }

  // Employee operations
  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async getEmployeeByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    return Array.from(this.employees.values()).find(
      (emp) => emp.employeeId === employeeId,
    );
  }

  async getAllEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values()).sort((a, b) => a.serialNumber - b.serialNumber);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employeeId = String(this.nextSerialNumber).padStart(3, '0');
    
    const employee: Employee = {
      id,
      employeeId,
      name: insertEmployee.name,
      designation: insertEmployee.designation || null,
      department: insertEmployee.department || null,
      status: insertEmployee.status || "Active",
      serialNumber: this.nextSerialNumber,
    };
    
    this.employees.set(id, employee);
    this.nextSerialNumber++;
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;

    const updatedEmployee: Employee = {
      ...employee,
      ...updateData,
    };

    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }

  // Attendance operations
  async getAttendanceRecord(employeeId: string, month: number, year: number): Promise<AttendanceRecord | undefined> {
    const key = `${employeeId}-${month}-${year}`;
    return this.attendanceRecords.get(key);
  }

  async createOrUpdateAttendance(attendance: InsertAttendance): Promise<AttendanceRecord> {
    const key = `${attendance.employeeId}-${attendance.month}-${attendance.year}`;
    const existing = this.attendanceRecords.get(key);

    const record: AttendanceRecord = {
      id: existing?.id || randomUUID(),
      ...attendance,
      totalOnDuty: attendance.totalOnDuty || 0,
      otDays: attendance.otDays || 0,
      remarks: attendance.remarks || null,
    };

    this.attendanceRecords.set(key, record);
    return record;
  }

  async getAttendanceForMonth(month: number, year: number): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.month === month && record.year === year
    );
  }
}

export const storage = new MemStorage();
