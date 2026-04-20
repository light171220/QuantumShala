import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import { Amplify } from 'aws-amplify'
import '@aws-amplify/ui-react/styles.css'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import App from './App'
import './index.css'

import amplifyOutputs from '../amplify_outputs.json'

const isPlaceholder = amplifyOutputs.auth?.user_pool_id?.includes('PLACEHOLDER')
if (isPlaceholder) {
  console.warn('⚠️ Amplify not deployed. Run `npx ampx sandbox` to set up the backend.')
} else {
  Amplify.configure(amplifyOutputs)
  console.log('✅ Amplify backend connected')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid rgba(255,255,255,0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#f1f5f9',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f1f5f9',
                },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
