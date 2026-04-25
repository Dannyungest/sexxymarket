import { IsIn } from 'class-validator';

export class AssignAdminRoleDto {
  @IsIn(['ADMIN', 'SUPER_ADMIN'])
  role!: 'ADMIN' | 'SUPER_ADMIN';
}
