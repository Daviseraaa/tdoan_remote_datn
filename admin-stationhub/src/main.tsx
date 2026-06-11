import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import '@xyflow/react/dist/style.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
});

const app = (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{app}</StrictMode>,
);
