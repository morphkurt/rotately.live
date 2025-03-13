import { findVideoTkhdOffset, calculateMatrixOffset, modifyTkhdMatrix, getMatrix } from '../dist/mp4_tkhd.js';
import { findElstAtoms, modifyElstAtom } from '../dist/mp4_elst.js';

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

        // Download event
        downloadBtn.addEventListener('click', handleDownload);
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
        document.getElementById('trimmingControls').classList.remove('hidden');
        
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

        // Get trim times
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const startTimeUs = BigInt(Math.round(parseTime(startTimeInput.value) * 1_000_000));
        const endTimeUs = BigInt(Math.round(parseTime(endTimeInput.value) * 1_000_000));

        // Process video
        const tkhdOffsetAndSize = findVideoTkhdOffset(fileBuffer);
        const elstAtoms = findElstAtoms(fileBuffer);

        // Apply trimming
        if (elstAtoms) {
            for (let index = 0; index < elstAtoms.length; index++) {
                let atom = elstAtoms[index];
                if (atom.entries.length == 1) {
                    modifyElstAtom(fileBuffer, atom, startTimeUs, endTimeUs);
                }
            }
        }

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

    // Initialize
    initEventListeners();
});