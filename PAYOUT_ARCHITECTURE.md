# Payout Method Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Application                       │
│                    (Web/Mobile with JWT Token)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS + JWT
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PayoutMethodController                        │
│                   (REST API Endpoints)                           │
│  • POST   /payout-methods                                        │
│  • GET    /payout-methods                                        │
│  • GET    /payout-methods/:id                                    │
│  • PUT    /payout-methods/:id                                    │
│  • DELETE /payout-methods/:id                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Validates JWT & User ID
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PayoutMethodService                           │
│                   (Business Logic Layer)                         │
│                                                                   │
│  Methods:                                                         │
│  • create(userId, dto)          ─────┐                          │
│  • findAll(userId)                   │                          │
│  • findOne(id, userId)               │                          │
│  • findOneWithSensitiveData()        │ Uses                     │
│  • update(id, userId, dto)           │                          │
│  • remove(id, userId)                │                          │
│  • getDefaultMethod(userId)          │                          │
└──────────────────────────────────────┼──────────────────────────┘
                             │         │
                             │         ▼
                             │    ┌─────────────────────────────┐
                             │    │   EncryptionService         │
                             │    │   (AES-256-GCM)             │
                             │    │                             │
                             │    │  • encrypt(text)            │
                             │    │  • decrypt(encryptedData)   │
                             │    │                             │
                             │    │  Key: SHA-256 hash of       │
                             │    │       ENCRYPTION_SECRET     │
                             │    └─────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PrismaService                               │
│                   (Database Access Layer)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│                                                                   │
│  PayoutMethod Table:                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ id                      INTEGER PRIMARY KEY                 │ │
│  │ userId                  INTEGER (FK to User)                │ │
│  │ type                    VARCHAR                             │ │
│  │ isDefault               BOOLEAN                             │ │
│  │                                                             │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ ENCRYPTED FIELDS (AES-256-GCM)                      │   │ │
│  │ │ • encryptedAccountNumber  TEXT                      │   │ │
│  │ │ • encryptedRoutingNumber  TEXT                      │   │ │
│  │ │ • encryptedSwiftCode      TEXT                      │   │ │
│  │ │ • encryptedIban           TEXT                      │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │ bankName                VARCHAR                             │ │
│  │ accountHolderName       VARCHAR                             │ │
│  │ country                 VARCHAR                             │ │
│  │ currency                VARCHAR                             │ │
│  │ lastFourDigits          VARCHAR (plaintext for display)    │ │
│  │ createdAt               TIMESTAMP                           │ │
│  │ updatedAt               TIMESTAMP                           │ │
│  │ deletedAt               TIMESTAMP (soft delete)             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a Payout Method

```
1. Client Request
   ↓
   POST /payout-methods
   {
     "type": "bank_account",
     "accountNumber": "1234567890",
     "routingNumber": "021000021",
     "bankName": "Chase Bank"
   }

2. Controller (JWT Auth)
   ↓
   Validates JWT token
   Extracts userId from token

3. Service Layer
   ↓
   • Validates input (accountNumber or iban required)
   • Extracts last 4 digits: "7890"
   • Calls EncryptionService.encrypt()
   
4. Encryption Service
   ↓
   accountNumber "1234567890"
   ↓
   Generate random IV (16 bytes)
   ↓
   Encrypt with AES-256-GCM
   ↓
   Add authentication tag
   ↓
   Combine: [IV + Auth Tag + Encrypted Data]
   ↓
   Base64 encode
   ↓
   "Kj8fH2k...encrypted_string...9xL2=="

5. Database Storage
   ↓
   INSERT INTO PayoutMethod (
     userId: 1,
     type: "bank_account",
     encryptedAccountNumber: "Kj8fH2k...encrypted_string...9xL2==",
     encryptedRoutingNumber: "Lm9gI3l...encrypted_string...8yM3==",
     bankName: "Chase Bank",
     lastFourDigits: "7890"
   )

6. Response (Sanitized)
   ↓
   {
     "id": 1,
     "type": "bank_account",
     "bankName": "Chase Bank",
     "lastFourDigits": "7890",  // Only last 4 visible
     "createdAt": "2026-05-31T12:00:00Z"
   }
   // Note: No encrypted fields in response!
```

### Retrieving Payout Methods (User View)

```
1. Client Request
   ↓
   GET /payout-methods

2. Controller (JWT Auth)
   ↓
   Validates JWT token
   Extracts userId from token

3. Service Layer
   ↓
   Calls findAll(userId)
   ↓
   Queries database for user's methods
   ↓
   Sanitizes response (removes encrypted fields)

4. Response
   ↓
   [
     {
       "id": 1,
       "type": "bank_account",
       "bankName": "Chase Bank",
       "lastFourDigits": "7890",
       // No sensitive data!
     }
   ]
```

### Processing a Payout (Internal)

```
1. Internal Service Call
   ↓
   findOneWithSensitiveData(methodId, userId)

2. Service Layer
   ↓
   Queries database
   ↓
   Retrieves encrypted fields

3. Decryption Service
   ↓
   encryptedAccountNumber: "Kj8fH2k...encrypted_string...9xL2=="
   ↓
   Base64 decode
   ↓
   Extract IV, Auth Tag, Encrypted Data
   ↓
   Decrypt with AES-256-GCM
   ↓
   Verify authentication tag
   ↓
   Return plaintext: "1234567890"

4. Process Payout
   ↓
   Use decrypted account number for bank transfer
   ↓
   Create Payout record
   ↓
   Never log or expose decrypted data
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Transport Security                                  │
│ • HTTPS/TLS encryption in transit                           │
│ • JWT token authentication                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Application Security                               │
│ • JWT validation                                            │
│ • User isolation (can only access own data)                │
│ • Input validation                                          │
│ • Rate limiting                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Data Security                                      │
│ • AES-256-GCM encryption at rest                           │
│ • Unique IV per encryption                                  │
│ • Authenticated encryption (AEAD)                           │
│ • Data sanitization (no sensitive data in responses)       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Database Security                                  │
│ • Encrypted fields stored as Base64 strings                │
│ • Soft delete for audit trail                              │
│ • Database-level access controls                           │
└─────────────────────────────────────────────────────────────┘
```

