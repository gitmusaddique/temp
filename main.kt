import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import androidx.compose.ui.awt.ComposeWindow

// Material 3
import androidx.compose.material3.*
import androidx.compose.material3.TopAppBarDefaults.topAppBarColors

// Icons
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*

// Layout
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState

// Text and styling
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment

// Database (SQLite)
import java.sql.Connection
import java.sql.DriverManager
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Statement
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.YearMonth

// File operations for export
import java.io.File
import java.io.FileOutputStream
import javax.swing.JFileChooser
import javax.swing.filechooser.FileNameExtensionFilter

// Excel export
import org.apache.poi.ss.usermodel.*
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.apache.poi.ss.util.CellRangeAddress

// PDF export 
import com.itextpdf.text.*
import com.itextpdf.text.pdf.*

// Data classes
data class Employee(
    val id: Long = 0,
    val name: String,
    val designation: String = "",
    val department: String = "",
    val serialNumber: Int = 0
)

data class AttendanceEntry(
    val id: Long = 0,
    val employeeId: Long,
    val month: Int,
    val year: Int,
    val attendanceData: String, // JSON-like string storing daily attendance
    val totalOnDuty: Int = 0,
    val otDays: Int = 0
)

// SQLite Database Manager
object DatabaseManager {
    private lateinit var connection: Connection
    
    fun initialize() {
        try {
            Class.forName("org.sqlite.JDBC")
            connection = DriverManager.getConnection("jdbc:sqlite:attendance.db")
            createTables()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun createTables() {
        val createEmployeesTable = """
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                designation TEXT,
                department TEXT,
                serial_number INTEGER UNIQUE
            )
        """.trimIndent()
        
        val createAttendanceTable = """
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER,
                month INTEGER,
                year INTEGER,
                attendance_data TEXT,
                total_on_duty INTEGER DEFAULT 0,
                ot_days INTEGER DEFAULT 0,
                FOREIGN KEY(employee_id) REFERENCES employees(id),
                UNIQUE(employee_id, month, year)
            )
        """.trimIndent()
        
        connection.createStatement().execute(createEmployeesTable)
        connection.createStatement().execute(createAttendanceTable)
    }
    
    fun insertEmployee(employee: Employee): Long {
        val nextSerial = getNextSerialNumber()
        val sql = "INSERT INTO employees (name, designation, department, serial_number) VALUES (?, ?, ?, ?)"
        val statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)
        statement.setString(1, employee.name)
        statement.setString(2, employee.designation)
        statement.setString(3, employee.department)
        statement.setInt(4, nextSerial)
        statement.executeUpdate()
        
        val keys = statement.generatedKeys
        return if (keys.next()) keys.getLong(1) else 0L
    }
    
    private fun getNextSerialNumber(): Int {
        val sql = "SELECT COALESCE(MAX(serial_number), 0) + 1 FROM employees"
        val statement = connection.createStatement()
        val result = statement.executeQuery(sql)
        return if (result.next()) result.getInt(1) else 1
    }
    
    fun getAllEmployees(): List<Employee> {
        val employees = mutableListOf<Employee>()
        val sql = "SELECT * FROM employees ORDER BY serial_number"
        val statement = connection.createStatement()
        val result = statement.executeQuery(sql)
        
        while (result.next()) {
            employees.add(
                Employee(
                    id = result.getLong("id"),
                    name = result.getString("name"),
                    designation = result.getString("designation") ?: "",
                    department = result.getString("department") ?: "",
                    serialNumber = result.getInt("serial_number")
                )
            )
        }
        return employees
    }
    
    fun updateEmployee(employee: Employee) {
        val sql = "UPDATE employees SET name = ?, designation = ?, department = ? WHERE id = ?"
        val statement = connection.prepareStatement(sql)
        statement.setString(1, employee.name)
        statement.setString(2, employee.designation)
        statement.setString(3, employee.department)
        statement.setLong(4, employee.id)
        statement.executeUpdate()
    }
    
    fun deleteEmployee(id: Long) {
        val sql = "DELETE FROM employees WHERE id = ?"
        val statement = connection.prepareStatement(sql)
        statement.setLong(1, id)
        statement.executeUpdate()
        
        // Also delete attendance records
        val attendanceSql = "DELETE FROM attendance WHERE employee_id = ?"
        val attendanceStatement = connection.prepareStatement(attendanceSql)
        attendanceStatement.setLong(1, id)
        attendanceStatement.executeUpdate()
    }
    
    fun getAttendanceData(month: Int, year: Int): List<AttendanceEntry> {
        val attendance = mutableListOf<AttendanceEntry>()
        val sql = "SELECT * FROM attendance WHERE month = ? AND year = ?"
        val statement = connection.prepareStatement(sql)
        statement.setInt(1, month)
        statement.setInt(2, year)
        val result = statement.executeQuery()
        
        while (result.next()) {
            attendance.add(
                AttendanceEntry(
                    id = result.getLong("id"),
                    employeeId = result.getLong("employee_id"),
                    month = result.getInt("month"),
                    year = result.getInt("year"),
                    attendanceData = result.getString("attendance_data") ?: "",
                    totalOnDuty = result.getInt("total_on_duty"),
                    otDays = result.getInt("ot_days")
                )
            )
        }
        return attendance
    }
    
    fun saveAttendanceData(attendance: AttendanceEntry) {
        val sql = """
            INSERT OR REPLACE INTO attendance 
            (employee_id, month, year, attendance_data, total_on_duty, ot_days) 
            VALUES (?, ?, ?, ?, ?, ?)
        """.trimIndent()
        val statement = connection.prepareStatement(sql)
        statement.setLong(1, attendance.employeeId)
        statement.setInt(2, attendance.month)
        statement.setInt(3, attendance.year)
        statement.setString(4, attendance.attendanceData)
        statement.setInt(5, attendance.totalOnDuty)
        statement.setInt(6, attendance.otDays)
        statement.executeUpdate()
    }
}

// Application State
object AppState {
    var currentScreen by mutableStateOf(Screen.Home)
    var employees by mutableStateOf(listOf<Employee>())
    var selectedMonth by mutableStateOf(LocalDate.now().monthValue)
    var selectedYear by mutableStateOf(LocalDate.now().year)
    var attendanceData by mutableStateOf(mapOf<Long, Map<Int, String>>())
    
