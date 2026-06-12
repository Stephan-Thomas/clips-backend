# Database Schema Documentation

## ER Diagram

```
┌─────────────────┐
│      User       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ password        │
│ name            │
│ role            │
│ createdAt       │
│ updatedAt       │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬─────────┬────────┬─────────────┬────────────────┐
    │           │          │         │        │             │                │
    ▼           ▼          ▼         ▼        ▼             ▼                ▼
┌────────┐ ┌──────────┐ ┌──────┐ ┌──────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐
│ Video  │ │UserPlatf│ │Subscrip│ │Wallet│ │Payout│ │PayoutMeth│ │Refresh│
└────────┘ └──────────┘ └──────┘ └──────┘ └─────────┘ └─────────┘ │Token  │
    │                                                  └──────────────┘
    │
    ▼
┌──────────────┐
│   Clip       │
├──────────────┤
│ id (PK)      │
│ videoId (FK) │
│ clipUrl      │
│ platform     │
│ title        │
│ startTime    │
│ endTime      │
│ duration     │
│ nftStatus    │
│ createdAt    │
└──────┬───────┘
       │
   ┌───┴────┬──────────┐
   │         │          │
   ▼         ▼          ▼
┌──────┐ ┌────────┐ ┌─────────┐
│Earning│ │ClipPost│ │NFTRoyalty│
└──────┘ └────────┘ └─────────┘
```

## Schema Overview

### Core Entities

**User** - Core user account entity
- Stores authentication data (email, password/OAuth)
- Wallet integration (Stellar public key, encrypted secret)
- MFA enabled flag
- Relationships: 1 User -> N Videos, Subscriptions, Wallets, Payouts, etc.

**Video** - Source video uploaded/imported by user
- Tracks video source (YouTube, upload, etc.)
- Processing status and statistics
- Relationships: 1 Video -> N Clips

**Clip** - Generated clips from videos
- Inherits videoId to link to source
- Platform-specific metadata (title, caption)
- Viral scoring and timeline data (startTime, endTime)
- NFT metadata (mintAddress, metadataUri, nftStatus)
- Relationships: 1 Clip -> N ClipPost, N Earnings

### Supporting Entities

**ClipPost** - Represents a clip posted to a platform
- Tracks post status (pending, posted, failed)
- Retry attempts and error tracking
- Platform-specific postId

**Earning** - Revenue tracking per clip
- Amount earned from that clip
- Platform attribution
- Payout status

**Wallet** - User's blockchain wallets
- Stellar wallet storage
- Wallet type tracking

**Payout** - Batch payout to user
- Status tracking (pending, completed, failed)
- Method used (bank transfer, Stellar, etc.)

**Subscription** - Platform subscriptions
- User subscription to exclusive content
- Tier information
- Status tracking

**UserPlatform** - Platform connections
- OAuth tokens for external platforms
- Platform-specific user IDs

## Relationships & Cascading

- **User -> Video**: 1:N with CASCADE delete
- **User -> Subscription**: 1:N with CASCADE delete
- **User -> Wallet**: 1:N with CASCADE delete
- **Video -> Clip**: 1:N with CASCADE delete
- **Clip -> ClipPost**: 1:N with CASCADE delete
- **Clip -> Earning**: 1:N with CASCADE delete

All foreign keys enforce referential integrity and cascade deletes for data consistency.

## Indexes

Performance-critical indexes:
- `User.email` - UNIQUE for fast authentication
- `Video.userId` - Fast user video lookup
- `Video.status` - Filter by processing status
- `Clip.videoId` - Fast clip retrieval per video
- `Clip.mintAddress` - UNIQUE for NFT lookups
- `ClipPost.clipId` - Fast post tracking per clip

## Database Notes

- **Provider**: PostgreSQL
- **ORM**: Prisma
- Timestamps: `createdAt` (auto), `updatedAt` (auto-updated)
- JSON fields used for: processingStats, targetPlatforms, postStatus
- String enums for status fields (pending, active, completed, failed, etc.)
