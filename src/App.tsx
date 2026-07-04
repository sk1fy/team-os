import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import {
  AcademyPage,
  EmployeesPage,
  KnowledgePage,
  SettingsPage,
  StructurePage,
  TasksPage,
} from '@/pages/modules';
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
        <Route path="/structure" element={<StructurePage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeesPage />} />
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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
