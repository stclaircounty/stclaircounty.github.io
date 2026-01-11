/**
 * Secure Upload Handler with Turnstile CAPTCHA
 *
 * Handles file uploads for whistleblower/tip submissions.
 */

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Global variable to store Turnstile token
let turnstileToken = null;

// Callback function for Turnstile success
window.onTurnstileSuccess = function(token) {
  turnstileToken = token;
  // Enable submit button if we also have a file selected
  updateSubmitButton();
};

function updateSubmitButton() {
  const submitBtn = document.getElementById('submit-btn');
  const uploader = window.secureUploader;
  if (submitBtn && uploader) {
    submitBtn.disabled = !(turnstileToken && uploader.selectedFile);
  }
}

class SecureUploader {
  constructor() {
    this.selectedFile = null;
  }

  async upload(file, metadata, onProgress) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File exceeds 100MB limit');
    }

    if (!turnstileToken) {
      throw new Error('Please complete the CAPTCHA verification');
    }

    onProgress('Reading file...', 10);

    // Read file as base64
    const fileData = await this.readFileAsBase64(file);

    onProgress('Uploading...', 50);

    const response = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: fileData,
        filename: file.name,
        fileType: file.type || 'application/octet-stream',
        description: metadata.description,
        contactName: metadata.contactName,
        contactEmail: metadata.contactEmail,
        turnstileToken: turnstileToken
      })
    });

    onProgress('Processing...', 90);

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    onProgress('Complete!', 100);
    return result;
  }

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const form = document.getElementById('upload-form');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileName = document.getElementById('file-name');
  const submitBtn = document.getElementById('submit-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressStatus = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percent');
  const result = document.getElementById('result');

  if (!form || !dropZone || !fileInput) return;

  const uploader = new SecureUploader();
  window.secureUploader = uploader; // Make accessible for Turnstile callback

  // File selection handlers
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-accent', 'bg-accent/5');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-accent', 'bg-accent/5');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-accent', 'bg-accent/5');
    if (e.dataTransfer.files.length) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileSelect(e.target.files[0]);
    }
  });

  function handleFileSelect(file) {
    if (file.size > MAX_FILE_SIZE) {
      showError('File exceeds 100MB limit. Please select a smaller file.');
      return;
    }

    uploader.selectedFile = file;
    fileName.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
    fileName.classList.remove('hidden');
    result.classList.add('hidden');
    updateSubmitButton();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showError(message) {
    result.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
        <strong>Error:</strong> ${message}
      </div>
    `;
    result.classList.remove('hidden');
  }

  function showSuccess(message, uploadId) {
    result.innerHTML = `
      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-emerald-800 font-medium">Upload Successful</p>
            <p class="text-emerald-700 text-sm mt-1">${message}</p>
            ${uploadId ? `<p class="text-emerald-600 text-xs mt-2 font-mono">Reference: ${uploadId.slice(0, 8)}</p>` : ''}
          </div>
        </div>
      </div>
    `;
    result.classList.remove('hidden');
  }

  function updateProgress(status, percent) {
    progressStatus.textContent = status;
    progressPercent.textContent = percent + '%';
    progressBar.style.width = percent + '%';
  }

  // Form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!uploader.selectedFile) {
      showError('Please select a file to upload.');
      return;
    }

    if (!turnstileToken) {
      showError('Please complete the CAPTCHA verification.');
      return;
    }

    const metadata = {
      description: document.getElementById('description').value || undefined,
      contactName: document.getElementById('contact-name').value || undefined,
      contactEmail: document.getElementById('contact-email').value || undefined
    };

    // Clean undefined values
    Object.keys(metadata).forEach(key => {
      if (metadata[key] === undefined) delete metadata[key];
    });

    submitBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    result.classList.add('hidden');

    try {
      const uploadResult = await uploader.upload(
        uploader.selectedFile,
        metadata,
        updateProgress
      );

      showSuccess(uploadResult.message, uploadResult.uploadId);
      form.reset();
      fileName.classList.add('hidden');
      uploader.selectedFile = null;

      // Reset Turnstile widget
      if (window.turnstile) {
        turnstile.reset();
        turnstileToken = null;
      }
    } catch (error) {
      showError(error.message);
      // Reset Turnstile on error
      if (window.turnstile) {
        turnstile.reset();
        turnstileToken = null;
      }
    } finally {
      submitBtn.disabled = true; // Always disabled until new token
      progressContainer.classList.add('hidden');
      updateProgress('Preparing...', 0);
    }
  });
});
