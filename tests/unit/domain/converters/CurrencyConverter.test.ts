/**
 * Currency Converter Tests
 *
 * Tests currency conversion logic with caching and exchange rate integration.
 * Validates requirements from requirements-catalogue.md and use-cases.md.
 *
 * Requirements Tested:
 * - FR-003: Currency Standardization (all amounts in GBP)
 * - FR-004: Currency Conversion (non-GBP to GBP)
 * - FR-007: Exchange Rate API Integration (fetch once per run)
 * - FR-009: Network Retry Mechanism (handled by ExchangeRatePort)
 * - UC-001: Import and Normalize Transactions
 *
 * Business Rules:
 * - GBP transactions require no conversion
 * - Exchange rates cached per processing run
 * - Batch operations optimize API calls
 * - Cache can be cleared between runs
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CurrencyConverter } from '../../../../src/apps-script/domain/converters/CurrencyConverter';
import { ExchangeRatePort, ExchangeRate } from '../../../../src/apps-script/domain/ports/ExchangeRatePort';
import { CurrencyCode, Transaction, ProcessingStatus, TransactionType } from '../../../../src/apps-script/models/Transaction';
import { BankSourceId } from '../../../../src/apps-script/models/BankSource';

// Mock ExchangeRatePort
class MockExchangeRatePort implements ExchangeRatePort {
  private mockRates: Map<CurrencyCode, number> = new Map();
  public callCount = 0;
  public batchCallCount = 0;

  setMockRate(currency: CurrencyCode, rate: number): void {
    this.mockRates.set(currency, rate);
  }

  async getExchangeRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<ExchangeRate> {
    this.callCount++;
    const rate = this.mockRates.get(fromCurrency);

    if (!rate) {
      throw new Error(`No mock rate configured for ${fromCurrency}`);
    }

    return {
      baseCurrency: toCurrency,
      targetCurrency: fromCurrency,
      rate,
      fetchedAt: new Date(),
      provider: 'mock-provider'
    };
  }

  async getExchangeRatesBatch(
    currencies: CurrencyCode[],
    toCurrency: CurrencyCode
  ): Promise<Map<CurrencyCode, ExchangeRate>> {
    this.batchCallCount++;
    const results = new Map<CurrencyCode, ExchangeRate>();

    currencies.forEach(currency => {
      const rate = this.mockRates.get(currency);
      if (rate) {
        results.set(currency, {
          baseCurrency: toCurrency,
          targetCurrency: currency,
          rate,
          fetchedAt: new Date(),
          provider: 'mock-provider'
        });
      }
    });

    return results;
  }

  clearCache(): void {
    // Mock implementation
  }

  reset(): void {
    this.callCount = 0;
    this.batchCallCount = 0;
  }
}

// Test fixture: Create sample transaction
const createTransaction = (
  amount: number,
  currency: CurrencyCode,
  id: string = 'txn-123'
): Transaction => ({
  id,
  bankSourceId: BankSourceId.MONZO,
  originalTransactionId: 'original-123',
  transactionDate: new Date('2025-11-15'),
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

    // Setup common mock rates
    mockPort.setMockRate(CurrencyCode.USD, 0.79);  // 1 USD = 0.79 GBP
    mockPort.setMockRate(CurrencyCode.EUR, 0.85);  // 1 EUR = 0.85 GBP
    mockPort.setMockRate(CurrencyCode.JPY, 0.0053); // 1 JPY = 0.0053 GBP
  });

  describe('convertToGBP - GBP transactions (FR-003)', () => {
    test('FR-003: Given GBP transaction, when converted, then returns amount unchanged', async () => {
      // Arrange
      const transaction = createTransaction(100.00, CurrencyCode.GBP);

      // Act
      const result = await converter.convertToGBP(transaction);

      // Assert - FR-003: GBP amounts require no conversion
      expect(result.gbpAmount).toBe(100.00);
      expect(result.exchangeRate).toBeNull();
      expect(result.snapshot).toBeNull();
      expect(mockPort.callCount).toBe(0); // No API call needed
    });

    test('FR-003: Given GBP transaction with decimal amount, when converted, then preserves precision', async () => {
      // Arrange
      const transaction = createTransaction(42.99, CurrencyCode.GBP);

      // Act
      const result = await converter.convertToGBP(transaction);

      // Assert
      expect(result.gbpAmount).toBe(42.99);
      expect(result.exchangeRate).toBeNull();
      expect(mockPort.callCount).toBe(0);
    });
  });

  describe('convertToGBP - Non-GBP transactions (FR-004)', () => {
    test('FR-004: Given USD transaction, when converted, then applies correct exchange rate', async () => {
      // Arrange
      const transaction = createTransaction(100.00, CurrencyCode.USD);

      // Act
      const result = await converter.convertToGBP(transaction);

      // Assert - FR-004: Non-GBP amounts converted using exchange rate
      expect(result.gbpAmount).toBe(79.00); // 100 * 0.79
      expect(result.exchangeRate).toBe(0.79);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot?.targetCurrency).toBe(CurrencyCode.USD);
      expect(result.snapshot?.baseCurrency).toBe(CurrencyCode.GBP);
      expect(mockPort.callCount).toBe(1);
    });

    test('FR-004: Given EUR transaction, when converted, then applies EUR rate', async () => {
      // Arrange
      const transaction = createTransaction(50.00, CurrencyCode.EUR);

      // Act
      const result = await converter.convertToGBP(transaction);

      // Assert
      expect(result.gbpAmount).toBe(42.50); // 50 * 0.85
      expect(result.exchangeRate).toBe(0.85);
      expect(result.snapshot?.targetCurrency).toBe(CurrencyCode.EUR);
    });

    test('FR-004: Given JPY transaction, when converted, then handles small exchange rate', async () => {
      // Arrange
      const transaction = createTransaction(10000, CurrencyCode.JPY);

      // Act
      const result = await converter.convertToGBP(transaction);

      // Assert
      expect(result.gbpAmount).toBe(53.00); // 10000 * 0.0053
      expect(result.exchangeRate).toBe(0.0053);
    });

    test('FR-004: Given transaction amount with decimals, when converted, then calculates correctly', async () => {
      // Arrange
      const transaction = createTransaction(123.45, CurrencyCode.USD);

      // Act
      const result = await converter.convertToGBP(transaction);

      // Assert
      expect(result.gbpAmount).toBeCloseTo(97.53, 2); // 123.45 * 0.79
    });
  });

  describe('Exchange rate caching (FR-007)', () => {
    test('FR-007: Given same currency twice, when converted, then fetches rate only once', async () => {
      // Arrange
      const transaction1 = createTransaction(100, CurrencyCode.USD, 'txn-1');
      const transaction2 = createTransaction(200, CurrencyCode.USD, 'txn-2');

      // Act
      await converter.convertToGBP(transaction1);
      await converter.convertToGBP(transaction2);

      // Assert - FR-007: Exchange rate fetched only once per currency per run
      expect(mockPort.callCount).toBe(1); // Only fetched once
      expect(converter.getCacheSize()).toBe(1);
    });

    test('FR-007: Given multiple currencies, when converted, then caches each separately', async () => {
      // Arrange
      const usdTxn = createTransaction(100, CurrencyCode.USD, 'txn-1');
      const eurTxn = createTransaction(100, CurrencyCode.EUR, 'txn-2');
      const usdTxn2 = createTransaction(50, CurrencyCode.USD, 'txn-3');

      // Act
      await converter.convertToGBP(usdTxn);
      await converter.convertToGBP(eurTxn);
      await converter.convertToGBP(usdTxn2);

      // Assert - Two currencies cached, USD only fetched once
      expect(mockPort.callCount).toBe(2); // USD and EUR
      expect(converter.getCacheSize()).toBe(2);
    });

    test('FR-007: Given cached rates, when retrieved, then returns snapshots with processing run ID', async () => {
      // Arrange
      const transaction = createTransaction(100, CurrencyCode.USD);

      // Act
      await converter.convertToGBP(transaction);
      const snapshots = converter.getExchangeRateSnapshots();

      // Assert - Snapshots contain processing run ID for audit trail
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].processingRunId).toBe(processingRunId);
      expect(snapshots[0].targetCurrency).toBe(CurrencyCode.USD);
      expect(snapshots[0].rate).toBe(0.79);
      expect(snapshots[0].provider).toBe('mock-provider');
    });

    test('FR-007: Given cache cleared, when same currency converted, then fetches rate again', async () => {
      // Arrange
      const transaction = createTransaction(100, CurrencyCode.USD);

      // Act
      await converter.convertToGBP(transaction);
      expect(mockPort.callCount).toBe(1);

      converter.clearCache();
      mockPort.reset();

      await converter.convertToGBP(transaction);

      // Assert - Rate fetched again after cache clear
      expect(mockPort.callCount).toBe(1);
      expect(converter.getCacheSize()).toBe(1);
    });
  });

  describe('convertBatchToGBP - Batch operations (FR-007)', () => {
    test('UC-001: Given multiple transactions, when batch converted, then processes all correctly', async () => {
      // Arrange
      const transactions = [
        createTransaction(100, CurrencyCode.GBP, 'txn-1'),
        createTransaction(200, CurrencyCode.USD, 'txn-2'),
        createTransaction(150, CurrencyCode.EUR, 'txn-3'),
        createTransaction(50, CurrencyCode.USD, 'txn-4')
      ];

      // Act
      const results = await converter.convertBatchToGBP(transactions);

      // Assert - All transactions converted
      expect(results.size).toBe(4);
      expect(results.get('txn-1')?.gbpAmount).toBe(100); // GBP unchanged
      expect(results.get('txn-2')?.gbpAmount).toBe(158); // 200 * 0.79
      expect(results.get('txn-3')?.gbpAmount).toBe(127.5); // 150 * 0.85
      expect(results.get('txn-4')?.gbpAmount).toBe(39.5); // 50 * 0.79
    });

    test('FR-007: Given batch with multiple currencies, when converted, then fetches rates in single batch call', async () => {
      // Arrange
      const transactions = [
        createTransaction(100, CurrencyCode.USD, 'txn-1'),
        createTransaction(200, CurrencyCode.EUR, 'txn-2'),
        createTransaction(150, CurrencyCode.USD, 'txn-3')
      ];

      // Act
      await converter.convertBatchToGBP(transactions);

      // Assert - FR-007: Batch call optimizes API usage
      expect(mockPort.batchCallCount).toBe(1); // Single batch call
      expect(mockPort.callCount).toBe(0); // No individual calls needed
      expect(converter.getCacheSize()).toBe(2); // USD and EUR cached
    });

    test('FR-007: Given batch with only GBP, when converted, then makes no API calls', async () => {
      // Arrange
      const transactions = [
        createTransaction(100, CurrencyCode.GBP, 'txn-1'),
        createTransaction(200, CurrencyCode.GBP, 'txn-2')
      ];

      // Act
      const results = await converter.convertBatchToGBP(transactions);

      // Assert - No conversion needed for GBP-only batch
      expect(mockPort.batchCallCount).toBe(0);
      expect(mockPort.callCount).toBe(0);
      expect(results.size).toBe(2);
    });

    test('FR-007: Given large batch with repeated currencies, when converted, then fetches each currency once', async () => {
      // Arrange - 10 transactions, only 3 unique currencies
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

      // Act
      await converter.convertBatchToGBP(transactions);

      // Assert - Only 3 currencies fetched despite 10 transactions
      expect(mockPort.batchCallCount).toBe(1);
      expect(converter.getCacheSize()).toBe(3);
    });
  });

  describe('Exchange rate snapshots (audit trail)', () => {
    test('UC-001: Given multiple conversions, when snapshots retrieved, then includes all currencies', async () => {
      // Arrange
      const transactions = [
        createTransaction(100, CurrencyCode.USD, 'txn-1'),
        createTransaction(200, CurrencyCode.EUR, 'txn-2'),
        createTransaction(300, CurrencyCode.JPY, 'txn-3')
      ];

      // Act
      await converter.convertBatchToGBP(transactions);
      const snapshots = converter.getExchangeRateSnapshots();

      // Assert - All exchange rates preserved for audit
      expect(snapshots).toHaveLength(3);
      expect(snapshots.map(s => s.targetCurrency)).toContain(CurrencyCode.USD);
      expect(snapshots.map(s => s.targetCurrency)).toContain(CurrencyCode.EUR);
      expect(snapshots.map(s => s.targetCurrency)).toContain(CurrencyCode.JPY);
    });

    test('FR-007: Given no conversions, when snapshots retrieved, then returns empty array', async () => {
      // Arrange - No conversions performed

      // Act
      const snapshots = converter.getExchangeRateSnapshots();

      // Assert
      expect(snapshots).toHaveLength(0);
    });

    test('FR-003: Given only GBP conversions, when snapshots retrieved, then returns empty array', async () => {
      // Arrange
      const transactions = [
        createTransaction(100, CurrencyCode.GBP, 'txn-1'),
        createTransaction(200, CurrencyCode.GBP, 'txn-2')
      ];

      // Act
      await converter.convertBatchToGBP(transactions);
      const snapshots = converter.getExchangeRateSnapshots();

      // Assert - No snapshots for GBP-only conversions
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('Error handling (FR-008)', () => {
    test('FR-008: Given rate fetch fails, when converted, then throws error', async () => {
      // Arrange
      const transaction = createTransaction(100, CurrencyCode.CAD); // No mock rate for CAD

      // Act & Assert
      await expect(converter.convertToGBP(transaction))
        .rejects
        .toThrow('No mock rate configured for CAD');
    });
  });

  describe('Cache management', () => {
    test('Given cache cleared, when size checked, then returns zero', () => {
      // Arrange - Add some rates to cache first
      const transaction = createTransaction(100, CurrencyCode.USD);

      // Act
      converter.convertToGBP(transaction); // Adds to cache
      converter.clearCache();

      // Assert
      expect(converter.getCacheSize()).toBe(0);
    });

    test('Given multiple rates cached, when size checked, then returns correct count', async () => {
      // Arrange
      await converter.convertToGBP(createTransaction(100, CurrencyCode.USD, 'txn-1'));
      await converter.convertToGBP(createTransaction(100, CurrencyCode.EUR, 'txn-2'));
      await converter.convertToGBP(createTransaction(100, CurrencyCode.JPY, 'txn-3'));

      // Act
      const size = converter.getCacheSize();

      // Assert
      expect(size).toBe(3);
    });
  });
});
