export type UserRole = 'auditor' | 'colaborador';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}
