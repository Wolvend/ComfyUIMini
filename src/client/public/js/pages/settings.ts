import { getConfig, setConfig } from '../common/configLoader.js';
import { openPopupWindow, PopupWindowType } from '../common/popupWindow.js';
import { clearAllSavedInputValues } from '../modules/savedInputValues.js';

const themeSelectElem = document.getElementById('select-theme') as HTMLSelectElement;
const saveGalleryItemsPerPageButton = document.getElementById('set-gallery-items-per-page') as HTMLButtonElement;
const clearSavedInputValuesButton = document.getElementById('clear-saved-input-values') as HTMLButtonElement;
const compensatePreviewSaturationCheckbox = document.getElementById(
    'compensate-preview-saturation'
) as HTMLInputElement;
const authTokenInput = document.getElementById('auth-token-input') as HTMLInputElement | null;
const authLoginButton = document.getElementById('auth-login-button') as HTMLButtonElement | null;
const authLogoutButton = document.getElementById('auth-logout-button') as HTMLButtonElement | null;
const authStatusElem = document.getElementById('auth-status') as HTMLElement | null;

const allTooltipElems = document.querySelectorAll('[data-tooltip]');

allTooltipElems.forEach((elem) => {
    elem.addEventListener('click', () => {
        openPopupWindow((elem as HTMLElement).dataset.tooltip ?? '', PopupWindowType.INFO);
    });
});

themeSelectElem.addEventListener('change', async (e) => {
    if (!e.target) {
        console.error('No target found for theme select element.');
        return;
    }

    const selectedTheme = (e.target as HTMLSelectElement).value;

    const response = await fetch(`/setsetting/theme?theme=${selectedTheme}`);

    const responseText = await response.text();

    if (response.status === 200) {
        location.reload();
    } else {
        openPopupWindow(responseText, PopupWindowType.ERROR);
    }
});

saveGalleryItemsPerPageButton.addEventListener('click', async (e) => {
    if (!e.target) {
        console.error('No target found for save gallery items per page button.');
        return;
    }

    const inputElement = document.getElementById('gallery-items-per-page') as HTMLInputElement;
    const galleryItemsPerPage = inputElement.value;

    const response = await fetch(`/setsetting/galleryitemsperpage?count=${galleryItemsPerPage}`);
    const responseJson = await response.json();

    if (response.status === 200) {
        openPopupWindow(responseJson.message, PopupWindowType.INFO);
    } else {
        openPopupWindow(responseJson.error, PopupWindowType.ERROR);
    }
});

clearSavedInputValuesButton.addEventListener('click', () => {
    try {
        clearAllSavedInputValues();
        openPopupWindow('Cleared all saved input values.', PopupWindowType.INFO);
    } catch (error) {
        openPopupWindow('An error occured while clearing saved input values', PopupWindowType.ERROR, error);
    }
});

compensatePreviewSaturationCheckbox.addEventListener('change', () => {
    const checked = compensatePreviewSaturationCheckbox.checked;

    setConfig('workflow.compensatePreviewSaturation', checked);
});

async function refreshAuthStatus() {
    if (!authStatusElem || !authTokenInput || !authLoginButton || !authLogoutButton) {
        return;
    }

    authStatusElem.textContent = 'Checking authentication status...';

    try {
        const response = await fetch('/setsetting/auth');
        const responseJson = await response.json();

        if (!response.ok) {
            authStatusElem.textContent = 'Failed to fetch authentication status.';
            return;
        }

        const enabled = Boolean(responseJson.enabled);
        const authenticated = Boolean(responseJson.authenticated);

        if (!enabled) {
            authStatusElem.textContent = 'Access token is disabled on the server.';
            authTokenInput.disabled = true;
            authLoginButton.disabled = true;
            authLogoutButton.disabled = true;
            authLogoutButton.style.display = 'none';
            authLoginButton.style.display = 'inline-block';
            return;
        }

        if (authenticated) {
            authStatusElem.textContent = 'Authenticated.';
            authTokenInput.value = '';
            authTokenInput.disabled = true;
            authLoginButton.style.display = 'none';
            authLogoutButton.style.display = 'inline-block';
            authLogoutButton.disabled = false;
            return;
        }

        authStatusElem.textContent = 'Authentication required.';
        authTokenInput.disabled = false;
        authLoginButton.disabled = false;
        authLoginButton.style.display = 'inline-block';
        authLogoutButton.style.display = 'none';
        authLogoutButton.disabled = false;
    } catch (error) {
        authStatusElem.textContent = 'Failed to fetch authentication status.';
        console.error(error);
    }
}

if (authLoginButton && authTokenInput) {
    authLoginButton.addEventListener('click', async () => {
        const token = authTokenInput.value.trim();

        if (!token) {
            openPopupWindow('Token is required.', PopupWindowType.ERROR);
            return;
        }

        try {
            const response = await fetch('/setsetting/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
            });

            const responseJson = await response.json();

            if (response.ok) {
                openPopupWindow(responseJson.message || 'Authenticated.', PopupWindowType.INFO);
                await refreshAuthStatus();
            } else {
                openPopupWindow(responseJson.error || 'Authentication failed.', PopupWindowType.ERROR);
            }
        } catch (error) {
            openPopupWindow('An error occured while authenticating.', PopupWindowType.ERROR, error);
        }
    });

    authTokenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            authLoginButton.click();
        }
    });
}

if (authLogoutButton) {
    authLogoutButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/setsetting/auth', {
                method: 'DELETE',
            });

            const responseJson = await response.json();

            if (response.ok) {
                openPopupWindow(responseJson.message || 'Logged out.', PopupWindowType.INFO);
                await refreshAuthStatus();
            } else {
                openPopupWindow(responseJson.error || 'Failed to log out.', PopupWindowType.ERROR);
            }
        } catch (error) {
            openPopupWindow('An error occured while logging out.', PopupWindowType.ERROR, error);
        }
    });
}

function loadConfigsIntoPage() {
    const saturationCompensationConfig = getConfig('workflow.compensatePreviewSaturation') as boolean;

    if (saturationCompensationConfig === true || saturationCompensationConfig === undefined) {
        compensatePreviewSaturationCheckbox.checked = true;
    }
}

loadConfigsIntoPage();
refreshAuthStatus();
