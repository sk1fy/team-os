import { useEffect, useState } from 'react';
import { filesApi } from '@/api/files';
import type { RichTextContent } from '@/types';
import { replaceFileImageSources, richTextFileIds } from './fileImages';

const downloadUrlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 4 * 60 * 1000;

export function useResolvedFileImages(
  content: RichTextContent | undefined,
): RichTextContent | undefined {
  const [resolved, setResolved] = useState(content);
  const serialized = JSON.stringify(content);

  useEffect(() => {
    if (!content) {
      setResolved(undefined);
      return;
    }
    const controller = new AbortController();
    const ids = richTextFileIds(content);
    if (ids.length === 0) {
      setResolved(content);
      return () => controller.abort();
    }

    void Promise.all(
      ids.map(async (fileId) => {
        const cached = downloadUrlCache.get(fileId);
        if (cached && cached.expiresAt > Date.now()) return [fileId, cached.url] as const;
        const result = await filesApi.get(fileId, controller.signal);
        downloadUrlCache.set(fileId, {
          url: result.downloadUrl,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return [fileId, result.downloadUrl] as const;
      }),
    )
      .then((entries) => {
        if (!controller.signal.aborted) {
          setResolved(replaceFileImageSources(content, new Map(entries)));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolved(content);
      });

    return () => controller.abort();
    // The serialized document is the actual dependency; callers often replace
    // the containing object even when its JSON did not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return resolved;
}
