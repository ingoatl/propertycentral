// AI Circuit Breaker Pattern Implementation
import { supabase } from "@/integrations/supabase/client";

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerStatus {
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  canProceed: boolean;
}

export async function getCircuitBreakerStatus(serviceName: string): Promise<CircuitBreakerStatus> {
  const { data, error } = await supabase
    .from('ai_circuit_breaker')
    .select('*')
    .eq('service_name', serviceName)
    .maybeSingle();

  if (error || !data) {
    // Default to closed (operational) if no record exists
    return {
      serviceName,
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      canProceed: true
    };
  }

  const now = new Date();
  let canProceed = true;
  let currentState = data.state as CircuitState;

  if (data.state === 'open' && data.opened_at) {
    const openedAt = new Date(data.opened_at);
    const elapsedSeconds = (now.getTime() - openedAt.getTime()) / 1000;

    if (elapsedSeconds >= data.reset_timeout_seconds) {
      // Time to try again - move to half_open
      currentState = 'half_open';
      canProceed = true;
    } else {
      canProceed = false;
    }
  }

  return {
    serviceName,
    state: currentState,
    failureCount: data.failure_count,
    successCount: data.success_count,
    lastFailureAt: data.last_failure_at,
    lastSuccessAt: data.last_success_at,
    canProceed
  };
}

export async function recordSuccess(serviceName: string): Promise<void> {
  const { data: existing } = await supabase
    .from('ai_circuit_breaker')
    .select('id, state, success_count, success_threshold')
    .eq('service_name', serviceName)
    .maybeSingle();

  if (!existing) {
    // Create new record
    await supabase.from('ai_circuit_breaker').insert({
      service_name: serviceName,
      state: 'closed',
      success_count: 1,
      failure_count: 0,
      last_success_at: new Date().toISOString()
    });
    return;
  }

  const newSuccessCount = existing.success_count + 1;
  const updates: Record<string, unknown> = {
    success_count: newSuccessCount,
    last_success_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // If in half_open and enough successes, close the circuit
  if (existing.state === 'half_open' && newSuccessCount >= existing.success_threshold) {
    updates.state = 'closed';
    updates.failure_count = 0;
    updates.success_count = 0;
  }

  await supabase
    .from('ai_circuit_breaker')
    .update(updates)
    .eq('id', existing.id);
}

export async function recordFailure(serviceName: string, errorMessage?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('ai_circuit_breaker')
    .select('id, state, failure_count, failure_threshold')
    .eq('service_name', serviceName)
    .maybeSingle();

  if (!existing) {
    // Create new record with failure
    await supabase.from('ai_circuit_breaker').insert({
      service_name: serviceName,
      state: 'closed',
      failure_count: 1,
      success_count: 0,
      last_failure_at: new Date().toISOString(),
      last_error_message: errorMessage
    });
    return;
  }

  const newFailureCount = existing.failure_count + 1;
  const updates: Record<string, unknown> = {
    failure_count: newFailureCount,
    last_failure_at: new Date().toISOString(),
    last_error_message: errorMessage,
    updated_at: new Date().toISOString()
  };

  // If in half_open, any failure opens the circuit
  if (existing.state === 'half_open') {
    updates.state = 'open';
    updates.opened_at = new Date().toISOString();
    updates.success_count = 0;
  }
  // If closed and threshold exceeded, open the circuit
  else if (existing.state === 'closed' && newFailureCount >= existing.failure_threshold) {
    updates.state = 'open';
    updates.opened_at = new Date().toISOString();
  }

  await supabase
    .from('ai_circuit_breaker')
    .update(updates)
    .eq('id', existing.id);
}

export async function resetCircuitBreaker(serviceName: string): Promise<void> {
  await supabase
    .from('ai_circuit_breaker')
    .update({
      state: 'closed',
      failure_count: 0,
      success_count: 0,
      opened_at: null,
      half_open_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('service_name', serviceName);
}

// Fetch with retry and circuit breaker integration
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: {
    maxRetries?: number;
    backoffMs?: number;
    serviceName?: string;
  } = {}
): Promise<Response> {
  const { maxRetries = 3, backoffMs = 1000, serviceName } = config;

  // Check circuit breaker if service name provided
  if (serviceName) {
    const status = await getCircuitBreakerStatus(serviceName);
    if (!status.canProceed) {
      throw new Error(`Circuit breaker open for ${serviceName}. Service temporarily unavailable.`);
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoffMs * Math.pow(2, attempt);
        console.log(`[CircuitBreaker] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Handle payment required (credits depleted)
      if (response.status === 402) {
        if (serviceName) await recordFailure(serviceName, 'Payment required - credits depleted');
        throw new Error('AI credits depleted. Please add credits to continue.');
      }

      // Success
      if (response.ok) {
        if (serviceName) await recordSuccess(serviceName);
        return response;
      }

      // Other errors
      const errorText = await response.text();
      throw new Error(`Request failed with status ${response.status}: ${errorText}`);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[CircuitBreaker] Attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < maxRetries - 1) {
        const waitTime = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries exhausted
  if (serviceName) await recordFailure(serviceName, lastError?.message);
  throw lastError || new Error('Request failed after all retries');
}
