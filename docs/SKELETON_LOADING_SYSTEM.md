# Skeleton Loading System Documentation

This boilerplate includes a sophisticated page-level skeleton loading system that provides a professional loading experience across all protected pages.

## Overview

The skeleton loading system consists of three main components:
- **Page Skeleton Components** - Reusable skeleton layouts
- **Loading Provider** - Smart context-based loading management
- **Layout Integration** - Seamless integration with the protected layout

## File Structure

```
components/
├── ui/page-skeleton.tsx          # Skeleton components
├── loading-provider.tsx          # Loading context and provider
app/
└── (protected)/
    └── layout.tsx                 # Layout integration
```

## Components

### 1. Page Skeleton Components (`components/ui/page-skeleton.tsx`)

Three different skeleton layouts are available:

#### `PageSkeleton`
- **Use Case**: Complex pages with multiple content sections
- **Layout**: Header + 3 content blocks + grid layout
- **Best For**: Dashboard pages, analytics pages

#### `SimplePageSkeleton`
- **Use Case**: Simple pages with basic content
- **Layout**: Header + 2 content blocks
- **Best For**: Settings pages, profile pages

#### `ListPageSkeleton`
- **Use Case**: Pages with list-based content
- **Layout**: Header + 5 list items
- **Best For**: Data tables, item lists, reports

### 2. Loading Provider (`components/loading-provider.tsx`)

#### Features
- **Smart Page Detection**: Automatically detects current page and shows appropriate skeleton
- **Manual Control**: Provides hooks for manual loading state management
- **Context-Based**: Uses React Context for global loading state

#### Page Mapping
```typescript
const getSkeletonForPath = (pathname: string) => {
  if (pathname.includes('/reports')) return 'list';
  if (pathname.includes('/settings')) return 'simple';
  return 'default'; // PageSkeleton for dashboard and other pages
};
```

#### Available Hooks

##### `useLoading()`
Returns the current loading state:
```typescript
const { isLoading } = useLoading();
```

##### `usePageLoading()`
Provides manual control over loading state:
```typescript
const { startLoading, stopLoading, isLoading } = usePageLoading();

// Start loading
startLoading();

// Stop loading
stopLoading();
```

### 3. Layout Integration (`app/(protected)/layout.tsx`)

The `LoadingProvider` wraps all protected pages:
```typescript
<LoadingProvider>
  {children}
</LoadingProvider>
```

## Usage Examples

### Automatic Loading (Recommended)

The system automatically shows skeletons based on the current route. No additional code needed.

### Manual Loading Control

```typescript
'use client';

import { usePageLoading } from '@/components/loading-provider';

export default function MyPage() {
  const { startLoading, stopLoading, isLoading } = usePageLoading();

  const handleDataFetch = async () => {
    startLoading();
    try {
      await fetchData();
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      {/* Your page content */}
    </div>
  );
}
```

## Customization

### Adding New Skeleton Types

1. **Create New Skeleton Component** in `components/ui/page-skeleton.tsx`:
```typescript
export function CustomPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Your custom skeleton layout */}
    </div>
  );
}
```

2. **Update Loading Provider** in `components/loading-provider.tsx`:
```typescript
// Add to skeleton mapping
const getSkeletonForPath = (pathname: string) => {
  if (pathname.includes('/custom')) return 'custom';
  // ... existing mappings
};

// Add to render logic
const renderSkeleton = () => {
  switch (skeletonType) {
    case 'custom':
      return <CustomPageSkeleton />;
    // ... existing cases
  }
};
```

### Modifying Existing Skeletons

Edit the skeleton components in `components/ui/page-skeleton.tsx`:

```typescript
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Modify layout as needed */}
      <Skeleton className="h-8 w-[250px]" />
      {/* Add/remove skeleton elements */}
    </div>
  );
}
```

### Changing Page Mappings

Update the path detection logic in `components/loading-provider.tsx`:

```typescript
const getSkeletonForPath = (pathname: string) => {
  if (pathname.includes('/analytics')) return 'list';
  if (pathname.includes('/profile')) return 'simple';
  if (pathname.includes('/blog-writer')) return 'default';
  // Add your custom mappings
  return 'default';
};
```

## Best Practices

### 1. Skeleton Design
- **Match Content Structure**: Skeletons should closely match the actual content layout
- **Consistent Spacing**: Use the same spacing as your actual components
- **Appropriate Sizes**: Skeleton elements should approximate real content dimensions

### 2. Loading Duration
- **Minimum Duration**: Consider showing skeletons for at least 300ms to avoid flashing
- **Maximum Duration**: Don't show skeletons for more than 3-5 seconds
- **Progressive Loading**: For long operations, consider progressive disclosure

### 3. Performance
- **Avoid Over-Animation**: Too many animated skeletons can impact performance
- **Lazy Loading**: Only render skeletons when actually needed
- **Memory Management**: Properly clean up loading states

## Troubleshooting

### Common Issues

#### Skeleton Not Showing
1. Check if `LoadingProvider` is properly wrapped around your content
2. Verify the path mapping in `getSkeletonForPath`
3. Ensure you're calling `startLoading()` when needed

#### Wrong Skeleton Type
1. Check the path detection logic in `getSkeletonForPath`
2. Verify the current pathname matches your expected pattern

#### Loading State Stuck
1. Ensure you're calling `stopLoading()` in all code paths
2. Check for unhandled errors that might prevent `stopLoading()` execution
3. Use try/finally blocks for reliable cleanup

### Debug Mode

Add console logging to debug skeleton selection:

```typescript
const getSkeletonForPath = (pathname: string) => {
  console.log('Current pathname:', pathname);
  const skeletonType = /* your logic */;
  console.log('Selected skeleton:', skeletonType);
  return skeletonType;
};
```

## Migration Guide

### From Component-Level Skeletons

If you have existing component-level skeleton loading:

1. **Remove Component Skeletons**: Delete skeleton imports and loading states from individual components
2. **Use Page-Level Loading**: Implement `usePageLoading()` hook instead
3. **Update Loading Logic**: Move loading state management to page level

### Adding to Existing Pages

1. **Wrap with LoadingProvider**: Ensure your page is wrapped by the provider
2. **Add Path Mapping**: Update `getSkeletonForPath` for your new pages
3. **Implement Loading Hooks**: Use `usePageLoading()` for manual control

## Advanced Features

### Conditional Skeleton Loading

```typescript
const { startLoading, stopLoading } = usePageLoading();

// Only show skeleton for slow operations
const handleSlowOperation = async () => {
  const startTime = Date.now();
  
  const data = await fetchData();
  
  // Only show skeleton if operation takes more than 500ms
  if (Date.now() - startTime > 500) {
    startLoading();
    await processData(data);
    stopLoading();
  }
};
```

### Skeleton with Error States

```typescript
const { startLoading, stopLoading } = usePageLoading();
const [error, setError] = useState(null);

const handleDataFetch = async () => {
  startLoading();
  setError(null);
  
  try {
    await fetchData();
  } catch (err) {
    setError(err.message);
  } finally {
    stopLoading();
  }
};
```

This skeleton loading system provides a professional, consistent loading experience across your entire application while remaining flexible and customizable for your specific needs.