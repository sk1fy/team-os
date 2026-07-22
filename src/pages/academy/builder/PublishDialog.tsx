import { Button, Modal } from '@/components/ui';

export function PublishDialog({
  open,
  onClose,
  onConfirm,
  loading,
  lessonCount,
  sectionCount,
  validationMessage,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  lessonCount: number;
  sectionCount: number;
  validationMessage?: string;
}) {
  const canPublish = lessonCount > 0 && !validationMessage;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Опубликовать версию?"
      description="Будет создана неизменяемая published-версия. Текущие прохождения останутся на своей версии."
    >
      <div className="space-y-4 text-sm text-slate-600">
        <ul className="list-inside list-disc space-y-1">
          <li>
            Разделов: {sectionCount}
          </li>
          <li>Уроков: {lessonCount}</li>
          <li>Черновик останется доступен для следующих правок</li>
          <li>Начатые прохождения не переключатся автоматически</li>
        </ul>
        {validationMessage ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            {validationMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={loading} disabled={!canPublish} onClick={onConfirm}>
            Опубликовать
          </Button>
        </div>
      </div>
    </Modal>
  );
}
