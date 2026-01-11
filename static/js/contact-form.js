/**
 * Contact Form Handler with Turnstile CAPTCHA
 */

// Global variable to store Turnstile token
let turnstileToken = null;

// Callback function for Turnstile success
window.onTurnstileSuccess = function(token) {
  turnstileToken = token;
  // Enable submit button when we have both a valid form and token
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
  }
};

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const status = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    // Check for Turnstile token
    if (!turnstileToken) {
      status.textContent = 'Please complete the CAPTCHA verification.';
      status.className = 'text-sm text-red-600 font-medium';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Sending...
    `;
    status.textContent = '';
    status.className = 'text-sm';

    const data = {
      submission_type: form.submission_type.value,
      name: form.name.value || undefined,
      email: form.email.value || undefined,
      message: form.message.value,
      turnstileToken: turnstileToken
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        status.textContent = result.message;
        status.className = 'text-sm text-emerald-600 font-medium';
        form.reset();
        // Reset Turnstile widget
        if (window.turnstile) {
          turnstile.reset();
          turnstileToken = null;
          submitBtn.disabled = true;
        }
      } else {
        status.textContent = result.error || 'Failed to send message. Please try again.';
        status.className = 'text-sm text-red-600 font-medium';
        // Reset Turnstile on error
        if (window.turnstile) {
          turnstile.reset();
          turnstileToken = null;
        }
      }
    } catch (error) {
      status.textContent = 'Network error. Please check your connection and try again.';
      status.className = 'text-sm text-red-600 font-medium';
    }

    submitBtn.disabled = !turnstileToken;
    submitBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
      Send Message
    `;
  });
});
