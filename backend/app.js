const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");
const ytSearch = require("yt-search");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const youtubeDlExec = require("youtube-dl-exec");
const ffmetadata = require("ffmetadata");
const axios = require("axios");
const { promisify } = require("util");
const async = require("async");
const retry = require("retry");

const app = express();
app.use(cors());
app.use(express.json());

//Serve static files from "public" directory
app.use(express.static(path.join(__dirname, "public")));

//Ensure the downloads directory exists
const downloadsDir = path.resolve(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

//Serve static files from the downloads directory
app.use("/downloads", express.static(downloadsDir));

//Spotify API Credentials
const spotifyApi = new SpotifyWebApi({
  clientId: "9b46774f0dfc44958f6acf3c0cf9b2ca",
  clientSecret: "d729db3bdccf4135b39e7e1fa94b2b6f",
  redirectUri: "http://localhost:3000/callback",
});

// Serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

//Retrieve an access token
app.get("/login", (req, res) => {
  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
  ];

  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    res.redirect("/");
  } catch (err) {
    console.log("Error retrieving access token", err);
    res.status(500).send("Error retrieving access token");
  }
});

// List tracks in a playlist
app.get("/list-tracks/:playlistId", async (req, res) => {
  const { playlistId } = req.params;

  try {
    let tracks = [];
    let data = await retrySpotifyApiCall(
      spotifyApi.getPlaylistTracks.bind(spotifyApi),
      [playlistId, { limit: 100 }]
    );
    tracks = tracks.concat(data.body.items);

    // Fetch additional pages if available
    while (data.body.next) {
      const nextUrl = new URL(data.body.next);
      const offset = nextUrl.searchParams.get("offset");
      data = await retrySpotifyApiCall(
        spotifyApi.getPlaylistTracks.bind(spotifyApi),
        [playlistId, { offset: parseInt(offset, 10), limit: 100 }]
      );
      tracks = tracks.concat(data.body.items);
    }

    const simplifiedTracks = tracks.map((item) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists[0].name,
    }));
    res.json(simplifiedTracks);
  } catch (err) {
    console.log("Error fetching tracks: ", err);
    res.status(500).send("Error fetching tracks");
  }
});

// Download an individual track
app.post("/download-track", async (req, res) => {
  const { trackId, trackName, artistName } = req.body;

  if (!trackId || !trackName || !artistName) {
    return res
      .status(400)
      .send("trackId, trackName, and artistName are required");
  }

  try {
    const searchResult = await ytSearch(`${trackName} ${artistName}`);
    const video = searchResult.videos[0];

    if (!video) {
      return res.status(404).send("No video found for the given track name");
    }

    const downloadPath = path.resolve(downloadsDir, `${trackName}.mp3`);
    await youtubeDlExec(video.url, {
      output: downloadPath,
      extractAudio: true,
      audioFormat: "mp3",
    });

    const track = await spotifyApi.getTrack(trackId);
    const albumCoverUrl = track.body.album.images[0].url;
    const coverArtPath = path.resolve(downloadsDir, `${trackName}.jpg`);
    const response = await axios({
      url: albumCoverUrl,
      responseType: "stream",
    });
    const writeStream = fs.createWriteStream(coverArtPath);
    response.data.pipe(writeStream);
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    await promisify(ffmetadata.write)(
      downloadPath,
      {
        title: trackName,
        artist: artistName,
      },
      {
        attachments: [coverArtPath],
      }
    );

    console.log("Metadata written successfully");

    fs.unlink(coverArtPath, (err) => {
      if (err) {
        console.log("Error deleting cover art file", err);
      }
    });

    res.json({
      message: `Downloaded: ${trackName}`,
      fileUrl: `/downloads/${trackName}.mp3`,
    });
  } catch (err) {
    console.log("Error downloading track: ", err);
    res.status(500).send("Error downloading track");
  }
});

//Download all tracks from a playlist
const downloadAndAddMetadata = async (track, downloadsDir) => {
  const trackName = track.name;
  const artistName = track.artists[0].name;
  const albumCoverUrl = track.album.images[0].url;

  const searchResult = await ytSearch(`${trackName} ${artistName}`);
  const video = searchResult.videos[0];

  if (video) {
    const downloadPath = path.resolve(downloadsDir, `${trackName}.mp3`);
    await youtubeDlExec(video.url, {
      output: downloadPath,
      extractAudio: true,
      audioFormat: "mp3",
    });
    console.log(`Downloaded: ${trackName}`);

    const coverArtPath = path.resolve(downloadsDir, `${trackName}.jpg`);
    const response = await axios({
      url: albumCoverUrl,
      responseType: "stream",
    });
    const writeStream = fs.createWriteStream(coverArtPath);
    response.data.pipe(writeStream);
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    await promisify(ffmetadata.write)(
      downloadPath,
      {
        title: trackName,
        artist: artistName,
      },
      {
        attachments: [coverArtPath],
      }
    );

    console.log("Metadata written successfully");
    fs.unlink(coverArtPath, (err) => {
      if (err) {
        console.log("Error deleting cover art file", err);
      }
    });
  } else {
    console.log(`No video found for: ${trackName} by ${artistName}`);
  }
};

const retrySpotifyApiCall = async (fn, args, retries = 3) => {
  const operation = retry.operation({
    retries,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 60000,
  });

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        const result = await fn(...args);
        resolve(result);
      } catch (err) {
        if (operation.retry(err)) {
          console.log(`Retrying Spotify API call (${currentAttempt})...`);
          return;
        }
        reject(err);
      }
    });
  });
};

app.post("/download-playlist", async (req, res) => {
  const { playlistId } = req.body;

  if (!playlistId) {
    return res.status(400).send("playlistId is required");
  }

  try {
    const data = await retrySpotifyApiCall(
      spotifyApi.getPlaylistTracks.bind(spotifyApi),
      [playlistId]
    );
    const tracks = data.body.items.map((item) => item.track);

    // Use async.eachLimit to handle concurrent downloads
    await async.eachLimit(tracks, 5, async (track) => {
      await downloadAndAddMetadata(track, downloadsDir);
    });

    res.send(`Downloaded all tracks from playlist: ${playlistId}`);
  } catch (err) {
    console.log("Error downloading playlist: ", err);
    res.status(500).send("Error downloading playlist");
  }
});

//List downloaded files
app.get("/list-downloads", (req, res) => {
  fs.readdir(downloadsDir, (err, files) => {
    if (err) {
      return res.status(500).send("Error listing downloads");
    }
    // Filter only mp3 files
    const mp3Files = files.filter((file) => file.endsWith(".mp3"));
    res.json(mp3Files);
  });
});

// List playlists
app.get("/list-playlists", async (req, res) => {
  try {
    const data = await retrySpotifyApiCall(
      spotifyApi.getUserPlaylists.bind(spotifyApi),
      []
    );
    const playlists = data.body.items.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
    }));
    res.json(playlists);
  } catch (err) {
    console.log("Error fetching playlists: ", err);
    res.status(500).send("Error fetching playlists");
  }
});

const port = 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${port}`);
});

//IP: 10.0.0.79
