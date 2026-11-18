package com.pikomath.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.pikomath.app.ui.solve.SolveScreen
import com.pikomath.app.ui.solve.SolveViewModel
import com.pikomath.app.ui.theme.PikoMathTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PikoMathTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val viewModel: SolveViewModel = hiltViewModel()
                    SolveScreen(viewModel = viewModel)
                }
            }
        }
    }
}