    fun refreshEmployees() {
        employees = DatabaseManager.getAllEmployees()
    }
    
    fun refreshAttendance() {
        val records = DatabaseManager.getAttendanceData(selectedMonth, selectedYear)
        val attendanceMap = mutableMapOf<Long, Map<Int, String>>()
        
        records.forEach { record ->
            // Parse attendance data (simple format: "day:status,day:status,...")
            val dailyData = mutableMapOf<Int, String>()
            record.attendanceData.split(",").forEach { entry ->
                if (entry.contains(":")) {
                    val parts = entry.split(":")
                    if (parts.size == 2) {
                        dailyData[parts[0].toInt()] = parts[1]
                    }
                }
            }
            attendanceMap[record.employeeId] = dailyData
        }
        attendanceData = attendanceMap
    }
}

enum class Screen {
    Home, Attendance, Export
}

// Main Application
fun main() = application {
    val windowState = rememberWindowState(width = 1200.dp, height = 800.dp)
    
    Window(
        onCloseRequest = ::exitApplication,
        title = "South Asia Consultancy - Attendance Management",
        state = windowState
    ) {
        LaunchedEffect(Unit) {
            DatabaseManager.initialize()
            AppState.refreshEmployees()
            AppState.refreshAttendance()
        }
        
        MaterialTheme(
            colorScheme = lightColorScheme(
                primary = Color(0xFF6750A4),
                onPrimary = Color(0xFFFFFFFF),
                primaryContainer = Color(0xFFEADDFF),
                onPrimaryContainer = Color(0xFF21005D),
                secondary = Color(0xFF625B71),
                onSecondary = Color(0xFFFFFFFF),
                secondaryContainer = Color(0xFFE8DEF8),
                onSecondaryContainer = Color(0xFF1D192B),
                tertiary = Color(0xFF7D5260),
                onTertiary = Color(0xFFFFFFFF),
                tertiaryContainer = Color(0xFFFFD8E4),
                onTertiaryContainer = Color(0xFF31111D),
                error = Color(0xFFBA1A1A),
                onError = Color(0xFFFFFFFF),
                errorContainer = Color(0xFFFFDAD6),
                onErrorContainer = Color(0xFF410002),
                background = Color(0xFFFFFBFE),
                onBackground = Color(0xFF1C1B1F),
                surface = Color(0xFFFFFBFE),
                onSurface = Color(0xFF1C1B1F),
                surfaceVariant = Color(0xFFE7E0EC),
                onSurfaceVariant = Color(0xFF49454F),
                outline = Color(0xFF79747E),
                outlineVariant = Color(0xFFCAC4D0),
                scrim = Color(0xFF000000)
            )
        ) {
            AttendanceApp()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceApp() {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Business,
                            contentDescription = "Company Logo",
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                "South Asia Consultancy",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                            Text(
                                "Attendance Management System",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                colors = topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home") },
                    selected = AppState.currentScreen == Screen.Home,
                    onClick = { AppState.currentScreen = Screen.Home }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = "Attendance") },
                    label = { Text("Attendance") },
                    selected = AppState.currentScreen == Screen.Attendance,
                    onClick = { AppState.currentScreen = Screen.Attendance }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.FileDownload, contentDescription = "Export") },
                    label = { Text("Export") },
                    selected = AppState.currentScreen == Screen.Export,
                    onClick = { AppState.currentScreen = Screen.Export }
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (AppState.currentScreen) {
                Screen.Home -> HomeScreen()
                Screen.Attendance -> AttendanceScreen()
                Screen.Export -> ExportScreen()
            }
        }
    }
}

