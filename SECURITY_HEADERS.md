# Security Headers Configuration

This application uses `@nestjs/helmet` to implement security headers that protect against common web vulnerabilities.

## Installed Security Headers

### 1. Content Security Policy (CSP)
Prevents XSS attacks by controlling which resources can be loaded.

**Configuration:**
- `defaultSrc: 'self'` - Only allow resources from same origin
- `styleSrc: 'self', 'unsafe-inline'` - Allow inline styles (needed for some frameworks)
- `scriptSrc: 'self'` - Only allow scripts from same origin
- `imgSrc: 'self', 'data:', 'https:'` - Allow images from same origin, data URIs, and HTTPS
- `connectSrc: 'self'` - Only allow AJAX/WebSocket connections to same origin
- `frameSrc: 'none'` - Prevent embedding in iframes

### 2. X-Content-Type-Options: nosniff
Prevents MIME type sniffing, forcing browsers to respect declared content types.

### 3. X-XSS-Protection
Enables browser's built-in XSS protection (legacy browsers).

### 4. X-Frame-Options: DENY
Prevents clickjacking by blocking the page from being embedded in iframes.

### 5. Strict-Transport-Security (HSTS)
Forces HTTPS connections for 1 year, including subdomains.

### 6. Hide X-Powered-By
Removes the `X-Powered-By: Express` header to avoid revealing server technology.

## Customizing for Frontend Assets

If you need to allow specific domains for frontend assets (CDNs, external APIs), modify the CSP directives in `src/main.ts`:

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: [`'self'`],
    styleSrc: [`'self'`, `'unsafe-inline'`, 'https://cdn.example.com'],
    scriptSrc: [`'self'`, 'https://cdn.example.com'],
    imgSrc: [`'self'`, 'data:', 'https:', 'https://res.cloudinary.com'],
    connectSrc: [`'self'`, 'https://api.example.com'],
    fontSrc: [`'self'`, 'https://fonts.gstatic.com'],
  },
}
```

## Common Overrides

### Allow WebSocket Connections
```typescript
connectSrc: [`'self'`, 'ws://localhost:3000', 'wss://yourdomain.com']
```

### Allow Google Fonts
```typescript
styleSrc: [`'self'`, `'unsafe-inline'`, 'https://fonts.googleapis.com'],
fontSrc: [`'self'`, 'https://fonts.gstatic.com']
```

### Allow Cloudinary Images (already configured)
```typescript
imgSrc: [`'self'`, 'data:', 'https:', 'https://res.cloudinary.com']
```

### Disable CSP for Development
If CSP causes issues during development, you can disable it:

```typescript
contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
  directives: { /* ... */ }
} : false
```

## Testing Security Headers

Use these tools to verify headers are working:

1. **Browser DevTools**: Check Network tab → Response Headers
2. **curl**: `curl -I http://localhost:3000`
3. **Online scanners**: 
   - https://securityheaders.com
   - https://observatory.mozilla.org

## Installation

```bash
npm install @nestjs/helmet
```

The configuration is applied globally in `src/main.ts`.
