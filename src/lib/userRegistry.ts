/**
 * userRegistry.ts
 *
 * A simple in-localStorage user registry.
 * Stores all registered accounts (demo + self-registered) so that:
 *  1. GroupNew can look up "does this email belong to a known account?"
 *     and use their real userId instead of inventing a new UUID.
 *  2. Register can link an existing group-member slot to the new account.
 *
 * This is the correct fix for the "member without account" problem.
 * All reads/writes go to localStorage['splitwise-users'].
 */

const KEY = 'splitwise-users';

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

// Demo users are always seeded here so lookups work for them too
const DEMO_USERS: RegisteredUser[] = [
  { id: 'user-aisha', name: 'Aisha', email: 'aisha@flat.com', password: 'password123' },
  { id: 'user-rohan', name: 'Rohan', email: 'rohan@flat.com', password: 'password123' },
  { id: 'user-priya', name: 'Priya', email: 'priya@flat.com', password: 'password123' },
  { id: 'user-meera', name: 'Meera', email: 'meera@flat.com', password: 'password123' },
  { id: 'user-sam',   name: 'Sam',   email: 'sam@flat.com',   password: 'password123' },
  { id: 'user-dev',   name: 'Dev',   email: 'dev@flat.com',   password: 'password123' },
];

export function getAllUsers(): RegisteredUser[] {
  try {
    const stored: RegisteredUser[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    // Merge demo users (deduplicate by id)
    const storedIds = new Set(stored.map((u) => u.id));
    const merged = [...stored];
    for (const d of DEMO_USERS) {
      if (!storedIds.has(d.id)) merged.push(d);
    }
    return merged;
  } catch {
    return [...DEMO_USERS];
  }
}

export function getUserByEmail(email: string): RegisteredUser | null {
  return getAllUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function getUserById(id: string): RegisteredUser | null {
  return getAllUsers().find((u) => u.id === id) ?? null;
}

export function registerUser(user: RegisteredUser): void {
  const users = getAllUsers().filter((u) => u.id !== user.id); // remove if exists
  users.push(user);
  // Don't persist demo users to keep storage clean — only self-registered ones
  const selfRegistered = users.filter((u) => !DEMO_USERS.some((d) => d.id === u.id));
  localStorage.setItem(KEY, JSON.stringify(selfRegistered));
}

export function validateCredentials(email: string, password: string): RegisteredUser | null {
  const user = getUserByEmail(email);
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}
