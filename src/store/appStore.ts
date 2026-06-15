import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Group, Expense, Settlement, ImportReport, GroupMember } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AppStore {
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  importReports: ImportReport[];

  // Groups
  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Group;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addMember: (groupId: string, member: GroupMember) => void;
  removeMember: (groupId: string, userId: string, leftAt: string) => void;

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Expense;
  addExpenses: (expenses: Omit<Expense, 'id' | 'createdAt'>[]) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Settlements
  addSettlement: (settlement: Omit<Settlement, 'id' | 'createdAt'>) => Settlement;
  deleteSettlement: (id: string) => void;

  // Import reports
  addImportReport: (report: ImportReport) => void;
  updateImportReport: (id: string, updates: Partial<ImportReport>) => void;

  // Account linking
  relinkMember: (oldUserId: string, newUser: { id: string; name: string; email: string }) => void;

  // ── Scoped selectors ─────────────────────────────────────────────────────
  // Return only groups where userId is a member (active or former)
  getGroupsForUser: (userId: string) => Group[];
  // Return only expenses for groups the user belongs to
  getExpensesForUser: (userId: string) => Expense[];
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      groups: [],
      expenses: [],
      settlements: [],
      importReports: [],

      // ── Scoped selectors ────────────────────────────────────────────────
      getGroupsForUser: (userId) => {
        return get().groups.filter((g) =>
          g.members.some((m) => m.userId === userId)
        );
      },

      getExpensesForUser: (userId) => {
        const userGroupIds = new Set(
          get().groups
            .filter((g) => g.members.some((m) => m.userId === userId))
            .map((g) => g.id)
        );
        return get().expenses.filter((e) => userGroupIds.has(e.groupId));
      },

      // ── Groups ──────────────────────────────────────────────────────────
      addGroup: (groupData) => {
        const group: Group = {
          ...groupData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ groups: [...state.groups, group] }));
        return group;
      },

      updateGroup: (id, updates) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        })),

      deleteGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          expenses: state.expenses.filter((e) => e.groupId !== id),
          settlements: state.settlements.filter((s) => s.groupId !== id),
        })),

      addMember: (groupId, member) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  members: [...g.members.filter((m) => m.userId !== member.userId), member],
                  updatedAt: new Date().toISOString(),
                }
              : g
          ),
        })),

      removeMember: (groupId, userId, leftAt) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  members: g.members.map((m) =>
                    m.userId === userId ? { ...m, leftAt } : m
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : g
          ),
        })),

      // ── Expenses ────────────────────────────────────────────────────────
      addExpense: (expenseData) => {
        const expense: Expense = {
          ...expenseData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ expenses: [...state.expenses, expense] }));
        return expense;
      },

      addExpenses: (expensesData) => {
        const expenses: Expense[] = expensesData.map((e) => ({
          ...e,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
        }));
        set((state) => ({ expenses: [...state.expenses, ...expenses] }));
      },

      updateExpense: (id, updates) =>
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        })),

      // ── Settlements ──────────────────────────────────────────────────────
      addSettlement: (settlementData) => {
        const settlement: Settlement = {
          ...settlementData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ settlements: [...state.settlements, settlement] }));
        return settlement;
      },

      deleteSettlement: (id) =>
        set((state) => ({
          settlements: state.settlements.filter((s) => s.id !== id),
        })),

      // ── Import reports ───────────────────────────────────────────────────
      addImportReport: (report) =>
        set((state) => ({ importReports: [...state.importReports, report] })),

      updateImportReport: (id, updates) =>
        set((state) => ({
          importReports: state.importReports.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      // ── Account linking ──────────────────────────────────────────────────
      relinkMember: (oldUserId, newUser) =>
        set((state) => ({
          groups: state.groups.map((g) => ({
            ...g,
            members: g.members.map((m) =>
              m.userId === oldUserId
                ? { ...m, userId: newUser.id, name: newUser.name, email: newUser.email }
                : m
            ),
            updatedAt: new Date().toISOString(),
          })),
          expenses: state.expenses.map((e) => ({
            ...e,
            paidById:   e.paidById === oldUserId ? newUser.id   : e.paidById,
            paidByName: e.paidById === oldUserId ? newUser.name : e.paidByName,
            shares: e.shares.map((s) =>
              s.userId === oldUserId
                ? { ...s, userId: newUser.id, userName: newUser.name }
                : s
            ),
          })),
          settlements: state.settlements.map((s) => ({
            ...s,
            payerId:   s.payerId === oldUserId ? newUser.id   : s.payerId,
            payerName: s.payerId === oldUserId ? newUser.name : s.payerName,
            payeeId:   s.payeeId === oldUserId ? newUser.id   : s.payeeId,
            payeeName: s.payeeId === oldUserId ? newUser.name : s.payeeName,
          })),
        })),
    }),
    { name: 'splitwise-data' }
  )
);
