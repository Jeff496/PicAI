// src/utils/toast.ts
// Toast notification utilities for bulk operations

import { toast } from 'sonner';

type BulkOperation = 're-analyze' | 'detect-faces' | 'delete';

interface BulkSummary {
  total: number;
  succeeded: number;
  failed: number;
  totalFacesDetected?: number;
}

/**
 * Shows appropriate toast notification based on bulk operation results
 * - Success (green): All operations succeeded
 * - Warning (yellow): Some succeeded, some failed
 * - Error (red): All operations failed
 */
export function showBulkOperationToast(
  operation: BulkOperation,
  summary: BulkSummary
): void {
  const { total, succeeded, failed, totalFacesDetected } = summary;

  // All succeeded
  if (failed === 0) {
    const message = getSuccessMessage(operation, succeeded, totalFacesDetected);
    toast.success(message);
    return;
  }

  // All failed
  if (succeeded === 0) {
    const message = getFailureMessage(operation, total);
    toast.error(message);
    return;
  }

  // Partial failure
  const message = getPartialMessage(operation, succeeded, failed, total);
  toast.warning(message);
}

function getSuccessMessage(
  operation: BulkOperation,
  count: number,
  facesDetected?: number
): string {
  switch (operation) {
    case 're-analyze':
      return `Successfully re-analyzed ${count} photo${count !== 1 ? 's' : ''}`;
    case 'detect-faces':
      const faceInfo = facesDetected !== undefined ? `. Found ${facesDetected} face${facesDetected !== 1 ? 's' : ''}` : '';
      return `Successfully processed ${count} photo${count !== 1 ? 's' : ''} for faces${faceInfo}`;
    case 'delete':
      return `Successfully deleted ${count} photo${count !== 1 ? 's' : ''}`;
  }
}

function getFailureMessage(operation: BulkOperation, count: number): string {
  switch (operation) {
    case 're-analyze':
      return `Re-analysis failed for all ${count} photo${count !== 1 ? 's' : ''}`;
    case 'detect-faces':
      return `Face detection failed for all ${count} photo${count !== 1 ? 's' : ''}`;
    case 'delete':
      return `Deletion failed for all ${count} photo${count !== 1 ? 's' : ''}`;
  }
}

function getPartialMessage(
  operation: BulkOperation,
  succeeded: number,
  failed: number,
  total: number
): string {
  const operationName =
    operation === 're-analyze'
      ? 'Re-analysis'
      : operation === 'detect-faces'
        ? 'Face detection'
        : 'Deletion';

  return `${operationName}: ${succeeded} succeeded, ${failed} failed out of ${total} photo${total !== 1 ? 's' : ''}`;
}
