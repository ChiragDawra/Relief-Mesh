import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { DemoBanner, DemoFooter } from '../components/DemoBanner';
import { LoginPage } from '../features/auth/LoginPage';
import { CaseDetailPage } from '../features/cases/CaseDetailPage';
import { CaseListPage } from '../features/cases/CaseListPage';
import { NewCasePage } from '../features/cases/NewCasePage';
import { OverviewPage } from '../features/overview/OverviewPage';
import { PublicCasePage } from '../features/public/PublicCasePage';
import { ApiClientError } from '../lib/api';
import { AuthProvider } from '../lib/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Retry only transient failures (network / 5xx), never auth or validation errors.
      retry: (count, error) =>
        count < 2 && (!(error instanceof ApiClientError) || error.status === 0 || error.status >= 500),
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/public/cases/:publicRef', element: <PublicCasePage /> },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'cases', element: <CaseListPage title="Cases" /> },
      { path: 'cases/new', element: <NewCasePage /> },
      { path: 'cases/:caseId', element: <CaseDetailPage /> },
      { path: 'review', element: <CaseListPage title="Review queue" status="under_review" /> },
    ],
  },
  { path: '*', element: <Navigate to="/app/overview" replace /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-canvas text-ink">
          <DemoBanner />
          <main className="flex-1">
            <RouterProvider router={router} />
          </main>
          <DemoFooter />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}
