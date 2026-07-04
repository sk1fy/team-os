/**
 * Страницы-заглушки модулей. Каждая заменяется реальной реализацией
 * в своём этапе плана.
 */

import { Settings } from 'lucide-react';
import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder';

export function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Настройки"
      description="Профиль компании, роли и интеграции."
      icon={Settings}
      stage={5}
    />
  );
}
