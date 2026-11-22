import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Character, GameRegion } from '../../core/models/collection.models';
import { AuthService } from '../../core/services/auth.service';
import { CollectionService } from '../../core/services/collection.service';
import { ToastService } from '../../core/services/toast.service';
import { USERNAME_PATTERN } from '../authentication/register.component';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styles: `
    .cols { display: grid; gap: 0 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .avatar { width: 72px; height: 72px; object-fit: cover; border: 3px solid var(--bezel); border-radius: 4px; }
    .chars { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: .35rem; }
    .chars li { display: flex; gap: .5rem; align-items: center; padding: .35rem .5rem; background: var(--paper); border: 2px solid var(--bezel); border-radius: 3px; }
    .inline { display: grid; gap: 0 .5rem; grid-template-columns: 1fr 1fr 90px; align-items: end; }
    @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } .inline { grid-template-columns: 1fr; } }
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly collection = inject(CollectionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly regions: { value: GameRegion; label: string }[] = [
    { value: 'us', label: 'América (US)' },
    { value: 'eu', label: 'Europa (EU)' },
    { value: 'kr', label: 'Corea (KR)' },
    { value: 'tw', label: 'Taiwán (TW)' },
  ];

  protected readonly busy = signal(false);
  protected readonly characters = signal<Character[]>([]);
  protected readonly charError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
    avatarUrl: ['', [Validators.pattern(/^$|^https:\/\/\S+$/), Validators.maxLength(500)]],
    region: this.fb.control<GameRegion>('us'),
  });

  protected readonly charForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(12)]],
    realm: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
    region: this.fb.control<GameRegion>('us'),
  });

  constructor() {
    effect(() => {
      const p = this.auth.profile();
      if (p) {
        this.form.reset({ username: p.username, avatarUrl: p.avatarUrl ?? '', region: p.region });
        this.charForm.controls.region.setValue(p.region);
      }
    });
    void this.loadCharacters();
  }

  private async loadCharacters(): Promise<void> {
    try {
      this.characters.set(await this.auth.listCharacters());
    } catch {
      this.charError.set('No se pudieron cargar los personajes.');
    }
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const v = this.form.getRawValue();
    const res = await this.auth.updateProfile({ username: v.username.trim(), avatarUrl: v.avatarUrl.trim() || null, region: v.region });
    this.busy.set(false);
    this.toast.show(res.message, res.ok ? 'success' : 'error');
  }

  protected async addCharacter(): Promise<void> {
    this.charForm.markAllAsTouched();
    if (this.charForm.invalid) return;
    const v = this.charForm.getRawValue();
    const res = await this.auth.addCharacter({ name: v.name.trim(), realm: v.realm.trim(), region: v.region });
    this.toast.show(res.message, res.ok ? 'success' : 'error');
    if (res.ok) {
      this.charForm.reset({ name: '', realm: '', region: v.region });
      await this.loadCharacters();
    }
  }

  protected async removeCharacter(c: Character): Promise<void> {
    if (!confirm(`¿Quitar a ${c.name} (${c.realm})?`)) return;
    try {
      await this.auth.removeCharacter(c.id);
      await this.loadCharacters();
    } catch {
      this.toast.show('No se pudo quitar el personaje.', 'error');
    }
  }

  protected async logout(): Promise<void> {
    await this.collection.flush();
    await this.auth.signOut();
    this.toast.show('Sesión cerrada.');
    void this.router.navigateByUrl('/');
  }
}
