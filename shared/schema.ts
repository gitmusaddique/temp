import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const DESIGNATION_OPTIONS = [
  "Rig I/C",
  "Shift I/C", 
  "Asst Shift I/C",
  "Top Man",
  "Rig Man"
] as const;

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  designation: text("designation").notNull(),
  designationOrder: integer("designation_order").notNull().default(999),
  status: text("status").notNull().default("Active"),
  serialNumber: integer("serial_number").notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  name: true,
  designation: true,
  designationOrder: true,
  status: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  designation: z.enum(DESIGNATION_OPTIONS),
  designationOrder: z.number().min(1).default(999),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect & {
  isActive: boolean;
};

export const attendanceRecord = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  attendanceData: text("attendance_data").notNull(), // JSON string of daily attendance
  totalOnDuty: integer("total_on_duty").notNull().default(0),
  otDays: integer("ot_days").notNull().default(0),
  remarks: text("remarks"),
});

export const insertAttendanceSchema = createInsertSchema(attendanceRecord).pick({
  employeeId: true,
  month: true,
  year: true,
  attendanceData: true,
  totalOnDuty: true,
  otDays: true,
  remarks: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type AttendanceRecord = typeof attendanceRecord.$inferSelect;
