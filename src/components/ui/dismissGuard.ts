/**
 * Защита Radix Dialog/Drawer от закрытия «сквозным» кликом.
 *
 * Когда внутри диалога открыт Select/Dropdown, Radix ставит body
 * `pointer-events: none`, и клик, закрывающий попап, прилетает диалогу как
 * pointerdown-снаружи — диалог закрывается вместе с попапом. Гасим такие
 * события: закрыться должен только попап.
 */
export function preventDismissOnPopoverClick(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) {
  if (document.body.style.pointerEvents === 'none') {
    event.preventDefault();
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.closest('[data-radix-popper-content-wrapper]')) event.preventDefault();
}
