# Blog setup (one time, about 15 minutes)

## 1. Put the files on GitHub
1. Create a free GitHub account if you don't have one, then create a new repository (private is fine). Name it anything, e.g. `my-blog`.
2. Unzip this project. In the new repo, click "uploading an existing file" and drag in everything from the unzipped folder (all files and folders, including `static`, `content`, `netlify.toml`).
3. Commit the upload.

## 2. Tell the admin which repo to use
In GitHub, open `static/admin/config.yml`, click the pencil icon, and change this line to your own details, then commit:

    repo: YOUR-GITHUB-USERNAME/YOUR-REPO-NAME

## 3. Deploy on Netlify
1. Netlify > Add new site > Import an existing project > GitHub > pick your repo.
2. Leave the settings as they are (they're already in `netlify.toml`) and deploy.

## 4. Allow login with GitHub
1. GitHub > Settings > Developer settings > OAuth Apps > New OAuth App.
   - Homepage URL: your Netlify site URL
   - Authorization callback URL: https://api.netlify.com/auth/done
2. Copy the Client ID and generate a Client Secret.
3. Netlify > your site > Site configuration > Access control (or Access & security) > OAuth > Install provider > GitHub. Paste the Client ID and Secret.

## 5. Write posts
Go to https://YOUR-SITE.netlify.app/admin, click Login with GitHub, then New Post. Add a title, summary, cover image and body, then Publish. Netlify rebuilds and the post is live in about a minute.

## Change the site name
Edit `site.json` in GitHub (title, tagline, author). Set `url` to your live address (e.g. https://yourname.netlify.app) to turn on the RSS feed and proper share previews.
