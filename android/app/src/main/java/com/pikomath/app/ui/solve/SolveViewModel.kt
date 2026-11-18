package com.pikomath.app.ui.solve

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.pikomath.app.data.local.CachedSolutionEntity
import com.pikomath.app.data.local.PikoDao
import com.pikomath.app.data.remote.PikoApiService
import com.pikomath.app.data.remote.SolveRequestDto
import com.pikomath.app.data.remote.SolveResponseDto
import com.pikomath.app.ui.components.PikoMood
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class InputMode { SNAP, TYPE, DRAW }

data class SolveUiState(
    val inputMode: InputMode = InputMode.TYPE,
    val problemText: String = "",
    val curriculum: String = "US_COMMON_CORE",
    val gradeLevel: String = "Grade 8",
    val notation: String = "point_obelus",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val solution: SolveResponseDto? = null,
    val pikoMood: PikoMood = PikoMood.IDLE
)

@HiltViewModel
class SolveViewModel @Inject constructor(
    private val api: PikoApiService,
    private val dao: PikoDao
) : ViewModel() {

    private val gson = Gson()
    private val _uiState = MutableStateFlow(SolveUiState())
    val uiState: StateFlow<SolveUiState> = _uiState.asStateFlow()

    fun setInputMode(mode: InputMode) {
        _uiState.update { it.copy(inputMode = mode, errorMessage = null) }
    }

    fun updateProblemText(text: String) {
        _uiState.update { it.copy(problemText = text, errorMessage = null) }
    }

    fun appendSymbol(symbol: String) {
        _uiState.update { it.copy(problemText = it.problemText + symbol, errorMessage = null) }
    }

    fun onOcrRecognized(recognizedMath: String) {
        _uiState.update {
            it.copy(
                problemText = recognizedMath.trim(),
                inputMode = InputMode.TYPE,
                pikoMood = PikoMood.IDLE
            )
        }
    }

    fun solve() {
        val current = _uiState.value
        val trimmed = current.problemText.trim()
        if (trimmed.isEmpty()) {
            _uiState.update {
                it.copy(
                    errorMessage = "Please snap, draw, or type a math problem first.",
                    pikoMood = PikoMood.ENCOURAGING
                )
            }
            return
        }

        val cacheKey = "${current.curriculum}::${current.notation}::${trimmed.lowercase()}"
        viewModelScope.launch {
            _uiState.update {
                it.copy(isLoading = true, errorMessage = null, pikoMood = PikoMood.THINKING)
            }
            try {
                val cached = dao.getCachedSolution(cacheKey)
                if (cached != null && cached.verified) {
                    val parsed = gson.fromJson(cached.payloadJson, SolveResponseDto::class.java)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            solution = parsed.copy(cached = true),
                            pikoMood = PikoMood.CHEERING
                        )
                    }
                    return@launch
                }

                val response = api.solve(
                    SolveRequestDto(
                        problem = trimmed,
                        curriculum = current.curriculum,
                        gradeLevel = current.gradeLevel,
                        notation = current.notation
                    )
                )

                if (response.verificationStatus == "verified") {
                    dao.upsertSolution(
                        CachedSolutionEntity(
                            cacheKey = cacheKey,
                            normalizedProblem = response.normalizedProblem,
                            topic = response.topic,
                            payloadJson = gson.toJson(response),
                            verified = true,
                            savedAtEpochMs = System.currentTimeMillis()
                        )
                    )
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        solution = response,
                        pikoMood = if (response.verificationStatus == "verified") {
                            PikoMood.CHEERING
                        } else {
                            PikoMood.ENCOURAGING
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message ?: "Unable to connect. Check your network and try again.",
                        pikoMood = PikoMood.OFFLINE
                    )
                }
            }
        }
    }
}
