console.log("Welcome to Swara Box");

const token = localStorage.getItem('token');
if (!token) {
  alert('Please log in');
  window.location.href = 'intro.html';
}

let songIndex = 0;
let audioElement = new Audio();
let masterPlay = document.getElementById('masterPlay');
let myProgressBar = document.getElementById('myProgressBar');
let gif = document.getElementById('gif');
let masterSongName = document.getElementById('masterSongName');
let songListContainer = document.getElementById('songListContainer');
let next = document.getElementById('next');
let previous = document.getElementById('previous');
let volumeControl = document.getElementById('volumeControl');
let recommendationElement = document.getElementById('recommendation');
let recommendButton = document.getElementById("recommendButton");

let songs = [];

async function fetchSongs() {
  const response = await fetch('/api/songs?isPodcast=true', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    alert('Session expired. Please log in again.');
    localStorage.removeItem('token');
    window.location.href = 'intro.html';
    return;
  }
  songs = await response.json();
  populateSongs();
  recommendSong();
}

async function checkLike(songId) {
  const response = await fetch('/api/likes', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId })
  });
  return response.status === 200; // Already liked
}

function recommendSong() {
  if (!recommendationElement) {
    console.error("Recommendation element not found in the DOM.");
    return;
  }
  let randomIndex = Math.floor(Math.random() * songs.length);
  let recommendedSong = songs[randomIndex];
  recommendationElement.innerHTML = `
    <div class="recommended-song">
      <img src="${recommendedSong.cover_path || '/images/default.jpg'}" alt="${recommendedSong.title}">
      <h3>${recommendedSong.title}</h3>
    </div>
  `;
  recommendationElement.onclick = () => {
    songIndex = randomIndex;
    playSelectedSong();
  };
}

if (recommendButton) {
  recommendButton.addEventListener("click", recommendSong);
}

window.onload = fetchSongs;

document.getElementById("searchInput").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase();
  const songItems = document.querySelectorAll("#songListContainer .songItem");
  songItems.forEach((item) => {
    const songTitle = item.textContent.toLowerCase();
    if (songTitle.includes(searchQuery)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
});

async function populateSongs() {
  songListContainer.innerHTML = '';
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const isLiked = await checkLike(song.id);
    songListContainer.innerHTML += `
      <div class="songItem" data-index="${i}">
        <img src="${song.cover_path || '/images/default.jpg'}" alt="${song.title}">
        <span class="songName">${song.title}</span>
        <span class="timestamp"><i class="far fa-play-circle"></i></span>
        <button class="like-button" onclick="toggleLike(${song.id}, this)">${isLiked ? 'Unlike' : 'Like'}</button>
        <div class="comments-section">
          <textarea placeholder="Add a comment" id="comment-${song.id}"></textarea>
          <button onclick="addComment(${song.id})">Comment</button>
          <div id="comments-${song.id}"></div>
        </div>
      </div>
    `;
  }
  document.querySelectorAll('.songItem').forEach((item, index) => {
    item.querySelector('.songName').addEventListener('click', () => {
      songIndex = index;
      playSelectedSong();
    });
  });
  songs.forEach(song => fetchComments(song.id));
}

function playSelectedSong() {
  audioElement.src = songs[songIndex].file_path;
  masterSongName.textContent = songs[songIndex].title;
  audioElement.play();
  masterPlay.classList.replace('fa-play-circle', 'fa-pause-circle');
  gif.style.opacity = 1;
}

masterPlay.addEventListener('click', () => {
  if (audioElement.paused || audioElement.currentTime <= 0) {
    audioElement.play();
    masterPlay.classList.replace('fa-play-circle', 'fa-pause-circle');
    gif.style.opacity = 1;
  } else {
    audioElement.pause();
    masterPlay.classList.replace('fa-pause-circle', 'fa-play-circle');
    gif.style.opacity = 0;
  }
});

next.addEventListener('click', () => {
  songIndex = (songIndex + 1) % songs.length;
  playSelectedSong();
});

previous.addEventListener('click', () => {
  songIndex = (songIndex - 1 + songs.length) % songs.length;
  playSelectedSong();
});

audioElement.volume = volumeControl.value / 100;
volumeControl.addEventListener('input', () => {
  audioElement.volume = volumeControl.value / 100;
});

audioElement.addEventListener('timeupdate', () => {
  let progress = parseInt((audioElement.currentTime / audioElement.duration) * 100);
  myProgressBar.value = progress;
});

myProgressBar.addEventListener('input', () => {
  audioElement.currentTime = (myProgressBar.value * audioElement.duration) / 100;
});

async function uploadSong() {
  const title = document.getElementById('songTitle').value;
  const artist = document.getElementById('songArtist').value;
  const file = document.getElementById('songFile').files[0];
  if (!title || !artist || !file) {
    alert('Please fill all fields');
    return;
  }
  const formData = new FormData();
  formData.append('song', file);
  formData.append('title', title);
  formData.append('artist', artist);
  formData.append('isPodcast', 'true');
  try {
    const response = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await response.json();
    if (data.songId) {
      alert('Podcast uploaded');
      fetchSongs();
    } else {
      alert(data.error || 'Upload failed');
    }
  } catch (error) {
    alert('Error uploading podcast');
  }
}

async function toggleLike(songId, button) {
  const method = button.textContent === 'Like' ? 'POST' : 'DELETE';
  try {
    const response = await fetch('/api/likes', {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId })
    });
    const data = await response.json();
    if (data.message) {
      button.textContent = button.textContent === 'Like' ? 'like' : 'Like';
    } else {
      alert(data.error || 'Action failed');
    }
  } catch (error) {
    alert('Error processing like');
  }
}

async function addComment(songId) {
  const commentText = document.getElementById(`comment-${songId}`).value;
  if (!commentText) {
    alert('Please enter a comment');
    return;
  }
  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, commentText })
    });
    const data = await response.json();
    if (data.message) {
      document.getElementById(`comment-${songId}`).value = '';
      fetchComments(songId);
    } else {
      alert(data.error || 'Comment failed');
    }
  } catch (error) {
    alert('Error adding comment');
  }
}

async function fetchComments(songId) {
  const response = await fetch(`/api/comments/${songId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const comments = await response.json();
  const container = document.getElementById(`comments-${songId}`);
  container.innerHTML = '<h5>Comments:</h5>';
  comments.forEach(comment => {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.textContent = `${comment.username}: ${comment.comment_text} (${new Date(comment.created_at).toLocaleString()})`;
    container.appendChild(commentDiv);
  });
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = 'intro.html';
}