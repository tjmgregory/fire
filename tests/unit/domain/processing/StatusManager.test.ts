/**
 * Status Manager Tests
 *
 * Tests ProcessingStatus transition management.
 *
 * Business Rules Tested:
 * - BR-SM-01: Valid transitions follow UNPROCESSED -> NORMALISED -> CATEGORISED
 * - BR-SM-02: Any state can transition to ERROR
 * - BR-SM-03: ERROR state can transition to NORMALISED or CATEGORISED (retry)
 * - BR-SM-04: Invalid transitions are rejected with appropriate errors
 * - BR-SM-05: Timestamps are automatically updated on transition
 */

import { describe, test, expect } from 'vitest';
import {
  StatusManager,
  InvalidStatusTransitionError
} from '../../../../src/apps-script/domain/processing/StatusManager';
import {
  Transaction,
  ProcessingStatus,
  TransactionType,
  CurrencyCode
} from '../../../../src/apps-script/models/Transaction';
import { BankSourceId } from '../../../../src/apps-script/models/BankSource';

describe('StatusManager', () => {
  function createTestTransaction(
    status: ProcessingStatus = ProcessingStatus.UNPROCESSED
  ): Transaction {
    return {
      id: '123e4567-e89b-12d3-a456-426614174000',
      bankSourceId: BankSourceId.MONZO,
      originalTransactionId: 'tx_00001',
      transactionDate: new Date('2025-11-15'),
      transactionType: TransactionType.DEBIT,
      description: 'Test Transaction',
      notes: null,
      country: null,
      originalAmountValue: 23.45,
      originalAmountCurrency: CurrencyCode.GBP,
      gbpAmountValue: 23.45,
      exchangeRateValue: null,
      categoryAiId: null,
      categoryAiName: null,
      categoryConfidenceScore: null,
      categoryManualId: null,
      categoryManualName: null,
      processingStatus: status,
      errorMessage: null,
      timestampCreated: new Date('2025-01-01'),
      timestampLastModified: new Date('2025-01-01'),
      timestampNormalised: null,
      timestampCategorised: null
    };
  }

  describe('markAsNormalised', () => {
    test('transitions from UNPROCESSED to NORMALISED', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);
      const result = StatusManager.markAsNormalised(tx);

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe(ProcessingStatus.UNPROCESSED);
      expect(result.newStatus).toBe(ProcessingStatus.NORMALISED);
      expect(tx.processingStatus).toBe(ProcessingStatus.NORMALISED);
    });

    test('sets timestampNormalised', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);
      const before = new Date();

      StatusManager.markAsNormalised(tx);

      expect(tx.timestampNormalised).not.toBeNull();
      expect(tx.timestampNormalised!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    test('updates timestampLastModified', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);
      const originalModified = tx.timestampLastModified;

      StatusManager.markAsNormalised(tx);

      expect(tx.timestampLastModified.getTime()).toBeGreaterThan(originalModified.getTime());
    });

    test('throws on invalid transition from CATEGORISED', () => {
      const tx = createTestTransaction(ProcessingStatus.CATEGORISED);

      expect(() => StatusManager.markAsNormalised(tx)).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('markAsCategorised', () => {
    test('transitions from NORMALISED to CATEGORISED', () => {
      const tx = createTestTransaction(ProcessingStatus.NORMALISED);
      const result = StatusManager.markAsCategorised(tx);

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe(ProcessingStatus.NORMALISED);
      expect(result.newStatus).toBe(ProcessingStatus.CATEGORISED);
      expect(tx.processingStatus).toBe(ProcessingStatus.CATEGORISED);
    });

    test('sets timestampCategorised', () => {
      const tx = createTestTransaction(ProcessingStatus.NORMALISED);
      const before = new Date();

      StatusManager.markAsCategorised(tx);

      expect(tx.timestampCategorised).not.toBeNull();
      expect(tx.timestampCategorised!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    test('allows re-categorization from CATEGORISED', () => {
      const tx = createTestTransaction(ProcessingStatus.CATEGORISED);
      tx.timestampCategorised = new Date('2025-01-01');

      const result = StatusManager.markAsCategorised(tx);

      expect(result.success).toBe(true);
      expect(tx.timestampCategorised!.getTime()).toBeGreaterThan(
        new Date('2025-01-01').getTime()
      );
    });

    test('throws on invalid transition from UNPROCESSED', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);

      expect(() => StatusManager.markAsCategorised(tx)).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('markAsError', () => {
    test('transitions from UNPROCESSED to ERROR', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);
      const result = StatusManager.markAsError(tx, 'Parse error');

      expect(result.success).toBe(true);
      expect(tx.processingStatus).toBe(ProcessingStatus.ERROR);
      expect(tx.errorMessage).toBe('Parse error');
    });

    test('transitions from NORMALISED to ERROR', () => {
      const tx = createTestTransaction(ProcessingStatus.NORMALISED);
      const result = StatusManager.markAsError(tx, 'AI service unavailable');

      expect(result.success).toBe(true);
      expect(tx.processingStatus).toBe(ProcessingStatus.ERROR);
      expect(tx.errorMessage).toBe('AI service unavailable');
    });

    test('transitions from CATEGORISED to ERROR', () => {
      const tx = createTestTransaction(ProcessingStatus.CATEGORISED);
      const result = StatusManager.markAsError(tx, 'Sheet write failed');

      expect(result.success).toBe(true);
      expect(tx.processingStatus).toBe(ProcessingStatus.ERROR);
    });

    test('can update error message when already in ERROR', () => {
      const tx = createTestTransaction(ProcessingStatus.ERROR);
      tx.errorMessage = 'Original error';

      StatusManager.markAsError(tx, 'New error');

      expect(tx.errorMessage).toBe('New error');
    });
  });

  describe('retryFromError', () => {
    test('transitions from ERROR to NORMALISED', () => {
      const tx = createTestTransaction(ProcessingStatus.ERROR);
      tx.errorMessage = 'Previous error';

      const result = StatusManager.retryFromError(tx, ProcessingStatus.NORMALISED);

      expect(result.success).toBe(true);
      expect(tx.processingStatus).toBe(ProcessingStatus.NORMALISED);
      expect(tx.errorMessage).toBeNull();
      expect(tx.timestampNormalised).not.toBeNull();
    });

    test('transitions from ERROR to CATEGORISED', () => {
      const tx = createTestTransaction(ProcessingStatus.ERROR);
      tx.errorMessage = 'Previous error';

      const result = StatusManager.retryFromError(tx, ProcessingStatus.CATEGORISED);

      expect(result.success).toBe(true);
      expect(tx.processingStatus).toBe(ProcessingStatus.CATEGORISED);
      expect(tx.errorMessage).toBeNull();
      expect(tx.timestampCategorised).not.toBeNull();
    });

    test('throws when not in ERROR state', () => {
      const tx = createTestTransaction(ProcessingStatus.NORMALISED);

      expect(() =>
        StatusManager.retryFromError(tx, ProcessingStatus.CATEGORISED)
      ).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('canTransition', () => {
    test('returns true for valid transitions', () => {
      expect(
        StatusManager.canTransition(ProcessingStatus.UNPROCESSED, ProcessingStatus.NORMALISED)
      ).toBe(true);
      expect(
        StatusManager.canTransition(ProcessingStatus.NORMALISED, ProcessingStatus.CATEGORISED)
      ).toBe(true);
      expect(
        StatusManager.canTransition(ProcessingStatus.UNPROCESSED, ProcessingStatus.ERROR)
      ).toBe(true);
    });

    test('returns false for invalid transitions', () => {
      expect(
        StatusManager.canTransition(ProcessingStatus.UNPROCESSED, ProcessingStatus.CATEGORISED)
      ).toBe(false);
      expect(
        StatusManager.canTransition(ProcessingStatus.CATEGORISED, ProcessingStatus.NORMALISED)
      ).toBe(false);
    });
  });

  describe('getNextStatus', () => {
    test('returns NORMALISED for UNPROCESSED', () => {
      expect(StatusManager.getNextStatus(ProcessingStatus.UNPROCESSED)).toBe(
        ProcessingStatus.NORMALISED
      );
    });

    test('returns CATEGORISED for NORMALISED', () => {
      expect(StatusManager.getNextStatus(ProcessingStatus.NORMALISED)).toBe(
        ProcessingStatus.CATEGORISED
      );
    });

    test('returns null for CATEGORISED (terminal)', () => {
      expect(StatusManager.getNextStatus(ProcessingStatus.CATEGORISED)).toBeNull();
    });

    test('returns null for ERROR (requires explicit retry)', () => {
      expect(StatusManager.getNextStatus(ProcessingStatus.ERROR)).toBeNull();
    });
  });

  describe('isTerminal', () => {
    test('returns true for CATEGORISED', () => {
      const tx = createTestTransaction(ProcessingStatus.CATEGORISED);
      expect(StatusManager.isTerminal(tx)).toBe(true);
    });

    test('returns true for ERROR', () => {
      const tx = createTestTransaction(ProcessingStatus.ERROR);
      expect(StatusManager.isTerminal(tx)).toBe(true);
    });

    test('returns false for UNPROCESSED', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);
      expect(StatusManager.isTerminal(tx)).toBe(false);
    });

    test('returns false for NORMALISED', () => {
      const tx = createTestTransaction(ProcessingStatus.NORMALISED);
      expect(StatusManager.isTerminal(tx)).toBe(false);
    });
  });

  describe('canProgress', () => {
    test('returns true for UNPROCESSED', () => {
      const tx = createTestTransaction(ProcessingStatus.UNPROCESSED);
      expect(StatusManager.canProgress(tx)).toBe(true);
    });

    test('returns true for NORMALISED', () => {
      const tx = createTestTransaction(ProcessingStatus.NORMALISED);
      expect(StatusManager.canProgress(tx)).toBe(true);
    });

    test('returns false for CATEGORISED', () => {
      const tx = createTestTransaction(ProcessingStatus.CATEGORISED);
      expect(StatusManager.canProgress(tx)).toBe(false);
    });

    test('returns false for ERROR', () => {
      const tx = createTestTransaction(ProcessingStatus.ERROR);
      expect(StatusManager.canProgress(tx)).toBe(false);
    });
  });

  describe('InvalidStatusTransitionError', () => {
    test('contains from and to status', () => {
      const error = new InvalidStatusTransitionError(
        ProcessingStatus.UNPROCESSED,
        ProcessingStatus.CATEGORISED
      );

      expect(error.fromStatus).toBe(ProcessingStatus.UNPROCESSED);
      expect(error.toStatus).toBe(ProcessingStatus.CATEGORISED);
      expect(error.message).toContain('UNPROCESSED');
      expect(error.message).toContain('CATEGORISED');
    });
  });
});
