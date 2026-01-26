import { corsHeaders } from './cors.ts';

// Standardized JSON response helper
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Success response
export function successResponse(data: unknown, message?: string): Response {
  return jsonResponse({ success: true, data, message }, 200);
}

// Error response with consistent structure
export function errorResponse(message: string, status = 400, details?: unknown): Response {
  console.error(`[Error ${status}]:`, message, details);
  return jsonResponse({ success: false, error: message, details }, status);
}

// Unauthorized response
export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return errorResponse(message, 401);
}

// Forbidden response
export function forbiddenResponse(message = 'Forbidden'): Response {
  return errorResponse(message, 403);
}

// Not found response
export function notFoundResponse(message = 'Not found'): Response {
  return errorResponse(message, 404);
}

// Internal server error response
export function serverErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Internal server error';
  return errorResponse(message, 500);
}
