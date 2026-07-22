import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { academyExternalPublicApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { toast } from '@/stores/toast';
import { AcademyStatusCallout } from '@/pages/academy/components/AcademyStatusCallout';

/**
 * Public external landing — no TeamOS User, no internal Bearer.
 * Deadline is author-configured; learner only activates.
 */
export function ExternalAccessPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  useTitle('Обучение — TeamOS');

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const landingQuery = useQuery({
    queryKey: queryKeys.externalAcademy.access(token),
    queryFn: ({ signal }) => academyExternalPublicApi.getLanding(token, { signal }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const startVerify = useMutation({
    mutationFn: () =>
      academyExternalPublicApi.startVerification(token, {
        email: email.trim(),
        displayName: displayName.trim() || undefined,
      }),
    onSuccess: (challenge) => {
      setChallengeId(challenge.challengeId);
      toast.success('Код отправлен на email');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось отправить код'),
  });

  const confirmVerify = useMutation({
    mutationFn: () =>
      academyExternalPublicApi.confirmVerification(challengeId!, { code: code.trim() }),
    onSuccess: (session) => {
      setReady(true);
      if (session.readyEnrollmentId) {
        navigate(academyRoutes.externalPlayer(session.readyEnrollmentId), { replace: true });
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Неверный код'),
  });

  const activate = useMutation({
    mutationFn: () => academyExternalPublicApi.activate(token),
    onSuccess: ({ enrollmentId }) => {
      navigate(academyRoutes.externalPlayer(enrollmentId), { replace: true });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось активировать'),
  });

  const landing = landingQuery.data;
  const deadlineDays = landing?.deadlineDays ?? landing?.defaultDeadlineDays;

  if (landingQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
        Загружаем приглашение…
      </div>
    );
  }

  if (landingQuery.isError || !landing) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <AcademyStatusCallout
          tone="danger"
          title="Ссылка недоступна"
          description="Ссылка недействительна, истекла или отозвана."
        />
      </div>
    );
  }

  if (landing.status !== 'valid' && landing.status !== 'already_activated') {
    const messages: Record<string, string> = {
      expired: 'Срок ссылки истёк.',
      revoked: 'Доступ отозван автором.',
      course_archived: 'Курс в архиве — новые активации закрыты.',
      course_deleted: 'Курс удалён.',
      course_blocked: 'Курс заблокирован администрацией.',
      distribution_paused: 'Распространение приостановлено.',
    };
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <AcademyStatusCallout
          tone="warning"
          title={landing.courseTitle}
          description={landing.message ?? messages[landing.status] ?? 'Доступ недоступен'}
        />
        {landing.existingEnrollmentId ? (
          <Button
            onClick={() =>
              navigate(academyRoutes.externalPlayer(landing.existingEnrollmentId!), {
                replace: true,
              })
            }
          >
            Открыть существующее прохождение
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          {landing.companyName ?? 'Внешнее обучение'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{landing.courseTitle}</h1>
        {landing.courseDescription ? (
          <p className="mt-2 text-sm text-slate-600">{landing.courseDescription}</p>
        ) : null}
        {landing.partnerName ? (
          <p className="mt-2 text-xs text-slate-500">От: {landing.partnerName}</p>
        ) : null}
        {deadlineDays != null ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Срок прохождения после активации:{' '}
            <strong>
              {deadlineDays} {deadlineDays === 1 ? 'день' : deadlineDays < 5 ? 'дня' : 'дней'}
            </strong>{' '}
            (по {deadlineDays * 24} ч). Задаёт автор ссылки.
          </p>
        ) : null}
      </div>

      {!challengeId && !ready ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            startVerify.mutate();
          }}
        >
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Как к вам обращаться"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Необязательно"
          />
          <Button type="submit" className="w-full" loading={startVerify.isPending}>
            Получить код подтверждения
          </Button>
          <p className="text-xs text-slate-500">
            Подтверждение email не запускает срок. Срок начнётся после «Активировать и начать».
          </p>
        </form>
      ) : null}

      {challengeId && !ready ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            confirmVerify.mutate();
          }}
        >
          <Input
            label="Код из письма"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button type="submit" className="w-full" loading={confirmVerify.isPending}>
            Подтвердить email
          </Button>
        </form>
      ) : null}

      {ready ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
          <AcademyStatusCallout
            tone="info"
            title="Готово к старту"
            description={
              deadlineDays != null
                ? `После активации у вас будет ${deadlineDays} дн. на прохождение. Отсчёт начнётся сразу.`
                : 'Отсчёт срока начнётся сразу после активации.'
            }
          />
          <Button className="w-full" loading={activate.isPending} onClick={() => activate.mutate()}>
            Активировать и начать
          </Button>
        </div>
      ) : null}
    </div>
  );
}
