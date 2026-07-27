import { API_URL } from './config';
import { ApiError, httpRequest } from './client';
import { useAuthStore } from '@/stores/auth';
import type { components } from './generated/teamos';
import type { ID } from '@/types';

export type UploadedFile = components['schemas']['UploadedFile'];
export type FileDownload = components['schemas']['FileDownload'];

type UploadOptions = {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
};

function uploadError(request: XMLHttpRequest): ApiError {
  try {
    const payload = JSON.parse(request.responseText) as {
      error?: { message?: string; status?: number; code?: string; details?: unknown };
    };
    return new ApiError(
      payload.error?.message ?? 'Не удалось загрузить файл.',
      payload.error?.status ?? request.status,
      { code: payload.error?.code, details: payload.error?.details },
    );
  } catch {
    return new ApiError('Не удалось загрузить файл.', request.status || 500);
  }
}

export const filesApi = {
  upload(
    file: File,
    purpose: UploadedFile['purpose'] = 'attachment',
    options: UploadOptions = {},
  ): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const body = new FormData();
      body.append('file', file);
      body.append('purpose', purpose);
      request.open('POST', `${API_URL}/files`);
      request.withCredentials = true;
      const token = useAuthStore.getState().accessToken;
      if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);

      request.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => {
        if (request.status < 200 || request.status >= 300) {
          reject(uploadError(request));
          return;
        }
        try {
          resolve(JSON.parse(request.responseText) as UploadedFile);
        } catch {
          reject(new ApiError('Файловый сервис вернул некорректный ответ.', 502));
        }
      });
      request.addEventListener('error', () =>
        reject(new ApiError('Не удалось связаться с файловым сервисом.', 0)),
      );
      request.addEventListener('abort', () =>
        reject(new DOMException('Загрузка отменена', 'AbortError')),
      );
      options.signal?.addEventListener('abort', () => request.abort(), { once: true });
      options.onProgress?.(0);
      request.send(body);
    });
  },

  get(fileId: ID, signal?: AbortSignal): Promise<FileDownload> {
    return httpRequest<FileDownload>(`/files/${encodeURIComponent(fileId)}`, { signal });
  },

  delete(fileId: ID): Promise<void> {
    return httpRequest(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  },
};
