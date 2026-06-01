# Quick Start: Fiat Payout Methods

## 🚀 5-Minute Setup

### Step 1: Generate Encryption Secret

```bash
# Generate a secure random secret
openssl rand -base64 32
```

Copy the output (e.g., `Kj8fH2kLm9gI3lNp4qRs5tUv6wXy7zA0B1cD2eF3gH4i=`)

### Step 2: Configure Environment

Add to your `.env` file:

```bash
ENCRYPTION_SECRET="Kj8fH2kLm9gI3lNp4qRs5tUv6wXy7zA0B1cD2eF3gH4i="
```

### Step 3: Run Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Apply migration
npx prisma migrate deploy

# Or for development
npx prisma migrate dev --name add_payout_method
```

### Step 4: Start the Server

```bash
npm run start:dev
```

### Step 5: Test the API

```bash
# Get JWT token first (login)
TOKEN="your_jwt_token_here"

# Create a payout method
curl -X POST http://localhost:3000/payout-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bank_account",
    "accountNumber": "1234567890",
    "routingNumber": "021000021",
    "bankName": "Chase Bank",
    "accountHolderName": "John Doe",
    "country": "US",
    "currency": "USD",
    "isDefault": true
  }'

# List payout methods
curl -X GET http://localhost:3000/payout-methods \
  -H "Authorization: Bearer $TOKEN"

# Get default method
curl -X GET http://localhost:3000/payout-methods/default \
  -H "Authorization: Bearer $TOKEN"
```

## ✅ Verify It Works

### Check Database Encryption

```sql
-- Connect to your database
psql $DATABASE_URL

-- View encrypted data
SELECT 
  id,
  "userId",
  type,
  "bankName",
  "lastFourDigits",
  LEFT("encryptedAccountNumber", 20) || '...' as encrypted_preview
FROM "PayoutMethod"
WHERE "deletedAt" IS NULL;

-- You should see Base64-encoded encrypted strings
-- Example: Kj8fH2kLm9gI3lNp4q...
```

### Check API Response

The API should return sanitized data (no encrypted fields):

```json
{
  "id": 1,
  "type": "bank_account",
  "isDefault": true,
  "bankName": "Chase Bank",
  "accountHolderName": "John Doe",
  "country": "US",
  "currency": "USD",
  "lastFourDigits": "7890",
  "createdAt": "2026-05-31T12:00:00.000Z",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

✅ **No `encryptedAccountNumber` or other encrypted fields in response!**

## 📝 Common Use Cases

### 1. Create Bank Account (US)

```bash
curl -X POST http://localhost:3000/payout-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bank_account",
    "accountNumber": "1234567890",
    "routingNumber": "021000021",
    "bankName": "Chase Bank",
    "accountHolderName": "John Doe",
    "country": "US",
    "currency": "USD"
  }'
```

### 2. Create International Wire Transfer

```bash
curl -X POST http://localhost:3000/payout-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "wire_transfer",
    "iban": "GB29NWBK60161331926819",
    "swiftCode": "CHASUS33",
    "bankName": "International Bank",
    "accountHolderName": "John Doe",
    "country": "GB",
    "currency": "GBP"
  }'
```

### 3. Set as Default

```bash
curl -X PUT http://localhost:3000/payout-methods/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isDefault": true
  }'
```

### 4. Update Bank Name

```bash
curl -X PUT http://localhost:3000/payout-methods/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "Updated Bank Name"
  }'
```

### 5. Delete Payout Method

```bash
curl -X DELETE http://localhost:3000/payout-methods/1 \
  -H "Authorization: Bearer $TOKEN"
```

## 🧪 Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- payout-method.service.spec.ts

# Run with coverage
npm test -- --coverage
```

## 🔍 Troubleshooting

### Error: "ENCRYPTION_SECRET environment variable is required"

**Solution:** Add `ENCRYPTION_SECRET` to your `.env` file

```bash
openssl rand -base64 32
# Copy output to .env
```

### Error: "Either accountNumber or iban must be provided"

**Solution:** Provide at least one payment identifier

```json
{
  "type": "bank_account",
  "accountNumber": "1234567890",  // ← Required
  "routingNumber": "021000021"
}
```

Or for international:

```json
{
  "type": "wire_transfer",
  "iban": "GB29NWBK60161331926819",  // ← Required
  "swiftCode": "CHASUS33"
}
```

### Error: "Payout method not found"

**Possible causes:**
1. Method doesn't exist
2. Method belongs to another user
3. Method was soft-deleted

**Solution:** Check the method ID and ensure it belongs to the authenticated user

### Error: "Failed to decrypt sensitive data"

**Possible causes:**
1. `ENCRYPTION_SECRET` changed
2. Database corruption
3. Manual database modification

**Solution:** 
- Ensure `ENCRYPTION_SECRET` hasn't changed
- Check database integrity
- If secret was rotated, implement key rotation strategy

## 📊 Monitoring

### Check Encryption Status

```typescript
// In your service
const method = await prisma.payoutMethod.findUnique({
  where: { id: 1 }
});

console.log('Encrypted:', method.encryptedAccountNumber.substring(0, 20));
// Output: Encrypted: Kj8fH2kLm9gI3lNp4q...
```

### Verify Decryption (Internal Only)

```typescript
// INTERNAL USE ONLY - Never expose to API
const decrypted = await payoutMethodService.findOneWithSensitiveData(
  methodId,
  userId
);

console.log('Last 4:', decrypted.lastFourDigits);
// Output: Last 4: 7890

// Full number available for processing
console.log('Full:', decrypted.accountNumber);
// Output: Full: 1234567890
```

## 🔐 Security Checklist

- [x] `ENCRYPTION_SECRET` is set and secure (min 32 chars)
- [x] `ENCRYPTION_SECRET` is not committed to git
- [x] Different secrets for dev/staging/production
- [x] JWT authentication enabled on all endpoints
- [x] HTTPS enabled in production
- [x] Database backups configured
- [x] Audit logging enabled
- [x] Rate limiting configured

## 📚 Next Steps

1. **Review Documentation**
   - [FIAT_PAYOUT_SECURITY.md](./FIAT_PAYOUT_SECURITY.md) - Security details
   - [PAYOUT_ARCHITECTURE.md](./PAYOUT_ARCHITECTURE.md) - Architecture diagrams
   - [src/payouts/README.md](./src/payouts/README.md) - Developer guide

2. **Integration**
   - Integrate with your payout processing flow
   - Add to your admin dashboard
   - Implement audit logging

3. **Production Preparation**
   - Set up secret management (AWS Secrets Manager, Vault)
   - Configure monitoring and alerts
   - Implement key rotation strategy
   - Security audit

## 🆘 Need Help?

- **Security Issues:** Contact security team immediately
- **Implementation Questions:** Check test files for examples
- **API Documentation:** Visit `/api` for Swagger UI
- **Bug Reports:** Create an issue with reproduction steps

## 🎉 Success!

You now have a secure, encrypted payout method system ready to handle sensitive financial data!

**Remember:**
- Never log decrypted data
- Never expose encrypted fields in API responses
- Always use HTTPS in production
- Rotate encryption keys periodically
- Monitor for suspicious activity
