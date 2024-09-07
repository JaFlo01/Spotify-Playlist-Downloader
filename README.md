# Spotify Playlist Downloader

## Overview

This application enables users to download individual songs or entire playlists from their Spotify account. The process involves logging in to your Spotify account to handle authorization and then using a web interface to select and download the desired tracks.

To use the application, follow these steps:

1. **Set Up Spotify Application:**

   - Create a Spotify Developer account if you don't have one.
   - Register a new application on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications).
   - Obtain the `Client ID` and `Client Secret` for your application and add them to the `.env` file in your project.

2. **Install Dependencies:**

   - Make sure you have Node.js and npm installed on your machine.

3. **Run the Server:**

   - The server will be available locally. Use `ngrok` to expose it to the web:

   - Copy the `ngrok` URL and share it with the users who need to access the web interface.

4. **Login and Use:**
   - Navigate to the `/login` endpoint to handle Spotify authorization.
   - Once logged in, use the web interface to select and download songs from your playlists.

## How It Works

1. **Authorization:**
   - The application uses the Spotify API for authentication. Users need to log in via the `/login` endpoint to obtain an access token.
2. **Downloading Songs:**
   - After authorization, users can access the web interface to view their playlists and select songs for download.
   - The application then fetches the selected tracks and initiates the download process.

## What I Learned

- **Spotify API Integration:** How to interact with Spotify’s API for authentication and data retrieval.
- **Web Development:** Building a web interface using HTML, CSS, and JavaScript for user interaction.
- **Node.js & Express:** Creating a backend server to handle API requests and manage user sessions.
- **ngrok:** Exposing a local development server to the internet for external access.
- **OAuth Flow:** Understanding the OAuth 2.0 authorization flow for secure access to user data.
