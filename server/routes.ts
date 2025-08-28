import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEmployeeSchema, insertAttendanceSchema, insertShiftAttendanceSchema } from "@shared/schema";
import { z } from "zod";

// Static imports for export functionality
// import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

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

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { companyName, rigName } = req.body;
      if (!companyName || !rigName) {
        return res.status(400).json({ message: "Company name and rig name are required" });
      }
      const settings = await storage.updateSettings({ companyName, rigName });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
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

  // Shift attendance routes
  app.get("/api/shift-attendance/:month/:year", async (req, res) => {
    try {
      const month = parseInt(req.params.month);
      const year = parseInt(req.params.year);

      if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid month or year" });
      }

      const records = await storage.getShiftAttendanceForMonth(month, year);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shift attendance records" });
    }
  });

  app.post("/api/shift-attendance", async (req, res) => {
    try {
      const validatedData = insertShiftAttendanceSchema.parse(req.body);
      const record = await storage.createOrUpdateShiftAttendance(validatedData);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save shift attendance record" });
    }
  });

// Updated XLSX Export section - replace the existing app.post("/api/export/xlsx", ...) route

app.post("/api/export/xlsx", async (req, res) => {
  try {
    const { month, year, selectedEmployees, withColors, tableType = "attendance" } = req.body; // Added tableType option

    // Enhanced validation with current date check
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    if (!monthNum || !yearNum || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
      return res.status(400).json({
        message: "Invalid month or year. Month must be 1-12, year must be from 1900 onwards"
      });
    }

    // Check if the requested date is in the future
    if (yearNum > currentYear || (yearNum === currentYear && monthNum > currentMonth)) {
      return res.status(400).json({
        message: `Cannot export future dates. Current date is ${currentMonth}/${currentYear}`
      });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Get settings for export headers
    const appSettings = await storage.getSettings();

    // Ensure no legacy "Siddik" values are used
    if (appSettings.companyName === 'Siddik') {
      appSettings.companyName = 'Company Name';
    }

    // Create new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${monthNames[monthNum - 1]} ${yearNum}`);

    // Determine if we should include shifts based on tableType
    const includeShifts = tableType === "shifts";

    // Get employees data
    const employees = await storage.getAllEmployees();

    // Get records based on table type
    let attendanceRecords: any[] = [];
    let shiftAttendanceRecords: any[] = [];

    if (includeShifts) {
      // For shift table, we need both attendance and shift data
      attendanceRecords = await storage.getAttendanceForMonth(monthNum, yearNum);
      shiftAttendanceRecords = await storage.getShiftAttendanceForMonth(monthNum, yearNum);
    } else {
      // For attendance table, we only need attendance data
      attendanceRecords = await storage.getAttendanceForMonth(monthNum, yearNum);
    }

    // Filter employees if selectedEmployees array is provided AND filter out inactive employees
    let filteredEmployees = employees;
    if (selectedEmployees && Array.isArray(selectedEmployees) && selectedEmployees.length > 0) {
      filteredEmployees = employees.filter(emp => selectedEmployees.includes(emp.id) && emp.status !== 'Inactive');
    } else {
      // If no specific employees selected, filter out inactive ones by default
      filteredEmployees = employees.filter(emp => emp.status !== 'Inactive');
    }


    if (!filteredEmployees || filteredEmployees.length === 0) {
      return res.status(404).json({ message: "No employees found for the selected criteria" });
    }

    // Prepare headers
    let headers: string[] = [];
    let secondHeaders: string[] = [];

    if (includeShifts) {
      // First header row
      headers = ['SL.NO', 'NAME', 'DESIGNATION'];
      secondHeaders = ['', '', ''];

      // Add day columns with D/N subheaders
      dayColumns.forEach(day => {
        headers.push(day.toString());
        headers.push(''); // Empty for second column of the day
        secondHeaders.push('D');
        secondHeaders.push('N');
      });
      headers.push('T/ON DUTY');
      secondHeaders.push('');
    } else {
      headers = ['SL.NO', 'NAME', 'DESIGNATION', 'STATUS', ...dayColumns.map(day => day.toString()), 'T/ON DUTY', 'OT DAYS', 'REMARKS'];
    }

    // Add title rows
    worksheet.addRow([appSettings.companyName]);
    worksheet.addRow(['Attendance']);
    worksheet.addRow([`${appSettings.rigName}     MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`]);
    worksheet.addRow([]); // Empty row

    if (includeShifts) {
      worksheet.addRow(headers); // First header row
      worksheet.addRow(secondHeaders); // Second header row (D/N)
    } else {
      worksheet.addRow(headers); // Headers
    }

    // Style title rows
    const titleStyle = {
      font: { bold: true, size: 18 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'medium' },
        bottom: { style: 'thin' },
        left: { style: 'medium' },
        right: { style: 'medium' }
      }
    };

    const subtitleStyle = {
      font: { bold: true, size: 16 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'medium' },
        right: { style: 'medium' }
      }
    };

    const monthStyle = {
      font: { bold: true, size: 14 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'medium' },
        left: { style: 'medium' },
        right: { style: 'medium' }
      }
    };

    // Merge and style title rows - ensure proper column span
    worksheet.mergeCells(1, 1, 1, headers.length);
    worksheet.getRow(1).getCell(1).value = appSettings.companyName;
    worksheet.getRow(1).getCell(1).style = titleStyle;

    worksheet.mergeCells(2, 1, 2, headers.length);
    worksheet.getRow(2).getCell(1).value = 'Attendance';
    worksheet.getRow(2).getCell(1).style = subtitleStyle;

    worksheet.mergeCells(3, 1, 3, headers.length);
    worksheet.getRow(3).getCell(1).value = `${appSettings.rigName}     MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`;
    worksheet.getRow(3).getCell(1).style = monthStyle;

    if (includeShifts) {
      // Style first header row (row 5)
      const headerRow1 = worksheet.getRow(5);
      headers.forEach((header, index) => {
        const cell = headerRow1.getCell(index + 1);
        cell.value = header;
        cell.style = {
          font: { bold: true, size: 11 },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } },
          border: {
            top: { style: 'medium' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      });

      // Style second header row (row 6) with D/N
      const headerRow2 = worksheet.getRow(6);
      secondHeaders.forEach((header, index) => {
        const cell = headerRow2.getCell(index + 1);
        cell.value = header;

        let fillColor = 'FFE6E6E6';
        if (header === 'D') {
          fillColor = 'FFE3F2FD'; // Light blue for Day shift
        } else if (header === 'N') {
          fillColor = 'FFF3E5F5'; // Light purple for Night shift
        }

        cell.style = {
          font: { bold: true, size: 11 },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'medium' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      });

      // Merge cells for day numbers in shift table
      let colIndex = 4; // Starting after SL.NO, NAME, DESIGNATION
      dayColumns.forEach(day => {
        worksheet.mergeCells(5, colIndex, 5, colIndex + 1); // Merge day number across D and N columns
        colIndex += 2;
      });

    } else {
      // Style header row (row 5) for regular table
      const headerRow = worksheet.getRow(5);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.style = {
          font: { bold: true, size: 11 },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } },
          border: {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      });
    }

    // Fill employee data
    filteredEmployees.forEach((employee, index) => {
      const attendanceRecord = attendanceRecords.find(r => r.employeeId === employee.id);
      const shiftRecord = includeShifts ? shiftAttendanceRecords.find(r => r.employeeId === employee.id) : undefined;

      let attendanceData: Record<string, string> = {};
      let shiftData: Record<string, string> = {};

      if (attendanceRecord && attendanceRecord.attendanceData) {
        try {
          attendanceData = typeof attendanceRecord.attendanceData === 'string'
            ? JSON.parse(attendanceRecord.attendanceData)
            : attendanceRecord.attendanceData;
        } catch (parseError) {
          console.error(`Failed to parse attendance data for employee ${employee.id}:`, parseError);
          attendanceData = {};
        }
      }

      if (includeShifts && shiftRecord && shiftRecord.shiftData) {
        try {
          shiftData = typeof shiftRecord.shiftData === 'string'
            ? JSON.parse(shiftRecord.shiftData)
            : shiftRecord.shiftData;
        } catch (parseError) {
          console.error(`Failed to parse shift data for employee ${employee.id}:`, parseError);
          shiftData = {};
        }
      }

      const rowIndex = includeShifts ? index + 7 : index + 6; // Starting from row 7 for shift table (after title rows and two header rows), row 6 for regular table
      const row = worksheet.getRow(rowIndex);

      row.getCell(1).value = index + 1; // Use sequential numbering based on filtered list
      row.getCell(2).value = employee.name || '';
      row.getCell(3).value = employee.designation || '';

      if (!includeShifts) {
        row.getCell(4).value = employee.status || '';
      }

      let cellIndex = includeShifts ? 4 : 5;

      if (includeShifts) {
        // Add day columns with shift data (D/N columns)
        dayColumns.forEach(day => {
          const status = attendanceData[day.toString()];
          const shift = shiftData[day.toString()];

          // Day shift column
          const dayShiftValue = (status === 'P' || status === 'OT') && shift === 'D' ? 'P' : '';
          row.getCell(cellIndex).value = dayShiftValue;
          cellIndex++;

          // Night shift column  
          const nightShiftValue = (status === 'P' || status === 'OT') && shift === 'N' ? 'P' : '';
          row.getCell(cellIndex).value = nightShiftValue;
          cellIndex++;
        });

        // Calculate shift totals
        const shiftPresentDays = Object.values(shiftData).filter(shift => shift === 'D' || shift === 'N').length;
        row.getCell(cellIndex).value = shiftPresentDays > 0 ? shiftPresentDays : '';

      } else {
        // Add regular day columns
        dayColumns.forEach(day => {
          const status = attendanceData[day.toString()];
          const isBlank = !status ||
                         status === '' ||
                         status === null ||
                         status === undefined ||
                         status.toString().trim() === '' ||
                         status.toString().toLowerCase() === 'blank';

          if (isBlank) {
            row.getCell(cellIndex).value = '';
          } else {
            switch(status) {
              case 'P': case 'Present': row.getCell(cellIndex).value = 'P'; break;
              case 'A': case 'Absent': row.getCell(cellIndex).value = 'A'; break;
              case 'OT': case 'Overtime': row.getCell(cellIndex).value = 'OT'; break;
              case 'L': case 'Leave': row.getCell(cellIndex).value = 'L'; break;
              case 'H': case 'Holiday': row.getCell(cellIndex).value = 'H'; break;
              default: row.getCell(cellIndex).value = status;
            }
          }
          cellIndex++;
        });

        // Calculate regular totals
        const attendanceValues = Object.values(attendanceData);
        const presentDays = attendanceValues.filter(status => status === 'P' || status === 'Present').length;
        const otDays = attendanceValues.filter(status => status === 'OT' || status === 'Overtime').length;

        // Add summary columns
        row.getCell(cellIndex).value = presentDays > 0 ? presentDays : '';
        cellIndex++;
        row.getCell(cellIndex).value = otDays > 0 ? otDays : '';
        cellIndex++;
        row.getCell(cellIndex).value = attendanceRecord?.remarks || '';
      }

      // Style each cell in the data row
      row.eachCell((cell, colNumber) => {
        // Determine which columns should not be bold (name, designation, remarks)
        const isNameColumn = colNumber === 2;
        const isDesignationColumn = colNumber === 3;
        const isRemarksColumn = !includeShifts && colNumber === headers.length;
        const shouldNotBeBold = isNameColumn || isDesignationColumn || isRemarksColumn;

        // Base style for all cells (including empty ones)
        const baseStyle = {
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          },
          // Make cells bold except for name, designation, and remarks columns
          font: { bold: !shouldNotBeBold }
        };

        // Apply base style to all cells
        cell.style = { ...baseStyle };

        // Skip styling for completely blank cells - let them be truly blank
        if (cell.value === '' || cell.value === null || cell.value === undefined) {
          cell.style = baseStyle; // Only apply base style without any fill
          return;
        }

        // Color code attendance/shift columns - only for cells with actual values and when withColors is enabled
        if (withColors && colNumber >= (includeShifts ? 4 : 5)) {
          const cellValue = cell.value;
          if (cellValue && cellValue.toString().trim() !== '') {
            const headerForColumn = headers[colNumber - 1];

            if (includeShifts) {
              // Color shift columns
              if (headerForColumn && headerForColumn.includes(' D')) {
                // Day shift column
                cell.style = {
                  ...baseStyle,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } } // Light blue for Day
                };
              } else if (headerForColumn && headerForColumn.includes(' N')) {
                // Night shift column  
                cell.style = {
                  ...baseStyle,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } } // Light purple for Night
                };
              }
            } else if (colNumber < (includeShifts ? 4 : 5) + (includeShifts ? daysInMonth * 2 : daysInMonth)) {
              // Regular attendance columns
              switch(cellValue.toString().trim()) {
                case 'P':
                  cell.style = {
                    ...baseStyle,
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5F4E6' } } // Light green
                  };
                  break;
                case 'A':
                  cell.style = {
                    ...baseStyle,
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E4' } } // Light red
                  };
                  break;
                case 'OT':
                  cell.style = {
                    ...baseStyle,
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF7CD' } } // Light yellow
                  };
                  break;
                case 'L':
                  cell.style = {
                    ...baseStyle,
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FF' } } // Light blue
                  };
                  break;
                case 'H':
                  cell.style = {
                    ...baseStyle,
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } // Light gray
                  };
                  break;
              }
            }
          }
        }
      });
    });

    // Set column widths
    let columnWidths = [
      { width: 6 },   // SL.NO
      { width: 20 },  // NAME
      { width: 15 },  // DESIGNATION
    ];

    if (includeShifts) {
      // Add D/N columns (2 per day) with better spacing
      dayColumns.forEach(() => {
        columnWidths.push({ width: 4 }); // D column
        columnWidths.push({ width: 4 }); // N column
      });
      columnWidths.push({ width: 18 }); // T/ON DUTY - increased width
    } else {
      // Add regular day columns
      columnWidths.push({ width: 10 }); // STATUS
      columnWidths.push(...dayColumns.map(() => ({ width: 4 })));
      columnWidths.push({ width: 12 }); // T/ON DUTY
      columnWidths.push({ width: 10 }); // OT DAYS
      columnWidths.push({ width: 30 }); // REMARKS
    }

    worksheet.columns = columnWidths;

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download with unique filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const tableTypeSuffix = tableType === "shifts" ? "shifts" : "attendance";
    const filename = `${tableTypeSuffix}_${monthNames[monthNum - 1].toLowerCase()}_${yearNum}_${timestamp}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: "Failed to export data", 
      error: error.message 
    });
  }
});



  const httpServer = createServer(app);
  return httpServer;
}