// src/components/NavDispatcher.tsx
'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar'; // This is now our "Global Header"

export function NavDispatcher({ user, isAdmin, profileHref }: any) {
  const pathname = usePathname();

  const isAdminRoute = pathname.includes('/admin');
  const isClientRoute = pathname.includes('/client');

  return (
    <>
      {/* ROW 1: Always visible, contains Logo, Marketing Links, and Auth */}
      <Navbar user={user} profileHref={profileHref} />
    </>
  );
}