# Authentication System Documentation

The authentication system in Hyperfy provides a React Context-based authentication solution that manages user sessions and access control throughout the application.

## Components

### AuthProvider

```javascript
function AuthProvider({ children })
```

A React Context Provider component that wraps the application and provides authentication state and methods to all child components.

#### Usage
```javascript
import { AuthProvider } from './components/AuthProvider'

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  )
}
```

### useAuthContext Hook

```javascript
function useAuthContext()
```

A custom hook that provides access to the authentication context in any child component.

#### Usage
```javascript
import { useAuthContext } from './components/AuthProvider'

function SecureComponent() {
  const auth = useAuthContext()
  
  if (!auth.isAuthenticated) {
    return <div>Please log in</div>
  }
  
  return <div>Secure content</div>
}
```

## Authentication Context

The authentication context provides the following state and methods through the `useAuth` hook:

```javascript
interface AuthContext {
  // State
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  error: Error | null
  
  // Methods
  login: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
  signup: (userData: UserData) => Promise<void>
  resetPassword: (email: string) => Promise<void>
}
```

## Security Features

- Context-based authentication state management
- Secure token handling
- Session persistence
- Protected route handling

## Integration with HyperfoneOS

The authentication system integrates with the HyperfoneOS to:
- Control access to system features
- Manage user sessions
- Handle secure app launches
- Protect sensitive data

## Best Practices

1. Always use the `useAuthContext` hook to access authentication state
2. Implement protected routes using the authentication state
3. Handle loading and error states appropriately
4. Clear sensitive data on logout

## Example Implementation

```javascript
import { useAuthContext } from './components/AuthProvider'

function ProtectedApp() {
  const { isAuthenticated, user, login, logout } = useAuthContext()

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <button onClick={() => login(credentials)}>
          Login to HyperFone OS
        </button>
      </div>
    )
  }

  return (
    <div className="secure-app">
      <header>
        Welcome {user.name}
        <button onClick={logout}>Logout</button>
      </header>
      <main>
        {/* Protected content */}
      </main>
    </div>
  )
}
```

## Error Handling

The authentication system provides comprehensive error handling:

```javascript
try {
  await login(credentials)
} catch (error) {
  // Handle specific error types
  switch (error.code) {
    case 'auth/invalid-credentials':
      // Handle invalid credentials
      break
    case 'auth/network-error':
      // Handle network issues
      break
    default:
      // Handle other errors
  }
}
``` 