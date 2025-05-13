console.log("Maps Sorter: Script Injected.");

// --- ALL SCRIPT LOGIC WRAPPED IN A MAIN FUNCTION ---
function mapsSorterMain() {
  console.log("Maps Sorter: mapsSorterMain() called.");

  // --- GLOBAL-LIKE VARIABLES & FLAGS (scoped to mapsSorterMain) ---
  let mainObserver = null;
  let mainObserverTargetNode = null;
  let debounceSortTimer = null;
  let initialScanPerformedByMainObserver = false;
  let bootstrapObserverInstance = null;
  let debounceClickRefreshTimer = null;

  let isExtensionCurrentlyEnabled;
  const EXTENSION_ENABLED_KEY = "mapsSorterExtensionEnabled";
  const DEFAULT_ENABLED_STATE = true;

  let currentShowMetricAnnotationSetting; // New: To store the toggle state
  const SHOW_METRIC_ANNOTATION_KEY = "showMetricAnnotation"; // Key for storage
  const DEFAULT_SHOW_METRIC_ANNOTATION_CS = true; // Default for content script

  let settingsLoaded = false; // Flag to ensure settings are loaded once by bootstrap

  // Default formula constants for content script (used for initial values)
  const DEFAULT_FORMULA_INFLUENCE_CS = 0.5;
  const DEFAULT_FORMULA_MIN_USER_RATING_NUM_CS = 50;
  const DEFAULT_FORMULA_BASELINE_CS = 4.5;
  const DEFAULT_FORMULA_BASELINE_COEFFICIENT_CS = 1.5;

  // Variables to store formula constants from settings - initialized with defaults
  let currentFormulaInfluence = DEFAULT_FORMULA_INFLUENCE_CS;
  let currentFormulaMinUserRatingNum = DEFAULT_FORMULA_MIN_USER_RATING_NUM_CS;
  let currentFormulaBaseline = DEFAULT_FORMULA_BASELINE_CS;
  let currentFormulaBaselineCoefficient = DEFAULT_FORMULA_BASELINE_COEFFICIENT_CS;

  // Keys for formula constants in storage
  const FORMULA_INFLUENCE_KEY = "formulaInfluence";
  const FORMULA_MIN_USER_RATING_NUM_KEY = "formulaMinUserRatingNum";
  const FORMULA_BASELINE_KEY = "formulaBaseline";
  const FORMULA_BASELINE_COEFFICIENT_KEY = "formulaBaselineCoefficient";

  // --- UTILITY FUNCTIONS ---
  function calculateCombinedMetric(rating, reviewsCount) {
    // Use the dynamically loaded/updated constants. These are now guaranteed to be initialized.
    const INFLUENCE = currentFormulaInfluence;
    const MIN_USER_RATING_NUM = currentFormulaMinUserRatingNum;
    const BASELINE = currentFormulaBaseline;
    const BASELINE_COEFFICIENT = currentFormulaBaselineCoefficient;

    if (reviewsCount <= 0) {
      return rating > 0 ? rating : 0;
    }
    const baseValue = rating;
    let conditionalFactor;
    if (reviewsCount < MIN_USER_RATING_NUM) {
      conditionalFactor = 1;
    } else {
      const exponent =
        INFLUENCE + (baseValue - BASELINE) * BASELINE_COEFFICIENT;
      conditionalFactor = Math.pow(reviewsCount, exponent);
    }
    const logTerm = Math.log(reviewsCount + 1);
    let score = baseValue + conditionalFactor * logTerm;
    if (isNaN(score) || !isFinite(score)) {
      // console.warn("Maps Sorter: Calculated score is NaN or not finite. Rating:", rating, "Reviews:", reviewsCount, "Constants:", {INFLUENCE, MIN_USER_RATING_NUM, BASELINE, BASELINE_COEFFICIENT});
      return 0; // Return 0 for invalid scores
    }
    return score;
  }

  function bootstrapCallback(mutationsList, observer) {
    const resultsPanel = document.querySelector('div[role="feed"]');
    const sortButtonHolder = document.getElementsByClassName("app-vertical-widget-holder")[0];

    if (resultsPanel && sortButtonHolder && !settingsLoaded) {
      settingsLoaded = true;

      if (bootstrapObserverInstance) {
        if (observer) observer.disconnect();
        bootstrapObserverInstance = null;
        console.log("Maps Sorter: Bootstrap observer disconnected, main setup will proceed.");
      }

      const keysToLoad = [
        EXTENSION_ENABLED_KEY,
        SHOW_METRIC_ANNOTATION_KEY,
        FORMULA_INFLUENCE_KEY,
        FORMULA_MIN_USER_RATING_NUM_KEY,
        FORMULA_BASELINE_KEY,
        FORMULA_BASELINE_COEFFICIENT_KEY
      ];

      chrome.storage.sync.get(keysToLoad, (data) => {
        isExtensionCurrentlyEnabled =
          data[EXTENSION_ENABLED_KEY] !== undefined
            ? data[EXTENSION_ENABLED_KEY]
            : DEFAULT_ENABLED_STATE; // DEFAULT_ENABLED_STATE is already defined

        currentShowMetricAnnotationSetting =
          data[SHOW_METRIC_ANNOTATION_KEY] !== undefined
            ? data[SHOW_METRIC_ANNOTATION_KEY]
            : DEFAULT_SHOW_METRIC_ANNOTATION_CS; // DEFAULT_SHOW_METRIC_ANNOTATION_CS is already defined

        // Load formula constants, overwriting pre-initialized defaults if values exist in storage
        currentFormulaInfluence = data[FORMULA_INFLUENCE_KEY] !== undefined ? data[FORMULA_INFLUENCE_KEY] : currentFormulaInfluence;
        currentFormulaMinUserRatingNum = data[FORMULA_MIN_USER_RATING_NUM_KEY] !== undefined ? data[FORMULA_MIN_USER_RATING_NUM_KEY] : currentFormulaMinUserRatingNum;
        currentFormulaBaseline = data[FORMULA_BASELINE_KEY] !== undefined ? data[FORMULA_BASELINE_KEY] : currentFormulaBaseline;
        currentFormulaBaselineCoefficient = data[FORMULA_BASELINE_COEFFICIENT_KEY] !== undefined ? data[FORMULA_BASELINE_COEFFICIENT_KEY] : currentFormulaBaselineCoefficient;

        console.log(
          `Maps Sorter: Initial settings loaded. Extension Enabled: ${isExtensionCurrentlyEnabled}, Show Annotations: ${currentShowMetricAnnotationSetting}`
        );
        console.log(
          `Maps Sorter: Formula Constants - Inf: ${currentFormulaInfluence}, MinRevBoost: ${currentFormulaMinUserRatingNum}, Base: ${currentFormulaBaseline}, Coeff: ${currentFormulaBaselineCoefficient}`
        );

        addSortingButton();

        if (isExtensionCurrentlyEnabled) {
          enableExtensionFeatures();
        } else {
          console.log("Maps Sorter: Extension is initially disabled via settings.");
          updateButtonAppearance(false);
        }
      });
    } else if (resultsPanel && sortButtonHolder && settingsLoaded) {
        if (observer && bootstrapObserverInstance) {
            observer.disconnect();
            bootstrapObserverInstance = null;
        }
    }
  }

  function formatCombinedMetric(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return "";
    }
    value = parseFloat(value);

    if (value >= 999950) {
      const valInM = value / 1000000;
      if (valInM < 10) {
        return (Math.round(valInM * 10) / 10).toFixed(1) + "M";
      } else {
        return Math.round(valInM) + "M";
      }
    } else if (value > 995) {
      const valInK = value / 1000;
      if (valInK < 10) {
        return (Math.round(valInK * 10) / 10).toFixed(1) + "k";
      } else {
        return Math.round(valInK) + "k";
      }
    }
    else {
      return Math.round(value).toString();
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- DOM MANIPULATION & DISPLAY ---
  function updateOrAddMetricDisplay(reviewElement, combinedMetricValue) {
    const parent = reviewElement.parentNode;
    if (!parent) return;
    let metricSpan = parent.querySelector(".combined-metric-display");

    // If extension is disabled OR annotations are set to hidden
    if (!isExtensionCurrentlyEnabled || !currentShowMetricAnnotationSetting) {
      if (metricSpan) {
        metricSpan.remove(); // Remove the metric if it exists
      }
      return; // Do nothing further
    }

    // If we reach here, extension is enabled AND annotations should be shown
    const formattedMetric = formatCombinedMetric(combinedMetricValue);
    if (!metricSpan) {
      metricSpan = document.createElement("span");
      metricSpan.className = "combined-metric-display";
      metricSpan.style.color = "#5f6368";
      metricSpan.style.fontSize = "inherit";
      metricSpan.style.marginLeft = "4px";
      reviewElement.after(metricSpan); // Insert after the review element
    }
    metricSpan.textContent = `[${formattedMetric}]`;
  }


  function processSingleItemForMetric(articleLikeElement) {
    const itemName =
      articleLikeElement.querySelector(".qBF1Pd")?.textContent ||
      articleLikeElement.ariaLabel ||
      "Unknown Item";

    if (
      !articleLikeElement ||
      typeof articleLikeElement.querySelector !== "function"
    ) {
      console.warn(
        "Maps Sorter:  -> Invalid articleLikeElement for processing"
      );
      return false;
    }
    const reviewElement = articleLikeElement.querySelector(".UY7F9");
    if (!reviewElement) {
      // If annotation setting is false, an existing metric on an item that *lost* its reviewElement
      // won't be cleaned up by this specific function call. Broader sweeps in displayAllMetricsNow handle this.
      return false;
    }

    const reviewsText = reviewElement.textContent;
    const reviewsCount = parseInt(reviewsText.replace(/[^\d]/g, ""), 10) || 0;
    const ratingElement = articleLikeElement.querySelector(".MW4etd");

    const rating = ratingElement
      ? parseFloat(ratingElement.textContent.replace(",", "."))
      : 0;

    const combinedMetric = calculateCombinedMetric(rating, reviewsCount);
    // updateOrAddMetricDisplay will respect isExtensionCurrentlyEnabled and currentShowMetricAnnotationSetting
    updateOrAddMetricDisplay(reviewElement, combinedMetric);
    return true; // Signifies processing was attempted for this item.
  }


  function findArticleElementParent(reviewEl) {
    if (!reviewEl) return null;
    let articleElement = reviewEl.closest("div[jsaction][aria-label]");
    if (!articleElement) {
      const tempParent = reviewEl.closest("div[jsaction]");
      if (tempParent) {
        const parentOfTemp = tempParent.parentNode;
        if (parentOfTemp && parentOfTemp.nodeType === Node.ELEMENT_NODE) {
          articleElement = parentOfTemp;
        }
      }
    }
    if (!articleElement) {
      articleElement = reviewEl.closest("div[aria-label]");
    }
    if (!articleElement) {
      articleElement = reviewEl.closest('div[role="article"]');
    }
    return articleElement;
  }

  async function displayAllMetricsNow() {
    if (!isExtensionCurrentlyEnabled) {
      // If extension is off, ensure all metrics are gone
      document.querySelectorAll(".combined-metric-display").forEach(span => span.remove());
      return false;
    }

    // If annotation setting is off, also ensure all metrics are gone
    if (!currentShowMetricAnnotationSetting) {
        document.querySelectorAll(".combined-metric-display").forEach(span => span.remove());
        return false; // No metrics to update/add if setting is off
    }

    // Proceed to display/update if enabled and annotation setting is true
    const reviewElements = Array.from(
      document.querySelectorAll('div[role="feed"] .UY7F9')
    );

    let metricsUpdatedCount = 0;
    for (const reviewEl of reviewElements) {
      const articleElement = findArticleElementParent(reviewEl);

      if (!articleElement) {
        continue;
      }
      if (articleElement.offsetParent === null) {
        continue;
      }

      let processed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (processSingleItemForMetric(articleElement)) { // This will respect settings
          metricsUpdatedCount++;
          processed = true;
          break;
        }
        if (attempt < 2) await delay(50);
      }
    }
    return metricsUpdatedCount > 0;
  }

  function sortResults() {
    if (!isExtensionCurrentlyEnabled) {
      return;
    }
    // Ensure metrics are processed (shown/hidden) before sorting
    // This is important because sorting logic might depend on combinedMetric data attribute if we add it later,
    // or simply for visual consistency during sorting.
    // processSingleItemForMetric called below will handle the currentShowMetricAnnotationSetting.
    const allReviewElementsInFeed = Array.from(
      document.querySelectorAll('div[role="feed"] .UY7F9')
    );

    if (allReviewElementsInFeed.length === 0) {
      return;
    }

    allReviewElementsInFeed.forEach((reviewEl) => {
      const articleElement = findArticleElementParent(reviewEl);
      if (articleElement) {
        processSingleItemForMetric(articleElement); // This ensures metric displayed/hidden as per setting
      }
    });

    chrome.storage.sync.get(["minReviews", "sortBy"], (result) => {
      const minReviews = result.minReviews || 0;
      const sortBy = result.sortBy || "reviews";

      const itemsData = [];
      const currentReviewElementsForSort = Array.from(
        document.querySelectorAll('div[role="feed"] .UY7F9')
      );

      currentReviewElementsForSort.forEach((reviewElement) => {
        const articleElement = findArticleElementParent(reviewElement);
        if (!articleElement) return;

        const reviewsText = reviewElement.textContent;
        const reviewsCount =
          parseInt(reviewsText.replace(/[^\d]/g, ""), 10) || 0;
        const ratingElement = articleElement.querySelector(".MW4etd");
        const rating = ratingElement
          ? parseFloat(ratingElement.textContent.replace(",", "."))
          : 0;
        const combinedMetric = calculateCombinedMetric(rating, reviewsCount);
        const separatorElement = articleElement.nextElementSibling;
        itemsData.push({
          reviewElement,
          articleElement,
          separatorElement,
          reviewsCount,
          rating,
          combinedMetric,
        });
      });

      if (itemsData.length === 0) {
        return;
      }

      const sortedItemsToDisplay = itemsData
        .filter((item) => item.reviewsCount >= minReviews)
        .sort((a, b) => {
          if (sortBy === "rating") {
            if (b.rating === a.rating) return b.reviewsCount - a.reviewsCount;
            return b.rating - a.rating;
          } else if (sortBy === "combined") {
            if (b.combinedMetric === a.combinedMetric) {
              if (b.rating === a.rating) return b.reviewsCount - a.reviewsCount;
              return b.rating - a.rating;
            }
            return b.combinedMetric - a.combinedMetric;
          } else {
            if (b.reviewsCount === a.reviewsCount) {
              if (b.rating === a.rating)
                return b.combinedMetric - a.combinedMetric;
              return b.rating - a.rating;
            }
            return b.reviewsCount - a.reviewsCount;
          }
        });

      const parentContainer =
        itemsData[0].articleElement.closest('div[role="feed"]') ||
        itemsData[0].articleElement.closest('div[aria-label*="Results for"]');
      if (!parentContainer) {
        return;
      }

      const spinnerElements = [];
      parentContainer.querySelectorAll(".lXJj5c.Hk4XGb").forEach((spinner) => {
        spinnerElements.push(spinner);
        spinner.remove();
      });

      itemsData.forEach((item) => {
        const display = item.reviewsCount >= minReviews ? "" : "none";
        item.articleElement.style.display = display;
        if (
          item.separatorElement &&
          !item.separatorElement.hasAttribute("jsaction") &&
          !item.separatorElement.classList.contains("lXJj5c") &&
          item.separatorElement.parentNode === parentContainer
        ) {
          item.separatorElement.style.display = display;
        }
      });

      const prefixNodes = [];
      if (
        parentContainer.children[0] &&
        !parentContainer.children[0].matches("div[jsaction][aria-label]") &&
        !findArticleElementParent(
          parentContainer.children[0].querySelector(".UY7F9")
        ) &&
        !parentContainer.children[0].classList.contains("lXJj5c")
      ) {
        prefixNodes.push(parentContainer.children[0]);
      }
      if (
        parentContainer.children[1] &&
        !parentContainer.children[1].matches("div[jsaction][aria-label]") &&
        (!prefixNodes[0] || parentContainer.children[1] !== prefixNodes[0]) &&
        !findArticleElementParent(
          parentContainer.children[1].querySelector(".UY7F9")
        ) &&
        !parentContainer.children[1].classList.contains("lXJj5c")
      ) {
        prefixNodes.push(parentContainer.children[1]);
      }

      itemsData.forEach((item) => {
        if (item.articleElement.parentNode === parentContainer)
          item.articleElement.remove();
        if (
          item.separatorElement &&
          !item.separatorElement.hasAttribute("jsaction") &&
          !item.separatorElement.classList.contains("lXJj5c") &&
          item.separatorElement.parentNode === parentContainer
        ) {
          item.separatorElement.remove();
        }
      });

      prefixNodes.forEach((node) => {
        if (node.parentNode !== parentContainer) parentContainer.prepend(node);
        else if (
          node !== parentContainer.firstChild &&
          (!prefixNodes[1] || node !== parentContainer.children[1])
        ) {
          parentContainer.prepend(node);
        }
      });

      sortedItemsToDisplay.forEach((item) => {
        parentContainer.appendChild(item.articleElement);
        item.articleElement.style.display = "";
        if (
          item.separatorElement &&
          !item.separatorElement.hasAttribute("jsaction") &&
          !item.separatorElement.classList.contains("lXJj5c")
        ) {
          parentContainer.appendChild(item.separatorElement);
          item.separatorElement.style.display = "";
        }
      });

      spinnerElements.forEach((spinner) => {
        parentContainer.appendChild(spinner);
      });
    });
  }

  // --- UI FUNCTIONS ---
  function updateButtonAppearance(isEnabled) {
    const buttonDiv = document.querySelector("#sorter .mNcDk");
    const buttonElement = document.getElementById("sVuEFc-button");

    if (buttonDiv) {
      buttonDiv.style.backgroundColor = isEnabled ? "lightgreen" : "unset";
    }
    if (buttonElement) {
      buttonElement.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }
  }

  async function toggleExtensionState() {
    const newState = !isExtensionCurrentlyEnabled;
    isExtensionCurrentlyEnabled = newState; // This is set first
    console.log(
      `Maps Sorter: Extension state toggled to ${
        isExtensionCurrentlyEnabled ? "ON" : "OFF"
      }`
    );
    updateButtonAppearance(isExtensionCurrentlyEnabled);

    try {
      await chrome.storage.sync.set({ [EXTENSION_ENABLED_KEY]: newState });
    } catch (error) {
      console.error("Maps Sorter: Error saving extension state:", error);
    }

    if (isExtensionCurrentlyEnabled) {
      await enableExtensionFeatures(); // currentShowMetricAnnotationSetting is already loaded/set
    } else {
      await disableExtensionFeatures();
    }
  }

  async function enableExtensionFeatures() {
    console.log("Maps Sorter: Enabling features.");
    // currentShowMetricAnnotationSetting is assumed to have been loaded by bootstrapCallback
    initialScanPerformedByMainObserver = false;

    // Ensure metrics are displayed (or hidden) according to the current setting
    // This call is crucial when enabling the extension.
    await displayAllMetricsNow();

    if (!mainObserver || !mainObserverTargetNode?.isConnected) {
      startMainObserver(); // This will eventually call displayAllMetricsNow again via its initial scan logic
    } else {
      // If observer exists, displayAllMetricsNow was already called above.
      // Still, ensure sort happens if items are present.
      const reviewElementsExist = document.querySelector(
        'div[role="feed"] .UY7F9'
      );
      if (reviewElementsExist) {
        chrome.storage.sync.get(["sortBy"], (result) => {
          if (result.sortBy) {
            sortResults();
          }
        });
        initialScanPerformedByMainObserver = true;
      }
    }
  }


  async function disableExtensionFeatures() {
    console.log("Maps Sorter: Disabling features.");
    // This will remove metrics regardless of currentShowMetricAnnotationSetting
    const metricDisplays = document.querySelectorAll(
      ".combined-metric-display"
    );
    metricDisplays.forEach((span) => span.remove());

    clearTimeout(debounceSortTimer);
    clearTimeout(debounceClickRefreshTimer);

    if (mainObserver) {
      mainObserver.disconnect();
      console.log("Maps Sorter: Main observer disconnected.");
    }
    initialScanPerformedByMainObserver = false;
  }

  function addSortingButton() {
    // ... (button adding logic remains the same)
    if (document.getElementById("sorter")) return;

    const outerDiv = document.createElement("div");
    outerDiv.classList.add("app-vertical-item");
    outerDiv.style.display = "";
    outerDiv.id = "sorter";
    const innerDiv = document.createElement("div");
    innerDiv.classList.add("sVuEFc");
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Toggle Maps Sorter On/Off");
    button.setAttribute(
      "aria-pressed",
      isExtensionCurrentlyEnabled ? "true" : "false"
    );
    button.id = "sVuEFc-button";
    button.classList.add("Tc0rEd", "Zf54rc", "L6Bbsd");
    const buttonDiv = document.createElement("div");
    buttonDiv.classList.add("mNcDk", "bpLs1b");
    buttonDiv.onclick = toggleExtensionState;
    buttonDiv.style.backgroundImage = "unset";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("fill", "#5b5b5b");
    svg.setAttribute("height", "20px");
    svg.setAttribute("width", "20px");
    svg.setAttribute("viewBox", "0 0 460.088 460.088");
    svg.setAttribute("xml:space", "preserve");
    const svgContent = `<g><g><g><path d="M25.555,139.872h257.526V88.761H25.555C11.442,88.761,0,100.203,0,114.316C0,128.429,11.442,139.872,25.555,139.872z"/><path d="M25.555,242.429h257.526v-51.111H25.555C11.442,191.318,0,202.76,0,216.874C0,230.988,11.442,242.429,25.555,242.429z"/><path d="M25.555,293.874v0.001C11.442,293.875,0,305.316,0,319.43s11.442,25.555,25.555,25.555h178.91 c-2.021-6.224-3.088-12.789-3.088-19.523c0-11.277,2.957-22.094,8.48-31.588H25.555z"/><path d="M450.623,302.611c-12.62-12.621-33.083-12.621-45.704,0l-26.535,26.535V52.926c0-17.849-14.469-32.317-32.318-32.317 s-32.318,14.469-32.318,32.317v276.22l-26.535-26.535c-12.621-12.62-33.083-12.621-45.704,0 c-12.621,12.621-12.621,33.083,0,45.704l81.7,81.699c12.596,12.6,33.084,12.643,45.714,0l81.7-81.699 C463.243,335.694,463.244,315.232,450.623,302.611z"/></g></g></g>`;
    svg.innerHTML = svgContent;
    buttonDiv.appendChild(svg);
    button.appendChild(buttonDiv);
    innerDiv.appendChild(button);
    outerDiv.appendChild(innerDiv);

    const originalElement = document.getElementsByClassName(
      "app-vertical-widget-holder"
    )[0];
    if (originalElement) {
      originalElement.appendChild(outerDiv);
      updateButtonAppearance(isExtensionCurrentlyEnabled);
    } else {
      console.warn(
        "Maps Sorter: Could not find 'app-vertical-widget-holder' to attach button."
      );
    }
  }

  // --- OBSERVERS AND INITIALIZATION LOGIC ---
  function mainMutationCallback(mutationsList, obs) {
    if (!isExtensionCurrentlyEnabled) return; // Guard: if extension gets disabled while observer is active

    let processedNewNodeInThisBatch = false;
    const reviewElementsToProcess = new Set();

    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches(".UY7F9")) {
              reviewElementsToProcess.add(node);
            }
            if (node.querySelectorAll) {
              node
                .querySelectorAll(".UY7F9")
                .forEach((revEl) => reviewElementsToProcess.add(revEl));
            }
          }
        });
      }
    }

    if (reviewElementsToProcess.size > 0) {
      for (const reviewEl of reviewElementsToProcess) {
        if (!reviewEl.isConnected || reviewEl.offsetParent === null) {
          continue;
        }
        const articleElement = findArticleElementParent(reviewEl);
        if (articleElement) {
          if (processSingleItemForMetric(articleElement)) { // Respects annotation setting
            processedNewNodeInThisBatch = true;
          }
        }
      }
    }

    if (!initialScanPerformedByMainObserver) {
      const reviewElementsExist = document.querySelector(
        'div[role="feed"] .UY7F9'
      );
      if (reviewElementsExist || reviewElementsToProcess.size > 0) {
        displayAllMetricsNow().then((anyMetricsUpdated) => { // Respects annotation setting
          if (
            anyMetricsUpdated ||
            document.querySelectorAll(
              'div[role="feed"] div[jsaction][aria-label]'
            ).length > 0 ||
            reviewElementsToProcess.size > 0
          ) {
            initialScanPerformedByMainObserver = true;
            chrome.storage.sync.get(["sortBy"], (result) => {
              if (result.sortBy && isExtensionCurrentlyEnabled) {
                sortResults();
              }
            });
          }
        });
      }
    } else if (reviewElementsToProcess.size > 0) {
      clearTimeout(debounceSortTimer);
      debounceSortTimer = setTimeout(() => {
        if (!isExtensionCurrentlyEnabled) return;
         chrome.storage.sync.get(["sortBy"], (result) => {
          if (result.sortBy) {
            sortResults(); // Will call processSingleItemForMetric which respects annotation setting
          }
        });
      }, 750);
    }
  }

  function startMainObserver() {
    // ... (startMainObserver logic largely remains the same)
    if (mainObserver) mainObserver.disconnect();

    mainObserverTargetNode = document.querySelector('div[role="feed"]');
    if (!mainObserverTargetNode) {
      const firstResultItem = document.querySelector(
        'div[jsaction][aria-label], div[role="article"]'
      ); 
      if (firstResultItem) {
        mainObserverTargetNode = firstResultItem.closest(
          'div[aria-label*="Results for"], div[aria-label*="Search results"]'
        );
        if (!mainObserverTargetNode)
          mainObserverTargetNode = firstResultItem.parentNode;
      }
    }

    if (!mainObserverTargetNode) {
      if (isExtensionCurrentlyEnabled) { // Only retry if enabled
        setTimeout(startMainObserver, 1000);
      }
      return;
    }

    mainObserver = new MutationObserver(mainMutationCallback);
    const config = { childList: true, subtree: true };
    mainObserver.observe(mainObserverTargetNode, config);

    // Initial trigger for observer after setup, if enabled.
    // mainMutationCallback will handle initialScanPerformedByMainObserver flag.
    if (isExtensionCurrentlyEnabled) {
      setTimeout(() => {
        if (
          isExtensionCurrentlyEnabled && // Double check state
          mainObserver?.takeRecords && // Check if observer is active
          !initialScanPerformedByMainObserver // Only if initial scan not yet done
        ) {
          // console.log("Maps Sorter: Manually triggering mainMutationCallback for initial scan.");
          mainMutationCallback([], mainObserver); // Pass empty mutations to trigger scan logic
        }
      }, 100);
    }
  }


  function runPrimarySetup() {
    if (!isExtensionCurrentlyEnabled) {
      console.warn(
        "Maps Sorter: runPrimarySetup called but extension is unexpectedly disabled. Aborting."
      );
      return;
    }
    // Settings (isExtensionCurrentlyEnabled, currentShowMetricAnnotationSetting) are already loaded
    // by bootstrapCallback before this is called.
    // enableExtensionFeatures will handle applying these settings.
    // This function effectively becomes a call to start the main observer logic.
    startMainObserver();
  }


  function bootstrapCallback(mutationsList, observer) {
    const resultsPanel = document.querySelector('div[role="feed"]');
    const sortButtonHolder = document.getElementsByClassName("app-vertical-widget-holder")[0];

    if (resultsPanel && sortButtonHolder && !settingsLoaded) {
      settingsLoaded = true; // Prevent multiple initializations

      if (bootstrapObserverInstance) { // Disconnect this bootstrap observer
        if (observer) observer.disconnect(); // observer is the bootstrapObserverInstance itself
        bootstrapObserverInstance = null;
        console.log("Maps Sorter: Bootstrap observer disconnected, main setup will proceed.");
      }

      // Load initial settings
      chrome.storage.sync.get([EXTENSION_ENABLED_KEY, SHOW_METRIC_ANNOTATION_KEY], (data) => {
        isExtensionCurrentlyEnabled =
          data[EXTENSION_ENABLED_KEY] !== undefined
            ? data[EXTENSION_ENABLED_KEY]
            : DEFAULT_ENABLED_STATE;

        currentShowMetricAnnotationSetting =
          data[SHOW_METRIC_ANNOTATION_KEY] !== undefined
            ? data[SHOW_METRIC_ANNOTATION_KEY]
            : DEFAULT_SHOW_METRIC_ANNOTATION_CS;

        console.log(
          `Maps Sorter: Initial settings loaded. Extension Enabled: ${isExtensionCurrentlyEnabled}, Show Annotations: ${currentShowMetricAnnotationSetting}`
        );

        addSortingButton(); // Add the toggle button for the extension itself

        if (isExtensionCurrentlyEnabled) {
          enableExtensionFeatures(); // This will use the loaded settings
        } else {
          console.log("Maps Sorter: Extension is initially disabled via settings.");
          // Ensure button reflects disabled state if not already handled by addSortingButton's internal check
          updateButtonAppearance(false);
        }
      });
    } else if (resultsPanel && sortButtonHolder && settingsLoaded) {
        // Redundant trigger, ensure observer is disconnected if it wasn't
        if (observer && bootstrapObserverInstance) {
            observer.disconnect();
            bootstrapObserverInstance = null;
        }
    }
  }


  // --- EVENT LISTENERS ---
  document.addEventListener(
    "click",
    function (event) {
      if (!isExtensionCurrentlyEnabled || !initialScanPerformedByMainObserver)
        return;

      const clickedItemContainer = event.target.closest(
        'div[jsaction][aria-label], div[role="article"]'
      );
      if (clickedItemContainer) {
        clearTimeout(debounceClickRefreshTimer);
        debounceClickRefreshTimer = setTimeout(() => {
          if (!isExtensionCurrentlyEnabled) return;
          displayAllMetricsNow().then(() => { // Respects annotation setting
            chrome.storage.sync.get(["sortBy"], (result) => {
              if (result.sortBy) {
                sortResults();
              }
            });
          });
        }, 450);
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SETTINGS_UPDATED") {
      // Update local annotation setting if provided
      if (message.showMetricAnnotation !== undefined) {
        const oldValue = currentShowMetricAnnotationSetting;
        currentShowMetricAnnotationSetting = message.showMetricAnnotation;
        if (oldValue !== currentShowMetricAnnotationSetting) {
            console.log("Maps Sorter: Annotation visibility setting changed to", currentShowMetricAnnotationSetting);
        }
      }

      if (!isExtensionCurrentlyEnabled) {
        sendResponse({ status: "acknowledged, extension disabled" });
        return true;
      }

      // Re-process and re-sort based on potentially new settings (minReviews, sortBy, or showMetricAnnotation)
      displayAllMetricsNow().then(() => { // This will use the updated currentShowMetricAnnotationSetting
        if (document.querySelectorAll('div[role="feed"] .UY7F9').length > 0) {
          sortResults();
        }
        sendResponse({ status: "settings applied" });
      });
      return true; // Indicates response will be sent asynchronously
    }
    sendResponse({ status: "unknown message type" });
    return true;
  });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SETTINGS_UPDATED") {
      // ... (logic for updating currentShowMetricAnnotationSetting remains the same) ...

      // Update formula constants if present in the message
      // These will overwrite the values loaded during bootstrap or previous updates
      if (message.formulaInfluence !== undefined ) { // No need to check for difference here, just update
        currentFormulaInfluence = message.formulaInfluence;
        // console.log("Maps Sorter: Formula Influence updated to", currentFormulaInfluence);
      }
      if (message.formulaMinUserRatingNum !== undefined) {
        currentFormulaMinUserRatingNum = message.formulaMinUserRatingNum;
        // console.log("Maps Sorter: Formula Min User Rating Num updated to", currentFormulaMinUserRatingNum);
      }
      if (message.formulaBaseline !== undefined) {
        currentFormulaBaseline = message.formulaBaseline;
        // console.log("Maps Sorter: Formula Baseline updated to", currentFormulaBaseline);
      }
      if (message.formulaBaselineCoefficient !== undefined) {
        currentFormulaBaselineCoefficient = message.formulaBaselineCoefficient;
        // console.log("Maps Sorter: Formula Baseline Coefficient updated to", currentFormulaBaselineCoefficient);
      }

      if (!isExtensionCurrentlyEnabled) {
        sendResponse({ status: "acknowledged, extension disabled" });
        return true;
      }

      displayAllMetricsNow().then(() => {
        if (document.querySelectorAll('div[role="feed"] .UY7F9').length > 0) {
          sortResults();
        }
        sendResponse({ status: "settings applied" });
      });
      return true;
    }
    sendResponse({ status: "unknown message type" });
    return true;
  });


  // --- INITIALIZATION KICK-OFF ---
  if (bootstrapObserverInstance) bootstrapObserverInstance.disconnect(); // Clear previous if any (e.g. HMR)
  bootstrapObserverInstance = new MutationObserver(bootstrapCallback);
  bootstrapObserverInstance.observe(document.body, {
    childList: true,
    subtree: true,
  });
} // End of mapsSorterMain

// --- SCRIPT ENTRY POINT ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mapsSorterMain, { once: true });
} else {
  mapsSorterMain();
}