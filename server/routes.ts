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
    worksheet.addRow([`${appSettings.rigName} MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`]);
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

    // Merge and style title rows
    worksheet.mergeCells(1, 1, 1, headers.length);
    worksheet.getRow(1).getCell(1).style = titleStyle;

    worksheet.mergeCells(2, 1, 2, headers.length);
    worksheet.getRow(2).getCell(1).style = subtitleStyle;

    worksheet.mergeCells(3, 1, 3, headers.length);
    worksheet.getRow(3).getCell(1).style = monthStyle;

    // Style header row (row 5)
    const headerRow = worksheet.getRow(5);
    headerRow.eachCell((cell) => {
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

      const rowIndex = index + 5; // Starting from row 5 (after header rows)
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

  // Improved PDF Export with dynamic layout and color coding
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

      // Create PDF document with dynamic sizing
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4' // Default to A4, will be adjusted later if needed
      });

      // Get page dimensions
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Title with proper company header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(appSettings.companyName, pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Attendance', pageWidth / 2, 25, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`${appSettings.rigName} MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`, pageWidth / 2, 35, { align: 'center' });

      // Prepare table headers to match reference format
      const headers = [
        'SL.NO',
        'NAME',
        'DESIGNATION',
        ...dayColumns.map(day => day.toString()),
        'T/ON DUTY',
        'OT DAYS',
        'REMARKS'
      ];

      // Prepare table data matching reference format
      const tableData = employees.map((employee, index) => {
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

        return [
          index + 1, // Use sequential numbering based on filtered list
          (employee.name || '').substring(0, 15),
          (employee.designation || '').substring(0, 12),
          ...dayColumns.map(day => {
            const status = attendanceData[day.toString()];
            switch(status) {
              case 'P': case 'Present': return 'P';
              case 'A': case 'Absent': return 'A';
              case 'OT': case 'Overtime': return 'OT';
              case 'L': case 'Leave': return 'L';
              case 'H': case 'Holiday': return 'H';
              default: return status || '';
            }
          }),
          presentDays,
          otDays,
          (attendanceRecord?.remarks || '').substring(0, 12)
        ];
      });

      // Calculate dynamic column widths
      const availableWidth = pageWidth - 20; // Subtract margins
      const fixedColsCount = 9; // SL.NO, NAME, DESIGNATION, T/ON DUTY, OT DAYS, REMARKS + 3 dynamic header columns if they exist
      const fixedColsWidth = 65; // Approximate total width for fixed columns (SL.NO, NAME, DESIGNATION, T/ON DUTY, OT DAYS, REMARKS)
      const dayColsWidth = availableWidth - fixedColsWidth;
      const dayColWidth = Math.max(2.5, dayColsWidth / daysInMonth); // Ensure minimum width for day columns

      // Define column styles to match reference format
      const columnStyles: { [key: number]: any } = {
        0: { cellWidth: 8 },   // SL.NO
        1: { cellWidth: 18, halign: 'left' },  // NAME
        2: { cellWidth: 15, halign: 'left' }, // DESIGNATION
        // Summary columns
        [3 + daysInMonth]: { cellWidth: 10 },     // T/ON DUTY
        [3 + daysInMonth + 1]: { cellWidth: 10 }, // OT DAYS
        [3 + daysInMonth + 2]: { cellWidth: 15, halign: 'left' } // REMARKS
      };

      // Add day columns with dynamic width
      for (let i = 0; i < daysInMonth; i++) {
        columnStyles[3 + i] = { cellWidth: dayColWidth };
      }

      // Calculate font size based on number of columns
      const totalColumns = headers.length;
      const baseFontSize = Math.max(3, Math.min(6, 200 / totalColumns));
      const headerFontSize = Math.max(4, Math.min(7, 220 / totalColumns));

      // Generate table with autoTable
      try {
        autoTable(doc, {
          head: [headers],
          body: tableData,
          startY: 45,
          styles: {
            fontSize: baseFontSize,
            cellPadding: 0.5,
            overflow: 'linebreak',
            halign: 'center',
            valign: 'middle',
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: headerFontSize,
            lineColor: [0, 0, 0],
            lineWidth: 0.5
          },
          columnStyles: columnStyles,
          margin: { top: 45, left: 10, right: 10 },
          tableWidth: 'auto',
          // Enable horizontal scrolling for very wide tables
          horizontalPageBreak: true,
          horizontalPageBreakWhen: 'after', // Break before the next row
          horizontalPageBreakRepeat: [0, 1, 2], // Repeat first 3 columns on new pages
          didDrawCell: function(data: any) {
            // Color code attendance cells with vibrant colors
            if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + daysInMonth) {
              const cellValue = data.cell.raw;
              switch(cellValue) {
                case 'P':
                  data.cell.styles.fillColor = [144, 238, 144]; // Light green for Present
                  data.cell.styles.textColor = [0, 100, 0]; // Dark green text
                  break;
                case 'A':
                  data.cell.styles.fillColor = [255, 182, 193]; // Light red for Absent
                  data.cell.styles.textColor = [139, 0, 0]; // Dark red text
                  break;
                case 'OT':
                  data.cell.styles.fillColor = [255, 255, 150]; // Light yellow for Overtime
                  data.cell.styles.textColor = [204, 153, 0]; // Dark yellow text
                  break;
                case 'L':
                  data.cell.styles.fillColor = [173, 216, 230]; // Light blue for Leave
                  data.cell.styles.textColor = [0, 0, 139]; // Dark blue text
                  break;
                case 'H':
                  data.cell.styles.fillColor = [220, 220, 220]; // Light gray for Holiday
                  data.cell.styles.textColor = [105, 105, 105]; // Dark gray text
                  break;
              }
            }

            // Make SL.NO column bold
            if (data.section === 'body' && data.column.index === 0) {
              data.cell.styles.fontStyle = 'bold';
            }

            // Add borders to all cells
            data.cell.styles.lineColor = [0, 0, 0];
            data.cell.styles.lineWidth = 0.1;
          },
          didDrawPage: function(data: any) {
            // Add page number
            doc.setFontSize(8);
            doc.text(
              `Page ${data.pageNumber}`,
              pageWidth - 20,
              pageHeight - 10,
              { align: 'right' }
            );
          }
        });
      } catch (tableError) {
        console.error('Error generating PDF table:', tableError);
        return res.status(500).json({ message: "Failed to generate PDF table" });
      }

      // Adjust page format if table is too wide for A4 landscape
      const finalTableWidth = doc.autoTable.previous.finalStyle.tableWidth;
      if (finalTableWidth > doc.internal.pageSize.getWidth() - 20) { // Check against usable width
        doc.setPageFormat('a3'); // Switch to A3
      }


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