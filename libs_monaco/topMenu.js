const menuButton = document.getElementById('top_menu_button');
const dropdown = document.getElementById('top_menu_dropdown');
const settingsItem = document.getElementById('top_menu_settings');
const settingsDialog = document.getElementById('settings_dialog');

if (menuButton && dropdown) {
    let isOpen = false;

    const setMenuVisibility = (open) => {
        isOpen = open;
        menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            dropdown.removeAttribute('hidden');
        } else {
            dropdown.setAttribute('hidden', '');
        }
    };

    const closeMenu = () => setMenuVisibility(false);

    menuButton.addEventListener('click', (event) => {
        event.stopPropagation();
        setMenuVisibility(!isOpen);
    });

    menuButton.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeMenu();
        } else if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
            event.preventDefault();
            setMenuVisibility(true);
        }
    });

    dropdown.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', (event) => {
        if (!isOpen) {
            return;
        }
        if (menuButton.contains(event.target) || dropdown.contains(event.target)) {
            return;
        }
        closeMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen) {
            closeMenu();
        }
    });

    if (settingsItem && settingsDialog) {
        settingsItem.addEventListener('click', () => {
            closeMenu();
            if (!settingsDialog.open) {
                settingsDialog.showModal();
            }
        });
    }
}

if (settingsDialog) {
    settingsDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        settingsDialog.close('cancel');
    });

    settingsDialog.addEventListener('close', () => {
        if (!settingsDialog.returnValue) {
            settingsDialog.returnValue = 'cancel';
        }
    });
}
