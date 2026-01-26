import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unauthorizedResponse, forbiddenResponse } from './response.ts';

// Create authenticated Supabase client from request
export function createAuthClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }
  );
}

// Create service role client for admin operations
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Validate user authentication and return user
export async function requireAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401);
  }

  const supabase = createAuthClient(req);
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError('Invalid or expired token', 401);
  }

  return { user: data.user, supabase };
}

// Validate user has admin role
export async function requireAdmin(req: Request) {
  const { user, supabase } = await requireAuth(req);
  
  const serviceClient = createServiceClient();
  const { data: role } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!role) {
    throw new AuthError('Admin access required', 403);
  }

  return { user, supabase, isAdmin: true };
}

// Validate API key for external integrations
export function requireApiKey(req: Request, expectedKeyEnvVar: string): void {
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = Deno.env.get(expectedKeyEnvVar);

  if (!expectedKey) {
    throw new AuthError('API key not configured on server', 500);
  }

  if (!apiKey || apiKey !== expectedKey) {
    throw new AuthError('Invalid API key', 401);
  }
}

// Custom error class for auth errors
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

// Handle auth errors and return appropriate response
export function handleAuthError(error: unknown): Response {
  if (error instanceof AuthError) {
    if (error.status === 401) {
      return unauthorizedResponse(error.message);
    }
    if (error.status === 403) {
      return forbiddenResponse(error.message);
    }
  }
  throw error; // Re-throw if not an auth error
}
