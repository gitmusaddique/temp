import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEmployeeSchema, insertAttendanceSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const success = await storage.deleteEmployee(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Attendance routes
  app.get("/api/attendance/:month/:year", async (req, res) => {
    try {
      const month = parseInt(req.params.month);
      const year = parseInt(req.params.year);
      
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid month or year" });
      }

      const records = await storage.getAttendanceForMonth(month, year);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch attendance records" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      const record = await storage.createOrUpdateAttendance(validatedData);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save attendance record" });
    }
  });

  // Export routes
  app.post("/api/export/xlsx", async (req, res) => {
    try {
      const { month, year } = req.body;
      
      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }

      const employees = await storage.getAllEmployees();
      const attendance = await storage.getAttendanceForMonth(month, year);
      
      const XLSX = require('xlsx');
      
      // Create attendance data for Excel
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      
      // Prepare headers
      const headers = [
        "S. No.",
        "Employee ID", 
        "Name",
        "Designation",
        "Department",
        ...dayColumns.map(day => day.toString()),
        "T/ON DUTY",
        "OT DAYS",
        "REMARKS"
      ];
      
      // Prepare data rows
      const data = employees.map((employee, index) => {
        const attendanceRecord = attendance.find(a => a.employeeId === employee.id);
        let attendanceData: Record<string, string> = {};
        
        if (attendanceRecord && attendanceRecord.attendanceData) {
          try {
            attendanceData = JSON.parse(attendanceRecord.attendanceData);
          } catch {
            attendanceData = {};
          }
        }
        
        // Calculate totals
        const presentDays = Object.values(attendanceData).filter(status => status === 'P').length;
        const otDays = Object.values(attendanceData).filter(status => status === 'OT').length;
        
        const row = [
          index + 1,
          employee.employeeId,
          employee.name,
          employee.designation || "",
          employee.department || "",
          ...dayColumns.map(day => attendanceData[day.toString()] || ""),
          presentDays,
          otDays,
          attendanceRecord?.remarks || ""
        ];
        
        return row;
      });
      
      // Create worksheet
      const wsData = [headers, ...data];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${monthNames[month - 1]} ${year}`);
      
      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${monthNames[month - 1]}_${year}.xlsx"`);
      
      res.send(buffer);
    } catch (error) {
      console.error('XLSX export error:', error);
      res.status(500).json({ message: "Failed to generate XLSX export" });
    }
  });

  app.post("/api/export/pdf", async (req, res) => {
    try {
      const { month, year } = req.body;
      
      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }

      const employees = await storage.getAllEmployees();
      const attendance = await storage.getAttendanceForMonth(month, year);
      
      const { jsPDF } = require('jspdf');
      require('jspdf-autotable');
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      
      // Create PDF document in landscape mode
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Title
      doc.setFontSize(16);
      doc.text('SOUTH ASIA CONSULTANCY', 148, 20, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`Attendance Sheet - ${monthNames[month - 1]} ${year}`, 148, 30, { align: 'center' });
      
      // Prepare table headers
      const headers = [
        'S.No.',
        'Employee ID',
        'Name', 
        'Designation',
        'Department',
        ...dayColumns.map(day => day.toString()),
        'T/ON DUTY',
        'OT DAYS',
        'REMARKS'
      ];
      
      // Prepare table data
      const tableData = employees.map((employee, index) => {
        const attendanceRecord = attendance.find(a => a.employeeId === employee.id);
        let attendanceData: Record<string, string> = {};
        
        if (attendanceRecord && attendanceRecord.attendanceData) {
          try {
            attendanceData = JSON.parse(attendanceRecord.attendanceData);
          } catch {
            attendanceData = {};
          }
        }
        
        // Calculate totals
        const presentDays = Object.values(attendanceData).filter(status => status === 'P').length;
        const otDays = Object.values(attendanceData).filter(status => status === 'OT').length;
        
        return [
          index + 1,
          employee.employeeId,
          employee.name,
          employee.designation || "",
          employee.department || "",
          ...dayColumns.map(day => attendanceData[day.toString()] || ""),
          presentDays,
          otDays,
          attendanceRecord?.remarks || ""
        ];
      });
      
      // Generate table
      (doc as any).autoTable({
        head: [headers],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 6,
          cellPadding: 1,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 10 }, // S.No
          1: { cellWidth: 15 }, // Employee ID
          2: { cellWidth: 20 }, // Name
          3: { cellWidth: 15 }, // Designation
          4: { cellWidth: 15 }, // Department
        },
        margin: { top: 40, left: 10, right: 10 },
        didDrawCell: function(data: any) {
          // Color code attendance cells
          if (data.section === 'body' && data.column.index >= 5 && data.column.index < 5 + daysInMonth) {
            const cellValue = data.cell.raw;
            if (cellValue === 'P') {
              data.cell.styles.fillColor = [144, 238, 144]; // Light green
            } else if (cellValue === 'A') {
              data.cell.styles.fillColor = [255, 182, 193]; // Light red
            } else if (cellValue === 'OT') {
              data.cell.styles.fillColor = [255, 255, 224]; // Light yellow
            }
          }
        }
      });
      
      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${monthNames[month - 1]}_${year}.pdf"`);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({ message: "Failed to generate PDF export" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
