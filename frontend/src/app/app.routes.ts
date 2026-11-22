import { Routes } from '@angular/router';
import { authGuard, guestOnlyGuard } from './core/guards/auth.guards';
import { catalogResolver } from './core/guards/catalog.resolver';

const withCatalog = { resolve: { catalog: catalogResolver } };

export const routes: Routes = [
  { path: '', title: 'WoW MountDex', ...withCatalog, loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
  { path: 'mountdex', title: 'MountDex · Catálogo', ...withCatalog, loadComponent: () => import('./features/pokedex/pokedex.component').then((m) => m.PokedexComponent) },
  { path: 'montura/:slug', ...withCatalog, loadComponent: () => import('./features/mount-detail/mount-detail.component').then((m) => m.MountDetailComponent) },
  { path: 'expansiones', title: 'Expansiones · MountDex', ...withCatalog, loadComponent: () => import('./features/expansions/expansions.component').then((m) => m.ExpansionsComponent) },
  { path: 'expansiones/:slug', ...withCatalog, loadComponent: () => import('./features/expansions/expansion-detail.component').then((m) => m.ExpansionDetailComponent) },
  { path: 'regiones', title: 'Regiones · MountDex', ...withCatalog, loadComponent: () => import('./features/locations/locations.component').then((m) => m.LocationsComponent) },
  { path: 'regiones/:continent/:zone', ...withCatalog, loadComponent: () => import('./features/locations/zone-detail.component').then((m) => m.ZoneDetailComponent) },
  { path: 'metodos', title: 'Métodos de obtención · MountDex', ...withCatalog, loadComponent: () => import('./features/acquisition-methods/methods.component').then((m) => m.MethodsComponent) },
  { path: 'metodos/:method', ...withCatalog, loadComponent: () => import('./features/acquisition-methods/method-detail.component').then((m) => m.MethodDetailComponent) },
  { path: 'objetivos', title: 'Objetivos de farmeo · MountDex', ...withCatalog, loadComponent: () => import('./features/objectives/objectives.component').then((m) => m.ObjectivesComponent) },
  { path: 'favoritas', title: 'Favoritas · MountDex', ...withCatalog, loadComponent: () => import('./features/favorites/favorites.component').then((m) => m.FavoritesComponent) },
  { path: 'secretas', title: 'Monturas secretas · MountDex', ...withCatalog, loadComponent: () => import('./features/secrets/secrets.component').then((m) => m.SecretsComponent) },
  { path: 'coleccion', title: 'Mi colección · MountDex', ...withCatalog, loadComponent: () => import('./features/collection/collection.component').then((m) => m.CollectionComponent) },
  { path: 'login', title: 'Iniciar sesión · MountDex', canActivate: [guestOnlyGuard], loadComponent: () => import('./features/authentication/login.component').then((m) => m.LoginComponent) },
  { path: 'registro', title: 'Crear cuenta · MountDex', canActivate: [guestOnlyGuard], loadComponent: () => import('./features/authentication/register.component').then((m) => m.RegisterComponent) },
  { path: 'recuperar', title: 'Recuperar contraseña · MountDex', loadComponent: () => import('./features/authentication/forgot-password.component').then((m) => m.ForgotPasswordComponent) },
  { path: 'reset-password', title: 'Nueva contraseña · MountDex', loadComponent: () => import('./features/authentication/reset-password.component').then((m) => m.ResetPasswordComponent) },
  { path: 'perfil', title: 'Perfil · MountDex', canActivate: [authGuard], loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent) },
  { path: 'blizzard/callback', title: 'Importando desde Battle.net · MountDex', ...withCatalog, loadComponent: () => import('./features/blizzard/blizzard-callback.component').then((m) => m.BlizzardCallbackComponent) },
  { path: '**', title: 'No encontrado · MountDex', loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent) },
];
