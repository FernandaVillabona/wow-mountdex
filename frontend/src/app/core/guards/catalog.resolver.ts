import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { CatalogService } from '../services/catalog.service';

/** Garantiza que el catálogo esté cargado antes de pintar la sección (errores se muestran en el shell). */
export const catalogResolver: ResolveFn<boolean> = async () => {
  const catalog = inject(CatalogService);
  await catalog.load();
  return catalog.state() === 'ready';
};
