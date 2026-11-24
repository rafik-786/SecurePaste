(function () {
  var theme;
  try {
    theme = window.localStorage.getItem('securepaste.theme');
  } catch (error) {
    theme = null;
  }
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