@Composable
fun HomeScreen() {
    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedEmployee by remember { mutableStateOf<Employee?>(null) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Quick Actions
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Button(
                    onClick = { showCreateDialog = true },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Employee")
                }
                
                Spacer(modifier = Modifier.width(16.dp))
                
                Button(
                    onClick = { AppState.currentScreen = Screen.Attendance },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.CalendarMonth, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("View Attendance")
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Employee List
        Text(
            "Employees",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        if (AppState.employees.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.PersonAdd,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.outline
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("No employees yet")
                    Text(
                        "Add your first employee to get started",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(AppState.employees) { employee ->
                    EmployeeCard(
                        employee = employee,
                        onEdit = { selectedEmployee = it },
                        onDelete = { 
                            selectedEmployee = it
                            showDeleteDialog = true
                        }
                    )
                }
            }
        }
    }

    // Dialogs
    if (showCreateDialog) {
        CreateEmployeeDialog(
            onDismiss = { showCreateDialog = false },
            onEmployeeCreated = {
                AppState.refreshEmployees()
                showCreateDialog = false
            }
        )
    }

    if (selectedEmployee != null && !showDeleteDialog) {
        EditEmployeeDialog(
            employee = selectedEmployee!!,
            onDismiss = { selectedEmployee = null },
            onEmployeeUpdated = {
                AppState.refreshEmployees()
                selectedEmployee = null
            }
        )
    }

    if (showDeleteDialog && selectedEmployee != null) {
        DeleteEmployeeDialog(
            employee = selectedEmployee!!,
            onDismiss = { 
                showDeleteDialog = false
                selectedEmployee = null
            },
            onEmployeeDeleted = {
                AppState.refreshEmployees()
                showDeleteDialog = false
                selectedEmployee = null
            }
        )
    }
}

@Composable
fun EmployeeCard(
    employee: Employee,
    onEdit: (Employee) -> Unit,
    onDelete: (Employee) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Card(
                modifier = Modifier.size(48.dp),
                shape = CircleShape,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        employee.serialNumber.toString(),
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    employee.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                if (employee.designation.isNotEmpty()) {
                    Text(
                        employee.designation,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (employee.department.isNotEmpty()) {
                    Text(
                        employee.department,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
            
            IconButton(onClick = { onEdit(employee) }) {
                Icon(Icons.Default.Edit, contentDescription = "Edit")
            }
            
            IconButton(onClick = { onDelete(employee) }) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
fun CreateEmployeeDialog(
    onDismiss: () -> Unit,
    onEmployeeCreated: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var designation by remember { mutableStateOf("") }
    var department by remember { mutableStateOf("") }
    
    val designations = listOf(
        "Rig I/C", "Shift I/C", "Asst.Shift I/C", "Top-Man", "Rig-Man"
    )
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add New Employee") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                // Designation Dropdown
                var expanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = !expanded },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = designation,
                        onValueChange = { designation = it },
                        label = { Text("Designation") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        readOnly = false,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        designations.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = {
                                    designation = option
                                    expanded = false
                                }
                            )
                        }
                    }
                }
                
                OutlinedTextField(
                    value = department,
                    onValueChange = { department = it },
                    label = { Text("Department") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val employee = Employee(
                            name = name.trim(),
                            designation = designation.trim(),
                            department = department.trim()
                        )
                        DatabaseManager.insertEmployee(employee)
                        onEmployeeCreated()
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun EditEmployeeDialog(
    employee: Employee,
    onDismiss: () -> Unit,
    onEmployeeUpdated: () -> Unit
) {
    var name by remember { mutableStateOf(employee.name) }
    var designation by remember { mutableStateOf(employee.designation) }
    var department by remember { mutableStateOf(employee.department) }
    
    val designations = listOf(
        "Rig I/C", "Shift I/C", "Asst.Shift I/C", "Top-Man", "Rig-Man"
    )
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Employee") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                // Designation Dropdown
                var expanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = !expanded },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = designation,
                        onValueChange = { designation = it },
                        label = { Text("Designation") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        readOnly = false,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        designations.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = {
                                    designation = option
                                    expanded = false
                                }
                            )
                        }
                    }
                }
                
                OutlinedTextField(
                    value = department,
                    onValueChange = { department = it },
                    label = { Text("Department") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val updatedEmployee = employee.copy(
                            name = name.trim(),
                            designation = designation.trim(),
                            department = department.trim()
                        )
                        DatabaseManager.updateEmployee(updatedEmployee)
                        onEmployeeUpdated()
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text("Update")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun DeleteEmployeeDialog(
    employee: Employee,
    onDismiss: () -> Unit,
    onEmployeeDeleted: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete Employee") },
        text = {
            Text("Are you sure you want to delete ${employee.name}? This action cannot be undone and will remove all attendance records for this employee.")
        },
        confirmButton = {
            Button(
                onClick = {
                    DatabaseManager.deleteEmployee(employee.id)
                    onEmployeeDeleted()
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun AttendanceScreen() {
    val monthNames = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    )
    
    LaunchedEffect(AppState.selectedMonth, AppState.selectedYear) {
        AppState.refreshAttendance()
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Month/Year Selector
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "Monthly Attendance",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Month Selector
                    var monthExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = monthExpanded,
                        onExpandedChange = { monthExpanded = !monthExpanded }
                    ) {
                        OutlinedTextField(
                            value = monthNames[AppState.selectedMonth - 1],
                            onValueChange = { },
                            readOnly = true,
                            label = { Text("Month") },
                            modifier = Modifier
                                .width(120.dp)
                                .menuAnchor(),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = monthExpanded) }
                        )
                        ExposedDropdownMenu(
                            expanded = monthExpanded,
                            onDismissRequest = { monthExpanded = false }
                        ) {
                            monthNames.forEachIndexed { index, month ->
                                DropdownMenuItem(
                                    text = { Text(month) },
                                    onClick = {
                                        AppState.selectedMonth = index + 1
                                        monthExpanded = false
                                    }
                                )
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.width(8.dp))
                    
                    // Year Selector
                    var yearExpanded by remember { mutableStateOf(false) }
                    val years = (2020..2030).toList()
                    ExposedDropdownMenuBox(
                        expanded = yearExpanded,
                        onExpandedChange = { yearExpanded = !yearExpanded }
                    ) {
                        OutlinedTextField(
                            value = AppState.selectedYear.toString(),
                            onValueChange = { },
                            readOnly = true,
                            label = { Text("Year") },
                            modifier = Modifier
                                .width(100.dp)
                                .menuAnchor(),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = yearExpanded) }
                        )
                        ExposedDropdownMenu(
                            expanded = yearExpanded,
                            onDismissRequest = { yearExpanded = false }
                        ) {
                            years.forEach { year ->
                                DropdownMenuItem(
                                    text = { Text(year.toString()) },
                                    onClick = {
                                        AppState.selectedYear = year
                                        yearExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Attendance Table
        AttendanceTable()
    }
}

@Composable
fun AttendanceTable() {
    val daysInMonth = YearMonth.of(AppState.selectedYear, AppState.selectedMonth).lengthOfMonth()
    val monthName = listOf(
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    )[AppState.selectedMonth - 1]
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "South Asia Consultancy",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        "Attendance",
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        "ROM-100-II                                    MONTH:-$monthName. ${AppState.selectedYear}",
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            
            // Table Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(vertical = 8.dp)
            ) {
                Text(
                    "SL.NO",
                    modifier = Modifier.width(50.dp).padding(horizontal = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "NAME",
                    modifier = Modifier.width(120.dp).padding(horizontal = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "DESIGNATION",
                    modifier = Modifier.width(100.dp).padding(horizontal = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )
                
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState())
                ) {
                    repeat(daysInMonth) { day ->
                        Text(
                            (day + 1).toString(),
                            modifier = Modifier.width(30.dp).padding(horizontal = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    }
                    Text(
                        "T/ON DUTY",
                        modifier = Modifier.width(60.dp).padding(horizontal = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        "OT DAYS",
                        modifier = Modifier.width(60.dp).padding(horizontal = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }
            }
            
            // Table Body
            LazyColumn {
                items(AppState.employees) { employee ->
                    AttendanceRow(employee, daysInMonth)
                }
            }
        }
    }
}

@Composable
fun AttendanceRow(employee: Employee, daysInMonth: Int) {
    val employeeAttendance = AppState.attendanceData[employee.id] ?: emptyMap()
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Text(
            employee.serialNumber.toString(),
            modifier = Modifier.width(50.dp).padding(horizontal = 4.dp),
            style = MaterialTheme.typography.bodySmall
        )
        Text(
            employee.name,
            modifier = Modifier.width(120.dp).padding(horizontal = 4.dp),
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            employee.designation,
            modifier = Modifier.width(100.dp).padding(horizontal = 4.dp),
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState())
        ) {
            var totalPresent = 0
            var totalOT = 0
            
            repeat(daysInMonth) { day ->
                val status = employeeAttendance[day + 1] ?: ""
                when (status) {
                    "P" -> totalPresent++
                    "OT" -> totalOT++
                }
                
                AttendanceCell(
                    day = day + 1,
                    status = status,
                    employee = employee,
                    onStatusChange = { newStatus ->
                        updateAttendanceStatus(employee.id, day + 1, newStatus)
                    }
                )
            }
            
            Text(
                totalPresent.toString(),
                modifier = Modifier.width(60.dp).padding(horizontal = 4.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Bold
            )
            Text(
                totalOT.toString(),
                modifier = Modifier.width(60.dp).padding(horizontal = 4.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun AttendanceCell(
    day: Int,
    status: String,
    employee: Employee,
    onStatusChange: (String) -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    
    Box(
        modifier = Modifier
            .width(30.dp)
            .height(30.dp)
            .padding(horizontal = 2.dp)
            .border(1.dp, MaterialTheme.colorScheme.outline)
            .clickable { showDialog = true }
            .background(
                when (status) {
                    "OT" -> MaterialTheme.colorScheme.tertiaryContainer
                    "P" -> MaterialTheme.colorScheme.secondaryContainer
                    "A" -> MaterialTheme.colorScheme.errorContainer
                    else -> MaterialTheme.colorScheme.surface
                }
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            status,
            style = MaterialTheme.typography.labelSmall,
            textAlign = TextAlign.Center,
            color = when (status) {
                "OT" -> MaterialTheme.colorScheme.onTertiaryContainer
                "P" -> MaterialTheme.colorScheme.onSecondaryContainer
                "A" -> MaterialTheme.colorScheme.onErrorContainer
                else -> MaterialTheme.colorScheme.onSurface
            }
        )
    }
    
    if (showDialog) {
        AttendanceStatusDialog(
            day = day,
            currentStatus = status,
            onStatusSelected = { newStatus ->
                onStatusChange(newStatus)
                showDialog = false
            },
            onDismiss = { showDialog = false }
        )
    }
}

@Composable
fun AttendanceStatusDialog(
    day: Int,
    currentStatus: String,
    onStatusSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val statuses = listOf("", "P", "A", "OT")
    val statusLabels = listOf("Blank", "Present", "Absent", "Overtime")
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Day $day Attendance") },
        text = {
            Column {
                statuses.forEachIndexed { index, status ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onStatusSelected(status) }
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = currentStatus == status,
                            onClick = { onStatusSelected(status) }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(statusLabels[index])
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

fun updateAttendanceStatus(employeeId: Long, day: Int, status: String) {
    val currentData = AppState.attendanceData[employeeId]?.toMutableMap() ?: mutableMapOf()
    if (status.isEmpty()) {
        currentData.remove(day)
    } else {
        currentData[day] = status
    }
    
    // Update local state
    AppState.attendanceData = AppState.attendanceData.toMutableMap().apply {
        put(employeeId, currentData)
    }
    
    // Save to database
    val attendanceString = currentData.map { "${it.key}:${it.value}" }.joinToString(",")
    val totalPresent = currentData.values.count { it == "P" }
    val totalOT = currentData.values.count { it == "OT" }
    
    val attendanceEntry = AttendanceEntry(
        employeeId = employeeId,
        month = AppState.selectedMonth,
        year = AppState.selectedYear,
        attendanceData = attendanceString,
        totalOnDuty = totalPresent,
        otDays = totalOT
    )
    
    DatabaseManager.saveAttendanceData(attendanceEntry)
}

@Composable
fun ExportScreen() {
    var selectedFormat by remember { mutableStateOf("XLSX") }
    var isExporting by remember { mutableStateOf(false) }
    var exportMessage by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            "Export Attendance Data",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                Text(
                    "Export Settings",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text("Format:")
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = selectedFormat == "XLSX",
                        onClick = { selectedFormat = "XLSX" }
                    )
                    Text("Excel (XLSX)")
                    
                    Spacer(modifier = Modifier.width(16.dp))
                    
                    RadioButton(
                        selected = selectedFormat == "PDF",
                        onClick = { selectedFormat = "PDF" }
                    )
                    Text("PDF Document")
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    "Month: ${listOf(
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"
                    )[AppState.selectedMonth - 1]} ${AppState.selectedYear}",
                    style = MaterialTheme.typography.bodyLarge
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Button(
                    onClick = {
                        isExporting = true
                        exportMessage = ""
                        try {
                            when (selectedFormat) {
                                "XLSX" -> exportToExcel()
                                "PDF" -> exportToPDF()
                            }
                            exportMessage = "$selectedFormat file exported successfully!"
                        } catch (e: Exception) {
                            exportMessage = "Export failed: ${e.message}"
                        } finally {
                            isExporting = false
                        }
                    },
                    enabled = !isExporting,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isExporting) {
                        Text("Exporting...")
                    } else {
                        Icon(Icons.Default.FileDownload, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Export $selectedFormat")
                    }
                }
                
                if (exportMessage.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (exportMessage.contains("successfully"))
                                MaterialTheme.colorScheme.secondaryContainer
                            else
                                MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            exportMessage,
                            modifier = Modifier.padding(12.dp),
                            color = if (exportMessage.contains("successfully"))
                                MaterialTheme.colorScheme.onSecondaryContainer
                            else
                                MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }
        }
    }
}

fun exportToExcel() {
    val workbook = XSSFWorkbook()
    val sheet = workbook.createSheet("Attendance")
    
    val monthNames = listOf(
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    )
    val monthName = monthNames[AppState.selectedMonth - 1]
    val daysInMonth = YearMonth.of(AppState.selectedYear, AppState.selectedMonth).lengthOfMonth()
    
    var rowNum = 0
    
    // Title
    val titleRow = sheet.createRow(rowNum++)
    val titleCell = titleRow.createCell(0)
    titleCell.setCellValue("South Asia Consultancy")
    sheet.addMergedRegion(CellRangeAddress(0, 0, 0, daysInMonth + 4))
    
    val subtitleRow = sheet.createRow(rowNum++)
    subtitleRow.createCell(0).setCellValue("Attendance")
    
    val headerRow = sheet.createRow(rowNum++)
    headerRow.createCell(0).setCellValue("ROM-100-II                                    MONTH:-$monthName. ${AppState.selectedYear}")
    
    rowNum++ // Empty row
    
    // Column headers
    val headerRowCells = sheet.createRow(rowNum++)
    headerRowCells.createCell(0).setCellValue("SL.NO")
    headerRowCells.createCell(1).setCellValue("NAME")
    headerRowCells.createCell(2).setCellValue("DESIGNATION")
    
    for (day in 1..daysInMonth) {
        headerRowCells.createCell(day + 2).setCellValue(day.toString())
    }
    headerRowCells.createCell(daysInMonth + 3).setCellValue("T/ON DUTY")
    headerRowCells.createCell(daysInMonth + 4).setCellValue("OT DAYS")
    
    // Data rows
    AppState.employees.forEach { employee ->
        val dataRow = sheet.createRow(rowNum++)
        dataRow.createCell(0).setCellValue(employee.serialNumber.toDouble())
        dataRow.createCell(1).setCellValue(employee.name)
        dataRow.createCell(2).setCellValue(employee.designation)
        
        val employeeAttendance = AppState.attendanceData[employee.id] ?: emptyMap()
        var totalPresent = 0
        var totalOT = 0
        
        for (day in 1..daysInMonth) {
            val status = employeeAttendance[day] ?: ""
            dataRow.createCell(day + 2).setCellValue(status)
            when (status) {
                "P" -> totalPresent++
                "OT" -> totalOT++
            }
        }
        
        dataRow.createCell(daysInMonth + 3).setCellValue(totalPresent.toDouble())
        dataRow.createCell(daysInMonth + 4).setCellValue(totalOT.toDouble())
    }
    
    // Auto-size columns
    for (i in 0..daysInMonth + 4) {
        sheet.autoSizeColumn(i)
    }
    
    // Save file
    val fileChooser = JFileChooser()
    fileChooser.selectedFile = File("Attendance_${monthName}_${AppState.selectedYear}.xlsx")
    fileChooser.fileFilter = FileNameExtensionFilter("Excel files", "xlsx")
    
    if (fileChooser.showSaveDialog(null) == JFileChooser.APPROVE_OPTION) {
        FileOutputStream(fileChooser.selectedFile).use { fos ->
            workbook.write(fos)
        }
    }
    
    workbook.close()
}

fun exportToPDF() {
    val document = Document(PageSize.A4.rotate())
    val fileChooser = JFileChooser()
    val monthNames = listOf(
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    )
    val monthName = monthNames[AppState.selectedMonth - 1]
    
    fileChooser.selectedFile = File("Attendance_${monthName}_${AppState.selectedYear}.pdf")
    fileChooser.fileFilter = FileNameExtensionFilter("PDF files", "pdf")
    
    if (fileChooser.showSaveDialog(null) == JFileChooser.APPROVE_OPTION) {
        val writer = PdfWriter.getInstance(document, FileOutputStream(fileChooser.selectedFile))
        document.open()
        
        // Title
        val titleFont = Font(Font.FontFamily.HELVETICA, 16f, Font.BOLD)
        val headerFont = Font(Font.FontFamily.HELVETICA, 12f, Font.BOLD)
        val normalFont = Font(Font.FontFamily.HELVETICA, 8f)
        
        val title = Paragraph("South Asia Consultancy", titleFont)
        title.alignment = Element.ALIGN_CENTER
        document.add(title)
        
        val subtitle = Paragraph("Attendance", headerFont)
        subtitle.alignment = Element.ALIGN_CENTER
        document.add(subtitle)
        
        val header = Paragraph("ROM-100-II                                    MONTH:-$monthName. ${AppState.selectedYear}", normalFont)
        header.alignment = Element.ALIGN_CENTER
        document.add(header)
        
        document.add(Paragraph(" ")) // Empty line
        
        // Table
        val daysInMonth = YearMonth.of(AppState.selectedYear, AppState.selectedMonth).lengthOfMonth()
        val table = PdfPTable(daysInMonth + 5) // SL.NO, NAME, DESIGNATION, days, T/ON DUTY, OT DAYS
        
        // Headers
        table.addCell(PdfPCell(Phrase("SL.NO", headerFont)))
        table.addCell(PdfPCell(Phrase("NAME", headerFont)))
        table.addCell(PdfPCell(Phrase("DESIGNATION", headerFont)))
        
        for (day in 1..daysInMonth) {
            table.addCell(PdfPCell(Phrase(day.toString(), headerFont)))
        }
        table.addCell(PdfPCell(Phrase("T/ON DUTY", headerFont)))
        table.addCell(PdfPCell(Phrase("OT DAYS", headerFont)))
        
        // Data
        AppState.employees.forEach { employee ->
            table.addCell(PdfPCell(Phrase(employee.serialNumber.toString(), normalFont)))
            table.addCell(PdfPCell(Phrase(employee.name, normalFont)))
            table.addCell(PdfPCell(Phrase(employee.designation, normalFont)))
            
            val employeeAttendance = AppState.attendanceData[employee.id] ?: emptyMap()
            var totalPresent = 0
            var totalOT = 0
            
            for (day in 1..daysInMonth) {
                val status = employeeAttendance[day] ?: ""
                table.addCell(PdfPCell(Phrase(status, normalFont)))
                when (status) {
                    "P" -> totalPresent++
                    "OT" -> totalOT++
                }
            }
            
            table.addCell(PdfPCell(Phrase(totalPresent.toString(), normalFont)))
            table.addCell(PdfPCell(Phrase(totalOT.toString(), normalFont)))
        }
        
        document.add(table)
        document.close()
    }
}