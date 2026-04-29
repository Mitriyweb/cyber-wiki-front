/**
 * Menu Component (Standalone)
 *
 * Side navigation menu for standalone FrontX projects.
 * Uses local shadcn/ui Sidebar components for proper styling and collapsible behavior.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  useAppSelector,
  eventBus,
  type MenuState,
} from '@cyberfabric/react';
import { Home, ChevronDown, GitPullRequest, MessageSquare, Edit3, Star } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuIcon,
  SidebarHeader,
} from '@/app/components/primitives/Sidebar';
import { HAI3LogoIcon } from '@/app/icons/HAI3LogoIcon';
import { HAI3LogoTextIcon } from '@/app/icons/HAI3LogoTextIcon';
import { Urls } from '@/app/api';
import type { Space, UserSpacePreference } from '@/app/api';
import { loadSpaces } from '@/app/actions/wikiActions';

const SPACE_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-pink-600',
  'bg-teal-600',
];

function getSpaceColor(index: number): string {
  return SPACE_COLORS[index % SPACE_COLORS.length];
}

export interface MenuProps {
  children?: React.ReactNode;
  navigate?: (view: string) => void;
}

export const Menu: React.FC<MenuProps> = ({ children, navigate }) => {
  const menuState = useAppSelector((state) => state['layout/menu'] as MenuState | undefined);
  const collapsed = menuState?.collapsed ?? false;

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [favorites, setFavorites] = useState<UserSpacePreference[]>([]);
  const [spacesExpanded, setSpacesExpanded] = useState(true);

  const currentHash = window.location.hash.slice(1) || Urls.Dashboard;
  const currentView = currentHash.split('?')[0];
  const currentSpaceSlug = new URLSearchParams(currentHash.split('?')[1] || '').get('space');

  useEffect(() => {
    const sub = eventBus.on('wiki/spaces/loaded', (payload) => {
      const favSlugs = new Set((payload.favorites || []).map((f: UserSpacePreference) => f.space_slug));
      const sorted = [...(payload.all || [])].sort((a, b) => {
        const aFav = favSlugs.has(a.slug) ? 0 : 1;
        const bFav = favSlugs.has(b.slug) ? 0 : 1;
        return aFav - bFav;
      });
      setSpaces(sorted);
      setFavorites(payload.favorites || []);
    });
    loadSpaces();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleToggleCollapse = () => {
    eventBus.emit('layout/menu/collapsed', { collapsed: !collapsed });
  };

  const handleNavigate = useCallback((view: string) => {
    if (navigate) {
      navigate(view);
    } else {
      window.location.hash = view;
    }
  }, [navigate]);

  const handleSelectSpace = useCallback((slug: string) => {
    handleNavigate(`${Urls.Spaces}?space=${slug}`);
  }, [handleNavigate]);

  return (
    <Sidebar collapsed={collapsed}>
      <SidebarHeader
        logo={<HAI3LogoIcon />}
        logoText={!collapsed ? <HAI3LogoTextIcon /> : undefined}
        collapsed={collapsed}
        onClick={handleToggleCollapse}
      />

      <SidebarContent>
        <SidebarMenu>
          {/* Dashboard */}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentView === Urls.Dashboard}
              onClick={() => handleNavigate(Urls.Dashboard)}
            >
              <SidebarMenuIcon><Home className="size-4" /></SidebarMenuIcon>
              <span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* All comments across all files */}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentView === Urls.Comments}
              onClick={() => handleNavigate(Urls.Comments)}
            >
              <SidebarMenuIcon><MessageSquare className="size-4" /></SidebarMenuIcon>
              <span>Comments</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* All pending changes across all spaces */}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentView === Urls.Changes}
              onClick={() => handleNavigate(Urls.Changes)}
            >
              <SidebarMenuIcon><Edit3 className="size-4" /></SidebarMenuIcon>
              <span>Changes</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* PRs where I'm a reviewer */}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentView === Urls.PRs}
              onClick={() => handleNavigate(Urls.PRs)}
            >
              <SidebarMenuIcon><GitPullRequest className="size-4" /></SidebarMenuIcon>
              <span>PRs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

        </SidebarMenu>

        {/* MY SPACES section */}
        {!collapsed && (
          <div className="mt-4">
            <button
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-mainMenu-foreground/60 hover:text-mainMenu-foreground/80"
              onClick={() => setSpacesExpanded((v) => !v)}
            >
              <span>My Spaces</span>
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${spacesExpanded ? '' : '-rotate-90'}`}
              />
            </button>

            {spacesExpanded && (
              <SidebarMenu>
                {spaces.map((space, idx) => {
                  const isActive =
                    currentView === Urls.Spaces && currentSpaceSlug === space.slug;
                  return (
                    <SidebarMenuItem key={space.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => handleSelectSpace(space.slug)}
                        className="gap-2.5"
                      >
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded text-[0.625rem] font-bold text-white ${getSpaceColor(idx)}`}
                        >
                          {space.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{space.name}</span>
                        {favorites.some(f => f.space_slug === space.slug) && (
                          <Star size={12} className="ml-auto shrink-0 fill-yellow-400 text-yellow-400" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </div>
        )}
      </SidebarContent>

      {children}
    </Sidebar>
  );
};

Menu.displayName = 'Menu';
