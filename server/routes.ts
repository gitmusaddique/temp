
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEmployeeSchema, insertAttendanceSchema } from "@shared/schema";
import { z } from "zod";

// Static imports for export functionality
import * as XLSX from 'xlsx';
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

  // Improved XLSX Export with proper formatting
  app.post("/api/export/xlsx", async (req, res) => {
    try {
      const { month, year } = req.body;

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

      const employees = await storage.getAllEmployees();
      const attendance = await storage.getAttendanceForMonth(monthNum, yearNum);

      if (!employees || employees.length === 0) {
        return res.status(404).json({ message: "No employees found" });
      }

      // Create attendance data for Excel
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // Prepare headers to match the reference format
      const headers = [
        "SL.NO",
        "NAME",
        "DESIGNATION",
        ...dayColumns.map(day => day.toString()),
        "T/ON DUTY",
        "OT DAYS",
        "REMARKS"
      ];

      // Prepare data rows matching the reference format
      const data = employees.map((employee, index) => {
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

        const row = [
          index + 1,
          employee.name || '',
          employee.designation || '',
          ...dayColumns.map(day => {
            const status = attendanceData[day.toString()];
            // Normalize status values to match reference format
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
          attendanceRecord?.remarks || ''
        ];

        return row;
      });

      // Create worksheet with proper headers matching reference format
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Add title rows with proper formatting structure
      XLSX.utils.sheet_add_aoa(ws, [
        ['South Asia Consultancy'],                                    // Row 1
        ['Attendance'],                                                // Row 2
        [`ROM-100-II MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`], // Row 3
        [], // Empty row 4
        headers // Row 5 - Headers
      ], { origin: 'A1' });

      // Add data starting from row 6 (after headers)
      XLSX.utils.sheet_add_aoa(ws, data, { origin: 'A6' });

      // Set column widths to match reference format
      const colWidths = [
        { wch: 8 },   // SL.NO
        { wch: 25 },  // NAME
        { wch: 18 },  // DESIGNATION
        ...dayColumns.map(() => ({ wch: 4 })), // Day columns (smaller)
        { wch: 12 },  // T/ON DUTY
        { wch: 10 },   // OT DAYS
        { wch: 30 }   // REMARKS
      ];
      ws['!cols'] = colWidths;

      // Merge cells for title rows
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, // Merge company name row
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }, // Merge attendance row
        { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } }  // Merge ROM-100-II month row
      ];

      // Style the company name (Row 1)
      const companyCellA1 = ws['A1'];
      if (!companyCellA1) ws['A1'] = { t: 's', v: 'South Asia Consultancy' };
      ws['A1'].s = {
        font: { bold: true, size: 18 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium' },
          bottom: { style: 'thin' },
          left: { style: 'medium' },
          right: { style: 'medium' }
        }
      };

      // Style the attendance title (Row 2)
      const attendanceCellA2 = ws['A2'];
      if (!attendanceCellA2) ws['A2'] = { t: 's', v: 'Attendance' };
      ws['A2'].s = {
        font: { bold: true, size: 16 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'medium' },
          right: { style: 'medium' }
        }
      };

      // Style the ROM-100-II month row (Row 3)
      const monthCellA3 = ws['A3'];
      if (!monthCellA3) ws['A3'] = { t: 's', v: `ROM-100-II MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}` };
      ws['A3'].s = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'medium' },
          left: { style: 'medium' },
          right: { style: 'medium' }
        }
      };

      // Style the header row (Row 5) - make all headers bold
      const headerRowIndex = 4; // 0-based index for row 5
      for (let col = 0; col < headers.length; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
        if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: headers[col] };
        ws[cellAddress].s = {
          font: { bold: true, size: 11 },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'E6E6E6' } }, // Light gray background
          border: {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      }

      // Style data rows - make SL.NO column bold and add borders
      const startDataRow = 5; // 0-based index for row 6
      for (let row = 0; row < data.length; row++) {
        for (let col = 0; col < headers.length; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: startDataRow + row, c: col });
          const cellValue = data[row][col];

          if (!ws[cellAddress]) {
            ws[cellAddress] = {
              t: typeof cellValue === 'number' ? 'n' : 's',
              v: cellValue
            };
          }

          // Base style for all data cells
          const cellStyle: any = {
            alignment: { horizontal: col === 0 || col === headers.length - 2 || col === headers.length - 1 ? 'center' : 'left', vertical: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };

          // Make SL.NO column (first column) bold
          if (col === 0) {
            cellStyle.font = { bold: true };
          }

          // Color coding for attendance status
          if (col >= 3 && col < 3 + daysInMonth) {
            switch(cellValue) {
              case 'P':
                cellStyle.fill = { fgColor: { rgb: 'E6FFE6' } }; // Light green for present
                break;
              case 'A':
                cellStyle.fill = { fgColor: { rgb: 'FFE6E6' } }; // Light red for absent
                break;
              case 'OT':
                cellStyle.fill = { fgColor: { rgb: 'FFFFE6' } }; // Light yellow for overtime
                break;
              case 'L':
                cellStyle.fill = { fgColor: { rgb: 'E6E6FF' } }; // Light blue for leave
                break;
              case 'H':
                cellStyle.fill = { fgColor: { rgb: 'F0F0F0' } }; // Light gray for holiday
                break;
            }
          }

          ws[cellAddress].s = cellStyle;
        }
      }

      // Add borders around the entire data table
      const lastDataRow = startDataRow + data.length - 1;
      const lastCol = headers.length - 1;

      // Add thick borders around the entire table
      for (let col = 0; col <= lastCol; col++) {
        // Top border of header row
        const headerCell = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
        if (ws[headerCell] && ws[headerCell].s) {
          ws[headerCell].s.border.top = { style: 'medium' };
        }

        // Bottom border of last data row
        const lastRowCell = XLSX.utils.encode_cell({ r: lastDataRow, c: col });
        if (ws[lastRowCell] && ws[lastRowCell].s) {
          ws[lastRowCell].s.border.bottom = { style: 'medium' };
        }
      }

      // Add thick left and right borders
      for (let row = headerRowIndex; row <= lastDataRow; row++) {
        // Left border
        const leftCell = XLSX.utils.encode_cell({ r: row, c: 0 });
        if (ws[leftCell] && ws[leftCell].s) {
          ws[leftCell].s.border.left = { style: 'medium' };
        }

        // Right border
        const rightCell = XLSX.utils.encode_cell({ r: row, c: lastCol });
        if (ws[rightCell] && ws[rightCell].s) {
          ws[rightCell].s.border.right = { style: 'medium' };
        }
      }

      const sheetName = `${monthNames[monthNum - 1]} ${yearNum}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate buffer with error handling
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

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
      const { month, year } = req.body;

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

      const employees = await storage.getAllEmployees();
      const attendance = await storage.getAttendanceForMonth(monthNum, yearNum);

      if (!employees || employees.length === 0) {
        return res.status(404).json({ message: "No employees found" });
      }

      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // Determine page size based on number of columns
      const totalColumns = 9 + daysInMonth; // 9 fixed columns + day columns
      let pageFormat = 'a4';
      let orientation: 'landscape' | 'portrait' = 'landscape';

      // For months with many days, use A3 or split into multiple tables
      if (totalColumns > 40) {
        pageFormat = 'a3';
      }

      // Create PDF document with dynamic sizing
      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: pageFormat as any
      });

      // Get page dimensions
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Title with proper company header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('South Asia Consultancy', pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Attendance', pageWidth / 2, 25, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`ROM-100-II MONTH:-${monthNames[monthNum - 1].toUpperCase()}. ${yearNum}`, pageWidth / 2, 35, { align: 'center' });

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
          index + 1,
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
      const fixedCols = 9; // Non-day columns
      const fixedColsWidth = 70; // Total width for fixed columns
      const dayColsWidth = availableWidth - fixedColsWidth;
      const dayColWidth = Math.max(2.5, dayColsWidth / daysInMonth);

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
