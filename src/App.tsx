import { queryKeys } from '@/api/queryKeys';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/auth/AuthBootstrap';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { authApi } from '@/api';
import { canAccessRoute, canManageIntegrations, employeeHomePath } from '@/lib/permissions';
import { isAcademyV2Enabled } from '@/lib/academy';

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
const AcademyOpusPage = lazy(() =>
  import('@/pages/academy-opus/AcademyOpusPage').then((module) => ({
    default: module.AcademyOpusPage,
  })),
);
const CourseBuilderPageOpus = lazy(() =>
  import('@/pages/academy-opus/CourseBuilderPage').then((module) => ({
    default: module.CourseBuilderPage,
  })),
);
const LearnOpusPage = lazy(() =>
  import('@/pages/academy-opus/LearnOpusPage').then((module) => ({
    default: module.LearnOpusPage,
  })),
);
const AcademyGrokHomePage = lazy(() =>
  import('@/pages/academy-grok/AcademyGrokHomePage').then((module) => ({
    default: module.AcademyGrokHomePage,
  })),
);
const AcademyGrokCatalogPage = lazy(() =>
  import('@/pages/academy-grok/AcademyGrokCatalogPage').then((module) => ({
    default: module.AcademyGrokCatalogPage,
  })),
);
const AcademyGrokCoursePage = lazy(() =>
  import('@/pages/academy-grok/AcademyGrokCoursePage').then((module) => ({
    default: module.AcademyGrokCoursePage,
  })),
);
const AcademyGrokReportsPage = lazy(() =>
  import('@/pages/academy-grok/AcademyGrokReportsPage').then((module) => ({
    default: module.AcademyGrokReportsPage,
  })),
);
const AcademyGrokLearnPage = lazy(() =>
  import('@/pages/academy-grok/AcademyGrokLearnPage').then((module) => ({
    default: module.AcademyGrokLearnPage,
  })),
);
const AcademyGrokBuilderPage = lazy(() =>
  import('@/pages/academy-grok/AcademyGrokBuilderPage').then((module) => ({
    default: module.AcademyGrokBuilderPage,
  })),
);

