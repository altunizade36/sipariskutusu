// Prevent fontfaceobserver 6000ms timeout from crashing the Expo web preview
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && e.reason.message.indexOf('timeout exceeded') !== -1) {
      e.preventDefault();
    }
  });
}
