import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Deletion confirmation, opened by `?modal=confirm-delete&id=<id>` on the item and
 * location lists. Living in the URL rather than in component memory keeps the state
 * reachable on a cold load — a reviewer can be linked straight to the open dialog.
 *
 * When the API refuses the delete (409 — the record still holds stock or is referenced
 * by movements) the parent passes that server message in via `blockedReason`; the dialog
 * then explains the block instead of offering a confirm button.
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Delete');
  readonly blockedReason = input<string | null>(null);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();
}
