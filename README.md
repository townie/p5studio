
P5.AI Studio is a creative coding environment for p5.js powered by Google Gemini AI. Users can write, edit, and iterate on p5.js sketches with AI assistance.

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


❯ what steps do i need to do to enable github auth

⏺ Steps to Enable GitHub Auth

  1. Create a GitHub OAuth App

  1. Go to https://github.com/settings/developers
  2. Click "New OAuth App"
  3. Fill in:
    - Application name: P5.AI Studio (or whatever you want)
    - Homepage URL: http://localhost:3000 (for dev)
    - Authorization callback URL: https:// .supabase.co/auth/v1/callback
  4. Click "Register application"
  5. Copy the Client ID
  6. Click "Generate a new client secret" and copy it

  2. Configure GitHub in Supabase

  1. Go to your Supabase Dashboard:
  https://supabase.com/dashboard/project/ /auth/providers
  2. Find GitHub in the provider list
  3. Toggle it ON
  4. Paste your Client ID and Client Secret
  5. Click Save

  3. Run the Database Schema

  1. Go to SQL Editor:
  https://supabase.com/dashboard/project/ /sql/new
  2. Paste the contents of supabase/SETUP_SCHEMA.sql
  3. Click Run
