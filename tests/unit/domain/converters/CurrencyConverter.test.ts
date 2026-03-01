/**
 * Currency Converter Tests
 *
 * Tests currency conversion logic with date-aware caching and exchange rate integration.
 * Validates requirements from requirements-catalogue.md and use-cases.md.
 *
 * Requirements Tested:
 * - FR-003: Currency Standardization (all amounts in GBP)
 * - FR-004: Currency Conversion (non-GBP to GBP)
 * - FR-007: Exchange Rate API Integration (fetch once per date/currency pair)
 * - FR-009: Network Retry Mechanism (handled by ExchangeRatePort)
 * - UC-001: Import and Normalize Transactions
 *
 * Business Rules:
 * - GBP transactions require no conversion
 * - Exchange rates cached per (date, currency) pair
 * - Batch operations optimize API calls via date range
 * - Cache can be cleared between runs
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CurrencyConverter } from '../../../../src/apps-script/domain/converters/CurrencyConverter';
import { ExchangeRatePort, ExchangeRate } from '../../../../src/apps-script/domain/ports/ExchangeRatePort';
import { CurrencyCode, Transaction, ProcessingStatus, TransactionType } from '../../../../src/apps-script/models/Transaction';
import { BankSourceId } from '../../../../src/apps-script/models/BankSource';

// Mock ExchangeRatePort with date-aware interface
class MockExchangeRatePort implements ExchangeRatePort {
  private mockRates: Map<string, number> = new Map();
  public callCount = 0;
  public batchCallCount = 0;
  public lastBatchStartDate: string | null = null;
  public lastBatchEndDate: string | null = null;

  /**
   * Set a mock rate. If date is provided, rate is date-specific.
   * If no date, rate applies to any date (fallback).
   */
  setMockRate(currency: CurrencyCode, rate: number, date?: string): void {
    const key = date ? `${date}:${currency}` : `any:${currency}`;
    this.mockRates.set(key, rate);
  }

  private getRate(currency: CurrencyCode, date: string): number | undefined {
    return this.mockRates.get(`${date}:${currency}`) ?? this.mockRates.get(`any:${currency}`);
  }

  async getExchangeRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode, date: string): Promise<ExchangeRate> {
    this.callCount++;
    const rate = this.getRate(fromCurrency, date);

    if (rate === undefined) {
      throw new Error(`No mock rate configured for ${fromCurrency} on ${date}`);
    }

    return {
      baseCurrency: toCurrency,
      targetCurrency: fromCurrency,
      rate,
      rateDate: date,
      fetchedAt: new Date(),
      provider: 'mock-provider'
    };
  }

  async getExchangeRatesBatchByDateRange(
    currencies: CurrencyCode[],
    toCurrency: CurrencyCode,
    startDate: string,
    endDate: string
  ): Promise<Map<string, Map<CurrencyCode, ExchangeRate>>> {
    this.batchCallCount++;
    this.lastBatchStartDate = startDate;
    this.lastBatchEndDate = endDate;

    const results = new Map<string, Map<CurrencyCode, ExchangeRate>>();

    // Generate all dates in range
    const current = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dateMap = new Map<CurrencyCode, ExchangeRate>();

      for (const currency of currencies) {
        const rate = this.getRate(currency, dateStr);
        if (rate !== undefined) {
          dateMap.set(currency, {
            baseCurrency: toCurrency,
            targetCurrency: currency,
            rate,
            rateDate: dateStr,
            fetchedAt: new Date(),
            provider: 'mock-provider'
          });
        }
      }

      if (dateMap.size > 0) {
        results.set(dateStr, dateMap);
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return results;
  }

  clearCache(): void {
    // Mock implementation
  }

  reset(): void {
    this.callCount = 0;
    this.batchCallCount = 0;
    this.lastBatchStartDate = null;
    this.lastBatchEndDate = null;
  }
}

// Test fixture: Create sample transaction
const createTransaction = (
  amount: number,
  currency: CurrencyCode,
  id: string = 'txn-123',
  date: Date = new Date('2025-11-15')
): Transaction => ({
  id,
  bankSourceId: BankSourceId.MONZO,
  originalTransactionId: 'original-123',
  transactionDate: date,
  transactionType: TransactionType.DEBIT,
  description: 'Test Transaction',
  notes: null,
  country: null,
  originalAmountValue: amount,
  originalAmountCurrency: currency,
  gbpAmountValue: 0,
  processingStatus: ProcessingStatus.UNPROCESSED,
  errorMessage: null,
  exchangeRateValue: null,
  categoryAiId: null,
  categoryAiName: null,
  categoryConfidenceScore: null,
  categoryManualId: null,
  categoryManualName: null,
  timestampCreated: new Date(),
  timestampLastModified: new Date(),
  timestampNormalised: null,
  timestampCategorised: null
});

