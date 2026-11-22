import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barra de progreso segmentada estilo "barra de PS". */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pb">
      @if (label()) {
        <div class="pb__head">
          <span class="pb__label">{{ label() }}</span>
          <span class="pb__value">{{ obtained() }}/{{ total() }} · {{ percent() }}%</span>
        </div>
      }
      <div
        class="pb__track"
        role="progressbar"
        [attr.aria-valuenow]="percent()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="(label() || 'Progreso') + ': ' + percent() + '%'"
      >
        <div class="pb__fill" [class]="'pb__fill ' + tone()" [style.width.%]="percent()"></div>
      </div>
    </div>
  `,
  styles: `
    .pb__head { display: flex; justify-content: space-between; gap: .5rem; font-size: .88rem; margin-bottom: .2rem; }
    .pb__label { font-family: var(--font-ui); text-transform: uppercase; letter-spacing: .03em; }
    .pb__value { font-variant-numeric: tabular-nums; color: var(--ink-soft); white-space: nowrap; }
    .pb__track {
      height: 14px; border: 2px solid var(--bezel); background: var(--bezel-2); border-radius: 2px; padding: 2px;
    }
    .pb__fill {
      height: 100%; min-width: 0; transition: width 400ms steps(10);
      background: repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 8px);
    }
    .high { color: var(--led-green); }
    .mid { color: var(--led-yellow); }
    .low { color: var(--led-red); }
  `,
})
export class ProgressBarComponent {
  readonly percent = input(0);
  readonly obtained = input(0);
  readonly total = input(0);
  readonly label = input('');
  protected readonly tone = computed(() => (this.percent() >= 50 ? 'high' : this.percent() >= 20 ? 'mid' : 'low'));
}