## Encryption Details

### AES-256-GCM Encryption Process

```
Input: "1234567890"
         ↓
┌────────────────────────────────────────┐
│ 1. Generate Random IV (16 bytes)      │
│    IV: [random 128-bit value]         │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ 2. Derive Key from Secret              │
│    Key = SHA-256(ENCRYPTION_SECRET)    │
│    Result: 32-byte key for AES-256     │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ 3. Set Additional Authenticated Data   │
│    AAD: "clips-backend"                │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ 4. Encrypt with AES-256-GCM            │
│    Cipher: AES-256-GCM                 │
│    Input: "1234567890"                 │
│    Output: [encrypted bytes]           │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ 5. Generate Authentication Tag         │
│    Auth Tag: [16-byte tag]             │
│    Ensures data integrity              │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ 6. Combine Components                  │
│    [IV][Auth Tag][Encrypted Data]      │
│    16 + 16 + variable bytes            │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ 7. Base64 Encode                       │
│    Output: "Kj8fH2k...9xL2=="          │
│    Stored in database                  │
└────────────────────────────────────────┘
```

## Module Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                      PayoutsModule                           │
│                                                              │
│  Imports:                                                    │
│  ├─ PrismaModule          (Database access)                │
│  ├─ StellarModule         (Crypto payouts)                 │
│  ├─ AuthModule            (JWT authentication)             │
│  └─ EncryptionModule      (AES-256-GCM encryption)         │
│                                                              │
│  Controllers:                                                │
│  ├─ PayoutsController                                       │
│  ├─ PayoutMethodController                                  │
│  ├─ AdminPayoutsController                                  │
│  └─ AdminFeesController                                     │
│                                                              │
│  Services:                                                   │
│  ├─ PayoutsService                                          │
│  ├─ PayoutMethodService                                     │
│  ├─ FeeService                                              │
│  └─ PayoutReceiptService                                    │
│                                                              │
│  Exports:                                                    │
│  ├─ PayoutsService                                          │
│  ├─ PayoutMethodService                                     │
│  └─ FeeService                                              │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
Request
  ↓
┌─────────────────────────────────────┐
│ JWT Authentication Failed?          │
│ → 401 Unauthorized                  │
└─────────────────────────────────────┘
  ↓ Success
┌─────────────────────────────────────┐
│ Input Validation Failed?            │
│ → 400 Bad Request                   │
│   (e.g., missing accountNumber)     │
└─────────────────────────────────────┘
  ↓ Success
┌─────────────────────────────────────┐
│ Resource Not Found?                 │
│ → 404 Not Found                     │
│   (e.g., invalid methodId)          │
└─────────────────────────────────────┘
  ↓ Success
┌─────────────────────────────────────┐
│ User Not Authorized?                │
│ → 403 Forbidden                     │
│   (accessing another user's method) │
└─────────────────────────────────────┘
  ↓ Success
┌─────────────────────────────────────┐
│ Encryption/Decryption Failed?       │
│ → 500 Internal Server Error         │
│   (logged for investigation)        │
└─────────────────────────────────────┘
  ↓ Success
Response with sanitized data
```

## Audit Trail

```
┌─────────────────────────────────────────────────────────────┐
│                    Audit Trail Events                        │
│                                                              │
│  CREATE PayoutMethod                                         │
│  ├─ Timestamp: createdAt                                    │
│  ├─ User: userId                                            │
│  ├─ Action: "Created payout method"                         │
│  └─ Data: type, bankName, lastFourDigits                    │
│                                                              │
│  UPDATE PayoutMethod                                         │
│  ├─ Timestamp: updatedAt                                    │
│  ├─ User: userId                                            │
│  ├─ Action: "Updated payout method"                         │
│  └─ Changes: modified fields                                │
│                                                              │
│  SOFT DELETE PayoutMethod                                    │
│  ├─ Timestamp: deletedAt                                    │
│  ├─ User: userId                                            │
│  ├─ Action: "Deleted payout method"                         │
│  └─ Note: Record preserved for audit                        │
│                                                              │
│  ACCESS Sensitive Data                                       │
│  ├─ Timestamp: access time                                  │
│  ├─ User: userId                                            │
│  ├─ Action: "Decrypted payout method"                       │
│  └─ Purpose: "Processing payout"                            │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

```
┌─────────────────────────────────────────────────────────────┐
│ Database Indexes                                             │
│ ├─ PayoutMethod.userId (for user queries)                  │
│ ├─ PayoutMethod.type (for filtering by type)               │
│ └─ PayoutMethod.deletedAt (for soft delete queries)        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Caching Strategy (Future Enhancement)                        │
│ ├─ Cache sanitized payout methods per user                 │
│ ├─ Invalidate on create/update/delete                      │
│ └─ Never cache decrypted sensitive data                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Encryption Performance                                       │
│ ├─ AES-256-GCM is hardware-accelerated on modern CPUs      │
│ ├─ Encryption: ~1-2ms per field                            │
│ ├─ Decryption: ~1-2ms per field                            │
│ └─ Minimal impact on API response time                     │
└─────────────────────────────────────────────────────────────┘
```

This architecture ensures secure, scalable, and maintainable handling of sensitive financial data.
