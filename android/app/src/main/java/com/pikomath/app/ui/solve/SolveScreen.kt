package com.pikomath.app.ui.solve

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pikomath.app.R
import com.pikomath.app.ui.components.PikoMascot

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SolveScreen(viewModel: SolveViewModel) {
    val state by viewModel.uiState.collectAsState()
    val mathSymbols = listOf("+", "-", "×", "÷", "=", "^2", "√(", "π", "(", ")", "x", "y")

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PikoMascot(mood = state.pikoMood, size = 56.dp)
                Column {
                    Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineSmall)
                    Text(stringResource(R.string.tagline), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = state.inputMode == InputMode.SNAP,
                    onClick = { viewModel.setInputMode(InputMode.SNAP) },
                    label = { Text(stringResource(R.string.tab_snap)) }
                )
                FilterChip(
                    selected = state.inputMode == InputMode.TYPE,
                    onClick = { viewModel.setInputMode(InputMode.TYPE) },
                    label = { Text(stringResource(R.string.tab_type)) }
                )
                FilterChip(
                    selected = state.inputMode == InputMode.DRAW,
                    onClick = { viewModel.setInputMode(InputMode.DRAW) },
                    label = { Text(stringResource(R.string.tab_draw)) }
                )
            }
        }

        item {
            OutlinedTextField(
                value = state.problemText,
                onValueChange = viewModel::updateProblemText,
                label = { Text(stringResource(R.string.problem_input_label)) },
                placeholder = { Text(stringResource(R.string.problem_input_hint)) },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                mathSymbols.forEach { sym ->
                    OutlinedButton(
                        onClick = { viewModel.appendSymbol(sym) },
                        modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    ) {
                        Text(sym)
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = viewModel::solve,
                enabled = !state.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 52.dp)
            ) {
                Text(stringResource(R.string.solve_cta))
            }
        }

        if (state.isLoading) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        CircularProgressIndicator()
                        Text(stringResource(R.string.state_loading_title))
                    }
                }
            }
        } else if (state.errorMessage != null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(stringResource(R.string.state_error_title), fontWeight = FontWeight.Bold)
                        Text(state.errorMessage ?: "")
                        OutlinedButton(onClick = viewModel::solve) {
                            Text(stringResource(R.string.retry_cta))
                        }
                    }
                }
            }
        } else if (state.solution == null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(stringResource(R.string.state_empty_title), fontWeight = FontWeight.Bold)
                        Text(stringResource(R.string.state_empty_body))
                    }
                }
            }
        } else {
            val sol = state.solution!!
            val context = LocalContext.current
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                if (sol.verificationStatus == "verified") {
                                    stringResource(R.string.verified_badge)
                                } else {
                                    stringResource(R.string.unverified_badge)
                                },
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.secondary
                            )
                            Text(sol.pikoGreeting)
                        }
                        IconButton(
                            onClick = {
                                val stepsText = sol.steps.joinToString("\n") {
                                    "Step ${it.stepNumber}: ${it.expressionPlain} — ${it.why}"
                                }
                                val shareBody = buildString {
                                    appendLine("Piko Math: ${sol.normalizedProblem}")
                                    appendLine(stepsText)
                                    append("Final Answer: ${sol.finalAnswerPlain}")
                                }
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, shareBody)
                                }
                                context.startActivity(Intent.createChooser(intent, null))
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Share,
                                contentDescription = stringResource(R.string.share_cta)
                            )
                        }
                    }
                }
            }
            items(sol.steps) { step ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Step ${step.stepNumber}", fontWeight = FontWeight.SemiBold)
                        Text(step.expressionPlain, style = MaterialTheme.typography.titleMedium)
                        Text("${stringResource(R.string.why_label)} ${step.why}")
                    }
                }
            }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.final_answer_label), fontWeight = FontWeight.Bold)
                        Text(sol.finalAnswerPlain, style = MaterialTheme.typography.headlineSmall)
                    }
                }
            }
        }
    }
}
