package com.pikomath.app.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "cached_solutions")
data class CachedSolutionEntity(
    @PrimaryKey val cacheKey: String,
    val normalizedProblem: String,
    val topic: String,
    val payloadJson: String,
    val verified: Boolean,
    val savedAtEpochMs: Long
)

@Dao
interface PikoDao {
    @Query("SELECT * FROM cached_solutions WHERE cacheKey = :key LIMIT 1")
    suspend fun getCachedSolution(key: String): CachedSolutionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSolution(entity: CachedSolutionEntity)

    @Query("SELECT * FROM cached_solutions ORDER BY savedAtEpochMs DESC LIMIT 50")
    suspend fun getRecentHistory(): List<CachedSolutionEntity>

    @Query("DELETE FROM cached_solutions")
    suspend fun clearAllUserData()
}

@Database(entities = [CachedSolutionEntity::class], version = 1, exportSchema = false)
abstract class PikoDatabase : RoomDatabase() {
    abstract fun pikoDao(): PikoDao
}
