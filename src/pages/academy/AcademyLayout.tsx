import { Outlet } from 'react-router-dom';
import { AcademyNav } from './components/AcademyNav';

/**
 * Secondary Academy shell inside AppLayout.
 * Fullscreen player/builder/preview routes live outside this layout.
 */
export function AcademyLayout() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <AcademyNav />
      <Outlet />
    </div>
  );
}
