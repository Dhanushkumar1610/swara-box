console.log("Welcome to Swara Box");

const token = localStorage.getItem('token');
const userId = localStorage.getItem('userId');
if (!token || !userId) {
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
  try {
    const type = document.getElementById('typeFilter').value;
    const language = document.getElementById('languageFilter').value;
    let url = '/api/songs';
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (language) params.append('language', language);
    if (params.toString()) url += `?${params.toString()}`;
    console.log('fetchSongs URL:', url);
    console.log('fetchSongs data:', songs.map(s => ({ id: s.id, title: s.title, type: s.type, language: s.language })));
    console.log('fetchSongs token:', token ? token.slice(0, 20) + '...' : 'null');
    console.log('fetchSongs userId:', userId);
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('fetchSongs response:', response.status, response.statusText);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'Failed to parse response' };
      }
      console.error('fetchSongs error:', errorData);
      if (response.status === 401) {
        console.log('Session expired, redirecting to login');
        alert('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = 'intro.html';
      } else {
        alert(`Error fetching content: ${errorData.error || response.statusText}`);
      }
      return;
    }
    songs = await response.json();
    console.log('fetchSongs data:', songs.map(s => ({ id: s.id, title: s.title, type: s.type, language: s.language })));
    if (!Array.isArray(songs)) {
      console.error('fetchSongs: Expected array, got:', songs);
      alert('Error fetching content: Invalid data format');
      return;
    }
    console.log('fetchSongs: Populating', songs.length, 'songs');
    populateSongs();
    recommendSong();
  } catch (error) {
    console.error('fetchSongs exception:', error.message, error.stack);
    alert(`Error fetching content: ${error.message}`);
  }
}

function recommendSong() {
  if (!recommendationElement) {
    console.error('recommendSong: Recommendation element not found');
    return;
  }
  if (!Array.isArray(songs) || songs.length === 0) {
    console.log('recommendSong: No songs available for recommendation');
    recommendationElement.innerHTML = '<p>No recommendations available</p>';
    return;
  }
  const validSongs = songs.filter(song => song && song.id && song.title && song.file_path);
  if (validSongs.length === 0) {
    console.log('recommendSong: No valid songs for recommendation');
    recommendationElement.innerHTML = '<p>No valid songs available</p>';
    return;
  }
  const randomIndex = Math.floor(Math.random() * validSongs.length);
  const recommendedSong = validSongs[randomIndex];
  console.log('recommendSong: Selected', { id: recommendedSong.id, title: recommendedSong.title });
  recommendationElement.innerHTML = `
    <div class="recommended-song">
      <img src="${recommendedSong.cover_path || '/images/default.jpg'}" alt="${recommendedSong.title}">
      <h3>${recommendedSong.title}</h3>
    </div>
  `;
  recommendationElement.onclick = () => {
    songIndex = songs.indexOf(recommendedSong);
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
    const songTitle = item.querySelector('.songName').textContent.toLowerCase();
    if (songTitle.includes(searchQuery)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
});

async function populateSongs() {
  console.log('populateSongs: Starting with', songs.length, 'songs');
  songListContainer.innerHTML = '';
  if (!Array.isArray(songs) || songs.length === 0) {
    console.log('populateSongs: No songs to display');
    songListContainer.innerHTML = '<p>No songs found. Try adjusting filters or uploading new content.</p>';
    return;
  }
  let validSongCount = 0;
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    if (!song || !song.id || !song.title || !song.file_path) {
      console.warn('populateSongs: Skipping invalid song at index', i, song);
      continue;
    }
    console.log('populateSongs: Processing song', { id: song.id, title: song.title, type: song.type });
    let isLiked;
    try {
      isLiked = await isSongLiked(song.id);
    } catch (error) {
      console.error('populateSongs: Error checking like status for song', song.id, error);
      isLiked = false;
    }
    const isOwner = song.user_id && song.user_id.toString() === userId;
    songListContainer.innerHTML += `
  <div class="songItem" data-index="${i}">
    <img src="${song.cover_path || '/images/default.jpg'}" alt="${song.title}">
    <span class="songName">${song.title} (${song.type || 'Unknown'}, ${song.language || 'Unknown'})</span>
    <span class="timestamp"><i class="far fa-play-circle"></i></span>

    <div class="controls-vertical">
      <button class="like-button" data-song-id="${song.id}">${isLiked ? 'Unlike' : 'Like'}</button>
      ${isOwner ? `<button class="delete-button" data-song-id="${song.id}">Delete</button>` : ''}
      <div class="comments-section">
        <textarea placeholder="Add a comment" id="comment-${song.id}"></textarea>
        <button data-song-id="${song.id}">Comment</button>
        <div id="comments-${song.id}"></div>
      </div>
    </div>
  </div>
`;

    validSongCount++;
  }
  console.log('populateSongs: Rendered', validSongCount, 'valid songs');
  if (validSongCount === 0) {
    songListContainer.innerHTML = '<p>No valid songs found. Try adjusting filters or uploading new content.</p>';
  }
  document.querySelectorAll('.songItem').forEach((item, index) => {
    item.querySelector('.songName').addEventListener('click', () => {
      songIndex = index;
      playSelectedSong();
    });
  });
  document.querySelectorAll('.like-button').forEach(button => {
    button.addEventListener('click', () => toggleLike(button.dataset.songId, button));
  });
  document.querySelectorAll('.delete-button').forEach(button => {
    button.addEventListener('click', () => deleteSong(button.dataset.songId, button));
  });
  document.querySelectorAll('.comments-section button').forEach(button => {
    button.addEventListener('click', () => addComment(button.dataset.songId));
  });
  songs.forEach(song => {
    if (song && song.id) {
      fetchComments(song.id);
    }
  });
}



