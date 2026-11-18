package com.pikomath.app.data.remote

import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import retrofit2.http.Body
import retrofit2.http.POST

data class SolveRequestDto(
    val problem: String,
    val curriculum: String,
    val gradeLevel: String,
    val notation: String,
    val language: String = "en"
)

data class StepDto(
    val stepNumber: Int,
    val expressionLatex: String,
    val expressionPlain: String,
    val why: String
)

data class SolveResponseDto(
    val id: String,
    val normalizedProblem: String,
    val problemLatex: String,
    val topic: String,
    val difficulty: String,
    val pikoGreeting: String,
    val steps: List<StepDto>,
    val finalAnswerLatex: String,
    val finalAnswerPlain: String,
    val confidence: Double,
    val verificationStatus: String,
    val verificationMessage: String,
    val cached: Boolean,
    val remainingQuota: Int
)

interface PikoApiService {
    @POST("api/solve")
    suspend fun solve(@Body body: SolveRequestDto): SolveResponseDto
}

object ImageCompressor {
    /**
     * Compresses snapped problem photos to <= 1280px and JPEG quality 75
     * to minimize mobile data usage on low-bandwidth networks.
     */
    fun compressBitmap(source: Bitmap, maxDimension: Int = 1280, quality: Int = 75): ByteArray {
        val ratio = minOf(
            maxDimension.toFloat() / source.width.toFloat(),
            maxDimension.toFloat() / source.height.toFloat(),
            1.0f
        )
        val scaled = if (ratio < 1.0f) {
            Bitmap.createScaledBitmap(
                source,
                (source.width * ratio).toInt().coerceAtLeast(1),
                (source.height * ratio).toInt().coerceAtLeast(1),
                true
            )
        } else {
            source
        }
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        return out.toByteArray()
    }
}
