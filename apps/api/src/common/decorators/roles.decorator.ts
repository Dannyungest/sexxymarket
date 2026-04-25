import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (
  ...roles: Array<'CUSTOMER' | 'MERCHANT' | 'ADMIN' | 'SUPER_ADMIN'>
) => SetMetadata(ROLES_KEY, roles);
