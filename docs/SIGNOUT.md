# Sign Out Feature Documentation

This document explains the sign-out functionality implemented in the dashboard.

## Overview

The sign-out feature allows authenticated users to securely log out from their account using either:
1. **Sidebar User Menu** - Located in the bottom of the sidebar
2. **Header User Menu** - Located in the top-right corner of the dashboard

## Implementation Details

### Server Action

The sign-out functionality is implemented as a server action in `app/auth/signout/actions.ts`:

```typescript
export async function signOut() {
  const supabase = await createClient()
  
  // Sign out from Supabase Auth
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    return { error: 'Failed to sign out. Please try again.' }
  }
  
  // Clear cached data and redirect
  revalidatePath('/', 'layout')
  redirect('/')
}
```

### Components Updated

1. **NavUser Component** (`components/blog-writer/nav-user.tsx`)
   - Added functional sign-out to the sidebar user menu
   - Styled with red text to indicate destructive action

2. **HeaderUser Component** (`components/blog-writer/header-user.tsx`)
   - Added functional sign-out to the header user menu
   - Consistent styling with sidebar implementation

3. **AppSidebar Component** (`components/blog-writer/app-sidebar.tsx`)
   - Updated to accept real user data as props
   - Displays actual user information instead of hardcoded data

4. **Dashboard Layout** (`app/(protected)/layout.tsx`)
   - Passes authenticated user data to both sidebar and header components
   - Ensures consistent user information across the dashboard

## User Experience

### Sign Out Process
1. User clicks "Log out" from either menu location
2. Server action executes sign-out with Supabase
3. User session is terminated (global scope by default)
4. Cache is cleared and user is redirected to home page
5. User is now logged out and can no longer access protected routes

### Visual Indicators
- Log out menu items are styled in red to indicate destructive action
- Consistent LogOut icon from Lucide React
- Hover states provide clear interaction feedback

## Sign Out Scopes

The implementation supports different sign-out scopes:

- **Global** (default): Terminates all sessions for the user
- **Local**: Only terminates the current session
- **Others**: Terminates all but the current session

To use different scopes, call the alternative function:

```typescript
import { signOutWithScope } from '@/app/auth/signout/actions'

// Sign out from current session only
await signOutWithScope('local')
```

## Security Features

- Server-side session termination
- Automatic cache invalidation
- Secure redirect after sign-out
- Error handling for failed sign-out attempts
- No sensitive data exposure in client-side code

## Error Handling

The sign-out action includes comprehensive error handling:
- Catches Supabase authentication errors
- Provides user-friendly error messages
- Logs errors for debugging (without sensitive data)
- Graceful fallback behavior

## Testing

1. **Functional Testing**:
   - Sign in to the dashboard
   - Click "Log out" from sidebar menu
   - Verify redirect to home page
   - Attempt to access dashboard (should redirect to login)

2. **Cross-Component Testing**:
   - Test sign-out from both sidebar and header menus
   - Verify consistent behavior across both locations
   - Check user data display accuracy

## Future Enhancements

- Add confirmation dialog for sign-out action
- Implement "Sign out from all devices" option
- Add loading states during sign-out process
- Include sign-out analytics/logging