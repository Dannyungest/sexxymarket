import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['ADMIN', 'SUPER_ADMIN'])
  role!: 'ADMIN' | 'SUPER_ADMIN';
}
