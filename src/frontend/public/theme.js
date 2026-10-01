(function () {
  var theme;
  try {
    theme = window.localStorage.getItem('securepaste.theme');
  } catch (error) {
    theme = null;
  }
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  }
})();
