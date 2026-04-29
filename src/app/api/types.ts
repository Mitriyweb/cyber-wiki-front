/**
 * Accounts Domain - API Types
 * Type definitions for accounts service endpoints
 * (users, tenants, authentication, permissions)
 *
 * Application-specific types (copied from CLI template)
 */

import type { Language } from '@cyberfabric/react';

/**
 * User Extra Properties
 * Applications extend this via module augmentation for platform-specific fields
 * @public Reserved for future module augmentation
 */
export interface UserExtra {
  // Applications add their types via module augmentation
  // Empty by default
  [key: string]: unknown;
}

/**
 * User entity from API
 */
export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  language: Language;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  extra?: UserExtra;
}

/**
 * User roles
 * @public Reserved for future use
 */
export enum UserRole {
  Admin = 'admin',
  User = 'user',
}

/**
 * Get current user response
 */
export interface GetCurrentUserResponse {
  user: ApiUser;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Login response from backend
 * Backend returns Django User fields + token
 */
export interface LoginResponse {
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    settings: Record<string, unknown>;
  };
  token: string;
}

/**
 * Current user response from backend /api/auth/v1/me
 */
export interface MeResponse {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  settings: Record<string, unknown>;
}
