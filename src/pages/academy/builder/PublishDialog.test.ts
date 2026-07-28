import { describe, expect, it } from 'vitest';
import {
  getControlledPublishVisibilityValue,
  getPublishVisibilityDescription,
} from './publishDialogVisibility';

describe('PublishDialog visibility', () => {
  it('показывает выбранный режим вместо исходной настройки', () => {
    expect(getPublishVisibilityDescription('restricted', 'company')).toBe(
      'Выбранная настройка: Вся компания. Она будет применена после публикации.',
    );
  });

  it('до выбора поясняет текущую настройку', () => {
    expect(getPublishVisibilityDescription('restricted', null)).toBe(
      'Текущая настройка: Только по назначению. Выберите режим доступа для публикации.',
    );
  });

  it('Select остаётся controlled до и после выбора', () => {
    expect(getControlledPublishVisibilityValue(null)).toBe('');
    expect(getControlledPublishVisibilityValue('public')).toBe('public');
  });
});
