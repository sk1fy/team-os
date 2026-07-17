import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/auth/AuthBootstrap';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { authApi } from '@/api';
import { canAccessRoute, employeeHomePath } from '@/lib/permissions';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const AcademyPage = lazy(() =>
  import('@/pages/academy/AcademyPage').then((module) => ({ default: module.AcademyPage })),
);
const LearnPage = lazy(() =>
  import('@/pages/academy/LearnPage').then((module) => ({ default: module.LearnPage })),
);
const KnowledgePage = lazy(() =>
  import('@/pages/knowledge/KnowledgePage').then((module) => ({ default: module.KnowledgePage })),
);
const ShareArticlePage = lazy(() =>
  import('@/pages/knowledge/ShareArticlePage').then((module) => ({
    default: module.ShareArticlePage,
  })),
);
const TasksPage = lazy(() =>
  import('@/pages/tasks/TasksPage').then((module) => ({ default: module.TasksPage })),
);
const SchedulePage = lazy(() =>
  import('@/pages/schedule/SchedulePage').then((module) => ({ default: module.SchedulePage })),
);
const EmployeesPage = lazy(() =>
  import('@/pages/employees/EmployeesPage').then((module) => ({ default: module.EmployeesPage })),
);
const EmployeeProfilePage = lazy(() =>
  import('@/pages/employees/EmployeeProfilePage').then((module) => ({
    default: module.EmployeeProfilePage,
  })),
);
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const InvitePage = lazy(() =>
  import('@/pages/auth/InvitePage').then((module) => ({ default: module.InvitePage })),
);
const AccessLinkPage = lazy(() =>
  import('@/pages/auth/AccessLinkPage').then((module) => ({ default: module.AccessLinkPage })),
);
const DistributionPage = lazy(() =>
  import('@/pages/distribution/DistributionPage').then((module) => ({
    default: module.DistributionPage,
  })),
);
const DistributionGroupPage = lazy(() =>
  import('@/pages/distribution/DistributionGroupPage').then((module) => ({
    default: module.DistributionGroupPage,
  })),
);

function RequireModule({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });
  if (currentUser && !canAccessRoute(currentUser.role, pathname)) {
    return <Navigate to={employeeHomePath} replace />;
  }
  return children;
}

export function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
          Загружаем раздел…
        </div>
      }
    >
      <Routes>
        {/* Основное приложение */}
        <Route
          element={
            <RequireAuth>
              <RequireModule>
                <AppLayout />
              </RequireModule>
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/structure" element={<Navigate to="/employees" replace />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeProfilePage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/distribution" element={<DistributionPage />} />
          <Route path="/distribution/:groupId" element={<DistributionGroupPage />} />
          <Route path="/academy" element={<AcademyPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Аутентификация */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="/auth/login" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="create-company" element={<Navigate to="/auth/register" replace />} />
          <Route path="invite/:token" element={<InvitePage />} />
        </Route>

        <Route path="/learn/:courseId" element={<LearnPage />} />
        <Route path="/share/article/:articleId" element={<ShareArticlePage />} />
        <Route path="/access/:token" element={<AccessLinkPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
