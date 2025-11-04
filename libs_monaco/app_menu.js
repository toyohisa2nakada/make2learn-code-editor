let menuIdSequence = 0;

const ensureGlobalDialogStyles = (() => {
    let injected = false;
    return () => {
        if (injected) {
            return;
        }
        injected = true;
        const style = document.createElement('style');
        style.textContent = `
dialog.app-menu__dialog {
    border: none;
    border-radius: 8px;
    padding: 20px 24px;
    max-width: 360px;
    width: calc(100% - 40px);
    color: #333;
}

dialog.app-menu__dialog::backdrop {
    background: rgba(0, 0, 0, 0.35);
}

.app-menu__dialog-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-family: inherit;
}

.app-menu__dialog-title {
    margin: 0;
    font-size: 1.1rem;
}

.app-menu__dialog-body {
    margin: 0;
    font-size: 0.9rem;
}

.app-menu__dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.app-menu__dialog-button {
    min-width: 90px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 0.9rem;
    cursor: pointer;
    background-color: #ffffff;
}

.app-menu__dialog-button--ok {
    background-color: #ffd2b3;
    border-color: #ffb588;
}

.app-menu__dialog-button--ok:hover,
.app-menu__dialog-button--ok:focus {
    background-color: #ffbe8f;
}

.app-menu__dialog-button--cancel:hover,
.app-menu__dialog-button--cancel:focus {
    background-color: #f3f3f3;
}
        `;
        document.head.appendChild(style);
    };
})();

