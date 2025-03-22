// Get DOM elements
const minReviewsInput = document.getElementById('minReviews');
const saveButton = document.getElementById('save');
const statusElement = document.getElementById('status');
const sortByReviewsRadio = document.getElementById('sortByReviews');
const sortByRatingRadio = document.getElementById('sortByRating');

// Set default values
const DEFAULT_MIN_REVIEWS = 0;
const DEFAULT_SORT_BY = 'reviews';

// Load saved settings when popup opens
chrome.storage.sync.get(['minReviews', 'sortBy'], (result) => {
  // Set minimum reviews with default
  minReviewsInput.value = result.minReviews !== undefined ? result.minReviews : DEFAULT_MIN_REVIEWS;
  
  // Set sort type with default
  if (result.sortBy === 'rating') {
    sortByRatingRadio.checked = true;
  } else {
    sortByReviewsRadio.checked = true;
  }
});

// Save settings when button is clicked
saveButton.addEventListener('click', () => {
  const minReviews = parseInt(minReviewsInput.value) || 0;
  const sortBy = sortByRatingRadio.checked ? 'rating' : 'reviews';
  
  chrome.storage.sync.set({ minReviews, sortBy }, () => {
    // Show success message
    statusElement.classList.add('show');
    setTimeout(() => {
      statusElement.classList.remove('show');
    }, 2000);

    // Notify content script about the update
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SETTINGS_UPDATED',
          minReviews,
          sortBy
        });
      }
    });
  });
}); 