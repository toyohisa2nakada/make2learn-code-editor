class AppMenuContainer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.menus = [];
    }

    connectedCallback() {
        if (this.hasRendered) {
            return;
        }
        this.render();
        this.hasRendered = true;
    }

    render() {
        const style = document.createElement('style');
        style.textContent = `
:host {
    display: inline-flex;
    align-items: center;
    gap: 0;
}

.container {
    display: inline-flex;
    align-items: center;
}
        `;

        const container = document.createElement('div');
        container.className = 'container';

        this.shadowRoot.append(style, container);

        // Ensure at least one menu exists for backwards compatibility
        if (this.menus.length === 0) {
            this.addMenu();
        }
    }

    addMenu({ label, items } = {}) {
        const container = this.shadowRoot.querySelector('.container');
        if (!container) {
            return undefined;
        }

        const menu = document.createElement('app-menu');
        if (label) {
            menu.setAttribute('label', label);
        }
        container.appendChild(menu);
        this.menus.push(menu);

        if (Array.isArray(items) && typeof menu.setItems === 'function') {
            menu.setItems(items);
        }

        return menu;
    }

    getMenu(index = 0) {
        return this.menus[index];
    }

    setMenuItems(index = 0, items = []) {
        const menu = this.getMenu(index);
        if (menu && typeof menu.setItems === 'function') {
            menu.setItems(items);
        }
    }
}

customElements.define('app-menu-container', AppMenuContainer);
export { AppMenuContainer };
