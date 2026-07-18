import { Node, mergeAttributes } from '@tiptap/core';

export type VideoProvider = 'direct' | 'youtube' | 'vimeo' | 'rutube' | 'loom' | 'kinescope';

export interface VideoSource {
  url: string;
  provider: VideoProvider;
}

function lastPathPart(url: URL) {
  return url.pathname.split('/').filter(Boolean).at(-1) ?? '';
}

export function normalizeVideoUrl(value: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = url.pathname.toLowerCase();
  if (/\.(mp4|webm)$/.test(pathname)) return { url: url.toString(), provider: 'direct' };

  if (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    const id =
      host === 'youtu.be' || pathname.startsWith('/embed/')
        ? lastPathPart(url)
        : url.searchParams.get('v');
    if (id && /^[\w-]{6,}$/.test(id)) {
      return { url: `https://www.youtube-nocookie.com/embed/${id}`, provider: 'youtube' };
    }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = lastPathPart(url);
    if (/^\d+$/.test(id)) return { url: `https://player.vimeo.com/video/${id}`, provider: 'vimeo' };
  }

  if (host === 'rutube.ru') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts.at(-1);
    if (id && /^[\w-]+$/.test(id)) {
      return { url: `https://rutube.ru/play/embed/${id}`, provider: 'rutube' };
    }
  }

  if (host === 'loom.com') {
    const id = lastPathPart(url);
    if (id && /^[\w-]+$/.test(id)) {
      return { url: `https://www.loom.com/embed/${id}`, provider: 'loom' };
    }
  }

  if (host === 'kinescope.io') {
    const id = lastPathPart(url);
    if (id && /^[\w-]+$/.test(id)) {
      return { url: `https://kinescope.io/embed/${id}`, provider: 'kinescope' };
    }
  }

  return null;
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: null },
      provider: { default: null },
      title: { default: 'Видео' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, title } = HTMLAttributes as {
      url?: string;
      title?: string;
    };
    const source = url ? normalizeVideoUrl(url) : null;
    const wrapper = mergeAttributes(HTMLAttributes, {
      'data-video-embed': '',
      class: 'video-embed',
      url: source?.url ?? '',
      provider: source?.provider ?? '',
    });
    if (!source) {
      return ['div', wrapper, 'Видео недоступно'];
    }
    if (source.provider === 'direct') {
      return [
        'div',
        wrapper,
        ['video', { src: source.url, title, controls: 'true', preload: 'metadata' }],
      ];
    }
    return [
      'div',
      wrapper,
      [
        'iframe',
        {
          src: source.url,
          title,
          loading: 'lazy',
          allow: 'accelerometer; autoplay; encrypted-media; picture-in-picture',
          allowfullscreen: 'true',
          referrerpolicy: 'strict-origin-when-cross-origin',
        },
      ],
    ];
  },
});
