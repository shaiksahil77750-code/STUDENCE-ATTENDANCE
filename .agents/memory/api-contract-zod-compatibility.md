---
name: API contract validation compatibility
description: OpenAPI integer schemas can generate unsupported zod.int calls in this workspace.
---

When adding OpenAPI contracts, prefer numeric schemas that match the installed validation runtime; integer annotations may generate `zod.int()` while this workspace uses a Zod version without that API.

**Why:** Code generation completed, but the chained library typecheck failed until the integer fields were expressed as numbers.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck before building routes or frontend consumers.