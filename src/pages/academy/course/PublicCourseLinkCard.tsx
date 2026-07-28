import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Link2, RotateCw } from 'lucide-react';
import { academyExternalAdminApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';
import type { AcademyCourseDetail } from '@/types/academy';
import {
  PUBLIC_COURSE_CAMPAIGN_NAME,
  publicCourseLinkDeadlineDays,
  resolvePublicCourseLinkAction,
} from './publicCourseLink';

export function PublicCourseLinkCard({
  course,
  canManage,
}: {
  course: AcademyCourseDetail;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const versionId = course.latestPublishedVersion?.id;
  const isPublicPublished = course.visibility === 'public' && Boolean(versionId);

  const campaignsQuery = useQuery({
    queryKey: queryKeys.academyV2.campaigns(course.id),
    queryFn: ({ signal }) => academyExternalAdminApi.listCampaigns(course.id, { signal }),
    enabled: isPublicPublished && canManage,
  });

  const issueLink = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error('У курса нет опубликованной версии');
      const action = resolvePublicCourseLinkAction(campaignsQuery.data ?? [], versionId);
      idempotencyKey.current ??= createId();

      if (action.type === 'create') {
        return academyExternalAdminApi.createCampaign(
          course.id,
          versionId,
          {
            purpose:
              course.ownerType === 'partner'
                ? ('partner_promo' as const)
                : ('company_candidate' as const),
            name: PUBLIC_COURSE_CAMPAIGN_NAME,
            deadlineDays: publicCourseLinkDeadlineDays(course.deadlineDays),
          },
          { idempotencyKey: idempotencyKey.current },
        );
      }

      if (action.type === 'resume-and-rotate') {
        await academyExternalAdminApi.resumeCampaign(action.campaignId);
      }
      return academyExternalAdminApi.rotateCampaign(action.campaignId, {
        idempotencyKey: idempotencyKey.current,
      });
    },
    onSuccess: async (campaign) => {
      idempotencyKey.current = null;
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.campaigns(course.id) });
      if (!campaign.publicUrl) {
        toast.error('Ссылка выпущена, но сервер не вернул публичный адрес');
        return;
      }
      setPublicUrl(campaign.publicUrl);
      const copied = await copyText(campaign.publicUrl);
      toast.success(copied ? 'Публичная ссылка создана и скопирована' : 'Публичная ссылка создана');
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Не удалось выпустить публичную ссылку',
      );
    },
  });

  if (!isPublicPublished) return null;

  const action = resolvePublicCourseLinkAction(campaignsQuery.data ?? [], versionId!);
  const hasDedicatedCampaign = action.type !== 'create';
  const disabled =
    !canManage ||
    course.lifecycleStatus !== 'active' ||
    course.distributionStatus !== 'active' ||
    campaignsQuery.isLoading ||
    campaignsQuery.isError;

  return (
    <section className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Link2 className="size-4 text-primary-600" />
            Публичная ссылка курса
          </h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Внешний ученик откроет курс без аккаунта TeamOS, подтвердит email, а его прогресс
            появится в отчётах.
          </p>
        </div>
        {canManage ? (
          <Button
            size="sm"
            disabled={disabled}
            loading={issueLink.isPending}
            onClick={() => issueLink.mutate()}
          >
            {hasDedicatedCampaign ? (
              <>
                <RotateCw className="size-4" />
                Выпустить новую ссылку
              </>
            ) : (
              <>
                <Link2 className="size-4" />
                Получить ссылку
              </>
            )}
          </Button>
        ) : null}
      </div>

      {campaignsQuery.isError ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-danger-600">
          <span>Не удалось проверить публичную ссылку.</span>
          <Button size="sm" variant="ghost" onClick={() => void campaignsQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {hasDedicatedCampaign && !publicUrl ? (
        <p className="text-xs text-slate-500">
          Ссылка уже выпускалась. Полный секрет не хранится и показывается только при создании.
          Выпуск новой ссылки отключит предыдущую.
        </p>
      ) : null}

      {publicUrl ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-xs font-medium text-slate-700">
            Сохраните ссылку сейчас: после ухода со страницы полный адрес больше не показывается.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="min-w-0 flex-1"
              readOnly
              value={publicUrl}
              aria-label="Публичная ссылка курса"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const copied = await copyText(publicUrl);
                toast[copied ? 'success' : 'error'](
                  copied ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку',
                );
              }}
            >
              <Copy className="size-4" />
              Скопировать
            </Button>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                <ExternalLink className="size-4" />
                Открыть
              </Button>
            </a>
          </div>
        </div>
      ) : null}

      {!canManage ? (
        <p className="text-xs text-slate-500">
          У вас нет права выпускать внешнюю ссылку для этого курса.
        </p>
      ) : course.distributionStatus !== 'active' ? (
        <p className="text-xs text-amber-700">Сначала возобновите распространение курса.</p>
      ) : course.lifecycleStatus !== 'active' ? (
        <p className="text-xs text-amber-700">Ссылка недоступна для архивного курса.</p>
      ) : null}
    </section>
  );
}
