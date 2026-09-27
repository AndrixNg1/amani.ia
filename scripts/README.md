# Repository scripts

`check-structure.mjs` uses only Node.js built-ins to check workspace names,
required check scripts, component READMEs, documented default ports, environment
examples and absence of nested Git repositories. Run `npm run check:structure`
from the root; no dependency installation or environment variables are needed.

This is static configuration validation. It explicitly reports missing test
suites without claiming to execute them. `npm test` remains the strict all-workspace
test command and fails when any workspace has no test script. See the root
[validation workflow](../README.md#validation) for runtime checks. There is no
separate test suite for this small inspection utility.

Cleanup, installation, staging and commit commands are deliberately not automated.
The owner executes the exact manual commands in the root README after review.
