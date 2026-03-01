/**
 * Scheduled Triggers
 *
 * Time-driven triggers for automated normalization and categorization.
 *
 * Trigger schedule:
 * - Normalization: Every 15 minutes (UC-005)
 * - Categorization: Every hour (UC-006)
 *
 * @module triggers/scheduledTriggers
 */

import { NormalizationController, promiseToSync } from '../controllers/NormalizationController';
import { runCategorization } from '../controllers/CategorizationController';
import { getActiveBankSources } from '../infrastructure/config/BankSourceConfig';
import { Logger } from '../utils/Logger';

/**
 * Trigger configuration
 */
const TRIGGER_CONFIG = {
  normalization: {
    functionName: 'scheduledNormalization',
    intervalMinutes: 15
  },
  categorization: {
    functionName: 'scheduledCategorization',
    intervalHours: 1
  }
};

/**
 * Scheduled normalization entry point
 *
 * Called by the time-driven trigger every 15 minutes.
 * Processes one bank source per invocation (round-robin) to stay
 * within Apps Script's ~6 minute execution limit.
 *
 * Uses PropertiesService to track which source to process next.
 */
function scheduledNormalization(): void {
  Logger.info('Scheduled normalization triggered');

  try {
    const activeSources = getActiveBankSources();
    if (activeSources.length === 0) {
      Logger.info('No active sources to normalize');
      return;
    }

    // Round-robin: pick the next source to process
    const props = PropertiesService.getScriptProperties();
    const lastIndex = parseInt(props.getProperty('normalization_source_index') || '-1', 10);
    const nextIndex = (lastIndex + 1) % activeSources.length;
    const source = activeSources[nextIndex];

    props.setProperty('normalization_source_index', String(nextIndex));

    Logger.info(`Processing source ${nextIndex + 1}/${activeSources.length}: ${source.id}`);

    const controller = new NormalizationController();
    const result = promiseToSync(() => controller.processSource(source.id));

    Logger.info('Scheduled normalization completed', {
      sourceId: source.id,
      normalized: result.normalized,
      duplicates: result.duplicates,
      errors: result.errors
    });

    if (result.errors > 0) {
      Logger.warning(`Normalization of ${source.id} completed with ${result.errors} errors`);
    }

  } catch (error) {
    Logger.error(`Scheduled normalization failed: ${error}`);
  }
}

/**
 * Scheduled categorization entry point
 *
 * Called by the time-driven trigger every hour.
 * Categorizes normalized transactions that haven't been categorized yet.
 */
function scheduledCategorization(): void {
  Logger.info('Scheduled categorization triggered');

  try {
    const result = runCategorization();

    Logger.info('Scheduled categorization completed', {
      processingRunId: result.processingRunId,
      categorized: result.categorized,
      failed: result.failed
    });

    if (result.failed > 0) {
      Logger.warning(`Categorization completed with ${result.failed} errors`);
    }

  } catch (error) {
    Logger.error(`Scheduled categorization failed: ${error}`);
  }
}

/**
 * Install all scheduled triggers
 *
 * Creates time-driven triggers for normalization and categorization.
 * Safe to call multiple times - removes existing triggers first.
 */
function installScheduledTriggers(): void {
  Logger.info('Installing scheduled triggers');

  // Remove all existing triggers to avoid duplicates and clear any stale references
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }

  // Install normalization trigger (every 15 minutes)
  ScriptApp.newTrigger(TRIGGER_CONFIG.normalization.functionName)
    .timeBased()
    .everyMinutes(TRIGGER_CONFIG.normalization.intervalMinutes)
    .create();

  Logger.info(`Installed normalization trigger: every ${TRIGGER_CONFIG.normalization.intervalMinutes} minutes`);

  // Install categorization trigger (every hour)
  ScriptApp.newTrigger(TRIGGER_CONFIG.categorization.functionName)
    .timeBased()
    .everyHours(TRIGGER_CONFIG.categorization.intervalHours)
    .create();

  Logger.info(`Installed categorization trigger: every ${TRIGGER_CONFIG.categorization.intervalHours} hour(s)`);

  Logger.info('All scheduled triggers installed');
}

/**
 * Uninstall all scheduled triggers
 *
 * Removes normalization and categorization time-driven triggers.
 */
function uninstallScheduledTriggers(): void {
  Logger.info('Uninstalling scheduled triggers');

  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;

  for (const trigger of triggers) {
    const handlerFunction = trigger.getHandlerFunction();

    if (
      handlerFunction === TRIGGER_CONFIG.normalization.functionName ||
      handlerFunction === TRIGGER_CONFIG.categorization.functionName
    ) {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
      Logger.info(`Removed trigger: ${handlerFunction}`);
    }
  }

  Logger.info(`Uninstalled ${removedCount} scheduled trigger(s)`);
}

/**
 * Check status of scheduled triggers
 *
 * Returns information about installed triggers for monitoring.
 */
function checkTriggerStatus(): TriggerStatus {
  const triggers = ScriptApp.getProjectTriggers();

  const status: TriggerStatus = {
    normalization: {
      installed: false,
      intervalMinutes: null,
      lastRun: null
    },
    categorization: {
      installed: false,
      intervalHours: null,
      lastRun: null
    },
    otherTriggers: []
  };

  for (const trigger of triggers) {
    const handlerFunction = trigger.getHandlerFunction();
    const triggerSource = trigger.getTriggerSource();

    if (handlerFunction === TRIGGER_CONFIG.normalization.functionName) {
      status.normalization.installed = true;
      // Apps Script doesn't expose interval directly, so we use our config
      status.normalization.intervalMinutes = TRIGGER_CONFIG.normalization.intervalMinutes;
    } else if (handlerFunction === TRIGGER_CONFIG.categorization.functionName) {
      status.categorization.installed = true;
      status.categorization.intervalHours = TRIGGER_CONFIG.categorization.intervalHours;
    } else {
      status.otherTriggers.push({
        handlerFunction,
        triggerSource: triggerSource.toString()
      });
    }
  }

  Logger.info('Trigger status checked', {
    normalizationInstalled: status.normalization.installed,
    categorizationInstalled: status.categorization.installed,
    otherTriggerCount: status.otherTriggers.length
  });
  return status;
}

/**
 * Trigger status information
 */
interface TriggerStatus {
  normalization: {
    installed: boolean;
    intervalMinutes: number | null;
    lastRun: Date | null;
  };
  categorization: {
    installed: boolean;
    intervalHours: number | null;
    lastRun: Date | null;
  };
  otherTriggers: Array<{
    handlerFunction: string;
    triggerSource: string;
  }>;
}

// Export for module usage and testing
export {
  scheduledNormalization,
  scheduledCategorization,
  installScheduledTriggers,
  uninstallScheduledTriggers,
  checkTriggerStatus,
  TriggerStatus
};
