package com.heatshield.ai

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.heatshield.ai.ble.BleHeatShieldManager
import com.heatshield.ai.ble.BleStatus
import com.heatshield.ai.util.SosSmsHelper

private val NavyPrimary = Color(0xFF0B1F3A)
private val TealAccent = Color(0xFF0D9488)
private val OrangeWarning = Color(0xFFEA580C)
private val RedSos = Color(0xFFDC2626)

class MainActivity : ComponentActivity() {
    private lateinit var bleManager: BleHeatShieldManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bleManager = BleHeatShieldManager(applicationContext)

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = NavyPrimary,
                    secondary = TealAccent,
                    tertiary = OrangeWarning
                )
            ) {
                HeatShieldMobileApp(bleManager = bleManager)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        bleManager.disconnect()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeatShieldMobileApp(bleManager: BleHeatShieldManager) {
    val context = LocalContext.current
    val bleStatus by bleManager.status.collectAsState()
    val bleError by bleManager.error.collectAsState()
    val telemetry by bleManager.telemetry.collectAsState()

    var workerName by remember { mutableStateOf("Field Worker") }
    var siteLocation by remember { mutableStateOf("Sector B — Construction Zone") }
    var emergencyPhone by remember { mutableStateOf("") }
    var showSosDialog by remember { mutableStateOf(false) }
    var warningThresholdC by remember { mutableFloatStateOf(32f) }

    var gpsLocation by remember { mutableStateOf<Location?>(null) }
    var gpsStatus by remember { mutableStateOf("GPS Idle — tap Enable Live GPS") }

    val startNativeGps: () -> Unit = remember(context) {
        {
            val hasFine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (hasFine || hasCoarse) {
                val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                @SuppressLint("MissingPermission")
                val lastKnown = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (lastKnown != null) {
                    gpsLocation = lastKnown
                    gpsStatus = "Live GPS Active (±${lastKnown.accuracy.toInt()}m)"
                } else {
                    gpsStatus = "Acquiring GPS satellite fix..."
                }

                val listener = object : LocationListener {
                    override fun onLocationChanged(location: Location) {
                        gpsLocation = location
                        gpsStatus = "Live GPS Active (±${location.accuracy.toInt()}m)"
                    }
                }
                @SuppressLint("MissingPermission")
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4000L, 2f, listener)
                }
                @SuppressLint("MissingPermission")
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 6000L, 5f, listener)
                }
            }
        }
    }

    val blePermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        if (granted.values.all { it }) {
            bleManager.startScanAndConnect()
        }
    }

    val gpsPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        if (granted.values.any { it }) {
            startNativeGps()
        } else {
            gpsStatus = "Location permission denied"
        }
    }

    val requestBleConnect = {
        val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        blePermissionLauncher.launch(perms)
    }

    val requestGpsEnable = {
        gpsPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("HEATSHIELD AI", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = NavyPrimary,
                    titleContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF8FAFC))
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // BLE Status Card
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("ESP32-WROOM-DA BLE Status: ${bleStatus.name}", fontWeight = FontWeight.SemiBold)
                    Text(
                        text = if (telemetry?.isLiveHardware == true) "Receiving Live Hardware Data" else "No Live Hardware Connected",
                        fontSize = 12.sp,
                        color = if (telemetry?.isLiveHardware == true) TealAccent else Color(0xFF64748B)
                    )
                    bleError?.let {
                        Text(it, color = RedSos, fontSize = 12.sp)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                if (bleStatus == BleStatus.CONNECTED) bleManager.disconnect()
                                else requestBleConnect()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = TealAccent)
                        ) {
                            Text(if (bleStatus == BleStatus.CONNECTED) "Disconnect" else "Pair ESP32")
                        }
                    }
                }
            }

            // Live GPS Card
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Worker GPS Location", fontWeight = FontWeight.SemiBold)
                    Text(gpsStatus, fontSize = 12.sp, color = Color(0xFF475569))
                    gpsLocation?.let { loc ->
                        Text(
                            text = "${String.format("%.6f", loc.latitude)}, ${String.format("%.6f", loc.longitude)}",
                            fontWeight = FontWeight.Bold,
                            color = NavyPrimary
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = requestGpsEnable,
                            colors = ButtonDefaults.buttonColors(containerColor = NavyPrimary)
                        ) {
                            Text("Enable Live GPS")
                        }
                        gpsLocation?.let { loc ->
                            OutlinedButton(
                                onClick = {
                                    val geoUri = Uri.parse(
                                        "geo:${loc.latitude},${loc.longitude}?q=${loc.latitude},${loc.longitude}(${Uri.encode(workerName)})"
                                    )
                                    val mapIntent = Intent(Intent.ACTION_VIEW, geoUri)
                                    context.startActivity(mapIntent)
                                }
                            ) {
                                Text("Open Map")
                            }
                        }
                    }
                }
            }

            // Telemetry Metrics
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Environmental & Motion Telemetry", fontWeight = FontWeight.SemiBold)
                    Text("Temperature: ${telemetry?.temperature?.let { "$it °C" } ?: "--.- °C"}")
                    Text("Humidity: ${telemetry?.humidity?.let { "$it %" } ?: "--.- %"}")
                    Text(
                        text = "Heat Index: ${telemetry?.heatIndex?.let { "$it °C" } ?: "--.- °C"}",
                        fontWeight = FontWeight.Bold,
                        color = if ((telemetry?.heatIndex ?: 0.0) >= warningThresholdC) OrangeWarning else NavyPrimary
                    )
                    Text("Activity (MPU6050): ${telemetry?.activityLabel ?: "No Signal"}")
                    Text(
                        text = "Heat Index is an environmental estimate, not core body temperature or WBGT.",
                        fontSize = 11.sp,
                        color = Color(0xFF475569)
                    )
                }
            }

            // Worker & Emergency Contact Configuration
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Worker & Emergency Contact", fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = workerName,
                        onValueChange = { workerName = it },
                        label = { Text("Worker Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = emergencyPhone,
                        onValueChange = { emergencyPhone = it },
                        label = { Text("Emergency Contact Phone") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // Large SOS Button
            Button(
                onClick = { showSosDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(84.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RedSos)
            ) {
                Text("SOS EMERGENCY SMS", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    }

    if (showSosDialog) {
        AlertDialog(
            onDismissRequest = { showSosDialog = false },
            title = { Text("Open SMS Composer?") },
            text = {
                Text(
                    "This opens your phone's SMS app pre-filled with $workerName's alert and current GPS coordinates (if active). " +
                        "No message is sent automatically until you press Send in the SMS app."
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSosDialog = false
                        SosSmsHelper.openSmsComposer(
                            context = context,
                            phoneNumber = emergencyPhone,
                            workerName = workerName,
                            siteLocation = siteLocation,
                            customMessage = "Requesting immediate heat-safety assistance.",
                            latestTelemetry = telemetry,
                            latitude = gpsLocation?.latitude,
                            longitude = gpsLocation?.longitude,
                            accuracyMeters = gpsLocation?.accuracy
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RedSos)
                ) {
                    Text("Open SMS App")
                }
            },
            dismissButton = {
                TextButton(onClick = { showSosDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
