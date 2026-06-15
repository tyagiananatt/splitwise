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
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      groups: [],
      expenses: [],
      settlements: [],
      importReports: [],

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

      addImportReport: (report) =>
        set((state) => ({ importReports: [...state.importReports, report] })),

      updateImportReport: (id, updates) =>
        set((state) => ({
          importReports: state.importReports.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
    }),
    { name: 'splitwise-data' }
  )
);
