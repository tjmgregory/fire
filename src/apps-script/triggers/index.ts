/**
 * Triggers
 *
 * Exports all trigger implementations for Apps Script.
 *
 * @module triggers
 */

export {
  onEdit,
  installOnEditTrigger,
  uninstallOnEditTrigger,
  loadActiveCategories
} from './onEditTrigger';

export {
  scheduledNormalization,
  scheduledCategorization,
  installScheduledTriggers,
  uninstallScheduledTriggers,
  checkTriggerStatus,
  TriggerStatus
} from './scheduledTriggers';
