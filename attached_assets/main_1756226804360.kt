// Core Compose
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier

// Material 3 Components
import androidx.compose.material3.*
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton

// Icons
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*

// Layout
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.clickable
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Desktop Window
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

// Shapes
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape

// Text
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import kotlinx.coroutines.delay

// For image handling
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import java.io.File
import javax.imageio.ImageIO
import javax.swing.JFileChooser

// For QR Code scanning (mock implementation)
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

enum class Screen {
    Invoice,
    Inventory,
    Accounting,
    AddItem,
    QRScanner,
    CreateInvoice
}

enum class PaymentMethod {
    UPI,
    CASH,
    CARD
}

data class InvoiceItem(
    val sku: String,
    val name: String,
    val brand: String,
    val size: String,
    val color: String,
    val price: Double,
    val quantity: Int = 1
)

data class Invoice(
    val id: String,
    val items: List<InvoiceItem>,
    val total: Double,
    val paymentMethod: PaymentMethod,
    val customerName: String = "",
    val date: LocalDateTime = LocalDateTime.now()
)

// Mock inventory data
val mockInventory = listOf(
    InvoiceItem("SKU001", "Air Max 90", "Nike", "42", "White", 8999.0),
    InvoiceItem("SKU002", "Chuck Taylor", "Converse", "41", "Black", 3999.0),
    InvoiceItem("SKU003", "Stan Smith", "Adidas", "43", "Green", 6999.0),
    InvoiceItem("SKU004", "Old Skool", "Vans", "40", "Red", 4999.0),
    InvoiceItem("SKU005", "Air Force 1", "Nike", "44", "Black", 9999.0),
    InvoiceItem("SKU006", "React Element 55", "Nike", "41", "Blue", 7499.0),
    InvoiceItem("SKU007", "Classic Leather", "Reebok", "42", "White", 5999.0),
    InvoiceItem("SKU008", "Gazelle", "Adidas", "43", "Navy", 4599.0)
)

// Global state
val currentScreen = mutableStateOf(Screen.Invoice)
val recentInvoices = mutableStateListOf<Invoice>()
val currentInvoiceItems = mutableStateListOf<InvoiceItem>()

fun main() = application {
    Window(onCloseRequest = ::exitApplication, title = "Shoe Inventory Management") {
        MaterialTheme {
            SimpleNavbarApp()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SimpleNavbarApp() {
    Scaffold(
        topBar = {
            if (currentScreen.value !in listOf(Screen.AddItem, Screen.QRScanner, Screen.CreateInvoice)) {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Inventory2,
                                contentDescription = "App Logo",
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Shoe Inventory",
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                        }
                    },
                    actions = {
                        IconButton(onClick = { println("Notifications Clicked") }) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications"
                            )
                        }
                        IconButton(onClick = { println("Settings Clicked") }) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "Settings"
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            }
        },
        bottomBar = {
            if (currentScreen.value !in listOf(Screen.AddItem, Screen.QRScanner, Screen.CreateInvoice)) {
                BottomAppBar {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(6.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = { currentScreen.value = Screen.Invoice }) {
                            Icon(imageVector = Icons.Filled.RequestQuote, contentDescription = "Invoice")
                        }
                        IconButton(onClick = { currentScreen.value = Screen.Inventory }) {
                            Icon(imageVector = Icons.Filled.Inventory2, contentDescription = "Inventory")
                        }
                        IconButton(onClick = { currentScreen.value = Screen.Accounting }) {
                            Icon(imageVector = Icons.Filled.AttachMoney, contentDescription = "Accounting")
                        }
                    }
                }
            }
        },
    ) { paddingValue ->
        Box(modifier = Modifier.padding(paddingValue)) {
            when (currentScreen.value) {
                Screen.Invoice -> InvoiceScreen()
                Screen.Inventory -> InventoryScreen()
                Screen.Accounting -> AccountingScreen()
                Screen.AddItem -> AddItemScreen()
                Screen.QRScanner -> QRScannerScreen()
                Screen.CreateInvoice -> CreateInvoiceScreen()
            }
        }
    }
}

