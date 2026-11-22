import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Mount } from '../../core/models/catalog.models';

/**
 * Icono de la montura. Si no hay icono verificado se dibuja un "sprite" genérico
 * con las iniciales sobre el color de la expansión (nunca una imagen inventada).
 * Pendiente = escala de grises, obtenida = color.
 */
@Component({
  selector: 'app-mount-sprite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sprite" [class.pending]="!obtained()" [style.--c]="color()" [style.--s.px]="size()">
      @if (src() && !failed()) {
        <img [src]="src()" [alt]="alt()" loading="lazy" (error)="failed.set(true)" />
      } @else {
        <span class="initials" role="img" [attr.aria-label]="alt()">{{ initials() }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; line-height: 0; }
    .sprite {
      width: var(--s); height: var(--s);
      border: 2px solid var(--bezel); border-radius: 3px;
      background:
        linear-gradient(45deg, rgba(0,0,0,.12) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.12) 75%) 0 0 / 8px 8px,
        var(--c);
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.25);
      display: grid; place-items: center; overflow: hidden;
      transition: filter 200ms ease;
    }
    .pending { filter: grayscale(1) brightness(.85) contrast(.9); }
    img { width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
    .initials {
      font-family: var(--font-logo); color: #fff; line-height: 1;
      font-size: calc(var(--s) * 0.26); text-shadow: 2px 2px 0 rgba(0,0,0,.45);
    }
  `,
})
export class MountSpriteComponent {
  readonly mount = input.required<Mount>();
  readonly obtained = input(false);
  readonly size = input(48);
  readonly color = input('#7a7a7a');
  readonly large = input(false);

  protected readonly failed = signal(false);
  protected readonly src = computed(() => (this.large() ? this.mount().imageUrl ?? this.mount().iconUrl : this.mount().iconUrl));
  protected readonly alt = computed(() => `${this.mount().name}${this.obtained() ? '' : ' (pendiente)'}`);
  protected readonly initials = computed(() =>
    this.mount()
      .name.replace(/['’.]/g, '')
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join(''),
  );
}
