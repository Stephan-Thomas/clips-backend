# Cloudinary Upload Failure Handling

## Overview

This document describes the implementation of graceful Cloudinary upload failure handling to prevent clip loss when uploads fail.

## Problem

Previously, if Cloudinary upload failed after FFmpeg successfully cut a clip, the clip would be lost because:
1. The local temporary file was deleted regardless of upload success
2. No retry mechanism existed for upload failures
3. Failed uploads would cause the entire job to fail and retry from scratch (including re-cutting with FFmpeg)

## Solution

### 1. Cloudinary Upload Retries

The `CloudinaryService.uploadVideoFromBuffer()` method now includes built-in retry logic:

- **2 automatic retries** (3 total attempts)
- **Exponential backoff**: 1000ms → 2000ms → 5000ms (capped)
- Retries are specific to the upload operation, not the entire job

```typescript
// Example usage
const result = await cloudinaryService.uploadVideoFromBuffer(
  buffer,
  clipId,
  {}, // options
  2   // number of retries
);
```

### 2. Fallback to Local File

When all upload attempts fail:

1. The clip is saved with `status: 'upload_failed'`
2. The local file path is preserved in `clip.localFilePath`
3. The local temporary file is **NOT deleted**
4. An error message is stored in `clip.error`

This allows for:
- Manual intervention and retry
- Serving clips from local storage as a temporary fallback
- Scheduled retry jobs to attempt upload again later

### 3. New Clip Status

Added `upload_failed` status to the Clip entity:

```typescript
status?: 'pending' | 'processing' | 'success' | 'failed' | 'upload_failed'
```

- `failed`: FFmpeg cutting failed
- `upload_failed`: FFmpeg succeeded, but Cloudinary upload failed

### 4. Retry Failed Uploads

The `ClipsService` now includes a method to retry failed uploads:

```typescript
const result = await clipsService.retryFailedUpload(clipId);
```

This method:
- Validates the clip exists and has `upload_failed` status
- Checks that a local file path is available
- Re-enqueues the clip for upload (skips FFmpeg cutting)

## Implementation Details

### Modified Files

1. **clip.entity.ts**
   - Added `upload_failed` status
   - Added `localFilePath` field for fallback storage

2. **cloudinary.service.ts**
   - Refactored `uploadVideoFromBuffer()` to include retry logic
   - Added `performUpload()` private method for single upload attempt
   - Added `delay()` helper for exponential backoff

3. **clip-generation.processor.ts**
   - Modified upload error handling to preserve local file
   - Returns clip with `upload_failed` status instead of throwing
   - Only deletes local file after successful upload

4. **clips.service.ts**
   - Added `retryFailedUpload()` method for manual retry

### Test Coverage

1. **clip-generation.processor.spec.ts**
   - Tests for upload failure handling
   - Verifies local file preservation on failure
   - Verifies local file deletion on success

2. **cloudinary.service.spec.ts** (new)
   - Tests retry logic with various failure scenarios
   - Verifies exponential backoff timing
   - Tests success on different retry attempts

## Usage Examples

### Monitoring Failed Uploads

```typescript
// Get all clips with failed uploads
const failedClips = clipsService.getClipsByStatus('upload_failed');

// Log details
failedClips.forEach(clip => {
  console.log(`Clip ${clip.id} failed: ${clip.error}`);
  console.log(`Local file: ${clip.localFilePath}`);
});
```

### Retry Failed Upload

```typescript
// Retry a specific clip
const result = await clipsService.retryFailedUpload('clip-id-123');

if (result.success) {
  console.log('Retry queued successfully');
} else {
  console.error(`Retry failed: ${result.error}`);
}
```

### Scheduled Retry Job (Future Enhancement)

```typescript
// Example cron job to retry failed uploads
@Cron('0 */6 * * *') // Every 6 hours
async retryFailedUploads() {
  const failedClips = this.clipsService.getClipsByStatus('upload_failed');
  
  for (const clip of failedClips) {
    // Only retry clips that failed within last 24 hours
    const hoursSinceFailure = 
      (Date.now() - clip.updatedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceFailure < 24) {
      await this.clipsService.retryFailedUpload(clip.id);
    }
  }
}
```

## Database Schema Updates

When migrating to Prisma, update the Clip model:

```prisma
model Clip {
  // ... existing fields
  
  status        String?   // Add 'upload_failed' as valid value
  error         String?   // Store error message
  localFilePath String?   // Store local file path for fallback
  
  // ... rest of fields
}
```

## Acceptance Criteria

✅ **Add 2 retries in processor**
- Implemented in `CloudinaryService.uploadVideoFromBuffer()` with configurable retry count

✅ **On final fail: log, update clip status 'upload_failed'**
- Logs error at ERROR level with full context
- Returns clip with `status: 'upload_failed'`
- Stores error message in `clip.error`

✅ **Keep local temp file as fallback**
- Local file is NOT deleted when upload fails
- File path stored in `clip.localFilePath`
- Can be used for manual retry or temporary serving

## Future Enhancements

1. **Scheduled Retry Jobs**: Automatically retry failed uploads periodically
2. **Local File Serving**: Serve clips from local storage when Cloudinary URL unavailable
3. **Upload Queue**: Separate queue for upload retries with different priority
4. **Monitoring Dashboard**: UI to view and manage failed uploads
5. **Cleanup Job**: Remove old local files after successful retry or expiration
