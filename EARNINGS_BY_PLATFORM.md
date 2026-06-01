# Earnings by Platform Feature

## Overview
This feature provides earnings breakdown by source platform (TikTok, Instagram, YouTube, etc.).

## Endpoint
```
GET /earnings/by-platform
```

### Authentication
Requires JWT authentication via `JwtAuthGuard`.

### Response Format
```json
{
  "data": [
    {
      "platform": "tiktok",
      "totalEarnings": 300.50,
      "count": 15
    },
    {
      "platform": "instagram",
      "totalEarnings": 150.25,
      "count": 8
    },
    {
      "platform": "youtube",
      "totalEarnings": 75.00,
      "count": 5
    }
  ],
  "totalEarnings": 525.75
}
```

### Response Fields
- `data`: Array of platform earnings, sorted by total earnings (descending)
  - `platform`: Platform name (from earning.source field)
  - `totalEarnings`: Sum of all earnings for this platform
  - `count`: Number of earnings records for this platform
- `totalEarnings`: Sum of all earnings across all platforms

### Notes
- Only includes non-deleted earnings (`deletedAt` is null)
- Earnings with null `source` are grouped under "unknown"
- Data is automatically filtered by the authenticated user's ID
- Results are chart-ready and sorted by earnings amount

## Implementation Files
- Controller: `src/earnings/earnings.controller.ts`
- Service: `src/earnings/earnings.service.ts`
- DTO: `src/earnings/dto/earnings-by-platform.dto.ts`
- Tests: `src/earnings/earnings-by-platform.spec.ts`
