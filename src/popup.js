// Get DOM elements
const minReviewsInput = document.getElementById('minReviews');
const saveButton = document.getElementById('save');
const statusElement = document.getElementById('status');
const sortByReviewsRadio = document.getElementById('sortByReviews');
const sortByRatingRadio = document.getElementById('sortByRating');
const sortByCombinedRadio = document.getElementById('sortByCombined');
const showMetricAnnotationToggle = document.getElementById('showMetricAnnotation');

// New formula constant inputs
const formulaInfluenceInput = document.getElementById('formulaInfluence');
const formulaMinUserRatingNumInput = document.getElementById('formulaMinUserRatingNum');
const formulaBaselineInput = document.getElementById('formulaBaseline');
const formulaBaselineCoefficientInput = document.getElementById('formulaBaselineCoefficient');

// Set default values
const DEFAULT_MIN_REVIEWS = 0;
const DEFAULT_SORT_BY = 'reviews';
const DEFAULT_SHOW_METRIC_ANNOTATION = true;

// Default formula constants
const DEFAULT_FORMULA_INFLUENCE = 0.5;
const DEFAULT_FORMULA_MIN_USER_RATING_NUM = 50;
const DEFAULT_FORMULA_BASELINE = 4.5;
const DEFAULT_FORMULA_BASELINE_COEFFICIENT = 1.5;

// Keys for storage
const STORAGE_KEYS = [
  'minReviews', 'sortBy', 'showMetricAnnotation',
  'formulaInfluence', 'formulaMinUserRatingNum', 'formulaBaseline', 'formulaBaselineCoefficient'
];

// Load saved settings when popup opens
chrome.storage.sync.get(STORAGE_KEYS, (result) => {
  minReviewsInput.value = result.minReviews !== undefined ? result.minReviews : DEFAULT_MIN_REVIEWS;

  const currentSortBy = result.sortBy || DEFAULT_SORT_BY;
  if (currentSortBy === 'rating') {
    sortByRatingRadio.checked = true;
  } else if (currentSortBy === 'combined') {
    sortByCombinedRadio.checked = true;
  } else {
    sortByReviewsRadio.checked = true;
  }

  showMetricAnnotationToggle.checked = result.showMetricAnnotation !== undefined ? result.showMetricAnnotation : DEFAULT_SHOW_METRIC_ANNOTATION;

  // Load formula constants
  formulaInfluenceInput.value = result.formulaInfluence !== undefined ? result.formulaInfluence : DEFAULT_FORMULA_INFLUENCE;
  formulaMinUserRatingNumInput.value = result.formulaMinUserRatingNum !== undefined ? result.formulaMinUserRatingNum : DEFAULT_FORMULA_MIN_USER_RATING_NUM;
  formulaBaselineInput.value = result.formulaBaseline !== undefined ? result.formulaBaseline : DEFAULT_FORMULA_BASELINE;
  formulaBaselineCoefficientInput.value = result.formulaBaselineCoefficient !== undefined ? result.formulaBaselineCoefficient : DEFAULT_FORMULA_BASELINE_COEFFICIENT;
});

// Save settings when button is clicked
saveButton.addEventListener('click', () => {
  const minReviews = parseInt(minReviewsInput.value);
  if (isNaN(minReviews) || minReviews < 0) {
    minReviewsInput.value = DEFAULT_MIN_REVIEWS;
  }

  let sortBy = DEFAULT_SORT_BY;
  if (sortByRatingRadio.checked) {
    sortBy = 'rating';
  } else if (sortByCombinedRadio.checked) {
    sortBy = 'combined';
  } else if (sortByReviewsRadio.checked) {
    sortBy = 'reviews';
  }

  const showMetricAnnotation = showMetricAnnotationToggle.checked;

  // Get and validate formula constants
  let formulaInfluence = parseFloat(formulaInfluenceInput.value);
  if (isNaN(formulaInfluence) || formulaInfluence < 0 || formulaInfluence > 1) {
    formulaInfluence = DEFAULT_FORMULA_INFLUENCE;
    formulaInfluenceInput.value = formulaInfluence;
  }

  let formulaMinUserRatingNum = parseInt(formulaMinUserRatingNumInput.value);
  if (isNaN(formulaMinUserRatingNum) || formulaMinUserRatingNum < 0) {
    formulaMinUserRatingNum = DEFAULT_FORMULA_MIN_USER_RATING_NUM;
    formulaMinUserRatingNumInput.value = formulaMinUserRatingNum;
  }

  let formulaBaseline = parseFloat(formulaBaselineInput.value);
  if (isNaN(formulaBaseline) || formulaBaseline < 1 || formulaBaseline > 5) {
    formulaBaseline = DEFAULT_FORMULA_BASELINE;
    formulaBaselineInput.value = formulaBaseline;
  }

  let formulaBaselineCoefficient = parseFloat(formulaBaselineCoefficientInput.value);
  if (isNaN(formulaBaselineCoefficient)) { // No specific range, just ensure it's a number
    formulaBaselineCoefficient = DEFAULT_FORMULA_BASELINE_COEFFICIENT;
    formulaBaselineCoefficientInput.value = formulaBaselineCoefficient;
  }


  const settingsToSave = {
    minReviews: parseInt(minReviewsInput.value) || DEFAULT_MIN_REVIEWS, // Ensure saving default if empty
    sortBy,
    showMetricAnnotation,
    formulaInfluence,
    formulaMinUserRatingNum,
    formulaBaseline,
    formulaBaselineCoefficient
  };

  chrome.storage.sync.set(settingsToSave, () => {
    statusElement.classList.add('show');
    setTimeout(() => {
      statusElement.classList.remove('show');
    }, 2000);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SETTINGS_UPDATED',
          ...settingsToSave // Send all saved settings
        });
      }
    });
  });
});