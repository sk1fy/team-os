import { describe, expect, it } from 'vitest';
import { normalizeVideoUrl } from './videoEmbed';

describe('normalizeVideoUrl', () => {
  it('принимает прямые HTTPS-ссылки на MP4 и WebM', () => {
    expect(normalizeVideoUrl('https://cdn.example.com/demo.mp4')?.provider).toBe('direct');
    expect(normalizeVideoUrl('https://cdn.example.com/demo.webm')?.provider).toBe('direct');
  });

  it('преобразует ссылки из разрешённых видеосервисов', () => {
    expect(normalizeVideoUrl('https://vimeo.com/123456')).toEqual({
      provider: 'vimeo',
      url: 'https://player.vimeo.com/video/123456',
    });
    expect(normalizeVideoUrl('https://www.loom.com/share/abc-123')).toEqual({
      provider: 'loom',
      url: 'https://www.loom.com/embed/abc-123',
    });
  });

  it('отклоняет HTTP, data URL и неизвестные провайдеры', () => {
    expect(normalizeVideoUrl('http://cdn.example.com/demo.mp4')).toBeNull();
    expect(normalizeVideoUrl('data:video/mp4;base64,AAA')).toBeNull();
    expect(normalizeVideoUrl('https://example.com/watch/123')).toBeNull();
  });
});