class AppMenu extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.menuId = `app-menu-${menuIdSequence += 1}`;
        this.isOpen = false;
        this.dialog = undefined;
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
        this.handleSettingsClick = this.handleSettingsClick.bind(this);
        this.handleDialogCancel = this.handleDialogCancel.bind(this);
        this.handleDialogClose = this.handleDialogClose.bind(this);
        this.handleDialogBackdrop = this.handleDialogBackdrop.bind(this);
    }

    connectedCallback() {
        if (!this.hasRendered) {
            this.render();
            this.hasRendered = true;
        }
        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleDocumentKeydown);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleDocumentKeydown);
        if (this.settingsItem) {
            this.settingsItem.removeEventListener('click', this.handleSettingsClick);
        }
        this.destroyDialog();
    }

    render() {
        const style = document.createElement('style');
        style.textContent = `
:host {
    display: inline-flex;
    margin-right: 8px;
}

.menu {
    position: relative;
    font-family: inherit;
    align-items: center;
    display: flex;
}

.menu__button {
    background-color: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-family: inherit;
}

.menu__button:focus,
.menu__button:hover {
    background-color: #ffe0d0;
}

.menu__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background-color: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-width: 120px;
    display: flex;
    flex-direction: column;
    z-index: 1000;
    padding: 4px 0;
}

.menu__dropdown[hidden] {
    display: none;
}

.menu__item {
    background: none;
    border: none;
    text-align: left;
    padding: 8px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: inherit;
}

.menu__item:hover,
.menu__item:focus {
    background-color: #ffe9de;
}
        `;

        const container = document.createElement('div');
        container.className = 'menu';

        const menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'menu__button';
        menuButton.textContent = 'メニュー';
        menuButton.setAttribute('aria-haspopup', 'true');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.id = `${this.menuId}-button`;

        const dropdown = document.createElement('div');
        dropdown.className = 'menu__dropdown';
        dropdown.setAttribute('role', 'menu');
        dropdown.id = `${this.menuId}-dropdown`;
        dropdown.hidden = true;

        const settingsItem = document.createElement('button');
        settingsItem.type = 'button';
        settingsItem.className = 'menu__item';
        settingsItem.textContent = '設定';
        settingsItem.setAttribute('role', 'menuitem');
        dropdown.appendChild(settingsItem);

        const fontSizeUpItem = document.createElement('button');
        fontSizeUpItem.type = 'button';
        fontSizeUpItem.className = 'menu__item';
        fontSizeUpItem.textContent = 'フォントサイズ大きく';
        fontSizeUpItem.setAttribute('role', 'menuitem');
        dropdown.appendChild(fontSizeUpItem);

        container.append(menuButton, dropdown);

        this.shadowRoot.append(style, container);

        this.menuButton = menuButton;
        this.dropdown = dropdown;
        this.settingsItem = settingsItem;

        this.menuButton.setAttribute('aria-controls', dropdown.id);

        this.menuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleMenu();
        });

        this.menuButton.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen) {
                event.preventDefault();
                this.closeMenu();
            } else if ((event.key === 'Enter' || event.key === ' ') && !this.isOpen) {
                event.preventDefault();
                this.openMenu();
            }
        });

        this.settingsItem.addEventListener('click', this.handleSettingsClick);
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        this.isOpen = true;
        this.dropdown.hidden = false;
        this.menuButton.setAttribute('aria-expanded', 'true');
    }

    closeMenu() {
        if (!this.isOpen) {
            return;
        }
        this.isOpen = false;
        this.dropdown.hidden = true;
        this.menuButton.setAttribute('aria-expanded', 'false');
    }

    handleDocumentClick(event) {
        if (!this.isOpen) {
            return;
        }
        const path = event.composedPath();
        if (path.includes(this)) {
            return;
        }
        this.closeMenu();
    }

    handleDocumentKeydown(event) {
        if (event.key === 'Escape') {
            if (this.isOpen) {
                this.closeMenu();
            }
        }
    }

    handleSettingsClick() {
        this.closeMenu();
        ensureGlobalDialogStyles();
        if (!this.dialog) {
            this.dialog = this.createDialog();
            document.body.appendChild(this.dialog);
        }
        if (!this.dialog.open) {
            this.dialog.showModal();
        }
    }

    createDialog() {
        const template = document.createElement('template');
        template.innerHTML = `
<dialog class="app-menu__dialog" aria-modal="true" aria-labelledby="app-menu-settings-title">
    <form method="dialog" class="app-menu__dialog-form">
        <h2 id="app-menu-settings-title" class="app-menu__dialog-title">設定</h2>
        <p class="app-menu__dialog-body">設定内容は準備中です。</p>
        <div class="app-menu__dialog-buttons">
            <button value="cancel" class="app-menu__dialog-button app-menu__dialog-button--cancel">キャンセル</button>
            <button value="ok" class="app-menu__dialog-button app-menu__dialog-button--ok">OK</button>
        </div>
    </form>
</dialog>
        `;
        const dialog = template.content.firstElementChild;
        dialog.addEventListener('cancel', this.handleDialogCancel);
        dialog.addEventListener('close', this.handleDialogClose);
        dialog.addEventListener('click', this.handleDialogBackdrop);
        return dialog;
    }

    handleDialogCancel(event) {
        event.preventDefault();
        if (this.dialog?.open) {
            this.dialog.close('cancel');
        }
    }

    handleDialogClose() {
        if (this.dialog && !this.dialog.returnValue) {
            this.dialog.returnValue = 'cancel';
        }
    }

    handleDialogBackdrop(event) {
        if (!this.dialog || event.target !== this.dialog) {
            return;
        }
        const rect = this.dialog.getBoundingClientRect();
        const inDialog = (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
        );
        if (!inDialog && this.dialog.open) {
            this.dialog.close('cancel');
        }
    }

    destroyDialog() {
        if (!this.dialog) {
            return;
        }
        this.dialog.removeEventListener('cancel', this.handleDialogCancel);
        this.dialog.removeEventListener('close', this.handleDialogClose);
        this.dialog.removeEventListener('click', this.handleDialogBackdrop);
        if (this.dialog.open) {
            this.dialog.close('cancel');
        }
        if (this.dialog.isConnected) {
            this.dialog.remove();
        }
        this.dialog = undefined;
    }
}

customElements.define('app-menu', AppMenu);
