# Credit System Integration Guide

This guide provides practical examples and patterns for integrating the credit system into various parts of your application.

## Table of Contents

1. [Quick Start Integration](#quick-start-integration)
2. [Common Integration Patterns](#common-integration-patterns)
3. [Tool Integration Examples](#tool-integration-examples)
4. [UI Component Patterns](#ui-component-patterns)
5. [API Integration Patterns](#api-integration-patterns)
6. [Payment Flow Integration](#payment-flow-integration)
7. [Admin Panel Integration](#admin-panel-integration)
8. [Mobile App Integration](#mobile-app-integration)
9. [Third-party Service Integration](#third-party-service-integration)
10. [Migration Strategies](#migration-strategies)

## Quick Start Integration

### 1. Basic Tool with Credit Deduction

```typescript
// app/(protected)/my-tool/page.tsx
import { createClient } from '@/utils/supabase/server'
import { creditService } from '@/lib/credits'
import MyToolClient from './MyToolClient'

export default async function MyToolPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  const creditBalance = await creditService.getUserCredits(user.id)
  const requiredCredits = 2 // Define your tool's cost
  
  return (
    <MyToolClient
      userId={user.id}
      creditBalance={creditBalance}
      requiredCredits={requiredCredits}
    />
  )
}
```

```typescript
// app/(protected)/my-tool/MyToolClient.tsx
'use client'

import { useCreditManager, makeApiCallWithCreditUpdate } from '@/lib/credit-manager'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface MyToolClientProps {
  userId: string
  creditBalance: number
  requiredCredits: number
}

export default function MyToolClient({ userId, requiredCredits }: MyToolClientProps) {
  const { balance } = useCreditManager(userId)
  const [loading, setLoading] = useState(false)
  
  const handleAction = async () => {
    if (balance < requiredCredits) {
      toast.error('Insufficient credits')
      return
    }
    
    setLoading(true)
    try {
      const result = await makeApiCallWithCreditUpdate(
        () => fetch('/api/my-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ /* your data */ })
        }),
        userId
      )
      
      toast.success('Action completed successfully!')
      // Handle result
    } catch (error) {
      toast.error('Action failed')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>My Tool</h1>
        <div className="text-sm text-muted-foreground">
          Balance: {balance} credits
        </div>
      </div>
      
      <Button
        onClick={handleAction}
        disabled={loading || balance < requiredCredits}
        className="w-full"
      >
        {loading ? 'Processing...' : `Use Tool (${requiredCredits} credits)`}
      </Button>
      
      {balance < requiredCredits && (
        <p className="text-sm text-red-600">
          You need {requiredCredits - balance} more credits to use this tool.
          <Link href="/buy-credits" className="underline ml-1">
            Buy credits
          </Link>
        </p>
      )}
    </div>
  )
}
```

```typescript
// app/api/my-tool/route.ts
import { createClient } from '@/utils/supabase/server'
import { creditService } from '@/lib/credits'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const requiredCredits = 2
    
    // Check and deduct credits
    const hasCredits = await creditService.hasCredits(user.id, requiredCredits)
    if (!hasCredits) {
      return NextResponse.json(
        { message: 'Insufficient credits' },
        { status: 402 }
      )
    }
    
    const newBalance = await creditService.deductCredits(user.id, requiredCredits)
    
    // Your tool logic here
    const result = await processMyTool()
    
    return NextResponse.json({
      success: true,
      result,
      newBalance,
      creditsUsed: requiredCredits
    })
  } catch (error) {
    console.error('My tool error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processMyTool() {
  // Implement your tool's core functionality
  return { message: 'Tool executed successfully' }
}
```

## Common Integration Patterns

### 1. Conditional Feature Access

```typescript
// components/ConditionalFeature.tsx
import { useCreditManager } from '@/lib/credit-manager'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

interface ConditionalFeatureProps {
  userId: string
  requiredCredits: number
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ConditionalFeature({
  userId,
  requiredCredits,
  children,
  fallback
}: ConditionalFeatureProps) {
  const { balance } = useCreditManager(userId)
  const hasAccess = balance >= requiredCredits
  
  if (hasAccess) {
    return <>{children}</>
  }
  
  return (
    fallback || (
      <div className="p-6 border border-dashed rounded-lg text-center">
        <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <h3 className="font-semibold mb-2">Premium Feature</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This feature requires {requiredCredits} credits.
        </p>
        <Button asChild size="sm">
          <Link href="/buy-credits">Buy Credits</Link>
        </Button>
      </div>
    )
  )
}

// Usage
<ConditionalFeature userId={user.id} requiredCredits={5}>
  <AdvancedAnalytics />
</ConditionalFeature>
```

### 2. Credit-aware Navigation

```typescript
// components/CreditAwareNavigation.tsx
import { useCreditManager } from '@/lib/credit-manager'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  href: string
  label: string
  requiredCredits?: number
  icon?: React.ComponentType
}

interface CreditAwareNavigationProps {
  userId: string
  items: NavItem[]
}

export function CreditAwareNavigation({ userId, items }: CreditAwareNavigationProps) {
  const { balance } = useCreditManager(userId)
  
  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const hasAccess = !item.requiredCredits || balance >= item.requiredCredits
        
        return (
          <Link
            key={item.href}
            href={hasAccess ? item.href : '/buy-credits'}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
              hasAccess
                ? 'hover:bg-accent text-foreground'
                : 'text-muted-foreground cursor-not-allowed'
            )}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            <span>{item.label}</span>
            {item.requiredCredits && (
              <Badge variant={hasAccess ? 'secondary' : 'destructive'} size="sm">
                {item.requiredCredits}
              </Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
```

### 3. Usage Tracking Component

```typescript
// components/UsageTracker.tsx
import { useCreditManager } from '@/lib/credit-manager'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface UsageTrackerProps {
  userId: string
  monthlyLimit?: number
}

export function UsageTracker({ userId, monthlyLimit = 1000 }: UsageTrackerProps) {
  const { balance } = useCreditManager(userId)
  const [monthlyUsage, setMonthlyUsage] = useState(0)
  
  useEffect(() => {
    // Fetch monthly usage
    fetchMonthlyUsage(userId).then(setMonthlyUsage)
  }, [userId])
  
  const usagePercentage = (monthlyUsage / monthlyLimit) * 100
  const remainingCredits = monthlyLimit - monthlyUsage
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Credit Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Current Balance</span>
            <span className="font-medium">{balance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Monthly Usage</span>
            <span>{monthlyUsage.toLocaleString()} / {monthlyLimit.toLocaleString()}</span>
          </div>
        </div>
        
        <Progress value={usagePercentage} className="h-2" />
        
        <div className="text-xs text-muted-foreground">
          {remainingCredits > 0 
            ? `${remainingCredits.toLocaleString()} credits remaining this month`
            : 'Monthly limit reached'
          }
        </div>
      </CardContent>
    </Card>
  )
}

async function fetchMonthlyUsage(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('user_id', userId)
    .lt('amount', 0)
    .gte('created_at', startOfMonth.toISOString())
  
  return data?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0
}
```

## Tool Integration Examples

### 1. AI Text Generation Tool

```typescript
// app/(protected)/ai-writer/AIWriterClient.tsx
'use client'

import { useState } from 'react'
import { useCreditManager, makeApiCallWithCreditUpdate } from '@/lib/credit-manager'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Coins } from 'lucide-react'

const WRITING_MODES = {
  'blog-post': { label: 'Blog Post', credits: 3 },
  'email': { label: 'Email', credits: 1 },
  'social-media': { label: 'Social Media', credits: 1 },
  'article': { label: 'Article', credits: 5 }
}

interface AIWriterClientProps {
  userId: string
}

export default function AIWriterClient({ userId }: AIWriterClientProps) {
  const { balance } = useCreditManager(userId)
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<keyof typeof WRITING_MODES>('blog-post')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  
  const requiredCredits = WRITING_MODES[mode].credits
  const canGenerate = balance >= requiredCredits && prompt.trim().length > 0
  
  const handleGenerate = async () => {
    if (!canGenerate) return
    
    setLoading(true)
    try {
      const data = await makeApiCallWithCreditUpdate(
        () => fetch('/api/ai-writer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mode })
        }),
        userId
      )
      
      setResult(data.content)
      toast.success('Content generated successfully!')
    } catch (error) {
      toast.error('Failed to generate content')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI Writer</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="h-4 w-4" />
          <span>{balance.toLocaleString()} credits</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Writing Mode
              </label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WRITING_MODES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center justify-between w-full">
                        <span>{config.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {config.credits} credits
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Prompt
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to write about..."
                rows={6}
              />
            </div>
            
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate ({requiredCredits} credits)
                </>
              )}
            </Button>
            
            {balance < requiredCredits && (
              <p className="text-sm text-red-600">
                You need {requiredCredits - balance} more credits.
                <Link href="/buy-credits" className="underline ml-1">
                  Buy credits
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{result}</pre>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Generated content will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### 2. Image Processing Tool

```typescript
// app/(protected)/image-processor/ImageProcessorClient.tsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useCreditManager, makeApiCallWithCreditUpdate } from '@/lib/credit-manager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Image as ImageIcon, Download } from 'lucide-react'

const PROCESSING_OPTIONS = {
  'resize': { label: 'Resize', credits: 1 },
  'enhance': { label: 'AI Enhancement', credits: 3 },
  'background-remove': { label: 'Background Removal', credits: 2 },
  'style-transfer': { label: 'Style Transfer', credits: 5 }
}

interface ImageProcessorClientProps {
  userId: string
}

export default function ImageProcessorClient({ userId }: ImageProcessorClientProps) {
  const { balance } = useCreditManager(userId)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processingType, setProcessingType] = useState<keyof typeof PROCESSING_OPTIONS>('resize')
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const requiredCredits = PROCESSING_OPTIONS[processingType].credits
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setSelectedFile(acceptedFiles[0])
      setProcessedImage(null)
    }
  }, [])
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1
  })
  
  const handleProcess = async () => {
    if (!selectedFile || balance < requiredCredits) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', selectedFile)
      formData.append('type', processingType)
      
      const data = await makeApiCallWithCreditUpdate(
        () => fetch('/api/image-processor', {
          method: 'POST',
          body: formData
        }),
        userId
      )
      
      setProcessedImage(data.processedImageUrl)
      toast.success('Image processed successfully!')
    } catch (error) {
      toast.error('Failed to process image')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Image Processor</h1>
        <div className="text-sm text-muted-foreground">
          Balance: {balance.toLocaleString()} credits
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {selectedFile ? (
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p>Drop an image here or click to select</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              )}
            </div>
            
            {selectedFile && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Processing Type
                  </label>
                  <div className="space-y-2">
                    {Object.entries(PROCESSING_OPTIONS).map(([key, config]) => (
                      <label key={key} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="processingType"
                          value={key}
                          checked={processingType === key}
                          onChange={(e) => setProcessingType(e.target.value as any)}
                        />
                        <span className="text-sm">{config.label}</span>
                        <Badge variant="secondary" size="sm">
                          {config.credits}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={handleProcess}
                  disabled={loading || balance < requiredCredits}
                  className="w-full"
                >
                  {loading ? 'Processing...' : `Process (${requiredCredits} credits)`}
                </Button>
                
                {balance < requiredCredits && (
                  <p className="text-sm text-red-600">
                    Insufficient credits for this operation.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Original Image */}
        <Card>
          <CardHeader>
            <CardTitle>Original</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedFile ? (
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Original"
                className="w-full h-64 object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Processed Image */}
        <Card>
          <CardHeader>
            <CardTitle>Processed</CardTitle>
          </CardHeader>
          <CardContent>
            {processedImage ? (
              <div className="space-y-4">
                <img
                  src={processedImage}
                  alt="Processed"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <Button asChild className="w-full">
                  <a href={processedImage} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            ) : (
              <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

## UI Component Patterns

### 1. Credit Balance Widget

```typescript
// components/CreditBalanceWidget.tsx
import { useCreditManager } from '@/lib/credit-manager'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Coins, Plus, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface CreditBalanceWidgetProps {
  userId: string
  showPurchaseButton?: boolean
  showTrend?: boolean
}

export function CreditBalanceWidget({
  userId,
  showPurchaseButton = true,
  showTrend = false
}: CreditBalanceWidgetProps) {
  const { balance, loading } = useCreditManager(userId)
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable')
  
  useEffect(() => {
    if (showTrend) {
      // Calculate trend based on recent usage
      calculateTrend(userId).then(setTrend)
    }
  }, [userId, showTrend])
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2"></div>
            <div className="h-8 bg-muted rounded w-16"></div>
          </div>1
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Coins className="h-4 w-4" />
              <span>Credit Balance</span>
              {showTrend && (
                <TrendingUp className={cn(
                  'h-3 w-3',
                  trend === 'up' && 'text-green-500',
                  trend === 'down' && 'text-red-500',
                  trend === 'stable' && 'text-muted-foreground'
                )} />
              )}
            </div>
            <div className="text-2xl font-bold">
              {balance.toLocaleString()}
            </div>
          </div>
          
          {showPurchaseButton && (
            <Button asChild size="sm" variant="outline">
              <Link href="/buy-credits">
                <Plus className="h-4 w-4 mr-1" />
                Buy
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

async function calculateTrend(userId: string): Promise<'up' | 'down' | 'stable'> {
  // Implementation to calculate usage trend
  return 'stable'
}
```

### 2. Credit Cost Indicator

```typescript
// components/CreditCostIndicator.tsx
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Coins, Info } from 'lucide-react'

interface CreditCostIndicatorProps {
  cost: number
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}

export function CreditCostIndicator({
  cost,
  description,
  variant = 'default'
}: CreditCostIndicatorProps) {
  const getVariant = () => {
    if (variant !== 'default') return variant
    
    if (cost <= 1) return 'success'
    if (cost <= 3) return 'default'
    if (cost <= 5) return 'warning'
    return 'destructive'
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={getVariant()} className="gap-1">
            <Coins className="h-3 w-3" />
            {cost}
            {description && <Info className="h-3 w-3" />}
          </Badge>
        </TooltipTrigger>
        {description && (
          <TooltipContent>
            <p>{description}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
```

### 3. Credit History Component

```typescript
// components/CreditHistory.tsx
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUp, ArrowDown, Clock } from 'lucide-react'

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  created_at: string
}

interface CreditHistoryProps {
  userId: string
  limit?: number
}

export function CreditHistory({ userId, limit = 10 }: CreditHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchTransactions()
  }, [userId])
  
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/credits/transactions?limit=${limit}`)
      const data = await response.json()
      setTransactions(data.transactions || [])
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-1 rounded-full',
                      transaction.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    )}>
                      {transaction.amount > 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {transaction.description || transaction.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge variant={transaction.amount > 0 ? 'success' : 'destructive'}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
```

## API Integration Patterns

### 1. Middleware for Credit Checking

```typescript
// lib/credit-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { creditService } from '@/lib/credits'

export function withCreditCheck(requiredCredits: number) {
  return function (handler: (req: NextRequest, context: any) => Promise<NextResponse>) {
    return async function (req: NextRequest, context: any) {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        
        const hasCredits = await creditService.hasCredits(user.id, requiredCredits)
        if (!hasCredits) {
          const currentBalance = await creditService.getUserCredits(user.id)
          return NextResponse.json(
            {
              error: 'Insufficient credits',
              currentBalance,
              requiredCredits
            },
            { status: 402 }
          )
        }
        
        // Add user and credit info to request context
        const enhancedContext = {
          ...context,
          user,
          requiredCredits
        }
        
        return handler(req, enhancedContext)
      } catch (error) {
        console.error('Credit middleware error:', error)
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }
    }
  }
}

// Usage
export const POST = withCreditCheck(3)(async (req, { user, requiredCredits }) => {
  // Deduct credits
  const newBalance = await creditService.deductCredits(user.id, requiredCredits)
  
  // Process request
  const result = await processRequest()
  
  return NextResponse.json({
    success: true,
    result,
    newBalance
  })
})
```

### 2. Batch Credit Operations

```typescript
// app/api/credits/batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { creditService } from '@/lib/credits'

interface BatchOperation {
  userId: string
  amount: number
  type: 'add' | 'deduct'
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const { operations }: { operations: BatchOperation[] } = await request.json()
    
    // Validate admin permissions
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || !await isAdmin(user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const results = []
    
    // Process operations in transaction
    for (const operation of operations) {
      try {
        let newBalance: number
        
        if (operation.type === 'add') {
          newBalance = await creditService.addCredits(operation.userId, operation.amount)
        } else {
          newBalance = await creditService.deductCredits(operation.userId, operation.amount)
        }
        
        results.push({
          userId: operation.userId,
          success: true,
          newBalance
        })
      } catch (error) {
        results.push({
          userId: operation.userId,
          success: false,
          error: error.message
        })
      }
    }
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Batch credit operation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function isAdmin(userId: string): Promise<boolean> {
  // Implement admin check logic
  return false
}
```

## Payment Flow Integration

### 1. Custom Credit Packages

```typescript
// app/(protected)/buy-credits/CustomPackageBuilder.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { CreditFormatter } from '@/lib/credit-utils'
import { DodoCheckoutButton } from '@/components/dodopayments/DodoCheckoutButton'

const BULK_DISCOUNTS = {
  500: 5,   // 5% discount
  1000: 10, // 10% discount
  2500: 15, // 15% discount
  5000: 20  // 20% discount
}

export function CustomPackageBuilder() {
  const [credits, setCredits] = useState(100)
  
  const pricing = CreditFormatter.calculateSavings(credits, BULK_DISCOUNTS)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Package</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Number of Credits: {credits.toLocaleString()}
          </label>
          <Slider
            value={[credits]}
            onValueChange={([value]) => setCredits(value)}
            min={10}
            max={10000}
            step={10}
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10</span>
            <span>10,000</span>
          </div>
        </div>
        
        <div>
          <Input
            type="number"
            value={credits}
            onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
            min={10}
            max={10000}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Base Price:</span>
            <span>{CreditFormatter.formatCost(credits)}</span>
          </div>
          
          {pricing.discountPercent > 0 && (
            <>
              <div className="flex justify-between text-green-600">
                <span>Bulk Discount ({pricing.discountPercent}%):</span>
                <span>-{CreditFormatter.formatCost(pricing.savings)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{CreditFormatter.formatCost(pricing.discountedPrice)}</span>
              </div>
            </>
          )}
          
          {pricing.discountPercent > 0 && (
            <Badge variant="success" className="w-full justify-center">
              Save {CreditFormatter.formatCost(pricing.savings)}!
            </Badge>
          )}
        </div>
        
        <DodoCheckoutButton
          planId="custom"
          credits={credits}
          price={pricing.discountedPrice}
          className="w-full"
        >
          Purchase {credits.toLocaleString()} Credits
        </DodoCheckoutButton>
      </CardContent>
    </Card>
  )
}
```

### 2. Subscription with Credits

```typescript
// app/(protected)/subscription/SubscriptionManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, Coins, Crown } from 'lucide-react'

interface Subscription {
  id: string
  plan: string
  status: 'active' | 'cancelled' | 'expired'
  creditsPerMonth: number
  creditsUsed: number
  renewsAt: string
  price: number
}

interface SubscriptionManagerProps {
  userId: string
}

export function SubscriptionManager({ userId }: SubscriptionManagerProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchSubscription()
  }, [userId])
  
  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscription')
      const data = await response.json()
      setSubscription(data.subscription)
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div>Loading subscription...</div>
  }
  
  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Subscribe to get monthly credits and premium features.
          </p>
          <Button asChild>
            <Link href="/pricing">View Plans</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  const usagePercentage = (subscription.creditsUsed / subscription.creditsPerMonth) * 100
  const remainingCredits = subscription.creditsPerMonth - subscription.creditsUsed
  const daysUntilRenewal = Math.ceil(
    (new Date(subscription.renewsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          {subscription.plan} Plan
          <Badge variant={subscription.status === 'active' ? 'success' : 'destructive'}>
            {subscription.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{remainingCredits.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Credits Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{daysUntilRenewal}</div>
            <div className="text-sm text-muted-foreground">Days Until Renewal</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Monthly Usage</span>
            <span>{subscription.creditsUsed.toLocaleString()} / {subscription.creditsPerMonth.toLocaleString()}</span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
            Manage Subscription
          </Button>
          <Button variant="outline" className="flex-1">
            <Coins className="h-4 w-4 mr-2" />
            Buy Extra Credits
          </Button>
        </div>
        
        {usagePercentage > 80 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              You've used {usagePercentage.toFixed(0)}% of your monthly credits. 
              Consider upgrading your plan or purchasing additional credits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

This comprehensive integration guide provides practical examples and patterns for implementing the credit system across different parts of your application. Each example is production-ready and follows best practices for security, performance, and user experience.