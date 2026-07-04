import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRelativeDate } from '@/lib/format';
import { notificationsApi } from '@/api';
import { toast } from '@/stores/toast';
import { Badge, Button } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isPending, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Все уведомления прочитаны');
    },
    onError: () => toast.error('Не удалось отметить уведомления'),
  });

  const hasUnread = notifications?.some((n) => !n.read) ?? false;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Уведомления"
        actions={
          hasUnread && (
            <Button
              variant="secondary"
              size="sm"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Прочитать все
            </Button>
          )
        }
      />

      <div className="mt-6 space-y-2">
        {isPending &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200/60" />
          ))}

        {isError && (
          <div className="rounded-lg border border-danger-100 bg-danger-50 p-4 text-center">
            <p className="text-sm text-danger-700">Не удалось загрузить уведомления.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
              Повторить
            </Button>
          </div>
        )}

        {notifications?.length === 0 && (
          <p className="py-16 text-center text-sm text-slate-500">Уведомлений пока нет.</p>
        )}

        {notifications?.map((notification) => (
          <div
            key={notification.id}
            className={cn(
              'rounded-lg border p-4',
              notification.read
                ? 'border-slate-200 bg-surface'
                : 'border-primary-200 bg-primary-50/50',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                {notification.body && (
                  <p className="mt-0.5 text-sm text-slate-500">{notification.body}</p>
                )}
              </div>
              {!notification.read && <Badge variant="primary">Новое</Badge>}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {formatRelativeDate(notification.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
