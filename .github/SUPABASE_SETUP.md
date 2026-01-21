# Supabase CI/CD Setup

This document explains how to configure GitHub Actions for automatic database migrations.

## Required GitHub Secrets

Add these secrets in your repository settings (Settings > Secrets and variables > Actions):

### 1. `SUPABASE_ACCESS_TOKEN`

Personal access token for Supabase CLI authentication.

1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Give it a name like "GitHub Actions"
4. Copy the token and add it as a secret

### 2. `SUPABASE_PROJECT_REF`

Your Supabase project reference ID.

- Found in your project URL: `https://supabase.com/dashboard/project/{PROJECT_REF}`
- Or in Project Settings > General > Reference ID
- For this project: `kffweujxwhztzvjlnzln`

## How It Works

### On Pull Requests
- Builds the project and runs type checking
- Spins up a local Supabase instance
- Tests migrations against a fresh database
- Catches migration errors before merge

### On Merge to Main
- Builds and type checks the code
- Connects to your production Supabase project
- Runs any new migrations with `supabase db push`
- Verifies migration status

## Local Development

### Initial Setup

```bash
# Install Supabase CLI (macOS)
brew install supabase/tap/supabase

# Or via npm
npx supabase --version

# Link to your project
supabase link --project-ref kffweujxwhztzvjlnzln

# Pull remote database schema (optional)
supabase db pull
```

### Creating New Migrations

```bash
# Create a new migration file
supabase migration new my_migration_name

# This creates: supabase/migrations/{timestamp}_my_migration_name.sql
# Edit the file with your SQL changes

# Test locally
supabase start
supabase db reset

# Push to production (or let CI do it)
supabase db push
```

### Running Migrations Manually

```bash
# Push migrations to production
supabase db push

# Check migration status
supabase migration list

# View diff between local and remote
supabase db diff
```

## Workflow File

The CI workflow is defined in `.github/workflows/ci.yml` and includes:

1. **Build Job**: Runs on all pushes and PRs
   - Installs dependencies
   - Type checks with TypeScript
   - Builds the production bundle

2. **Migrate Job**: Runs only on merge to main
   - Links to production Supabase project
   - Pushes any pending migrations
   - Verifies migration status

3. **Validate Migrations Job**: Runs on PRs only
   - Starts local Supabase
   - Tests migrations in isolation
   - Ensures migrations are valid before merge

## Troubleshooting

### Migration Failed
- Check the GitHub Actions logs for SQL errors
- Test the migration locally with `supabase db reset`
- Fix the SQL and push a new commit

### Authentication Failed
- Verify `SUPABASE_ACCESS_TOKEN` is set correctly
- Token may have expired - generate a new one
- Ensure token has access to the project

### Project Not Found
- Verify `SUPABASE_PROJECT_REF` matches your project
- Check that the access token has permissions for the project
