import type { DealDistributionGroup, DistributionEvent, ID } from '@/types';

export function pickDistributionMember(
  group: DealDistributionGroup,
  events: DistributionEvent[],
): ID | null {
  const enabledMemberIds = group.memberIds.filter(
    (memberId) => !group.disabledMemberIds.includes(memberId),
  );
  if (enabledMemberIds.length === 0) return null;

  if (group.algorithm === 'priority') return enabledMemberIds[0] ?? null;

  if (group.algorithm === 'round_robin') {
    const groupEvents = events.filter((event) => event.groupId === group.id);
    const lastEvent = [...groupEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastIndex = lastEvent ? enabledMemberIds.indexOf(lastEvent.userId) : -1;
    return enabledMemberIds[(lastIndex + 1) % enabledMemberIds.length] ?? null;
  }

  const loadByMember = new Map(enabledMemberIds.map((id) => [id, 0]));
  for (const event of events) {
    if (event.groupId !== group.id || !loadByMember.has(event.userId)) continue;
    if (event.status === 'declined' || event.status === 'reassigned') continue;
    loadByMember.set(event.userId, (loadByMember.get(event.userId) ?? 0) + 1);
  }

  return (
    [...enabledMemberIds].sort(
      (a, b) => (loadByMember.get(a) ?? 0) - (loadByMember.get(b) ?? 0),
    )[0] ?? null
  );
}
