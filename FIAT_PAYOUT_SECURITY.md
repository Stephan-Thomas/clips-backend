# Fiat Payout Security Implementation

## Overview

This document describes the secure storage and handling of fiat payout information, including bank account details. All sensitive financial data is encrypted at rest using AES-256-GCM encryption.

## Architecture

### Database Schema

The `PayoutMethod` model stores encrypted bank account information:

```prisma
model PayoutMethod {
  id                      Int       @id @default(autoincrement())
  userId                  Int
  type                    String    // 'bank_account', 'wire_transfer', 'ach'
  isDefault               Boolean   @default(false)
  
  // Encrypted fields
  encryptedAccountNumber  String?
  encryptedRoutingNumber  String?
  encryptedSwiftCode      String?
  encryptedIban           String?
  
  // Non-sensitive fields
  bankName                String?
  accountHolderName       String?
  country                 String?
  currency                String    @default("USD")
  lastFourDigits          String?   // For display purposes only
  
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime? // Soft delete
  
  user                    User      @relation(...)
  payouts                 Payout[]
}
```

### Encryption Service

The `EncryptionService` provides AES-256-GCM encryption with the following features:

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: SHA-256 hash of `ENCRYPTION_SECRET` environment variable
- **IV**: 128-bit random initialization vector (generated per encryption)
- **Authentication**: AEAD (Authenticated Encryption with Associated Data)
- **AAD**: Application identifier for additional security layer

#### Encryption Format

Encrypted data is stored as Base64-encoded strings with the following structure:

```
[16-byte IV][16-byte Auth Tag][Encrypted Data]
```

### Service Layer

The `PayoutMethodService` handles all encryption/decryption operations:

#### Key Methods

1. **`create(userId, dto)`**
   - Validates input (requires either `accountNumber` or `iban`)
   - Encrypts sensitive fields before storage
   - Extracts last 4 digits for display
   - Handles default method logic

2. **`findAll(userId)`**
   - Returns sanitized list (no encrypted data exposed)
   - Shows only last 4 digits of account numbers

3. **`findOne(id, userId)`**
   - Returns sanitized single record
   - No sensitive data exposed

4. **`findOneWithSensitiveData(id, userId)`**
   - **INTERNAL USE ONLY**
   - Decrypts sensitive fields
   - Should only be called when processing actual payouts

5. **`update(id, userId, dto)`**
   - Updates non-sensitive fields only
   - Cannot update encrypted account details (must create new method)

6. **`remove(id, userId)`**
   - Soft deletes the payout method
   - Preserves data for audit trail

## Security Features

### 1. Encryption at Rest

All sensitive financial data is encrypted before being stored in the database:

- Bank account numbers
- Routing numbers
- SWIFT/BIC codes
- IBAN numbers

### 2. Data Minimization

- Only last 4 digits are stored in plaintext for display
- Full account numbers are never logged or exposed in API responses
- Sensitive data is only decrypted when absolutely necessary (e.g., processing payouts)

### 3. Access Control

- All endpoints require JWT authentication
- Users can only access their own payout methods
- Sensitive data decryption is restricted to internal service methods

### 4. Soft Deletion

- Payout methods are soft-deleted (not permanently removed)
- Maintains audit trail and historical payout records
- Deleted methods are excluded from all user-facing queries

### 5. Default Method Management

- Only one method can be marked as default per user
- Automatically unsets previous default when setting a new one

## API Endpoints

### Create Payout Method

```http
POST /payout-methods
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "bank_account",
  "accountNumber": "1234567890",
  "routingNumber": "021000021",
  "bankName": "Chase Bank",
  "accountHolderName": "John Doe",
  "country": "US",
  "currency": "USD",
  "isDefault": false
}
```

**Response:**
```json
{
  "id": 1,
  "type": "bank_account",
  "isDefault": false,
  "bankName": "Chase Bank",
  "accountHolderName": "John Doe",
  "country": "US",
  "currency": "USD",
  "lastFourDigits": "7890",
  "createdAt": "2026-05-31T12:00:00Z",
  "updatedAt": "2026-05-31T12:00:00Z"
}
```

### List Payout Methods

```http
GET /payout-methods
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "type": "bank_account",
    "isDefault": true,
    "bankName": "Chase Bank",
    "accountHolderName": "John Doe",
    "country": "US",
    "currency": "USD",
    "lastFourDigits": "7890",
    "createdAt": "2026-05-31T12:00:00Z",
    "updatedAt": "2026-05-31T12:00:00Z"
  }
]
```

### Get Default Method

```http
GET /payout-methods/default
Authorization: Bearer <token>
```

### Get Specific Method

```http
GET /payout-methods/:id
Authorization: Bearer <token>
```

### Update Method

```http
PUT /payout-methods/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "bankName": "Updated Bank Name",
  "isDefault": true
}
```

### Delete Method

```http
DELETE /payout-methods/:id
Authorization: Bearer <token>
```

## Environment Configuration

### Required Environment Variables

```bash
# Encryption secret (minimum 32 characters)
# Generate with: openssl rand -base64 32
ENCRYPTION_SECRET="your_encryption_secret_min_32_chars"
```

### Security Recommendations

1. **Generate Strong Secret**: Use a cryptographically secure random string
   ```bash
   openssl rand -base64 32
   ```

2. **Rotate Keys**: Implement key rotation strategy for production
   - Store old keys for decrypting existing data
   - Re-encrypt data with new keys during rotation

3. **Environment Isolation**: Use different secrets for each environment
   - Development
   - Staging
   - Production

4. **Secret Management**: Use secure secret management services
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

## Testing

Comprehensive test suite covers:

- ✅ Encryption/decryption of sensitive fields
- ✅ Data sanitization (no encrypted data in responses)
- ✅ Default method management
- ✅ Soft deletion
- ✅ Access control (user isolation)
- ✅ Validation (required fields)
- ✅ IBAN and SWIFT code support
- ✅ Last 4 digits extraction

Run tests:
```bash
npm test -- payout-method.service.spec.ts
```

## Migration

To apply the database schema changes:

```bash
# Generate Prisma client
npx prisma generate

# Apply migration
npx prisma migrate deploy
```

## Compliance Considerations

### PCI DSS

While this implementation provides strong encryption, full PCI DSS compliance requires:

- Regular security audits
- Network segmentation
- Access logging and monitoring
- Incident response procedures
- Regular penetration testing

### GDPR

- Users have the right to access their data
- Users have the right to delete their data (soft delete implemented)
- Data minimization (only last 4 digits stored in plaintext)
- Encryption at rest (implemented)

### Data Retention

- Soft-deleted payout methods are retained for audit purposes
- Consider implementing hard deletion after retention period
- Document retention policies in privacy policy

## Future Enhancements

1. **Key Rotation**: Implement automated key rotation
2. **Audit Logging**: Log all access to sensitive data
3. **Rate Limiting**: Add rate limits to payout method endpoints
4. **Verification**: Implement micro-deposit verification for bank accounts
5. **Multi-Region**: Support for region-specific encryption keys
6. **Tokenization**: Consider using payment processor tokenization as additional layer

## Support

For security concerns or questions, contact the security team.

**Never commit encryption secrets to version control.**
