# Ticket 03 verification

Completed 2026-09-12 against baseline 7e598a5.

## Behavior

Company search waits for bounded profile outcomes and retains successful rows in selection order. Partial responses include failed CIKs, failure categories/messages/retryability, and an incompleteness warning. Limit-based truncation stays independent of failures. When all selected profiles fail, the response retains directory provenance and individual failures while setting the MCP error flag.

SEC 403, 429, server/network failures, malformed data, and exceeded deadlines have distinct safe error categories. A direct profile 404 remains no matches; a selected profile 404 is a failure. Retryability is explicit and no automatic retries occur.

## Validation

- Test-first run: 10 new cases failed against ticket 02, reproducing discarded partial results and generic error categories.
- Final strict application typecheck passed.
- Final full suite passed: 54 tests through the actual MCP HTTP interface.
- Production build passed.
- Timeout tests shorten the clock boundary while asserting the implementation requests 10,000ms and 30,000ms budgets. They cover stalled response bodies, waiting for request slots, and preservation of completed profiles when the shared deadline aborts remaining requests.
- SEC failure cases use controlled outbound responses; no intentional blocking or rate-limit traffic was sent to live SEC. Existing live retrieval evidence from tickets 01 and 02 remains separate from these deterministic checks. No new live verification is claimed for this ticket.

## Standards

The independent standards review found no actionable bugs, documented standards breaches, or substantial code smells. Stable partial-result ordering, separate truncation, retained provenance, and timeout classification were confirmed.

Final disposition: zero findings.

## Spec

The independent specification review found no blocking retrieval gaps. One clarification concerned pre-existing MCP SDK schema-validation failures, which occur before the callback and lack BridgeHub's structured retrieval envelope. The README now documents this exception; the advertised input schema remains strict.

Final disposition: one clarification, addressed; no outstanding blockers.

## Scope

Shared cache, deployment-wide request limits, and shared-state failure enforcement remain ticket 04. No endpoint, tool, dependency, or user authentication flow was added. Changes are limited to ticket 03 behavior, tests, documentation, and status.
