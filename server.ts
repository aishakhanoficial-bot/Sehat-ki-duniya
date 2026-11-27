import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  calculateTransactionMetrics,
  sanitizeAmount,
} from './src/utils/calculations.ts';
import type {
  AppSettings,
  BackupPayload,
  CurrencyCode,
  DateFormatType,
  ExpenseCategory,
  LanguageMode,
  NaffaFormula,
  PaymentMethod,
  ProfitFormula,
  RemainingFormula,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'sehat_ki_duniya.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize separate persistent tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobileNumber TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    serialNumber INTEGER NOT NULL UNIQUE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    vplNumber TEXT NOT NULL,
    customerId TEXT NOT NULL,
    customerName TEXT NOT NULL,
    mobileNumber TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    realAmount REAL NOT NULL DEFAULT 0,
    invoiceAmount REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    parcelCharges REAL NOT NULL DEFAULT 0,
    vasool REAL NOT NULL DEFAULT 0,
    naffaVasool REAL NOT NULL DEFAULT 0,
    remainingAmount REAL NOT NULL DEFAULT 0,
    remarks TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_vpl ON transactions(vplNumber);
  CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customerId);

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    expenseNumber INTEGER NOT NULL UNIQUE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    paymentMethod TEXT NOT NULL DEFAULT 'Cash',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    businessName TEXT NOT NULL,
    businessUrduName TEXT NOT NULL,
    businessPhone TEXT NOT NULL DEFAULT '',
    businessEmail TEXT NOT NULL DEFAULT '',
    businessAddress TEXT NOT NULL DEFAULT '',
    businessLogo TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'PKR',
    enableExchangeRate INTEGER NOT NULL DEFAULT 0,
    exchangeRate REAL NOT NULL DEFAULT 1,
    targetCurrency TEXT NOT NULL DEFAULT 'USD',
    dateFormat TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    language TEXT NOT NULL DEFAULT 'bilingual',
    profitFormula TEXT NOT NULL DEFAULT 'invoice_minus_real',
    remainingFormula TEXT NOT NULL DEFAULT 'invoice_plus_parcel_minus_vasool',
    naffaFormula TEXT NOT NULL DEFAULT 'proportional_invoice_capped',
    passwordEnabled INTEGER NOT NULL DEFAULT 0,
    passwordHash TEXT NOT NULL DEFAULT '',
    passwordSalt TEXT NOT NULL DEFAULT '',
    passwordConfigured INTEGER NOT NULL DEFAULT 0,
    lastBackupAt TEXT,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    transactionCount INTEGER NOT NULL DEFAULT 0,
    customerCount INTEGER NOT NULL DEFAULT 0,
    expenseCount INTEGER NOT NULL DEFAULT 0,
    payloadJson TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  );
