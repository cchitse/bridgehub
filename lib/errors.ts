export class LookupError extends Error {
  constructor(public readonly category: string, message: string, public readonly retryable = false) { super(message); }
}

export function describeFailure(error: unknown) {
  const failure = error instanceof LookupError ? error : new LookupError("internal_error", "BridgeHub could not complete this lookup.");
  return { category: failure.category, message: failure.message, retryable: failure.retryable };
}
