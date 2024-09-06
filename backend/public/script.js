document.addEventListener("DOMContentLoaded", async () => {
  const playlistSelect = document.getElementById("playlist-select");
  const tabList = document.getElementById("tab-list");
  const tabContent = document.getElementById("tab-content");
  const downloadSelectedTracksButton =
    document.getElementById("download-track");
  const downloadList = document.getElementById("download-list");
  const loadingBuffer = document.getElementById("loading-buffer");
  const statusModal = document.getElementById("status-modal");
  const modalMessage = document.getElementById("modal-message");
  const closeBtn = document.querySelector(".close-btn");

  // Function to show modal with a message
  function showModal(message) {
    modalMessage.innerText = message;
    statusModal.classList.remove("hidden");
    statusModal.style.display = "block";
  }

  // Function to hide modal
  function hideModal() {
    statusModal.style.display = "none";
  }

  // Close modal when clicking on the close button
  closeBtn.addEventListener("click", hideModal);

  // Close modal when clicking outside of the modal content
  window.addEventListener("click", (event) => {
    if (event.target === statusModal) {
      hideModal();
    }
  });

  // Hide tab content initially
  tabContent.classList.add("hidden");

  // Function to show loading buffer
  function showLoadingBuffer() {
    loadingBuffer.classList.remove("hidden");
  }

  // Function to hide loading buffer
  function hideLoadingBuffer() {
    loadingBuffer.classList.add("hidden");
  }

  // Load playlists
  showLoadingBuffer();
  const response = await fetch("/list-playlists");
  const playlists = await response.json();
  playlists.forEach((playlist) => {
    const option = document.createElement("option");
    option.value = playlist.id;
    option.innerText = playlist.name;
    playlistSelect.appendChild(option);
  });
  hideLoadingBuffer();

  // Load tracks when a playlist is selected
  playlistSelect.addEventListener("change", async () => {
    const playlistId = playlistSelect.value;
    if (!playlistId) {
      tabContent.classList.add("hidden");
      tabList.classList.add("hidden");
      return;
    }

    showLoadingBuffer();
    const response = await fetch(`/list-tracks/${playlistId}`);
    const tracks = await response.json();
    displayTracksInTabs(tracks, 50); // Change 50 to the desired number of tracks per tab
    hideLoadingBuffer();
    tabContent.classList.remove("hidden");
    tabList.classList.remove("hidden");
  });

  // Function to display tracks in tabs
  function displayTracksInTabs(tracks, tracksPerTab) {
    tabList.innerHTML = "";
    tabContent.innerHTML = "";

    const totalTabs = Math.ceil(tracks.length / tracksPerTab);
    for (let i = 0; i < totalTabs; i++) {
      const tab = document.createElement("li");
      tab.innerText = `${i + 1}`;
      tab.addEventListener("click", () => {
        setActiveTab(i);
      });
      tabList.appendChild(tab);

      const tabSection = document.createElement("div");
      tabSection.id = `tab-${i}`;
      tabSection.classList.add("tab-section");
      if (i !== 0) tabSection.style.display = "none";

      const trackList = document.createElement("ul");
      const start = i * tracksPerTab;
      const end = start + tracksPerTab;
      tracks.slice(start, end).forEach((track) => {
        const listItem = document.createElement("li");
        listItem.innerText = `${track.name} - ${track.artist}`;
        listItem.dataset.trackId = track.id;
        listItem.dataset.trackName = track.name;
        listItem.dataset.artistName = track.artist;
        listItem.addEventListener("click", () => {
          selectTrack(listItem);
        });
        trackList.appendChild(listItem);
      });

      tabSection.appendChild(trackList);
      tabContent.appendChild(tabSection);
    }

    setActiveTab(0);
  }

  function setActiveTab(index) {
    const tabs = document.querySelectorAll(".tab-list li");
    const tabSections = document.querySelectorAll(".tab-section");

    tabs.forEach((tab, i) => {
      if (i === index) {
        tab.classList.add("active");
        tabSections[i].style.display = "block";
      } else {
        tab.classList.remove("active");
        tabSections[i].style.display = "none";
      }
    });
  }

  function selectTrack(trackElement) {
    // Deselect previously selected track
    const previouslySelected = document.querySelector(".tab-section .selected");
    if (previouslySelected && previouslySelected !== trackElement) {
      previouslySelected.classList.remove("selected");
    }

    // Toggle selection of the current track
    trackElement.classList.toggle("selected");
  }

  async function updateDownloadedSongs() {
    const response = await fetch("/list-downloads");
    const files = await response.json();
    downloadList.innerHTML = "";

    files.forEach((file) => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `<a href="/downloads/${file}" target="_blank">${file}</a>`;
      downloadList.appendChild(listItem);
    });
  }

  // Load downloaded songs on page load
  updateDownloadedSongs();

  downloadSelectedTracksButton.addEventListener("click", async () => {
    const selectedTrack = document.querySelector(".tab-section .selected");
    if (!selectedTrack) {
      alert("No track selected");
      return;
    }

    showLoadingBuffer();
    const track = {
      trackId: selectedTrack.dataset.trackId,
      trackName: selectedTrack.dataset.trackName,
      artistName: selectedTrack.dataset.artistName,
    };

    try {
      const response = await fetch("/download-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });

      if (response.ok) {
        console.log(`Started download for: ${track.trackName}`);
        showModal("Track downloaded successfully!");
        await updateDownloadedSongs();
      } else {
        console.error(`Error downloading ${track.trackName}`);
        showModal("Download failed. Please try again.");
      }
    } catch (error) {
      console.error(`Error downloading ${track.trackName}`, error);
      showModal("An error occurred. Please try again.");
    } finally {
      hideLoadingBuffer();
    }
  });

  // Handle playlist download
  document
    .getElementById("download-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const playlistId = playlistSelect.value;
      if (!playlistId) {
        alert("No playlist selected");
        return;
      }

      showLoadingBuffer();

      try {
        const response = await fetch("/download-playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlistId }),
        });

        if (response.ok) {
          showModal("Playlist downloaded successfully!");
          await updateDownloadedSongs();
        } else {
          console.error("Error downloading playlist");
          showModal("Download failed. Please try again.");
        }
      } catch (error) {
        console.error("Error downloading playlist", error);
        showModal("An error occurred. Please try again.");
      } finally {
        hideLoadingBuffer();
      }
    });
});
