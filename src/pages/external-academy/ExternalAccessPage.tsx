import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { academyExternalPublicApi } from '@/api/academy';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { toast } from '@/stores/toast';
import { AcademyStatusCallout } from '@/pages/academy/components/AcademyStatusCallout';
import {
  presentExternalError,
  type ExternalErrorPresentation,
} from './externalErrorPresentation';

/**
 * Public external landing — no TeamOS User, no internal Bearer.
 * Deadline is author-configured; learner only activates.
 */
export function ExternalAccessPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useTitle('Обучение — TeamOS');

  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flowError, setFlowError] = useState<ExternalErrorPresentation | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const activationKey = useRef(crypto.randomUUID());

  const landingQuery = useQuery({
    queryKey: queryKeys.externalAcademy.access(token),
    queryFn: ({ signal }) => academyExternalPublicApi.getLanding(token, { signal }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const landing = landingQuery.data;
  const emailLocked = Boolean(landing?.emailLocked && landing.expectedEmail);
  // During contract rollout, a missing flag must not silently bypass verification.
  const requiresEmailVerification = landing?.requiresEmailVerification !== false;

  useEffect(() => {
    if (!challengeId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [challengeId]);

  const clearSensitiveAccessQuery = () => {
    queryClient.removeQueries({ queryKey: queryKeys.externalAcademy.access(token), exact: true });
  };

  const startVerify = useMutation({
    mutationFn: () =>
      academyExternalPublicApi.startVerification(token, {
        email: (email ?? landing?.expectedEmail ?? '').trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: (challenge) => {
      setFlowError(null);
      setChallengeId(challenge.challengeId);
      setCode('');
      setNow(Date.now());
      toast.success('Код отправлен на email');
    },
    onError: (error) => {
      const presentation = presentExternalError(error, {
        title: 'Не удалось отправить код',
        description: 'Проверьте данные и попробуйте ещё раз.',
        recovery: 'retry',
      });
      setFlowError(presentation);
      toast.error(presentation.description);
    },
  });

  const confirmVerify = useMutation({
    mutationFn: () =>
      academyExternalPublicApi.confirmVerification(challengeId!, { code: code.trim() }),
    onSuccess: (session) => {
      setFlowError(null);
      const enrollmentId = session.readyEnrollmentId ?? session.enrollmentId;
      if (session.accessStatus === 'active' && enrollmentId) {
        clearSensitiveAccessQuery();
        navigate(academyRoutes.externalPlayer(enrollmentId), { replace: true });
        return;
      }
      if (session.accessStatus === 'ready' || session.accessStatus === 'invited') {
        setReady(true);
        return;
      }
      setReady(false);
      setFlowError({
        title: 'Доступ нельзя активировать',
        description:
          session.accessStatus === 'expired'
            ? 'Срок доступа истёк.'
            : session.accessStatus === 'revoked' || session.accessStatus === 'closed'
              ? 'Доступ закрыт автором курса.'
              : 'Доступ временно недоступен. Обратитесь к автору курса.',
        recovery: session.accessStatus === 'frozen' ? 'retry_later' : 'none',
      });
    },
    onError: (error) => {
      const presentation = presentExternalError(error, {
        title: 'Код не подтверждён',
        description: 'Проверьте код и попробуйте ещё раз.',
        recovery: 'retry',
      });
      if (
        presentation.recovery === 'restart_verification' ||
        presentation.recovery === 'edit_identity'
      ) {
        setChallengeId(null);
        setCode('');
        setReady(false);
      }
      setFlowError(presentation);
      toast.error(presentation.description);
    },
  });

  const activate = useMutation({
    mutationFn: () =>
      academyExternalPublicApi.activate(token, { idempotencyKey: activationKey.current }),
    onSuccess: ({ enrollmentId }) => {
      setFlowError(null);
      clearSensitiveAccessQuery();
      navigate(academyRoutes.externalPlayer(enrollmentId), { replace: true });
    },
    onError: (error) => {
      const presentation = presentExternalError(error, {
        title: 'Не удалось активировать доступ',
        description: 'Попробуйте ещё раз. Срок не начнётся без успешной активации.',
        recovery: 'retry',
      });
      setFlowError(presentation);
      toast.error(presentation.description);
      if (presentation.recovery === 'reload_landing') {
        void landingQuery.refetch();
      }
    },
  });

  const deadlineDays = landing?.deadlineDays ?? landing?.defaultDeadlineDays;
  const resendAt = challengeId ? startVerify.data?.resendAvailableAt : undefined;
  const resendSeconds = resendAt
    ? Math.max(0, Math.ceil((Date.parse(resendAt) - now) / 1_000))
    : 0;

  if (landingQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
        Загружаем приглашение…
      </div>
    );
  }

  if (landingQuery.isError || !landing) {
    const presentation = presentExternalError(landingQuery.error, {
      title: 'Ссылка недоступна',
      description: 'Ссылка недействительна, истекла или отозвана.',
      recovery: 'retry',
    });
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <AcademyStatusCallout
          tone="danger"
          title={presentation.title}
          description={presentation.description}
        />
      </div>
    );
  }

  if (landing.status === 'already_activated' && landing.existingEnrollmentId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <AcademyStatusCallout
          tone="info"
          title={landing.courseTitle}
          description="Этот доступ уже активирован. Продолжите с сохранённого места."
        />
        <Button
          onClick={() => {
            clearSensitiveAccessQuery();
            navigate(academyRoutes.externalPlayer(landing.existingEnrollmentId!), {
              replace: true,
            });
          }}
        >
          Продолжить обучение
        </Button>
      </div>
    );
  }

  if (landing.status === 'already_activated') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <AcademyStatusCallout
          tone="warning"
          title="Доступ уже активирован"
          description="Сервер не вернул идентификатор существующего прохождения. Обновите страницу или обратитесь к автору курса."
        />
      </div>
    );
  }

  if (landing.status !== 'valid') {
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
            onClick={() => {
              clearSensitiveAccessQuery();
              navigate(academyRoutes.externalPlayer(landing.existingEnrollmentId!), {
                replace: true,
              });
            }}
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
        {landing.courseCoverUrl ? (
          <img
            src={landing.courseCoverUrl}
            alt=""
            className="mb-5 aspect-[16/9] w-full rounded-xl object-cover"
          />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          {landing.companyName ?? 'Внешнее обучение'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{landing.courseTitle}</h1>
        {landing.courseDescription ? (
          <p className="mt-2 text-sm text-slate-600">{landing.courseDescription}</p>
        ) : null}
        {landing.partnerName ? (
          <p className="mt-2 text-xs text-slate-500">Автор: {landing.partnerName}</p>
        ) : null}
        {deadlineDays != null ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Срок прохождения после активации:{' '}
            <strong>
              {formatDeadlineDays(deadlineDays)}
            </strong>{' '}
            Таймер нельзя поставить на паузу.
          </p>
        ) : null}
      </div>

      {flowError ? (
        <AcademyStatusCallout
          tone={flowError.recovery === 'retry_later' ? 'warning' : 'danger'}
          title={flowError.title}
          description={flowError.description}
        />
      ) : null}

      {requiresEmailVerification && !challengeId && !ready ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setFlowError(null);
            startVerify.mutate();
          }}
        >
          <Input
            label="Имя"
            required
            pattern=".*\S.*"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
          <Input
            label="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Необязательно"
            autoComplete="family-name"
          />
          <Input
            label="Email"
            type="email"
            required
            value={email ?? landing.expectedEmail ?? ''}
            disabled={emailLocked}
            hint={
              landing.maskedEmail && !emailLocked
                ? `Ссылка предназначена для ${landing.maskedEmail}`
                : undefined
            }
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Телефон"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Необязательно"
            autoComplete="tel"
          />
          <Button type="submit" className="w-full" loading={startVerify.isPending}>
            Получить код подтверждения
          </Button>
          <p className="text-xs text-slate-500">
            Подтверждение email не запускает срок. Срок начнётся после «Активировать и начать».
          </p>
          <p className="text-xs text-slate-500">
            Продолжая, вы соглашаетесь на обработку указанных данных только для идентификации,
            прохождения курса и сохранения результата. Аккаунт TeamOS не создаётся.
          </p>
        </form>
      ) : null}

      {requiresEmailVerification && challengeId && !ready ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setFlowError(null);
            confirmVerify.mutate();
          }}
        >
          <Input
            label="Код из письма"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
          />
          <Button type="submit" className="w-full" loading={confirmVerify.isPending}>
            Подтвердить email
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={startVerify.isPending || resendSeconds > 0}
              onClick={() => startVerify.mutate()}
            >
              {resendSeconds > 0
                ? `Отправить снова через ${resendSeconds} с`
                : 'Отправить код снова'}
            </Button>
            {!emailLocked ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFlowError(null);
                  setChallengeId(null);
                  setCode('');
                  setReady(false);
                }}
              >
                Изменить email
              </Button>
            ) : null}
          </div>
          {startVerify.data?.expiresAt ? (
            <p className="text-xs text-slate-500">Код действует 10 минут с момента отправки.</p>
          ) : null}
        </form>
      ) : null}

      {ready || !requiresEmailVerification ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
          <AcademyStatusCallout
            tone="info"
            title="Готово к старту"
            description={
              deadlineDays != null
                ? `После начала курс будет доступен ${formatDeadlineDays(deadlineDays)}. Таймер нельзя поставить на паузу.`
                : 'Срок прохождения начнётся сразу после активации. Таймер нельзя поставить на паузу.'
            }
          />
          <Button
            className="w-full"
            loading={activate.isPending}
            disabled={
              activate.isPending ||
              Boolean(
                flowError &&
                  flowError.recovery !== 'retry' &&
                  flowError.recovery !== 'reload_landing',
              )
            }
            onClick={() => activate.mutate()}
          >
            Активировать и начать
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatDeadlineDays(value: number): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  const unit =
    mod100 >= 11 && mod100 <= 14
      ? 'дней'
      : mod10 === 1
        ? 'день'
        : mod10 >= 2 && mod10 <= 4
          ? 'дня'
          : 'дней';
  return `${value} ${unit}`;
}
