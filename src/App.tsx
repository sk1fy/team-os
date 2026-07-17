import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/auth/AuthBootstrap';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AcademyPage } from '@/pages/academy/AcademyPage';
import { LearnPage } from '@/pages/academy/LearnPage';
import { KnowledgePage } from '@/pages/knowledge/KnowledgePage';
import { ShareArticlePage } from '@/pages/knowledge/ShareArticlePage';
import { TasksPage } from '@/pages/tasks/TasksPage';
import { SchedulePage } from '@/pages/schedule/SchedulePage';
import { EmployeesPage } from '@/pages/employees/EmployeesPage';
import { EmployeeProfilePage } from '@/pages/employees/EmployeeProfilePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { InvitePage } from '@/pages/auth/InvitePage';
import { AccessLinkPage } from '@/pages/auth/AccessLinkPage';
import { DistributionPage } from '@/pages/distribution/DistributionPage';
import { DistributionGroupPage } from '@/pages/distribution/DistributionGroupPage';
import { authApi } from '@/api';
import { canAccessRoute, employeeHomePath } from '@/lib/permissions';

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
  );
}
