Local account records are created in `accounts.json` when the owner completes first-time setup. Passwords are stored as salted scrypt hashes.

CRM records, workspace settings, and sessions are stored in `crm.sqlite`. SQLite and account data files are ignored by Git. Keep this directory on persistent storage, restrict it to the service user, and back up both the database and `accounts.json`.