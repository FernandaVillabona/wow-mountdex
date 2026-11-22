import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <div class="empty__glyph" aria-hidden="true">?</div>
      <p class="empty__title">{{ title() }}</p>
      @if (text()) { <p class="muted">{{ text() }}</p> }
      <ng-content />
    </div>
  `,
  styles: `
    .empty { text-align: center; padding: 1.5rem 1rem; }
    .empty__glyph {
      font-family: var(--font-logo); font-size: 1.4rem; width: 56px; height: 56px; margin: 0 auto .75rem;
      display: grid; place-items: center; border: 3px dashed var(--ink-faint); color: var(--ink-faint);
    }
    .empty__title { font-family: var(--font-ui); font-size: 1.1rem; margin-bottom: .25rem; }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input('');
}
