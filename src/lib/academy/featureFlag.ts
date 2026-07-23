/**
 * Academy V2 feature flag.
 * When false, production routes keep the legacy Academy pages.
 * When true, canonical /academy tree uses V2 layout and pages.
 */
export function isAcademyV2Enabled(): boolean {
  const raw = import.meta.env.VITE_ACADEMY_V2;
  if (raw === undefined || raw === '') return false;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'on';
}
