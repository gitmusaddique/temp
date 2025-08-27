import { type Employee, type InsertEmployee, type AttendanceRecord, type InsertAttendance } from "@shared/schema";
import { randomUUID } from "crypto";
import Database from 'better-sqlite3';
import path from 'path';

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
  // Settings operations
  getSettings(): Promise<{ companyName: string; rigName: string }>;
  updateSettings(settings: { companyName: string; rigName: string }): Promise<{ companyName: string; rigName: string }>;
}

export class SqliteStorage implements IStorage {
  private db: Database;
  private statements: any;

  constructor(dbPath: string = 'attendance.db') {
    // Create database in current directory or specified path
    const fullPath = path.resolve(dbPath);
    console.log('Initializing SQLite database at:', fullPath);

    this.db = new Database(fullPath, { 
      verbose: console.log, // Optional: remove this to reduce logs
      fileMustExist: false
    });

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeTables();
    this.prepareStatements();
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        designation TEXT,
        designation_order INTEGER DEFAULT 999,
        department TEXT,
        status TEXT DEFAULT 'Active',
        serial_number INTEGER UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        attendance_data TEXT, -- JSON string
        total_on_duty INTEGER DEFAULT 0,
        ot_days INTEGER DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
        UNIQUE(employee_id, month, year)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        company_name TEXT NOT NULL DEFAULT 'Siddik',
        rig_name TEXT NOT NULL DEFAULT 'ROM-100-II',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_month_year ON attendance_records (month, year);
      CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records (employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_serial ON employees (serial_number);
    `);

    // Initialize default settings if they don't exist
    const defaultSettings = this.db.prepare(`
      INSERT OR IGNORE INTO app_settings (id, company_name, rig_name)
      VALUES ('default', 'Siddik', 'ROM-100-II')
    `);
    defaultSettings.run();

    // Migration: Add designation_order column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE employees ADD COLUMN designation_order INTEGER DEFAULT 999;`);
      console.log('Added designation_order column to existing employees table');
    } catch (error: any) {
      // Column already exists, ignore the error
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error);
      }
    }

    // Always update ALL existing employees with proper designation order
    const updateStmt = this.db.prepare(`
      UPDATE employees 
      SET designation_order = ? 
      WHERE designation = ?
    `);

    const designationNumbers: Record<string, number> = {
      'Rig I/C': 1,
      'Shift I/C': 2,
      'Asst Shift I/C': 3,
      'Top Man': 4,
      'Rig Man': 5
    };

    for (const [designation, order] of Object.entries(designationNumbers)) {
      const result = updateStmt.run(order, designation);
      console.log(`Updated ${result.changes} employees with designation '${designation}' to order ${order}`);
    }

    // Update any employees with null or unrecognized designations to order 999
    const updateUnknownStmt = this.db.prepare(`
      UPDATE employees 
      SET designation_order = 999 
      WHERE designation IS NULL OR designation NOT IN ('Rig I/C', 'Shift I/C', 'Asst Shift I/C', 'Top Man', 'Rig Man')
    `);
    const unknownResult = updateUnknownStmt.run();
    console.log(`Updated ${unknownResult.changes} employees with unknown/null designations to order 999`);
  }

  private prepareStatements() {
    this.statements = {
      // Employee statements
      getEmployee: this.db.prepare('SELECT * FROM employees WHERE id = ?'),
      getEmployeeByEmployeeId: this.db.prepare('SELECT * FROM employees WHERE employee_id = ?'),
      getAllEmployees: this.db.prepare('SELECT * FROM employees ORDER BY designation_order ASC, name ASC'),
      getMaxSerialNumber: this.db.prepare('SELECT MAX(serial_number) as max_serial FROM employees'),
      createEmployee: this.db.prepare(`
        INSERT INTO employees (id, employee_id, name, designation, designation_order, department, status, serial_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateEmployee: this.db.prepare(`
        UPDATE employees 
        SET name = COALESCE(?, name),
            designation = COALESCE(?, designation),
            designation_order = COALESCE(?, designation_order),
            department = COALESCE(?, department),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      deleteEmployee: this.db.prepare('DELETE FROM employees WHERE id = ?'),

      // Attendance statements
      getAttendanceRecord: this.db.prepare(`
        SELECT * FROM attendance_records 
        WHERE employee_id = ? AND month = ? AND year = ?
      `),
      createOrUpdateAttendance: this.db.prepare(`
        INSERT INTO attendance_records (id, employee_id, month, year, attendance_data, total_on_duty, ot_days, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id, month, year) DO UPDATE SET
          attendance_data = excluded.attendance_data,
          total_on_duty = excluded.total_on_duty,
          ot_days = excluded.ot_days,
          remarks = excluded.remarks,
          updated_at = CURRENT_TIMESTAMP
      `),
      getAttendanceForMonth: this.db.prepare(`
        SELECT ar.*, e.name as employee_name, e.employee_id as employee_code
        FROM attendance_records ar
        LEFT JOIN employees e ON ar.employee_id = e.id
        WHERE ar.month = ? AND ar.year = ?
        ORDER BY e.designation_order ASC, e.name ASC
      `),

      // Settings statements
      getSettings: this.db.prepare('SELECT * FROM app_settings WHERE id = ?'),
      updateSettings: this.db.prepare(`
        UPDATE app_settings 
        SET company_name = ?, rig_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
    };
  }

  private getDesignationOrder(designation: string): number {
    const designationNumbers: Record<string, number> = {
      'Rig I/C': 1,
      'Shift I/C': 2,
      'Asst Shift I/C': 3,
      'Top Man': 4,
      'Rig Man': 5
    };

    return designationNumbers[designation] || 999;
  }

  // Employee operations
  async getEmployee(id: string): Promise<Employee | undefined> {
    const row = this.statements.getEmployee.get(id);
    return row ? this.mapEmployeeFromDb(row) : undefined;
  }

  async getEmployeeByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    const row = this.statements.getEmployeeByEmployeeId.get(employeeId);
    return row ? this.mapEmployeeFromDb(row) : undefined;
  }

  async getAllEmployees(): Promise<Employee[]> {
    const rows = this.statements.getAllEmployees.all();
    return rows.map(row => this.mapEmployeeFromDb(row));
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();

    // Get next serial number
    const maxSerialResult = this.statements.getMaxSerialNumber.get();
    const nextSerial = (maxSerialResult.max_serial || 0) + 1;
    const employeeId = String(nextSerial).padStart(3, '0');

    // Get designation order
    const designationOrder = this.getDesignationOrder(insertEmployee.designation);

    this.statements.createEmployee.run(
      id,
      employeeId,
      insertEmployee.name,
      insertEmployee.designation || null,
      designationOrder,
      insertEmployee.department || null,
      insertEmployee.status || "Active",
      nextSerial
    );

    const employee: Employee = {
      id,
      employeeId,
      name: insertEmployee.name,
      designation: insertEmployee.designation || null,
      designationOrder: designationOrder,
      department: insertEmployee.department || null,
      status: insertEmployee.status || "Active",
      serialNumber: nextSerial,
    };

    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existing = await this.getEmployee(id);
    if (!existing) return undefined;

    let designationOrder = existing.designationOrder;
    // If designation is being updated, recalculate designation_order
    if (updateData.designation && updateData.designation !== existing.designation) {
      designationOrder = this.getDesignationOrder(updateData.designation);
    }

    const result = this.statements.updateEmployee.run(
      updateData.name || null,
      updateData.designation || null,
      designationOrder || null,
      updateData.department || null,
      updateData.status || null,
      id
    );

    if (result.changes === 0) return undefined;

    return this.getEmployee(id);
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async getSettings(): Promise<{ companyName: string; rigName: string }> {
    const settings = this.db.prepare(`
      SELECT company_name as companyName, rig_name as rigName 
      FROM app_settings 
      WHERE id = 'default'
    `).get() as { companyName: string; rigName: string } | undefined;

    return settings || { companyName: 'Siddik', rigName: 'ROM-100-II' };
  }

  async updateSettings(settings: { companyName: string; rigName: string }): Promise<{ companyName: string; rigName: string }> {
    this.db.prepare(`
      UPDATE app_settings 
      SET company_name = ?, rig_name = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 'default'
    `).run(settings.companyName, settings.rigName);

    return settings;
  }

  // Attendance operations
  async getAttendanceRecord(employeeId: string, month: number, year: number): Promise<AttendanceRecord | undefined> {
    const row = this.statements.getAttendanceRecord.get(employeeId, month, year);
    return row ? this.mapAttendanceFromDb(row) : undefined;
  }

  async createOrUpdateAttendance(attendance: InsertAttendance): Promise<AttendanceRecord> {
    const id = randomUUID();
    const attendanceDataJson = attendance.attendanceData 
      ? JSON.stringify(attendance.attendanceData)
      : null;

    this.statements.createOrUpdateAttendance.run(
      id,
      attendance.employeeId,
      attendance.month,
      attendance.year,
      attendanceDataJson,
      attendance.totalOnDuty || 0,
      attendance.otDays || 0,
      attendance.remarks || null
    );

    // Fetch and return the created/updated record
    const record = await this.getAttendanceRecord(attendance.employeeId, attendance.month, attendance.year);
    if (!record) {
      throw new Error('Failed to create or update attendance record');
    }
    return record;
  }

  async getAttendanceForMonth(month: number, year: number): Promise<AttendanceRecord[]> {
    const rows = this.statements.getAttendanceForMonth.all(month, year);
    return rows.map(row => this.mapAttendanceFromDb(row));
  }

  // Helper methods to map database rows to domain objects
  private mapEmployeeFromDb(row: any): Employee {
    return {
      id: row.id,
      employeeId: row.employee_id,
      name: row.name,
      designation: row.designation,
      designationOrder: row.designation_order || 999,
      department: row.department,
      status: row.status,
      isActive: row.status === 'Active', // Add isActive property based on status
      serialNumber: row.serial_number,
    };
  }

  private mapAttendanceFromDb(row: any): AttendanceRecord {
    let attendanceData = null;
    if (row.attendance_data) {
      try {
        attendanceData = JSON.parse(row.attendance_data);
      } catch (e) {
        console.error('Failed to parse attendance data:', e);
        attendanceData = {};
      }
    }

    return {
      id: row.id,
      employeeId: row.employee_id,
      month: row.month,
      year: row.year,
      attendanceData,
      totalOnDuty: row.total_on_duty,
      otDays: row.ot_days,
      remarks: row.remarks,
    };
  }

  // Settings operations
  // async getSettings(): Promise<{ companyName: string; rigName: string }> {
  //   const row = this.statements.getSettings.get('default');
  //   if (!row) {
  //     // Return default settings if none exist
  //     return { companyName: 'Siddik', rigName: 'ROM-100-II' };
  //   }
  //   return {
  //     companyName: row.company_name,
  //     rigName: row.rig_name
  //   };
  // }

  // async updateSettings(settings: { companyName: string; rigName: string }): Promise<{ companyName: string; rigName: string }> {
  //   const result = this.statements.updateSettings.run(
  //     settings.companyName,
  //     settings.rigName,
  //     'default'
  //   );

  //   if (result.changes === 0) {
  //     throw new Error('Failed to update settings');
  //   }

  //   return settings;
  // }

  // Utility methods
  close() {
    this.db.close();
  }

  backup(backupPath: string) {
    this.db.backup(backupPath);
    console.log('Database backed up to:', backupPath);
  }
}

// Create the storage instance with SQLite
export const storage = new SqliteStorage();

// Ensure database is closed properly on process exit
process.on('exit', () => {
  storage.close();
});

process.on('SIGINT', () => {
  storage.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  storage.close();
  process.exit(0);
});