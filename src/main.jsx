    import { StrictMode } from 'react'
    import { createRoot } from 'react-dom/client'
    import './index.css'
    import App from './App.jsx'
    import { AuthProvider } from './layout/AuthContext.jsx'

    createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AuthProvider>
        <App />
        </AuthProvider>
    </StrictMode>

    )
