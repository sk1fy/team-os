import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { CreateCompanyPage } from '@/pages/auth/CreateCompanyPage';
import { InvitePage } from '@/pages/auth/InvitePage';

export function App() {
  return (
    <Routes>
      {/* Основное приложение */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/structure" element={<Navigate to="/employees" replace />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeeProfilePage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/academy" element={<AcademyPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Аутентификация */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route index element={<Navigate to="/auth/login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="create-company" element={<CreateCompanyPage />} />
        <Route path="invite/:token" element={<InvitePage />} />
      </Route>

      <Route path="/learn/:courseId" element={<LearnPage />} />
      <Route path="/share/article/:articleId" element={<ShareArticlePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
