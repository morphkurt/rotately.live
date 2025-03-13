function initializeTrimControls() {
    const video = document.getElementById('video');
    const trimSlider = document.getElementById('trimSlider');
    const trimHandleStart = document.getElementById('trimHandleStart');
    const trimHandleEnd = document.getElementById('trimHandleEnd');
    const trimProgress = document.getElementById('trimProgress');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const previewTrimBtn = document.getElementById('previewTrimBtn');

    let videoDuration = 0;
    let isDraggingStart = false;
    let isDraggingEnd = false;
    let startTime = 0;
    let endTime = 0;


    // Initialize trim controls when video metadata is loaded
    video.addEventListener('loadedmetadata', () => {
        videoDuration = video.duration;
        endTime = videoDuration;

        // Format and set initial end time value
        endTimeInput.value = formatTime(videoDuration);
        startTimeInput.value = '00:00:00.000';

        // Position end handle at the end (adjust for transform)
        trimHandleEnd.style.left = '100%';
        updateProgressBar();
    });

    // Update progress bar between handles
    function updateProgressBar() {
        video.currentTime = startTime;
        const startPercent = (startTime / videoDuration) * 100;
        const endPercent = (endTime / videoDuration) * 100;

        trimProgress.style.left = `${startPercent}%`;
        trimProgress.style.width = `${endPercent - startPercent}%`;
    }

    // Handle drag position calculation for both mouse and touch events
    function calculateDragPosition(clientX) {
        const sliderRect = trimSlider.getBoundingClientRect();
        const percentage = Math.min(Math.max(0, (clientX - sliderRect.left) / sliderRect.width), 1);
        return percentage * videoDuration;
    }

    // MOUSE EVENTS
    // Handle mouse down on start handle
    trimHandleStart.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingStart = true;
    });

    // Handle mouse down on end handle
    trimHandleEnd.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingEnd = true;
    });

    // Handle mouse move for both handles
    document.addEventListener('mousemove', (e) => {
        if (!isDraggingStart && !isDraggingEnd) return;

        const newTime = calculateDragPosition(e.clientX);

        if (isDraggingStart) {
            if (newTime < endTime) {
                startTime = newTime;
                trimHandleStart.style.left = `${(startTime / videoDuration) * 100}%`;
                startTimeInput.value = formatTime(startTime);
                updateProgressBar();
            }
        } else if (isDraggingEnd) {
            if (newTime > startTime) {
                endTime = newTime;
                trimHandleEnd.style.left = `${(endTime / videoDuration) * 100}%`;
                endTimeInput.value = formatTime(endTime);
                updateProgressBar();
            }
        }
    });

    // Handle mouse up to stop dragging
    document.addEventListener('mouseup', () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    });

    // TOUCH EVENTS
    // Handle touch start on start handle
    trimHandleStart.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling when touching the handle
        isDraggingStart = true;
    });

    // Handle touch start on end handle
    trimHandleEnd.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling when touching the handle
        isDraggingEnd = true;
    });

    // Handle touch move for both handles
    document.addEventListener('touchmove', (e) => {
        if (!isDraggingStart && !isDraggingEnd) return;

        // Get the first touch point
        const touch = e.touches[0];
        const newTime = calculateDragPosition(touch.clientX);

        if (isDraggingStart) {
            if (newTime < endTime) {
                startTime = newTime;
                trimHandleStart.style.left = `${(startTime / videoDuration) * 100}%`;
                startTimeInput.value = formatTime(startTime);
                updateProgressBar();
            }
        } else if (isDraggingEnd) {
            if (newTime > startTime) {
                endTime = newTime;
                trimHandleEnd.style.left = `${(endTime / videoDuration) * 100}%`;
                endTimeInput.value = formatTime(endTime);
                updateProgressBar();
            }
        }
    }, { passive: false }); // Important for iOS to allow preventDefault

    // Handle touch end to stop dragging
    document.addEventListener('touchend', () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    });

    // Handle click/tap directly on the slider (jump to position)
    trimSlider.addEventListener('click', (e) => {
        // Only handle direct clicks on the slider, not on the handles
        if (e.target === trimSlider || e.target === trimProgress) {
            const newTime = calculateDragPosition(e.clientX);

            // Determine which handle to move based on proximity
            const distToStart = Math.abs(newTime - startTime);
            const distToEnd = Math.abs(newTime - endTime);

            if (distToStart < distToEnd) {
                // Move start handle
                startTime = Math.min(newTime, endTime - 1);
                trimHandleStart.style.left = `${(startTime / videoDuration) * 100}%`;
                startTimeInput.value = formatTime(startTime);
            } else {
                // Move end handle
                endTime = Math.max(newTime, startTime + 1);
                trimHandleEnd.style.left = `${(endTime / videoDuration) * 100}%`;
                endTimeInput.value = formatTime(endTime);
            }

            updateProgressBar();
        }
    });

    // Also support tapping on the slider for mobile
    trimSlider.addEventListener('touchend', (e) => {
        // Prevent default only if we're not dragging (to allow proper handle dragging)
        if (!isDraggingStart && !isDraggingEnd) {
            // Only handle direct taps on the slider, not on the handles
            if (e.target === trimSlider || e.target === trimProgress) {
                const touch = e.changedTouches[0];
                const newTime = calculateDragPosition(touch.clientX);

                // Determine which handle to move based on proximity
                const distToStart = Math.abs(newTime - startTime);
                const distToEnd = Math.abs(newTime - endTime);

                if (distToStart < distToEnd) {
                    // Move start handle
                    startTime = Math.min(newTime, endTime - 1);
                    trimHandleStart.style.left = `${(startTime / videoDuration) * 100}%`;
                    startTimeInput.value = formatTime(startTime);
                } else {
                    // Move end handle
                    endTime = Math.max(newTime, startTime + 1);
                    trimHandleEnd.style.left = `${(endTime / videoDuration) * 100}%`;
                    endTimeInput.value = formatTime(endTime);
                }

                updateProgressBar();
            }
        }
    });

    // Handle manual time input for start time
    startTimeInput.addEventListener('change', () => {
        const inputTime = parseTime(startTimeInput.value);
        if (inputTime < endTime && inputTime >= 0 && inputTime <= videoDuration) {
            startTime = inputTime;
            trimHandleStart.style.left = `${(startTime / videoDuration) * 100}%`;
            updateProgressBar();
        } else {
            // Reset to valid value
            startTimeInput.value = formatTime(startTime);
        }
    });

    // Handle manual time input for end time
    endTimeInput.addEventListener('change', () => {
        const inputTime = parseTime(endTimeInput.value);
        if (inputTime > startTime && inputTime >= 0 && inputTime <= videoDuration) {
            endTime = inputTime;
            trimHandleEnd.style.left = `${(endTime / videoDuration) * 100}%`;
            updateProgressBar();
        } else {
            // Reset to valid value
            endTimeInput.value = formatTime(endTime);
        }
    });

    // Preview trim button - play video from start to end point
    previewTrimBtn.addEventListener('click', () => {
        video.currentTime = startTime;
        video.play();

        // Stop video when reaching end time
        const checkTime = () => {
            if (video.currentTime >= endTime) {
                video.pause();
                video.removeEventListener('timeupdate', checkTime);
            }
        };

        video.addEventListener('timeupdate', checkTime);
    });

    // Add a timeline indicator for current playback position
    const createTimelineIndicator = () => {
        const indicator = document.createElement('div');
        indicator.className = 'timeline-indicator';
        indicator.style.cssText = `
    position: absolute;
    top: -10px;
    bottom: -10px;
    width: 2px;
    background-color: #ff0000;
    z-index: 3;
    pointer-events: none;
    display: none;
`;
        trimSlider.appendChild(indicator);
        return indicator;
    };

    const timelineIndicator = createTimelineIndicator();

    // Update timeline indicator when video is playing
    video.addEventListener('timeupdate', () => {
        if (video.currentTime >= startTime && video.currentTime <= endTime) {
            timelineIndicator.style.display = 'block';

            // Calculate position as percentage of video duration
            const percentage = (video.currentTime / videoDuration) * 100;

            // Set the position using percentage (consistent with other elements)
            timelineIndicator.style.left = `${percentage}%`;
        } else {
            timelineIndicator.style.display = 'none';
        }
    });

    // Hide timeline indicator when video is paused
    video.addEventListener('pause', () => {
        timelineIndicator.style.display = 'none';
    });
}