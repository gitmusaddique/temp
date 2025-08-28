import { type Employee, type InsertEmployee, type AttendanceRecord, type InsertAttendance } from "@shared/schema";
import { randomUUID } from "crypto";
import Database from 'better-sqlite3';
import path from 'path';

export interface IStorage {
  // Workspace operations
  getAllWorkspaces(): Promise<{id: string, name: string}[]>;
  getWorkspace(id: string): Promise<{id: string, name: string} | undefined>;
  
  // Employee operations
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByEmployeeId(workspaceId: string, employeeId: string): Promise<Employee | undefined>;
  getAllEmployees(workspaceId: string): Promise<Employee[]>;
  createEmployee(workspaceId: string, employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  // Attendance operations
  getAttendanceRecord(employeeId: string, month: number, year: number): Promise<AttendanceRecord | undefined>;
  createOrUpdateAttendance(attendance: InsertAttendance): Promise<AttendanceRecord>;
  getAttendanceForMonth(workspaceId: string, month: number, year: number): Promise<AttendanceRecord[]>;
  // Shift Attendance operations
  getShiftAttendanceForMonth(workspaceId: string, month: number, year: number): Promise<any[]>; // Use 'any' for now, define a specific type later
  createOrUpdateShiftAttendance(attendance: any): Promise<any>; // Use 'any' for now, define a specific type later
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
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        name TEXT NOT NULL,
        designation TEXT,
        designation_order INTEGER DEFAULT 999,
        department TEXT,
        status TEXT DEFAULT 'Active',
        serial_number INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
        UNIQUE(workspace_id, employee_id),
        UNIQUE(workspace_id, serial_number)
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

      CREATE TABLE IF NOT EXISTS shift_attendance_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        shift_data TEXT, -- JSON string, e.g., { "1": "D", "2": "N", "3": "P" }
        total_on_duty INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
        UNIQUE(employee_id, month, year)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        company_name TEXT NOT NULL DEFAULT 'Company Name',
        rig_name TEXT NOT NULL DEFAULT 'ROM-100-II',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_month_year ON attendance_records (month, year);
      CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records (employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_workspace_serial ON employees (workspace_id, serial_number);
      CREATE INDEX IF NOT EXISTS idx_employee_workspace ON employees (workspace_id);
      CREATE INDEX IF NOT EXISTS idx_shift_attendance_month_year ON shift_attendance_records (month, year);
      CREATE INDEX IF NOT EXISTS idx_shift_attendance_employee ON shift_attendance_records (employee_id);
    `);

    // Initialize default settings if they don't exist
    const defaultSettings = this.db.prepare(`
      INSERT OR IGNORE INTO app_settings (id, company_name, rig_name)
      VALUES ('default', 'Company Name', 'ROM-100-II')
    `);
    defaultSettings.run();

    // Initialize default workspaces
    const initWorkspaces = this.db.prepare(`
      INSERT OR IGNORE INTO workspaces (id, name)
      VALUES (?, ?)
    `);
    initWorkspaces.run('domestic', 'Domestic');
    initWorkspaces.run('ongc', 'ONGC');

    // Migration: Update existing "Siddik" records to "Company Name"
    const migrateSiddik = this.db.prepare(`
      UPDATE app_settings 
      SET company_name = 'Company Name', updated_at = CURRENT_TIMESTAMP 
      WHERE company_name = 'Siddik'
    `);
    const migrateResult = migrateSiddik.run();
    if (migrateResult.changes > 0) {
      console.log(`Migrated ${migrateResult.changes} settings records from "Siddik" to "Company Name"`);
    }

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

    // Migration: Add workspace_id column to employees if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE employees ADD COLUMN workspace_id TEXT DEFAULT 'domestic';`);
      console.log('Added workspace_id column to existing employees table');
      
      // Update existing employees to belong to domestic workspace
      const updateExistingEmployees = this.db.prepare(`
        UPDATE employees SET workspace_id = 'domestic' WHERE workspace_id IS NULL
      `);
      const result = updateExistingEmployees.run();
      console.log(`Migrated ${result.changes} existing employees to domestic workspace`);
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
      // Workspace statements
      getAllWorkspaces: this.db.prepare('SELECT * FROM workspaces ORDER BY name ASC'),
      getWorkspace: this.db.prepare('SELECT * FROM workspaces WHERE id = ?'),
      
      // Employee statements
      getEmployee: this.db.prepare('SELECT * FROM employees WHERE id = ?'),
      getEmployeeByEmployeeId: this.db.prepare('SELECT * FROM employees WHERE workspace_id = ? AND employee_id = ?'),
      getAllEmployees: this.db.prepare('SELECT * FROM employees WHERE workspace_id = ? ORDER BY designation_order ASC, name ASC'),
      getMaxSerialNumber: this.db.prepare('SELECT MAX(serial_number) as max_serial FROM employees WHERE workspace_id = ?'),
      createEmployee: this.db.prepare(`
        INSERT INTO employees (id, workspace_id, employee_id, name, designation, designation_order, department, status, serial_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT INTO attendance_records (id, employee_id, month, year, attendance_data, total_on_duty, ot_days, remarks, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id, month, year) 
        DO UPDATE SET 
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
        WHERE e.workspace_id = ? AND ar.month = ? AND ar.year = ?
        ORDER BY e.designation_order ASC, e.name ASC
      `),
      
      // Shift Attendance statements
      getShiftAttendanceForMonth: this.db.prepare(`
        SELECT sar.*, e.name as employee_name, e.employee_id as employee_code
        FROM shift_attendance_records sar
        LEFT JOIN employees e ON sar.employee_id = e.id
        WHERE e.workspace_id = ? AND sar.month = ? AND sar.year = ?
        ORDER BY e.designation_order ASC, e.name ASC
      `),
      createOrUpdateShiftAttendance: this.db.prepare(`
        INSERT INTO shift_attendance_records 
        (id, employee_id, month, year, shift_data, total_on_duty, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id, month, year) 
        DO UPDATE SET 
          shift_data = excluded.shift_data,
          total_on_duty = excluded.total_on_duty,
          updated_at = CURRENT_TIMESTAMP
      `),

      // Settings statements
      getSettings: this.db.prepare('SELECT * FROM app_settings WHERE id = ?'),
      updateSettings: this.db.prepare(`
        UPDATE app_settings 
        SET company_name = ?, rig_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 'default'
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

  // Workspace operations
  async getAllWorkspaces(): Promise<{id: string, name: string}[]> {
    const rows = this.statements.getAllWorkspaces.all();
    return rows.map(row => ({ id: row.id, name: row.name }));
  }

  async getWorkspace(id: string): Promise<{id: string, name: string} | undefined> {
    const row = this.statements.getWorkspace.get(id);
    return row ? { id: row.id, name: row.name } : undefined;
  }

  // Employee operations
  async getEmployee(id: string): Promise<Employee | undefined> {
    const row = this.statements.getEmployee.get(id);
    return row ? this.mapEmployeeFromDb(row) : undefined;
  }

  async getEmployeeByEmployeeId(workspaceId: string, employeeId: string): Promise<Employee | undefined> {
    const row = this.statements.getEmployeeByEmployeeId.get(workspaceId, employeeId);
    return row ? this.mapEmployeeFromDb(row) : undefined;
  }

  async getAllEmployees(workspaceId: string): Promise<Employee[]> {
    const rows = this.statements.getAllEmployees.all(workspaceId);
    return rows.map(row => this.mapEmployeeFromDb(row));
  }

  async createEmployee(workspaceId: string, insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();

    // Get next serial number for this workspace
    const maxSerialResult = this.statements.getMaxSerialNumber.get(workspaceId);
    const nextSerial = (maxSerialResult.max_serial || 0) + 1;
    const employeeId = String(nextSerial).padStart(3, '0');

    // Get designation order
    const designationOrder = this.getDesignationOrder(insertEmployee.designation);

    this.statements.createEmployee.run(
      id,
      workspaceId,
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
      workspaceId,
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

    return settings || { companyName: 'Company Name', rigName: 'ROM-100-II' };
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

  async getAttendanceForMonth(workspaceId: string, month: number, year: number): Promise<AttendanceRecord[]> {
    const rows = this.statements.getAttendanceForMonth.all(workspaceId, month, year);
    return rows.map(row => this.mapAttendanceFromDb(row));
  }

  // Shift Attendance operations
  async getShiftAttendanceForMonth(workspaceId: string, month: number, year: number): Promise<any[]> {
    const rows = this.statements.getShiftAttendanceForMonth.all(workspaceId, month, year);
    return rows.map(row => this.mapShiftAttendanceFromDb(row));
  }

  async createOrUpdateShiftAttendance(attendance: any): Promise<any> {
    const id = randomUUID();
    const shiftDataJson = attendance.shiftData 
      ? JSON.stringify(attendance.shiftData)
      : null;

    this.statements.createOrUpdateShiftAttendance.run(
      id,
      attendance.employeeId,
      attendance.month,
      attendance.year,
      shiftDataJson,
      attendance.totalOnDuty || 0
    );

    // Fetch and return the created/updated record
    const record = await this.getShiftAttendanceRecord(attendance.employeeId, attendance.month, attendance.year);
    if (!record) {
      throw new Error('Failed to create or update shift attendance record');
    }
    return record;
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
      workspaceId: row.workspace_id,
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

  private mapShiftAttendanceFromDb(row: any): any {
    let shiftData = null;
    if (row.shift_data) {
      try {
        shiftData = JSON.parse(row.shift_data);
      } catch (e) {
        console.error('Failed to parse shift data:', e);
        shiftData = {};
      }
    }

    return {
      id: row.id,
      employeeId: row.employee_id,
      month: row.month,
      year: row.year,
      shiftData,
      totalOnDuty: row.total_on_duty,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
    };
  }

  // Helper to get a single shift attendance record
  private async getShiftAttendanceRecord(employeeId: string, month: number, year: number): Promise<any | undefined> {
    const row = this.db.prepare(`
      SELECT * FROM shift_attendance_records 
      WHERE employee_id = ? AND month = ? AND year = ?
    `).get(employeeId, month, year);
    return row ? this.mapShiftAttendanceFromDb(row) : undefined;
  }


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