import { findVideoTkhdOffset, calculateMatrixOffset, modifyTkhdMatrix, getMatrix } from '../dist/mp4_tkhd.js';
import { findElstAtoms, modifyElstAtom } from '../dist/mp4_elst.js';
import init, { parse_mp4, trim_mp4 } from "./mp4_parser.js";


document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const videoInput = document.getElementById('videoInput');
    const videoPreview = document.getElementById('videoPreview');
    const video = document.getElementById('video');
    const fileName = document.getElementById('fileName');
    const rotationAngle = document.getElementById('rotationAngle');
    const downloadBtn = document.getElementById('downloadBtn');
    const errorMessage = document.getElementById('errorMessage');
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const tabContainer = document.getElementById('tabContainer');
    const trimmingControls = document.getElementById('trimmingControls');
    const spinnerContainer = document.getElementById('spinnerContainer');

    // State variables
    let currentMatrix = null;
    let fileBuffer;
    let originalVideo = null;

    initializeTrimControls();

    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        // Upload events
        uploadArea.addEventListener('click', () => videoInput.click());
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        videoInput.addEventListener('change', handleInputChange);
    }

    /**
     * Handle dragover event
     * @param {Event} e - Drag event
     */
    function handleDragOver(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#3498db';
        uploadArea.style.backgroundColor = 'rgba(52, 152, 219, 0.05)';
    }

    // When video is loaded, show the tab container
    function showTabsAfterVideoLoad() {
        const videoPreview = document.getElementById('videoPreview');
        if (!videoPreview.classList.contains('hidden')) {
            tabContainer.classList.remove('hidden');

            // Move trim controls to the trim tab if they exist
            if (trimmingControls) {
                // Hide the original container
                trimmingControls.classList.add('hidden');
            }
        }
    }

    // Call this function when video is loaded
    // You'll need to add this call to your existing video load handler

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to current button and corresponding pane
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab') + 'Tab';
            document.getElementById(tabId).classList.add('active');

            // Update download button text based on selected tab
            updateDownloadButtonText(button.getAttribute('data-tab'));
        });
    });

    // Update download button text based on selected tab
    function updateDownloadButtonText(tabType) {
        switch (tabType) {
            case 'rotate':
                downloadBtn.textContent = 'Download Rotated Video';
                break;
            case 'trim':
                downloadBtn.textContent = 'Download Trimmed Video';
                break;
            case 'audio':
                downloadBtn.textContent = 'Download Audio';
                break;
            default:
                downloadBtn.textContent = 'Download';
        }
    }

    // Handle the download action based on active tab
    downloadBtn.addEventListener('click', function () {
        const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');

        switch (activeTab) {
            case 'rotate':
                pushDataLayerEvent("video_rotate");
                handleDownload();
                break;
            case 'trim':
                // Call your existing trim download function
                pushDataLayerEvent("video_trim");
                handleTrim();
                break;
            case 'audio':
                // New function to handle audio extraction
                pushDataLayerEvent("video_extract_audio");
                handleAudioExtraction();
                break;
        }
    });

    function handleAudioExtraction() {
        spinnerContainer.style.display = 'flex'; // Show
        setTimeout(() => {
            try {
                const parsedData = parse_mp4(fileBuffer);
                if (parsedData) {
                    // Create and trigger download
                    const blob = new Blob([new Uint8Array(parsedData)], { type: 'audio/mp4' });
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'extracted_audio.m4a'
                    link.click();
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error(err);
            } finally {
                spinnerContainer.style.display = 'none'; // Show
            }
        }, 250);
    }

    function handleTrim() {
        spinnerContainer.style.display = 'flex'; // Show

        // Get trim times
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const startTimeUs = BigInt(Math.round(parseTime(startTimeInput.value) * 1_000_000));
        const endTimeUs = BigInt(Math.round(parseTime(endTimeInput.value) * 1_000_000));


        setTimeout(() => {
            try {
                const parsedData = trim_mp4(fileBuffer, startTimeUs, endTimeUs);
                if (parsedData) {
                    // Create and trigger download
                    const blob = new Blob([new Uint8Array(parsedData)], { type: 'video/mp4' });
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'trimmed_video.mp4'
                    link.click();
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error(err);
            } finally {
                spinnerContainer.style.display = 'none'; // Show
            }
        }, 250);
    }


    /**
     * Handle dragleave event
     */
    function handleDragLeave() {
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.backgroundColor = 'transparent';
    }

    /**
     * Handle drop event
     * @param {Event} e - Drop event
     */
    function handleDrop(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.backgroundColor = 'transparent';

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('video/')) {
            handleFileUpload(files[0]);
        }
    }

    /**
     * Handle input change event
     */
    function handleInputChange() {
        if (videoInput.files.length > 0) {
            handleFileUpload(videoInput.files[0]);
        }
    }

    /**
     * Handle file upload
     * @param {File} file - Uploaded file
     */
    function handleFileUpload(file) {
        errorMessage.classList.add('hidden');
        originalVideo = file;

        // Read file as ArrayBuffer
        const reader = new FileReader();
        reader.onload = function (e) {
            fileBuffer = new Uint8Array(e.target.result);
            console.log("File has been fully read.");
            console.log("File size:", fileBuffer.length);
            downloadBtn.disabled = false;
        };
        reader.readAsArrayBuffer(file);

        // Set up video preview
        const videoURL = URL.createObjectURL(file);
        video.src = videoURL;
        fileName.textContent = file.name;

        // Set up video metadata
        video.onloadedmetadata = function () {
            const videoDuration = Math.round(video.duration);
            document.getElementById('endTime').value = formatTime(videoDuration);
            // Track video upload analytics
            pushDataLayerEvent("video_upload", {
                video_name: file.name,
                video_size: file.size,
                video_duration: videoDuration
            });
        };

        // Show video preview and trimming controls
        videoPreview.classList.remove('hidden');

        // Show the tabs
        document.getElementById('tabContainer').classList.remove('hidden');

        // Reset matrix
        currentMatrix = null;
    }

    /**
     * Handle download button click
     */
    function handleDownload() {
        console.log('Download button clicked');
        console.log('Video:', originalVideo.name);
        console.log('Selected rotation angle:', rotationAngle.value);

        // Process video
        const tkhdOffsetAndSize = findVideoTkhdOffset(fileBuffer);

        // Apply rotation
        if (tkhdOffsetAndSize) {
            const matrixOffset = calculateMatrixOffset(fileBuffer, tkhdOffsetAndSize[0]);
            if (currentMatrix == null) {
                currentMatrix = getMatrix(fileBuffer, matrixOffset);
            }
            modifyTkhdMatrix(fileBuffer, matrixOffset, currentMatrix, rotationAngle.value);

            // Create and trigger download
            const blob = new Blob([fileBuffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName.textContent;
            link.click();

            URL.revokeObjectURL(url);

            // Track success
            pushDataLayerEvent("video_rotate_success", {
                video_angle: rotationAngle.value,
                video_name: fileName.textContent
            });
        } else {
            // Show error
            errorMessage.classList.remove('hidden');

            // Track failure
            pushDataLayerEvent("video_rotate_failure", {
                video_angle: rotationAngle.value,
                video_name: fileName.textContent
            });
        }
    }

    // Wait for both DOM and WASM module to load
    async function run() {
        // Initialize the WASM module
        await init();

        console.log("WASM module loaded successfully!");
    }

    // Initialize
    initEventListeners();
    // Run the initialization
    run().catch(e => {
        console.error("Initialization failed:", e);
        document.getElementById('status').textContent = 'Failed to load WASM module: ' + e.message;
    });
});