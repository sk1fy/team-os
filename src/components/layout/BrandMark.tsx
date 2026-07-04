import { cn } from '@/lib/cn';

/** Фирменный знак TeamOS: тёмный скруглённый квадрат с растущими барами. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn('shrink-0', className)}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M49 0H15C6.71573 0 0 6.71573 0 15V49C0 57.2843 6.71573 64 15 64H49C57.2843 64 64 57.2843 64 49V15C64 6.71573 57.2843 0 49 0Z"
        fill="#0A1314"
      />
      <path
        opacity="0.35"
        d="M21 38H16C14.8954 38 14 38.8954 14 40V48C14 49.1046 14.8954 50 16 50H21C22.1046 50 23 49.1046 23 48V40C23 38.8954 22.1046 38 21 38Z"
        fill="white"
      />
      <path
        opacity="0.65"
        d="M35 26H30C28.8954 26 28 26.8954 28 28V48C28 49.1046 28.8954 50 30 50H35C36.1046 50 37 49.1046 37 48V28C37 26.8954 36.1046 26 35 26Z"
        fill="white"
      />
      <path
        d="M49 14H44C42.8954 14 42 14.8954 42 16V48C42 49.1046 42.8954 50 44 50H49C50.1046 50 51 49.1046 51 48V16C51 14.8954 50.1046 14 49 14Z"
        fill="#60C3BC"
      />
    </svg>
  );
}
