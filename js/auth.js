/* ==========================================================================
   ZBH Pan & Plate — Authentication Module
   ========================================================================== */

(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.warn('Firebase is not available. Authentication features are disabled.');
    window.Auth = window.Auth || {};
    window.Auth.isLoggedIn = () => false;
    window.Auth.getUser = () => null;
    window.Auth.getUserName = () => null;
    window.Auth.getUserEmail = () => null;
    window.Auth.getUserId = () => null;
    window.Auth.openLogin = () => {};
    window.Auth.openSignup = () => {};
    window.Auth.logout = () => {};
    window.Auth.syncFavorites = () => Promise.resolve();
    window.Auth.onFavoritesUpdated = () => {};
    return;
  }

  const auth = firebase.auth();
  const database = firebase.database();

  /* -------------------- Redirect Result Handling (GitHub Pages) -------------------- */
  function handleRedirectResult() {
    if (!auth.getRedirectResult) return;
    logAuth('Checking redirect result...');
    auth.getRedirectResult()
      .then((result) => {
        if (!result || !result.user) {
          logAuth('No redirect result user found');
          return null;
        }
        logAuth('Redirect result processed', { uid: result.user.uid, isNewUser: (result.additionalUserInfo && result.additionalUserInfo.isNewUser) || false });
        if (document.getElementById('authModal')) closeAuthModal();
        return processGoogleResult(result);
      })
      .then(() => {
        logAuth('Google sign-in fully processed');
        if (document.getElementById('authModal')) closeAuthModal();
      })
      .catch((error) => {
        if (error && error.code === 'auth/no-auth-result') {
          logAuth('No pending redirect result (normal on initial load)');
          return null;
        }
        logAuth('Redirect sign-in result error', { code: error.code, message: error.message });

        if (error.code === 'auth/account-exists-with-different-credential') {
          const email = error.email || 'this email';
          logAuth('Account exists with different credential', { email: email });
          showToast('An account already exists for ' + email + ' with a different sign-in method. Please sign in with that method instead.');
        } else if (error.code === 'auth/unauthorized-domain') {
          showToast('This domain is not authorized. Please add it in Firebase Console > Authentication > Settings > Authorized domains.');
        } else if (error.code === 'auth/invalid-action-code') {
          showToast('Sign-in action expired or is invalid. Please try again.');
        } else if (error.code === 'auth/network-request-failed') {
          showToast('Network error. Please check your connection and try again.');
        } else if (error.code === 'auth/operation-not-allowed') {
          showToast('Google sign-in is not enabled. Please enable it in Firebase Console.');
        } else if (error.code === 'auth/user-mismatch') {
          showToast('The Google account does not match the previously signed-in account. Please try again.');
        } else {
          showToast(getAuthErrorMessage(error));
        }
        return null;
      });
  }

  if (auth.getRedirectResult) {
    handleRedirectResult();
  }

  /* -------------------- Helpers -------------------- */
  function logAuth(message, data) {
    console.log('[Auth] ' + message, data || '');
  }

  function normalizeProvider(providerId) {
    if (!providerId) return 'email';
    return providerId === 'google.com' ? 'google' : 'password';
  }

  let currentAuthView = 'login';
  let favoritesSynced = false;

  /* -------------------- Auth State Observer -------------------- */
  auth.onAuthStateChanged((user) => {
    logAuth('Auth state changed', user ? { uid: user.uid, email: user.email, displayName: user.displayName } : 'signed out');
    if (user) {
      updateUIForLoggedInUser(user);
      syncFavoritesFromFirebase(user.uid);
    } else {
      updateUIForLoggedOutUser();
    }
  });

  /* -------------------- UI Updates -------------------- */
  function updateUIForLoggedInUser(user) {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');

    if (authButtons) authButtons.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';

    // Close auth modal if it's still open (e.g. session restored after
    // refresh on the login page, or sign-in completed via redirect)
    const authModal = document.getElementById('authModal');
    if (authModal && authModal.classList.contains('open')) {
      closeAuthModal();
    }

    // If the user is on a dedicated login/signup page, redirect to home
    var path = window.location.pathname;
    if (path.indexOf('/pages/login.html') !== -1 || path.indexOf('/pages/signup.html') !== -1) {
      window.location.href = '../index.html';
      return;
    }

    const displayName = user.displayName || 'User';
    const email = user.email || '';
    const initial = displayName.charAt(0).toUpperCase();

    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const userAvatarLargeEl = document.getElementById('userAvatarLarge');
    const userDropdownNameEl = document.getElementById('userDropdownName');
    const userDropdownEmailEl = document.getElementById('userDropdownEmail');
    if (userNameEl) userNameEl.textContent = displayName;
    if (userAvatarEl) userAvatarEl.textContent = initial;
    if (userDropdownNameEl) userDropdownNameEl.textContent = displayName;
    if (userDropdownEmailEl) userDropdownEmailEl.textContent = email;
    if (userAvatarLargeEl) userAvatarLargeEl.textContent = initial;

    const userDropdownRegionEl = document.getElementById('userDropdownRegion');
    database.ref('users/' + user.uid + '/profile').once('value').then((snapshot) => {
      const data = snapshot.val();
      if (data && data.region) {
        if (userDropdownRegionEl) userDropdownRegionEl.textContent = data.region;
      } else {
        if (userDropdownRegionEl) userDropdownRegionEl.textContent = 'Unknown';
      }
    }).catch(() => {
      if (userDropdownRegionEl) userDropdownRegionEl.textContent = 'Unknown';
    });
  }

  function updateUIForLoggedOutUser() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userDropdown = document.getElementById('userDropdown');
    if (authButtons) authButtons.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (userDropdown) userDropdown.style.display = 'none';
  }

  /* -------------------- Favorites Sync -------------------- */
   function syncFavoritesFromFirebase(uid) {
     if (favoritesSynced) return;
     const localFavorites = JSON.parse(localStorage.getItem('zbh_favorites') || '[]');

     database.ref('users/' + uid + '/favorites').once('value').then((snapshot) => {
       const raw = snapshot.val();
       // RTDB stores JS arrays as objects with numeric keys ({0:"id",1:"id"});
       // convert back to a proper array so .length and spread work correctly.
       const firebaseFavorites = (raw && typeof raw === 'object')
         ? Object.values(raw)
         : [];
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
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.remove('open');
    document.body.style.overflow = '';
    const authModalBody = document.getElementById('authModalBody');
    if (authModalBody) authModalBody.innerHTML = '';
  }

  function renderAuthModal() {
    const authModalBody = document.getElementById('authModalBody');
    if (!authModalBody) return;
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
    const authModalBody = document.getElementById('authModalBody');
    if (!authModalBody) return;
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
    const authModalBody = document.getElementById('authModalBody');
    if (!authModalBody) return;
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
    const authModalBody = document.getElementById('authModalBody');
    if (!authModalBody) return;
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
    const authModalBody = document.getElementById('authModalBody');
    if (!authModalBody) return;
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
  function handleLoginError(error) {
    logAuth('Login error', { code: error.code, message: error.message });
    if (error.code === 'auth/user-not-found') {
      showFieldError('loginEmail', 'No account found with this email');
    } else if (error.code === 'auth/wrong-password') {
      showFieldError('loginPassword', 'Incorrect password');
    } else if (error.code === 'auth/invalid-email') {
      showFieldError('loginEmail', 'Please enter a valid email address');
    } else if (error.code === 'auth/user-disabled') {
      showFieldError('loginEmail', 'This account has been disabled');
    } else if (error.code === 'auth/invalid-credential') {
      showFieldError('loginPassword', 'Incorrect email or password');
    } else if (error.code === 'auth/operation-not-allowed') {
      showFieldError('loginEmail', 'Email/password accounts are not enabled.');
    } else if (error.code === 'auth/too-many-requests') {
      showFieldError('loginPassword', 'Too many failed attempts. Please try again later.');
    } else if (error.code === 'auth/network-request-failed') {
      showToast('Network error. Please check your connection and try again.');
    } else if (error.code === 'auth/unauthorized-domain') {
      showToast('This domain is not authorized. Please add it in Firebase Console > Authentication > Settings > Authorized domains.');
    } else {
      showFieldError('loginPassword', getAuthErrorMessage(error));
    }
  }

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
        const user = userCredential.user;
        if (user) {
          database.ref('users/' + user.uid + '/profile')
            .update({ lastLogin: firebase.database.ServerValue.TIMESTAMP, provider: 'email' })
            .catch((err) => logAuth('Could not update lastLogin in RTDB', { error: err.message }));
        }
        showToast('Welcome back! You are now signed in.');
        closeAuthModal();
      })
      .catch(handleLoginError)
      .finally(() => {
        setButtonLoading('loginSubmitBtn', false);
      });
  }

  function handleSignupAuthError(error) {
    logAuth('Signup auth error', { code: error.code, message: error.message });
    if (error.code === 'auth/email-already-in-use') {
      showFieldError('signupEmail', 'This email is already registered. Try signing in instead.');
    } else if (error.code === 'auth/invalid-email') {
      showFieldError('signupEmail', 'Please enter a valid email address');
    } else if (error.code === 'auth/weak-password') {
      showFieldError('signupPassword', 'Password must be at least 6 characters');
    } else if (error.code === 'auth/operation-not-allowed') {
      showFieldError('signupEmail', 'Email/password accounts are not enabled.');
    } else if (error.code === 'auth/network-request-failed') {
      showToast('Network error. Please check your connection and try again.');
    } else if (error.code === 'auth/unauthorized-domain') {
      showToast('This domain is not authorized. Please add it in Firebase Console > Authentication > Settings > Authorized domains.');
    } else {
      showFieldError('signupEmail', getAuthErrorMessage(error));
    }
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
        // Auth account created — now save profile to RTDB
        return user.updateProfile({ displayName: name })
          .then(() => {
            return database.ref('users/' + user.uid + '/profile').set({
              name: name,
              email: email,
              region: region,
              provider: 'email',
              createdAt: firebase.database.ServerValue.TIMESTAMP,
              lastLogin: firebase.database.ServerValue.TIMESTAMP
            });
          })
          .then(() => {
            showToast('Account created successfully! Welcome to ZBH Pan & Plate.');
            closeAuthModal();
          })
          .catch((dbError) => {
            // Auth succeeded but profile DB write failed — account still exists
            logAuth('Signup profile DB write failed', { error: dbError.message });
            showToast('Account created! But profile setup failed. Please refresh and try logging in.');
            closeAuthModal();
          });
      })
      .catch(handleSignupAuthError)
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
        logAuth('Forgot password error', { code: error.code, message: error.message });
        showFieldError('forgotEmail', getAuthErrorMessage(error));
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
        logAuth('Logout error', { code: error.code, message: error.message });
        showToast('Logout failed: ' + getAuthErrorMessage(error));
      });
  }

  /* -------------------- Google Sign-In -------------------- */
  function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    logAuth('Starting Google sign-in...');

    // signInWithRedirect is the most reliable method on HTTPS static hosts
    // (GitHub Pages, Vercel, Netlify) and mobile browsers where
    // signInWithPopup is silently blocked by popup blockers.
    auth.signInWithRedirect(provider)
      .catch((error) => {
        logAuth('Google redirect sign-in error', { code: error.code, message: error.message });
        if (error.code === 'auth/unauthorized-domain') {
          showToast('This domain is not authorized. Please add it in Firebase Console > Authentication > Settings > Authorized domains.');
        } else if (error.code === 'auth/operation-not-allowed') {
          showToast('Google sign-in is not enabled. Please enable it in Firebase Console.');
        } else if (error.code === 'auth/invalid-action-code') {
          showToast('Sign-in action expired or is invalid. Please try again.');
        } else {
          showToast(getAuthErrorMessage(error));
        }
      });
  }

  function processGoogleResult(result) {
    const user = result.user;
    if (!user) {
      logAuth('processGoogleResult: no user in result');
      return Promise.resolve();
    }
    const isNewUser = result.additionalUserInfo && result.additionalUserInfo.isNewUser;
    const providerId = (result.additionalUserInfo && result.additionalUserInfo.providerId) || '';
    const provider = normalizeProvider(providerId);
    logAuth('Processing Google result', { uid: user.uid, isNewUser: isNewUser, provider: provider });

    const profileRef = database.ref('users/' + user.uid + '/profile');
    if (isNewUser) {
      return profileRef.set({
        name: user.displayName || 'User',
        email: user.email || '',
        region: 'Unknown',
        provider: provider,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastLogin: firebase.database.ServerValue.TIMESTAMP
      }).then(() => {
        logAuth('New Google user profile created', { uid: user.uid });
        showToast('Account created successfully! Welcome to ZBH Pan & Plate.');
      }).catch((error) => {
        logAuth('Error creating Google user profile', { error: error.message });
        showToast('Account created but profile setup failed. Please refresh.');
      });
    }
    return profileRef.update({
      lastLogin: firebase.database.ServerValue.TIMESTAMP,
      provider: provider
    }).then(() => {
      logAuth('Existing Google user profile updated', { uid: user.uid });
      showToast('Welcome back! You are now signed in.');
    }).catch((error) => {
      logAuth('Error updating Google user profile', { error: error.message });
      showToast('Welcome back! However, profile update failed.');
    });
  }

  /* -------------------- Helpers -------------------- */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function getAuthErrorMessage(error) {
    const code = (error && error.code) || 'unknown';
    const message = (error && error.message) || '';
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
      'auth/cancelled-popup-request': 'Sign-in cancelled',
      'auth/internal-error': 'Internal server error. Please try again later',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method',
      'auth/unauthorized-domain': 'This domain is not authorized. Please add it in Firebase Console > Authentication > Settings > Authorized domains.',
      'auth/web-storage-unsupported': 'Browser storage unavailable. Please enable cookies and try again.',
      'auth/invalid-action-code': 'Sign-in action expired or is invalid. Please try again.',
      'auth/invalid-oauth-client-id': 'Invalid OAuth client configuration. Please check Firebase Console.',
      'auth/invalid-oauth-provider': 'Invalid OAuth provider. Please check Google Cloud Console.',
      'auth/popup-blocked-by-browser': 'Popup was blocked by the browser. Please allow popups or use a different browser.',
      'auth/redirect-cancelled-by-user': 'Sign-in redirect was cancelled.',
      'auth/redirect-operation-pending': 'A redirect sign-in operation is already in progress.',
      'auth/token-revoked': 'Your session has expired. Please sign in again.',
      'auth/api-key-not-valid': 'Invalid API key. Please check your Firebase configuration.',
      'auth/quota-exceeded': 'Too many requests. Please try again later.',
      'auth/recipient-already-has-a-password': 'This email is already registered. Please sign in instead.',
      'auth/missing-android-pkg-name': 'Missing Android package name configuration.',
      'auth/missing-ios-bundle-id': 'Missing iOS bundle ID configuration.'
    };
    const known = messages[code];
    if (known) {
      return known;
    }
    // Unknown/unexpected Firebase error — log full details so it can be diagnosed
    logAuth('Unknown auth error code — NOT in message map', {
      code: code,
      message: message,
      fullError: error
    });
    return message
      ? 'Authentication error: ' + message + ' (code: ' + code + ')'
      : 'Authentication error (code: ' + code + ')';
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

  /* -------------------- Public API -------------------- */
  window.Auth = Object.assign(window.Auth || {}, {
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
  });
})();
