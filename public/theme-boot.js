// Starts the page in the theme chosen last time on this device, before anything draws (QA 17 November: pages flashed dark
// while loading in light mode, and Sign in lost the chosen theme after signing out). main.tsx keeps it up to date.
try {
  var theme = localStorage.getItem('accs.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme)
} catch (error) {
  // Storage can be blocked; the device theme applies then.
}
