import { useState } from 'react';
import { cn } from '@/lib/cn';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

/** Детерминированный цвет фона по имени, чтобы аватар не «мигал» между рендерами.
 *  Палитра из дизайн-системы «Ракурс». */
const bgClasses = [
  'bg-[#EF4444]',
  'bg-[#F59E0B]',
  'bg-[#7C3AED]',
  'bg-[#2F7E78]',
  'bg-[#2563EB]',
  'bg-[#DB2777]',
  'bg-[#0891B2]',
  'bg-[#65A30D]',
  'bg-[#EA580C]',
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return bgClasses[Math.abs(hash) % bgClasses.length];
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white select-none',
        sizeClasses[size],
        !showImage && colorFor(name),
        className,
      )}
      title={name}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
