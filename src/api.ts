import type {
  AppSettings,
  AuthStatus,
  BackupMetadata,
  BackupPayload,
  Customer,
  Expense,
  ExpenseInput,
  Transaction,
  TransactionInput,
} from './types.ts';

const TOKEN_STORAGE_KEY = 'skd_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response' };
  }

  if (!res.ok) {
    const errObj = data as { error?: string; duplicate?: { id: string; serialNumber: number; vplNumber: string } };
    const err = new Error(errObj.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      duplicate?: { id: string; serialNumber: number; vplNumber: string };
    };
    err.status = res.status;
    err.duplicate = errObj.duplicate;
    throw err;
  }

  return data as T;
}

export interface BootstrapResponse {
  transactions: Transaction[];
  customers: Customer[];
  expenses: Expense[];
  settings: AppSettings;
  backups: BackupMetadata[];
  nextSerialNumber: number;
  nextExpenseNumber: number;
}

export const api = {
  getAuthStatus: () => request<AuthStatus>('/api/auth/status'),
  login: (password: string) =>
    request<{ ok: boolean; token: string | null }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  updatePassword: (payload: {
    enable: boolean;
    currentPassword?: string;
    newPassword?: string;
  }) =>
    request<{ ok: boolean; passwordEnabled: boolean; token: string | null }>(
      '/api/auth/password',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  bootstrap: () => request<BootstrapResponse>('/api/bootstrap'),

  createTransaction: (
    data: TransactionInput & { allowDuplicateVpl?: boolean },
  ) =>
    request<Transaction>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTransaction: (
    id: string,
    data: TransactionInput & { allowDuplicateVpl?: boolean },
  ) =>
    request<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTransaction: (id: string) =>
    request<{ ok: boolean }>(`/api/transactions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  recalculateTransactions: () =>
    request<{ ok: boolean; recalculatedCount: number }>(
      '/api/transactions/recalculate',
      { method: 'POST' },
    ),

  updateCustomer: (
    id: string,
    data: { name: string; mobileNumber: string; address: string; notes?: string },
  ) =>
    request<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: string) =>
    request<{ ok: boolean }>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createExpense: (data: ExpenseInput) =>
    request<Expense>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExpense: (id: string, data: ExpenseInput) =>
    request<Expense>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteExpense: (id: string) =>
    request<{ ok: boolean }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  updateSettings: (data: Partial<AppSettings>) =>
    request<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createBackup: (label?: string) =>
    request<{ metadata: BackupMetadata; payload: BackupPayload }>('/api/backups', {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
  downloadBackup: (id: string) =>
    request<BackupPayload>(`/api/backups/${encodeURIComponent(id)}/download`),
  deleteBackup: (id: string) =>
    request<{ ok: boolean }>(`/api/backups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  restoreBackup: (input: { backupId?: string; payload?: BackupPayload }) =>
    request<{
      ok: boolean;
      restored: { transactions: number; customers: number; expenses: number };
    }>('/api/backups/restore', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
