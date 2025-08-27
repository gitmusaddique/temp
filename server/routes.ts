import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEmployeeSchema, insertAttendanceSchema } from "@shared/schema";
import { z } from "zod";

// Static imports for export functionality
// import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Updated XLSX Export section - replace the existing app.post("/api/export/xlsx", ...) route

app.post("/api/export/xlsx", async (req, res) => {
  try {
    const { month, year, selectedEmployees } = req.body;

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

    let employees = await storage.getAllEmployees();
    const attendance = await storage.getAttendanceForMonth(monthNum, yearNum);

    // Filter employees if selectedEmployees array is provided AND filter out inactive employees
    if (selectedEmployees && Array.isArray(selectedEmployees) && selectedEmployees.length > 0) {
      employees = employees.filter(emp => selectedEmployees.includes(emp.id) && emp.status !== 'Inactive');
    } else {
      // If no specific employees selected, filter out inactive ones by default
      employees = employees.filter(emp => emp.status !== 'Inactive');
    }


    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: "No employees found for the selected criteria" });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Get settings for export headers
    const appSettings = await storage.getSettings();

    // Create new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${monthNames[monthNum - 1]} ${yearNum}`);

    // Prepare headers
    const headers = [
      "SL.NO",
      "NAME",
      "DESIGNATION",
      ...dayColumns.map(day => day.toString()),
      "T/ON DUTY",
      "OT DAYS",
      "REMARKS"
    ];

    // Add title rows
    worksheet.addRow([appSettings.companyName]);
    worksheet.addRow(['Attendance']);
    worksheet.addRow([`${appSettings.rigName}     MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`]);
    worksheet.addRow([]); // Empty row
    worksheet.addRow(headers); // Headers

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

    // Style header row (row 5) - make sure all headers are visible
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

    // Fill employee data
    employees.forEach((employee, index) => {
      const attendanceRecord = attendance.find(a => a.employeeId === employee.id);
      let attendanceData: Record<string, string> = {};

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

      // Calculate totals
      const attendanceValues = Object.values(attendanceData);
      const presentDays = attendanceValues.filter(status => status === 'P' || status === 'Present').length;
      const otDays = attendanceValues.filter(status => status === 'OT' || status === 'Overtime').length;

      const rowIndex = index + 6; // Starting from row 6 (after title rows and headers)
      const row = worksheet.getRow(rowIndex);

      row.getCell(1).value = index + 1; // Use sequential numbering based on filtered list
      row.getCell(2).value = employee.name || '';
      row.getCell(3).value = employee.designation || '';

      // Add day columns - only add actual values, skip completely for blank
      dayColumns.forEach(day => {
        const status = attendanceData[day.toString()];
        // Check if it's truly blank/empty
        const isBlank = !status ||
                       status === '' ||
                       status === null ||
                       status === undefined ||
                       status.toString().trim() === '' ||
                       status.toString().toLowerCase() === 'blank';

        if (isBlank) {
          row.getCell(4 + dayColumns.indexOf(day)).value = ''; // Push empty string which ExcelJS will treat as empty
        } else {
          switch(status) {
            case 'P': case 'Present': row.getCell(4 + dayColumns.indexOf(day)).value = 'P'; break;
            case 'A': case 'Absent': row.getCell(4 + dayColumns.indexOf(day)).value = 'A'; break;
            case 'OT': case 'Overtime': row.getCell(4 + dayColumns.indexOf(day)).value = 'OT'; break;
            case 'L': case 'Leave': row.getCell(4 + dayColumns.indexOf(day)).value = 'L'; break;
            case 'H': case 'Holiday': row.getCell(4 + dayColumns.indexOf(day)).value = 'H'; break;
            default: row.getCell(4 + dayColumns.indexOf(day)).value = status;
          }
        }
      });

      // Add summary columns
      row.getCell(4 + daysInMonth).value = presentDays;
      row.getCell(4 + daysInMonth + 1).value = otDays;
      row.getCell(4 + daysInMonth + 2).value = attendanceRecord?.remarks || '';

      // Style each cell in the data row
      row.eachCell((cell, colNumber) => {
        // Base style for all cells (including empty ones)
        const baseStyle = {
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
          // EXPLICITLY SET WHITE FILL for all cells
          //fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
        };

        // Apply base style to all cells
        cell.style = baseStyle;

        // Ensure blank cells have white background
        if (cell.value === '' || cell.value === null || cell.value === undefined) {
          cell.style = {
            ...baseStyle,
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
          };
          return;
        }

        // Make SL.NO column (first column) BOLD
        if (colNumber === 1) {
          cell.style = {
            ...cell.style,
            font: { bold: true }
          };
        }

        // Color code attendance columns - only for cells with actual values
        if (colNumber >= 4 && colNumber < 4 + daysInMonth) {
          const cellValue = cell.value;
          if (cellValue && cellValue.toString().trim() !== '') {
            switch(cellValue.toString().trim()) {
              case 'P':
                cell.style = {
                  ...cell.style,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFE6' } } // Light green
                };
                break;
              case 'A':
                cell.style = {
                  ...cell.style,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } } // Light red
                };
                break;
              case 'OT':
                cell.style = {
                  ...cell.style,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFEF7' } } // Very light yellowish
                };
                break;
              case 'L':
                cell.style = {
                  ...cell.style,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FF' } } // Light blue
                };
                break;
              case 'H':
                cell.style = {
                  ...cell.style,
                  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } // Light gray
                };
                break;
              // If it's any other value but not empty, keep white fill (default from baseStyle)
            }
          }
        }
      });
    });

    // Set column widths
    worksheet.columns = [
      { width: 8 },   // SL.NO
      { width: 25 },  // NAME
      { width: 18 },  // DESIGNATION
      ...dayColumns.map(() => ({ width: 4 })), // Day columns
      { width: 12 },  // T/ON DUTY
      { width: 10 },  // OT DAYS
      { width: 30 }   // REMARKS
    ];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    const filename = `attendance_${monthNames[monthNum - 1]}_${yearNum}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

  } catch (error) {
    console.error('XLSX export error:', error);
    res.status(500).json({
      message: "Failed to generate XLSX export",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

  // PDF Export using Excel-like generation approach
  app.post("/api/export/pdf", async (req, res) => {
    try {
      const { month, year, selectedEmployees } = req.body;

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

      let employees = await storage.getAllEmployees();
      const attendance = await storage.getAttendanceForMonth(monthNum, yearNum);

      // Filter employees if selectedEmployees array is provided AND filter out inactive employees
      if (selectedEmployees && Array.isArray(selectedEmployees) && selectedEmployees.length > 0) {
        employees = employees.filter(emp => selectedEmployees.includes(emp.id) && emp.status !== 'Inactive');
      } else {
        // If no specific employees selected, filter out inactive ones by default
        employees = employees.filter(emp => emp.status !== 'Inactive');
      }

      if (!employees || employees.length === 0) {
        return res.status(404).json({ message: "No employees found for the selected criteria" });
      }

      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // Get settings for export headers
      const appSettings = await storage.getSettings();

      // Prepare headers
      const headers = [
        "SL.NO",
        "NAME",
        "DESIGNATION",
        ...dayColumns.map(day => day.toString()),
        "T/ON DUTY",
        "OT DAYS",
        "REMARKS"
      ];

      // Create Excel-like data structure
      const excelData = employees.map((employee, index) => {
        const attendanceRecord = attendance.find(a => a.employeeId === employee.id);
        let attendanceData: Record<string, string> = {};

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

        // Calculate totals
        const attendanceValues = Object.values(attendanceData);
        const presentDays = attendanceValues.filter(status => status === 'P' || status === 'Present').length;
        const otDays = attendanceValues.filter(status => status === 'OT' || status === 'Overtime').length;

        const rowData = [
          index + 1,
          employee.name || '',
          employee.designation || ''
        ];

        // Add day columns
        dayColumns.forEach(day => {
          const status = attendanceData[day.toString()];
          const isBlank = !status || status === '' || status === null || status === undefined ||
                         status.toString().trim() === '' || status.toString().toLowerCase() === 'blank';

          if (isBlank) {
            rowData.push('');
          } else {
            switch(status) {
              case 'P': case 'Present': rowData.push('P'); break;
              case 'A': case 'Absent': rowData.push('A'); break;
              case 'OT': case 'Overtime': rowData.push('OT'); break;
              case 'L': case 'Leave': rowData.push('L'); break;
              case 'H': case 'Holiday': rowData.push('H'); break;
              default: rowData.push(status);
            }
          }
        });

        rowData.push(presentDays, otDays, attendanceRecord?.remarks || '');
        return rowData;
      });

      // Create PDF document with landscape orientation and dynamic sizing
      const totalColumns = headers.length;
      let orientation: 'landscape' | 'portrait' = 'landscape';
      let format: string = 'a4';
      
      // Determine optimal page size and orientation
      if (totalColumns > 35) {
        format = 'a3';
      } else if (totalColumns > 25) {
        format = 'a4';
        orientation = 'landscape';
      }

      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format
      });

      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 10;
      const usableWidth = pageWidth - (margin * 2);

      // Calculate column widths to fit all data without trimming
      const fixedColumnWidths = {
        0: 8,   // SL.NO
        1: Math.min(25, usableWidth * 0.15),  // NAME
        2: Math.min(18, usableWidth * 0.12),  // DESIGNATION
        [totalColumns - 3]: 12, // T/ON DUTY
        [totalColumns - 2]: 10, // OT DAYS
        [totalColumns - 1]: Math.min(30, usableWidth * 0.15)  // REMARKS
      };

      const fixedWidthTotal = Object.values(fixedColumnWidths).reduce((sum, width) => sum + width, 0);
      const remainingWidth = usableWidth - fixedWidthTotal;
      const dayColumnWidth = Math.max(3, remainingWidth / daysInMonth);

      // Build column styles
      const columnStyles: { [key: number]: any } = {
        ...fixedColumnWidths,
        1: { cellWidth: fixedColumnWidths[1], halign: 'left' },
        2: { cellWidth: fixedColumnWidths[2], halign: 'left' },
        [totalColumns - 1]: { cellWidth: fixedColumnWidths[totalColumns - 1], halign: 'left' }
      };

      // Add day columns
      for (let i = 3; i < totalColumns - 3; i++) {
        columnStyles[i] = { cellWidth: dayColumnWidth };
      }

      // Calculate optimal font size
      const baseFontSize = Math.max(4, Math.min(8, 300 / totalColumns));
      const headerFontSize = Math.max(5, Math.min(9, 320 / totalColumns));

      // Add title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(appSettings.companyName, pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(14);
      doc.text('Attendance', pageWidth / 2, 25, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`${appSettings.rigName}     MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`, pageWidth / 2, 35, { align: 'center' });

      // Generate the table with proper fitting
      autoTable(doc, {
        head: [headers],
        body: excelData,
        startY: 45,
        styles: {
          fontSize: baseFontSize,
          cellPadding: 1,
          overflow: 'linebreak',
          halign: 'center',
          valign: 'middle',
          lineColor: [0, 0, 0],
          lineWidth: 0.3
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: headerFontSize,
          lineColor: [0, 0, 0],
          lineWidth: 0.5
        },
        columnStyles,
        margin: { top: 45, left: margin, right: margin, bottom: 20 },
        tableWidth: 'wrap',
        didDrawCell: function(data: any) {
          // Color code attendance cells
          if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + daysInMonth) {
            const cellValue = data.cell.raw;
            if (cellValue && cellValue.toString().trim() !== '') {
              switch(cellValue.toString().trim()) {
                case 'P':
                  data.cell.styles.fillColor = [230, 255, 230]; // Light green
                  break;
                case 'A':
                  data.cell.styles.fillColor = [255, 230, 230]; // Light red
                  break;
                case 'OT':
                  data.cell.styles.fillColor = [255, 255, 200]; // Light yellow
                  break;
                case 'L':
                  data.cell.styles.fillColor = [230, 230, 255]; // Light blue
                  break;
                case 'H':
                  data.cell.styles.fillColor = [240, 240, 240]; // Light gray
                  break;
              }
            }
          }

          // Make SL.NO column bold
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawPage: function(data: any) {
          // Add page number
          doc.setFontSize(8);
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
        }
      });

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      // Set response headers
      const filename = `attendance_${monthNames[monthNum - 1]}_${yearNum}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({
        message: "Failed to generate PDF export",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}