async function deleteSong(songId, button) {
  if (!confirm('Are you sure you want to delete this song?')) return;
  try {
    const response = await fetch(`/api/songs/${songId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('deleteSong response:', response.status, response.statusText);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('deleteSong error:', errorData);
      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = 'intro.html';
      } else if (response.status === 403) {
        alert('You are not authorized to delete this song.');
      } else if (response.status === 404) {
        alert('Song not found.');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    alert('Song deleted');
    button.closest('.songItem').remove();
    songs = songs.filter(song => song.id !== songId);
  } catch (error) {
    console.error('Error deleting song:', error);
    alert('Error deleting song');
  }
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
  const isPodcast = document.getElementById('isPodcast').value;
  const type = document.getElementById('songType').value;
  const language = document.getElementById('songLanguage').value;
  const file = document.getElementById('songFile').files[0];
  console.log('uploadSong:', { title, artist, isPodcast, type, language, file: file?.name });
  if (!title || !artist || !file || !type || !language) {
    alert('Please fill all fields');
    return;
  }
  const formData = new FormData();
  formData.append('song', file);
  formData.append('title', title);
  formData.append('artist', artist);
  formData.append('isPodcast', isPodcast);
  formData.append('type', type);
  formData.append('language', language);
  try {
    const response = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    console.log('uploadSong response:', response.status, response.statusText);
    const data = await response.json();
    console.log('uploadSong data:', data);
    if (data.songId) {
      alert('Content uploaded');
      fetchSongs();
    } else {
      alert(data.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Error uploading content:', error.message, error.stack);
    alert('Error uploading content');
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
    console.log('toggleLike response:', response.status, response.statusText);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('toggleLike error:', errorData);
      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = 'intro.html';
      } else if (response.status === 400 && method === 'POST') {
        alert('Already liked');
      } else if (response.status === 404 && method === 'DELETE') {
        alert('Like not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    button.textContent = button.textContent === 'Like' ? 'Unlike' : 'Like';
  } catch (error) {
    console.error('Error processing like:', error);
    alert('Error processing like');
  }
}

async function addComment(songId) {
  const commentText = document.getElementById(`comment-${songId}`).value.trim();
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
    console.log('addComment response:', response.status, response.statusText);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('addComment error:', errorData);
      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = 'intro.html';
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    document.getElementById(`comment-${songId}`).value = '';
    fetchComments(songId);
  } catch (error) {
    console.error('Error adding comment:', error);
    alert('Error adding comment');
  }
}

async function fetchComments(songId) {
  try {
    const response = await fetch(`/api/comments/${songId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('fetchComments response:', response.status, response.statusText);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('fetchComments error:', errorData);
      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = 'intro.html';
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const comments = await response.json();
    const container = document.getElementById(`comments-${songId}`);
    container.innerHTML = '<h5>Comments:</h5>';
    comments.forEach(comment => {
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      commentDiv.textContent = `${comment.username}: ${comment.comment_text} (${new Date(comment.created_at).toLocaleString()})`;
      container.appendChild(commentDiv);
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  window.location.href = 'intro.html';
}