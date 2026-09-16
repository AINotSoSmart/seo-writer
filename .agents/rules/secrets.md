# CRITICAL SECURITY RULE: STRICT ZERO-ACCESS TO SECRETS AND ENVIRONMENT FILES

### 1. ABSOLUTE BAN ON READING ENVIRONMENT & SECRET FILES
All AI agents (including Antigravity, Gemini, Codex, Claude, etc.) are STRICTLY FORBIDDEN from:
- Reading, viewing, opening, inspecting, grepping, scanning, or printing the contents of ANY environment or secret files:
  • `.env`
  • `.env.*` (including `.env.local`, `.env.production`, `.env.development`, `.env.test`, `.env.*.local`)
  • Any file ending with `.env` or containing `.env.`
  • Any file named or containing `id_rsa`, `*.pem`, `*.key`, `credentials`, `secret`, `service-account*.json`
- Using ANY tool to inspect these files:
  • DO NOT use `view_file` on any `.env*` path.
  • DO NOT use `grep_search` on `.env*` files or search inside them.
  • DO NOT use shell/terminal commands (`run_command`) such as `cat`, `type`, `Get-Content`, `Select-String`, `grep`, `head`, `tail`, `awk`, `sed`, `strings`, `more`, or scripts to read, inspect, or grep any `.env*` file.
  • DO NOT copy, rename, or echo `.env*` files to read them indirectly.

### 2. NORMAL CODE INSPECTION IS FULLY PERMITTED (TARGET-SPECIFIC FILTER)
- `view_file`, `grep_search`, `find_by_name`, and code navigation tools remain **100% active and normal** for all codebase files (`.ts`, `.tsx`, `.js`, `.json`, `.sql`, `.md`, `.css`, etc.).
- The prohibition applies **EXCLUSIVELY** to environment and secret files (`.env*`, credentials, keys).

### 3. NO PRINTING OR LEAKING SECRETS
- NEVER print, echo, or display API keys, tokens, database passwords, or secret values in:
  • Chat responses
  • Thought processes
  • Terminal command lines
  • Tool call arguments or parameters

### 4. HOW TO HANDLE MISSING OR REQUIRED ENVIRONMENT VARIABLES
- If an environment variable is required or you need to know if a setting exists:
  1. Check `.env.example` or `.env.template` ONLY.
  2. If the user asks whether a variable is set, **ASK THE USER DIRECTLY** in chat or explain which variable name to verify.
  3. NEVER check `.env.local` to verify a key's presence or value.
  4. Provide the exact variable names and instructions for the user to configure them themselves.

### 5. VIOLATION POLICY
Attempting to read, bypass, or execute commands against `.env*` files without explicit, written instruction from the user in that exact prompt is an immediate security violation.
