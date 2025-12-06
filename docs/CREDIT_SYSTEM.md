# Credit System Documentation

This document provides comprehensive information about the credit system implementation in this boilerplate, including architecture, usage, and management.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Core Services](#core-services)
5. [Credit Manager](#credit-manager)
6. [Frontend Integration](#frontend-integration)
7. [API Integration](#api-integration)
8. [Payment Integration](#payment-integration)
9. [Real-time Updates](#real-time-updates)
10. [Usage Examples](#usage-examples)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

## Overview

The credit system is a comprehensive solution for managing user credits in your application. It provides:

- **Credit Management**: Add, deduct, and check user credits
- **Real-time Updates**: Automatic UI updates when credits change
- **Payment Integration**: Seamless credit purchases via DodoPayments
- **Event-driven Architecture**: Service-based approach for credit operations
- **Security**: Server-side validation and secure credit operations

## Architecture

The credit system follows a service-oriented architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Credit Manager │    │  Credit Service │
│                 │    │                 │    │                 │
│ - Header Display│◄──►│ - Event System  │◄──►│ - Database Ops  │
│ - Tool Usage    │    │ - Real-time Sub │    │ - Validation    │
│ - Credit Pages  │    │ - State Mgmt    │    │ - Security      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │    │   Supabase      │    │   Database      │
│                 │    │                 │    │                 │
│ - Tool APIs     │    │ - Real-time     │    │ - Credits Table │
│ - Payment APIs  │    │ - Subscriptions │    │ - Transactions  │
│ - Credit APIs   │    │ - Auth          │    │ - User Data     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Database Schema

### Credits Table

```sql
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_credits_user_id ON credits(user_id);
CREATE UNIQUE INDEX idx_credits_user_unique ON credits(user_id);
```

### Credit Transactions (Optional)

```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for deductions
  type VARCHAR(50) NOT NULL, -- 'purchase', 'deduction', 'refund', etc.
  description TEXT,
  reference_id UUID, -- Reference to payment, tool usage, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
```

## Core Services

### CreditService (`lib/credits.ts`)

The main service for credit operations:

```typescript
class CreditService {
  // Get user's current credit balance
  async getUserCredits(userId: string): Promise<number>
  
  // Add credits to user's account
  async addCredits(userId: string, amount: number): Promise<number>
  
  // Deduct credits from user's account
  async deductCredits(userId: string, amount: number): Promise<number>
  
  // Check if user has sufficient credits
  async hasCredits(userId: string, requiredAmount: number): Promise<boolean>
  
  // Initialize credits for new user
  async initializeUserCredits(userId: string, initialAmount: number = 0): Promise<void>
}
```

**Key Features:**
- Atomic operations with database transactions
- Error handling for insufficient credits
- Automatic user credit initialization
- Type-safe operations

## Credit Manager

### CreditManager (`lib/credit-manager.ts`)

Event-driven credit management with real-time updates:

```typescript
class CreditManager {
  // Real-time credit balance subscription
  subscribeToCredits(userId: string, callback: (balance: number) => void): () => void
  
  // Update local credit balance
  updateBalance(userId: string, newBalance: number): void
  
  // Get current cached balance
  getBalance(userId: string): number
  
  // Emit credit update events
  emit(event: string, data: any): void
}
```

**React Hook:**
```typescript
// Hook for components to access credit data
function useCreditManager(userId: string): {
  balance: number
  loading: boolean
  error: string | null
}

// Utility for API calls with automatic credit updates
function makeApiCallWithCreditUpdate<T>(
  apiCall: () => Promise<Response>,
  userId: string
): Promise<T>
```

## Frontend Integration

### Header Credit Display

The header shows real-time credit balance:

```typescript
// components/blog-writer/header-user.tsx
export function HeaderUser({ user, initialCreditBalance }: HeaderUserProps) {
  const { balance: creditBalance } = useCreditManager(user.id)
  
  return (
    <div className="flex items-center gap-3">
      {/* Credit Display */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Coins className="h-4 w-4" />
        <span>{creditBalance.toLocaleString()}</span>
      </div>
      
      {/* User Avatar and Menu */}
      <DropdownMenu>
        {/* ... */}
      </DropdownMenu>
    </div>
  )
}
```

### Tool Integration

Tools automatically handle credit deduction:

```typescript
// app/(protected)/example-tool/ExampleToolClient.tsx
export default function ExampleToolClient({ userId, requiredCredits }: Props) {
  const { balance: currentBalance } = useCreditManager(userId)
  const hasCredits = currentBalance >= requiredCredits
  
  const handleGenerate = async () => {
    try {
      const data = await makeApiCallWithCreditUpdate<any>(
        () => fetch('/api/example-protected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        }),
        userId
      )
      
      // Credit balance automatically updated via CreditManager
      setResult(data)
      toast.success('Content generated successfully!')
    } catch (error) {
      toast.error('Generation failed')
    }
  }
}
```

## API Integration

### Protected API Routes

API routes that consume credits:

```typescript
// app/api/example-protected/route.ts
export async function POST(request: Request) {
  try {
    const { user } = await createClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const requiredCredits = 1
    
    // Check if user has sufficient credits
    const hasCredits = await creditService.hasCredits(user.id, requiredCredits)
    if (!hasCredits) {
      return NextResponse.json(
        { message: 'Insufficient credits' },
        { status: 402 }
      )
    }
    
    // Deduct credits before processing
    const newBalance = await creditService.deductCredits(user.id, requiredCredits)
    
    // Process the request
    const result = await processRequest()
    
    return NextResponse.json({
      ...result,
      newBalance,
      creditsUsed: requiredCredits
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### Credit Management API

```typescript
// app/api/credits/route.ts
export async function GET(request: Request) {
  // Get user's current credit balance
}

export async function POST(request: Request) {
  // Add credits to user's account (admin only)
}
```

## Payment Integration

### DodoPayments Integration

Seamless credit purchases:

```typescript
// components/dodopayments/DodoCheckoutButton.tsx
export function DodoCheckoutButton({ planId, credits, price }: Props) {
  const handleCheckout = async () => {
    const response = await fetch('/api/dodopayments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        credits,
        price,
        successUrl: `${window.location.origin}/payment-success`,
        cancelUrl: `${window.location.origin}/buy-credits`
      })
    })
    
    const { checkoutUrl } = await response.json()
    window.location.href = checkoutUrl
  }
}
```

### Webhook Processing

```typescript
// app/api/dodopayments/webhook/route.ts
export async function POST(request: Request) {
  const event = await validateWebhook(request)
  
  if (event.type === 'payment.completed') {
    const { userId, credits } = event.data
    
    // Add credits to user's account
    await creditService.addCredits(userId, credits)
    
    // Optional: Log transaction
    await logCreditTransaction({
      userId,
      amount: credits,
      type: 'purchase',
      referenceId: event.paymentId
    })
  }
}
```

## Real-time Updates

### Supabase Subscriptions

The system uses Supabase real-time subscriptions for instant updates:

```typescript
// lib/credit-manager.ts
class CreditManager {
  private setupSubscription(userId: string) {
    return supabase
      .channel(`credits:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'credits',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newBalance = payload.new.balance
          this.updateBalance(userId, newBalance)
          this.emit('balanceUpdated', { userId, balance: newBalance })
        }
      )
      .subscribe()
  }
}
```

## Usage Examples

### 1. Adding a New Tool with Credit Deduction

```typescript
// 1. Create API route
// app/api/my-new-tool/route.ts
export async function POST(request: Request) {
  const requiredCredits = 2 // Define cost
  
  // Standard credit check and deduction
  const hasCredits = await creditService.hasCredits(user.id, requiredCredits)
  if (!hasCredits) {
    return NextResponse.json({ message: 'Insufficient credits' }, { status: 402 })
  }
  
  const newBalance = await creditService.deductCredits(user.id, requiredCredits)
  
  // Your tool logic here
  const result = await myToolLogic()
  
  return NextResponse.json({ ...result, newBalance })
}

// 2. Create frontend component
// app/(protected)/my-new-tool/page.tsx
export default function MyNewTool({ userId }: Props) {
  const { balance } = useCreditManager(userId)
  const requiredCredits = 2
  
  const handleAction = async () => {
    const data = await makeApiCallWithCreditUpdate(
      () => fetch('/api/my-new-tool', { method: 'POST' }),
      userId
    )
    // Handle response
  }
  
  return (
    <div>
      <p>Current Balance: {balance}</p>
      <p>Required Credits: {requiredCredits}</p>
      <Button 
        onClick={handleAction}
        disabled={balance < requiredCredits}
      >
        Use Tool ({requiredCredits} credits)
      </Button>
    </div>
  )
}
```

### 2. Custom Credit Pricing

```typescript
// lib/pricing-plans.ts
export const CREDIT_PACKAGES = [
  { id: 'starter', credits: 100, price: 9.99, popular: false },
  { id: 'pro', credits: 500, price: 39.99, popular: true },
  { id: 'enterprise', credits: 2000, price: 149.99, popular: false }
]

// Dynamic pricing based on usage
export function calculateToolCost(toolType: string, complexity: 'low' | 'medium' | 'high'): number {
  const baseCosts = {
    'text-generation': 1,
    'image-generation': 3,
    'video-processing': 10
  }
  
  const multipliers = {
    'low': 1,
    'medium': 1.5,
    'high': 2
  }
  
  return Math.ceil(baseCosts[toolType] * multipliers[complexity])
}
```

### 3. Admin Credit Management

```typescript
// app/api/admin/credits/route.ts
export async function POST(request: Request) {
  // Verify admin permissions
  const isAdmin = await verifyAdminRole(user)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  
  const { userId, amount, reason } = await request.json()
  
  // Add credits with audit trail
  const newBalance = await creditService.addCredits(userId, amount)
  
  await logCreditTransaction({
    userId,
    amount,
    type: 'admin_adjustment',
    description: reason,
    adminId: user.id
  })
  
  return NextResponse.json({ newBalance })
}
```

## Best Practices

### 1. Security

- **Server-side Validation**: Always validate credit operations on the server
- **Atomic Transactions**: Use database transactions for credit operations
- **Rate Limiting**: Implement rate limiting on credit-consuming APIs
- **Audit Trail**: Log all credit transactions for accountability

### 2. Performance

- **Caching**: Cache credit balances in the CreditManager
- **Batch Operations**: Group multiple credit operations when possible
- **Efficient Queries**: Use indexed queries for credit lookups
- **Real-time Optimization**: Limit subscription scope to necessary data

### 3. User Experience

- **Clear Pricing**: Display credit costs prominently
- **Balance Visibility**: Show current balance in the header
- **Graceful Degradation**: Handle insufficient credits gracefully
- **Purchase Flow**: Provide easy credit purchase options

### 4. Error Handling

```typescript
// Comprehensive error handling
try {
  const newBalance = await creditService.deductCredits(userId, amount)
  return { success: true, newBalance }
} catch (error) {
  if (error.message === 'Insufficient credits') {
    return NextResponse.json(
      { 
        error: 'Insufficient credits',
        currentBalance: await creditService.getUserCredits(userId),
        requiredCredits: amount
      },
      { status: 402 }
    )
  }
  
  // Log unexpected errors
  console.error('Credit deduction failed:', error)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
```

## Troubleshooting

### Common Issues

#### 1. Credits Not Updating in UI

**Problem**: Credit balance doesn't update after tool usage

**Solutions**:
- Check if `makeApiCallWithCreditUpdate` is used in the component
- Verify Supabase real-time subscription is active
- Ensure `useCreditManager` hook is properly implemented
- Check browser console for subscription errors

#### 2. Payment Not Adding Credits

**Problem**: Credits not added after successful payment

**Solutions**:
- Verify webhook endpoint is accessible
- Check webhook signature validation
- Ensure payment event handling is correct
- Review webhook logs in DodoPayments dashboard

#### 3. Insufficient Credits Error

**Problem**: Users getting insufficient credits despite having balance

**Solutions**:
- Check for race conditions in concurrent requests
- Verify credit deduction logic in API routes
- Ensure database transactions are properly handled
- Review credit balance calculation logic

#### 4. Real-time Updates Not Working

**Problem**: Credit balance not updating in real-time

**Solutions**:
- Verify Supabase real-time is enabled
- Check subscription channel configuration
- Ensure proper cleanup of subscriptions
- Review browser network tab for WebSocket connections

### Debug Tools

```typescript
// Enable debug logging
const DEBUG_CREDITS = process.env.NODE_ENV === 'development'

if (DEBUG_CREDITS) {
  console.log('Credit operation:', {
    userId,
    operation: 'deduct',
    amount,
    currentBalance,
    newBalance
  })
}

// Credit balance verification
export async function verifyCreditBalance(userId: string) {
  const dbBalance = await creditService.getUserCredits(userId)
  const cachedBalance = creditManager.getBalance(userId)
  
  if (dbBalance !== cachedBalance) {
    console.warn('Credit balance mismatch:', {
      userId,
      database: dbBalance,
      cache: cachedBalance
    })
    
    // Sync cache with database
    creditManager.updateBalance(userId, dbBalance)
  }
  
  return dbBalance
}
```

### Performance Monitoring

```typescript
// Monitor credit operations
export async function monitorCreditOperation<T>(
  operation: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  
  try {
    const result = await fn()
    const duration = Date.now() - start
    
    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow credit operation: ${operation}`, {
        userId,
        duration,
        operation
      })
    }
    
    return result
  } catch (error) {
    console.error(`Credit operation failed: ${operation}`, {
      userId,
      error: error.message,
      operation
    })
    throw error
  }
}
```

## Migration Guide

If you're upgrading from a previous version or implementing credits in an existing app:

### 1. Database Migration

```sql
-- Create credits table
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_user_unique ON credits(user_id);

-- Initialize existing users with credits
INSERT INTO credits (user_id, balance)
SELECT id, 100 -- Give 100 free credits
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM credits);
```

### 2. Code Migration

```typescript
// Replace manual credit management
// OLD:
const [credits, setCredits] = useState(initialCredits)
const updateCredits = (newBalance) => {
  setCredits(newBalance)
  router.refresh()
}

// NEW:
const { balance: credits } = useCreditManager(userId)
// Automatic updates, no manual management needed
```

### 3. API Route Updates

```typescript
// OLD: Manual credit checking
const userCredits = await getUserCredits(userId)
if (userCredits < requiredCredits) {
  return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
}

// NEW: Use CreditService
const hasCredits = await creditService.hasCredits(userId, requiredCredits)
if (!hasCredits) {
  return NextResponse.json({ message: 'Insufficient credits' }, { status: 402 })
}
const newBalance = await creditService.deductCredits(userId, requiredCredits)
```

---

## Conclusion

This credit system provides a robust, scalable foundation for managing user credits in your application. It combines server-side security with real-time frontend updates, ensuring a smooth user experience while maintaining data integrity.

For additional support or questions, refer to the individual component documentation or create an issue in the project repository.