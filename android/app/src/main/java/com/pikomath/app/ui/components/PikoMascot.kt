package com.pikomath.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

enum class PikoMood { IDLE, THINKING, CHEERING, ENCOURAGING, OFFLINE }

/**
 * Lightweight vector Piko (π) mascot (< 5 KB compiled).
 * Expressive eyes react to loading, success, and mistake states.
 */
@Composable
fun PikoMascot(
    mood: PikoMood,
    modifier: Modifier = Modifier,
    size: Dp = 64.dp
) {
    val primary = MaterialTheme.colorScheme.primary
    val accent = MaterialTheme.colorScheme.secondary
    val infinite = rememberInfiniteTransition(label = "piko_bob")
    val bobOffset by infinite.animateFloat(
        initialValue = -2f,
        targetValue = 2f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = if (mood == PikoMood.THINKING) 500 else 1400),
            repeatMode = RepeatMode.Reverse
        ),
        label = "bob"
    )

    val desc = when (mood) {
        PikoMood.IDLE -> "Piko is ready"
        PikoMood.THINKING -> "Piko is thinking"
        PikoMood.CHEERING -> "Piko is cheering"
        PikoMood.ENCOURAGING -> "Piko is encouraging you"
        PikoMood.OFFLINE -> "Piko is in offline mode"
    }

    Canvas(
        modifier = modifier
            .size(size)
            .semantics { contentDescription = desc }
    ) {
        val w = this.size.width
        val h = this.size.height
        val dy = if (mood == PikoMood.OFFLINE) 0f else bobOffset * (h / 64f)

        // Friendly π top bar (hat/brow)
        drawRoundRect(
            color = primary,
            topLeft = Offset(w * 0.14f, h * 0.22f + dy),
            size = Size(w * 0.72f, h * 0.16f),
            cornerRadius = CornerRadius(w * 0.08f, w * 0.08f)
        )

        // Left & right π legs
        val leftLeg = Path().apply {
            moveTo(w * 0.34f, h * 0.36f + dy)
            quadraticTo(w * 0.32f, h * 0.68f + dy, w * 0.24f, h * 0.84f + dy)
        }
        val rightLeg = Path().apply {
            moveTo(w * 0.64f, h * 0.36f + dy)
            quadraticTo(w * 0.64f, h * 0.72f + dy, w * 0.76f, h * 0.82f + dy)
        }
        drawPath(leftLeg, color = primary, style = Stroke(width = w * 0.14f, cap = StrokeCap.Round))
        drawPath(rightLeg, color = primary, style = Stroke(width = w * 0.14f, cap = StrokeCap.Round))

        // Expressive eyes on the π crossbar
        val eyeY = h * 0.30f + dy
        val leftEyeX = w * 0.38f
        val rightEyeX = w * 0.62f

        drawCircle(Color.White, radius = w * 0.065f, center = Offset(leftEyeX, eyeY))
        drawCircle(Color.White, radius = w * 0.065f, center = Offset(rightEyeX, eyeY))

        val pupilShiftX = if (mood == PikoMood.THINKING) w * 0.02f else 0f
        val pupilColor = if (mood == PikoMood.CHEERING) accent else Color(0xFF0F172A)
        drawCircle(pupilColor, radius = w * 0.032f, center = Offset(leftEyeX + pupilShiftX, eyeY))
        drawCircle(pupilColor, radius = w * 0.032f, center = Offset(rightEyeX + pupilShiftX, eyeY))
    }
}
