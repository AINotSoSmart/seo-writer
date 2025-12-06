# Dynamic Breadcrumb System Documentation

This boilerplate includes a smart dynamic breadcrumb navigation system that automatically generates breadcrumb trails based on the current route structure.

## Overview

The dynamic breadcrumb system replaces static breadcrumb navigation with an intelligent component that:
- **Auto-detects current route** and generates appropriate breadcrumb trails
- **Provides clickable navigation** for each breadcrumb segment
- **Supports custom display names** for technical route names
- **Maintains consistent styling** with the existing design system
- **Updates in real-time** as users navigate between pages

## File Structure

```
components/
└── dashboard/
    └── dynamic-breadcrumb.tsx    # Dynamic breadcrumb component
app/
└── (protected)/
    └── layout.tsx                 # Layout integration
```

## Component Details

### Dynamic Breadcrumb Component (`components/blog-writer/dynamic-breadcrumb.tsx`)

#### Core Features

1. **Automatic Path Detection**
   - Uses `usePathname()` from Next.js navigation
   - Splits current path into navigable segments
   - Filters out empty segments and route groups

2. **Smart Display Names**
   - Maps technical route names to user-friendly labels
   - Supports custom naming for any route segment
   - Falls back to capitalized route names

3. **Navigation Integration**
   - Each breadcrumb segment is clickable
   - Proper Next.js Link integration for client-side navigation
   - Home icon links to dashboard root

#### Display Name Mapping

```typescript
const getDisplayName = (segment: string): string => {
  const displayNames: Record<string, string> = {
    'demo-tool': 'Demo Tool',
    'dashboard': 'Dashboard',
    'settings': 'Settings',
    'reports': 'Reports',
    // Add your custom mappings here
  };
  
  return displayNames[segment] || 
         segment.charAt(0).toUpperCase() + segment.slice(1);
};
```

#### Current Implementation

```typescript
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  
  // Split path and filter out empty segments and route groups
  const segments = pathname.split('/').filter(segment => 
    segment && !segment.startsWith('(') && !segment.endsWith(')')
  );
  
  const getDisplayName = (segment: string): string => {
    const displayNames: Record<string, string> = {
      'demo-tool': 'Demo Tool',
      'dashboard': 'Dashboard',
      'settings': 'Settings',
      'reports': 'Reports',
    };
    
    return displayNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
  };
  
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/blog-writer" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/');
          const isLast = index === segments.length - 1;
          const displayName = getDisplayName(segment);
          
          return (
            <div key={segment} className="flex items-center gap-2">
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{displayName}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{displayName}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

## Integration

### Layout Integration (`app/(protected)/layout.tsx`)

The dynamic breadcrumb replaces the static breadcrumb in the protected layout:

```typescript
import { DynamicBreadcrumb } from '@/dashboarddynamic-breadcrumb';

// In the layout component
<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
  <DynamicBreadcrumb />
  {/* Rest of layout content */}
</div>
```

## Usage Examples

### Route Examples

| Current URL | Generated Breadcrumb |
|-------------|---------------------|
| `/blog-writer` | Home |
| `/demo-tool` | Home > Demo Tool |
| `/settings` | Home > Settings |
| `/reports` | Home > Reports |
| `/settings/profile` | Home > Settings > Profile |
| `/reports/analytics` | Home > Reports > Analytics |

### Navigation Behavior

- **Home Icon**: Always links to `/blog-writer`
- **Intermediate Segments**: Clickable links to parent routes
- **Current Page**: Non-clickable, styled as current page
- **Real-time Updates**: Breadcrumb updates automatically on route changes

## Customization

### Adding Custom Display Names

Update the `displayNames` object in the component:

```typescript
const getDisplayName = (segment: string): string => {
  const displayNames: Record<string, string> = {
    'demo-tool': 'Demo Tool',
    'dashboard': 'Dashboard',
    'settings': 'Settings',
    'reports': 'Reports',
    // Add your custom mappings
    'user-management': 'User Management',
    'api-keys': 'API Keys',
    'billing': 'Billing & Subscription',
    'analytics': 'Analytics Dashboard',
  };
  
  return displayNames[segment] || 
         segment.charAt(0).toUpperCase() + segment.slice(1);
};
```

### Changing Home Link Destination

```typescript
<BreadcrumbLink asChild>
  <Link href="/custom-home" className="flex items-center gap-1">
    <Home className="h-4 w-4" />
    Home
  </Link>
</BreadcrumbLink>
```

### Custom Icons

Replace the Home icon or add custom icons for specific routes:

```typescript
import { Home, Settings, BarChart, Tool } from 'lucide-react';

const getIcon = (segment: string) => {
  const icons: Record<string, React.ReactNode> = {
    'settings': <Settings className="h-4 w-4" />,
    'reports': <BarChart className="h-4 w-4" />,
    'demo-tool': <Tool className="h-4 w-4" />,
  };
  
  return icons[segment];
};

// In the breadcrumb rendering
<BreadcrumbLink asChild>
  <Link href={href} className="flex items-center gap-1">
    {getIcon(segment)}
    {displayName}
  </Link>
</BreadcrumbLink>
```

### Styling Customization

#### Custom Separator

```typescript
<BreadcrumbSeparator>
  <span className="text-muted-foreground">/</span>
</BreadcrumbSeparator>
```

#### Custom Link Styling

```typescript
<BreadcrumbLink asChild>
  <Link 
    href={href} 
    className="hover:text-primary transition-colors duration-200 font-medium"
  >
    {displayName}
  </Link>
