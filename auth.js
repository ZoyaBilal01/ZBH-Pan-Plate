/* ==========================================================================
   ZBH Pan & Plate — Authentication Module
   ========================================================================== */

(function () {
  'use strict';

  const auth = firebase.auth();
  const database = firebase.database();

  const authModal = document.getElementById('authModal');
  const authModalBody = document.getElementById('authModalBody');
  const authModalClose = document.getElementById('authModalClose');
  const authButtons = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const userDropdownName = document.getElementById('userDropdownName');
  const userDropdownEmail = document.getElementById('userDropdownEmail');
  const userDropdownRegion = document.getElementById('userDropdownRegion');
  const userAvatarLarge = document.getElementById('userAvatarLarge');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  let currentAuthView = 'login';
  let favoritesSynced = false;

  /* -------------------- Auth State Observer -------------------- */
  auth.onAuthStateChanged((user) => {
    if (user) {
      updateUIForLoggedInUser(user);
      syncFavoritesFromFirebase(user.uid);
    } else {
      updateUIForLoggedOutUser();
    }
  });

  /* -------------------- UI Updates -------------------- */
  function updateUIForLoggedInUser(user) {
    if (authButtons) authButtons.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';

    const displayName = user.displayName || 'User';
    const email = user.email || '';
    const initial = displayName.charAt(0).toUpperCase();

    if (userName) userName.textContent = displayName;
    if (userAvatar) userAvatar.textContent = initial;
    if (userDropdownName) userDropdownName.textContent = displayName;
    if (userDropdownEmail) userDropdownEmail.textContent = email;
    if (userAvatarLarge) userAvatarLarge.textContent = initial;

    database.ref('users/' + user.uid + '/profile').once('value').then((snapshot) => {
      const data = snapshot.val();
      if (data && data.region) {
        if (userDropdownRegion) userDropdownRegion.textContent = data.region;
      } else {
        if (userDropdownRegion) userDropdownRegion.textContent = 'Unknown';
      }
    }).catch(() => {
      if (userDropdownRegion) userDropdownRegion.textContent = 'Unknown';
    });
  }

  function updateUIForLoggedOutUser() {
    if (authButtons) authButtons.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (userDropdown) userDropdown.style.display = 'none';
  }

  /* -------------------- Favorites Sync -------------------- */
  function syncFavoritesFromFirebase(uid) {
    if (favoritesSynced) return;
    const localFavorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');

    database.ref('users/' + uid + '/favorites').once('value').then((snapshot) => {
      const firebaseFavorites = snapshot.val() || [];
      if (firebaseFavorites.length > 0) {
        const merged = [...new Set([...localFavorites, ...firebaseFavorites])];
        localStorage.setItem('zbh_favorites', JSON.stringify(merged));
        database.ref('users/' + uid + '/favorites').set(merged);
      } else if (localFavorites.length > 0) {
        database.ref('users/' + uid + '/favorites').set(localFavorites);
      }
      favoritesSynced = true;
      document.dispatchEvent(new CustomEvent('auth:favoritesUpdated'));
    }).catch((error) => {
      console.error('Error syncing favorites:', error);
    });
  }

  function saveFavoritesToFirebase(uid, favoritesArray) {
    return database.ref('users/' + uid + '/favorites').set(favoritesArray);
  }

  /* -------------------- Modal Management -------------------- */
  function openAuthModal(view) {
    currentAuthView = view || 'login';
    renderAuthModal();
    authModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    authModal.classList.remove('open');
    document.body.style.overflow = '';
    authModalBody.innerHTML = '';
  }

  function renderAuthModal() {
    if (currentAuthView === 'login') {
      renderLoginForm();
    } else if (currentAuthView === 'signup') {
      renderSignupForm();
    } else if (currentAuthView === 'forgot') {
      renderForgotForm();
    }
  }

  /* -------------------- Login Form -------------------- */
  function renderLoginForm() {
    authModalBody.innerHTML = `
      <div class="auth-header">
        <h2>Welcome Back</h2>
        <p>Sign in to save favorites and access your account</p>
      </div>
      <form class="auth-form" id="loginForm" novalidate>
        <div class="form-group">
          <label for="loginEmail">Email</label>
          <input type="email" id="loginEmail" required placeholder="your@email.com" autocomplete="email">
          <span class="field-error" id="loginEmailError"></span>
        </div>
        <div class="form-group">
          <label for="loginPassword">Password</label>
          <div class="password-field">
            <input type="password" id="loginPassword" required placeholder="Enter your password" autocomplete="current-password">
            <button type="button" class="password-toggle" data-target="loginPassword" aria-label="Toggle password visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
          <span class="field-error" id="loginPasswordError"></span>
        </div>
        <button type="button" class="btn btn-secondary auth-submit-btn google-btn" id="loginGoogleBtn">
          <span class="google-icon">G</span> Continue with Google
        </button>
        <div class="auth-divider-or"><span>or</span></div>
        <div class="auth-form-actions">
          <button type="submit" class="btn btn-primary auth-submit-btn" id="loginSubmitBtn">
            <span class="btn-text">Sign In</span>
            <span class="btn-loader" style="display:none;"></span>
          </button>
        </div>
        <div class="auth-form-footer">
          <button type="button" class="auth-link-btn" id="showForgotBtn">Forgot password?</button>
          <span class="auth-divider">|</span>
          <button type="button" class="auth-link-btn" id="showSignupBtn">Create account</button>
        </div>
      </form>
    `;
    bindAuthFormEvents('login');
  }

  /* -------------------- Signup Form -------------------- */
  function renderSignupForm() {
    authModalBody.innerHTML = `
      <div class="auth-header">
        <h2>Create Account</h2>
        <p>Join ZBH Pan & Plate to save your favorite recipes</p>
      </div>
      <form class="auth-form" id="signupForm" novalidate>
        <div class="form-group">
          <label for="signupName">Full Name</label>
          <input type="text" id="signupName" required placeholder="John Doe" autocomplete="name">
          <span class="field-error" id="signupNameError"></span>
        </div>
        <div class="form-group">
          <label for="signupEmail">Email</label>
          <input type="email" id="signupEmail" required placeholder="your@email.com" autocomplete="email">
          <span class="field-error" id="signupEmailError"></span>
        </div>
        <div class="form-group">
          <label for="signupRegion">Country / Region</label>
          <select id="signupRegion" required>
            <option value="">Select your region</option>
            <option value="Pakistan">Pakistan</option>
            <option value="India">India</option>
            <option value="Bangladesh">Bangladesh</option>
            <option value="China">China</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="UAE">UAE</option>
            <option value="Saudi Arabia">Saudi Arabia</option>
            <option value="Australia">Australia</option>
            <option value="Other">Other</option>
          </select>
          <span class="field-error" id="signupRegionError"></span>
        </div>
        <div class="form-group">
          <label for="signupPassword">Password</label>
          <div class="password-field">
            <input type="password" id="signupPassword" required placeholder="Min 6 characters" autocomplete="new-password">
            <button type="button" class="password-toggle" data-target="signupPassword" aria-label="Toggle password visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
          <span class="field-error" id="signupPasswordError"></span>
        </div>
        <div class="form-group">
          <label for="signupConfirmPassword">Confirm Password</label>
          <div class="password-field">
            <input type="password" id="signupConfirmPassword" required placeholder="Re-enter your password" autocomplete="new-password">
            <button type="button" class="password-toggle" data-target="signupConfirmPassword" aria-label="Toggle password visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
          <span class="field-error" id="signupConfirmPasswordError"></span>
        </div>
        <button type="button" class="btn btn-secondary auth-submit-btn google-btn" id="signupGoogleBtn">
          <span class="google-icon">G</span> Continue with Google
        </button>
        <div class="auth-divider-or"><span>or</span></div>
        <div class="auth-form-actions">
          <button type="submit" class="btn btn-primary auth-submit-btn" id="signupSubmitBtn">
            <span class="btn-text">Create Account</span>
            <span class="btn-loader" style="display:none;"></span>
          </button>
        </div>
        <div class="auth-form-footer">
          <span>Already have an account?</span>
          <button type="button" class="auth-link-btn" id="showLoginBtn">Sign in</button>
        </div>
      </form>
    `;
    bindAuthFormEvents('signup');
  }

  /* -------------------- Forgot Password Form -------------------- */
  function renderForgotForm() {
    authModalBody.innerHTML = `
      <div class="auth-header">
        <h2>Reset Password</h2>
        <p>Enter your email and we'll send you a reset link</p>
      </div>
      <form class="auth-form" id="forgotForm" novalidate>
        <div class="form-group">
          <label for="forgotEmail">Email</label>
          <input type="email" id="forgotEmail" required placeholder="your@email.com" autocomplete="email">
          <span class="field-error" id="forgotEmailError"></span>
        </div>
        <div class="auth-form-actions">
          <button type="submit" class="btn btn-primary auth-submit-btn" id="forgotSubmitBtn">
            <span class="btn-text">Send Reset Link</span>
            <span class="btn-loader" style="display:none;"></span>
          </button>
        </div>
        <div class="auth-form-footer">
          <button type="button" class="auth-link-btn" id="backToLoginBtn">Back to sign in</button>
        </div>
      </form>
    `;
    bindAuthFormEvents('forgot');
  }

  /* -------------------- Form Event Binding -------------------- */
  function bindAuthFormEvents(view) {
    const passwordToggles = authModalBody.querySelectorAll('.password-toggle');
    passwordToggles.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input.type === 'password') {
          input.type = 'text';
          btn.querySelector('.eye-icon').textContent = '🙈';
        } else {
          input.type = 'password';
          btn.querySelector('.eye-icon').textContent = '👁️';
        }
      });
    });

    if (view === 'login') {
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
      }
      const showForgotBtn = document.getElementById('showForgotBtn');
      if (showForgotBtn) {
        showForgotBtn.addEventListener('click', () => {
          currentAuthView = 'forgot';
          renderAuthModal();
        });
      }
      const showSignupBtn = document.getElementById('showSignupBtn');
      if (showSignupBtn) {
        showSignupBtn.addEventListener('click', () => {
          currentAuthView = 'signup';
          renderAuthModal();
        });
      }
      const loginGoogleBtn = document.getElementById('loginGoogleBtn');
      if (loginGoogleBtn) {
        loginGoogleBtn.addEventListener('click', handleGoogleSignIn);
      }
    } else if (view === 'signup') {
      const signupForm = document.getElementById('signupForm');
      if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
      }
      const showLoginBtn = document.getElementById('showLoginBtn');
      if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
          currentAuthView = 'login';
          renderAuthModal();
        });
      }
      const signupGoogleBtn = document.getElementById('signupGoogleBtn');
      if (signupGoogleBtn) {
        signupGoogleBtn.addEventListener('click', handleGoogleSignIn);
      }
    } else if (view === 'forgot') {
      const forgotForm = document.getElementById('forgotForm');
      if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotPassword);
      }
      const backToLoginBtn = document.getElementById('backToLoginBtn');
      if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
          currentAuthView = 'login';
          renderAuthModal();
        });
      }
    }
  }

  /* -------------------- Validation Helpers -------------------- */
  function showFieldError(fieldId, message) {
    const errorEl = document.getElementById(fieldId + 'Error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  function clearFieldError(fieldId) {
    const errorEl = document.getElementById(fieldId + 'Error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  function clearAllErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });
  }

  function setButtonLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
    if (btnLoader) btnLoader.style.display = isLoading ? 'inline-block' : 'none';
    btn.disabled = isLoading;
  }

  /* -------------------- Auth Handlers -------------------- */
  function handleLogin(e) {
    e.preventDefault();
    clearAllErrors('loginForm');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    let hasError = false;
    if (!email) {
      showFieldError('loginEmail', 'Please enter your email');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError('loginEmail', 'Please enter a valid email address');
      hasError = true;
    }
    if (!password) {
      showFieldError('loginPassword', 'Please enter your password');
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading('loginSubmitBtn', true);
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        showToast('Welcome back! You are now signed in.');
        closeAuthModal();
      })
      .catch((error) => {
        showFieldError('loginPassword', getAuthErrorMessage(error.code));
      })
      .finally(() => {
        setButtonLoading('loginSubmitBtn', false);
      });
  }

  function handleSignup(e) {
    e.preventDefault();
    clearAllErrors('signupForm');

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const region = document.getElementById('signupRegion').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    let hasError = false;
    if (!name || name.length < 2) {
      showFieldError('signupName', 'Please enter your full name');
      hasError = true;
    }
    if (!email) {
      showFieldError('signupEmail', 'Please enter your email');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError('signupEmail', 'Please enter a valid email address');
      hasError = true;
    }
    if (!region) {
      showFieldError('signupRegion', 'Please select your country/region');
      hasError = true;
    }
    if (!password || password.length < 6) {
      showFieldError('signupPassword', 'Password must be at least 6 characters');
      hasError = true;
    }
    if (password !== confirmPassword) {
      showFieldError('signupConfirmPassword', 'Passwords do not match');
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading('signupSubmitBtn', true);
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        return user.updateProfile({ displayName: name })
          .then(() => {
            return database.ref('users/' + user.uid + '/profile').set({
              name: name,
              email: email,
              region: region,
              createdAt: firebase.database.ServerValue.TIMESTAMP
            });
          });
      })
      .then(() => {
        showToast('Account created successfully! Welcome to ZBH Pan & Plate.');
        closeAuthModal();
      })
      .catch((error) => {
        if (error.code === 'auth/email-already-in-use') {
          showFieldError('signupEmail', 'This email is already registered');
        } else {
          showFieldError('signupEmail', getAuthErrorMessage(error.code));
        }
      })
      .finally(() => {
        setButtonLoading('signupSubmitBtn', false);
      });
  }

  function handleForgotPassword(e) {
    e.preventDefault();
    clearAllErrors('forgotForm');

    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) {
      showFieldError('forgotEmail', 'Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      showFieldError('forgotEmail', 'Please enter a valid email address');
      return;
    }

    setButtonLoading('forgotSubmitBtn', true);
    auth.sendPasswordResetEmail(email)
      .then(() => {
        showToast('Password reset link sent! Please check your email.');
        currentAuthView = 'login';
        renderAuthModal();
      })
      .catch((error) => {
        showFieldError('forgotEmail', getAuthErrorMessage(error.code));
      })
      .finally(() => {
        setButtonLoading('forgotSubmitBtn', false);
      });
  }

  function handleLogout() {
    auth.signOut()
      .then(() => {
        showToast('You have been logged out.');
        favoritesSynced = false;
      })
      .catch((error) => {
        console.error('Logout error:', error);
        showToast('Logout failed. Please try again.');
      });
  }

  /* -------------------- Google Sign-In -------------------- */
  function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then((result) => {
        const user = result.user;
        const isNewUser = result.additionalUserInfo && result.additionalUserInfo.isNewUser;
        if (isNewUser) {
          return database.ref('users/' + user.uid + '/profile').set({
            name: user.displayName || 'User',
            email: user.email || '',
            region: 'Unknown',
            provider: 'google',
            createdAt: firebase.database.ServerValue.TIMESTAMP
          }).then(() => {
            showToast('Account created successfully! Welcome to ZBH Pan & Plate.');
          });
        }
        showToast('Welcome back! You are now signed in.');
      })
      .then(() => {
        closeAuthModal();
      })
      .catch((error) => {
        showToast(getAuthErrorMessage(error.code) || 'Google sign-in failed. Please try again.');
      });
  }

  /* -------------------- Helpers -------------------- */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function getAuthErrorMessage(code) {
    const messages = {
      'auth/invalid-email': 'Invalid email address format',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already registered',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled',
      'auth/weak-password': 'Password is too weak',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/invalid-credential': 'Invalid email or password',
      'auth/user-mismatch': 'User mismatch',
      'auth/credential-already-in-use': 'Credential already in use',
      'auth/popup-closed-by-user': 'Popup closed by user',
      'auth/popup-blocked': 'Popup blocked by browser',
      'auth/cancelled-popup-request': 'Cancelled popup request',
      'auth/internal-error': 'Internal error. Please try again',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method',
      'auth/cancelled-popup-request': 'Sign-in cancelled'
    };
    return messages[code] || 'An error occurred. Please try again.';
  }

  function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  /* -------------------- Event Bindings -------------------- */
  if (loginBtn) {
    loginBtn.addEventListener('click', () => openAuthModal('login'));
  }
  if (signupBtn) {
    signupBtn.addEventListener('click', () => openAuthModal('signup'));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  if (authModalClose) {
    authModalClose.addEventListener('click', closeAuthModal);
  }
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('open')) {
      closeAuthModal();
    }
  });

  if (userMenuBtn) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = userDropdown && userDropdown.style.display === 'block';
      if (userDropdown) userDropdown.style.display = isOpen ? 'none' : 'block';
    });
  }

  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.contains(e.target)) {
      if (userDropdown) userDropdown.style.display = 'none';
    }
  });

  /* -------------------- Public API -------------------- */
  window.Auth = {
    getUser: () => auth.currentUser,
    isLoggedIn: () => !!auth.currentUser,
    getUserName: () => auth.currentUser ? (auth.currentUser.displayName || 'User') : null,
    getUserEmail: () => auth.currentUser ? auth.currentUser.email : null,
    getUserId: () => auth.currentUser ? auth.currentUser.uid : null,
    syncFavorites: (favArray) => {
      const user = auth.currentUser;
      if (user) {
        return saveFavoritesToFirebase(user.uid, favArray);
      }
      return Promise.resolve();
    },
    openLogin: () => openAuthModal('login'),
    openSignup: () => openAuthModal('signup'),
    logout: handleLogout,
    onFavoritesUpdated: (callback) => {
      document.addEventListener('auth:favoritesUpdated', callback);
    }
  };

})();