// Academy V2
const AcademyLayout = lazy(() =>
  import('@/pages/academy/AcademyLayout').then((module) => ({ default: module.AcademyLayout })),
);
const AcademyHomePage = lazy(() =>
  import('@/pages/academy/AcademyHomePage').then((module) => ({ default: module.AcademyHomePage })),
);
const AcademyCatalogPage = lazy(() =>
  import('@/pages/academy/AcademyCatalogPage').then((module) => ({
    default: module.AcademyCatalogPage,
  })),
);
const AcademyCoursesPage = lazy(() =>
  import('@/pages/academy/AcademyCoursesPage').then((module) => ({
    default: module.AcademyCoursesPage,
  })),
);
const CourseWorkspacePage = lazy(() =>
  import('@/pages/academy/course/CourseWorkspacePage').then((module) => ({
    default: module.CourseWorkspacePage,
  })),
);
const CourseVersionsPage = lazy(() =>
  import('@/pages/academy/course/CourseWorkspacePage').then((module) => ({
    default: module.CourseVersionsPage,
  })),
);
const CourseDistributionPage = lazy(() =>
  import('@/pages/academy/course/CourseWorkspacePage').then((module) => ({
    default: module.CourseDistributionPage,
  })),
);
const CourseReportsPage = lazy(() =>
  import('@/pages/academy/course/CourseWorkspacePage').then((module) => ({
    default: module.CourseReportsPage,
  })),
);
const AcademyV2BuilderPage = lazy(() =>
  import('@/pages/academy/builder/CourseBuilderPage').then((module) => ({
    default: module.CourseBuilderPage,
  })),
);
const InternalEnrollmentPlayerPage = lazy(() =>
  import('@/pages/academy/player/InternalEnrollmentPlayerPage').then((module) => ({
    default: module.InternalEnrollmentPlayerPage,
  })),
);
const LegacyCourseEnrollmentResolver = lazy(() =>
  import('@/pages/academy/player/InternalEnrollmentPlayerPage').then((module) => ({
    default: module.LegacyCourseEnrollmentResolver,
  })),
);
const CoursePreviewPage = lazy(() =>
  import('@/pages/academy/player/CoursePlayerShell').then((module) => ({
    default: module.CoursePreviewPage,
  })),
);
const AcademyPartnerCoursesPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyPartnerCoursesPage,
  })),
);
const AcademyPartnerPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyPartnerPage,
  })),
);
const AcademyTemplatesPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyTemplatesPage,
  })),
);
const AcademyTemplatePage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyTemplatePage,
  })),
);
const AcademyReportsPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyReportsPage,
  })),
);
const AcademyLearnersPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyLearnersPage,
  })),
);
const AcademyLearnerPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyLearnerPage,
  })),
);
const AcademyCampaignPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyCampaignPage,
  })),
);
const AcademyEnrollmentReportPage = lazy(() =>
  import('@/pages/academy/AcademyPlaceholderPage').then((module) => ({
    default: module.AcademyEnrollmentReportPage,
  })),
);
const ExternalAccessPage = lazy(() =>
  import('@/pages/external-academy/ExternalAccessPage').then((module) => ({
    default: module.ExternalAccessPage,
  })),
);
const ExternalEnrollmentPlayerPage = lazy(() =>
  import('@/pages/external-academy/ExternalEnrollmentPlayerPage').then((module) => ({
    default: module.ExternalEnrollmentPlayerPage,
  })),
);
const ExternalResultsPage = lazy(() =>
  import('@/pages/external-academy/ExternalEnrollmentPlayerPage').then((module) => ({
    default: module.ExternalResultsPage,
  })),
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
const ActivityControlPage = lazy(() =>
  import('@/pages/activity-control/ActivityControlPage').then((module) => ({
    default: module.ActivityControlPage,
  })),
);
const DuplicateSearchPage = lazy(() =>
  import('@/pages/duplicate-search/DuplicateSearchPage').then((module) => ({
    default: module.DuplicateSearchPage,
  })),
);

const academyV2 = isAcademyV2Enabled();

function RedirectAcademyBuilder() {
  const { courseId = '' } = useParams();
  return <Navigate to={`/academy/courses/${courseId}/builder`} replace />;
}

function RedirectAcademyCourse() {
  const { courseId = '' } = useParams();
  return <Navigate to={`/academy/courses/${courseId}`} replace />;
}

function RequireModule({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  if (currentUser && !canAccessRoute(currentUser.role, pathname)) {
    return <Navigate to={employeeHomePath} replace />;
  }
  return children;
}

function RequireIntegrationAccess({ children }: { children: ReactNode }) {
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  if (currentUser && !canManageIntegrations(currentUser.role)) {
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

          {academyV2 ? (
            <Route path="/academy" element={<AcademyLayout />}>
              <Route index element={<AcademyHomePage />} />
              <Route path="catalog" element={<AcademyCatalogPage />} />
              <Route path="courses" element={<AcademyCoursesPage />} />
              <Route path="courses/:courseId" element={<CourseWorkspacePage />} />
              <Route path="courses/:courseId/versions" element={<CourseVersionsPage />} />
              <Route path="courses/:courseId/distribution" element={<CourseDistributionPage />} />
              <Route path="courses/:courseId/reports" element={<CourseReportsPage />} />
              <Route path="partners" element={<AcademyPartnerCoursesPage />} />
              <Route path="partners/:partnerId" element={<AcademyPartnerPage />} />
              <Route path="templates" element={<AcademyTemplatesPage />} />
              <Route path="templates/:templateId" element={<AcademyTemplatePage />} />
              <Route path="reports" element={<AcademyReportsPage />} />
              <Route path="learners" element={<AcademyLearnersPage />} />
              <Route path="learners/:learnerId" element={<AcademyLearnerPage />} />
              <Route path="campaigns/:campaignId" element={<AcademyCampaignPage />} />
              <Route
                path="enrollments/:enrollmentId/report"
                element={<AcademyEnrollmentReportPage />}
              />
            </Route>
          ) : (
            <>
              <Route path="/academy" element={<AcademyPage />} />
              <Route path="/academy/:courseId" element={<AcademyPage />} />
            </>
          )}

          {/* Experimental academies: live until cutover; redirect when V2 enabled */}
          {academyV2 ? (
            <>
              <Route path="/academy-opus" element={<Navigate to="/academy" replace />} />
              <Route path="/academy-opus/:courseId/builder" element={<RedirectAcademyBuilder />} />
              <Route path="/academy-grok" element={<Navigate to="/academy" replace />} />
              <Route path="/academy-grok/catalog" element={<Navigate to="/academy/catalog" replace />} />
              <Route path="/academy-grok/reports" element={<Navigate to="/academy/reports" replace />} />
              <Route path="/academy-grok/courses/:courseId" element={<RedirectAcademyCourse />} />
              <Route
                path="/academy-grok/courses/:courseId/builder"
                element={<RedirectAcademyBuilder />}
              />
            </>
          ) : (
            <>
              <Route path="/academy-opus" element={<AcademyOpusPage />} />
              <Route path="/academy-opus/:courseId/builder" element={<CourseBuilderPageOpus />} />
              <Route path="/academy-grok" element={<AcademyGrokHomePage />} />
              <Route path="/academy-grok/catalog" element={<AcademyGrokCatalogPage />} />
              <Route path="/academy-grok/courses/:courseId" element={<AcademyGrokCoursePage />} />
              <Route
                path="/academy-grok/courses/:courseId/builder"
                element={<AcademyGrokBuilderPage />}
              />
              <Route path="/academy-grok/reports" element={<AcademyGrokReportsPage />} />
            </>
          )}
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/activity-control"
            element={
              <RequireIntegrationAccess>
                <ActivityControlPage />
              </RequireIntegrationAccess>
            }
          />
          <Route
            path="/duplicate-search"
            element={
              <RequireIntegrationAccess>
                <DuplicateSearchPage />
              </RequireIntegrationAccess>
            }
          />
        </Route>

        {/* Fullscreen authenticated Academy V2 routes */}
        {academyV2 ? (
          <>
            <Route
              path="/academy/courses/:courseId/builder"
              element={
                <RequireAuth>
                  <RequireModule>
                    <AcademyV2BuilderPage />
                  </RequireModule>
                </RequireAuth>
              }
            />
            <Route
              path="/academy/templates/:templateId/builder"
              element={
                <RequireAuth>
                  <RequireModule>
                    <AcademyV2BuilderPage />
                  </RequireModule>
                </RequireAuth>
              }
            />
            <Route
              path="/academy/preview/course-versions/:versionId"
              element={
                <RequireAuth>
                  <RequireModule>
                    <CoursePreviewPage />
                  </RequireModule>
                </RequireAuth>
              }
            />
            <Route
              path="/academy/preview/drafts/:draftVersionId"
              element={
                <RequireAuth>
                  <RequireModule>
                    <CoursePreviewPage />
                  </RequireModule>
                </RequireAuth>
              }
            />
            <Route
              path="/learn/:enrollmentId"
              element={
                <RequireAuth>
                  <RequireModule>
                    <InternalEnrollmentPlayerPage />
                  </RequireModule>
                </RequireAuth>
              }
            />
            {/* Legacy courseId player URLs → enrollment resolver */}
            <Route
              path="/learn-legacy/:courseId"
              element={
                <RequireAuth>
                  <RequireModule>
                    <LegacyCourseEnrollmentResolver />
                  </RequireModule>
                </RequireAuth>
              }
            />
          </>
        ) : (
          <Route path="/learn/:courseId" element={<LearnPage />} />
        )}

        {/* Аутентификация */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="/auth/login" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="create-company" element={<Navigate to="/auth/register" replace />} />
          <Route path="invite/:token" element={<InvitePage />} />
        </Route>

        <Route path="/learn-opus/:courseId" element={<LearnOpusPage />} />
        <Route path="/learn-grok/:courseId" element={<AcademyGrokLearnPage />} />
        <Route path="/share/article/:articleId" element={<ShareArticlePage />} />
        <Route path="/access/:token" element={<AccessLinkPage />} />

        {/* Public external Academy — no RequireAuth / no AppLayout */}
        {academyV2 ? (
          <>
            <Route path="/training/:token" element={<ExternalAccessPage />} />
            <Route
              path="/training/enrollments/:enrollmentId"
              element={<ExternalEnrollmentPlayerPage />}
            />
            <Route
              path="/training/enrollments/:enrollmentId/results"
              element={<ExternalResultsPage />}
            />
          </>
        ) : null}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
