function renderNav(activePage) {
  const user = getUser();
  const el = document.getElementById('site-nav');
  if (!el) return;

  let rightLinks = '';
  if (user) {
    if (user.role === 'admin') {
      rightLinks += `<a href="admin.html" class="${activePage === 'admin' ? 'active' : ''}">Manage events</a>`;
    }
    rightLinks += `<a href="my-bookings.html" class="${activePage === 'bookings' ? 'active' : ''}">My tickets</a>`;
    rightLinks += `<a href="#" id="logout-link">Log out (${user.name.split(' ')[0]})</a>`;
  } else {
    rightLinks += `<a href="login.html" class="${activePage === 'login' ? 'active' : ''}">Log in</a>`;
    rightLinks += `<a href="register.html" class="btn btn-gold pill-btn">Sign up</a>`;
  }

  el.innerHTML = `
    <div class="nav-inner">
      <a href="index.html" class="brand">Venue<span class="dot">&middot;</span>Book</a>
      <nav class="nav-links">
        <a href="index.html" class="${activePage === 'home' ? 'active' : ''}">Browse events</a>
        ${rightLinks}
      </nav>
    </div>
  `;

  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = 'index.html';
    });
  }
}
