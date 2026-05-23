const auth = {
  checkAuth() {
    const token = api.getToken();
    const user = api.getUser();

    const path = window.location.pathname;
    const isLoginPage = path.includes('/login');

    if (!token || !user) {
      if (!isLoginPage) {
        window.location.href = '/login';
      }
      return false;
    }

    if (isLoginPage) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/';
      }
      return true;
    }

    if (path.includes('/admin') && user.role !== 'admin' && user.role !== 'superadmin') {
      window.location.href = '/';
      return false;
    }

    // Prevent Admin/Superadmin from accidentally seeing the worker dashboard
    if ((path === '/' || path === '/index.html') && (user.role === 'admin' || user.role === 'superadmin')) {
      window.location.href = '/admin';
      return false;
    }

    return true;
  },

  logout() {
    api.removeToken();
    window.location.href = '/login';
  },

  initPage() {
    this.checkAuth();
    this.enforceWorkerMobileOnly();

    const logoutBtns = document.querySelectorAll('.logout-action');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });

    const user = api.getUser();
    if (user) {
      const workerNameEls = document.querySelectorAll('.worker-name-placeholder');
      workerNameEls.forEach(el => {
        el.textContent = user.name;
      });

      const workerRoleEls = document.querySelectorAll('.worker-role-placeholder');
      workerRoleEls.forEach(el => {
        el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      });

      // Update role badges style classes and text content
      const updateRoleBadge = (role) => {
        const adminRoleBadge = document.querySelector('.user-role.badge');
        if (adminRoleBadge) {
          if (role === 'superadmin') {
            adminRoleBadge.className = 'user-role badge badge-superadmin';
            adminRoleBadge.textContent = 'Super Admin';
          } else if (role === 'admin') {
            adminRoleBadge.className = 'user-role badge badge-admin';
            adminRoleBadge.textContent = 'Administrator';
          } else {
            adminRoleBadge.className = 'user-role badge badge-worker';
            adminRoleBadge.textContent = 'Field Executive';
          }
        }
      };
      updateRoleBadge(user.role);

      // Background sync of user profile details from the server to keep localStorage fresh
      api.get('/auth/me').then(freshUser => {
        if (freshUser) {
          localStorage.setItem('user', JSON.stringify(freshUser));

          workerNameEls.forEach(el => {
            el.textContent = freshUser.name;
          });
          workerRoleEls.forEach(el => {
            el.textContent = freshUser.role.charAt(0).toUpperCase() + freshUser.role.slice(1);
          });
          updateRoleBadge(freshUser.role);

          const phoneEl = document.getElementById('info-phone');
          if (phoneEl) {
            phoneEl.textContent = freshUser.phoneNumber || 'Not Provided';
          }
        }
      }).catch(err => {
        console.warn('Failed to sync profile from server:', err);
      });
    }
  },

  enforceWorkerMobileOnly() {
    const user = api.getUser();
    if (!user || user.role !== 'worker') {
      const existingBlocker = document.getElementById('desktop-blocker');
      if (existingBlocker) {
        existingBlocker.remove();
        document.body.style.overflow = '';
      }
      return;
    }

    const checkSize = () => {
      let blocker = document.getElementById('desktop-blocker');
      if (window.innerWidth > 768) {
        if (!blocker) {
          blocker = document.createElement('div');
          blocker.id = 'desktop-blocker';
          blocker.className = 'desktop-blocker-overlay';
          blocker.innerHTML = `
            <div class="desktop-blocker-card">
              <div class="desktop-blocker-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="3" ry="3"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18" stroke-width="4" stroke-linecap="round"></line>
                </svg>
              </div>
              <h2>Mobile Screen Required</h2>
              <p>The FieldForce field worker operations are restricted to mobile screens only.</p>
              <p class="desktop-blocker-instruction">Please open this page on a mobile device.</p>
              <button class="btn btn-secondary logout-action" style="margin-top: 24px; max-width: 160px; margin-left: auto; margin-right: auto; padding: 10px 16px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 4px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                Sign Out
              </button>
            </div>
          `;
          document.body.appendChild(blocker);

          blocker.querySelector('.logout-action').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
          });

          document.body.style.overflow = 'hidden';
        }
      } else {
        if (blocker) {
          blocker.remove();
          document.body.style.overflow = '';
        }
      }
    };

    checkSize();
    window.addEventListener('resize', checkSize);
  }
};

// Run automatically on content load
document.addEventListener('DOMContentLoaded', () => {
  auth.initPage();
});