`);

const VALID_CURRENCIES: CurrencyCode[] = ['PKR', 'USD', 'SAR', 'AED', 'INR', 'GBP', 'EUR'];
const VALID_DATE_FORMATS: DateFormatType[] = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD MMM YYYY'];
const VALID_LANGUAGES: LanguageMode[] = ['bilingual', 'en', 'ur'];
const VALID_PROFIT_FORMULAS: ProfitFormula[] = ['invoice_minus_real', 'invoice_minus_real_minus_parcel'];
const VALID_REMAINING_FORMULAS: RemainingFormula[] = ['invoice_plus_parcel_minus_vasool', 'invoice_minus_vasool'];
const VALID_NAFFA_FORMULAS: NaffaFormula[] = [
  'proportional_invoice_capped',
  'proportional_invoice_uncapped',
  'proportional_total',
  'vasool_after_real',
];
const VALID_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Electricity',
  'Staff Salary',
  'Transport',
  'Parcel',
  'Office Expenses',
  'Other',
];
const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Bank Transfer',
  'JazzCash / Easypaisa',
  'Card',
  'Cheque',
  'Other',
];

function nowIso(): string {
  return new Date().toISOString();
}

try {
  db.exec('ALTER TABLE settings ADD COLUMN passwordConfigured INTEGER NOT NULL DEFAULT 0');
} catch {
  // column already exists
}

function ensureDefaultSettings(): void {
  const existing = db
    .prepare('SELECT id, passwordHash, passwordConfigured FROM settings WHERE id = ?')
    .get('default') as
    | { id: string; passwordHash: string; passwordConfigured: number }
    | undefined;
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('1231235', salt);
    db.prepare(`
      INSERT INTO settings (
        id, businessName, businessUrduName, businessPhone, businessEmail, businessAddress,
        businessLogo, currency, enableExchangeRate, exchangeRate, targetCurrency,
        dateFormat, language, profitFormula, remainingFormula, naffaFormula,
        passwordEnabled, passwordHash, passwordSalt, passwordConfigured, lastBackupAt, updatedAt
      ) VALUES (
        'default', 'Sehat Ki Duniya', 'صحت کی دنیا', '', '', '',
        '', 'PKR', 0, 1, 'USD',
        'YYYY-MM-DD', 'bilingual', 'invoice_minus_real', 'invoice_plus_parcel_minus_vasool', 'proportional_invoice_capped',
        1, ?, ?, 1, NULL, ?
      )
    `).run(hash, salt, nowIso());
  } else if (!existing.passwordConfigured && !existing.passwordHash) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('1231235', salt);
    db.prepare(
      'UPDATE settings SET passwordEnabled = 1, passwordHash = ?, passwordSalt = ?, passwordConfigured = 1, updatedAt = ? WHERE id = ?',
    ).run(hash, salt, nowIso(), 'default');
  }
}

ensureDefaultSettings();

interface SettingsRow {
  id: string;
  businessName: string;
  businessUrduName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessLogo: string;
  currency: CurrencyCode;
  enableExchangeRate: number;
  exchangeRate: number;
  targetCurrency: CurrencyCode;
  dateFormat: DateFormatType;
  language: LanguageMode;
  profitFormula: ProfitFormula;
  remainingFormula: RemainingFormula;
  naffaFormula: NaffaFormula;
  passwordEnabled: number;
  passwordHash: string;
  passwordSalt: string;
  lastBackupAt: string | null;
  updatedAt: string;
}

function getSettingsRow(): SettingsRow {
  ensureDefaultSettings();
  return db.prepare('SELECT * FROM settings WHERE id = ?').get('default') as SettingsRow;
}

function toPublicSettings(row: SettingsRow): AppSettings {
  return {
    businessName: row.businessName,
    businessUrduName: row.businessUrduName,
    businessPhone: row.businessPhone,
    businessEmail: row.businessEmail,
    businessAddress: row.businessAddress,
    businessLogo: row.businessLogo,
    currency: row.currency,
    enableExchangeRate: Boolean(row.enableExchangeRate),
    exchangeRate: row.exchangeRate,
    targetCurrency: row.targetCurrency,
    dateFormat: row.dateFormat,
    language: row.language,
    profitFormula: row.profitFormula,
    remainingFormula: row.remainingFormula,
    naffaFormula: row.naffaFormula,
    passwordEnabled: Boolean(row.passwordEnabled),
    lastBackupAt: row.lastBackupAt,
    updatedAt: row.updatedAt,
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function isSessionValid(token: string | null): boolean {
  if (!token) return false;
  const row = db
    .prepare('SELECT token, expiresAt FROM sessions WHERE token = ?')
    .get(token) as { token: string; expiresAt: string } | undefined;
  if (!row) return false;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return false;
  }
  return true;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const settings = getSettingsRow();
  if (!settings.passwordEnabled) {
    next();
    return;
  }
  const token = getBearerToken(req);
  if (!isSessionValid(token)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function findOrCreateCustomer(
  name: string,
  mobileNumber: string,
  address: string,
  timestamp: string,
): string {
  const cleanName = name.trim();
  const cleanMobile = mobileNumber.trim();
  const cleanAddress = address.trim();

  if (cleanMobile) {
    const byMobile = db
      .prepare('SELECT id, name, address FROM customers WHERE mobileNumber = ?')
      .get(cleanMobile) as { id: string; name: string; address: string } | undefined;
    if (byMobile) {
      db.prepare(
        'UPDATE customers SET name = ?, address = ?, updatedAt = ? WHERE id = ?',
      ).run(
        cleanName || byMobile.name,
        cleanAddress || byMobile.address,
        timestamp,
        byMobile.id,
      );
      return byMobile.id;
    }
  }

  const byName = db
    .prepare('SELECT id, mobileNumber, address FROM customers WHERE LOWER(name) = LOWER(?)')
    .get(cleanName) as { id: string; mobileNumber: string; address: string } | undefined;
  if (byName) {
    db.prepare(
      'UPDATE customers SET mobileNumber = ?, address = ?, updatedAt = ? WHERE id = ?',
    ).run(
      cleanMobile || byName.mobileNumber,
      cleanAddress || byName.address,
      timestamp,
      byName.id,
    );
    return byName.id;
  }

  const newId = `cust_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO customers (id, name, mobileNumber, address, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, '', ?, ?)
  `).run(newId, cleanName, cleanMobile, cleanAddress, timestamp, timestamp);
  return newId;
}

function getNextSerialNumber(): number {
  const row = db
    .prepare('SELECT MAX(serialNumber) as maxSerial FROM transactions')
    .get() as { maxSerial: number | null };
  return (row?.maxSerial || 0) + 1;
}

function getNextExpenseNumber(): number {
  const row = db
    .prepare('SELECT MAX(expenseNumber) as maxNum FROM expenses')
    .get() as { maxNum: number | null };
  return (row?.maxNum || 0) + 1;
}

async function createAppServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', database: 'sqlite' });
  });

  app.get('/download/sehat-ki-duniya.html', (_req: Request, res: Response) => {
    const filePath = path.join(__dirname, 'public', 'sehat-ki-duniya.html');
    if (!fs.existsSync(filePath)) {
      res.status(404).send('Standalone HTML file not generated yet.');
      return;
    }
    res.download(filePath, 'sehat-ki-duniya.html');
  });

  // Auth routes
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const settings = getSettingsRow();
    const enabled = Boolean(settings.passwordEnabled);
    if (!enabled) {
      res.json({ passwordEnabled: false, authenticated: true });
      return;
    }
    const token = getBearerToken(req);
    res.json({
      passwordEnabled: true,
      authenticated: isSessionValid(token),
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const settings = getSettingsRow();
    if (!settings.passwordEnabled) {
      res.json({ ok: true, token: null });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!verifyPassword(password, settings.passwordHash, settings.passwordSalt)) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, createdAt, expiresAt) VALUES (?, ?, ?)').run(
      token,
      createdAt,
      expiresAt,
    );
    res.json({ ok: true, token });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = getBearerToken(req);
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/password', requireAuth, (req: Request, res: Response) => {
    const settings = getSettingsRow();
    const enable = Boolean(req.body?.enable);
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (settings.passwordEnabled) {
      if (!verifyPassword(currentPassword, settings.passwordHash, settings.passwordSalt)) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    if (enable) {
      if (newPassword.length < 4 || newPassword.length > 64) {
        res.status(400).json({ error: 'Password must be between 4 and 64 characters' });
        return;
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(newPassword, salt);
      db.prepare(
        'UPDATE settings SET passwordEnabled = 1, passwordHash = ?, passwordSalt = ?, passwordConfigured = 1, updatedAt = ? WHERE id = ?',
      ).run(hash, salt, nowIso(), 'default');

      // Issue a fresh session for current client so they aren't logged out immediately
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (token, createdAt, expiresAt) VALUES (?, ?, ?)').run(
        token,
        nowIso(),
        expiresAt,
      );
      res.json({ ok: true, passwordEnabled: true, token });
      return;
    } else {
      db.prepare(
        'UPDATE settings SET passwordEnabled = 0, passwordHash = ?, passwordSalt = ?, passwordConfigured = 1, updatedAt = ? WHERE id = ?',
      ).run('', '', nowIso(), 'default');
      db.prepare('DELETE FROM sessions').run();
      res.json({ ok: true, passwordEnabled: false, token: null });
    }
  });

  // Bootstrap all core collections
  app.get('/api/bootstrap', requireAuth, (_req: Request, res: Response) => {
    const transactions = db
      .prepare('SELECT * FROM transactions ORDER BY date DESC, serialNumber DESC')
      .all();
    const customers = db
      .prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC')
      .all();
    const expenses = db
      .prepare('SELECT * FROM expenses ORDER BY date DESC, expenseNumber DESC')
      .all();
    const settings = toPublicSettings(getSettingsRow());
    const backups = db
      .prepare(
        'SELECT id, label, createdAt, transactionCount, customerCount, expenseCount FROM backups ORDER BY createdAt DESC LIMIT 25',
      )
      .all();

    res.json({
      transactions,
      customers,
      expenses,
      settings,
      backups,
      nextSerialNumber: getNextSerialNumber(),
      nextExpenseNumber: getNextExpenseNumber(),
    });
  });

  // Transactions CRUD
  app.get('/api/transactions', requireAuth, (_req: Request, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM transactions ORDER BY date DESC, serialNumber DESC')
      .all();
    res.json(rows);
  });

  app.post('/api/transactions', requireAuth, (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const date = typeof body.date === 'string' ? body.date.trim() : '';
      const time = typeof body.time === 'string' ? body.time.trim() : '00:00';
      const vplNumber = typeof body.vplNumber === 'string' ? body.vplNumber.trim() : '';
      const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const mobileNumber = typeof body.mobileNumber === 'string' ? body.mobileNumber.trim() : '';
      const address = typeof body.address === 'string' ? body.address.trim() : '';
      const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
      const allowDuplicateVpl = Boolean(body.allowDuplicateVpl);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
        return;
      }
      if (!vplNumber) {
        res.status(400).json({ error: 'VPL Number is required' });
        return;
      }
      if (!customerName) {
        res.status(400).json({ error: 'Customer Name is required' });
        return;
      }

      if (!allowDuplicateVpl) {
        const dup = db
          .prepare('SELECT id, serialNumber, vplNumber FROM transactions WHERE LOWER(vplNumber) = LOWER(?)')
          .get(vplNumber) as { id: string; serialNumber: number; vplNumber: string } | undefined;
        if (dup) {
          res.status(409).json({
            error: `Duplicate VPL Number "${vplNumber}" already exists at Serial #${dup.serialNumber}.`,
            duplicate: dup,
          });
          return;
        }
      }

      const realAmount = sanitizeAmount(body.realAmount);
      const invoiceAmount = sanitizeAmount(body.invoiceAmount);
      const parcelCharges = sanitizeAmount(body.parcelCharges);
      const vasool = sanitizeAmount(body.vasool);

      const settings = getSettingsRow();
      const metrics = calculateTransactionMetrics(
        { realAmount, invoiceAmount, parcelCharges, vasool },
        {
          profitFormula: settings.profitFormula,
          remainingFormula: settings.remainingFormula,
          naffaFormula: settings.naffaFormula,
        },
      );

      const timestamp = nowIso();
      const id = `tx_${crypto.randomUUID()}`;

      const created = db.transaction(() => {
        const serialNumber = getNextSerialNumber();
        const customerId = findOrCreateCustomer(customerName, mobileNumber, address, timestamp);

        db.prepare(`
          INSERT INTO transactions (
            id, serialNumber, date, time, vplNumber, customerId, customerName, mobileNumber, address,
            realAmount, invoiceAmount, profit, parcelCharges, vasool, naffaVasool, remainingAmount,
            remarks, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          serialNumber,
          date,
          time,
          vplNumber,
          customerId,
          customerName,
          mobileNumber,
          address,
          realAmount,
          invoiceAmount,
          metrics.profit,
          parcelCharges,
          vasool,
          metrics.naffaVasool,
          metrics.remainingAmount,
          remarks,
          timestamp,
          timestamp,
        );

        return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
      })();

      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save transaction' });
    }
  });

  app.put('/api/transactions/:id', requireAuth, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as
        | { id: string; serialNumber: number; customerId: string }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const body = req.body || {};
      const date = typeof body.date === 'string' ? body.date.trim() : '';
      const time = typeof body.time === 'string' ? body.time.trim() : '00:00';
      const vplNumber = typeof body.vplNumber === 'string' ? body.vplNumber.trim() : '';
      const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const mobileNumber = typeof body.mobileNumber === 'string' ? body.mobileNumber.trim() : '';
      const address = typeof body.address === 'string' ? body.address.trim() : '';
      const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
      const allowDuplicateVpl = Boolean(body.allowDuplicateVpl);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
        return;
      }
      if (!vplNumber || !customerName) {
        res.status(400).json({ error: 'VPL Number and Customer Name are required' });
        return;
      }

      if (!allowDuplicateVpl) {
        const dup = db
          .prepare(
            'SELECT id, serialNumber, vplNumber FROM transactions WHERE LOWER(vplNumber) = LOWER(?) AND id != ?',
          )
          .get(vplNumber, id) as { id: string; serialNumber: number; vplNumber: string } | undefined;
        if (dup) {
          res.status(409).json({
            error: `Duplicate VPL Number "${vplNumber}" already exists at Serial #${dup.serialNumber}.`,
            duplicate: dup,
          });
          return;
        }
      }

      const realAmount = sanitizeAmount(body.realAmount);
      const invoiceAmount = sanitizeAmount(body.invoiceAmount);
      const parcelCharges = sanitizeAmount(body.parcelCharges);
      const vasool = sanitizeAmount(body.vasool);

      const settings = getSettingsRow();
      const metrics = calculateTransactionMetrics(
        { realAmount, invoiceAmount, parcelCharges, vasool },
        {
          profitFormula: settings.profitFormula,
          remainingFormula: settings.remainingFormula,
          naffaFormula: settings.naffaFormula,
        },
      );

      const timestamp = nowIso();
      const updated = db.transaction(() => {
        const customerId = findOrCreateCustomer(customerName, mobileNumber, address, timestamp);

        db.prepare(`
          UPDATE transactions SET
            date = ?, time = ?, vplNumber = ?, customerId = ?, customerName = ?,
            mobileNumber = ?, address = ?, realAmount = ?, invoiceAmount = ?,
            profit = ?, parcelCharges = ?, vasool = ?, naffaVasool = ?,
            remainingAmount = ?, remarks = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          date,
          time,
          vplNumber,
          customerId,
          customerName,
          mobileNumber,
          address,
          realAmount,
          invoiceAmount,
          metrics.profit,
          parcelCharges,
          vasool,
          metrics.naffaVasool,
          metrics.remainingAmount,
          remarks,
          timestamp,
          id,
        );

        return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
      })();

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update transaction' });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const info = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/transactions/recalculate', requireAuth, (_req: Request, res: Response) => {
    const settings = getSettingsRow();
    const rows = db.prepare('SELECT * FROM transactions').all() as Array<{
      id: string;
      realAmount: number;
      invoiceAmount: number;
      parcelCharges: number;
      vasool: number;
    }>;

    const timestamp = nowIso();
    const updateStmt = db.prepare(
      'UPDATE transactions SET profit = ?, naffaVasool = ?, remainingAmount = ?, updatedAt = ? WHERE id = ?',
    );

    db.transaction(() => {
      for (const row of rows) {
        const metrics = calculateTransactionMetrics(
          {
            realAmount: row.realAmount,
            invoiceAmount: row.invoiceAmount,
            parcelCharges: row.parcelCharges,
            vasool: row.vasool,
          },
          {
            profitFormula: settings.profitFormula,
            remainingFormula: settings.remainingFormula,
            naffaFormula: settings.naffaFormula,
          },
        );
        updateStmt.run(
          metrics.profit,
          metrics.naffaVasool,
          metrics.remainingAmount,
          timestamp,
          row.id,
        );
      }
    })();

    res.json({ ok: true, recalculatedCount: rows.length });
  });

  // Customers CRUD
  app.get('/api/customers', requireAuth, (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC').all();
    res.json(rows);
  });

  app.post('/api/customers', requireAuth, (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const mobileNumber = typeof req.body?.mobileNumber === 'string' ? req.body.mobileNumber.trim() : '';
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

    if (!name) {
      res.status(400).json({ error: 'Customer name is required' });
      return;
    }

    const id = `cust_${crypto.randomUUID()}`;
    const ts = nowIso();
    db.prepare(
      'INSERT INTO customers (id, name, mobileNumber, address, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, name, mobileNumber, address, notes, ts, ts);

    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  });

  app.put('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const mobileNumber = typeof req.body?.mobileNumber === 'string' ? req.body.mobileNumber.trim() : '';
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

    if (!name) {
      res.status(400).json({ error: 'Customer name is required' });
      return;
    }

    const ts = nowIso();
    db.transaction(() => {
      db.prepare(
        'UPDATE customers SET name = ?, mobileNumber = ?, address = ?, notes = ?, updatedAt = ? WHERE id = ?',
      ).run(name, mobileNumber, address, notes, ts, id);

      db.prepare(
        'UPDATE transactions SET customerName = ?, mobileNumber = ?, address = ? WHERE customerId = ?',
      ).run(name, mobileNumber, address, id);
    })();

    res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  });

  app.delete('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const txCount = db
      .prepare('SELECT COUNT(*) as cnt FROM transactions WHERE customerId = ?')
      .get(id) as { cnt: number };
    if (txCount.cnt > 0) {
      res.status(400).json({
        error: 'Cannot delete a customer with existing transactions. Delete their transactions first.',
      });
      return;
    }
    const info = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Expenses CRUD
  app.get('/api/expenses', requireAuth, (_req: Request, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM expenses ORDER BY date DESC, expenseNumber DESC')
      .all();
    res.json(rows);
  });

  app.post('/api/expenses', requireAuth, (req: Request, res: Response) => {
    const body = req.body || {};
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const time = typeof body.time === 'string' ? body.time.trim() : '00:00';
    const category = VALID_EXPENSE_CATEGORIES.includes(body.category) ? body.category : 'Other';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = sanitizeAmount(body.amount);
    const paymentMethod = VALID_PAYMENT_METHODS.includes(body.paymentMethod)
      ? body.paymentMethod
      : 'Cash';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
      return;
    }
    if (amount <= 0) {
      res.status(400).json({ error: 'Expense amount must be greater than 0' });
      return;
    }

    const id = `exp_${crypto.randomUUID()}`;
    const ts = nowIso();
    const created = db.transaction(() => {
      const expenseNumber = getNextExpenseNumber();
      db.prepare(`
        INSERT INTO expenses (
          id, expenseNumber, date, time, category, description, amount, paymentMethod, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, expenseNumber, date, time, category, description, amount, paymentMethod, ts, ts);
      return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    })();

    res.status(201).json(created);
  });

  app.put('/api/expenses/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM expenses WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const body = req.body || {};
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const time = typeof body.time === 'string' ? body.time.trim() : '00:00';
    const category = VALID_EXPENSE_CATEGORIES.includes(body.category) ? body.category : 'Other';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = sanitizeAmount(body.amount);
    const paymentMethod = VALID_PAYMENT_METHODS.includes(body.paymentMethod)
      ? body.paymentMethod
      : 'Cash';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
      return;
    }
    if (amount <= 0) {
      res.status(400).json({ error: 'Expense amount must be greater than 0' });
      return;
    }

    db.prepare(`
      UPDATE expenses SET
        date = ?, time = ?, category = ?, description = ?, amount = ?, paymentMethod = ?, updatedAt = ?
      WHERE id = ?
    `).run(date, time, category, description, amount, paymentMethod, nowIso(), id);

    res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(id));
  });

  app.delete('/api/expenses/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Settings routes
  app.get('/api/settings', requireAuth, (_req: Request, res: Response) => {
    res.json(toPublicSettings(getSettingsRow()));
  });

  app.put('/api/settings', requireAuth, (req: Request, res: Response) => {
    const current = getSettingsRow();
    const body = req.body || {};

    const businessName =
      typeof body.businessName === 'string' && body.businessName.trim()
        ? body.businessName.trim().slice(0, 120)
        : current.businessName;
    const businessUrduName =
      typeof body.businessUrduName === 'string' && body.businessUrduName.trim()
        ? body.businessUrduName.trim().slice(0, 120)
        : current.businessUrduName;
    const businessPhone =
      typeof body.businessPhone === 'string'
        ? body.businessPhone.trim().slice(0, 60)
        : current.businessPhone;
    const businessEmail =
      typeof body.businessEmail === 'string'
        ? body.businessEmail.trim().slice(0, 120)
        : current.businessEmail;
    const businessAddress =
      typeof body.businessAddress === 'string'
        ? body.businessAddress.trim().slice(0, 300)
        : current.businessAddress;

    let businessLogo = current.businessLogo;
    if (typeof body.businessLogo === 'string') {
      if (body.businessLogo === '') {
        businessLogo = '';
      } else if (
        body.businessLogo.startsWith('data:image/') &&
        body.businessLogo.length <= 800_000
      ) {
        businessLogo = body.businessLogo;
      } else {
        res.status(400).json({ error: 'Logo image must be a valid image under 600KB' });
        return;
      }
    }

    const currency = VALID_CURRENCIES.includes(body.currency) ? body.currency : current.currency;
    const enableExchangeRate =
      typeof body.enableExchangeRate === 'boolean'
        ? body.enableExchangeRate
          ? 1
          : 0
        : current.enableExchangeRate;
    const exchangeRate =
      typeof body.exchangeRate === 'number' && Number.isFinite(body.exchangeRate) && body.exchangeRate > 0
        ? body.exchangeRate
        : current.exchangeRate;
    const targetCurrency = VALID_CURRENCIES.includes(body.targetCurrency)
      ? body.targetCurrency
      : current.targetCurrency;
    const dateFormat = VALID_DATE_FORMATS.includes(body.dateFormat)
      ? body.dateFormat
      : current.dateFormat;
    const language = VALID_LANGUAGES.includes(body.language) ? body.language : current.language;
    const profitFormula = VALID_PROFIT_FORMULAS.includes(body.profitFormula)
      ? body.profitFormula
      : current.profitFormula;
    const remainingFormula = VALID_REMAINING_FORMULAS.includes(body.remainingFormula)
      ? body.remainingFormula
      : current.remainingFormula;
    const naffaFormula = VALID_NAFFA_FORMULAS.includes(body.naffaFormula)
      ? body.naffaFormula
      : current.naffaFormula;

    db.prepare(`
      UPDATE settings SET
        businessName = ?, businessUrduName = ?, businessPhone = ?, businessEmail = ?,
        businessAddress = ?, businessLogo = ?, currency = ?, enableExchangeRate = ?,
        exchangeRate = ?, targetCurrency = ?, dateFormat = ?, language = ?,
        profitFormula = ?, remainingFormula = ?, naffaFormula = ?, updatedAt = ?
      WHERE id = 'default'
    `).run(
      businessName,
      businessUrduName,
      businessPhone,
      businessEmail,
      businessAddress,
      businessLogo,
      currency,
      enableExchangeRate,
      exchangeRate,
      targetCurrency,
      dateFormat,
      language,
      profitFormula,
      remainingFormula,
      naffaFormula,
      nowIso(),
    );

    res.json(toPublicSettings(getSettingsRow()));
  });

  // Backups & Restore routes
  app.get('/api/backups', requireAuth, (_req: Request, res: Response) => {
    const rows = db
      .prepare(
        'SELECT id, label, createdAt, transactionCount, customerCount, expenseCount FROM backups ORDER BY createdAt DESC LIMIT 25',
      )
      .all();
    res.json(rows);
  });

  app.post('/api/backups', requireAuth, (req: Request, res: Response) => {
    const ts = nowIso();
    const label =
      typeof req.body?.label === 'string' && req.body.label.trim()
        ? req.body.label.trim().slice(0, 120)
        : `Manual Backup ${ts.slice(0, 10)}`;

    const transactions = db.prepare('SELECT * FROM transactions ORDER BY serialNumber ASC').all();
    const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY expenseNumber ASC').all();
    const settings = toPublicSettings(getSettingsRow());

    const payload: BackupPayload = {
      version: 1,
      exportedAt: ts,
      appName: 'Sehat Ki Duniya',
      transactions: transactions as BackupPayload['transactions'],
      customers: customers as BackupPayload['customers'],
      expenses: expenses as BackupPayload['expenses'],
      settings,
    };

    const id = `bkp_${crypto.randomUUID()}`;
    db.transaction(() => {
      db.prepare(`
        INSERT INTO backups (id, label, createdAt, transactionCount, customerCount, expenseCount, payloadJson)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, label, ts, transactions.length, customers.length, expenses.length, JSON.stringify(payload));

      db.prepare('UPDATE settings SET lastBackupAt = ?, updatedAt = ? WHERE id = ?').run(
        ts,
        ts,
        'default',
      );
    })();

    res.status(201).json({
      metadata: {
        id,
        label,
        createdAt: ts,
        transactionCount: transactions.length,
        customerCount: customers.length,
        expenseCount: expenses.length,
      },
      payload,
    });
  });

  app.get('/api/backups/:id/download', requireAuth, (req: Request, res: Response) => {
    const row = db
      .prepare('SELECT payloadJson FROM backups WHERE id = ?')
      .get(req.params.id) as { payloadJson: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.json(JSON.parse(row.payloadJson));
  });

  app.delete('/api/backups/:id', requireAuth, (req: Request, res: Response) => {
    const info = db.prepare('DELETE FROM backups WHERE id = ?').run(req.params.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/backups/restore', requireAuth, (req: Request, res: Response) => {
    try {
      let payload: BackupPayload | null = null;
      if (typeof req.body?.backupId === 'string') {
        const row = db
          .prepare('SELECT payloadJson FROM backups WHERE id = ?')
          .get(req.body.backupId) as { payloadJson: string } | undefined;
        if (!row) {
          res.status(404).json({ error: 'Saved backup not found' });
          return;
        }
        payload = JSON.parse(row.payloadJson) as BackupPayload;
      } else if (req.body?.payload && typeof req.body.payload === 'object') {
        payload = req.body.payload as BackupPayload;
      }

      if (
        !payload ||
        !Array.isArray(payload.transactions) ||
        !Array.isArray(payload.customers) ||
        !Array.isArray(payload.expenses)
      ) {
        res.status(400).json({ error: 'Invalid backup file format' });
        return;
      }

      const ts = nowIso();
      db.transaction(() => {
        db.prepare('DELETE FROM transactions').run();
        db.prepare('DELETE FROM customers').run();
        db.prepare('DELETE FROM expenses').run();

        const insertCust = db.prepare(`
          INSERT INTO customers (id, name, mobileNumber, address, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of payload!.customers) {
          insertCust.run(
            String(c.id || `cust_${crypto.randomUUID()}`),
            String(c.name || 'Unnamed'),
            String(c.mobileNumber || ''),
            String(c.address || ''),
            String(c.notes || ''),
            String(c.createdAt || ts),
            String(c.updatedAt || ts),
          );
        }

        const insertTx = db.prepare(`
          INSERT INTO transactions (
            id, serialNumber, date, time, vplNumber, customerId, customerName, mobileNumber, address,
            realAmount, invoiceAmount, profit, parcelCharges, vasool, naffaVasool, remainingAmount,
            remarks, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        let fallbackSerial = 1;
        for (const tx of payload!.transactions) {
          const serial = Number.isInteger(tx.serialNumber) ? tx.serialNumber : fallbackSerial++;
          insertTx.run(
            String(tx.id || `tx_${crypto.randomUUID()}`),
            serial,
            String(tx.date || ts.slice(0, 10)),
            String(tx.time || '00:00'),
            String(tx.vplNumber || `VPL-${serial}`),
            String(tx.customerId || ''),
            String(tx.customerName || 'Unknown'),
            String(tx.mobileNumber || ''),
            String(tx.address || ''),
            sanitizeAmount(tx.realAmount),
            sanitizeAmount(tx.invoiceAmount),
            Number.isFinite(Number(tx.profit)) ? Number(tx.profit) : 0,
            sanitizeAmount(tx.parcelCharges),
            sanitizeAmount(tx.vasool),
            Number.isFinite(Number(tx.naffaVasool)) ? Number(tx.naffaVasool) : 0,
            Number.isFinite(Number(tx.remainingAmount)) ? Number(tx.remainingAmount) : 0,
            String(tx.remarks || ''),
            String(tx.createdAt || ts),
            String(tx.updatedAt || ts),
          );
        }

        const insertExp = db.prepare(`
          INSERT INTO expenses (
            id, expenseNumber, date, time, category, description, amount, paymentMethod, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        let fallbackExpNum = 1;
        for (const exp of payload!.expenses) {
          const expNum = Number.isInteger(exp.expenseNumber) ? exp.expenseNumber : fallbackExpNum++;
          insertExp.run(
            String(exp.id || `exp_${crypto.randomUUID()}`),
            expNum,
            String(exp.date || ts.slice(0, 10)),
            String(exp.time || '00:00'),
            VALID_EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : 'Other',
            String(exp.description || ''),
            sanitizeAmount(exp.amount),
            VALID_PAYMENT_METHODS.includes(exp.paymentMethod) ? exp.paymentMethod : 'Cash',
            String(exp.createdAt || ts),
            String(exp.updatedAt || ts),
          );
        }

        if (payload!.settings) {
          const s = payload!.settings;
          const current = getSettingsRow();
          db.prepare(`
            UPDATE settings SET
              businessName = ?, businessUrduName = ?, businessPhone = ?, businessEmail = ?,
              businessAddress = ?, currency = ?, dateFormat = ?, language = ?,
              profitFormula = ?, remainingFormula = ?, naffaFormula = ?, updatedAt = ?
            WHERE id = 'default'
          `).run(
            s.businessName || current.businessName,
            s.businessUrduName || current.businessUrduName,
            s.businessPhone ?? current.businessPhone,
            s.businessEmail ?? current.businessEmail,
            s.businessAddress ?? current.businessAddress,
            s.currency && VALID_CURRENCIES.includes(s.currency) ? s.currency : current.currency,
            s.dateFormat && VALID_DATE_FORMATS.includes(s.dateFormat)
              ? s.dateFormat
              : current.dateFormat,
            s.language && VALID_LANGUAGES.includes(s.language) ? s.language : current.language,
            s.profitFormula && VALID_PROFIT_FORMULAS.includes(s.profitFormula)
              ? s.profitFormula
              : current.profitFormula,
            s.remainingFormula && VALID_REMAINING_FORMULAS.includes(s.remainingFormula)
              ? s.remainingFormula
              : current.remainingFormula,
            s.naffaFormula && VALID_NAFFA_FORMULAS.includes(s.naffaFormula)
              ? s.naffaFormula
              : current.naffaFormula,
            ts,
          );
        }
      })();

      res.json({
        ok: true,
        restored: {
          transactions: payload.transactions.length,
          customers: payload.customers.length,
          expenses: payload.expenses.length,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to restore backup' });
    }
  });

  // Vite middleware in dev or static serving in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sehat Ki Duniya server running on http://0.0.0.0:${PORT}`);
  });
}

createAppServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
