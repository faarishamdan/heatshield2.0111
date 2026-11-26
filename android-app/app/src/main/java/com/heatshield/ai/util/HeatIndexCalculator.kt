package com.heatshield.ai.util

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

data class SensorTelemetry(
    val temperature: Double,
    val humidity: Double,
    val heatIndex: Double,
    val ax: Double,
    val ay: Double,
    val az: Double,
    val motionMagnitude: Double,
    val activityLabel: String,
    val anomalyFlagged: Boolean,
    val timestampIso: String,
    val isLiveHardware: Boolean
)

object HeatIndexCalculator {
    /**
     * Environmental Heat Index estimate in Celsius (NOAA Rothfusz regression).
     * Note: NOT core body temperature and NOT Wet-Bulb Globe Temperature (WBGT).
     */
    fun computeHeatIndexC(tempC: Double, humidityPct: Double): Double {
        val tF = tempC * 9.0 / 5.0 + 32.0
        val rh = min(100.0, max(0.0, humidityPct))
        var hiF = 0.5 * (tF + 61.0 + ((tF - 68.0) * 1.2) + (rh * 0.094))

        if (hiF >= 80.0) {
            hiF = -42.379 + 2.04901523 * tF + 10.14333127 * rh -
                0.22475541 * tF * rh - 0.00683783 * tF * tF -
                0.05481717 * rh * rh + 0.00122874 * tF * tF * rh +
                0.00085282 * tF * rh * rh - 0.00000199 * tF * tF * rh * rh

            if (rh < 13.0 && tF in 80.0..112.0) {
                hiF -= ((13.0 - rh) / 4.0) * sqrt((17.0 - abs(tF - 95.0)) / 17.0)
            } else if (rh > 85.0 && tF in 80.0..87.0) {
                hiF += ((rh - 85.0) / 10.0) * ((87.0 - tF) / 5.0)
            }
        }

        val hiC = (hiF - 32.0) * 5.0 / 9.0
        return (hiC * 10.0).roundToInt() / 10.0
    }

    fun analyzeMotion(ax: Double, ay: Double, az: Double): Triple<Double, String, Boolean> {
        val mag = sqrt(ax * ax + ay * ay + az * az)
        val roundedMag = (mag * 100.0).roundToInt() / 100.0
        val delta = abs(mag - 1.0)

        return when {
            mag >= 2.4 || mag <= 0.25 -> Triple(roundedMag, "Motion Spike (Review)", true)
            delta >= 0.35 -> Triple(roundedMag, "Active Labor", false)
            delta >= 0.08 -> Triple(roundedMag, "Light Movement", false)
            else -> Triple(roundedMag, "Stationary", false)
        }
    }
}
