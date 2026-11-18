package com.pikomath.app.di

import android.content.Context
import androidx.room.Room
import com.pikomath.app.BuildConfig
import com.pikomath.app.data.local.PikoDao
import com.pikomath.app.data.local.PikoDatabase
import com.pikomath.app.data.remote.PikoApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): PikoDatabase =
        Room.databaseBuilder(context, PikoDatabase::class.java, "piko_math.db").build()

    @Provides
    fun providePikoDao(db: PikoDatabase): PikoDao = db.pikoDao()

    @Provides
    @Singleton
    fun provideRetrofit(): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.PIKO_API_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides
    @Singleton
    fun providePikoApi(retrofit: Retrofit): PikoApiService =
        retrofit.create(PikoApiService::class.java)
}
