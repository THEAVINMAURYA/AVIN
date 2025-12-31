
export enum TransactionType { 
  INCOME = 'income', 
  EXPENSE = 'expense', 
  PURCHASE = 'purchase', 
  SALE = 'sale' 
}

export enum AccountType { 
  BANK = 'bank', 
  LOAN = 'loan', 
  CASH = 'cash' 
}

export enum PartyType { 
  VENDOR = 'vendor', 
  CUSTOMER = 'customer' 
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
}

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  phone: string;
  email: string;
  address?: string;
  openingBalance: number; // Positive = Receivable, Negative = Payable
  currentBalance: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  description: string;
  category: string;
  account?: string; 
  partyId?: string; 
  amount: number;
  notes: string;
  inventoryItems?: { itemId: string, qty: number, price: number }[];
}

export interface Account {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  type: AccountType;
  openingBalance: number;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  limit: number;
}

export interface InvestmentTrade {
  id: string;
  date: string;
  type: 'buy' | 'sell';
  qty: number;
  price: number;
  charges: number;
}

export interface Investment {
  id: string;
  name: string;
  assetType: 'Stock' | 'MF' | 'Gold' | 'Crypto' | 'Real Estate' | 'FD' | 'Other';
  qty: number;
  avgBuyPrice: number;
  currPrice: number;
  history: InvestmentTrade[];
  status: 'active' | 'closed';
  totalRealizedPL: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  photos: string[];
}

export interface CredentialItem {
  label: string;
  user: string;
  pass: string;
  subPass?: string;
  link: string;
}

export interface Credential {
  id: string;
  clientName: string;
  email: string;
  items: CredentialItem[];
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
}

export interface Task {
  id: string;
  content: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

export interface AppData {
  auth: { userId: string; password: string };
  sync: {
    syncId: string;
    autoSync: boolean;
    lastSynced: string;
  };
  transactions: Transaction[];
  accounts: Account[];
  parties: Party[];
  inventory: InventoryItem[];
  credentials: Credential[];
  categories: { income: string[]; expense: string[] };
  journal: JournalEntry[];
  budgets: Budget[];
  goals: Goal[];
  investments: Investment[];
  tasks: Task[];
}