@Composable
fun InvoiceScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Quick Actions
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clickable { 
                        currentInvoiceItems.clear() // Clear previous items
                        currentScreen.value = Screen.QRScanner 
                    },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.QrCodeScanner,
                        contentDescription = "QR Scanner",
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Scan Items",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clickable { 
                        currentInvoiceItems.clear() // Clear previous items
                        currentScreen.value = Screen.CreateInvoice 
                    },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "Create Invoice",
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Manual Entry",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Recent Invoices Section
        Text(
            "Recent Invoices",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(16.dp))

        if (recentInvoices.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Receipt,
                        contentDescription = "No Invoices",
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "No invoices yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "Start by scanning items or creating a manual invoice",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(recentInvoices.reversed()) { invoice ->
                    InvoiceCard(invoice)
                }
            }
        }
    }
}

@Composable
fun InvoiceCard(invoice: Invoice) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        "Invoice #${invoice.id}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (invoice.customerName.isNotEmpty()) {
                        Text(
                            invoice.customerName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        invoice.date.format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "₹${String.format("%.2f", invoice.total)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            when (invoice.paymentMethod) {
                                PaymentMethod.UPI -> Icons.Default.AccountBalance
                                PaymentMethod.CASH -> Icons.Default.Payments
                                PaymentMethod.CARD -> Icons.Default.CreditCard
                            },
                            contentDescription = "Payment Method",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            invoice.paymentMethod.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Text(
                "${invoice.items.sumOf { it.quantity }} item(s)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            // Show first few items
            invoice.items.take(2).forEach { item ->
                Text(
                    "• ${item.name} (${item.brand}) - Size ${item.size} x${item.quantity}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            if (invoice.items.size > 2) {
                Text(
                    "... and ${invoice.items.size - 2} more",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QRScannerScreen() {
    var manualSKU by remember { mutableStateOf("") }
    var isScanning by remember { mutableStateOf(false) }
    var showManualEntry by remember { mutableStateOf(false) }
    var scanStatus by remember { mutableStateOf("Ready to scan") }

    // Handle scanning simulation with LaunchedEffect
    if (isScanning) {
        LaunchedEffect(isScanning) {
            scanStatus = "Scanning..."
            delay(1500) // Simulate scanning time
            
            // Mock scan result - randomly pick from inventory
            val randomItem = mockInventory.random()
            
            // Check if item already exists in current invoice
            val existingItemIndex = currentInvoiceItems.indexOfFirst { it.sku == randomItem.sku }
            
            if (existingItemIndex >= 0) {
                // Update quantity if item already exists
                val existingItem = currentInvoiceItems[existingItemIndex]
                currentInvoiceItems[existingItemIndex] = existingItem.copy(quantity = existingItem.quantity + 1)
                scanStatus = "Added +1 ${randomItem.name} (Total: ${existingItem.quantity + 1})"
            } else {
                // Add new item
                currentInvoiceItems.add(randomItem)
                scanStatus = "Added ${randomItem.name}"
            }
            
            isScanning = false
            delay(2000)
            scanStatus = "Ready to scan"
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("QR Code Scanner")
                        Text(
                            "${currentInvoiceItems.sumOf { it.quantity }} items scanned",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { 
                        currentInvoiceItems.clear()
                        currentScreen.value = Screen.Invoice 
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (currentInvoiceItems.isNotEmpty()) {
                        TextButton(
                            onClick = { currentScreen.value = Screen.CreateInvoice }
                        ) {
                            Text("Proceed (${currentInvoiceItems.size})")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Camera Preview Area (Mock)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(250.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    if (isScanning) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(48.dp),
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "Scanning for QR code...",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.QrCode,
                                contentDescription = "QR Code",
                                modifier = Modifier.size(80.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "Point camera at QR code",
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                scanStatus,
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (scanStatus.startsWith("Added")) 
                                    MaterialTheme.colorScheme.primary 
                                else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Scan Button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = { isScanning = true },
                    modifier = Modifier
                        .weight(1f)
                        .height(56.dp),
                    enabled = !isScanning
                ) {
                    if (isScanning) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Scan Item")
                        }
                    }
                }
                
                if (currentInvoiceItems.isNotEmpty()) {
                    OutlinedButton(
                        onClick = { currentScreen.value = Screen.CreateInvoice },
                        modifier = Modifier.height(56.dp)
                    ) {
                        Text("Checkout")
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Manual Entry Option
            OutlinedButton(
                onClick = { showManualEntry = !showManualEntry },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (showManualEntry) "Hide Manual Entry" else "Enter SKU Manually")
            }

            if (showManualEntry) {
                Spacer(modifier = Modifier.height(16.dp))
                
                OutlinedTextField(
                    value = manualSKU,
                    onValueChange = { manualSKU = it },
                    label = { Text("SKU Code") },
                    modifier = Modifier.fillMaxWidth(),
                    trailingIcon = {
                        IconButton(
                            onClick = {
                                if (manualSKU.isNotEmpty()) {
                                    val foundItem = mockInventory.find { it.sku == manualSKU }
                                    if (foundItem != null) {
                                        val existingItemIndex = currentInvoiceItems.indexOfFirst { it.sku == foundItem.sku }
                                        if (existingItemIndex >= 0) {
                                            val existingItem = currentInvoiceItems[existingItemIndex]
                                            currentInvoiceItems[existingItemIndex] = existingItem.copy(quantity = existingItem.quantity + 1)
                                        } else {
                                            currentInvoiceItems.add(foundItem)
                                        }
                                        manualSKU = ""
                                    }
                                }
                            }
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add")
                        }
                    }
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Quick SKU buttons for demo
                Text(
                    "Quick Select:",
                    style = MaterialTheme.typography.labelMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            
            // Current Invoice Items
            if (currentInvoiceItems.isNotEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Scanned Items",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            TextButton(
                                onClick = { currentInvoiceItems.clear() }
                            ) {
                                Text("Clear All")
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        currentInvoiceItems.forEach { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "${item.name} - ${item.brand}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        "Size ${item.size} | ${item.color}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        "₹${item.price} x${item.quantity}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    IconButton(
                                        onClick = { 
                                            currentInvoiceItems.remove(item)
                                        },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Remove,
                                            contentDescription = "Remove",
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Total Items: ${currentInvoiceItems.sumOf { it.quantity }}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                "₹${String.format("%.2f", currentInvoiceItems.sumOf { it.price * it.quantity })}",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
            
            // Quick select items when manual entry is shown
            if (showManualEntry) {
                // Filter out items that are already in the current invoice
                val availableItems = mockInventory.filter { inventoryItem ->
                    currentInvoiceItems.none { selectedItem -> selectedItem.sku == inventoryItem.sku }
                }
                
                if (availableItems.isNotEmpty()) {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        items(availableItems) { item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        currentInvoiceItems.add(item)
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(
                                            "${item.name} - ${item.brand}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Text(
                                            "SKU: ${item.sku} | Size: ${item.size} | Color: ${item.color}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            "₹${item.price}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Icon(
                                            Icons.Default.Add,
                                            contentDescription = "Add Item",
                                            modifier = Modifier.size(20.dp),
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Show message when all items are selected
                    Card(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = "All Items Added",
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "All available items added",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Medium,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                "Remove items from your cart to add different ones",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateInvoiceScreen() {
    var customerName by remember { mutableStateOf("") }
    var selectedPaymentMethod by remember { mutableStateOf(PaymentMethod.CASH) }
    var showPaymentDropdown by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf(false) }

    val totalAmount = currentInvoiceItems.sumOf { it.price * it.quantity }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Invoice") },
                navigationIcon = {
                    IconButton(onClick = { currentScreen.value = Screen.QRScanner }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Customer Information
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        "Customer Information",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = customerName,
                        onValueChange = { customerName = it },
                        label = { Text("Customer Name (Optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Items Section
            Card(
                modifier = Modifier.weight(1f)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Items",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        TextButton(
                            onClick = { currentScreen.value = Screen.QRScanner }
                        ) {
                            Text("Add More")
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(currentInvoiceItems) { item ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            "${item.name} - ${item.brand}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Text(
                                            "Size: ${item.size} | Color: ${item.color}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            "SKU: ${item.sku}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            "₹${item.price}",
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            "Qty: ${item.quantity}",
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                        Text(
                                            "₹${String.format("%.2f", item.price * item.quantity)}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Payment Method & Total
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        "Payment Details",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Payment Method Selection
                    ExposedDropdownMenuBox(
                        expanded = showPaymentDropdown,
                        onExpandedChange = { showPaymentDropdown = !showPaymentDropdown }
                    ) {
                        OutlinedTextField(
                            value = when(selectedPaymentMethod) {
                                PaymentMethod.UPI -> "UPI Payment"
                                PaymentMethod.CASH -> "Cash Payment"
                                PaymentMethod.CARD -> "Card Payment"
                            },
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showPaymentDropdown) },
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                            label = { Text("Payment Method") }
                        )
                        ExposedDropdownMenu(
                            expanded = showPaymentDropdown,
                            onDismissRequest = { showPaymentDropdown = false }
                        ) {
                            PaymentMethod.values().forEach { method ->
                                DropdownMenuItem(
                                    text = { 
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                when(method) {
                                                    PaymentMethod.UPI -> Icons.Default.AccountBalance
                                                    PaymentMethod.CASH -> Icons.Default.Payments
                                                    PaymentMethod.CARD -> Icons.Default.CreditCard
                                                },
                                                contentDescription = method.name,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                when(method) {
                                                    PaymentMethod.UPI -> "UPI Payment"
                                                    PaymentMethod.CASH -> "Cash Payment"
                                                    PaymentMethod.CARD -> "Card Payment"
                                                }
                                            )
                                        }
                                    },
                                    onClick = {
                                        selectedPaymentMethod = method
                                        showPaymentDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Total Amount
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Total Amount:",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "₹${String.format("%.2f", totalAmount)}",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Generate Invoice Button
            Button(
                onClick = {
                    val newInvoice = Invoice(
                        id = "INV${System.currentTimeMillis()}",
                        items = currentInvoiceItems.toList(),
                        total = totalAmount,
                        paymentMethod = selectedPaymentMethod,
                        customerName = customerName
                    )
                    recentInvoices.add(newInvoice)
                    showSuccessDialog = true
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = currentInvoiceItems.isNotEmpty()
            ) {
                Icon(Icons.Default.Receipt, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Generate Invoice")
            }
        }

        if (showSuccessDialog) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.4f)),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    modifier = Modifier.size(120.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = "Success",
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(48.dp)
                        )
                    }
                }
            }
            LaunchedEffect(showSuccessDialog) {
                delay(1500)
                showSuccessDialog = false
                currentInvoiceItems.clear()
                currentScreen.value = Screen.Invoice
            }
        }
    }
}

@Composable
fun InventoryScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Inventory Header
        Text(
            "Shoe Inventory",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(16.dp))

        // Inventory List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(mockInventory) { item ->
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "${item.name} - ${item.brand}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Size: ${item.size} | Color: ${item.color}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                "SKU: ${item.sku}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "₹${item.price}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                "In Stock",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.tertiary
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Add Item Button
        Button(
            onClick = { currentScreen.value = Screen.AddItem },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add New Item")
        }
    }
}

@Composable
fun AccountingScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            "Accounting Overview",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(24.dp))

        // Sales Summary Cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.TrendingUp,
                        contentDescription = "Total Sales",
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "₹${String.format("%.2f", recentInvoices.sumOf { it.total })}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        "Total Sales",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Receipt,
                        contentDescription = "Total Invoices",
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "${recentInvoices.size}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        "Invoices",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        if (recentInvoices.isNotEmpty()) {
            Text(
                "Payment Methods",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(16.dp))

            PaymentMethod.values().forEach { method ->
                val methodInvoices = recentInvoices.filter { it.paymentMethod == method }
                val methodTotal = methodInvoices.sumOf { it.total }
                
                if (methodInvoices.isNotEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    when (method) {
                                        PaymentMethod.UPI -> Icons.Default.AccountBalance
                                        PaymentMethod.CASH -> Icons.Default.Payments
                                        PaymentMethod.CARD -> Icons.Default.CreditCard
                                    },
                                    contentDescription = method.name,
                                    modifier = Modifier.size(24.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        method.name,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        "${methodInvoices.size} transactions",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Text(
                                "₹${String.format("%.2f", methodTotal)}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
        } else {
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Analytics,
                        contentDescription = "No Data",
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "No sales data yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "Start selling to see your accounting overview",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddItemScreen() {
    var showPopup by remember { mutableStateOf(false) }

    // Product Details
    var productName by remember { mutableStateOf("") }
    var productBrand by remember { mutableStateOf("") }
    var productCategory by remember { mutableStateOf("") }
    var productGender by remember { mutableStateOf("") }
    var productSize by remember { mutableStateOf("") }
    var productColor by remember { mutableStateOf("") }

    // Stock Information
    var quantity by remember { mutableStateOf("") }
    var minStock by remember { mutableStateOf("") }

    // Pricing
    var purchasePrice by remember { mutableStateOf("") }
    var sellingPrice by remember { mutableStateOf("") }
    var discount by remember { mutableStateOf("") }

    // SKU & Identification
    var sku by remember { mutableStateOf("") }
    var qrCode by remember { mutableStateOf("") }

    // Supplier Information
    var supplierName by remember { mutableStateOf("") }
    var supplierContact by remember { mutableStateOf("") }

    // Additional
    var description by remember { mutableStateOf("") }
    var storageLocation by remember { mutableStateOf("") }
    var productImage by remember { mutableStateOf<ImageBitmap?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add Shoe Item") },
                navigationIcon = {
                    IconButton(onClick = { currentScreen.value = Screen.Inventory }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        bottomBar = {
            Row(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { currentScreen.value = Screen.Inventory },
                    modifier = Modifier.weight(1f).height(56.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Cancel")
                }
                Button(
                    onClick = { showPopup = true },
                    modifier = Modifier.weight(1f).height(56.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Save")
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Product Details
            item {
                SectionCard("Product Details") {
                    OutlinedTextField(productName, { productName = it }, label = { Text("Product Name") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(productBrand, { productBrand = it }, label = { Text("Brand") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(productCategory, { productCategory = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(productGender, { productGender = it }, label = { Text("Gender") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(productSize, { productSize = it }, label = { Text("Size(s)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(productColor, { productColor = it }, label = { Text("Color") }, modifier = Modifier.fillMaxWidth())
                }
            }
            // Stock
            item {
                SectionCard("Stock Information") {
                    OutlinedTextField(quantity, { quantity = it }, label = { Text("Quantity in Stock") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(minStock, { minStock = it }, label = { Text("Minimum Stock Level") }, modifier = Modifier.fillMaxWidth())
                }
            }
            // Pricing
            item {
                SectionCard("Pricing") {
                    OutlinedTextField(purchasePrice, { purchasePrice = it }, label = { Text("Purchase Price") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(sellingPrice, { sellingPrice = it }, label = { Text("Selling Price") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(discount, { discount = it }, label = { Text("Discount (Optional)") }, modifier = Modifier.fillMaxWidth())
                }
            }
            // SKU
            item {
                SectionCard("SKU & Identification") {
                    OutlinedTextField(sku, { sku = it }, label = { Text("SKU Code") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(qrCode, { qrCode = it }, label = { Text("QR Code / Barcode") }, modifier = Modifier.fillMaxWidth())
                }
            }
            // Supplier
            item {
                SectionCard("Supplier Information") {
                    OutlinedTextField(supplierName, { supplierName = it }, label = { Text("Supplier Name") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(supplierContact, { supplierContact = it }, label = { Text("Supplier Contact") }, modifier = Modifier.fillMaxWidth())
                }
            }
            // Additional
            item {
                SectionCard("Additional Information") {
                    OutlinedTextField(description, { description = it }, label = { Text("Description / Notes") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(storageLocation, { storageLocation = it }, label = { Text("Storage Location / Shelf") }, modifier = Modifier.fillMaxWidth())

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Image Preview / Placeholder
                        Box(
                            modifier = Modifier
                                .size(120.dp)
                                .background(
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    shape = RoundedCornerShape(8.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (productImage != null) {
                                Image(
                                    bitmap = productImage!!,
                                    contentDescription = "Product Image",
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Image,
                                    contentDescription = "Placeholder",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(48.dp)
                                )
                            }
                        }

                        // Add / Remove Button
                        if (productImage == null) {
                            Button(
                                onClick = {
                                    val fileChooser = JFileChooser()
                                    val result = fileChooser.showOpenDialog(null)
                                    if (result == JFileChooser.APPROVE_OPTION) {
                                        val file = fileChooser.selectedFile
                                        try {
                                            val bufferedImage = ImageIO.read(file)
                                            if (bufferedImage != null) {
                                                productImage = bufferedImage.toComposeImageBitmap()
                                            } else {
                                                println("Unsupported image format: ${file.extension}")
                                            }
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                            println("Error loading image: ${e.message}")
                                        }
                                    }
                                },
                                modifier = Modifier.height(50.dp)
                            ) {
                                Text("Add Image")
                            }
                        } else {
                            Button(
                                onClick = { productImage = null },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.error,
                                    contentColor = MaterialTheme.colorScheme.onError
                                ),
                                modifier = Modifier.height(50.dp)
                            ) {
                                Text("Remove Image")
                            }
                        }
                    }
                }
            }
        }

        if (showPopup) {
            Box(
                modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.4f)),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    modifier = Modifier.size(120.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Check, contentDescription = "Saved", tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(48.dp))
                    }
                }
            }
            LaunchedEffect(showPopup) {
                delay(1500)
                showPopup = false
                currentScreen.value = Screen.Inventory
            }
        }
    }
}

@Composable
fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}
