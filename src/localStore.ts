import type { BootstrapResponse } from './api.ts';
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
import {
  calculateTransactionMetrics,
  sanitizeAmount,
} from './utils/calculations.ts';

const STORE_KEY = 'skd_local_database_v1';
const SESSION_KEY = 'skd_local_session_v1';
const DEFAULT_PASSCODE = '1231235';

interface LocalBackupEntry {
  metadata: BackupMetadata;
  payload: BackupPayload;
}

interface LocalDatabase {
  transactions: Transaction[];
  customers: Customer[];
  expenses: Expense[];
  settings: AppSettings;
  passwordHash: string;
  passwordSalt: string;
  passwordConfigured: boolean;
  profitFormulaMigratedV2?: boolean;
  remainingFormulaMigratedV3?: boolean;
  backups: LocalBackupEntry[];
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash for non-secure contexts
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function randomHex(bytes = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createInitialDb(): LocalDatabase {
  return {
    transactions: [],
    customers: [],
    expenses: [],
    settings: {
      businessName: 'Sehat Ki Duniya',
      businessUrduName: 'صحت کی دنیا',
      businessPhone: '',
      businessEmail: '',
      businessAddress: '',
      businessLogo: '',
      currency: 'PKR',
      enableExchangeRate: false,
      exchangeRate: 1,
      targetCurrency: 'USD',
      dateFormat: 'YYYY-MM-DD',
      language: 'bilingual',
      profitFormula: 'invoice_minus_real_minus_parcel',
      remainingFormula: 'invoice_minus_vasool',
      naffaFormula: 'proportional_invoice_capped',
      passwordEnabled: true,
      lastBackupAt: null,
      updatedAt: new Date().toISOString(),
    },
    passwordHash: '',
    passwordSalt: '',
    passwordConfigured: false,
    profitFormulaMigratedV2: true,
    remainingFormulaMigratedV3: true,
    backups: [],
  };
}

const memoryStorageFallback: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStorageFallback[key] ?? null;
  }
}

function safeSetItem(key: string, value: string): void {
  memoryStorageFallback[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage restriction in sandboxed file/content viewers
  }
}

