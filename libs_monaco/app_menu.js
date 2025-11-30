let menuIdSequence = 0;

class AppMenu extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.menuId = `app-menu-${menuIdSequence += 1}`;
        this.isOpen = false;
        this.items = [];
        this.cleanupFns = [];
        this.submenuControls = [];

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    }

    static get observedAttributes() {
        return ['label'];
    }

    attributeChangedCallback(name, _oldValue, newValue) {
        if (name === 'label' && this.menuButton) {
            this.menuButton.textContent = newValue || '設定';
        }
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
        this.clearMenuItemListeners();
    }

    setItems(items) {
        if (!Array.isArray(items)) {
            this.items = [];
        } else {
            this.items = items.map((item) => ({ ...item }));
        }

        if (this.dropdown) {
            this.renderMenuItems();
        }
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
    font-size: 0.5rem;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
}

.menu__item:hover,
.menu__item:focus {
    background-color: #ffe9de;
}

.menu__item--has-submenu {
    padding-right: 16px;
}

.menu__item-arrow {
    font-size: 0.7rem;
    opacity: 0.6;
}

.menu__submenu-wrapper {
    position: relative;
}

.menu__submenu {
    position: absolute;
    top: 0;
    left: calc(100% - 8px);
    margin-left: 8px;
    background-color: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    min-width: 120px;
    padding: 4px 0;
    z-index: 1000;
}

.menu__submenu[hidden] {
    display: none;
}

.menu__submenu-item {
    width: 100%;
}

.menu__item-label {
    flex: 1;
}

.menu__item-shortcut {
    opacity: 0.7;
}
        `;

        const container = document.createElement('div');
        container.className = 'menu';

        const menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'menu__button';
        menuButton.textContent = this.getAttribute('label') || '設定';
        menuButton.setAttribute('aria-haspopup', 'true');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.id = `${this.menuId}-button`;

        const dropdown = document.createElement('div');
        dropdown.className = 'menu__dropdown';
        dropdown.setAttribute('role', 'menu');
        dropdown.id = `${this.menuId}-dropdown`;
        dropdown.hidden = true;

        container.append(menuButton, dropdown);
        this.shadowRoot.append(style, container);

        this.menuButton = menuButton;
        this.dropdown = dropdown;

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

        this.renderMenuItems();
    }

    renderMenuItems() {
        if (!this.dropdown) {
            return;
        }

        this.clearMenuItemListeners();
        this.dropdown.innerHTML = '';
        this.submenuControls = [];

        for (const item of this.items) {
            const element = this.createMenuItemElement(item);
            if (element) {
                this.dropdown.appendChild(element);
            }
        }
    }

    createMenuItemElement(item) {
        if (!item || typeof item.label !== 'string') {
            return null;
        }

        if (Array.isArray(item.items) && item.items.length > 0) {
            return this.createSubmenu(item);
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu__item';
        button.setAttribute('role', 'menuitem');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'menu__item-label';
        labelSpan.textContent = item.label;
        button.appendChild(labelSpan);

        if (item.shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'menu__item-shortcut';
            shortcutSpan.textContent = item.shortcut;
            button.appendChild(shortcutSpan);
        }

        const handleClick = () => {
            item.onSelect?.();
            this.closeMenu();
        };

        button.addEventListener('click', handleClick);
        this.cleanupFns.push(() => button.removeEventListener('click', handleClick));

        return button;
    }

    createSubmenu(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'menu__submenu-wrapper';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'menu__item menu__item--has-submenu';
        trigger.setAttribute('role', 'menuitem');
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', 'false');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'menu__item-label';
        labelSpan.textContent = item.label;

        const arrow = document.createElement('span');
        arrow.className = 'menu__item-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '>';

        trigger.append(labelSpan, arrow);

        const submenu = document.createElement('div');
        submenu.className = 'menu__submenu';
        submenu.setAttribute('role', 'menu');
        submenu.hidden = true;

        for (const child of item.items) {
            const childElement = this.createMenuItemElement(child);
            if (childElement) {
                childElement.classList.add('menu__submenu-item');
                submenu.appendChild(childElement);
            }
        }

        const openSubmenu = () => {
            submenu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
        };

        const closeSubmenu = () => {
            submenu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        };

        const handleMouseEnter = () => openSubmenu();
        const handleMouseLeave = (event) => {
            if (!wrapper.contains(event.relatedTarget)) {
                closeSubmenu();
            }
        };
        const handleFocusIn = () => openSubmenu();
        const handleFocusOut = (event) => {
            if (!wrapper.contains(event.relatedTarget)) {
                closeSubmenu();
            }
        };
        const handleKeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (submenu.hidden) {
                    openSubmenu();
                } else {
                    closeSubmenu();
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeSubmenu();
                trigger.blur();
            }
        };

        wrapper.addEventListener('mouseenter', handleMouseEnter);
        wrapper.addEventListener('mouseleave', handleMouseLeave);
        wrapper.addEventListener('focusin', handleFocusIn);
        wrapper.addEventListener('focusout', handleFocusOut);
        trigger.addEventListener('keydown', handleKeydown);

        this.cleanupFns.push(() => wrapper.removeEventListener('mouseenter', handleMouseEnter));
        this.cleanupFns.push(() => wrapper.removeEventListener('mouseleave', handleMouseLeave));
        this.cleanupFns.push(() => wrapper.removeEventListener('focusin', handleFocusIn));
        this.cleanupFns.push(() => wrapper.removeEventListener('focusout', handleFocusOut));
        this.cleanupFns.push(() => trigger.removeEventListener('keydown', handleKeydown));

        this.submenuControls.push({ close: closeSubmenu });

        wrapper.append(trigger, submenu);
        return wrapper;
    }

    clearMenuItemListeners() {
        for (const cleanup of this.cleanupFns) {
            cleanup();
        }
        this.cleanupFns = [];
        this.submenuControls = [];
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
        for (const control of this.submenuControls) {
            control.close();
        }
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
        if (event.key === 'Escape' && this.isOpen) {
            this.closeMenu();
        }
    }
}

customElements.define('app-menu', AppMenu);