describe('CurrencyConverter', () => {
  let mockPort: MockExchangeRatePort;
  let converter: CurrencyConverter;
  const processingRunId = 'run-12345';

  beforeEach(() => {
    mockPort = new MockExchangeRatePort();
    converter = new CurrencyConverter(mockPort, processingRunId);

    // Setup common mock rates (apply to any date)
    mockPort.setMockRate(CurrencyCode.USD, 0.79);  // 1 USD = 0.79 GBP
    mockPort.setMockRate(CurrencyCode.EUR, 0.85);  // 1 EUR = 0.85 GBP
    mockPort.setMockRate(CurrencyCode.JPY, 0.0053); // 1 JPY = 0.0053 GBP
  });

  describe('convertToGBP - GBP transactions (FR-003)', () => {
    test('FR-003: Given GBP transaction, when converted, then returns amount unchanged', async () => {
      const transaction = createTransaction(100.00, CurrencyCode.GBP);

      const result = await converter.convertToGBP(transaction);

      expect(result.gbpAmount).toBe(100.00);
      expect(result.exchangeRate).toBeNull();
      expect(result.snapshot).toBeNull();
      expect(mockPort.callCount).toBe(0);
    });

    test('FR-003: Given GBP transaction with decimal amount, when converted, then preserves precision', async () => {
      const transaction = createTransaction(42.99, CurrencyCode.GBP);

      const result = await converter.convertToGBP(transaction);

      expect(result.gbpAmount).toBe(42.99);
      expect(result.exchangeRate).toBeNull();
      expect(mockPort.callCount).toBe(0);
    });
  });

  describe('convertToGBP - Non-GBP transactions (FR-004)', () => {
    test('FR-004: Given USD transaction, when converted, then applies correct exchange rate', async () => {
      const transaction = createTransaction(100.00, CurrencyCode.USD);

      const result = await converter.convertToGBP(transaction);

      expect(result.gbpAmount).toBe(79.00);
      expect(result.exchangeRate).toBe(0.79);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot?.targetCurrency).toBe(CurrencyCode.USD);
      expect(result.snapshot?.baseCurrency).toBe(CurrencyCode.GBP);
      expect(result.snapshot?.rateDate).toBe('2025-11-15');
      expect(mockPort.callCount).toBe(1);
    });

    test('FR-004: Given EUR transaction, when converted, then applies EUR rate', async () => {
      const transaction = createTransaction(50.00, CurrencyCode.EUR);

      const result = await converter.convertToGBP(transaction);

      expect(result.gbpAmount).toBe(42.50);
      expect(result.exchangeRate).toBe(0.85);
      expect(result.snapshot?.targetCurrency).toBe(CurrencyCode.EUR);
    });

    test('FR-004: Given JPY transaction, when converted, then handles small exchange rate', async () => {
      const transaction = createTransaction(10000, CurrencyCode.JPY);

      const result = await converter.convertToGBP(transaction);

      expect(result.gbpAmount).toBe(53.00);
      expect(result.exchangeRate).toBe(0.0053);
    });

    test('FR-004: Given transaction amount with decimals, when converted, then calculates correctly', async () => {
      const transaction = createTransaction(123.45, CurrencyCode.USD);

      const result = await converter.convertToGBP(transaction);

      expect(result.gbpAmount).toBeCloseTo(97.53, 2);
    });
  });

  describe('Exchange rate caching (FR-007)', () => {
    test('FR-007: Given same currency and date twice, when converted, then fetches rate only once', async () => {
      const transaction1 = createTransaction(100, CurrencyCode.USD, 'txn-1');
      const transaction2 = createTransaction(200, CurrencyCode.USD, 'txn-2');

      await converter.convertToGBP(transaction1);
      await converter.convertToGBP(transaction2);

      expect(mockPort.callCount).toBe(1);
      expect(converter.getCacheSize()).toBe(1);
    });

    test('FR-007: Given same currency on different dates, when converted, then fetches rate for each date', async () => {
      const txn1 = createTransaction(100, CurrencyCode.USD, 'txn-1', new Date('2025-01-10'));
      const txn2 = createTransaction(100, CurrencyCode.USD, 'txn-2', new Date('2025-01-11'));

      await converter.convertToGBP(txn1);
      await converter.convertToGBP(txn2);

      // Two different dates = two API calls, two cache entries
      expect(mockPort.callCount).toBe(2);
      expect(converter.getCacheSize()).toBe(2);
    });

    test('FR-007: Given multiple currencies, when converted, then caches each separately', async () => {
      const usdTxn = createTransaction(100, CurrencyCode.USD, 'txn-1');
      const eurTxn = createTransaction(100, CurrencyCode.EUR, 'txn-2');
      const usdTxn2 = createTransaction(50, CurrencyCode.USD, 'txn-3');

      await converter.convertToGBP(usdTxn);
      await converter.convertToGBP(eurTxn);
      await converter.convertToGBP(usdTxn2);

      expect(mockPort.callCount).toBe(2); // USD and EUR
      expect(converter.getCacheSize()).toBe(2);
    });

    test('FR-007: Given cached rates, when retrieved, then returns snapshots with processing run ID', async () => {
      const transaction = createTransaction(100, CurrencyCode.USD);

      await converter.convertToGBP(transaction);
      const snapshots = converter.getExchangeRateSnapshots();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].processingRunId).toBe(processingRunId);
      expect(snapshots[0].targetCurrency).toBe(CurrencyCode.USD);
      expect(snapshots[0].rate).toBe(0.79);
      expect(snapshots[0].rateDate).toBe('2025-11-15');
      expect(snapshots[0].provider).toBe('mock-provider');
    });

    test('FR-007: Given cache cleared, when same currency converted, then fetches rate again', async () => {
      const transaction = createTransaction(100, CurrencyCode.USD);

      await converter.convertToGBP(transaction);
      expect(mockPort.callCount).toBe(1);

      converter.clearCache();
      mockPort.reset();

      await converter.convertToGBP(transaction);

      expect(mockPort.callCount).toBe(1);
      expect(converter.getCacheSize()).toBe(1);
    });
  });

  describe('convertBatchToGBP - Batch operations (FR-007)', () => {
    test('UC-001: Given multiple transactions, when batch converted, then processes all correctly', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.GBP, 'txn-1'),
        createTransaction(200, CurrencyCode.USD, 'txn-2'),
        createTransaction(150, CurrencyCode.EUR, 'txn-3'),
        createTransaction(50, CurrencyCode.USD, 'txn-4')
      ];

      const results = await converter.convertBatchToGBP(transactions);

      expect(results.size).toBe(4);
      expect(results.get('txn-1')?.gbpAmount).toBe(100);
      expect(results.get('txn-2')?.gbpAmount).toBe(158);
      expect(results.get('txn-3')?.gbpAmount).toBe(127.5);
      expect(results.get('txn-4')?.gbpAmount).toBe(39.5);
    });

    test('FR-007: Given batch with multiple currencies, when converted, then fetches rates in single batch call', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.USD, 'txn-1'),
        createTransaction(200, CurrencyCode.EUR, 'txn-2'),
        createTransaction(150, CurrencyCode.USD, 'txn-3')
      ];

      await converter.convertBatchToGBP(transactions);

      expect(mockPort.batchCallCount).toBe(1);
      expect(mockPort.callCount).toBe(0); // No individual calls needed
      expect(converter.getCacheSize()).toBe(2); // USD and EUR cached
    });

    test('FR-007: Given batch spanning multiple dates, when converted, then uses correct date range', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.USD, 'txn-1', new Date('2025-01-05')),
        createTransaction(200, CurrencyCode.EUR, 'txn-2', new Date('2025-01-20')),
        createTransaction(150, CurrencyCode.USD, 'txn-3', new Date('2025-01-10'))
      ];

      await converter.convertBatchToGBP(transactions);

      expect(mockPort.batchCallCount).toBe(1);
      expect(mockPort.lastBatchStartDate).toBe('2025-01-05');
      expect(mockPort.lastBatchEndDate).toBe('2025-01-20');
    });

    test('FR-007: Given batch with only GBP, when converted, then makes no API calls', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.GBP, 'txn-1'),
        createTransaction(200, CurrencyCode.GBP, 'txn-2')
      ];

      const results = await converter.convertBatchToGBP(transactions);

      expect(mockPort.batchCallCount).toBe(0);
      expect(mockPort.callCount).toBe(0);
      expect(results.size).toBe(2);
    });

    test('FR-007: Given large batch with repeated currencies, when converted, then fetches each currency once', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.USD, 'txn-1'),
        createTransaction(100, CurrencyCode.EUR, 'txn-2'),
        createTransaction(100, CurrencyCode.JPY, 'txn-3'),
        createTransaction(100, CurrencyCode.USD, 'txn-4'),
        createTransaction(100, CurrencyCode.EUR, 'txn-5'),
        createTransaction(100, CurrencyCode.USD, 'txn-6'),
        createTransaction(100, CurrencyCode.JPY, 'txn-7'),
        createTransaction(100, CurrencyCode.USD, 'txn-8'),
        createTransaction(100, CurrencyCode.EUR, 'txn-9'),
        createTransaction(100, CurrencyCode.USD, 'txn-10')
      ];

      await converter.convertBatchToGBP(transactions);

      expect(mockPort.batchCallCount).toBe(1);
      expect(converter.getCacheSize()).toBe(3);
    });
  });

  describe('Exchange rate snapshots (audit trail)', () => {
    test('UC-001: Given multiple conversions, when snapshots retrieved, then includes all currencies', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.USD, 'txn-1'),
        createTransaction(200, CurrencyCode.EUR, 'txn-2'),
        createTransaction(300, CurrencyCode.JPY, 'txn-3')
      ];

      await converter.convertBatchToGBP(transactions);
      const snapshots = converter.getExchangeRateSnapshots();

      expect(snapshots).toHaveLength(3);
      expect(snapshots.map(s => s.targetCurrency)).toContain(CurrencyCode.USD);
      expect(snapshots.map(s => s.targetCurrency)).toContain(CurrencyCode.EUR);
      expect(snapshots.map(s => s.targetCurrency)).toContain(CurrencyCode.JPY);
    });

    test('FR-007: Given no conversions, when snapshots retrieved, then returns empty array', async () => {
      const snapshots = converter.getExchangeRateSnapshots();
      expect(snapshots).toHaveLength(0);
    });

    test('FR-003: Given only GBP conversions, when snapshots retrieved, then returns empty array', async () => {
      const transactions = [
        createTransaction(100, CurrencyCode.GBP, 'txn-1'),
        createTransaction(200, CurrencyCode.GBP, 'txn-2')
      ];

      await converter.convertBatchToGBP(transactions);
      const snapshots = converter.getExchangeRateSnapshots();

      expect(snapshots).toHaveLength(0);
    });

    test('Given conversions on different dates, when snapshots retrieved, then includes rateDate', async () => {
      const txn1 = createTransaction(100, CurrencyCode.USD, 'txn-1', new Date('2025-01-10'));
      const txn2 = createTransaction(100, CurrencyCode.USD, 'txn-2', new Date('2025-01-15'));

      await converter.convertToGBP(txn1);
      await converter.convertToGBP(txn2);
      const snapshots = converter.getExchangeRateSnapshots();

      expect(snapshots).toHaveLength(2);
      const rateDates = snapshots.map(s => s.rateDate).sort();
      expect(rateDates).toEqual(['2025-01-10', '2025-01-15']);
    });
  });

  describe('Error handling (FR-008)', () => {
    test('FR-008: Given rate fetch fails, when converted, then throws error', async () => {
      const transaction = createTransaction(100, CurrencyCode.CAD); // No mock rate for CAD

      await expect(converter.convertToGBP(transaction))
        .rejects
        .toThrow('No mock rate configured for CAD');
    });
  });

  describe('Cache management', () => {
    test('Given cache cleared, when size checked, then returns zero', async () => {
      const transaction = createTransaction(100, CurrencyCode.USD);

      await converter.convertToGBP(transaction);
      converter.clearCache();

      expect(converter.getCacheSize()).toBe(0);
    });

    test('Given multiple rates cached, when size checked, then returns correct count', async () => {
      await converter.convertToGBP(createTransaction(100, CurrencyCode.USD, 'txn-1'));
      await converter.convertToGBP(createTransaction(100, CurrencyCode.EUR, 'txn-2'));
      await converter.convertToGBP(createTransaction(100, CurrencyCode.JPY, 'txn-3'));

      const size = converter.getCacheSize();

      expect(size).toBe(3);
    });

    test('Given rates on different dates, when size checked, then counts each date/currency pair', async () => {
      await converter.convertToGBP(createTransaction(100, CurrencyCode.USD, 'txn-1', new Date('2025-01-10')));
      await converter.convertToGBP(createTransaction(100, CurrencyCode.USD, 'txn-2', new Date('2025-01-11')));
      await converter.convertToGBP(createTransaction(100, CurrencyCode.EUR, 'txn-3', new Date('2025-01-10')));

      expect(converter.getCacheSize()).toBe(3); // USD@Jan10, USD@Jan11, EUR@Jan10
    });
  });
});
