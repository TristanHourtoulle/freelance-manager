import type { BankTransactionRow } from "@/lib/schemas/bank-transaction"

/**
 * Abstract bank data provider interface.
 * Implement this to add new bank data sources (CSV, Open Banking API, etc.)
 */
export interface BankProvider {
  /** Unique identifier for this provider. */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** Whether this provider requires API credentials. */
  readonly requiresAuth: boolean
  /** Fetch transactions from the provider. */
  fetchTransactions(options: FetchOptions): Promise<BankProviderResult>
}

interface FetchOptions {
  /** For CSV providers: raw CSV content. */
  csvContent?: string
  /** For API providers: date range start. */
  dateFrom?: Date
  /** For API providers: date range end. */
  dateTo?: Date
  /** For API providers: the connected account/item ID. */
  accountId?: string
}

interface BankProviderResult {
  transactions: BankTransactionRow[]
  bankName: string
  /** Provider-specific metadata (account info, sync cursor, etc.) */
  metadata?: Record<string, unknown>
}

// --- CSV Provider (current implementation) ---

import { parseBankCsv } from "@/lib/bank-import-parser"

class CsvBankProvider implements BankProvider {
  readonly id = "csv"
  readonly name = "CSV Import"
  readonly requiresAuth = false

  async fetchTransactions(options: FetchOptions): Promise<BankProviderResult> {
    if (!options.csvContent) {
      throw new Error("CSV content is required for CSV provider")
    }
    return parseBankCsv(options.csvContent)
  }
}

// --- Provider Registry ---

const providers = new Map<string, BankProvider>()

/** Register a bank data provider. */
export function registerBankProvider(provider: BankProvider): void {
  providers.set(provider.id, provider)
}

/** Get a bank provider by ID. */
export function getBankProvider(id: string): BankProvider | undefined {
  return providers.get(id)
}

/** List all registered bank providers. */
export function listBankProviders(): BankProvider[] {
  return [...providers.values()]
}

// Register built-in providers
registerBankProvider(new CsvBankProvider())

// Future Open Banking providers can be registered here:
// registerBankProvider(new BridgeBankProvider())
// registerBankProvider(new PlaidBankProvider())
// registerBankProvider(new GoCardlessBankProvider())
