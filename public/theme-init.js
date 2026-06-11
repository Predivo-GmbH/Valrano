/**
 * Applies the saved theme before first paint to avoid a flash of the wrong
 * theme. Lives in an external file (instead of an inline script) so it
 * complies with the Content-Security-Policy: script-src 'self'.
 * Keep in sync with src/contexts/ThemeContext.tsx (storage key 'theme').
 */
;(function () {
  try {
    var theme = localStorage.getItem('theme')
    var root = document.documentElement
    if (theme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
      root.style.colorScheme = 'light'
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    }
  } catch (e) {
    // localStorage unavailable — keep the default dark class from index.html
  }
})()