</BreadcrumbLink>
```

#### Current Page Styling

```typescript
<BreadcrumbPage className="font-semibold text-foreground">
  {displayName}
</BreadcrumbPage>
```

## Advanced Features

### Conditional Breadcrumb Display

Hide breadcrumbs on certain pages:

```typescript
export function DynamicBreadcrumb() {
  const pathname = usePathname();
  
  // Hide breadcrumb on specific pages
  const hiddenPaths = ['/blog-writer', '/login', '/signup'];
  if (hiddenPaths.includes(pathname)) {
    return null;
  }
  
  // Rest of component logic
}
```

### Maximum Breadcrumb Length

Limit the number of breadcrumb segments:

```typescript
const segments = pathname.split('/').filter(segment => 
  segment && !segment.startsWith('(') && !segment.endsWith(')')
).slice(0, 4); // Limit to 4 segments
```

### Breadcrumb with Ellipsis

For very long paths, show ellipsis:

```typescript
const renderBreadcrumbs = () => {
  if (segments.length <= 3) {
    return segments.map(/* normal rendering */);
  }
  
  return [
    segments[0], // First segment
    '...', // Ellipsis
    ...segments.slice(-2) // Last 2 segments
  ].map(/* rendering logic */);
};
```

### Dynamic Breadcrumb with Metadata

Fetch page titles from API or metadata:

```typescript
const [pageTitles, setPageTitles] = useState<Record<string, string>>({});

useEffect(() => {
  // Fetch page metadata
  const fetchPageTitles = async () => {
    const titles = await getPageTitles(segments);
    setPageTitles(titles);
  };
  
  fetchPageTitles();
}, [segments]);

const getDisplayName = (segment: string): string => {
  return pageTitles[segment] || 
         displayNames[segment] || 
         segment.charAt(0).toUpperCase() + segment.slice(1);
};
```

## Route Group Handling

The component automatically filters out Next.js route groups (folders wrapped in parentheses):

```typescript
// Route: /blog-writer/(admin)/users
// Breadcrumb: Home > Dashboard > Users
// The (admin) group is automatically filtered out

const segments = pathname.split('/').filter(segment => 
  segment && !segment.startsWith('(') && !segment.endsWith(')')
);
```

## Best Practices

### 1. Display Names
- **Be Consistent**: Use consistent naming conventions across your app
- **User-Friendly**: Use terms your users understand, not technical jargon
- **Concise**: Keep breadcrumb labels short and descriptive

### 2. Navigation Structure
- **Logical Hierarchy**: Ensure your route structure reflects logical navigation
- **Clickable Parents**: All parent routes should be navigable
- **Meaningful URLs**: Use descriptive route segments

### 3. Performance
- **Client-Side Only**: The component uses `usePathname()` and must be client-side
- **Minimal Re-renders**: The component only re-renders when pathname changes
- **Efficient Filtering**: Route filtering is optimized for performance

## Troubleshooting

### Common Issues

#### Breadcrumb Not Updating
1. Ensure the component is marked with `'use client'`
2. Check if `usePathname()` is working correctly
3. Verify Next.js navigation is being used (not window.location)

#### Wrong Display Names
1. Check the `displayNames` mapping object
2. Verify the route segment matches the key exactly
3. Ensure fallback logic is working

#### Styling Issues
1. Verify Tailwind CSS classes are available
2. Check if custom CSS is overriding breadcrumb styles
3. Ensure proper import of UI components

#### Route Groups Showing
1. Check the filter logic for parentheses
2. Verify route group naming follows Next.js conventions
3. Update filter logic if using custom route group patterns

### Debug Mode

Add logging to debug breadcrumb generation:

```typescript
export function DynamicBreadcrumb() {
  const pathname = usePathname();
  
  console.log('Current pathname:', pathname);
  
  const segments = pathname.split('/').filter(segment => 
    segment && !segment.startsWith('(') && !segment.endsWith(')')
  );
  
  console.log('Filtered segments:', segments);
  
  // Rest of component logic
}
```

## Migration Guide

### From Static Breadcrumbs

1. **Remove Static Breadcrumb**: Delete hardcoded breadcrumb JSX from layout
2. **Import Dynamic Component**: Add import for `DynamicBreadcrumb`
3. **Update Layout**: Replace static breadcrumb with `<DynamicBreadcrumb />`
4. **Configure Display Names**: Add mappings for your routes

### Adding to Existing Projects

1. **Install Dependencies**: Ensure you have the required UI components
2. **Create Component**: Copy the `DynamicBreadcrumb` component
3. **Update Layout**: Integrate into your layout component
4. **Test Navigation**: Verify breadcrumbs work across all routes

## API Reference

### Props

The `DynamicBreadcrumb` component currently accepts no props but can be extended:

```typescript
interface DynamicBreadcrumbProps {
  homeHref?: string;           // Custom home link destination
  maxSegments?: number;        // Maximum number of segments to show
  showHome?: boolean;          // Whether to show home link
  customDisplayNames?: Record<string, string>; // Additional display name mappings
}
```

### Extending the Component

```typescript
export function DynamicBreadcrumb({ 
  homeHref = '/blog-writer',
  maxSegments = 5,
  showHome = true,
  customDisplayNames = {}
}: DynamicBreadcrumbProps) {
  // Component implementation with props support
}
```

This dynamic breadcrumb system provides an intelligent, maintainable navigation solution that automatically adapts to your application's route structure while remaining highly customizable for specific needs.