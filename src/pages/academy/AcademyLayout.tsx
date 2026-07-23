import { Outlet } from 'react-router-dom';
import { AcademyNav } from './components/AcademyNav';

/**
 * Secondary Academy shell inside AppLayout.
 * Fullscreen player/builder/preview routes live outside this layout.
 */
export function AcademyLayout() {
  return (
    <div className="space-y-6">
      <AcademyNav />
      <Outlet />
    </div>
  );
}