function safeRemoveItem(key: string): void {
  delete memoryStorageFallback[key];
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

async function loadDb(): Promise<LocalDatabase> {
  let db: LocalDatabase;
  try {
    const raw = safeGetItem(STORE_KEY);
    db = raw ? (JSON.parse(raw) as LocalDatabase) : createInitialDb();
  } catch {
    db = createInitialDb();
  }

  let changed = false;
  if (!db.passwordConfigured) {
    const salt = randomHex(16);
    db.passwordSalt = salt;
    db.passwordHash = await sha256Hex(`${salt}:${DEFAULT_PASSCODE}`);
    db.settings.passwordEnabled = true;
    db.passwordConfigured = true;
    changed = true;
  }

  if (!db.profitFormulaMigratedV2 || !db.remainingFormulaMigratedV3) {
    if (!db.profitFormulaMigratedV2) {
      db.settings.profitFormula = 'invoice_minus_real_minus_parcel';
      db.profitFormulaMigratedV2 = true;
    }
    if (!db.remainingFormulaMigratedV3) {
      db.settings.remainingFormula = 'invoice_minus_vasool';
      db.remainingFormulaMigratedV3 = true;
    }
    const ts = new Date().toISOString();
    for (const tx of db.transactions) {
      const metrics = calculateTransactionMetrics(
        {
          realAmount: tx.realAmount,
          invoiceAmount: tx.invoiceAmount,
          parcelCharges: tx.parcelCharges,
          vasool: tx.vasool,
        },
        {
          profitFormula: db.settings.profitFormula,
          remainingFormula: db.settings.remainingFormula,
          naffaFormula: db.settings.naffaFormula,
        },
      );
      tx.profit = metrics.profit;
      tx.naffaVasool = metrics.naffaVasool;
      tx.remainingAmount = metrics.remainingAmount;
      tx.updatedAt = ts;
    }
    changed = true;
  }

  if (changed) {
    saveDb(db);
  }

  return db;
}

function saveDb(db: LocalDatabase): void {
  safeSetItem(STORE_KEY, JSON.stringify(db));
}

function nextSerial(db: LocalDatabase): number {
  let max = 0;
  for (const tx of db.transactions) {
    if (tx.serialNumber > max) max = tx.serialNumber;
  }
  return max + 1;
}

function nextExpNum(db: LocalDatabase): number {
  let max = 0;
  for (const exp of db.expenses) {
    if (exp.expenseNumber > max) max = exp.expenseNumber;
  }
  return max + 1;
}

function findOrCreateCustomer(
  db: LocalDatabase,
  name: string,
  mobileNumber: string,
  address: string,
  ts: string,
): string {
  const cleanName = name.trim();
  const cleanMobile = mobileNumber.trim();
  const cleanAddress = address.trim();

  if (cleanMobile) {
    const byMobile = db.customers.find((c) => c.mobileNumber === cleanMobile);
    if (byMobile) {
      byMobile.name = cleanName || byMobile.name;
      byMobile.address = cleanAddress || byMobile.address;
      byMobile.updatedAt = ts;
      return byMobile.id;
    }
  }

  const byName = db.customers.find(
    (c) => c.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (byName) {
    byName.mobileNumber = cleanMobile || byName.mobileNumber;
    byName.address = cleanAddress || byName.address;
    byName.updatedAt = ts;
    return byName.id;
  }

  const created: Customer = {
    id: makeId('cust'),
    name: cleanName,
    mobileNumber: cleanMobile,
    address: cleanAddress,
    notes: '',
    createdAt: ts,
    updatedAt: ts,
  };
  db.customers.push(created);
  return created.id;
}

export const localStore = {
  async getAuthStatus(): Promise<AuthStatus> {
    const db = await loadDb();
    if (!db.settings.passwordEnabled) {
      return { passwordEnabled: false, authenticated: true };
    }
    const token = safeGetItem(SESSION_KEY);
    return {
      passwordEnabled: true,
      authenticated: Boolean(token && token.length >= 16),
    };
  },

  async login(password: string): Promise<{ ok: boolean; token: string | null }> {
    const db = await loadDb();
    if (!db.settings.passwordEnabled) {
      return { ok: true, token: null };
    }
    const candidateHash = await sha256Hex(`${db.passwordSalt}:${password}`);
    if (candidateHash !== db.passwordHash) {
      throw new Error('Incorrect password');
    }
    const token = randomHex(24);
    safeSetItem(SESSION_KEY, token);
    return { ok: true, token };
  },

  async logout(): Promise<{ ok: boolean }> {
    safeRemoveItem(SESSION_KEY);
    return { ok: true };
  },

  async updatePassword(payload: {
    enable: boolean;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ ok: boolean; passwordEnabled: boolean; token: string | null }> {
    const db = await loadDb();
    if (db.settings.passwordEnabled) {
      const candidateHash = await sha256Hex(
        `${db.passwordSalt}:${payload.currentPassword || ''}`,
      );
      if (candidateHash !== db.passwordHash) {
        throw new Error('Current password is incorrect');
      }
    }

    if (payload.enable) {
      const nextPwd = payload.newPassword || '';
      if (nextPwd.length < 4 || nextPwd.length > 64) {
        throw new Error('Password must be between 4 and 64 characters');
      }
      const salt = randomHex(16);
      db.passwordSalt = salt;
      db.passwordHash = await sha256Hex(`${salt}:${nextPwd}`);
      db.settings.passwordEnabled = true;
      db.passwordConfigured = true;
      db.settings.updatedAt = new Date().toISOString();
      saveDb(db);
      const token = randomHex(24);
      safeSetItem(SESSION_KEY, token);
      return { ok: true, passwordEnabled: true, token };
    } else {
      db.passwordSalt = '';
      db.passwordHash = '';
      db.settings.passwordEnabled = false;
      db.passwordConfigured = true;
      db.settings.updatedAt = new Date().toISOString();
      saveDb(db);
      safeRemoveItem(SESSION_KEY);
      return { ok: true, passwordEnabled: false, token: null };
    }
  },

  async bootstrap(): Promise<BootstrapResponse> {
    const db = await loadDb();
    const sortedTx = [...db.transactions].sort(
      (a, b) => a.serialNumber - b.serialNumber,
    );
    const sortedCust = [...db.customers].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
    const sortedExp = [...db.expenses].sort(
      (a, b) => b.date.localeCompare(a.date) || b.expenseNumber - a.expenseNumber,
    );
    return {
      transactions: sortedTx,
      customers: sortedCust,
      expenses: sortedExp,
      settings: db.settings,
      backups: db.backups.map((b) => b.metadata).slice(0, 25),
      nextSerialNumber: nextSerial(db),
      nextExpenseNumber: nextExpNum(db),
    };
  },

  async createTransaction(
    data: TransactionInput & { allowDuplicateVpl?: boolean },
  ): Promise<Transaction> {
    const db = await loadDb();
    const vplNumber = data.vplNumber.trim();
    const customerName = data.customerName.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error('Valid date (YYYY-MM-DD) is required');
    }
    if (!vplNumber || !customerName) {
      throw new Error('VPL Number and Customer Name are required');
    }

    if (!data.allowDuplicateVpl) {
      const dup = db.transactions.find(
        (t) => t.vplNumber.toLowerCase() === vplNumber.toLowerCase(),
      );
      if (dup) {
        const err = new Error(
          `Duplicate VPL Number "${vplNumber}" already exists at Serial #${dup.serialNumber}.`,
        ) as Error & { duplicate?: { id: string; serialNumber: number; vplNumber: string } };
        err.duplicate = {
          id: dup.id,
          serialNumber: dup.serialNumber,
          vplNumber: dup.vplNumber,
        };
        throw err;
      }
    }

    const realAmount = sanitizeAmount(data.realAmount);
    const invoiceAmount = sanitizeAmount(data.invoiceAmount);
    const parcelCharges = sanitizeAmount(data.parcelCharges);
    const vasool = sanitizeAmount(data.vasool);
    const metrics = calculateTransactionMetrics(
      { realAmount, invoiceAmount, parcelCharges, vasool },
      {
        profitFormula: db.settings.profitFormula,
        remainingFormula: db.settings.remainingFormula,
        naffaFormula: db.settings.naffaFormula,
      },
    );

    const ts = new Date().toISOString();
    const customerId = findOrCreateCustomer(
      db,
      customerName,
      data.mobileNumber || '',
      data.address || '',
      ts,
    );

    const created: Transaction = {
      id: makeId('tx'),
      serialNumber: nextSerial(db),
      date: data.date,
      time: data.time || '00:00',
      vplNumber,
      customerId,
      customerName,
      mobileNumber: (data.mobileNumber || '').trim(),
      address: (data.address || '').trim(),
      realAmount,
      invoiceAmount,
      profit: metrics.profit,
      parcelCharges,
      vasool,
      naffaVasool: metrics.naffaVasool,
      remainingAmount: metrics.remainingAmount,
      remarks: (data.remarks || '').trim(),
      createdAt: ts,
      updatedAt: ts,
    };

    db.transactions.push(created);
    saveDb(db);
    return created;
  },

  async updateTransaction(
    id: string,
    data: TransactionInput & { allowDuplicateVpl?: boolean },
  ): Promise<Transaction> {
    const db = await loadDb();
    const existing = db.transactions.find((t) => t.id === id);
    if (!existing) throw new Error('Transaction not found');

    const vplNumber = data.vplNumber.trim();
    const customerName = data.customerName.trim();
    if (!vplNumber || !customerName) {
      throw new Error('VPL Number and Customer Name are required');
    }

    if (!data.allowDuplicateVpl) {
      const dup = db.transactions.find(
        (t) => t.id !== id && t.vplNumber.toLowerCase() === vplNumber.toLowerCase(),
      );
      if (dup) {
        throw new Error(
          `Duplicate VPL Number "${vplNumber}" already exists at Serial #${dup.serialNumber}.`,
        );
      }
    }

    const realAmount = sanitizeAmount(data.realAmount);
    const invoiceAmount = sanitizeAmount(data.invoiceAmount);
    const parcelCharges = sanitizeAmount(data.parcelCharges);
    const vasool = sanitizeAmount(data.vasool);
    const metrics = calculateTransactionMetrics(
      { realAmount, invoiceAmount, parcelCharges, vasool },
      {
        profitFormula: db.settings.profitFormula,
        remainingFormula: db.settings.remainingFormula,
        naffaFormula: db.settings.naffaFormula,
      },
    );

    const ts = new Date().toISOString();
    const customerId = findOrCreateCustomer(
      db,
      customerName,
      data.mobileNumber || '',
      data.address || '',
      ts,
    );

    Object.assign(existing, {
      date: data.date,
      time: data.time || '00:00',
      vplNumber,
      customerId,
      customerName,
      mobileNumber: (data.mobileNumber || '').trim(),
      address: (data.address || '').trim(),
      realAmount,
      invoiceAmount,
      profit: metrics.profit,
      parcelCharges,
      vasool,
      naffaVasool: metrics.naffaVasool,
      remainingAmount: metrics.remainingAmount,
      remarks: (data.remarks || '').trim(),
      updatedAt: ts,
    });

    saveDb(db);
    return existing;
  },

  async deleteTransaction(id: string): Promise<{ ok: boolean }> {
    const db = await loadDb();
    const before = db.transactions.length;
    db.transactions = db.transactions.filter((t) => t.id !== id);
    if (db.transactions.length === before) throw new Error('Transaction not found');
    saveDb(db);
    return { ok: true };
  },

  async recalculateTransactions(): Promise<{ ok: boolean; recalculatedCount: number }> {
    const db = await loadDb();
    const ts = new Date().toISOString();
    for (const tx of db.transactions) {
      const metrics = calculateTransactionMetrics(
        {
          realAmount: tx.realAmount,
          invoiceAmount: tx.invoiceAmount,
          parcelCharges: tx.parcelCharges,
          vasool: tx.vasool,
        },
        {
          profitFormula: db.settings.profitFormula,
          remainingFormula: db.settings.remainingFormula,
          naffaFormula: db.settings.naffaFormula,
        },
      );
      tx.profit = metrics.profit;
      tx.naffaVasool = metrics.naffaVasool;
      tx.remainingAmount = metrics.remainingAmount;
      tx.updatedAt = ts;
    }
    saveDb(db);
    return { ok: true, recalculatedCount: db.transactions.length };
  },

  async updateCustomer(
    id: string,
    data: { name: string; mobileNumber: string; address: string; notes?: string },
  ): Promise<Customer> {
    const db = await loadDb();
    const cust = db.customers.find((c) => c.id === id);
    if (!cust) throw new Error('Customer not found');
    const ts = new Date().toISOString();
    cust.name = data.name.trim();
    cust.mobileNumber = data.mobileNumber.trim();
    cust.address = data.address.trim();
    if (typeof data.notes === 'string') cust.notes = data.notes.trim();
    cust.updatedAt = ts;

    for (const tx of db.transactions) {
      if (tx.customerId === id) {
        tx.customerName = cust.name;
        tx.mobileNumber = cust.mobileNumber;
        tx.address = cust.address;
      }
    }
    saveDb(db);
    return cust;
  },

  async deleteCustomer(id: string): Promise<{ ok: boolean }> {
    const db = await loadDb();
    if (db.transactions.some((t) => t.customerId === id)) {
      throw new Error(
        'Cannot delete a customer with existing transactions. Delete their transactions first.',
      );
    }
    db.customers = db.customers.filter((c) => c.id !== id);
    saveDb(db);
    return { ok: true };
  },

  async createExpense(data: ExpenseInput): Promise<Expense> {
    const db = await loadDb();
    const amount = sanitizeAmount(data.amount);
    if (amount <= 0) throw new Error('Expense amount must be greater than 0');
    const ts = new Date().toISOString();
    const created: Expense = {
      id: makeId('exp'),
      expenseNumber: nextExpNum(db),
      date: data.date,
      time: data.time || '00:00',
      category: data.category,
      description: (data.description || '').trim(),
      amount,
      paymentMethod: data.paymentMethod,
      createdAt: ts,
      updatedAt: ts,
    };
    db.expenses.push(created);
    saveDb(db);
    return created;
  },

  async updateExpense(id: string, data: ExpenseInput): Promise<Expense> {
    const db = await loadDb();
    const exp = db.expenses.find((e) => e.id === id);
    if (!exp) throw new Error('Expense not found');
    const amount = sanitizeAmount(data.amount);
    if (amount <= 0) throw new Error('Expense amount must be greater than 0');
    Object.assign(exp, {
      date: data.date,
      time: data.time || '00:00',
      category: data.category,
      description: (data.description || '').trim(),
      amount,
      paymentMethod: data.paymentMethod,
      updatedAt: new Date().toISOString(),
    });
    saveDb(db);
    return exp;
  },

  async deleteExpense(id: string): Promise<{ ok: boolean }> {
    const db = await loadDb();
    db.expenses = db.expenses.filter((e) => e.id !== id);
    saveDb(db);
    return { ok: true };
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const db = await loadDb();
    const { passwordEnabled: _ignored, ...safeUpdates } = updates;
    db.settings = {
      ...db.settings,
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.settings;
  },

  async createBackup(
    label?: string,
  ): Promise<{ metadata: BackupMetadata; payload: BackupPayload }> {
    const db = await loadDb();
    const ts = new Date().toISOString();
    const cleanLabel =
      label && label.trim() ? label.trim().slice(0, 120) : `Backup ${ts.slice(0, 10)}`;
    const payload: BackupPayload = {
      version: 1,
      exportedAt: ts,
      appName: 'Sehat Ki Duniya',
      transactions: db.transactions,
      customers: db.customers,
      expenses: db.expenses,
      settings: db.settings,
    };
    const metadata: BackupMetadata = {
      id: makeId('bkp'),
      label: cleanLabel,
      createdAt: ts,
      transactionCount: db.transactions.length,
      customerCount: db.customers.length,
      expenseCount: db.expenses.length,
    };
    db.backups.unshift({ metadata, payload });
    db.backups = db.backups.slice(0, 25);
    db.settings.lastBackupAt = ts;
    db.settings.updatedAt = ts;
    saveDb(db);
    return { metadata, payload };
  },

  async downloadBackup(id: string): Promise<BackupPayload> {
    const db = await loadDb();
    const found = db.backups.find((b) => b.metadata.id === id);
    if (!found) throw new Error('Backup not found');
    return found.payload;
  },

  async deleteBackup(id: string): Promise<{ ok: boolean }> {
    const db = await loadDb();
    db.backups = db.backups.filter((b) => b.metadata.id !== id);
    saveDb(db);
    return { ok: true };
  },

  async restoreBackup(input: {
    backupId?: string;
    payload?: BackupPayload;
  }): Promise<{
    ok: boolean;
    restored: { transactions: number; customers: number; expenses: number };
  }> {
    const db = await loadDb();
    let payload: BackupPayload | null = null;
    if (input.backupId) {
      payload = db.backups.find((b) => b.metadata.id === input.backupId)?.payload || null;
    } else if (input.payload) {
      payload = input.payload;
    }

    if (
      !payload ||
      !Array.isArray(payload.transactions) ||
      !Array.isArray(payload.customers) ||
      !Array.isArray(payload.expenses)
    ) {
      throw new Error('Invalid backup file format');
    }

    db.transactions = payload.transactions;
    db.customers = payload.customers;
    db.expenses = payload.expenses;
    if (payload.settings) {
      const currentPwdEnabled = db.settings.passwordEnabled;
      db.settings = {
        ...db.settings,
        ...payload.settings,
        passwordEnabled: currentPwdEnabled,
        updatedAt: new Date().toISOString(),
      };
    }
    saveDb(db);
    return {
      ok: true,
      restored: {
        transactions: db.transactions.length,
        customers: db.customers.length,
        expenses: db.expenses.length,
      },
    };
  },
};
