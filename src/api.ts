import { localStore } from './localStore.ts';
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

let backendAvailablePromise: Promise<boolean> | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (backendAvailablePromise) return backendAvailablePromise;
  backendAvailablePromise = (async () => {
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('.github.io') ||
        (window.location.protocol !== 'http:' && window.location.protocol !== 'https:'))
    ) {
      return false;
    }
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return false;
      }
      const json = (await res.json()) as { status?: string; database?: string };
      return json?.status === 'ok' && json?.database === 'sqlite';
    } catch {
      return false;
    }
  })();
  return backendAvailablePromise;
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
    data = { error: 'Server returned an unexpected response.' };
  }

  if (!res.ok) {
    const errObj = data as {
      error?: string;
      duplicate?: { id: string; serialNumber: number; vplNumber: string };
    };
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
  getAuthStatus: async (): Promise<AuthStatus> => {
    if (!(await isBackendAvailable())) return localStore.getAuthStatus();
    return request<AuthStatus>('/api/auth/status');
  },
  login: async (password: string) => {
    if (!(await isBackendAvailable())) return localStore.login(password);
    return request<{ ok: boolean; token: string | null }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },
  logout: async () => {
    if (!(await isBackendAvailable())) return localStore.logout();
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },
  updatePassword: async (payload: {
    enable: boolean;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    if (!(await isBackendAvailable())) return localStore.updatePassword(payload);
    return request<{ ok: boolean; passwordEnabled: boolean; token: string | null }>(
      '/api/auth/password',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  bootstrap: async () => {
    if (!(await isBackendAvailable())) return localStore.bootstrap();
    return request<BootstrapResponse>('/api/bootstrap');
  },

  createTransaction: async (
    data: TransactionInput & { allowDuplicateVpl?: boolean },
  ) => {
    if (!(await isBackendAvailable())) return localStore.createTransaction(data);
    return request<Transaction>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateTransaction: async (
    id: string,
    data: TransactionInput & { allowDuplicateVpl?: boolean },
  ) => {
    if (!(await isBackendAvailable())) return localStore.updateTransaction(id, data);
    return request<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteTransaction: async (id: string) => {
    if (!(await isBackendAvailable())) return localStore.deleteTransaction(id);
    return request<{ ok: boolean }>(`/api/transactions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  recalculateTransactions: async () => {
    if (!(await isBackendAvailable())) return localStore.recalculateTransactions();
    return request<{ ok: boolean; recalculatedCount: number }>(
      '/api/transactions/recalculate',
      { method: 'POST' },
    );
  },

  updateCustomer: async (
    id: string,
    data: { name: string; mobileNumber: string; address: string; notes?: string },
  ) => {
    if (!(await isBackendAvailable())) return localStore.updateCustomer(id, data);
    return request<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteCustomer: async (id: string) => {
    if (!(await isBackendAvailable())) return localStore.deleteCustomer(id);
    return request<{ ok: boolean }>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  createExpense: async (data: ExpenseInput) => {
    if (!(await isBackendAvailable())) return localStore.createExpense(data);
    return request<Expense>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateExpense: async (id: string, data: ExpenseInput) => {
    if (!(await isBackendAvailable())) return localStore.updateExpense(id, data);
    return request<Expense>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteExpense: async (id: string) => {
    if (!(await isBackendAvailable())) return localStore.deleteExpense(id);
    return request<{ ok: boolean }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  updateSettings: async (data: Partial<AppSettings>) => {
    if (!(await isBackendAvailable())) return localStore.updateSettings(data);
    return request<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  createBackup: async (label?: string) => {
    if (!(await isBackendAvailable())) return localStore.createBackup(label);
    return request<{ metadata: BackupMetadata; payload: BackupPayload }>('/api/backups', {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
  },
  downloadBackup: async (id: string) => {
    if (!(await isBackendAvailable())) return localStore.downloadBackup(id);
    return request<BackupPayload>(`/api/backups/${encodeURIComponent(id)}/download`);
  },
  deleteBackup: async (id: string) => {
    if (!(await isBackendAvailable())) return localStore.deleteBackup(id);
    return request<{ ok: boolean }>(`/api/backups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  restoreBackup: async (input: { backupId?: string; payload?: BackupPayload }) => {
    if (!(await isBackendAvailable())) return localStore.restoreBackup(input);
    return request<{
      ok: boolean;
      restored: { transactions: number; customers: number; expenses: number };
    }>('/api/backups/restore', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
