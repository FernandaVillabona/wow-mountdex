import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Rutas que requieren sesión (perfil). */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.available) return router.createUrlTree(['/login']);
  await auth.init();
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** Login / registro no tienen sentido con sesión iniciada. */
export const guestOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  return auth.isLoggedIn() ? router.createUrlTree(['/perfil']) : true;
};
