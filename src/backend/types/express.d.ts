interface AuthenticatedUser {
  id: string;
  name?: string;
  tenantId?: string;
  tenantIds?: string[];
  role: string;
  email: string;
  daily_readings_enabled?: boolean | number;
  radio_514_enabled?: boolean | number;
}

declare namespace Express {
  interface Request {
    userId?: string;
    userRole?: string;
    tenantId?: string;
    user: AuthenticatedUser;
  }
}
