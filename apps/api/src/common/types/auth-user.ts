export interface AuthUser {
  sub: string;
  role: 'CUSTOMER' | 'MERCHANT' | 'ADMIN' | 'SUPER_ADMIN';
  email: string;
  ev?: boolean;
  mcp?: boolean;
}
