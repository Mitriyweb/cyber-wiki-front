/**
 * CyberWiki Application Component
 *
 * Shows LoginPage when not authenticated, main layout when authenticated.
 * Auth state is driven by eventBus 'app/auth/state' events.
 * Hash-based routing for views (Dashboard, Spaces, Profile, etc.).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { eventBus } from '@cyberfabric/react';
import { fetchCurrentUser } from '@/app/actions/bootstrapActions';
import { Urls } from '@/app/api';
import { Layout } from '@/app/layout';
import { LoginPage } from '@/app/pages/LoginPage';
import { ThemeProvider } from '@/app/components/ThemeProvider';

const DashboardPage = React.lazy(() => import('@/app/pages/DashboardPage'));
const SpacesPage = React.lazy(() => import('@/app/pages/SpacesPage'));
const SpaceViewPage = React.lazy(() => import('@/app/pages/SpaceViewPage'));
const SpaceConfigurationPage = React.lazy(() => import('@/app/pages/SpaceConfigurationPage'));
const ProfilePage = React.lazy(() => import('@/app/pages/ProfilePage'));
const TokensPage = React.lazy(() => import('@/app/pages/TokensPage'));
const CommentsPage = React.lazy(() => import('@/app/pages/CommentsPage'));
const ChangesPage = React.lazy(() => import('@/app/pages/ChangesPage'));
const PRsPage = React.lazy(() => import('@/app/pages/PRsPage'));

function ViewLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p>Loading...</p>
    </div>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [activeRoute, setActiveRoute] = useState(() => window.location.hash.slice(1) || Urls.Dashboard);

  useEffect(() => {
    const sub = eventBus.on('app/auth/state', ({ authenticated: isAuth }) => {
      setAuthenticated(isAuth);
    });
    fetchCurrentUser();
    return () => sub.unsubscribe();
  }, []);

  // Listen for hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setActiveRoute(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((view: string) => {
    window.location.hash = view;
    setActiveRoute(view);
  }, []);

  if (authenticated === null) {
    return null;
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  const activeView = activeRoute.split('?')[0];
  const hasSpaceParam = activeRoute.includes('space=');

  const renderView = () => {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        {activeView === Urls.Dashboard && <DashboardPage navigate={navigate} />}
        {activeView === Urls.Spaces && hasSpaceParam && <SpaceViewPage navigate={navigate} />}
        {activeView === Urls.Spaces && !hasSpaceParam && <SpacesPage navigate={navigate} />}
        {activeView === Urls.SpaceConfiguration && <SpaceConfigurationPage navigate={navigate} />}
        {activeView === Urls.Profile && <ProfilePage navigate={navigate} />}
        {activeView === Urls.Tokens && <TokensPage navigate={navigate} />}
        {activeView === Urls.Comments && <CommentsPage navigate={navigate} />}
        {activeView === Urls.Changes && <ChangesPage navigate={navigate} />}
        {activeView === Urls.PRs && <PRsPage navigate={navigate} />}
      </React.Suspense>
    );
  };

  return (
    <>
      <ThemeProvider />
      <Layout navigate={navigate}>{renderView()}</Layout>
    </>
  );
}

export default App;
