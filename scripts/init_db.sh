#!/usr/bin/env bash
# Owner: S4 | Purpose: Initialise the SQLite database from schema.sql
set -euo pipefail
DB_PATH="${1:-backend/stem_qgen.db}"
sqlite3 "${DB_PATH}" < backend/schema.sql
echo "Database initialised at ${DB_PATH}"
