# S.A.M. — Strategic Assistant for Making

A creator tool that turns real moments into content that builds a following.

## Deploy to Vercel

### Step 1 — Upload to GitHub
1. Go to github.com and sign in
2. Click the **+** button → **New repository**
3. Name it `sam-app`
4. Set to **Public**
5. Click **Create repository**
6. Upload all files from this folder (index.html, vercel.json, and the api folder)

### Step 2 — Deploy on Vercel
1. Go to vercel.com and sign in
2. Click **Add New** → **Project**
3. Find and select your `sam-app` GitHub repo
4. Click **Import**
5. Click **Deploy** (don't change any settings)

### Step 3 — Add your API key (IMPORTANT)
1. Once deployed, go to your project in Vercel
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Name: `ANTHROPIC_API_KEY`
5. Value: paste your API key here
6. Click **Save**
7. Go to **Deployments** → click the three dots → **Redeploy**

Your app is now live at `your-project-name.vercel.app`

## Project Structure
```
sam-app/
├── index.html        # The full frontend
├── vercel.json       # Vercel configuration
├── api/
│   └── sam.js        # Secure API handler (keeps your key safe)
└── README.md
```

## How it works
- User describes a moment in the frontend
- Frontend sends it to `/api/sam` (your secure serverless function)
- The serverless function calls Anthropic's API using your secret key
- Claude processes it and returns structured JSON
- Frontend renders the output beautifully

Your API key never touches the browser. It lives only in Vercel's secure environment.

